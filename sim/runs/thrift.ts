/**
 * 任务2 · 节流银行流专项（v3.1 遗留：节流在"花光AP"策略下必亏，需配银行流重测）。
 * 全参数扫描：apCarry=1.5 固定，apCarryThrift ∈ {2, 2.5, 3}，apCap ∈ {20, 24}。
 * 对照组：同策略不盖节流（idleSaver，隔离"节流"这张卡本身的盈亏）。
 * 判定：45%~55% 为平衡带（节流成立）；之外给数值建议。
 */
import { runExperiment } from '../harness'
import { steadyFocus, bankThrift, idleSaver } from '../bots'
import { saveResult, fmtLine, type ExperimentResult } from '../stats'

const N = 5000
const KEY = 20000

export interface ThriftRow extends ExperimentResult {
  band: '平衡带' | '偏弱' | '偏强'
}

function bandOf(p: number): ThriftRow['band'] {
  return p >= 0.45 && p <= 0.55 ? '平衡带' : p < 0.45 ? '偏弱' : '偏强'
}

export function runThrift(): ThriftRow[] {
  const S = () => steadyFocus({ name: '稳打·集火残血' })
  const out: ThriftRow[] = []
  let seed = 22000
  for (const apCarryThrift of [2, 2.5, 3]) {
    for (const apCap of [20, 24]) {
      const rules = { apCarry: 1.5, apCarryThrift, apCap }
      // 主测：银行流（盖节流）
      const r = runExperiment(
        `thrift/银行节流 vs 稳打 (息×${apCarryThrift}/顶${apCap})`,
        bankThrift(), S(),
        { matches: N, seed: seed++, rules },
      )
      const row: ThriftRow = { ...r, band: bandOf(r.a.winrate) }
      out.push(row)
      console.log(`${row.band === '平衡带' ? '✅' : '⚠️'} ${fmtLine(r)} [${row.band}]`)
      // 对照：同策略不盖节流（节流这张卡的边际价值）
      const c = runExperiment(
        `thrift/对照·不盖节流 (息×${apCarryThrift}/顶${apCap})`,
        idleSaver(0, { name: '银行不节流', apFloor: 8 }), S(),
        { matches: N, seed: seed++, rules },
      )
      const crow: ThriftRow = { ...c, band: bandOf(c.a.winrate) }
      out.push(crow)
      console.log(`   ${fmtLine(c)} [对照]`)
    }
  }
  // 关键定稿组 2 万局：最接近平衡带中心的一组（默认规则 息×2/顶20）
  const key = runExperiment(
    'thrift/定稿组·银行节流 vs 稳打 (息×2/顶20, 2万局)',
    bankThrift(), S(),
    { matches: KEY, seed: 22999, rules: { apCarry: 1.5, apCarryThrift: 2, apCap: 20 } },
  )
  const krow: ThriftRow = { ...key, band: bandOf(key.a.winrate) }
  out.push(krow)
  console.log(`🔑 ${fmtLine(key)} [${krow.band}]`)
  saveResult('thrift.json', out)
  return out
}
