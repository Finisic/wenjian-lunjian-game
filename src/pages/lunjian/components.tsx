import type { ArtifactId, CharId, Fighter, MatchState, RoundLog } from '@contracts/game'
import { ARTIFACTS, ROSTER, RULES, SIDE_NAME } from '@contracts/game'
import { SealBadge, type SealTone } from '../../components/seal'

const C = {
  ink: 'var(--ink)', soft: 'var(--ink-soft)', faint: 'var(--ink-faint)',
  cinnabar: 'var(--cinnabar)', gold: 'var(--gold)',
}

export function CharChip({ char, dim, arts }: { char: CharId; dim?: boolean; arts?: ArtifactId[] }) {
  const d = ROSTER[char]
  return (
    <div className="paper-panel px-3 py-2 text-center" style={{ opacity: dim ? 0.45 : 1 }}>
      <div className="font-display text-xl tracking-wider">{d.name}</div>
      <div className="text-xs" style={{ color: C.faint }}>{d.role}</div>
      <div className="text-xs mt-1 tnum" style={{ color: C.soft }}>
        {d.typ === 'P' ? '物' : '魔'}{d.lo}~{d.hi} · 血{d.hp} · 速{d.spd}
      </div>
      <div className="text-xs" style={{ color: C.gold }}>绝技·{d.ult}</div>
      {arts && arts.length > 0 && (
        <div className="text-xs mt-0.5" style={{ color: C.gold }}>
          {arts.map(a => `「${a}」`).join('')}
        </div>
      )}
    </div>
  )
}

const KIND_COLOR: Record<string, string> = {
  神妙: 'var(--gold)', 致命: 'var(--cinnabar)', 命中: 'var(--ink)', 擦碰: 'var(--ink-faint)',
}

/** 判定类型 → 飘字分色分大小样式 */
const KIND_FLOAT_CLASS: Record<string, string> = {
  神妙: 'dmg-god', 致命: 'dmg-crit', 命中: 'dmg-hit', 擦碰: 'dmg-graze',
}

export interface DmgFloat { id: string; dmg: number; kind?: string }

/* ---------- 状态印记（印章式徽章，悬停/点按出说明） ---------- */

interface Mark { ch: string; name: string; desc: string; tone: SealTone }

function fighterMarks(f: Fighter): Mark[] {
  const m: Mark[] = []
  if (f.star >= 2) {
    m.push({
      ch: f.star === 3 ? '叁' : '贰',
      name: `${f.star}★ 升星`,
      desc: `绝技 Lv${f.star} + 面板 ${f.star === 3 ? '+10%' : '+5%'}（气血/攻击）${f.star === 3 ? '· 三合一少上 1 人' : ''}`,
      tone: 'gold',
    })
  }
  if (f.atkMult < 1) m.push({ ch: '掣', name: '掣肘', desc: '攻击 −20%（对方盲盖的策略卡命中了此位）', tone: 'cinnabar' })
  if (f.atkMult > 1) m.push({ ch: '叫', name: '叫阵', desc: '攻击 +50%（己方盖的策略卡）', tone: 'gold' })
  if (f.dmgTakenMult < 1) m.push({ ch: '药', name: '金疮药', desc: '本大局受伤 −40%', tone: 'gold' })
  if (f.reflect) m.push({ ch: '反', name: '反伤甲', desc: `本大局反弹所受伤害的 ${Math.round(f.reflectPct * 100)}%`, tone: 'ink' })
  if (f.boost) m.push({ ch: '鼓', name: '鼓舞', desc: '下次攻击 +50%（跟随本人，换位不解）', tone: 'gold' })
  if (f.judgeCards.includes('神机妙算')) m.push({ ch: '神', name: '神机妙算', desc: '本大局神妙率 +5%', tone: 'gold' })
  if (f.judgeCards.includes('乘势')) m.push({ ch: '乘', name: '乘势', desc: '打出致命/神妙时追击一次普攻', tone: 'gold' })
  if (f.judgeCards.includes('稳军')) m.push({ ch: '稳', name: '稳军', desc: '本大局免擦碰', tone: 'ink' })
  if (f.judgeCards.includes('孤注')) m.push({ ch: '孤', name: '孤注', desc: '擦碰伤害 +50%', tone: 'cinnabar' })
  if (f.forcedBy !== null) m.push({ ch: '嘲', name: '被嘲讽', desc: '下次普攻被强制改打嘲讽者', tone: 'cinnabar' })
  return m
}

export function FighterCard({
  f, slot, side, selected, selectable, onClick, floats,
}: {
  f: Fighter; slot: number; side: 0 | 1
  selected?: boolean; selectable?: boolean; onClick?: () => void
  floats?: DmgFloat[]
}) {
  const d = ROSTER[f.char]
  const hpPct = Math.max(0, f.hp / f.maxhp) * 100
  const marks = fighterMarks(f)
  return (
    <div
      onClick={selectable ? onClick : undefined}
      className="fighter-card paper-panel px-2 py-2 text-center relative transition-all min-w-0"
      style={{
        opacity: f.alive ? 1 : 0.35,
        cursor: selectable ? 'pointer' : 'default',
        outline: selected ? `2px solid ${C.cinnabar}` : 'none',
        filter: f.alive ? undefined : 'grayscale(1)',
      }}
    >
      {/* 伤害飘字：按判定类型分色分大小（神妙金光大字/致命朱砂/命中墨色/擦碰灰小字） */}
      {floats?.map(fl => {
        const heal = fl.dmg < 0
        const cls = heal ? 'dmg-heal' : (KIND_FLOAT_CLASS[fl.kind ?? '命中'] ?? 'dmg-hit')
        return (
          <span key={fl.id} className="absolute left-1/2 top-2 -translate-x-1/2 pointer-events-none" style={{ zIndex: 5 }}>
            <span className={`dmg-float ${cls} tnum block text-center`}>
              {heal ? `+${-fl.dmg}` : `-${fl.dmg}`}
              {!heal && (fl.kind === '神妙' || fl.kind === '致命') && (
                <span className="block font-display" style={{ fontSize: '0.5em', letterSpacing: '0.2em' }}>{fl.kind}</span>
              )}
            </span>
          </span>
        )
      })}
      <div className="text-xs" style={{ color: C.faint }}>{slot + 1}号位</div>
      <div className="font-display text-lg tracking-wider" style={{ textDecoration: f.alive ? 'none' : 'line-through' }}>{d.name}</div>
      <div className="text-xs" style={{ color: C.faint }}>{d.role}</div>
      {/* 血条 */}
      <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(33,29,22,0.15)' }}>
        <div className="h-full bar-fill" style={{ width: `${hpPct}%`, background: hpPct > 40 ? C.ink : C.cinnabar }} />
      </div>
      <div className="text-xs tnum mt-0.5" style={{ color: C.soft }}>{Math.max(0, Math.round(f.hp))}/{f.maxhp}</div>
      {/* 内力 */}
      <div className="flex justify-center gap-0.5 mt-1">
        {[0, 1, 2].map(i => (
          <span key={i} className="w-2 h-2 rounded-full" style={{ background: i < f.mp ? C.gold : 'rgba(33,29,22,0.15)' }} />
        ))}
      </div>
      {/* 状态印记：印章徽章 + tooltip */}
      {marks.length > 0 && (
        <div className="flex justify-center gap-1 mt-1 flex-wrap">
          {marks.map(mk => <SealBadge key={mk.ch} ch={mk.ch} name={mk.name} desc={mk.desc} tone={mk.tone} />)}
        </div>
      )}
      {/* 法器 */}
      {f.arts.length > 0 && (
        <div className="text-xs mt-0.5" style={{ color: C.gold }}>
          {f.arts.map(a => <span key={a} title={ARTIFACTS[a].desc}>「{a}」</span>)}
        </div>
      )}
      {side !== undefined && <span className="hidden">{side}</span>}
    </div>
  )
}

export function Battlefield({
  state, perspective, targetMode, selectedTarget, onPickTarget,
}: {
  state: MatchState
  perspective: 0 | 1 | 'both'      // both = 同屏公开时刻
  targetMode?: 'enemy' | 'ally' | null
  selectedTarget?: number | null
  onPickTarget?: (slot: number) => void
}) {
  const me: 0 | 1 = perspective === 'both' ? 0 : perspective
  const foe = (1 - me) as 0 | 1
  const top = perspective === 'both' ? 1 : foe
  const bottom = me
  const picking = (side: 0 | 1) =>
    targetMode && ((targetMode === 'enemy' && side === foe) || (targetMode === 'ally' && side === bottom))

  // 从上一小轮战报提取受击/受疗飘字（结构化 tSide/tSlot）
  const floatsFor = (side: 0 | 1, slot: number): DmgFloat[] => {
    const log = state.lastLog
    if (!log) return []
    return log.entries
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e.tSide === side && e.tSlot === slot && e.damage !== undefined && e.damage !== 0)
      .map(({ e, i }) => ({ id: `${log.dazhe}-${log.round}-${i}`, dmg: e.damage!, kind: e.kind }))
  }

  const Row = ({ side, label }: { side: 0 | 1; label: string }) => (
    <div>
      <div className="text-xs mb-1" style={{ color: C.faint }}>
        {SIDE_NAME[side]} · {label} · AP <span className="tnum font-bold" style={{ color: C.gold }}>{Math.round(state.sides[side].ap * 10) / 10}</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        {state.sides[side].fighters.map((f, i) => (
          <FighterCard key={f.id} f={f} slot={i} side={side}
            selectable={!!picking(side) && f.alive}
            selected={picking(side) === true && selectedTarget === i && picking(side) === true}
            onClick={() => onPickTarget?.(i)}
            floats={floatsFor(side, i)} />
        ))}
        {state.sides[side].fighters.length === 0 &&
          <div className="col-span-3 text-center text-xs py-4" style={{ color: C.faint }}>尚未布阵</div>}
      </div>
    </div>
  )

  return (
    <div className="space-y-3">
      <Row side={top} label={perspective === 'both' ? '上方' : '对方'} />
      <div className="text-center text-xs tracking-widest" style={{ color: C.faint }}>
        —— 论 剑 台 ——
        <span className="ml-2" style={{ color: C.gold }}>攻击指槽位，换位可扑空</span>
      </div>
      <Row side={bottom} label={perspective === 'both' ? '下方' : '我方'} />
    </div>
  )
}

/** 战报：行动回放——日志条目逐条浮现（CSS stagger，无 JS 定时器） */
export function LogPanel({ log, title }: { log: RoundLog | null; title?: string }) {
  if (!log) return null
  return (
    <div className="paper-panel px-3 py-2">
      <div className="text-xs mb-1 font-display tracking-widest" style={{ color: C.soft }}>
        {title ?? `第 ${log.dazhe} 大局 · 第 ${log.round} 小轮战报`}
      </div>
      {log.entries.length === 0 && <div className="text-xs" style={{ color: C.faint }}>双方按兵不动。</div>}
      <div className="space-y-0.5 text-xs tnum">
        {log.entries.map((e, i) => (
          <div
            key={`${log.dazhe}-${log.round}-${i}`}
            className="log-line"
            style={{ color: C.soft, animationDelay: `${Math.min(i * 0.16, 2)}s` }}
          >
            <span style={{ color: e.side === 0 ? C.cinnabar : C.ink }}>{SIDE_NAME[e.side]}</span>
            {' '}{ROSTER[e.char].name}({e.slot + 1}) {e.action}
            {e.target && <> → {e.target}</>}
            {e.damage !== undefined && e.damage >= 0 && (
              <> <b style={{ color: KIND_COLOR[e.kind ?? '命中'] }}>{e.damage}</b>
                <span style={{ color: KIND_COLOR[e.kind ?? '命中'] }}>（{e.kind}）</span></>
            )}
            {e.damage !== undefined && e.damage < 0 && <> <b style={{ color: C.gold }}>+{-e.damage}</b></>}
            {e.kills && <b style={{ color: C.cinnabar }}> 击倒！</b>}
          </div>
        ))}
      </div>
    </div>
  )
}

/** 翻牌公开：盖牌 → 翻开的双面卡过渡（逐张 stagger） */
export function RevealsPanel({ reveals }: { reveals: string[] }) {
  if (!reveals.length) return null
  return (
    <div className="paper-panel px-3 py-2">
      <div className="text-xs mb-1.5 font-display tracking-widest" style={{ color: C.soft }}>翻牌公开</div>
      <div className="space-y-1.5 text-xs">
        {reveals.map((r, i) => (
          <div key={`${i}-${r}`} className="flip-card">
            <div className="flip-inner" style={{ animationDelay: `${i * 0.22}s` }}>
              {/* 盖牌面 */}
              <div className="flip-face flip-back px-3 py-1.5 text-xs">盖 牌</div>
              {/* 翻开面 */}
              <div className="flip-face flip-front px-3 py-1.5" style={{ color: C.soft, background: 'rgba(166,58,43,0.05)', borderLeft: `2px solid ${C.cinnabar}` }}>
                {r}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** 比分：五局三胜的星标/棋盘点数可视化（先取三子者胜） */
export function ScoreBar({ state }: { state: MatchState }) {
  const need = RULES.winScore
  const Stones = ({ wins, color }: { wins: number; color: string }) => (
    <span className="inline-flex gap-1 ml-1 align-middle">
      {Array.from({ length: need }, (_, i) => (
        <span
          key={`${wins}-${i}`}
          className={i < wins ? 'stone-pop inline-block' : 'inline-block'}
          style={{
            width: 9, height: 9, borderRadius: '50%',
            border: `1px solid ${color}`,
            background: i < wins ? color : 'transparent',
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </span>
  )
  return (
    <div className="flex items-center justify-between paper-panel px-3 py-2">
      <span className="font-display tracking-widest" style={{ color: C.cinnabar }}>
        甲方 {state.score[0]}
        <Stones wins={state.score[0]} color={C.cinnabar} />
      </span>
      <span className="text-xs text-center" style={{ color: C.faint }}>
        第 {state.dazhe} 大局{state.phase === 'orders' ? ` · 第 ${state.round} 小轮` : ''}
        <br />{need} 子取胜 · {RULES.maxDazhe} 局封顶
      </span>
      <span className="font-display tracking-widest" style={{ color: C.ink }}>
        <Stones wins={state.score[1]} color={C.ink} />
        乙方 {state.score[1]}
      </span>
    </div>
  )
}

export function Banner({ text, sub }: { text: string; sub?: string }) {
  return (
    <div className="paper-panel px-4 py-3 text-center">
      {/* key 驱动：text 变化即重播盖章动画 */}
      <div key={text} className="banner-stamp inline-block font-display text-lg tracking-widest">{text}</div>
      {sub && <div className="text-xs mt-1" style={{ color: C.soft }}>{sub}</div>}
    </div>
  )
}
