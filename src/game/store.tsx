// ============ 全局状态（localStorage 存档） ============
import { createContext, useContext, useEffect, useReducer } from 'react'
import type { ReactNode } from 'react'
import type { EventId, SaveData } from './types'
import { INITIAL_SAVE, PVE_EVENTS, floorReward, expNeed, LEVEL_CAP, EXP_PILL_VALUE, GACHA } from './config'

const KEY = 'wenjian_save_v1'

const initial: SaveData = {
  heroes: [{ heroId: 'liu_qing', level: 1, star: 1, exp: 0 }],
  team: ['liu_qing'],
  floor: 1,
  jade: INITIAL_SAVE.jade,
  expPills: INITIAL_SAVE.expPills,
  pullsSince5: 0,
  pullsSince4: 0,
  totalPulls: 0,
  fiveStars: 0,
  pendingEvent: false,
  eventBuff: null,
}

type Action =
  | { type: 'LOAD'; data: SaveData }
  | { type: 'PULL_DONE'; heroId: string; newP5: number; newP4: number; rarity: number }
  | { type: 'WIN_FLOOR' }
  | { type: 'LEVEL_UP'; heroId: string }
  | { type: 'SET_TEAM'; team: string[] }
  | { type: 'EVENT_PICK'; eventId: EventId }
  | { type: 'RESET' }

function reducer(s: SaveData, a: Action): SaveData {
  switch (a.type) {
    case 'LOAD': return { ...initial, ...a.data } // 旧存档缺省字段自动补默认
    case 'RESET': return initial
    case 'PULL_DONE': {
      const owned = s.heroes.find(h => h.heroId === a.heroId)
      const heroes = owned
        ? s.heroes.map(h => h.heroId === a.heroId ? { ...h, star: Math.min(5, h.star + 1) } : h)
        : [...s.heroes, { heroId: a.heroId, level: 1, star: 1, exp: 0 }]
      return {
        ...s,
        heroes,
        jade: Math.max(0, s.jade - GACHA.costPerPull),
        pullsSince5: a.newP5,
        pullsSince4: a.newP4,
        totalPulls: s.totalPulls + 1,
        fiveStars: s.fiveStars + (a.rarity === 5 ? 1 : 0),
      }
    }
    case 'WIN_FLOOR': {
      const r = floorReward(s.floor)
      // 每通关 triggerEvery 层触发一次奇遇抉择；本层奇遇 buff 通关后结算清除
      const pendingEvent = s.floor % PVE_EVENTS.triggerEvery === 0
      return {
        ...s,
        floor: s.floor + 1,
        jade: s.jade + r.jade,
        expPills: s.expPills + r.expPills,
        eventBuff: null,
        pendingEvent,
      }
    }
    case 'EVENT_PICK': {
      const c = PVE_EVENTS.choices.find(x => x.id === a.eventId)
      if (!c || !s.pendingEvent) return s
      return {
        ...s,
        pendingEvent: false,
        jade: s.jade + (c.jade ?? 0),
        expPills: s.expPills + (c.expPills ?? 0),
        eventBuff: { id: c.id, floor: s.floor }, // 本层生效，通关后清除
      }
    }
    case 'LEVEL_UP': {
      const h = s.heroes.find(x => x.heroId === a.heroId)
      if (!h || h.level >= LEVEL_CAP || s.expPills === 0) return s
      let { exp, level } = h
      let pills = s.expPills
      // 经验丹逐颗消耗（100经验/颗），一键升到丹药能支撑的最高级
      while (pills > 0 && level < LEVEL_CAP) {
        pills--
        exp += EXP_PILL_VALUE
        while (level < LEVEL_CAP && exp >= expNeed(level)) {
          exp -= expNeed(level)
          level++
        }
      }
      return {
        ...s,
        expPills: pills,
        heroes: s.heroes.map(x => x.heroId === a.heroId ? { ...x, level, exp } : x),
      }
    }
    case 'SET_TEAM': return { ...s, team: a.team }
    default: return s
  }
}

const Ctx = createContext<{ state: SaveData; dispatch: React.Dispatch<Action> }>({
  state: initial, dispatch: () => {},
})

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) dispatch({ type: 'LOAD', data: JSON.parse(raw) })
    } catch { /* 存档损坏则用初始 */ }
  }, [])
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state))
  }, [state])
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>
}

export const useStore = () => useContext(Ctx)
