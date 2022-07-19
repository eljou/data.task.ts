import { Task } from '../lib/task'

export function run() {
  const t = Task.of<Error, number>(2)
    .chain(n => Task.of<Error, number>(n + 1))
    .chain(Task.tap(input => Task.of(console.log(`After (+1) :${input}`))))
    .map(n => n * 2)

  t.fork(
    err => console.error(`ERR: ${err}`),
    final => console.log(`SUCC: ${final}`),
  )
}
