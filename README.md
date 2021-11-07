# data.task.ts

Personal functional Task type class implementation inspired by folktale `data.task` npm package implementation. I also use `monet` type classes implementantion as dependency for my package because i like its simplicity.

The `Task<E, R>` structure represents values that depend on time. This allows one
to model time-based effects explicitly, such that one can have full knowledge
of when they're dealing with delayed computations, latency, or anything that
can not be computed immediately.

A common use for this monad is to replace the usual
[Continuation-Passing Style][cps] form of programming, in order to be able to
compose and sequence time-dependent effects using the generic and powerful
monadic operations.

## Example

```ts
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
```

## Installing

The easiest way is to grab it from NPM.

    $ npm install data.task.ts

## Personal consideration

I'am not a experimented functional programmer or advanced typescript developer so any help with type definitions or additional features to this type class implementation is very welcome. :D
