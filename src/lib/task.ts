import { Either } from 'monet'

const taskToTaskOfEither = <E, R>(t: Task<E, R>): Task<never, Either<E, R>> =>
  new Task((_, res) => {
    t.fork(
      err => res(Either.Left(err)),
      succ => res(Either.Right(succ)),
    )
  })

type GetTaskSuccess<T> = T extends Task<unknown, infer R> ? R : never
type GetTaskFailure<T> = T extends Task<infer F, unknown> ? F : never

type UnwrapTaskSucceses<T extends readonly any[]> = T extends [infer Head, ...infer Tail]
  ? [GetTaskSuccess<Head>, ...UnwrapTaskSucceses<Tail>]
  : []

type DisjoinTaskFailures<T extends readonly any[]> = T extends [infer Head, ...infer Tail]
  ? GetTaskFailure<Head> | DisjoinTaskFailures<Tail>
  : never

type RemapTasks<T extends readonly any[]> = Task<
  DisjoinTaskFailures<T>,
  UnwrapTaskSucceses<T>
>

type GetEitherFromTask<T> = T extends Task<infer F, infer S> ? Either<F, S> : never

type MapTasksToEithers<T extends readonly any[]> = T extends [infer Head, ...infer Tail]
  ? [GetEitherFromTask<Head>, ...MapTasksToEithers<Tail>]
  : []

type RemapTasksSeattle<T extends readonly any[]> = Task<never, MapTasksToEithers<T>>

/**
 * The `Task<E, R>` structure represents values that depend on time. This
 * allows one to model time-based effects explicitly, such that one can have
 * full knowledge of when they're dealing with delayed computations, latency,
 * or anything that can not be computed immediately.
 *
 * A common use for this structure is to replace the usual Continuation-Passing
 * Style form of programming, in order to be able to compose and sequence
 * time-dependent effects using the generic and powerful monadic operations.
 *
 * @class
 * @summary
 * ((α → Void), (β → Void) → Void)) → Task<E, R>
 *
 * Task<E, R> <: Monad[β]
 *               , Functor[β]
 *               , Applicative[β]
 */
export class Task<E, R> {
  /**
   * Represents a lazy asyncronous computation a Task
   * @constructor
   * @param {(reject: (error: E) => void, resolve: (value: R) => void) => void} fork - Callback with resolvers for failure and success
   */
  constructor(public fork: (reject: (err: E) => void, resolve: (x: R) => void) => void) {}

  /**
   * Pointed constructor of a Task similar to Promise.resolve(any)
   * @param {R} r - value to resolve
   * @returns {Task<E, R>} the Task
   */
  static of<E, R>(r: R): Task<E, R> {
    return new Task((_, resolve) => resolve(r))
  }

  /**
   * Returns a rejected Task similar to Promise.reject(any)
   * @param {E} err - Error to reject
   * @returns {Task<E, R>} the rejected Task
   */
  static rejected<E, R>(err: E): Task<E, R> {
    return new Task(reject => reject(err))
  }

  /**
   * Transforms a promise to a Task, take into account that this will run the Promise because of its eager nature
   * @param {Promise<R>} p - Promise to convert to a Task
   * @returns {Task<E, R>} the Task from the Promise
   */
  static fromPromise<E, R>(p: Promise<R>): Task<E, R> {
    return new Task((reject, resolve) => p.then(resolve).catch(reject))
  }

  /**
   * Transforms a function that returns a promise to a Task, in this case the promise will be run lazily
   * @param {() => Promise<R>} p - Promise to convert to a Task
   * @returns {Task<E, R>} the Task from the Promise
   */
  static fromLazyPromise<E, R>(lazyPromise: () => Promise<R>): Task<E, R> {
    return new Task((reject, resolve) => lazyPromise().then(resolve).catch(reject))
  }

  /**
   * Applies natural transformation from Either to Task
   * @param {Either<E, R>} e - Either kind from monet
   * @returns {Task<E, R>} the Task from the Either provided
   */
  static fromEither<E, R>(e: Either<E, R>): Task<E, R> {
    return new Task((reject, resolve) => e.fold(reject, resolve))
  }

  /**
   * Transforms a function that throws to Task
   * @param {() => R} f - Function that returns R and might throw E
   * @returns {Task<E, R>} the Task
   */
  static fromTry<E, R>(f: () => R): Task<E, R> {
    return new Task((reject, resolve) => {
      try {
        return resolve(f())
      } catch (error) {
        return reject(error as E)
      }
    })
  }

  /**
   * Mimics Promise.all() behaviour but runs sequentially a list of Tasks, fails when some one fails
   * @param {[Task<E, R>, Task<E1, R1>, ... , Task<EN, RN>]} arr - Array of Tasks to traverse
   * @returns {Task<E | E2 | ... | EN, [R, R1, ... , RN]>} Task of array of resolved Tasks
   */
  static allSeq<T extends readonly Task<any, any>[]>(arr: [...T]): RemapTasks<T> {
    return arr.reduce(
      (acc, x) => x.bind(t => acc.map(listOfT => [...listOfT, t])),
      Task.of([]),
    )
  }

  /**
   * Mimics Promise.all() behaviour and runs in parallel a list of tasks, fails when some one fails
   * @param {[Task<E, R>, Task<E1, R1>, ... , Task<EN, RN>]} arr - Array of Tasks to traverse
   * @returns {Task<E | E2 | ... | EN, [R, R1, ... , RN]>} Task of array of resolved Tasks
   */

  static all<T extends readonly Task<any, any>[]>(arr: [...T]): RemapTasks<T> {
    return arr.reduce(
      (acc, tv) => acc.chain(list => Task.of((el: any) => [...list, el])).apTo(tv),
      Task.of([]),
    )
  }

  /**
   * Mimics Promise.allSeatle() behaviour and runs sequentially a list of Tasks, never fails
   * @param {[Task<E, R>, Task<E1, R1>, ... , Task<EN, RN>]} arr - Array of Tasks to traverse
   * @returns {Task<never, [Either<E, R>, Either<E1, R1>, ... , Either<EN, RN>]>} Task of array of resolved Tasks
   */
  static allSeattleSeq<T extends readonly Task<any, any>[]>(
    arr: [...T],
  ): RemapTasksSeattle<T> {
    return arr
      .map(taskToTaskOfEither)
      .reduce(
        (acc, x: any) => x.bind((t: any) => acc.map(listOfT => [...listOfT, t])),
        Task.of([]),
      ) as any
  }

  /**
   * Mimics Promise.allSeatle() behaviour and runs in parallel a list of Tasks, never fails
   * @param {[Task<E, R>, Task<E1, R1>, ... , Task<EN, RN>]} arr - Array of Tasks to traverse
   * @returns {Task<never, [Either<E, R>, Either<E1, R1>, ... , Either<EN, RN>]>} Task of array of resolved Tasks
   */
  static allSeattle<T extends readonly Task<any, any>[]>(
    arr: [...T],
  ): RemapTasksSeattle<T> {
    return arr
      .map(taskToTaskOfEither)
      .reduce(
        (acc, tv) =>
          acc.chain((list: any[]) => Task.of((el: any) => [...list, el])).apTo(tv),
        Task.of([]) as any,
      )
  }

  /**
   * Applys the successful value of the `Task<E, R>` to the successful
   * value of the `Task<E, (R → O)>`
   * @param {Task<E, (r: R) => O>} to - Task holding an `(R → O)` on the success path
   * @returns {Task<E, O>} the Task with the value applied
   */
  ap<Y>(tf: Task<E, (x: R) => Y>): Task<E, Y> {
    return new Task((reject, resolve) => {
      let fn: (x: R) => Y
      let funcResolved = false
      let v: R
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

  /**
   * Applys the successful value of the `Task<E, (R → O)>` to the successful
   * value of the `Task<E, R>`
   * @param {Task<E, O>} to - Task holding an `O` on the success path
   * @returns {Task<E, O>} the Task with the value applied
   */
  apTo<O>(to: Task<E, O>): R extends (arg: O) => any ? Task<E, ReturnType<R>> : never {
    return new Task((reject, resolve) => {
      let fn: any
      let funcResolved = false
      let v: O
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

      to.fork(
        guardReject,
        guardResolver(x => {
          valResolved = true
          v = x
        }),
      )
    }) as any
  }

  static map<E, R, T>(f: (r: R) => T): (t: Task<E, R>) => Task<E, T> {
    return t => t.map(f)
  }

  /**
   * Applies the function [f] in the success path of resolution of the Task. Functor interface implementation
   * @param {(r: R) => O} f - Function that transfroms from type R to type O
   * @returns {Task<E, O>} A Task containing an element of type O
   */
  map<O>(f: (r: R) => O): Task<E, O> {
    return new Task((reject, resolve) =>
      this.fork(
        (err: E) => reject(err),
        (r: R) => resolve(f(r)),
      ),
    )
  }

  /**
   * Applies the function [g] in the failure path of resolution of the Task
   * @param {(e: E) => F} g - Function that transfroms from type E to type F
   * @returns {Task<F, R>} A Task containing an element of type R but a failure of type F
   */
  rejectMap<F>(g: (e: E) => F): Task<F, R> {
    return new Task((reject, resolve) =>
      this.fork(
        (err: E) => reject(g(err)),
        (x: R) => resolve(x),
      ),
    )
  }

  /**
   * Applies the function [f] in the success path of resolution of the Task. Monad interface implementation
   * @param {(r: R) => Task<E, O>} f - Function that transfroms from type R to type O
   * @returns {Task<E, O>} A Task containing an element of type O
   */
  chain<O, E2>(f: (r: R) => Task<E2, O>): Task<E | E2, O> {
    return new Task((reject, resolve) =>
      this.fork(
        (err: E) => reject(err),
        (r: R) => f(r).fork(reject, resolve),
      ),
    )
  }
  /**
   * Chain function
   * @alias chain
   */
  bind = this.chain.bind(this)
  /**
   * Chain function
   * @alias chain
   */
  flatMap = this.chain.bind(this)

  /**
   * Applies the function [g] in the failure path of resolution of the Task
   * @param {(e: E) => Task<F, R>} g - Function that transfroms from type E to type F
   * @returns {Task<F, R>} A Task containing an element of type R or failure of type F
   */
  orElse<F, O>(g: (e: E) => Task<F, O>): Task<F, R | O> {
    return new Task((reject, resolve) =>
      this.fork(
        (err: E) => g(err).fork(reject, resolve),
        (r: R) => resolve(r),
      ),
    )
  }

  /**
   * Maps over both sides of execution applying [f] over success path or [g] over failure path
   * @param {(r: R) => Task<E, O>} g - Function that transfroms from type R to type O
   * @param {(e: E) => Task<F, R>} f - Function that transfroms from type E to type F
   * @returns A Task containing a failure of type F or a success of type O
   */
  bimap<F, O>(g: (e: E) => F, f: (r: R) => O): Task<F, O> {
    return new Task((reject, resolve) =>
      this.fork(
        (e: E) => reject(g(e)),
        (r: R) => resolve(f(r)),
      ),
    )
  }

  /**
   * Catamorphism. Takes two functions [f] and [g], applies the leftmost one to the failure
   * value, and the rightmost one to the successful value, depending on which one
   * is present.
   * @param {(r: R) => Task<E, O>} f - Function that transfroms from type R to type O
   * @param {(e: E) => Task<F, R>} g - Function that transfroms from type E to type F
   * @returns A Task containing a failure of type F or a success of type O
   */
  fold<F, O>(g: (e: E) => F, f: (r: R) => O): Task<E, F | O> {
    return new Task((_, resolve) =>
      this.fork(
        (e: E) => resolve(g(e)),
        (r: R) => resolve(f(r)),
      ),
    )
  }
  /**
   * Cata function
   * @alias fold
   */
  cata = this.fold.bind(this)

  /**
   * Natural transformation to Promise
   * You don't know when this could come in handy
   * @returns {Promise<R>} a Promise equivalent
   */
  toPromise(): Promise<R> {
    return new Promise((resolve, reject) => this.fork(reject, resolve))
  }

  /**
   * Adapts a function that returns a Task<Error, Success> to bypass Success and continue composition
   * @param {(r: S) => Task<E, void>} f - Function that returns a Task<E, void>
   * @param {S} success - Success from the previous function
   * @returns A Task<Error, Success> of the same output Success
   */
  static tap<E, S>(f: (input: S) => Task<E, void>): (i: S) => Task<E, S> {
    return input => f(input).map(() => input)
  }

  /**
   * Adapts a function that returns a Task<Error, Success> to bypass error and continue composition
   * @param {(r: S) => Task<void, E>} f - Function that returns a Task<void, Error>
   * @param {E} failure - Failure of the previous function
   * @returns A Task<Error, Success> of the same failure Error
   */
  static rejectTap<E, S>(f: (input: E) => Task<void, S>): (i: E) => Task<E, S> {
    return failure => f(failure).rejectMap(() => failure)
  }
}
