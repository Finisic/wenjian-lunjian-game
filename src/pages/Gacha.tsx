import { useMemo, useState } from 'react'
import { useStore } from '../game/store'
import { pull, simulateFiveStar, consolidatedRate } from '../game/gacha'
import type { SimResult } from '../game/gacha'
import { GACHA, prob5 } from '../game/config'
import type { HeroDef } from '../game/types'
import { Sparkles } from 'lucide-react'
import { SealStamp } from '../components/seal'

interface Pulled { hero: HeroDef; rarity: 3 | 4 | 5 }

export default function Gacha() {
  const { state, dispatch } = useStore()
  const [results, setResults] = useState<Pulled[]>([])
  const [showRules, setShowRules] = useState(false)
  const [sim, setSim] = useState<SimResult | null>(null)
  const [simming, setSimming] = useState(false)
  const [pullSeq, setPullSeq] = useState(0)   // 抽卡批次号：驱动出货动画重播

  const doPulls = (n: number) => {
    if (state.jade < GACHA.costPerPull * n) return
    let p5 = state.pullsSince5
    let p4 = state.pullsSince4
    const out: Pulled[] = []
    for (let i = 0; i < n; i++) {
      const r = pull(p5, p4)
      out.push({ hero: r.hero, rarity: r.rarity })
      p5 = r.newP5
      p4 = r.newP4
      dispatch({ type: 'PULL_DONE', heroId: r.hero.id, newP5: r.newP5, newP4: r.newP4, rarity: r.rarity })
    }
    setResults(out)
    setPullSeq(s => s + 1)
  }

  const runSim = () => {
    setSimming(true)
    // 让出一帧渲染loading，再跑5万次模拟
    setTimeout(() => { setSim(simulateFiveStar(50000)); setSimming(false) }, 30)
  }

  const nextPity = GACHA.hardPity - state.pullsSince5
  const curP5 = prob5(state.pullsSince5)
  const canPull1 = state.jade >= GACHA.costPerPull
  const canPull10 = state.jade >= GACHA.costPerPull * 10
  // 综合概率（含保底的长期出率）：仅在展开公示时惰性计算（内部跑 2 万人模拟）
  const consolidated = useMemo(() => (showRules ? consolidatedRate() : null), [showRules])

  return (
    <div className="space-y-5">
      {/* 卡池 */}
      <section className="paper-panel p-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-lg tracking-widest flex items-center gap-2">
            <Sparkles size={17} style={{ color: 'var(--gold)' }} />寻侠 · 常驻池 <SealStamp text="池" gold />
          </h2>
          <button onClick={() => setShowRules(!showRules)} className="text-xs underline px-2 py-2 min-h-[44px]"
            style={{ color: 'var(--ink-faint)' }}>概率公示</button>
        </div>
        <p className="text-xs mb-3" style={{ color: 'var(--ink-faint)' }}>
          UP侠客：沈孤鸿（5★剑）· 苏挽月（5★扇）
        </p>

        {/* 保底计数器：预期管理 UI */}
        <div className="flex justify-between text-sm tnum mb-3 p-2" style={{ background: 'rgba(166,58,43,0.06)' }}>
          <span>距 5★ 保底还有 <b style={{ color: 'var(--cinnabar)' }}>{nextPity}</b> 抽</span>
          <span>当前5★概率 {(curP5 * 100).toFixed(1)}%</span>
        </div>

        <div className="flex gap-2">
          <button onClick={() => doPulls(1)} disabled={!canPull1} className="btn-ink flex-1 py-3">
            <span className="flex flex-col items-center">
              <span>寻侠一次</span>
              <span className="text-xs tnum font-normal">{GACHA.costPerPull} 玉璧</span>
            </span>
          </button>
          <button onClick={() => doPulls(10)} disabled={!canPull10} className="btn-cinnabar flex-1 py-3">
            <span className="flex flex-col items-center">
              <span>寻侠十次</span>
              <span className="text-xs tnum font-normal">{GACHA.costPerPull * 10} 玉璧</span>
            </span>
          </button>
        </div>
      </section>

      {/* 抽取结果 */}
      {results.length > 0 && (
        <section className="paper-panel p-4">
          <div className="grid grid-cols-5 gap-2">
            {results.map((r, i) => (
              <div key={`${pullSeq}-${i}`} className={`pull-in border p-2 text-center ${r.rarity === 5 ? 'pull-5' : ''}`}
                style={{
                  borderColor: r.rarity >= 4 ? 'var(--gold)' : 'rgba(33,29,22,0.25)',
                  animationDelay: `${i * 0.07}s`,
                }}>
                <div className="font-display text-sm">{r.hero.name}</div>
                <div className="text-xs mt-1" style={{
                  color: r.rarity === 5 ? 'var(--gold)' : r.rarity === 4 ? 'var(--cinnabar)' : 'var(--ink-faint)',
                }}>{'★'.repeat(r.rarity)}</div>
              </div>
            ))}
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--ink-faint)' }}>重复侠客自动转化为升星（全属性+8%/星，独立乘区）</p>
        </section>
      )}

      {/* 概率公示 */}
      {showRules && (
        <section className="paper-panel p-4 rise-in">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-display tracking-widest">概率公示</h3>
            <SealStamp text="示" />
            <span className="text-xs ml-auto tnum" style={{ color: 'var(--ink-faint)' }}>依法公示 · 实时有效</span>
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--ink-faint)' }}>
            本页所有数值直接读自配表 <span className="tnum">GACHA</span>，与线上抽取逻辑同源。
          </p>

          <table className="w-full text-xs tnum">
            <thead>
              <tr className="border-b text-left" style={{ borderColor: 'var(--ink)', color: 'var(--ink-faint)' }}>
                <th className="py-1.5 font-normal">名目</th>
                <th className="py-1.5 font-normal text-right">数值</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['5★ 基础概率', `${(GACHA.base5 * 100).toFixed(1)}%`],
                ['4★ 基础概率', `${(GACHA.base4 * 100).toFixed(1)}%`],
                ['软保底', `第 ${GACHA.softPityStart} 抽起，每抽 +${(GACHA.softPityStep * 100).toFixed(0)}%`],
                ['硬保底', `第 ${GACHA.hardPity} 抽必得 5★`],
                ['4★ 保底', `每 ${GACHA.pity4} 抽必得 4★ 及以上`],
              ].map(([k, v]) => (
                <tr key={k} className="border-b" style={{ borderColor: 'rgba(33,29,22,0.12)' }}>
                  <td className="py-1.5" style={{ color: 'var(--ink-soft)' }}>{k}</td>
                  <td className="py-1.5 text-right font-bold">{v}</td>
                </tr>
              ))}
              <tr>
                <td className="py-1.5" style={{ color: 'var(--cinnabar)' }}>5★ 综合概率（含保底）</td>
                <td className="py-1.5 text-right font-bold" style={{ color: 'var(--cinnabar)' }}>
                  {consolidated ? `${consolidated}%` : '…'}
                </td>
              </tr>
            </tbody>
          </table>

          {/* 软保底爬坡可视化：第 74 抽起概率逐抽抬升，朱砂渐深 */}
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--ink-faint)' }}>
              <span>5★ 单抽概率爬坡</span>
              <span className="tnum">当前第 {state.pullsSince5 + 1} 抽 · {(curP5 * 100).toFixed(1)}%</span>
            </div>
            <div className="flex items-end gap-px h-8">
              {Array.from({ length: GACHA.hardPity }, (_, i) => {
                const p = prob5(i)
                const isNow = i === state.pullsSince5
                const ramp = i + 1 >= GACHA.softPityStart
                return (
                  <div
                    key={i}
                    title={`第 ${i + 1} 抽：${(p * 100).toFixed(1)}%`}
                    className="flex-1"
                    style={{
                      height: `${Math.max(12, Math.min(100, p * 100))}%`,
                      background: isNow
                        ? 'var(--gold)'
                        : ramp
                          ? `rgba(166, 58, 43, ${0.25 + 0.7 * ((i + 1 - GACHA.softPityStart) / (GACHA.hardPity - GACHA.softPityStart + 1))})`
                          : 'rgba(33,29,22,0.18)',
                      outline: isNow ? '1px solid var(--gold)' : 'none',
                    }}
                  />
                )
              })}
            </div>
            <div className="flex justify-between text-xs tnum mt-0.5" style={{ color: 'var(--ink-faint)' }}>
              <span>1</span>
              <span style={{ color: 'var(--cinnabar)' }}>软保底 {GACHA.softPityStart}</span>
              <span>{GACHA.hardPity} 必得</span>
            </div>
          </div>
        </section>
      )}

      <div className="huiwen-divider" aria-hidden="true" />
      {/* 保底成本模拟器 */}
      <section className="paper-panel p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display tracking-widest flex items-center gap-2">
            保底成本模拟器 <SealStamp text="算" />
          </h3>
          <span className="seal">概率模拟</span>
        </div>
        <p className="text-xs mb-3" style={{ color: 'var(--ink-soft)' }}>
          模拟 5 万名玩家抽到 5★ 的抽数分布，预估自己拿到 5★ 的成本区间。
        </p>
        <button onClick={runSim} disabled={simming} className="btn-ink w-full py-2 mb-3">
          {simming ? '模拟中…' : '运行 50,000 次模拟'}
        </button>
        {sim && (
          <div className="text-sm">
            <div className="grid grid-cols-4 gap-2 text-center tnum mb-3">
              {[['期望', sim.mean.toFixed(1)], ['中位数', sim.p50], ['P90', sim.p90], ['P99', sim.p99]].map(([k, v]) => (
                <div key={k} className="border p-2" style={{ borderColor: 'rgba(33,29,22,0.25)' }}>
                  <div className="text-xs" style={{ color: 'var(--ink-faint)' }}>{k}</div>
                  <div className="font-bold" style={{ color: 'var(--cinnabar)' }}>{v}</div>
                </div>
              ))}
            </div>
            <div className="space-y-1">
              {sim.histogram.map(h => {
                const max = Math.max(...sim.histogram.map(x => x.count))
                return (
                  <div key={h.label} className="flex items-center gap-2 text-xs tnum">
                    <span className="w-16">{h.label}</span>
                    <div className="flex-1 h-3" style={{ background: 'rgba(33,29,22,0.08)' }}>
                      <div className="h-full" style={{ width: `${(h.count / max) * 100}%`, background: 'var(--ink)' }} />
                    </div>
                    <span className="w-10 text-right">{((h.count / sim.players) * 100).toFixed(1)}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
