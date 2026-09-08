// ============================================================
// PVE 平衡自检 —— 用线上引擎跑蒙特卡洛自动战斗（引擎即真相）
// 标准养成进度模型：模拟"把经验丹投入主力队、十连保底拿4★"的普通玩家
// 运行：npx vite-node src/game/__sim__/pveBalance.ts
// ============================================================
import type { OwnedHero } from '../types'
import { simulateBattle } from '../engine'

/** 标准养成进度队伍（基准玩家成长路径） */
export function standardTeam(floor: number): OwnedHero[] {
  // 第1层：只有初始侠客柳青（教学层 1v1）
  if (floor === 1) return [{ heroId: 'liu_qing', level: 1, star: 1, exp: 0 }]
  // 第2层起：开局十连（1600玉璧）保底4★铁无踪 + 若干3★，主力三人队成型
  const team: OwnedHero[] = [
    { heroId: 'tie_wuzong', level: 1, star: 1, exp: 0 }, // 十连保底4★
    { heroId: 'shi_gandang', level: 1, star: 1, exp: 0 },
    { heroId: 'liu_qing', level: 1, star: 1, exp: 0 },
  ]
  // 等级模型：经验丹全投主力 → 等级≈层数+2（含奇遇经验丹与十连后丹药结余的投入）
  const level = Math.min(60, floor + 2)
  for (const h of team) h.level = level
  // 第8层起：长线抽取给主C换上4★输出燕小乙（替换3★柳青）
  if (floor >= 8) team[2] = { heroId: 'yan_xiaoyi', level, star: 1, exp: 0 }
  // 第10层起：主C 4★ 抽到重复卡升2★——「第10层开始要求4★或养成投入」的量化表达
  if (floor >= 10) team[0].star = 2
  return team
}

export interface BalanceRow {
  floor: number
  winRate: number      // 0~1
  avgRounds: number
  avgAlliesLeft: number
  battles: number
}

export function simulateFloor(floor: number, battles: number): BalanceRow {
  const team = standardTeam(floor)
  let wins = 0, rounds = 0, alliesLeft = 0
  for (let i = 0; i < battles; i++) {
    const r = simulateBattle(team, floor)
    if (r.win) wins++
    rounds += r.rounds
    alliesLeft += r.alliesLeft
  }
  return {
    floor,
    winRate: wins / battles,
    avgRounds: rounds / battles,
    avgAlliesLeft: alliesLeft / battles,
    battles,
  }
}

/** 平衡目标带：1层≈100% / 5层≥90% / 10层60~80% / 15层有挑战 */
export const BALANCE_TARGETS: Record<number, { min: number; max: number; label: string }> = {
  1:  { min: 0.99, max: 1.0,  label: '教学层必胜' },
  5:  { min: 0.90, max: 1.0,  label: '新手期顺推' },
  10: { min: 0.60, max: 0.80, label: '要求4★或养成投入' },
  15: { min: 0.25, max: 0.65, label: '有挑战' },
}

export function runPveBalanceReport(battles = 400, floors = [1, 3, 5, 8, 10, 12, 15]) {
  return floors.map(f => {
    const row = simulateFloor(f, battles)
    const t = BALANCE_TARGETS[f]
    return { ...row, target: t ? `${(t.min * 100).toFixed(0)}%~${(t.max * 100).toFixed(0)}% ${t.label}` : '观察', pass: t ? row.winRate >= t.min && row.winRate <= t.max : true }
  })
}

// CLI 直跑：RUN_PVE_SIM=1 npx vite-node src/game/__sim__/pveBalance.ts
if (typeof process !== 'undefined' && process.env.RUN_PVE_SIM) {
  const report = runPveBalanceReport()
  console.log(JSON.stringify(report, null, 2))
}
