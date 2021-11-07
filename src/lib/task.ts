import { Either } from 'monet'

type Result<E, R> = { status: 'failed'; err: E } | { status: 'success'; data: R }

const taskToTaskOfResult = <E, R>(t: Task<E, R>): Task<unknown, Result<E, R>> =>
  new Task<unknown, Result<E, R>>((_, res) => {
    t.fork(
      err => res({ status: 'failed', err }),
      succ => res({ status: 'success', data: succ }),
    )
  })

export class Task<E, X> {
  constructor(public fork: (reject: (err: E) => void, resolve: (x: X) => void) => void) {}

  static of<F, Y>(x: Y): Task<F, Y> {
    return new Task((_, resolve) => resolve(x))
  }

  static rejected<F, Y>(err: F): Task<F, Y> {
    return new Task(reject => reject(err))
  }

  static fromPromise<F, Y>(p: Promise<Y>): Task<F, Y> {
    return new Task((reject, resolve) => p.then(resolve).catch(reject))
  }

  static fromEither<E, R>(e: Either<E, R>): Task<E, R> {
    return new Task((reject, resolve) => e.fold(reject, resolve))
  }

  /**
   * Mimics promise all behaviour but runs sequentially a list of tasks, fails when some fails
   * @param arr Task<E, R>[] array of tasks to traverse
   * @returns Task<E, R[]> Task of array of resolved tasks
   */
  static allSeq<E, R>(arr: Task<E, R>[]): Task<E, R[]> {
    return arr.reduce(
      (acc, x) => x.bind(t => acc.map(listOfT => [...listOfT, t])),
      Task.of<E, R[]>([]),
    )
  }

  /**
   * Mimics promise all behaviour and runs in parallel a list of tasks, fails when some fails
   * @param arr Task<E, R>[] array of tasks to traverse
   * @returns Task<E, R[]> Task of array of resolved tasks
   */
  static all<E, R>(arr: Task<E, R>[]): Task<E, R[]> {
    return arr.reduce(
      (acc, tv) => acc.chain(list => Task.of((el: R) => [...list, el])).apTo(tv),
      Task.of<E, R[]>([]),
    )
  }

  static allSeattleSeq<E, R>(arr: Task<E, R>[]): Task<unknown, Result<E, R>[]> {
    return arr
      .map(taskToTaskOfResult)
      .reduce(
        (acc, x) => x.bind(t => acc.map(listOfT => [...listOfT, t])),
        Task.of<unknown, Result<E, R>[]>([]),
      )
  }

  static allSeattle<E, R>(arr: Task<E, R>[]): Task<unknown, Result<E, R>[]> {
    return arr
      .map(taskToTaskOfResult)
      .reduce(
        (acc, tv) =>
          acc.chain(list => Task.of((el: Result<E, R>) => [...list, el])).apTo(tv),
        Task.of<unknown, Result<E, R>[]>([]),
      )
  }

  ap<Y>(tf: Task<E, (x: X) => Y>): Task<E, Y> {
    return new Task((reject, resolve) => {
      let fn: (x: X) => Y
      let funcResolved = false
      let v: X
      let valResolved = false
      let rejected = false

      const guardReject = (x: E) => {
        if (!rejected) {
          rejected = true
          return reject(x)
        }
      }

      const guardResolver = (setter: (x: any) => void) => (x: any) => {
        if (rejected) {
          return
        }

        setter(x)
        return funcResolved && valResolved ? resolve(fn(v)) : x
      }

      this.fork(
        guardReject,
        guardResolver(x => {
          valResolved = true
          v = x
        }),
      )

      tf.fork(
        guardReject,
        guardResolver(x => {
          funcResolved = true
          fn = x
        }),
      )
    })
  }

  apTo<Y>(ty: Task<E, Y>): X extends (arg: Y) => any ? Task<E, ReturnType<X>> : never {
    return new Task((reject, resolve) => {
      let fn: any
      let funcResolved = false
      let v: Y
      let valResolved = false
      let rejected = false

      const guardReject = (x: E) => {
        if (!rejected) {
          rejected = true
          return reject(x)
        }
      }

      const guardResolver = (setter: (x: any) => void) => (x: any) => {
        if (rejected) {
          return
        }

        setter(x)
        return funcResolved && valResolved ? resolve(fn(v)) : x
      }

      this.fork(
        guardReject,
        guardResolver(x => {
          funcResolved = true
          fn = x
        }),
      )

      ty.fork(
        guardReject,
        guardResolver(x => {
          valResolved = true
          v = x
        }),
      )
    }) as any
  }

  map<Y>(f: (x: X) => Y): Task<E, Y> {
    return new Task((reject, resolve) =>
      this.fork(
        (err: E) => reject(err),
        (v: X) => resolve(f(v)),
      ),
    )
  }

  rejectMap<F>(f: (e: E) => F): Task<F, X> {
    return new Task((reject, resolve) =>
      this.fork(
        (err: E) => reject(f(err)),
        (x: X) => resolve(x),
      ),
    )
  }

  chain<Y>(f: (x: X) => Task<E, Y>): Task<E, Y> {
    return new Task((reject, resolve) =>
      this.fork(
        (err: E) => reject(err),
        (v: X) => f(v).fork(reject, resolve),
      ),
    )
  }
  bind = this.chain.bind(this)
  flatMap = this.chain.bind(this)

  orElse<F>(f: (e: E) => Task<F, X>): Task<F, X> {
    return new Task((reject, resolve) =>
      this.fork(
        (err: E) => f(err).fork(reject, resolve),
        (v: X) => resolve(v),
      ),
    )
  }

  bimap<F, Y>(f: (e: E) => F, g: (x: X) => Y): Task<F, Y> {
    return new Task((reject, resolve) =>
      this.fork(
        (e: E) => reject(f(e)),
        (x: X) => resolve(g(x)),
      ),
    )
  }

  fold<F, Y>(f: (e: E) => F, g: (x: X) => Y): Task<E, F | Y> {
    return new Task((_, resolve) =>
      this.fork(
        (e: E) => resolve(f(e)),
        (x: X) => resolve(g(x)),
      ),
    )
  }
  cata = this.fold.bind(this)
}
