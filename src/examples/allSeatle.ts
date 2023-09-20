import { Task } from '../lib/task'

export function run() {
  console.time('run')

  const getDelayedTask = <T>(ms: number, value: T) =>
    new Task<Error, T>((rej, res) =>
      setTimeout(() => {
        console.timeLog('run', value)
        return Math.floor(Math.random() * 10) > 5
          ? res(value)
          : rej(new Error('bad error on: ' + value))
      }, ms),
    )

  // This runs on parallel, change to allSeatleSeq to run it on sequence
  Task.allSeattle([
    getDelayedTask(1000, 2),
    getDelayedTask(500, 'a'),
    getDelayedTask(700, true),
  ]).fork(
    err => console.log(err),
    succ => {
      succ.map(e =>
        e.fold(
          ex => console.error(`ERR: ${ex}`),
          r => console.log(`SUCC: ${r}`),
        ),
      )
      console.timeEnd('run')
    },
  )
}

type Wraper<X> = { x: X }

type Remap<T extends readonly unknown[] | []> = Wraper<{ [P in keyof T]: T[P] }>

type Final = Remap<[number, boolean, string]>
