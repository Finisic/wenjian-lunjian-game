import { useState } from 'react'
import { SealStamp } from './seal'

/* ============================================================
   新手入门引导：分步高亮的交互式「三句话」
   上一步/下一步推进，当前步骤朱砂描边高亮，圆点显示进度。
   ============================================================ */

export interface GuideStep {
  title: string
  body: string
  seal: string
}

export default function GuideSteps({ steps }: { steps: GuideStep[] }) {
  const [idx, setIdx] = useState(0)
  const [toured, setToured] = useState(false) // 走过一遍后全部展开
  const cur = steps[idx]

  return (
    <div>
      {/* 进度圆点 */}
      <div className="flex items-center gap-2 mb-2">
        {steps.map((s, i) => (
          <button
            key={i}
            type="button"
            aria-label={`第 ${i + 1} 步：${s.title}`}
            onClick={() => setIdx(i)}
            className="w-11 h-11 inline-flex items-center justify-center"
          >
            <span
              className="rounded-full transition-all"
              style={{
                width: i === idx ? 10 : 7,
                height: i === idx ? 10 : 7,
                background: i === idx ? 'var(--cinnabar)' : 'rgba(33,29,22,0.2)',
                display: 'block',
              }}
            />
          </button>
        ))}
        <span className="text-xs tnum ml-auto" style={{ color: 'var(--ink-faint)' }}>
          {idx + 1} / {steps.length}
        </span>
      </div>

      {/* 当前步骤（高亮） */}
      <div key={idx} className="guide-active rise-in px-3 py-2.5 rounded-sm" style={{ background: 'rgba(166,58,43,0.045)' }}>
        <div className="flex items-center gap-2">
          <SealStamp text={cur.seal} />
          <span className="font-display text-sm tracking-widest" style={{ color: 'var(--ink)' }}>{cur.title}</span>
        </div>
        <p className="text-xs leading-5 mt-1.5" style={{ color: 'var(--ink-soft)' }}>{cur.body}</p>
      </div>

      {/* 其余步骤（缩略，可点跳） */}
      <div className="mt-2 space-y-1">
        {steps.map((s, i) => i !== idx && (
          <button
            key={i}
            type="button"
            onClick={() => setIdx(i)}
            className="w-full text-left text-xs px-3 py-1.5 flex items-center gap-2 min-h-[44px]"
            style={{ color: 'var(--ink-faint)' }}
          >
            <span className="font-display" style={{ color: 'var(--ink-soft)' }}>{s.title}</span>
            {toured && <span className="truncate">—— {s.body}</span>}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mt-2">
        <button
          type="button"
          className="btn-ink text-xs px-4 py-1.5"
          disabled={idx === 0}
          onClick={() => setIdx(i => Math.max(0, i - 1))}
        >
          上一步
        </button>
        {idx < steps.length - 1 ? (
          <button type="button" className="btn-cinnabar text-xs px-4 py-1.5" onClick={() => setIdx(i => i + 1)}>
            下一步
          </button>
        ) : (
          <button type="button" className="btn-cinnabar text-xs px-4 py-1.5" onClick={() => { setToured(true); setIdx(0) }}>
            温习一遍
          </button>
        )}
      </div>
    </div>
  )
}
