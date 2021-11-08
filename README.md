# Data.Task in typescript

Personal Task type class functional implementation inspired by `data.task` npm package. I also use `monet` type classes implementantion as dependency for my package because i like its simplicity.

The `Task<E, R>` structure represents values that depend on time. This allows one
to model time-based effects explicitly, such that one can have full knowledge
of when they're dealing with delayed computations, latency, or anything that
can not be computed immediately.

A common use for this monad is to replace the usual
[Continuation-Passing Style][cps] form of programming, in order to be able to
compose and sequence time-dependent effects using the generic and powerful
monadic operations.

## Examples

```ts
// Simple Task, just like promises but better ;D
const getOne = new Task<Error, number>((_, res) => setTimeout(() => res(1), 500))
getOne.fork(console.error, one => console.log('this is one', one))

// Pointed Task: Task<unknown, number>
const getTwo = Task.of(2)
getTwo.fork(console.error, two => console.log('this is two', two))

// Mapping values
getOne.map(one => one + 5).fork(console.error, six => console.log('now is 6', six))

// Chaining Tasks
getOne
  .chain(one => Task.of(5 + one))
  .fork(console.error, six => console.log('now is 6', six))

// Concurrent apTo behaviour
const getOne = new Task<Error, number>((_, res) => setTimeout(() => res(1), 500))
const getTwo = new Task<Error, number>((_, res) => setTimeout(() => res(2), 1000))
const getThree = new Task<Error, number>((_, res) => setTimeout(() => res(3), 1500))

console.time('run')
Task.of((x: number) => (y: string) => (z: number) => x + z + y)
  .apTo(getOne)
  .apTo(getTwo)
  .apTo(getThree)
  .fork(console.error, r => {
    console.log(r)
    console.timeEnd('run')
  })
// you should see it run on almost 1500 ms because of concurrent execution

// Traversing an array of tasks concurrently with Task.all
const getTodo = (id: number): Task<Error, Todo> =>
  new Task((rej, res) => {
    console.time(`get-todo:${id}`)
    return axios
      .get(`https://jsonplaceholder.typicode.com/todos/${id}`)
      .then(r => {
        console.timeEnd(`get-todo:${id}`)
        return res(r.data)
      })
      .catch(rej)
  })

console.time('all')
Task.all([getTodo(1), getTodo(2), getTodo(3)]).fork(
  err => {
    console.error(err)
    console.timeEnd('all')
  },
  ([todo1, todo2, todo3, ...rest]) => {
    console.log(todo1, todo2, todo3, rest)
    console.timeEnd('all')
  },
)
```

## Installing

The easiest way is to grab it from NPM.

    $ npm install data.task.ts

### Personal consideration

I'm not an experimented functional programmer or advanced typescript developer so any help with type definitions or additional features to this type class implementation is very welcome. :D
