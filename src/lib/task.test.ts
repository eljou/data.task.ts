import { Either } from 'monet'
import { Task } from './task'

describe('Async Task typeclass tests', () => {
  const badError = new Error('bad')

  const throwShouldNotHappen = () => {
    throw new Error('should not happen')
  }

  it('should create a new successful Task', () => {
    const t = new Task((_, res) => res(1))
    t.fork(throwShouldNotHappen, r => expect(r).toBe(1))
  })

  it('should create a rejected Task', () => {
    const t = new Task((rej, _) => rej(badError))
    t.fork(err => {
      expect(err).toBeInstanceOf(Error)
      expect((err as Error).message).toBe(badError.message)
    }, throwShouldNotHappen)
  })

  it('should create a pointed Task', () =>
    Task.of(1).fork(throwShouldNotHappen, r => expect(r).toBe(1)))

  it('should create a pointed rejected Task', () =>
    Task.rejected(badError).fork(err => {
      expect(err).toBeInstanceOf(Error)
      expect((err as Error).message).toBe(badError.message)
    }, throwShouldNotHappen))

  it('should create a Task from a Promise', () => {
    Task.fromPromise(Promise.resolve(1)).fork(throwShouldNotHappen, r =>
      expect(r).toBe(1),
    )
  })

  it('should create a Task from a lazy Promise', () => {
    Task.fromLazyPromise(() => Promise.resolve(1)).fork(throwShouldNotHappen, r =>
      expect(r).toBe(1),
    )
  })

  it('should be able to turn into a Promise', done => {
    Task.of(1)
      .toPromise()
      .then(r => expect(r).toBe(1))
      .then(done)
  })

  it('should create a successful Task from Either', () =>
    Task.fromEither(Either.right(1)).fork(throwShouldNotHappen, r => expect(r).toBe(1)))

  it('should create a failed Task from Either', () =>
    Task.fromEither(Either.left(badError)).fork(err => {
      expect(err).toBeInstanceOf(Error)
      expect((err as Error).message).toBe(badError.message)
    }, throwShouldNotHappen))

  it('should create a successful Task from try', () =>
    Task.fromTry(() => 1).fork(throwShouldNotHappen, r => expect(r).toBe(1)))

  it('should create a failed Task from try', () =>
    Task.fromTry(() => {
      throw badError
    }).fork(err => {
      expect(err).toBeInstanceOf(Error)
      expect((err as Error).message).toBe(badError.message)
    }, throwShouldNotHappen))

  it('should be a functor', () =>
    Task.of(1)
      .map(n => n + 1)
      .fork(throwShouldNotHappen, r => expect(r).toEqual(2)))

  it('should be a monad', () =>
    Task.of(1)
      .chain(n => Task.of(n + 1))
      .fork(throwShouldNotHappen, r => expect(r).toEqual(2)))

  it('should be an applicative', () =>
    Task.of(
      (y: number) =>
        (x: number): number =>
          x + y,
    )
      .apTo(Task.of(1))
      .apTo(Task.of(2))
      .fork(throwShouldNotHappen, r => expect(r).toEqual(3)))

  it('should be an applicative v2', () =>
    Task.of(1)
      .ap(Task.of(x => x + 1))
      .fork(throwShouldNotHappen, r => expect(r).toEqual(2)))

  it('should be able to map a failure', () =>
    Task.rejected(badError)
      .rejectMap(err => err.message)
      .fork(errStr => expect(errStr).toEqual('bad'), throwShouldNotHappen))

  it('should be able to map concat failure task', () =>
    Task.rejected(badError)
      .orElse(err => Task.rejected(err.message))
      .fork(errStr => expect(errStr).toEqual('bad'), throwShouldNotHappen))

  it('should be able to switch from failure', () =>
    Task.rejected(badError)
      .orElse(() => Task.of(1))
      .fork(throwShouldNotHappen, r => expect(r).toBe(1)))

  it('should be able to bimap', () =>
    new Task<Error, number>((rej, res) =>
      Math.floor(Math.random() * 10) > 5 ? rej(badError) : res(1),
    )
      .bimap(
        err => err.message,
        x => x + 1,
      )
      .fork(
        errStr => expect(errStr).toBe(badError.message),
        r => expect(r).toBe(2),
      ))

  it('should be able to tap', () => {
    const fn = jest.fn().mockImplementation(() => Task.of(expect('ok').toBe('ok')))

    Task.of(1)
      .chain(Task.tap(fn))
      .fork(throwShouldNotHappen, r => {
        expect(fn).toHaveBeenCalled()
        expect(r).toBe(1)
      })
  })

  it('should be able to reject tap', () => {
    const fn = jest.fn().mockImplementation(() => Task.rejected(expect('ok').toBe('ok')))

    Task.rejected(1)
      .orElse(Task.rejectTap(fn))
      .fork(f => {
        expect(fn).toHaveBeenCalled()
        expect(f).toBe(1)
      }, throwShouldNotHappen)
  })

  it('should process a series of successful tasks', () => {
    Task.all([Task.of(1), Task.of(2)]).fork(throwShouldNotHappen, ([n1, n2]) => {
      expect(n1).toBe(1)
      expect(n2).toBe(2)
    })
  })

  it('should process a series of successful tasks but get first failure', () => {
    Task.all([
      Task.of(1),
      Task.rejected(badError),
      Task.rejected(new Error('other error')),
    ]).fork(err => {
      expect(err).toBeInstanceOf(Error)
      expect((err as Error).message).toBe(badError.message)
    }, throwShouldNotHappen)
  })

  it('should process a series of successful tasks but get first failure', () => {
    Task.all([
      Task.of(1),
      Task.rejected(badError),
      Task.rejected(new Error('other error')),
    ]).fork(err => {
      expect(err).toBeInstanceOf(Error)
      expect((err as Error).message).toBe(badError.message)
    }, throwShouldNotHappen)
  })

  it('should process a series of tasks and get all results', () => {
    Task.allSeattle([
      Task.of(1),
      Task.rejected(badError),
      Task.rejected(new Error('other error')),
    ]).fork(throwShouldNotHappen, results => {
      expect(results).toHaveLength(3)
      expect(results.at(0)?.right()).toBe(1)
      expect(results.at(1)?.left()).toBeInstanceOf(Error)
      expect((results.at(1)?.left() as Error).message).toEqual(badError.message)
      expect(results.at(2)?.left()).toBeInstanceOf(Error)
      expect((results.at(2)?.left() as Error).message).toEqual('other error')
    })
  })
})
