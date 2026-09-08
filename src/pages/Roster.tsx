import { useState } from 'react'
import { useStore } from '../game/store'
import { heroDef, grownStats, effectiveRates, expectedDamage } from '../game/engine'
import { expNeed, LEVEL_CAP, COMBAT } from '../game/config'
import type { HeroDef, OwnedHero } from '../game/types'
import { SealStamp } from '../components/seal'

export default function Roster() {
  const { state, dispatch } = useStore()
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg tracking-widest flex items-center gap-2">
          侠客谱 <SealStamp text="侠" />
        </h2>
        <span className="text-sm tnum" style={{ color: 'var(--ink-soft)' }}>经验丹 ×{state.expPills}</span>
      </div>

      {state.heroes.map(o => {
        const d = heroDef(o.heroId)
        const s = grownStats(o)
        const rates = effectiveRates(s)
        const open = openId === o.heroId
        return (
          <section key={o.heroId} className="paper-panel p-4">
            <button type="button" className="w-full flex items-center justify-between cursor-pointer min-h-[44px]"
              onClick={() => setOpenId(open ? null : o.heroId)}
              aria-expanded={open}>
              <div className="text-left">
                <span className="font-display text-lg">{d.name}</span>
                <span className="text-xs ml-2" style={{ color: 'var(--ink-faint)' }}>
                  {d.title} · {d.school} · Lv.{o.level} · {o.star}星
                </span>
              </div>
              <span style={{ color: d.rarity === 5 ? 'var(--gold)' : d.rarity === 4 ? 'var(--cinnabar)' : 'var(--ink-faint)' }}>
                {'★'.repeat(d.rarity)}
              </span>
            </button>

            {open && (
              <div className="mt-3 rise-in">
                <p className="text-xs mb-3" style={{ color: 'var(--ink-soft)' }}>{d.desc}</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm tnum">
                  <span style={{ color: 'var(--ink-soft)' }}>气血</span><span className="text-right">{s.hp}</span>
                  <span style={{ color: 'var(--ink-soft)' }}>攻击</span><span className="text-right">{s.atkMin} ~ {s.atkMax}</span>
                  <span style={{ color: 'var(--ink-soft)' }}>防御 / 速度</span><span className="text-right">{s.def} / {s.spd}</span>
                  <span style={{ color: 'var(--ink-soft)' }}>精准 / 会心 / 会意</span>
                  <span className="text-right">
                    {(s.prec * 100).toFixed(0)}% / {(s.crit * 100).toFixed(0)}% / {(s.insight * 100).toFixed(0)}%
                  </span>
                  {rates.overflow > 0 && (
                    <>
                      <span style={{ color: 'var(--cinnabar)' }}>三率溢出转化</span>
                      <span className="text-right" style={{ color: 'var(--cinnabar)' }}>
                        会心伤害 +{(rates.overflow * COMBAT.overflowConvert * 100).toFixed(0)}%
                      </span>
                    </>
                  )}
                  <span style={{ color: 'var(--ink-soft)' }}>绝技</span>
                  <span className="text-right">{d.skill.name}（{d.skill.desc}）</span>
                </div>

                <DamageCalc o={o} d={d} />

                <div className="dashed-divider my-3" />
                <div className="flex items-center justify-between">
                  <span className="text-xs tnum" style={{ color: 'var(--ink-faint)' }}>
                    {o.level >= LEVEL_CAP ? '已满级' : `升级还需 ${expNeed(o.level) - o.exp} 经验`}
                  </span>
                  <button onClick={() => dispatch({ type: 'LEVEL_UP', heroId: o.heroId })}
                    disabled={o.level >= LEVEL_CAP || state.expPills === 0}
                    className="btn-cinnabar px-4 py-1.5 text-sm">
                    服用经验丹
                  </button>
                </div>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

/* ============================================================
   期望伤害试算：调引擎 expectedDamage 的解析解，
   拖动目标防御实时重算——展示判定树四个分支的概率与期望构成。
   ============================================================ */
function DamageCalc({ o, d }: { o: OwnedHero; d: HeroDef }) {
  const [def, setDef] = useState(80)
  const s = grownStats(o)
  const r = effectiveRates(s)

  const eAtk = expectedDamage(s, 1, def, false)
  const eAtkExhaust = expectedDamage(s, 1, def, true)
  const isHeal = !!d.skill.heal
  const eSkill = isHeal ? 0 : expectedDamage(s, d.skill.mult, def, false)
  const healAmt = isHeal ? Math.round(s.hp * (d.skill.heal ?? 0)) : 0

  // 判定树四分支概率（与引擎判定顺序一致：会意 → 擦伤 → 会心 → 白字）
  const pIns = r.insight
  const pGraze = (1 - r.insight) * (1 - r.prec)
  const pCrit = (1 - r.insight) * r.prec * r.crit
  const pHit = (1 - r.insight) * r.prec * (1 - r.crit)

  const maxE = Math.max(eAtk, eSkill, 1)
  const Row = ({ label, value, note }: { label: string; value: number; note?: string }) => (
    <div className="flex items-center gap-2 text-xs tnum">
      <span className="w-24 shrink-0" style={{ color: 'var(--ink-soft)' }}>{label}</span>
      <div className="flex-1 h-2.5" style={{ background: 'rgba(33,29,22,0.08)' }}>
        <div className="h-full bar-fill" style={{ width: `${(value / maxE) * 100}%`, background: 'var(--ink)' }} />
      </div>
      <span className="w-14 text-right font-bold" style={{ color: 'var(--cinnabar)' }}>{Math.round(value)}</span>
      {note && <span className="w-16 text-right" style={{ color: 'var(--ink-faint)' }}>{note}</span>}
    </div>
  )

  return (
    <div className="mt-3 px-3 py-2.5" style={{ background: 'rgba(179,137,58,0.05)', border: '1px dashed rgba(179,137,58,0.45)' }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="font-display text-sm tracking-widest" style={{ color: 'var(--gold)' }}>期望伤害试算</span>
        <SealStamp text="算" gold />
        <span className="text-xs ml-auto" style={{ color: 'var(--ink-faint)' }}>解析解 · 非模拟</span>
      </div>

      <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--ink-soft)' }}>
        <span className="shrink-0">目标防御</span>
        <input
          type="range" min={0} max={300} step={5} value={def}
          onChange={e => setDef(Number(e.target.value))}
          className="slider-ink flex-1"
          aria-label="目标防御"
        />
        <span className="tnum font-bold w-10 text-right" style={{ color: 'var(--ink)' }}>{def}</span>
      </label>

      <div className="space-y-1.5 mt-1">
        <Row label="普攻期望" value={eAtk} />
        {isHeal
          ? <Row label={`绝技·治疗`} value={healAmt} note="按气血上限" />
          : <Row label={`绝技·${d.skill.name}`} value={eSkill} note={`×${d.skill.mult}`} />}
        <Row label="气竭窗口普攻" value={eAtkExhaust} note={`+${COMBAT.exhaustDmgBonus * 100}%`} />
      </div>

      {/* 判定树分支概率 */}
      <div className="mt-2 pt-2 dashed-divider">
        <div className="flex h-2 overflow-hidden rounded-sm" title="判定树分支概率">
          <div style={{ width: `${pIns * 100}%`, background: 'var(--gold)' }} />
          <div style={{ width: `${pCrit * 100}%`, background: 'var(--cinnabar)' }} />
          <div style={{ width: `${pHit * 100}%`, background: 'var(--ink)' }} />
          <div style={{ width: `${pGraze * 100}%`, background: 'var(--ink-faint)' }} />
        </div>
        <div className="flex justify-between text-xs tnum mt-1" style={{ color: 'var(--ink-faint)' }}>
          <span style={{ color: 'var(--gold)' }}>会意 {(pIns * 100).toFixed(0)}%</span>
          <span style={{ color: 'var(--cinnabar)' }}>会心 {(pCrit * 100).toFixed(0)}%</span>
          <span>白字 {(pHit * 100).toFixed(0)}%</span>
          <span>擦伤 {(pGraze * 100).toFixed(0)}%</span>
        </div>
        {r.overflow > 0 && (
          <div className="text-xs tnum mt-1" style={{ color: 'var(--cinnabar)' }}>
            会心+会意溢出 {(r.overflow * 100).toFixed(0)}% → 会心伤害 +{(r.overflow * COMBAT.overflowConvert * 100).toFixed(0)}%（平滑转化，无断点浪费）
          </div>
        )}
      </div>
    </div>
  )
}
