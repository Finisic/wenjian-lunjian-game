import { BarChart3, Sparkles, Swords, Users } from 'lucide-react'
import { useStore } from '../game/store'
import { heroDef, grownStats } from '../game/engine'
import { BOSS_MECHANICS, ELITE, PVE_EVENTS, TOWER_CURVE, enemiesOfFloor } from '../game/config'

export default function Home({ goBattle }: { goBattle: () => void }) {
  const { state, dispatch } = useStore()
  const enemies = enemiesOfFloor(state.floor)
  const isBossFloor = state.floor % 5 === 0
  const isGrandBoss = isBossFloor && state.floor % BOSS_MECHANICS.guardEvery === 0
  const activeBuff = state.eventBuff && state.eventBuff.floor === state.floor
    ? PVE_EVENTS.choices.find(c => c.id === state.eventBuff!.id)
    : null

  const toggleTeam = (heroId: string) => {
    if (state.team.includes(heroId)) {
      if (state.team.length > 1) dispatch({ type: 'SET_TEAM', team: state.team.filter(id => id !== heroId) })
    } else if (state.team.length < 3) {
      dispatch({ type: 'SET_TEAM', team: [...state.team, heroId] })
    }
  }

  // 奇遇三选一（每通关3层触发，先抉择再出战）
  if (state.pendingEvent) {
    return (
      <div className="space-y-4">
        <section className="paper-panel p-5" style={{ background: 'rgba(166,58,43,0.05)' }}>
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-display text-lg tracking-widest flex items-center gap-2">
              <Sparkles size={17} style={{ color: 'var(--gold)' }} />奇遇
            </h2>
            <span className="seal">三选一</span>
          </div>
          <p className="text-xs mb-4" style={{ color: 'var(--ink-faint)' }}>
            连闯 {PVE_EVENTS.triggerEvery} 层，山道岔口忽现际遇。抉择仅对本层（第 {state.floor} 层）生效。
          </p>
          <div className="space-y-2">
            {PVE_EVENTS.choices.map(c => (
              <button key={c.id}
                onClick={() => dispatch({ type: 'EVENT_PICK', eventId: c.id })}
                className="w-full text-left p-3 border transition-all hover:bg-black/5"
                style={{ borderColor: 'rgba(33,29,22,0.35)' }}>
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-base">{c.name}</span>
                  <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>{c.flavor}</span>
                </div>
                <div className="text-sm mt-1" style={{ color: 'var(--ink-soft)' }}>{c.desc}</div>
              </button>
            ))}
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="mtn-silhouette" aria-hidden="true" />
      {/* 出战阵容 */}
      <section className="paper-panel p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg tracking-widest flex items-center gap-2">
            <Users size={17} style={{ color: 'var(--ink-soft)' }} />出战阵容
          </h2>
          <span className="seal">至多三人</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {state.heroes.map(o => {
            const d = heroDef(o.heroId)
            const inTeam = state.team.includes(o.heroId)
            return (
              <button key={o.heroId} onClick={() => toggleTeam(o.heroId)}
                className="text-left p-2 border transition-all"
                style={{
                  borderColor: inTeam ? 'var(--cinnabar)' : 'rgba(33,29,22,0.3)',
                  background: inTeam ? 'rgba(166,58,43,0.07)' : 'transparent',
                }}>
                <div className="font-display">{d.name}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--ink-faint)' }}>
                  {d.rarity}★{d.school} · Lv.{o.level}{o.star > 1 ? ` · ${o.star}星` : ''}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <div className="huiwen-divider" aria-hidden="true" />
      {/* 挑战关卡 */}
      <section className="paper-panel p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg tracking-widest flex items-center gap-2">
            <Swords size={17} style={{ color: 'var(--cinnabar)' }} />侠客行 · 第 {state.floor} 层
          </h2>
          <div className="space-x-1">
            {isGrandBoss && <span className="seal">大关底</span>}
            {isBossFloor && !isGrandBoss && <span className="seal">首领</span>}
          </div>
        </div>
        {activeBuff && (
          <div className="text-xs mb-3 px-2 py-1.5 border" style={{ borderColor: 'var(--cinnabar)', color: 'var(--cinnabar)' }}>
            奇遇生效中：「{activeBuff.name}」 {activeBuff.desc}
          </div>
        )}
        <div className="text-sm mb-1" style={{ color: 'var(--ink-soft)' }}>守关敌人</div>
        <div className="flex gap-2 flex-wrap mb-3">
          {enemies.map((e, i) => (
            <span key={i} className="text-xs px-2 py-1 border tnum"
              style={{
                borderColor: e.elite ? 'var(--gold)' : 'rgba(33,29,22,0.3)',
                background: e.elite ? 'rgba(179,137,58,0.08)' : 'transparent',
              }}>
              {e.name} · 气血{e.hp} · 韧性{e.tough}
              {e.affixes?.map(a => (
                <span key={a} className="ml-1 px-1" style={{ background: 'var(--cinnabar)', color: '#f7f2e4' }}
                  title={ELITE.affixes[a].desc}>
                  {ELITE.affixes[a].name}
                </span>
              ))}
            </span>
          ))}
        </div>
        {(isBossFloor || enemies.some(e => e.elite)) && (
          <div className="text-xs mb-3 space-y-0.5" style={{ color: 'var(--ink-faint)' }}>
            {isBossFloor && <div>· 首领机制：气血跌破{(BOSS_MECHANICS.corneredBelow * 100).toFixed(0)}%进入「困兽」，攻击×{BOSS_MECHANICS.corneredAtkMul} 但受伤+{((BOSS_MECHANICS.corneredDmgTakenMul - 1) * 100).toFixed(0)}%——斩杀窗口博弈。</div>}
            {isGrandBoss && <div>· 大关底：首领开局带 1 名护卫。</div>}
            {enemies.filter(e => e.elite).flatMap(e => (e.affixes ?? []).map(a => (
              <div key={`${e.name}${a}`}>· {e.name} 词缀「{ELITE.affixes[a].name}」：{ELITE.affixes[a].desc}</div>
            )))}
          </div>
        )}
        <button onClick={goBattle} className="btn-cinnabar w-full py-3 font-display text-lg tracking-[0.5em]">
          出 战
        </button>
        <p className="text-xs mt-2" style={{ color: 'var(--ink-faint)' }}>
          {state.floor <= 1
            ? '教学层：普攻 1 次积满怒气，绝技消耗满怒气。通关后可去「寻侠」扩充队伍。'
            : `敌人气血每层×1.22、攻击×1.12（${TOWER_CURVE.softenFloor}层后衰减为×${TOWER_CURVE.hpGrowthHigh}/×${TOWER_CURVE.atkGrowthHigh}）；第${ELITE.startFloor}层起普通层概率刷精英词缀。打不过就先寻侠或养成。`}
        </p>
      </section>

      {/* 队伍期望 */}
      <section className="paper-panel p-4">
        <h2 className="font-display text-lg tracking-widest mb-2 flex items-center gap-2">
          <BarChart3 size={17} style={{ color: 'var(--ink-soft)' }} />阵容期望一览
        </h2>
        <div className="space-y-1 text-sm tnum">
          {state.team.map(id => {
            const o = state.heroes.find(h => h.heroId === id)!
            const s = grownStats(o)
            return (
              <div key={id} className="flex justify-between">
                <span className="font-display">{s.name}</span>
                <span style={{ color: 'var(--ink-soft)' }}>
                  攻击 {s.atkMin}~{s.atkMax} · 会心 {(s.crit * 100).toFixed(0)}% · 会意 {(s.insight * 100).toFixed(0)}%
                </span>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
