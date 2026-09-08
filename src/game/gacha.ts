// ============================================================
// 抽卡系统 —— 软保底递增 + 硬保底封顶 + 10抽小保底
// 附：蒙特卡洛模拟器（向玩家公示期望成本，游戏内实机运行）
// ============================================================
import { GACHA, prob5, poolByRarity } from './config'
import type { HeroDef } from './types'

export interface PullResult {
  hero: HeroDef
  rarity: 3 | 4 | 5
  isNew5: boolean
}

/** 单抽：依据保底计数返回抽到的侠客与新的保底计数 */
export function pull(pullsSince5: number, pullsSince4: number): {
  hero: HeroDef; rarity: 3 | 4 | 5; newP5: number; newP4: number
} {
  const p5 = prob5(pullsSince5)
  const roll = Math.random()
  if (roll < p5) {
    const pool = poolByRarity(5)
    return { hero: pool[Math.floor(Math.random() * pool.length)], rarity: 5, newP5: 0, newP4: 0 }
  }
  // 4★：基础概率 + 10抽小保底
  const guaranteed4 = pullsSince4 + 1 >= GACHA.pity4
  if (guaranteed4 || roll < p5 + GACHA.base4) {
    const pool = poolByRarity(4)
    return { hero: pool[Math.floor(Math.random() * pool.length)], rarity: 4, newP5: pullsSince5 + 1, newP4: 0 }
  }
  const pool = poolByRarity(3)
  return { hero: pool[Math.floor(Math.random() * pool.length)], rarity: 3, newP5: pullsSince5 + 1, newP4: pullsSince4 + 1 }
}

// ---------- 蒙特卡洛模拟器 ----------
// 模拟 nPlayers 名玩家各自抽到1个5★所需的抽数，输出分布统计
export interface SimResult {
  mean: number
  p50: number
  p90: number
  p99: number
  histogram: { label: string; count: number }[]
  players: number
}

export function simulateFiveStar(nPlayers = 50000): SimResult {
  const draws = new Float32Array(nPlayers)
  for (let i = 0; i < nPlayers; i++) {
    let n = 0
    while (true) {
      n++
      if (Math.random() < prob5(n - 1)) break
    }
    draws[i] = n
  }
  const sorted = Array.from(draws).sort((a, b) => a - b)
  const pct = (q: number) => sorted[Math.floor(q * nPlayers)]
  // 直方图：每10抽一个桶
  const bins = new Array(9).fill(0)
  for (const d of sorted) bins[Math.min(8, Math.floor((d - 1) / 10))]++
  return {
    mean: sorted.reduce((a, b) => a + b, 0) / nPlayers,
    p50: pct(0.5), p90: pct(0.9), p99: pct(0.99),
    histogram: bins.map((count, i) => ({ label: `${i * 10 + 1}-${i * 10 + 10}抽`, count })),
    players: nPlayers,
  }
}

/** 理论公示：综合概率（含保底的长期5★出率），由模拟均值倒数近似 */
export function consolidatedRate(): string {
  // 经验值：该保底结构下长期综合出率约1.97%，以模拟器实测为准
  const sim = simulateFiveStar(20000)
  return (1 / sim.mean * 100).toFixed(2)
}
