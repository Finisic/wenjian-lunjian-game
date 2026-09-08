import { useEffect, useState } from 'react'
import { trpc } from '@/providers/trpc'
import type { ClientView, DraftPick, Order } from '@contracts/game'
import { Battlefield, LogPanel, RevealsPanel, ScoreBar, Banner } from './components'
import { DraftPanel, OrdersPanel, DazheResultPanel, MatchEndPanel } from './Panels'

const C = { faint: 'var(--ink-faint)', soft: 'var(--ink-soft)', cinnabar: 'var(--cinnabar)', gold: 'var(--gold)' }
const SEAT_KEY = 'lunjian_seat_v1'

type Seat = { code: string; token: string }

function loadSeat(): Seat | null {
  try { return JSON.parse(localStorage.getItem(SEAT_KEY) || 'null') } catch { return null }
}

export default function Online() {
  const [seat, setSeat] = useState<Seat | null>(loadSeat)
  const [joinCode, setJoinCode] = useState('')

  const create = trpc.lunjian.create.useMutation({
    onSuccess: (s) => { localStorage.setItem(SEAT_KEY, JSON.stringify(s)); setSeat(s) },
  })
  const join = trpc.lunjian.join.useMutation({
    onSuccess: (s) => { localStorage.setItem(SEAT_KEY, JSON.stringify(s)); setSeat(s) },
  })

  if (seat) return <Room seat={seat} onLeave={() => { localStorage.removeItem(SEAT_KEY); setSeat(null) }} />

  return (
    <div className="space-y-3">
      <Banner text="联网论剑" sub="建房拿码 → 发给朋友 → 开打。服务器权威判定，盖牌在翻牌前对方不可见。" />
      <button className="btn-cinnabar w-full py-3 font-display tracking-widest"
        onClick={() => create.mutate()} disabled={create.isPending}>
        {create.isPending ? '建房中…' : '创建房间（你是甲方）'}
      </button>
      <div className="paper-panel px-3 py-3 space-y-2">
        <div className="text-xs" style={{ color: C.soft }}>有房间码？加入朋友的房间（你是乙方）</div>
        <div className="flex gap-2">
          <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
            placeholder="房间码" maxLength={6}
            className="flex-1 bg-transparent border px-3 py-2 text-sm tracking-widest tnum"
            style={{ borderColor: 'var(--ink)' }} />
          <button className="btn-ink px-4 py-2 font-display" disabled={joinCode.length !== 6 || join.isPending}
            onClick={() => join.mutate({ code: joinCode })}>
            入局
          </button>
        </div>
      </div>
      {(create.error || join.error) && (
        <div className="text-xs text-center" style={{ color: C.cinnabar }}>
          {(create.error || join.error)?.message}
        </div>
      )}
    </div>
  )
}

function Room({ seat, onLeave }: { seat: Seat; onLeave: () => void }) {
  const utils = trpc.useUtils()
  const q = trpc.lunjian.state.useQuery(
    { code: seat.code, token: seat.token },
    { refetchInterval: 1500, retry: false },
  )
  const refresh = () => utils.lunjian.state.invalidate({ code: seat.code, token: seat.token })

  const draft = trpc.lunjian.draft.useMutation({ onSuccess: refresh })
  const orders = trpc.lunjian.orders.useMutation({ onSuccess: refresh })
  const next = trpc.lunjian.next.useMutation({ onSuccess: refresh })
  const rematch = trpc.lunjian.rematch.useMutation({ onSuccess: refresh })

  // 对方一动立刻刷新（提交后主动拉一次，轮询兜底）
  useEffect(() => { /* noop, 轮询已覆盖 */ }, [])

  if (q.error) {
    return (
      <div className="space-y-3">
        <Banner text="进不了房间" sub={q.error.message} />
        <button className="btn-ink w-full py-2" onClick={onLeave}>返回</button>
      </div>
    )
  }
  const v = q.data as ClientView | undefined
  if (!v) return <div className="text-center text-xs py-10" style={{ color: C.faint }}>入座中…</div>

  const me = v.me
  const err = draft.error?.message || orders.error?.message

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs" style={{ color: C.faint }}>
        <span>房间码 <b className="tnum tracking-widest" style={{ color: C.gold }}>{seat.code}</b>（发给朋友即可对战）</span>
        <button onClick={onLeave} className="underline">离开</button>
      </div>

      {v.phase === 'waiting' && (
        <div className="paper-panel px-4 py-10 text-center space-y-3">
          <div className="font-display text-xl tracking-widest">虚位以待</div>
          <div className="font-display text-4xl tracking-[0.5em] tnum" style={{ color: C.cinnabar }}>{seat.code}</div>
          <div className="text-xs" style={{ color: C.faint }}>把这个房间码发给朋友，她在「联网对战 → 入局」输入即可</div>
        </div>
      )}

      {v.phase !== 'waiting' && <ScoreBar state={v} />}

      {v.phase === 'draft' && (
        <DraftPanel
          hand={v.sides[me].hand}
          apIncoming={v.sides[me].apCarry}
          thrift={v.sides[me].thrift}
          artifacts={v.sides[me].artifacts ?? {}}
          onSubmit={(d: DraftPick) => draft.mutate({ code: seat.code, token: seat.token, ...d })}
          submitted={!!v.sides[me].picks}
          opponentReady={!!v.sides[1 - me].picks}
        />
      )}

      {v.phase === 'orders' && (
        <>
          <RevealsPanel reveals={v.reveals} />
          <Battlefield state={v} perspective={me} />
          <OrdersPanel state={v} me={me}
            onSubmit={(o: Order[]) => orders.mutate({ code: seat.code, token: seat.token, orders: o })}
            submitted={!!v.sides[me].orders}
            opponentReady={!!v.sides[1 - me].orders} />
          {v.lastLog && <LogPanel log={v.lastLog} title="上一小轮战报" />}
        </>
      )}

      {v.phase === 'dazheResult' && (
        <>
          <DazheResultPanel state={v} nextLabel={`进入第 ${v.dazhe + 1} 大局`}
            onNext={() => next.mutate({ code: seat.code, token: seat.token })} />
          <Battlefield state={v} perspective="both" />
          {v.lastLog && <LogPanel log={v.lastLog} />}
        </>
      )}

      {v.phase === 'matchEnd' && (
        <>
          <MatchEndPanel state={v}
            onRematch={() => rematch.mutate({ code: seat.code, token: seat.token })} />
          {v.lastLog && <LogPanel log={v.lastLog} />}
        </>
      )}

      {err && <div className="text-xs text-center" style={{ color: C.cinnabar }}>{err}</div>}
    </div>
  )
}
