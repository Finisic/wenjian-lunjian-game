/** 冒烟：小规模镜像对局，验证 harness/bots 链路 */
import { runExperiment } from '../harness'
import { steadyFocus, idleSaver, swapDodge } from '../bots'
import { fmtLine } from '../stats'

const r1 = runExperiment('smoke/mirror', steadyFocus(), steadyFocus({ name: '稳打B' }), { matches: 200, seed: 1 })
console.log(fmtLine(r1))
const r2 = runExperiment('smoke/idle_vs_steady', idleSaver(), steadyFocus(), { matches: 200, seed: 2 })
console.log(fmtLine(r2))
const r3 = runExperiment('smoke/steady_vs_dodge', steadyFocus(), swapDodge(), { matches: 200, seed: 3 })
console.log(fmtLine(r3))
console.log('OK')
