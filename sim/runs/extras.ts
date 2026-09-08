/**
 * 锚点超差查因的补充实验（结果进 extras.json，分析见 REPORT.md）：
 * - 叫阵灵敏度：本模拟器基线集火效率高，增益通过斩杀阈值放大，与历史扫描方向相反；
 * - 全肉策略变体：功能绝技（嘲讽/反伤甲）在 8AP/大局经济下是 AP 陷阱；
 * - 换位闪避镜像：对称无偏 + 击杀趋零（双防互拖进伤害决胜）；
 * - 全肉调参验证（查因 B）：坦克血量/攻击面板 what-if，用 withRosterPatch 临时改
 *   ROSTER 并 finally 恢复，不影响其他实验。
 */
import { runExperiment } from '../harness'
import { steadyFocus, allTank, swapDodge, planStrategy } from '../bots'
import { saveResult, fmtLine, type ExperimentResult } from '../stats'
import { ROSTER, type CharId, type CharDef } from '../../contracts/game'

/** 实验期间临时给 ROSTER 打面板补丁，finally 恢复原值（不污染同进程其他实验） */
function withRosterPatch(patch: Partial<Record<CharId, Partial<CharDef>>>, fn: () => void): void {
  const orig: Partial<Record<CharId, Partial<CharDef>>> = {}
  for (const [c, p] of Object.entries(patch) as [CharId, Partial<CharDef>][]) {
    orig[c] = {}
    for (const k of Object.keys(p) as (keyof CharDef)[]) {
      ;(orig[c] as Record<string, unknown>)[k] = ROSTER[c][k]
      ;(ROSTER[c] as unknown as Record<string, unknown>)[k] = p[k]
    }
  }
  try {
    fn()
  } finally {
    for (const [c, p] of Object.entries(orig) as [CharId, Partial<CharDef>][]) {
      for (const [k, v] of Object.entries(p)) (ROSTER[c] as unknown as Record<string, unknown>)[k] = v
    }
  }
}

export function runExtras(): ExperimentResult[] {
  const S = () => steadyFocus({ name: '稳打·集火残血' })
  const out: ExperimentResult[] = []
  let seed = 44000
  for (const m of [0.3, 0.4, 0.5, 0.6]) {
    const r = runExperiment(
      `extra/叫阵+${m * 100}% vs 无卡`,
      steadyFocus({ name: `叫阵+${m * 100}%`, strategy: planStrategy('叫阵') }), S(),
      { matches: 5000, seed: seed++, rules: { jiaozhenBoost: m } },
    )
    out.push(r)
    console.log(fmtLine(r))
  }
  out.push(runExperiment('extra/全肉(不用功能绝技) vs 稳打', allTank({ utilityUlt: 'reserve' }), S(), { matches: 5000, seed: seed++ }))
  console.log(fmtLine(out[out.length - 1]))
  out.push(runExperiment('extra/全肉(每大局一次嘲讽) vs 稳打', allTank({ utilityUlt: 'once' }), S(), { matches: 5000, seed: seed++ }))
  console.log(fmtLine(out[out.length - 1]))
  out.push(runExperiment('extra/换位闪避镜像', swapDodge({ name: '闪避A' }), swapDodge({ name: '闪避B' }), { matches: 5000, seed: seed++ }))
  console.log(fmtLine(out[out.length - 1]))
  // 查因 B 调参验证：全肉坦克面板 what-if（攻击口径以基础输出面板 150~225 为基准，
  // 现行 135~203 即 −10%；−15% → 128~191，−17% → 125~187）
  const tankWhatIfs: { name: string; patch: Partial<Record<CharId, Partial<CharDef>>>; note: string; seed?: number }[] = [
    { name: 'extra/全肉[坦克血量1200] vs 稳打', patch: { 丙: { hp: 1200 }, 丁: { hp: 1200 } }, note: 'ROSTER补丁：丙/丁 hp 1300→1200' },
    { name: 'extra/全肉[坦克攻击-15%] vs 稳打', patch: { 丙: { lo: 128, hi: 191 }, 丁: { lo: 128, hi: 191 } }, note: 'ROSTER补丁：丙/丁攻击 135~203→128~191（基准150~225的-15%）' },
    { name: 'extra/全肉[坦克攻击-17%] vs 稳打', patch: { 丙: { lo: 125, hi: 187 }, 丁: { lo: 125, hi: 187 } }, note: 'ROSTER补丁：丙/丁攻击 135~203→125~187（基准150~225的-17%）' },
    // 深度削减组（剂量-反应延伸）：在现行 −10% 面板 135~203 上再 ×0.85/×0.83，
    // 即对基准 150~225 合计约 −23.5%/−25.4%。seed 固定 55000/55001，与查因 B 口径复核复跑值一致。
    { name: 'extra/全肉[坦克攻击-23.5%] vs 稳打', patch: { 丙: { lo: 115, hi: 173 }, 丁: { lo: 115, hi: 173 } }, note: 'ROSTER补丁：丙/丁攻击 135~203→115~173（现行面板×0.85，对基准150~225合计约-23.5%）', seed: 55000 },
    { name: 'extra/全肉[坦克攻击-25.4%] vs 稳打', patch: { 丙: { lo: 112, hi: 168 }, 丁: { lo: 112, hi: 168 } }, note: 'ROSTER补丁：丙/丁攻击 135~203→112~168（现行面板×0.83，对基准150~225合计约-25.4%）', seed: 55001 },
  ]
  for (const w of tankWhatIfs) {
    withRosterPatch(w.patch, () => {
      out.push(runExperiment(w.name, allTank({ utilityUlt: 'reserve' }), S(), { matches: 5000, seed: w.seed ?? seed++, note: w.note }))
    })
    console.log(fmtLine(out[out.length - 1]))
  }
  saveResult('extras.json', out)
  return out
}
