/**
 * 实验统计：胜率点估计 + 95% 置信区间（±1.96√(p(1-p)/n)），实验结果 JSON 落盘。
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export interface WinStats {
  wins: number
  losses: number
  matches: number
  winrate: number
  /** 95% CI 半宽 */
  eps: number
  lo: number
  hi: number
}

export function winStats(wins: number, matches: number): WinStats {
  const p = matches > 0 ? wins / matches : 0
  const eps = matches > 0 ? 1.96 * Math.sqrt((p * (1 - p)) / matches) : 0
  return {
    wins,
    losses: matches - wins,
    matches,
    winrate: round4(p),
    eps: round4(eps),
    lo: round4(Math.max(0, p - eps)),
    hi: round4(Math.min(1, p + eps)),
  }
}

export function round4(x: number): number {
  return Math.round(x * 10000) / 10000
}

/** 单次实验的完整记录（写入 sim/results/） */
export interface ExperimentResult {
  experiment: string
  seed: number
  matches: number
  sideA: string
  sideB: string
  /** A 方胜率统计（左右互换对半开，消除先手/座位偏差） */
  a: WinStats
  /** 大局均击杀（双方合计） */
  avgKillsPerDazhe: number
  /** 场均大局数 */
  avgDazhes: number
  /** 平轮率（双空城/完全持平的大局占比） */
  drawDazheRate: number
  /** 实验时生效的规则参数快照（被扫描的项） */
  rules?: Record<string, number>
  note?: string
}

// 注意：esbuild 打包后 import.meta.dirname 会变成 sim/dist，因此以 cwd（仓库根目录）为基准
const RESULTS_DIR = path.resolve(process.cwd(), 'sim', 'results')

export function saveResult(file: string, r: unknown): void {
  mkdirSync(RESULTS_DIR, { recursive: true })
  writeFileSync(path.join(RESULTS_DIR, file), JSON.stringify(r, null, 2) + '\n')
}

export function fmtLine(r: ExperimentResult): string {
  return `${r.experiment.padEnd(44)} ${r.sideA} ${pct(r.a.winrate)}±${pct(r.a.eps)}  kills/dazhe=${r.avgKillsPerDazhe}  n=${r.matches}`
}

export function pct(x: number): string {
  return (x * 100).toFixed(1) + '%'
}
