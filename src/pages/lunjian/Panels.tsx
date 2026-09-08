import { useMemo, useState } from 'react'
import type { ArtifactId, CharId, DraftPick, JudgeCard, MatchState, Order, StrategyCard } from '@contracts/game'
import { ARTIFACTS, JUDGE_CARDS, ROSTER, RULES, SIDE_NAME, STRATEGY_CARDS } from '@contracts/game'
import { CharChip } from './components'

const C = {
  ink: 'var(--ink)', soft: 'var(--ink-soft)', faint: 'var(--ink-faint)',
  cinnabar: 'var(--cinnabar)', gold: 'var(--gold)',
}

const STRAT_KEYS = Object.keys(STRATEGY_CARDS) as StrategyCard[]
const JUDGE_KEYS = Object.keys(JUDGE_CARDS) as JudgeCard[]

/** 布阵面板：摸4选3排序 + 升星合成(2★/3★) + 策略卡(1AP盲盖) + 判定卡(0AP) + 法器抽取(1AP/次) */
export function DraftPanel({
  hand, apIncoming, thrift, artifacts, onSubmit, submitted, opponentReady,
}: {
  hand: CharId[]
  apIncoming: number
  thrift: boolean
  artifacts: Partial<Record<CharId, ArtifactId[]>>
  onSubmit: (d: DraftPick) => void
  submitted: boolean
  opponentReady: boolean
}) {
  const [picks, setPicks] = useState<number[]>([])
  const [star2, setStar2] = useState<CharId | null>(null)   // 合成 2★ 的侠客（对子，仍上 3 人）
  const [star3, setStar3] = useState<CharId | null>(null)   // 合成 3★ 的侠客（三条，只上 2 人）
  const [starHint, setStarHint] = useState('')
  const [strat, setStrat] = useState<StrategyCard | null>(null)
  const [stratSel, setStratSel] = useState<number[]>([])   // 策略卡目标槽位（移形需 2 个）
  const [judge, setJudge] = useState<JudgeCard | null>(null)
  const [judgeSlot, setJudgeSlot] = useState<number | null>(null)
  const [draws, setDraws] = useState<{ char: CharId; artifact: ArtifactId }[]>([])

  // 手牌重名统计：自动识别对子/三条
  const counts = new Map<CharId, number>()
  for (const c of hand) counts.set(c, (counts.get(c) ?? 0) + 1)
  const pairChars = [...counts.entries()].filter(([, n]) => n >= 2).map(([c]) => c)
  const tripleChars = [...counts.entries()].filter(([, n]) => n >= 3).map(([c]) => c)

  const starChar = star3 ?? star2
  const maxPicks = star3 ? 2 : 3                             // 3★ 三合一：少上 1 人

  if (submitted) {
    return (
      <div className="paper-panel px-4 py-6 text-center">
        <div className="font-display tracking-widest">布阵已盖定</div>
        <div className="text-xs mt-2" style={{ color: C.faint }}>
          {opponentReady ? '等待翻牌…' : '等待对方布阵…（对方还没盖牌）'}
        </div>
      </div>
    )
  }

  const toggle = (i: number) => {
    setStarHint('')
    setPicks(p => {
      if (p.includes(i)) {
        const n = p.filter(x => x !== i)
        if (starChar && hand[i] === starChar) { setStar2(null); setStar3(null) }  // 拿掉主卡 = 取消合成
        setStratSel([]); setJudgeSlot(null); setDraws([])                          // 换阵清空槽位绑定
        return n
      }
      if (p.length >= maxPicks) return p
      // 合成模式下：同名主卡已上阵后，其余同名手牌是材料（自动消耗），不可再点上阵
      if (starChar && hand[i] === starChar && p.some(k => hand[k] === starChar)) return p
      setStratSel([]); setJudgeSlot(null); setDraws([])
      return [...p, i]
    })
  }

  /** 合 2★：对子合成，仍上 3 人，不改变上阵数 */
  const armStar2 = (c: CharId) => {
    setStarHint('')
    if (star2 === c) { setStar2(null); return }
    if (picks.filter(i => hand[i] === c).length > 1) {
      setStarHint(`请先点掉多余的「${ROSTER[c].name}」，只留 1 张作 2★ 主卡`)
      return
    }
    setStar3(null)
    setStar2(c)
  }

  /** 合 3★：三条合成，少上 1 人（只上 2 人）——须用户手动精简手牌，绝不静默删牌 */
  const armStar3 = (c: CharId) => {
    setStarHint('')
    if (star3 === c) { setStar3(null); return }
    if (picks.filter(i => hand[i] === c).length > 1) {
      setStarHint(`请先点掉多余的「${ROSTER[c].name}」，只留 1 张作 3★ 主卡`)
      return
    }
    if (picks.length > 2) {
      setStarHint(`合成 3★「${ROSTER[c].name}」将少上 1 人（只上 2 人）：请先点掉 1 张已选手牌，再点「合 3★」`)
      return
    }
    setStar2(null)
    setStar3(c)
    setStratSel([]); setJudgeSlot(null); setDraws([])         // 槽位数 3→2，清空旧绑定
  }

  const starPicked = starChar ? picks.some(i => hand[i] === starChar) : false
  const ready = picks.length === maxPicks && (!starChar || starPicked)
  const pickedChars = picks.map(i => hand[i])
  const slotIdx = pickedChars.map((_, i) => i)               // 实际槽位（3★ 时只有 0/1）
  const cost = (strat ? RULES.costStrategy : 0) + draws.length * RULES.costArtifact
  const rate = thrift ? RULES.apCarryThrift : RULES.apCarry
  const apTotal = Math.min(RULES.apCap, RULES.apPerDazhe + apIncoming * rate)
  const apAfter = apTotal - cost
  const over = apAfter < 0

  const stratDef = strat ? STRATEGY_CARDS[strat] : null
  const needN = stratDef?.needsTarget === 'ally2' ? 2 : stratDef?.needsTarget ? 1 : 0
  const stratReady = !strat || stratSel.length === needN
  const judgeReady = !judge || judgeSlot !== null
  const canSubmit = ready && stratReady && judgeReady && !over

  const toggleStratSlot = (slot: number) => {
    if (stratSel.includes(slot)) { setStratSel(s => s.filter(x => x !== slot)); return }
    if (stratSel.length >= needN) return
    setStratSel(s => [...s, slot])
  }

  const submit = () => {
    if (!canSubmit) return
    // stars 与 picks 平行；普通布阵（未合成）完全不传 stars，保持 v3.1 兼容
    const stars = starChar
      ? picks.map(i => (hand[i] === starChar ? (star3 ? 3 : 2) : undefined) as 2 | 3 | undefined)
      : undefined
    onSubmit({
      picks,
      ...(stars ? { stars } : {}),
      strategy: strat
        ? { card: strat, a: stratSel[0], b: stratDef?.needsTarget === 'ally2' ? stratSel[1] : undefined }
        : null,
      judge: judge && judgeSlot !== null ? { card: judge, slot: judgeSlot } : null,
      artifactDraws: draws,
    })
  }

  return (
    <div className="space-y-3">
      <div className="paper-panel px-3 py-2 text-xs" style={{ color: C.soft }}>
        从 4 张手牌中<b>按顺序选 {maxPicks} 张</b>上阵（点击顺序即槽位号）。本大局 AP：
        <b className="tnum" style={{ color: over ? C.cinnabar : C.gold }}> {apAfter}</b>
        （发放 {RULES.apPerDazhe} + 结存 {apIncoming} ×{rate}{thrift ? '（节流翻倍）' : ''}{cost > 0 ? ` − 盖牌 ${cost}` : ''}）
      </div>

      {/* 升星合成：自动识别对子/三条，独立于点选的大按钮，避免误触 */}
      {(pairChars.length > 0 || tripleChars.length > 0) && (
        <div className="paper-panel px-3 py-2" style={{ outline: starChar ? `1px solid ${C.gold}` : 'none' }}>
          <div className="text-xs font-display tracking-widest mb-1" style={{ color: C.gold }}>
            升星 · 绝技强化（可选）
          </div>
          <div className="flex flex-col gap-1.5">
            {pairChars.filter(c => !tripleChars.includes(c)).map(c => (
              <button key={`s2-${c}`} type="button"
                className={`${star2 === c ? 'btn-cinnabar' : 'btn-ink'} w-full min-h-[44px] px-2 py-1.5 text-xs text-left`}
                onClick={() => armStar2(c)}>
                合 2★「{ROSTER[c].name}」
                <span className="opacity-80">：绝技 Lv2 · 面板 +5% · 消耗 2 张同名，仍上 3 人</span>
              </button>
            ))}
            {tripleChars.map(c => (
              <button key={`s3-${c}`} type="button"
                className={`${star3 === c ? 'btn-cinnabar' : 'btn-ink'} w-full min-h-[44px] px-2 py-1.5 text-xs text-left`}
                onClick={() => armStar3(c)}>
                合 3★「{ROSTER[c].name}」
                <span className="opacity-80">：绝技 Lv3 · 面板 +10% · 消耗 3 张同名，<b>少上 1 人（只上 2 人）</b></span>
              </button>
            ))}
            {star2 && (
              <div className="text-xs" style={{ color: C.soft }}>
                {starPicked
                  ? <>已合 2★「{ROSTER[star2].name}」：再选满 3 张上阵（同名另一张已作材料）。</>
                  : <>请点选 1 张「{ROSTER[star2].name}」作 2★ 主卡（另一张同名自动作材料）。</>}
              </div>
            )}
            {star3 && (
              <div className="text-xs" style={{ color: C.cinnabar }}>
                {starPicked
                  ? <>3★「{ROSTER[star3].name}」少上 1 人：<b>请再明确点选 1 张手牌</b>作为另一名上阵侠客（共 2 人）。</>
                  : <>3★ 只上 2 人：请点选 1 张「{ROSTER[star3].name}」作 3★ 主卡，再点选另 1 张上阵。</>}
              </div>
            )}
            {starHint && <div className="text-xs" style={{ color: C.cinnabar }}>{starHint}</div>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {hand.map((c, i) => {
          const order = picks.indexOf(i)
          const isMaterial = !!starChar && c === starChar && order < 0 && picks.some(k => hand[k] === starChar)
          const starOf = starChar && c === starChar && order >= 0 ? (star3 ? 3 : 2) : 0
          return (
            <div key={i} onClick={() => toggle(i)} role="button" aria-pressed={order >= 0}
              className="relative cursor-pointer transition-all min-h-[44px]"
              style={{ outline: order >= 0 ? `2px solid ${C.cinnabar}` : 'none' }}>
              <CharChip char={c} dim={(picks.length >= maxPicks && order < 0) || isMaterial} arts={artifacts[c]} />
              {order >= 0 && (
                <span className="absolute -top-2 -right-1 w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold"
                  style={{ background: C.cinnabar, color: 'var(--paper)' }}>{order + 1}</span>
              )}
              {starOf > 0 && (
                <span className="absolute -top-2 -left-1 px-1.5 h-5 rounded-full text-xs flex items-center justify-center font-bold"
                  style={{ background: C.gold, color: 'var(--paper)' }}
                  title={`绝技 Lv${starOf} + 面板 ${starOf === 2 ? '+5%' : '+10%'}`}>{starOf}★</span>
              )}
              {isMaterial && (
                <span className="absolute -top-2 -left-1 px-1.5 h-5 rounded-full text-xs flex items-center justify-center"
                  style={{ background: C.faint, color: 'var(--paper)' }}>材料</span>
              )}
            </div>
          )
        })}
      </div>

      {ready && (
        <>
          {/* 策略卡：1 AP 盲盖，每大局限 1 张 */}
          <div className="paper-panel px-3 py-2">
            <div className="text-xs font-display tracking-widest mb-1" style={{ color: C.soft }}>
              策略卡（1 AP · 每大局限盖 1 张 · 盲盖，翻牌才公开）
            </div>
            <div className="grid grid-cols-3 gap-1">
              {STRAT_KEYS.map(k => (
                <button key={k}
                  className={strat === k ? 'btn-cinnabar text-xs px-1 py-1 min-h-[44px]' : 'btn-ink text-xs px-1 py-1 min-h-[44px]'}
                  onClick={() => { setStrat(strat === k ? null : k); setStratSel([]) }}>
                  {k}<span className="opacity-70">·{STRATEGY_CARDS[k].cat}</span>
                </button>
              ))}
            </div>
            {stratDef && (
              <div className="text-xs mt-1.5" style={{ color: C.faint }}>
                {stratDef.desc}
                {needN > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    <span style={{ color: C.faint }}>目标：</span>
                    {stratDef.needsTarget === 'enemy'
                      ? [0, 1, 2].map(i => (
                          <button key={i} className={stratSel.includes(i) ? 'btn-cinnabar text-xs px-2 py-0.5 min-h-[44px]' : 'btn-ink text-xs px-2 py-0.5 min-h-[44px]'}
                            onClick={() => toggleStratSlot(i)}>对方{i + 1}号位</button>
                        ))
                      : slotIdx.map(i => (
                          <button key={i} className={stratSel.includes(i) ? 'btn-cinnabar text-xs px-2 py-0.5 min-h-[44px]' : 'btn-ink text-xs px-2 py-0.5 min-h-[44px]'}
                            onClick={() => toggleStratSlot(i)}>
                            {i + 1}号位·{ROSTER[pickedChars[i]].name}
                          </button>
                        ))}
                    {stratDef.needsTarget === 'ally2' && stratSel.length < 2 && (
                      <span className="text-xs" style={{ color: C.faint }}>（再选 {2 - stratSel.length} 个）</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 判定卡：0 AP，盖在人物卡下 */}
          <div className="paper-panel px-3 py-2">
            <div className="text-xs font-display tracking-widest mb-1" style={{ color: C.soft }}>
              判定卡（0 AP · 盖在人物卡下，联动三率判定）
            </div>
            <div className="grid grid-cols-4 gap-1">
              {JUDGE_KEYS.map(k => (
                <button key={k}
                  className={judge === k ? 'btn-cinnabar text-xs px-1 py-1 min-h-[44px]' : 'btn-ink text-xs px-1 py-1 min-h-[44px]'}
                  onClick={() => { setJudge(judge === k ? null : k); setJudgeSlot(null) }}>
                  {k}
                </button>
              ))}
            </div>
            {judge && (
              <div className="text-xs mt-1.5" style={{ color: C.faint }}>
                {JUDGE_CARDS[judge].desc}
                <div className="flex gap-1 mt-1 flex-wrap">
                  <span style={{ color: C.faint }}>盖给：</span>
                  {slotIdx.map(i => (
                    <button key={i} className={judgeSlot === i ? 'btn-cinnabar text-xs px-2 py-0.5 min-h-[44px]' : 'btn-ink text-xs px-2 py-0.5 min-h-[44px]'}
                      onClick={() => setJudgeSlot(judgeSlot === i ? null : i)}>
                      {i + 1}号位·{ROSTER[pickedChars[i]].name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 法器：1 AP/件指定获取，跨大局培养，每人限 2 件 */}
          <div className="paper-panel px-3 py-2">
            <div className="text-xs font-display tracking-widest mb-1" style={{ color: C.soft }}>
              法器（1 AP/件 · 指定获取 · 跨大局生效，每人限 {RULES.artifactMaxPerChar} 件不同法器）
            </div>
            <div className="space-y-1.5">
              {pickedChars.map((c, i) => {
                const owned = artifacts[c] ?? []
                const pending = draws.filter(x => x.char === c)
                const full = owned.length + pending.length >= RULES.artifactMaxPerChar
                return (
                  <div key={i} className="text-xs">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span style={{ color: C.ink }}>{i + 1}号位·{ROSTER[c].name}</span>
                      {owned.map(a => (
                        <span key={a} className="px-1" style={{ color: C.gold }} title={ARTIFACTS[a].desc}>「{a}」</span>
                      ))}
                      {pending.map((p, j) => (
                        <span key={j} className="px-1 cursor-pointer" style={{ color: C.cinnabar }}
                          title="点击取消"
                          onClick={() => setDraws(d => d.filter((x, k) => !(x.char === p.char && x.artifact === p.artifact && k === draws.indexOf(p))))}>
                          「{p.artifact}」×
                        </span>
                      ))}
                    </div>
                    {!full && (
                      <div className="flex gap-1 mt-0.5 flex-wrap">
                        {(Object.keys(ARTIFACTS) as ArtifactId[]).map(a => {
                          const taken = owned.includes(a) || pending.some(p => p.artifact === a)
                          return (
                            <button key={a} className="btn-ink text-xs px-1.5 py-0.5 min-h-[44px]" disabled={taken}
                              style={{ opacity: taken ? 0.3 : 1 }} title={ARTIFACTS[a].desc}
                              onClick={() => setDraws(d => [...d, { char: c, artifact: a }])}>
                              {a}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      <button className="btn-cinnabar w-full py-2 min-h-[44px] font-display tracking-widest" disabled={!canSubmit}
        style={{ opacity: canSubmit ? 1 : 0.4 }}
        onClick={submit}>
        {!ready
          ? starChar && !starPicked
            ? `请点选 1 张「${ROSTER[starChar].name}」作 ${star3 ? 3 : 2}★ 主卡`
            : `还差 ${maxPicks - picks.length} 张`
          : over ? `AP 超支 ${-apAfter} 点`
          : !stratReady ? '策略卡还没指目标'
          : !judgeReady ? '判定卡还没选侠客'
          : star3 ? `盖牌定阵（3★ 只上 2 人）` : '盖牌定阵'}
      </button>
    </div>
  )
}

/** 指令面板：每个存活侠客 待命/普攻(指敌)/绝技 + 换位 */
export function OrdersPanel({
  state, me, onSubmit, submitted, opponentReady,
}: {
  state: MatchState
  me: 0 | 1
  onSubmit: (orders: Order[]) => void
  submitted: boolean
  opponentReady: boolean
}) {
  const [choices, setChoices] = useState<Record<number, Order>>({})
  const [swapSel, setSwapSel] = useState<number[]>([]) // 换位：点选两个己方槽位
  const mySide = state.sides[me]
  const foeSide = (1 - me) as 0 | 1

  // 关键修复：换小轮/大局时清掉残留指令，阵亡侠客的旧指令绝不允许带进提交
  const phaseKey = `${state.dazhe}-${state.round}`
  const [lastKey, setLastKey] = useState(phaseKey)
  if (lastKey !== phaseKey) {
    setLastKey(phaseKey)
    setChoices({})
    setSwapSel([])
  }

  const cost = useMemo(
    () =>
      Object.values(choices).reduce((s, o) => s + (o.type === 'attack' ? RULES.costAttack : o.type === 'ult' ? RULES.costUlt : 0), 0)
      + (swapSel.length === 2 ? RULES.costSwap : 0),
    [choices, swapSel],
  )
  const over = cost > mySide.ap + 1e-9

  if (submitted) {
    return (
      <div className="paper-panel px-4 py-6 text-center">
        <div className="font-display tracking-widest">指令已暗置</div>
        <div className="text-xs mt-2" style={{ color: C.faint }}>
          {opponentReady ? '等待翻牌结算…' : '等待对方暗置指令…'}
        </div>
      </div>
    )
  }

  const setChoice = (slot: number, o: Order | null) =>
    setChoices(c => { const n = { ...c }; if (o) n[slot] = o; else delete n[slot]; return n })

  // 换位：点选两个己方存活槽位交换位置（1 AP，阵型调整，不占用行动，指令跟随本人）
  const toggleSwap = (slot: number) => {
    if (swapSel.includes(slot)) { setSwapSel(s => s.filter(x => x !== slot)); return }
    if (swapSel.length >= 2) return
    setSwapSel(s => [...s, slot])
  }

  const needsEnemyTarget = (char: CharId) => ['连珠', '炎爆'].includes(ROSTER[char].ult)
  const needsAllyTarget = (char: CharId) => ROSTER[char].ult === '鼓舞'

  return (
    <div className="space-y-2">
      <div className="paper-panel px-3 py-2 text-xs flex justify-between" style={{ color: C.soft }}>
        <span>暗置本小轮指令（不给指令就是站着挨打）</span>
        <span>花费 <b className="tnum" style={{ color: over ? C.cinnabar : C.gold }}>{cost}</b> / {Math.round(mySide.ap * 10) / 10} AP</span>
      </div>

      {mySide.fighters.map((f, slot) => {
        if (!f.alive) return null
        const d = ROSTER[f.char]
        const cur = choices[slot]
        const canUlt = f.mp >= RULES.mpMax
        const inSwap = swapSel.includes(slot)
        return (
          <div key={f.id} className="paper-panel px-3 py-2" style={inSwap ? { outline: `1px solid ${C.gold}` } : undefined}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-display text-lg">{d.name}</span>
              <span className="text-xs tnum" style={{ color: C.faint }}>{slot + 1}号位 · {Math.round(f.hp)}血 · {f.mp}蓝</span>
              {f.judgeCards.length > 0 && (
                <span className="text-xs" style={{ color: C.gold }}>{f.judgeCards.join('·')}</span>
              )}
              <div className="flex gap-1 ml-auto items-center flex-wrap">
                <button className={!cur ? 'btn-cinnabar text-xs px-2 py-1' : 'btn-ink text-xs px-2 py-1'}
                  onClick={() => setChoice(slot, null)}>待命</button>
                <button className={cur?.type === 'attack' ? 'btn-cinnabar text-xs px-2 py-1' : 'btn-ink text-xs px-2 py-1'}
                  onClick={() => setChoice(slot, { slot, type: 'attack', targetSlot: cur?.targetSlot })}>普攻·1AP</button>
                <button
                  className={cur?.type === 'ult' ? 'btn-cinnabar text-xs px-2 py-1' : 'btn-ink text-xs px-2 py-1'}
                  style={{ opacity: canUlt ? 1 : 0.35 }}
                  onClick={() => canUlt && setChoice(slot, { slot, type: 'ult', targetSlot: cur?.targetSlot })}>
                  {d.ult}·3AP
                </button>
                <button className={inSwap ? 'btn-cinnabar text-xs px-2 py-1' : 'btn-ink text-xs px-2 py-1'}
                  onClick={() => toggleSwap(slot)}>换位</button>
              </div>
            </div>
            {cur && cur.type !== 'idle' && (
              <div className="flex gap-1 mt-2 items-center flex-wrap">
                <span className="text-xs" style={{ color: C.faint }}>目标：</span>
                {cur.type === 'ult' && needsAllyTarget(f.char)
                  ? mySide.fighters.map((af, i) => af.alive && i !== slot && (
                      <button key={i}
                        className={cur.targetSlot === i ? 'btn-cinnabar text-xs px-2 py-0.5' : 'btn-ink text-xs px-2 py-0.5'}
                        onClick={() => setChoice(slot, { ...cur, targetSlot: i })}>
                        己方{i + 1}号·{ROSTER[af.char].name}
                      </button>
                    ))
                  : cur.type === 'ult' && !needsEnemyTarget(f.char)
                    ? (
                      <span className="text-xs" style={{ color: C.faint }}>（{d.ult === '嘲讽' ? '自动锁定敌方攻击最高者' : d.ult === '回春' ? '自动治疗己方气血最低者' : '自身'}）</span>
                    )
                    : state.sides[foeSide].fighters.map((ef, i) => ef.alive && (
                        <button key={i}
                          className={cur.targetSlot === i ? 'btn-cinnabar text-xs px-2 py-0.5' : 'btn-ink text-xs px-2 py-0.5'}
                          onClick={() => setChoice(slot, { ...cur, targetSlot: i })}>
                          敌方{i + 1}号·{ROSTER[ef.char].name}（{Math.round(ef.hp)}）
                        </button>
                      ))}
                {cur.type === 'attack' && (
                  <span className="text-xs" style={{ color: C.faint }}>（打的是位置：对方换位可扑空）</span>
                )}
              </div>
            )}
          </div>
        )
      })}

      {swapSel.length === 2 && (
        <div className="paper-panel px-3 py-2 text-xs text-center" style={{ color: C.gold }}>
          换位：{swapSel[0] + 1}号位 ↔ {swapSel[1] + 1}号位（1 AP，结算前生效，指令跟随本人）
        </div>
      )}

      <button className="btn-cinnabar w-full py-2 font-display tracking-widest"
        style={{ opacity: over ? 0.4 : 1 }}
        onClick={() => {
          if (over) return
          const orders: Order[] = []
          for (const [k, o] of Object.entries(choices)) {
            const f = mySide.fighters[Number(k)]
            if (!f || !f.alive) continue                    // 阵亡者指令剔除
            const clean = { ...o }
            const toAlly = clean.type === 'ult' && needsAllyTarget(f.char)
            if (clean.targetSlot !== undefined) {
              const pool = toAlly ? mySide.fighters : state.sides[foeSide].fighters
              if (!pool[clean.targetSlot]?.alive) clean.targetSlot = undefined  // 目标阵亡→交引擎重指
            }
            const needsTarget = clean.type === 'attack' || (clean.type === 'ult' && (needsEnemyTarget(f.char) || needsAllyTarget(f.char)))
            if (needsTarget && clean.targetSlot === undefined) {
              // 自动指向第一个存活目标，避免校验卡死
              const pool = toAlly ? mySide.fighters : state.sides[foeSide].fighters
              const idx = pool.findIndex((t, i) => t.alive && !(toAlly && i === Number(k)))
              if (idx >= 0) clean.targetSlot = idx
            }
            orders.push(clean)
          }
          if (swapSel.length === 2) orders.push({ slot: swapSel[0], type: 'swap', targetSlot: swapSel[1] })
          onSubmit(orders)
        }}>
        暗置指令{over ? `（AP 超支 ${Math.round((cost - mySide.ap) * 10) / 10} 点）` : ''}
      </button>
    </div>
  )
}

export function DazheResultPanel({ state, onNext, nextLabel }: { state: MatchState; onNext: () => void; nextLabel: string }) {
  const sm = state.summary
  if (!sm) return null
  return (
    <div className="paper-panel px-4 py-4 text-center space-y-2">
      {/* 封盘横幅：印章盖下动画，大局号变化即重播 */}
      <div key={`${sm.dazhe}-${sm.winner}`} className="banner-stamp inline-block font-display text-xl tracking-widest">
        第 {sm.dazhe} 大局封盘 ·{' '}
        <span style={{ color: sm.winner === null ? C.soft : sm.winner === 0 ? C.cinnabar : C.ink }}>
          {sm.winner === null ? '平轮' : `${SIDE_NAME[sm.winner]}胜`}
        </span>
      </div>
      <div className="text-xs rise-in" style={{ color: C.soft, animationDelay: '0.25s' }}>{sm.reason}</div>
      <div className="text-xs tnum rise-in" style={{ color: C.faint, animationDelay: '0.4s' }}>
        存活 {sm.alive[0]} : {sm.alive[1]} · 伤害 {sm.dmg[0]} : {sm.dmg[1]}
      </div>
      <button className="btn-ink px-6 py-1.5 font-display tracking-widest" onClick={onNext}>{nextLabel}</button>
    </div>
  )
}

export function MatchEndPanel({ state, onRematch }: { state: MatchState; onRematch?: () => void }) {
  const winText = state.winner !== null ? `${SIDE_NAME[state.winner]}夺魁` : '战平'
  return (
    <div className="paper-panel px-4 py-6 text-center space-y-3">
      {/* 终局横幅：朱砂盖章落定 */}
      <div key={winText} className="banner-stamp inline-block">
        <span
          className="seal-stamp font-display tracking-widest"
          style={{ minWidth: 96, height: 44, fontSize: 20, padding: '0 14px', color: '#f7f2e4' }}
        >
          {winText}
        </span>
      </div>
      <div className="text-sm tnum rise-in" style={{ color: C.soft, animationDelay: '0.3s' }}>{state.score[0]} : {state.score[1]}</div>
      <div className="text-xs rise-in" style={{ color: C.faint, animationDelay: '0.45s' }}>{state.note}</div>
      {onRematch && <button className="btn-cinnabar px-8 py-2 font-display tracking-widest" onClick={onRematch}>再战一局</button>}
    </div>
  )
}
