/**
 * 实验 CLI 入口。用法（见 sim/README.md）：
 *   npm run sim -- anchors|thrift|stars|all
 * 结果写入 sim/results/*.json（含种子、局数、胜率、95% 置信区间）。
 */
import { runAnchors } from './anchors'
import { runThrift } from './thrift'
import { runStars } from './stars'
import { runExtras } from './extras'

const which = process.argv[2] ?? 'all'
const t0 = Date.now()
if (which === 'anchors' || which === 'all') runAnchors()
if (which === 'thrift' || which === 'all') runThrift()
if (which === 'stars' || which === 'all') runStars()
if (which === 'extras' || which === 'all') runExtras()
console.log(`\n全部实验完成，用时 ${((Date.now() - t0) / 1000).toFixed(1)}s`)
