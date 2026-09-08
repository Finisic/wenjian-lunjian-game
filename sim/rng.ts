/**
 * 可复现随机源：引擎用 Math.random，harness 在每组实验前替换为 mulberry32(seed)，
 * 实验结束恢复原实现。同一 seed 重跑必然得到逐字节一致的结果。
 */

/** mulberry32 —— 32 位小状态 PRNG，周期 2^32，质量足够做蒙特卡洛胜率估计 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 用指定 seed 的 mulberry32 替换 Math.random 执行 fn，结束后恢复 */
export function withSeed<T>(seed: number, fn: () => T): T {
  const orig = Math.random
  Math.random = mulberry32(seed)
  try {
    return fn()
  } finally {
    Math.random = orig
  }
}
