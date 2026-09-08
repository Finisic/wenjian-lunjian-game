import { useState } from 'react'

/* ============================================================
   共享 UI：朱砂印章元素
   - SealStamp   落款章（章节标题旁的点缀小印）
   - SectionTitle 带落款章的章节标题
   - SealBadge   状态印记徽章（hover/点按出 tooltip，移动端可点）
   ============================================================ */

export function SealStamp({ text, gold }: { text: string; gold?: boolean }) {
  return <span className={`seal-stamp${gold ? ' gold' : ''}`} aria-hidden>{text}</span>
}

export function SectionTitle({
  title, seal, gold, right, icon,
}: {
  title: string
  seal?: string          // 落款章文字（1~2 字为宜），不传则不盖
  gold?: boolean
  right?: React.ReactNode
  icon?: React.ReactNode // 标题前的小图标
}) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      {icon}
      <span className="font-display tracking-widest text-sm" style={{ color: gold ? 'var(--gold)' : 'var(--cinnabar)' }}>
        {title}
      </span>
      {seal && <SealStamp text={seal} gold={gold} />}
      {right && <span className="ml-auto">{right}</span>}
    </div>
  )
}

export type SealTone = 'cinnabar' | 'gold' | 'ink' | 'faint'

const TONE_COLOR: Record<SealTone, string> = {
  cinnabar: 'var(--cinnabar)',
  gold: 'var(--gold)',
  ink: 'var(--ink)',
  faint: 'var(--ink-faint)',
}

/** 印章式状态印记：实心小方章，悬停/点按出说明 */
export function SealBadge({
  ch, name, desc, tone = 'cinnabar',
}: {
  ch: string        // 章面单字
  name: string      // 印记名（tooltip 首行）
  desc: string      // 效果说明
  tone?: SealTone
}) {
  const [on, setOn] = useState(false)
  const color = TONE_COLOR[tone]
  return (
    <button
      type="button"
      className={`seal-badge${on ? ' tip-on' : ''}`}
      style={{ color, background: 'color-mix(in srgb, currentColor 10%, transparent)' }}
      data-tip={`【${name}】\n${desc}`}
      aria-label={`${name}：${desc}`}
      onClick={e => { e.stopPropagation(); setOn(v => !v) }}
      onBlur={() => setOn(false)}
    >
      {ch}
    </button>
  )
}
