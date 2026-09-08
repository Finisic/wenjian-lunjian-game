import { useState } from 'react'
import { StoreProvider, useStore } from './game/store'
import Home from './pages/Home'
import Battle from './pages/Battle'
import Gacha from './pages/Gacha'
import Roster from './pages/Roster'
import Guide from './pages/Guide'
import LunjianTab from './pages/lunjian/LunjianTab'
import { SealStamp } from './components/seal'

export type Page = 'home' | 'battle' | 'gacha' | 'roster' | 'guide' | 'lunjian'

const TABS: { key: Page; label: string }[] = [
  { key: 'home', label: '江湖' },
  { key: 'lunjian', label: '论剑' },
  { key: 'gacha', label: '寻侠' },
  { key: 'roster', label: '侠客' },
  { key: 'guide', label: '玩法' },
]

function Shell() {
  const [page, setPage] = useState<Page>('home')
  const { state } = useStore()

  return (
    <div className="min-h-full flex flex-col max-w-3xl mx-auto px-4" style={{ paddingBottom: 'var(--nav-h)' }}>
      {/* 横屏提示 */}
      <div className="landscape-hint">横屏不便论剑 · 建议竖屏体验</div>

      {/* 头部 */}
      <header className="pt-6 pb-4 flex items-end justify-between">
        <div>
          <h1 className="font-display text-4xl tracking-widest flex items-center gap-2">
            问剑 <SealStamp text="问剑" />
          </h1>
          <p className="text-xs mt-1 tracking-wider" style={{ color: 'var(--ink-faint)' }}>
            回合制战斗 × 抽卡养成 · 论剑对战
          </p>
        </div>
        <div className="text-right text-sm tnum" style={{ color: 'var(--ink-soft)' }}>
          <div>玉璧 <span className="font-bold" style={{ color: 'var(--gold)' }}>{state.jade}</span></div>
          <div className="text-xs mt-0.5">经验丹 {state.expPills} · 第 {state.floor} 层</div>
        </div>
      </header>

      {/* 页签切换：淡入过渡（key 驱动重播） */}
      <main className="flex-1">
        <div key={page} className="page-enter">
          {page === 'home' && <Home goBattle={() => setPage('battle')} />}
          {page === 'battle' && <Battle back={() => setPage('home')} />}
          {page === 'lunjian' && <LunjianTab />}
          {page === 'gacha' && <Gacha />}
          {page === 'roster' && <Roster />}
          {page === 'guide' && <Guide />}
        </div>
      </main>

      {/* 底部导航：safe-area 适配 */}
      <nav className="fixed bottom-0 left-0 right-0 border-t backdrop-blur nav-safe"
        style={{ borderColor: 'var(--ink)', background: 'rgba(243,238,224,0.92)' }}>
        <div className="max-w-3xl mx-auto flex">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setPage(t.key)}
              className="flex-1 py-3 min-h-[52px] text-sm font-display tracking-widest relative"
              style={{ color: page === t.key ? 'var(--cinnabar)' : 'var(--ink-soft)' }}>
              {page === t.key && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5"
                  style={{ background: 'var(--cinnabar)' }} />
              )}
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
