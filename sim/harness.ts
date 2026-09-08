/**
 * 对局驱动：用 contracts/game.ts 的 newMatch / submitDraft / submitOrders / advanceDazhe
 * 驱动整局 Bo5。机器人只拿到 clientView（与真人玩家相同的信息集），
 * 引擎是唯一规则真相，模拟器不含任何战斗逻辑。
 */
import {
  newMatch, submitDraft, submitOrders, advanceDazhe, validateDraft, validateOrders, clientView,
  RULES, type MatchState,
} from '../contracts/game'
import type { Bot } from './bots'
import { withSeed } from './rng'
import { winStats, round4, type ExperimentResult } from './stats'

export interface MatchResult {
  winner: 0 | 1 | null
  dazhes: number
  kills: number          // 全场双方合计击杀
  drawDazhes: number     // 平轮大局数
}

/** 驱动一整局。bots[0]=甲方, bots[1]=乙方 */
export function playMatch(botA: Bot, botB: Bot, onDraft?: (s: MatchState) => void): MatchResult {
  const s = newMatch()
  const bots = [botA, botB] as const
  let kills = 0
  let drawDazhes = 0
  let guard = 0
  while (s.phase !== 'matchEnd') {
    if (guard++ > 400) throw new Error('对局未在预期步数内结束（可能死锁）')
    if (s.phase === 'draft') {
      onDraft?.(s)
      for (const i of [0, 1] as const) {
        const view = clientView(s, i)
        const d = bots[i].draft(view)
        const err = validateDraft(s, i, d)
        if (err) throw new Error(`[${bots[i].name}] 布阵非法：${err}（手牌 ${s.sides[i].hand.join(',')}）`)
        submitDraft(s, i, d)
      }
    } else if (s.phase === 'orders') {
      for (const i of [0, 1] as const) {
        const view = clientView(s, i)
        const o = bots[i].orders(view)
        const err = validateOrders(s, i, o)
        if (err) throw new Error(`[${bots[i].name}] 指令非法：${err}（第${s.dazhe}大局第${s.round}小轮，AP=${s.sides[i].ap}）`)
        submitOrders(s, i, o)
      }
    } else if (s.phase === 'dazheResult') {
      kills += s.sides[0].fighters.filter((f) => !f.alive).length + s.sides[1].fighters.filter((f) => !f.alive).length
      if (s.summary?.winner === null) drawDazhes++
      advanceDazhe(s)
    } else {
      throw new Error(`未知阶段 ${s.phase}`)
    }
  }
  return { winner: s.winner, dazhes: s.dazhe, kills, drawDazhes }
}

export interface RunOpts {
  matches: number
  seed: number
  /** 规则参数覆盖（实验期间生效，结束恢复），如 { apCarryThrift: 2.5, apCap: 24 } */
  rules?: Record<string, number>
  note?: string
}

/**
 * 跑一组实验：n 局，左右座位对半互换消除位置偏差；
 * 每组实验用固定 seed 的 mulberry32 替换 Math.random，可逐字节复现。
 * 返回 A 方（botA）胜率统计。
 */
export function runExperiment(
  experiment: string,
  botA: Bot,
  botB: Bot,
  opts: RunOpts,
  onDraft?: (s: MatchState) => void,
): ExperimentResult {
  const origRules: Record<string, number> = {}
  for (const k of Object.keys(opts.rules ?? {})) {
    origRules[k] = (RULES as unknown as Record<string, number>)[k]
    ;(RULES as unknown as Record<string, number>)[k] = opts.rules![k]
  }
  try {
    return withSeed(opts.seed, () => {
      let aWins = 0
      let totalKills = 0
      let totalDazhes = 0
      let drawDazhes = 0
      for (let i = 0; i < opts.matches; i++) {
        // 偶数局 A 坐甲方，奇数局 A 坐乙方
        const r = i % 2 === 0 ? playMatch(botA, botB, onDraft) : playMatch(botB, botA, onDraft)
        const aWon = i % 2 === 0 ? r.winner === 0 : r.winner === 1
        if (aWon) aWins++
        totalKills += r.kills
        totalDazhes += r.dazhes
        drawDazhes += r.drawDazhes
      }
      return {
        experiment,
        seed: opts.seed,
        matches: opts.matches,
        sideA: botA.name,
        sideB: botB.name,
        a: winStats(aWins, opts.matches),
        avgKillsPerDazhe: round4(totalKills / Math.max(1, totalDazhes)),
        avgDazhes: round4(totalDazhes / opts.matches),
        drawDazheRate: round4(drawDazhes / Math.max(1, totalDazhes)),
        rules: opts.rules,
        note: opts.note,
      } satisfies ExperimentResult
    })
  } finally {
    for (const k of Object.keys(origRules)) (RULES as unknown as Record<string, number>)[k] = origRules[k]
  }
}
