import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../game/store'
import { allyUnit, enemyUnit, allyAction, enemyAction, applyEventBuff, battleOrder, updateBossPhase } from '../game/engine'
import { enemiesOfFloor, COMBAT, ELITE, PVE_EVENTS, floorReward } from '../game/config'
import type { BattleUnit, HitKind } from '../game/types'

interface Floater { id: number; targetKey: string; text: string; cls: string }

const KIND_COLOR: Record<HitKind, string> = {
  '会意': '#e8c35a',   // 金
  '会心': '#d05a41',   // 朱砂
  '白字': '#efe8d5',
  '擦伤': '#8a8272',
}

/* ============================================================
   战斗演出样式（注入式 CSS：宣纸水墨基调，克制不刺眼）
   —— index.css 为公共文件，此处由战斗页自管
   ============================================================ */
const BATTLE_CSS = `
@keyframes stageShake {
  0%,100% { transform: translate(0,0); }
  20% { transform: translate(-4px, 2px); }
  40% { transform: translate(3px, -2px); }
  60% { transform: translate(-2px, 1px); }
  80% { transform: translate(2px, -1px); }
}
.fx-shake { animation: stageShake .45s ease-out; }
@keyframes exhaustTint {
  0% { opacity: 0; } 25% { opacity: .28; } 100% { opacity: 0; }
}
.fx-exhaust-overlay {
  position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 40%, rgba(166,58,43,0.55) 100%);
  animation: exhaustTint .8s ease-out forwards;
}
@keyframes skillFlash {
  0% { opacity: 0; } 12% { opacity: .7; } 100% { opacity: 0; }
}
.fx-skill-flash {
  position: fixed; inset: 0; pointer-events: none; z-index: 40;
  background: #f3eee0;
  animation: skillFlash .5s ease-out forwards;
}
@keyframes skillText {
  0% { opacity: 0; transform: scale(.72); letter-spacing: .1em; }
  18% { opacity: 1; transform: scale(1); }
  75% { opacity: 1; }
  100% { opacity: 0; transform: scale(1.05); letter-spacing: .5em; }
}
.fx-skill-text {
  position: fixed; inset: 0; pointer-events: none; z-index: 41;
  display: flex; align-items: center; justify-content: center;
  color: #a63a2b; text-shadow: 0 2px 18px rgba(166,58,43,.35);
  animation: skillText 1s ease-out forwards;
}
@keyframes unitDie {
  0% { opacity: 1; filter: none; transform: translateY(0); }
  100% { opacity: .18; filter: grayscale(.7) blur(1px); transform: translateY(6px); }
}
.unit-die { animation: unitDie .9s ease-out forwards; }
@keyframes actorPulse {
  0%,100% { box-shadow: 0 0 0 1px rgba(232,195,90,.85), 0 0 0 0 rgba(232,195,90,0); }
  50% { box-shadow: 0 0 0 1px rgba(232,195,90,.85), 0 0 14px 3px rgba(232,195,90,.3); }
}
.actor-active { animation: actorPulse 1.6s ease-in-out infinite; }
@keyframes roundTick {
  0% { opacity: 0; letter-spacing: .3em; } 30% { opacity: 1; } 100% { opacity: .55; letter-spacing: .1em; }
}
.round-tick { animation: roundTick .8s ease-out both; }
@keyframes panelRise {
  0% { opacity: 0; transform: translateY(14px); } 100% { opacity: 1; transform: none; }
}
.win-rise { animation: panelRise .5s ease-out both; }
@keyframes rewardPop {
  0% { opacity: 0; transform: scale(.6); }
  60% { opacity: 1; transform: scale(1.1); }
  100% { opacity: 1; transform: scale(1); }
}
.reward-pop { display: inline-block; animation: rewardPop .55s cubic-bezier(.22,1.4,.36,1) both; }
`

export default function Battle({ back }: { back: () => void }) {
  const { state, dispatch } = useStore()
  const floor = state.floor
  const buff = state.eventBuff && state.eventBuff.floor === floor ? state.eventBuff : null
  const buffDef = buff ? PVE_EVENTS.choices.find(c => c.id === buff.id) : null

  const [units, setUnits] = useState<BattleUnit[]>(() => {
    const allies = state.team.map((id, i) => allyUnit(state.heroes.find(h => h.heroId === id)!, i))
    const foes = enemiesOfFloor(floor).map((e, i) => enemyUnit(e, i))
    applyEventBuff(allies, foes, buff)
    return [...allies, ...foes]
  })
  const order = useMemo(
    () => battleOrder(units).map(u => u.key),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const [turnIdx, setTurnIdx] = useState(0)
  const [target, setTarget] = useState<string | null>(null)
  const [log, setLog] = useState<string[]>([`第 ${floor} 层 · 遭遇 ${units.filter(u => u.side === 'enemy').map(u => u.name).join('、')}`])
  const [floaters, setFloaters] = useState<Floater[]>([])
  const [phase, setPhase] = useState<'fight' | 'win' | 'lose'>('fight')
  const [rewarded, setRewarded] = useState(false)
  const [review, setReview] = useState({ hits: { '会意': 0, '会心': 0, '白字': 0, '擦伤': 0 } as Record<HitKind, number>, totalDmg: 0, expectedDmg: 0, rounds: 1 })
  // 演出状态
  const [exhaustFx, setExhaustFx] = useState(0)           // 气竭/困兽：震动+染色（计数器驱动重放）
  const [shaking, setShaking] = useState(false)
  const [skillFx, setSkillFx] = useState<{ id: number; name: string } | null>(null) // 绝技：闪白+大字幕
  const fid = useRef(0)
  const busy = useRef(false)

  // 震动演出：计数器变化时短暂挂上 fx-shake，动画结束摘除以便下次重放
  useEffect(() => {
    if (exhaustFx === 0) return
    setShaking(true)
    const t = setTimeout(() => setShaking(false), 480)
    return () => clearTimeout(t)
  }, [exhaustFx])

  const current = units.find(u => u.key === order[turnIdx % order.length])
  const allies = units.filter(u => u.side === 'ally')
  const enemies = units.filter(u => u.side === 'enemy')

  const pushLog = (s: string) => setLog(l => [...l.slice(-9), s])
  const pushFloater = (targetKey: string, text: string, cls: string) => {
    const id = ++fid.current
    setFloaters(f => [...f, { id, targetKey, text, cls }])
    setTimeout(() => setFloaters(f => f.filter(x => x.id !== id)), 950)
  }
  const triggerSkillFx = (name: string) => {
    const id = ++fid.current
    setSkillFx({ id, name })
    setTimeout(() => setSkillFx(fx => (fx?.id === id ? null : fx)), 1050)
  }
  const triggerExhaustFx = () => setExhaustFx(n => n + 1)

  const checkEnd = (us: BattleUnit[]): boolean => {
    if (us.filter(u => u.side === 'enemy').every(u => !u.alive)) { setPhase('win'); return true }
    if (us.filter(u => u.side === 'ally').every(u => !u.alive)) { setPhase('lose'); return true }
    return false
  }

  const advance = (us: BattleUnit[]) => {
    // 找下一个存活且未气竭的行动者
    for (let step = 1; step <= order.length * 3; step++) {
      const nextIdx = (turnIdx + step) % order.length
      const u = us.find(x => x.key === order[nextIdx])!
      if (!u.alive) continue
      if (u.exhaustTurns > 0) {
        u.exhaustTurns--
        if (u.exhaustTurns === 0) u.tough = u.maxTough
        pushLog(`${u.name} 气竭中，无法行动`)
        continue
      }
      if (nextIdx <= turnIdx) setReview(r => ({ ...r, rounds: r.rounds + 1 }))
      setTurnIdx(nextIdx)
      return
    }
  }

  /** Boss 阶段检测 + 演出（气血跌破50%入「困兽」） */
  const checkBossCornered = (us: BattleUnit[]) => {
    for (const e of us.filter(u => u.side === 'enemy')) {
      if (updateBossPhase(e)) {
        pushLog(`${e.name} 气血过半，陷入「困兽」——攻势更凶，破绽也更大了！`)
        setExhaustFx(n => n + 1) // 复用震动演出提示阶段切换
      }
    }
  }

  const doAllyAction = (useSkill: boolean) => {
    if (busy.current || !current || current.side !== 'ally' || phase !== 'fight') return
    const t = enemies.find(e => e.key === (target ?? enemies.find(e => e.alive)?.key))
    if (!t || !t.alive) return
    busy.current = true
    const { log: l, result } = allyAction(current, t, useSkill, allies)
    if (useSkill) triggerSkillFx(current.skillName)
    if (result) {
      pushFloater(t.key, `${l.dmg}`, KIND_COLOR[result.kind])
      pushLog(`${l.actor}【${l.action}】→ ${l.target}：${l.dmg}（${l.kind}）${l.exhausted ? ' · 击破气竭！' : ''}${l.reflect ? ` · 荆棘反弹 ${l.reflect}` : ''}`)
      if (l.exhausted) triggerExhaustFx()
      if (l.reflect) pushFloater(current.key, `-${l.reflect}`, '#c9b370')
      setReview(r => ({
        ...r,
        hits: { ...r.hits, [result.kind]: r.hits[result.kind] + 1 },
        totalDmg: r.totalDmg + result.dmg,
        expectedDmg: r.expectedDmg + result.expected,
      }))
    } else if (l.heal) {
      pushFloater(allies.find(a => a.name === l.target)!.key, `+${l.heal}`, '#7ba889')
      pushLog(`${l.actor}【${l.action}】→ ${l.target}：回复 ${l.heal}`)
    }
    const us = [...units]
    checkBossCornered(us)
    setUnits(us)
    if (!checkEnd(us)) advance(us)
    busy.current = false
  }

  // 敌方自动行动
  useEffect(() => {
    if (phase !== 'fight' || !current || current.side !== 'enemy') return
    const timer = setTimeout(() => {
      if (!current.alive || current.exhaustTurns > 0) { advance([...units]); return }
      const { log: l, result } = enemyAction(current, allies)
      if (result) {
        const t = allies.find(a => a.name === l.target)!
        pushFloater(t.key, `${l.dmg}`, '#b3a58a')
        pushLog(`${l.actor} → ${l.target}：${l.dmg}`)
      }
      const us = [...units]
      setUnits(us)
      if (!checkEnd(us)) advance(us)
    }, 750)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnIdx, phase])

  const claimReward = () => {
    if (!rewarded) { dispatch({ type: 'WIN_FLOOR' }); setRewarded(true) }
    back()
  }

  const unitCard = (u: BattleUnit) => {
    const isTarget = target === u.key
    const isCurrent = current?.key === u.key && phase === 'fight'
    const hpPct = (u.hp / u.maxHp) * 100
    const toughPct = u.maxTough ? (u.tough / u.maxTough) * 100 : 0
    return (
      <div key={u.key}
        onClick={() => u.side === 'enemy' && u.alive && phase === 'fight' && setTarget(u.key)}
        className={`relative p-3 border transition-all ${!u.alive ? 'unit-die' : ''} ${isCurrent && u.alive ? 'actor-active' : ''}`}
        style={{
          borderColor: isTarget ? '#e8c35a' : u.elite ? 'rgba(179,137,58,0.75)' : 'rgba(239,232,213,0.25)',
          opacity: u.alive ? 1 : undefined,
          cursor: u.side === 'enemy' ? 'pointer' : 'default',
          background: u.exhaustTurns > 0 ? 'rgba(166,58,43,0.18)' : u.elite ? 'rgba(179,137,58,0.07)' : 'transparent',
        }}>
        <div className="flex justify-between items-baseline gap-1">
          <span className="font-display truncate">{u.name}</span>
          <span className="flex gap-1 items-center shrink-0">
            {u.cornered && (
              <span className="text-[10px] px-1 font-display" style={{ background: '#8c2f22', color: '#f7f2e4', letterSpacing: '0.1em' }}>
                困兽
              </span>
            )}
            {u.affixes?.map(a => (
              <span key={a} className="text-[10px] px-1 font-display"
                style={{ background: 'var(--cinnabar)', color: '#f7f2e4', letterSpacing: '0.1em' }}
                title={ELITE.affixes[a].desc}>
                {ELITE.affixes[a].name}
              </span>
            ))}
            {u.exhaustTurns > 0 && <span className="text-xs" style={{ color: '#d05a41' }}>气竭!</span>}
          </span>
        </div>
        <div className="mt-2 h-2 bg-black/40">
          <div className="bar-fill h-full" style={{ width: `${hpPct}%`, background: hpPct > 40 ? '#7ba889' : '#d05a41' }} />
        </div>
        {u.maxTough > 0 && (
          <div className="mt-1 h-1 bg-black/40">
            <div className="bar-fill h-full" style={{ width: `${toughPct}%`, background: '#c9b370' }} />
          </div>
        )}
        {u.side === 'ally' && (
          <div className="mt-1 h-1 bg-black/40">
            <div className="bar-fill h-full" style={{ width: `${u.rage}%`, background: '#e8c35a' }} />
          </div>
        )}
        <div className="text-xs mt-1 tnum" style={{ color: 'rgba(239,232,213,0.6)' }}>
          {u.hp}/{u.maxHp}{u.side === 'ally' ? ` · 怒${u.rage}` : ''}
        </div>
        {/* 飘字层 */}
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 pointer-events-none">
          {floaters.filter(f => f.targetKey === u.key).map(f => (
            <div key={f.id} className="dmg-float font-bold text-xl tnum whitespace-nowrap"
              style={{ color: f.cls, textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
              {f.text}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (phase === 'win' || phase === 'lose') {
    const r = floorReward(floor)
    const totalHits = Object.values(review.hits).reduce((a, b) => a + b, 0)
    return (
      <div className="space-y-4">
        <style>{BATTLE_CSS}</style>
        <section className="paper-panel p-6 text-center win-rise">
          <div className="font-display text-3xl tracking-widest mb-2"
            style={{ color: phase === 'win' ? 'var(--cinnabar)' : 'var(--ink-faint)' }}>
            {phase === 'win' ? '胜 利' : '败 北'}
          </div>
          {phase === 'win' && (
            <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
              获得
              <span className="reward-pop mx-1 font-bold tnum" style={{ color: 'var(--gold)', animationDelay: '.15s' }}>玉璧×{r.jade}</span>
              <span className="reward-pop mx-1 font-bold tnum" style={{ color: 'var(--cinnabar)', animationDelay: '.35s' }}>经验丹×{r.expPills}</span>
            </p>
          )}
          {phase === 'win' && state.floor % PVE_EVENTS.triggerEvery === 0 && (
            <p className="text-xs mt-2 reward-pop" style={{ color: 'var(--ink-faint)', animationDelay: '.55s' }}>
              山道深处似有际遇……（回到江湖触发奇遇）
            </p>
          )}
        </section>

        {/* 战斗复盘：实测 vs 理论 */}
        <section className="paper-panel p-4 win-rise" style={{ animationDelay: '.15s' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display tracking-widest">战斗复盘</h3>
            <span className="seal">数据复盘</span>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm tnum">
            <span style={{ color: 'var(--ink-soft)' }}>回合数</span><span className="text-right">{review.rounds}</span>
            <span style={{ color: 'var(--ink-soft)' }}>我方总伤害（实测）</span><span className="text-right">{review.totalDmg}</span>
            <span style={{ color: 'var(--ink-soft)' }}>理论期望伤害</span><span className="text-right">{Math.round(review.expectedDmg)}</span>
            <span style={{ color: 'var(--ink-soft)' }}>实测/期望</span>
            <span className="text-right" style={{ color: 'var(--cinnabar)' }}>
              {review.expectedDmg ? ((review.totalDmg / review.expectedDmg - 1) * 100).toFixed(1) : '0.0'}%
            </span>
          </div>
          <div className="dashed-divider my-3" />
          <div className="text-xs mb-1" style={{ color: 'var(--ink-faint)' }}>三率判定分布（共 {totalHits} 次出手）</div>
          <div className="space-y-1">
            {(Object.keys(review.hits) as HitKind[]).map(k => (
              <div key={k} className="flex items-center gap-2 text-xs tnum">
                <span className="w-8 font-display">{k}</span>
                <div className="flex-1 h-3" style={{ background: 'rgba(33,29,22,0.08)' }}>
                  <div className="h-full bar-fill" style={{
                    width: totalHits ? `${(review.hits[k] / totalHits) * 100}%` : '0%',
                    background: KIND_COLOR[k], filter: k === '白字' || k === '擦伤' ? 'brightness(0.5)' : 'none',
                  }} />
                </div>
                <span className="w-12 text-right">{totalHits ? ((review.hits[k] / totalHits) * 100).toFixed(0) : 0}%</span>
              </div>
            ))}
          </div>
        </section>

        <button onClick={claimReward} className="btn-cinnabar w-full py-3 font-display tracking-[0.4em]">
          {phase === 'win' ? '领取奖励 · 继续闯荡' : '重整旗鼓'}
        </button>
      </div>
    )
  }

  return (
    <div className={`battle-stage relative -mx-4 px-4 py-4 space-y-4 ${shaking ? 'fx-shake' : ''}`}>
      <style>{BATTLE_CSS}</style>

      {/* 气竭染色 overlay（key 重放动画） */}
      {exhaustFx > 0 && <div key={exhaustFx} className="fx-exhaust-overlay" />}

      {/* 绝技演出：全屏闪白 + 大字幕 */}
      {skillFx && (
        <>
          <div key={`flash-${skillFx.id}`} className="fx-skill-flash" />
          <div key={`text-${skillFx.id}`} className="fx-skill-text">
            <span className="font-display text-5xl tracking-[0.3em]">{skillFx.name}</span>
          </div>
        </>
      )}

      {/* 奇遇 buff 提示 */}
      {buffDef && (
        <div className="text-center text-xs" style={{ color: '#c9b370' }}>
          奇遇「{buffDef.name}」生效中 · {buffDef.desc}
        </div>
      )}

      {/* 敌方 */}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${enemies.length}, 1fr)` }}>
        {enemies.map(unitCard)}
      </div>

      <div className="text-center text-xs" style={{ color: 'rgba(239,232,213,0.4)' }}>
        <span key={review.rounds} className="round-tick inline-block">—— 第 {review.rounds} 回合 ——</span>
      </div>

      {/* 我方 */}
      <div className="grid grid-cols-3 gap-2">
        {allies.map(unitCard)}
      </div>

      {/* 操作区 */}
      {current?.side === 'ally' && phase === 'fight' && (
        <div className="flex gap-2">
          <div className="flex-1 text-sm self-center font-display" style={{ color: '#e8c35a' }}>
            {current.name} 的回合{target ? '' : ' · 点击敌人选择目标'}
          </div>
          <button onClick={() => doAllyAction(false)} className="btn-ink px-4 py-2"
            style={{ borderColor: '#efe8d5', color: '#efe8d5' }}>普攻</button>
          <button onClick={() => doAllyAction(true)} disabled={current.rage < COMBAT.rageMax}
            className="btn-cinnabar px-4 py-2" style={{ borderColor: '#d05a41', background: '#8c2f22' }}>
            {current.skillName}
          </button>
        </div>
      )}

      {/* 战斗日志 */}
      <div className="text-xs space-y-0.5 font-mono" style={{ color: 'rgba(239,232,213,0.55)' }}>
        {log.map((l, i) => <div key={i}>{l}</div>)}
      </div>

      <button onClick={back} className="text-xs underline" style={{ color: 'rgba(239,232,213,0.4)' }}>
        撤退（无奖励）
      </button>
    </div>
  )
}
