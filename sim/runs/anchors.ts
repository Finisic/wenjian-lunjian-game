/**
 * 任务1 · 锚点回归：对照策划案 §十一 v2.4/v3/v3.1 历史数据，验证模拟器与引擎无偏。
 * 判定：胜率 ±3pp 以内为通过（策略实现细节差异允许）；超差在 REPORT.md 中查因。
 */
import { runExperiment } from '../harness'
import {
  steadyFocus, idleSaver, allTank, swapDodge, readSwap, planStrategy, planJudge, planArtifacts,
} from '../bots'
import { saveResult, fmtLine, type ExperimentResult } from '../stats'

const N = 5000
const KEY = 20000 // 关键定稿组

export interface AnchorRow extends ExperimentResult {
  anchor: string // 历史值
  pass: boolean
}

export function runAnchors(): AnchorRow[] {
  const S = (name = '稳打·集火残血') => steadyFocus({ name })
  const rows: Array<[string, ReturnType<typeof steadyFocus>, ReturnType<typeof steadyFocus>, number, number, string]> = [
    // [实验名, A, B, 局数, 历史A胜率%, 锚点描述]
    ['anchor/镜像基线', S('稳打A'), S('稳打B'), KEY, 49.4, '镜像≈50%，大局均击杀1.69'],
    ['anchor/挂机攒点 vs 稳打', idleSaver(), S(), N, 33.9, '空城流成立但不统治'],
    ['anchor/全肉 vs 均衡', allTank(), S(), N, 43.9, '略低于50%'],
    ['anchor/掣肘 vs 无卡', steadyFocus({ name: '稳打+掣肘', strategy: planStrategy('掣肘') }), S(), N, 57.1, '1AP −20%攻击'],
    ['anchor/神机妙算 vs 无卡', steadyFocus({ name: '稳打+神机', judge: planJudge('神机妙算') }), S(), N, 55.2, '0AP +5%神妙'],
    ['anchor/叫阵 vs 无卡', steadyFocus({ name: '稳打+叫阵', strategy: planStrategy('叫阵') }), S(), N, 44.7, '1AP +50%攻击'],
    ['anchor/拆招 vs 叫阵', steadyFocus({ name: '稳打+拆招', strategy: planStrategy('拆招') }), steadyFocus({ name: '稳打+叫阵', strategy: planStrategy('叫阵') }), N, 49.8, '1AP换1AP对消均衡'],
    ['anchor/乘势 vs 神机', steadyFocus({ name: '稳打+乘势', judge: planJudge('乘势') }), steadyFocus({ name: '稳打+神机', judge: planJudge('神机妙算') }), N, 57.1, '乘势是当前最强判定卡'],
    ['anchor/法器指定流 vs 无卡', steadyFocus({ name: '稳打+法器', artifacts: planArtifacts(1) }), S(), N, 29.0, '1AP/件指定获取仍偏弱'],
    ['anchor/换位链·稳打 vs 换位闪避', S(), swapDodge(), N, 8.7, '换位克集火'],
    ['anchor/换位链·读换位 vs 换位闪避', readSwap(), swapDodge(), N, 78.7, '读换位反打'],
  ]
  const out: AnchorRow[] = []
  for (const [name, a, b, n, anchorPct, anchor] of rows) {
    const r = runExperiment(name, a, b, { matches: n, seed: 11000 + out.length })
    const pass = Math.abs(r.a.winrate * 100 - anchorPct) <= 3
    const row: AnchorRow = { ...r, anchor: `历史 ${anchorPct}%（${anchor}）`, pass }
    out.push(row)
    console.log(`${pass ? '✅' : '❌'} ${fmtLine(r)}  | ${row.anchor}`)
  }
  saveResult('anchors.json', out)
  const passed = out.filter((r) => r.pass).length
  console.log(`\n锚点回归通过率：${passed}/${out.length}`)
  return out
}
