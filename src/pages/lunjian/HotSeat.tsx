import { useState } from 'react'
import type { DraftPick, MatchState, Order } from '@contracts/game'
import {
  newMatch, submitDraft, submitOrders, advanceDazhe,
  validateDraft, validateOrders, SIDE_NAME,
} from '@contracts/game'
import { Battlefield, LogPanel, RevealsPanel, ScoreBar, Banner } from './components'
import { DraftPanel, OrdersPanel, DazheResultPanel, MatchEndPanel } from './Panels'

const C = { faint: 'var(--ink-faint)', soft: 'var(--ink-soft)', cinnabar: 'var(--cinnabar)' }

type Mode = 'pass' | 'act' | 'reveal'

/** 同屏双人：传手机模式。本地跑同一套规则引擎，用中场幕布遮信息。 */
export default function HotSeat() {
  const [g, setG] = useState<MatchState>(() => newMatch())
  const [mode, setMode] = useState<Mode>('pass')
  const [revealKind, setRevealKind] = useState<'draft' | 'round'>('draft')
  const [err, setErr] = useState('')

  // 当前行动方：布阵/指令阶段，谁还没交就轮到谁
  const actor: 0 | 1 =
    g.phase === 'draft'
      ? g.sides[0].picks ? 1 : 0
      : g.sides[0].orders ? 1 : 0

  const act = (fn: (s: MatchState) => void) => {
    setG(prev => {
      const next = structuredClone(prev)
      fn(next)
      return next
    })
  }

  const onDraft = (d: DraftPick) => {
    const e = validateDraft(g, actor, d)
    if (e) return setErr(e)
    setErr('')
    act(s => submitDraft(s, actor, d))
    // 双方盖齐后引擎自动锁阵 → 公开翻牌；否则交给另一方
    if (g.sides[1 - actor].picks) { setMode('reveal'); setRevealKind('draft') }
    else setMode('pass')
  }

  const onOrders = (orders: Order[]) => {
    const e = validateOrders(g, actor, orders)
    if (e) return setErr(e)
    setErr('')
    act(s => submitOrders(s, actor, orders))
    if (g.sides[1 - actor].orders) { setMode('reveal'); setRevealKind('round') }
    else setMode('pass')
  }

  const onNextDazhe = () => {
    act(s => advanceDazhe(s))
    setMode('pass')
  }

  // ---------- 渲染 ----------
  if (g.phase === 'matchEnd') {
    return (
      <div className="space-y-3">
        <ScoreBar state={g} />
        <MatchEndPanel state={g} onRematch={() => { setG(newMatch()); setMode('pass') }} />
        {g.lastLog && <LogPanel log={g.lastLog} />}
      </div>
    )
  }

  if (g.phase === 'dazheResult') {
    return (
      <div className="space-y-3">
        <ScoreBar state={g} />
        <DazheResultPanel state={g} onNext={onNextDazhe} nextLabel={`进入第 ${g.dazhe + 1} 大局`} />
        <Battlefield state={g} perspective="both" />
        {g.lastLog && <LogPanel log={g.lastLog} />}
      </div>
    )
  }

  if (mode === 'reveal') {
    return (
      <div className="space-y-3">
        <ScoreBar state={g} />
        <Banner text={revealKind === 'draft' ? '翻牌 · 亮阵' : '翻牌 · 结算'} sub={g.note} />
        {revealKind === 'draft' && <RevealsPanel reveals={g.reveals} />}
        <Battlefield state={g} perspective="both" />
        {revealKind === 'round' && g.lastLog && <LogPanel log={g.lastLog} />}
        <button className="btn-cinnabar w-full py-2 font-display tracking-widest" onClick={() => setMode('pass')}>
          {g.phase === 'orders' ? `进入第 ${g.round} 小轮` : '继续'}
        </button>
      </div>
    )
  }

  if (mode === 'pass') {
    return (
      <div className="space-y-3">
        <ScoreBar state={g} />
        <div key={`${g.dazhe}-${g.round}-${actor}-${g.phase}`} className="rise-in paper-panel px-4 py-10 text-center space-y-3">
          <div className="font-display text-2xl tracking-widest">请{SIDE_NAME[actor]}操作</div>
          <div className="text-xs" style={{ color: C.faint }}>
            {g.phase === 'draft' ? '布阵阶段 · 请另一方回避' : `第 ${g.round} 小轮 · 暗置指令 · 请另一方回避`}
          </div>
          <button className="btn-ink px-8 py-2 font-display tracking-widest" onClick={() => setMode('act')}>
            我已就位
          </button>
        </div>
      </div>
    )
  }

  // mode === 'act'
  return (
    <div className="space-y-3">
      <ScoreBar state={g} />
      {g.phase === 'draft' ? (
        <DraftPanel
          hand={g.sides[actor].hand}
          apIncoming={g.sides[actor].apCarry}
          thrift={g.sides[actor].thrift}
          artifacts={g.sides[actor].artifacts ?? {}}
          onSubmit={onDraft}
          submitted={false}
          opponentReady={!!g.sides[1 - actor].picks}
        />
      ) : (
        <>
          <RevealsPanel reveals={g.reveals} />
          <Battlefield state={g} perspective={actor} />
          <OrdersPanel state={g} me={actor} onSubmit={onOrders}
            submitted={false} opponentReady={!!g.sides[1 - actor].orders} />
          {g.lastLog && <LogPanel log={g.lastLog} title="上一小轮战报" />}
        </>
      )}
      {err && <div className="text-xs text-center" style={{ color: C.cinnabar }}>{err}</div>}
    </div>
  )
}
