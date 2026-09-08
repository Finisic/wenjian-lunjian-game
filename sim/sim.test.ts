/**
 * 模拟器冒烟测试（npx vitest run sim/）：
 * 小规模验证 harness 链路、随机性可复现、锚点方向正确、升星合成可用。
 * 完整实验（5000/20000 局）走 `npm run sim`，见 sim/README.md。
 */
import { describe, it, expect } from 'vitest'
import { runExperiment, playMatch } from './harness'
import { steadyFocus, idleSaver, bankThrift, readSwap, swapDodge, planSynthesize } from './bots'
import { withSeed } from './rng'

describe('蒙特卡洛模拟器冒烟', () => {
  it('镜像稳打无偏（小样本落在 40%~60%）', () => {
    const r = runExperiment('test/mirror', steadyFocus({ name: 'A' }), steadyFocus({ name: 'B' }), { matches: 400, seed: 42 })
    expect(r.a.winrate).toBeGreaterThan(0.4)
    expect(r.a.winrate).toBeLessThan(0.6)
    expect(r.avgKillsPerDazhe).toBeGreaterThan(0.5)
  })

  it('随机性可复现：同 seed 两次结果逐字节一致', () => {
    const r1 = runExperiment('test/repro', idleSaver(), steadyFocus(), { matches: 100, seed: 7 })
    const r2 = runExperiment('test/repro', idleSaver(), steadyFocus(), { matches: 100, seed: 7 })
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2))
  })

  it('读换位克制换位闪避（博弈链方向正确）', () => {
    const r = runExperiment('test/chain', readSwap(), swapDodge(), { matches: 300, seed: 11 })
    expect(r.a.winrate).toBeGreaterThan(0.6)
  })

  it('升星合成：摸到对子可合法合成 2★，且不破坏对局收敛', () => {
    const r = runExperiment('test/star', steadyFocus({ name: 'S2', synthesize: planSynthesize('甲') }), steadyFocus({ name: 'S1' }), { matches: 200, seed: 13 })
    expect(r.a.winrate).toBeGreaterThan(0.3)
    expect(r.a.winrate).toBeLessThan(0.7)
  })

  it('银行节流在默认参数下接近平衡带（任务2 方向）', () => {
    const r = runExperiment('test/thrift', bankThrift(), steadyFocus(), { matches: 400, seed: 17 })
    expect(r.a.winrate).toBeGreaterThan(0.38)
    expect(r.a.winrate).toBeLessThan(0.62)
  })

  it('同一实验种子内 playMatch 可完整跑完（无死锁）', () => {
    withSeed(99, () => {
      for (let i = 0; i < 50; i++) {
        const r = playMatch(steadyFocus(), idleSaver())
        expect(r.winner === 0 || r.winner === 1).toBe(true)
        expect(r.dazhes).toBeGreaterThanOrEqual(3)
      }
    })
  })
})
