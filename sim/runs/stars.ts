/**
 * 任务3 · 升星·绝技强化（v3 结论：纯数值升星无定价解，方向=绝技质变+小面板）。
 * 规则扩展见 contracts/game.ts 的 STAR_RULES：布阵摸 4 张出现对子/三条可合成
 * 2★（绝技Lv2+面板+5%，仍上 3 人）/ 3★（绝技Lv3+面板+10%，少上 1 人）。
 *
 * 扫描「摸到指定侠客对子/三条就合成」vs「不合成双上」：
 * 目标 = 合成是可选的风格变体而非最优解（胜率带 45%~55%）；
 * 同时记录对子/三条出现率与条件胜率，评估对子运带来的对局方差。
 */
import type { CharId, MatchState } from '../../contracts/game'
import { playMatch } from '../harness'
import { steadyFocus, planSynthesize, ALL_CHARS } from '../bots'
import { withSeed } from '../rng'
import { saveResult, winStats, round4, type WinStats } from '../stats'

export interface StarRow {
  experiment: string
  char: CharId
  seed: number
  matches: number
  /** 合成方胜率 */
  a: WinStats
  band: '平衡带' | '偏弱' | '偏强'
  /** 大局手牌含任意对子/三条的比例（≈60% 为预期） */
  pairDazheRate: number
  tripleDazheRate: number
  /** 合成方在首大局摸到对子/三条时的条件胜率（方差评估：过高=对子运碾压） */
  wrWhenPaired: WinStats | null
  wrWhenUnpaired: WinStats | null
  avgKillsPerDazhe: number
}

function handPairs(hand: CharId[]): { pair: boolean; triple: boolean } {
  const cnt = new Map<CharId, number>()
  for (const c of hand) cnt.set(c, (cnt.get(c) ?? 0) + 1)
  let pair = false
  let triple = false
  for (const n of cnt.values()) {
    if (n >= 2) pair = true
    if (n >= 3) triple = true
  }
  return { pair, triple }
}

export function starExperiment(char: CharId, matches: number, seed: number): StarRow {
  return withSeed(seed, () => {
    let aWins = 0
    let totalKills = 0
    let totalDazhes = 0
    let pairDazhes = 0
    let tripleDazhes = 0
    // 首大局手牌（合成方一侧）是否带对子 → 条件胜率
    let pairedWins = 0
    let pairedGames = 0
    let unpairedWins = 0
    let unpairedGames = 0
    for (let i = 0; i < matches; i++) {
      const mkA = () => steadyFocus({ name: `合成·${char}`, synthesize: planSynthesize(char) })
      const mkB = () => steadyFocus({ name: '不合成·双上' })
      const aSide = i % 2
      let dazhe1Paired = false
      const onDraft = (s: MatchState) => {
        const h = handPairs(s.sides[aSide].hand)
        if (h.pair) pairDazhes++
        if (h.triple) tripleDazhes++
        if (s.dazhe === 1) dazhe1Paired = h.pair
      }
      const r = aSide === 0 ? playMatch(mkA(), mkB(), onDraft) : playMatch(mkB(), mkA(), onDraft)
      const aWon = aSide === 0 ? r.winner === 0 : r.winner === 1
      if (aWon) aWins++
      if (dazhe1Paired) {
        pairedGames++
        if (aWon) pairedWins++
      } else {
        unpairedGames++
        if (aWon) unpairedWins++
      }
      totalKills += r.kills
      totalDazhes += r.dazhes
    }
    const a = winStats(aWins, matches)
    return {
      experiment: `star/合成 vs 双上 · ${char}`,
      char,
      seed,
      matches,
      a,
      band: a.winrate >= 0.45 && a.winrate <= 0.55 ? '平衡带' : a.winrate < 0.45 ? '偏弱' : '偏强',
      pairDazheRate: round4(pairDazhes / Math.max(1, totalDazhes)),
      tripleDazheRate: round4(tripleDazhes / Math.max(1, totalDazhes)),
      wrWhenPaired: pairedGames > 0 ? winStats(pairedWins, pairedGames) : null,
      wrWhenUnpaired: unpairedGames > 0 ? winStats(unpairedWins, unpairedGames) : null,
      avgKillsPerDazhe: round4(totalKills / Math.max(1, totalDazhes)),
    } satisfies StarRow
  })
}

export function runStars(matches = 20000, seedBase = 33000): StarRow[] {
  const out: StarRow[] = []
  for (const c of ALL_CHARS) {
    const r = starExperiment(c, matches, seedBase + c.charCodeAt(0))
    out.push(r)
    const wp = r.wrWhenPaired ? (r.wrWhenPaired.winrate * 100).toFixed(1) : '-'
    const wu = r.wrWhenUnpaired ? (r.wrWhenUnpaired.winrate * 100).toFixed(1) : '-'
    console.log(
      `${r.band === '平衡带' ? '✅' : '⚠️'} ${c} 合成胜率 ${(r.a.winrate * 100).toFixed(1)}%±${(r.a.eps * 100).toFixed(1)} ` +
        `| 对子率 ${(r.pairDazheRate * 100).toFixed(1)}% 三条率 ${(r.tripleDazheRate * 100).toFixed(1)}% ` +
        `| 有对子胜率 ${wp}% / 无对子胜率 ${wu}% | kills/dazhe ${r.avgKillsPerDazhe}`,
    )
  }
  saveResult('stars.json', out)
  return out
}
