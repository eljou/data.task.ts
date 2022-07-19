import { Task } from '../lib/task'

export function run() {
  const t = Task.fromTry<Error, number>(() => {
    if (Math.floor(Math.random() * 10) > 5) return 99
    else {
      throw new Error('bad error')
    }
  })

  t.fork(
    err => console.error(`ERR: ${err}`),
    final => console.log(`SUCC: ${final}`),
  )
}
