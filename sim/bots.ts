/**
 * 策略机器人库。机器人只读 clientView（与真人相同的信息集），输出 DraftPick / Order。
 *
 * 策略抽象方式（对应策划案§十一各历史模拟的策略实现）：
 * - 布阵：按「质量分」从 4 张手牌选 3 张（可覆盖质量表实现全肉等流派）；
 * - 盖牌：参数化的策略卡/判定卡/法器方案（每种基础策略可叠加，见 SteadyOpts）；
 * - 行动：集火目标选择（weakest=血最少，同血取威胁最大）+ 绝技闸门（AP 够且有用才放）
 *   + 可选换位（dodgeSwap）/ 读换位（focus='predictSwap'）；
 * - 经济：idleDazhes>0 时前 N 个大局空城攒 AP（idleSaver / bankThrift 的区别仅在盖不盖节流）。
 */
import {
  ROSTER, RULES, type ClientView, type DraftPick, type Order, type CharId,
  type StrategyCard, type StrategyPlay, type JudgeCard, type JudgePlay,
  type ArtifactDraw, type ArtifactId, type Fighter,
} from '../contracts/game'

export interface Bot {
  name: string
  draft(view: ClientView): DraftPick
  orders(view: ClientView): Order[]
}

// ---------- 质量表：布阵选卡的「强度直觉」 ----------
/** 均衡质量表：输出 > 辅助 > 坦克（基线稳打的选卡偏好） */
export const QUALITY_BALANCED: Record<CharId, number> = { 甲: 6, 乙: 6, 己: 4, 戊: 3.5, 丁: 3, 丙: 3 }
/** 全肉质量表：丙丁优先（allTank 流派） */
export const QUALITY_TANK: Record<CharId, number> = { 丙: 6, 丁: 5.5, 甲: 3, 乙: 3, 戊: 2, 己: 2 }

export interface StarPick { picks: number[]; stars: (2 | 3 | undefined)[] }

export interface SteadyOpts {
  name?: string
  quality?: Record<CharId, number>
  /** 每大局盖的策略卡方案（盲盖；返回 null=不盖）。可叠加任意基础策略。picks=本大局已选槽位 */
  strategy?: (view: ClientView, picks: number[]) => StrategyPlay | null
  /** 每大局盖的判定卡方案（0 AP）。可叠加 */
  judge?: (view: ClientView, picks: number[]) => JudgePlay | null
  /** 每大局法器指定方案（1 AP/件）。可叠加 */
  artifacts?: (view: ClientView, picks: number[]) => ArtifactDraw[]
  /** 前 N 个大局空城挂机（idleSaver=2） */
  idleDazhes?: number
  /** 集火模式：weakest=血最少；predictSwap=读换位落点（打对面最壮者所在槽位） */
  focus?: 'weakest' | 'predictSwap'
  /** 每小轮预判集火换位（1 AP，swapDodge） */
  dodgeSwap?: boolean
  /** 绝技闸门：secure=只斩杀/AP富余才放；aggressive=允许透支未来小轮保底抢节奏（先手击杀抹掉对方行动） */
  ultMode?: 'secure' | 'aggressive'
  /** 功能绝技（嘲讽/反伤甲/回春/鼓舞）闸门：reserve=同伤害绝技；always=内力满且 AP 够就放；
   *  round2=只在第 2 小轮放（每大局至多一轮功能绝技，全肉流：用伤害换节奏但不饿死火力） */
  utilityUlt?: 'reserve' | 'always' | 'round2' | 'once'
  /** AP 地板：本大局结束时至少保留这么多 AP（吃利息结存）。挂机/银行流的核心：只花会蒸发的部分 */
  apFloor?: number
  /** 升星合成方案（任务3）：返回 null=本大局不合成 */
  synthesize?: (view: ClientView) => StarPick | null
}

// ---------- 小工具 ----------
const CHARS = Object.keys(ROSTER) as CharId[]

function ownFighters(view: ClientView): Fighter[] {
  return view.sides[view.me].fighters
}
function foeFighters(view: ClientView): Fighter[] {
  return view.sides[1 - view.me].fighters
}

/** 我方存活者对某个敌人每次普攻的期望伤害（判定期望≈1.12 已含在命中/致命分布里，此处取粗值） */
function estHitVs(f: Fighter, foe: Fighter): number {
  const avg = ((f.lo + f.hi) / 2) * f.atkMult
  const res = ROSTER[f.char].typ === 'P' ? foe.resP : foe.resM
  return Math.max(avg - res, 1)
}

/** 集火目标槽位：「血最少/威胁最大」——按击杀所需攻击次数（血 ÷ 我方每次普攻期望伤害）最少者优先，
 *  同次数取攻击威胁最大者。即挑软柿子捏，而不是机械打血条最短或站位最前者 */
export function weakestFoeSlot(view: ClientView): number | null {
  const foes = foeFighters(view)
  const mine = ownFighters(view).filter((f) => f.alive)
  const hitsToKill = (foe: Fighter): number => {
    if (mine.length === 0) return foe.hp
    const perHit = mine.reduce((s, f) => s + estHitVs(f, foe), 0) / mine.length
    return foe.hp / Math.max(perHit, 1)
  }
  let best: number | null = null
  foes.forEach((f, i) => {
    if (!f.alive) return
    if (best === null) { best = i; return }
    const b = foes[best]
    const hk = hitsToKill(f)
    const hb = hitsToKill(b)
    if (hk < hb - 1e-9 || (Math.abs(hk - hb) < 1e-9 && f.lo + f.hi > b.lo + b.hi)) best = i
  })
  return best
}

/** 读换位落点：对面最壮者所在槽位（换位闪避会把残血换到这里） */
function healthiestFoeSlot(view: ClientView): number | null {
  const foes = foeFighters(view)
  let best: number | null = null
  foes.forEach((f, i) => {
    if (f.alive && (best === null || f.hp > foes[best].hp)) best = i
  })
  return best
}

function availApAtDraft(view: ClientView): number {
  const st = view.sides[view.me]
  const rate = st.thrift ? RULES.apCarryThrift : RULES.apCarry
  return Math.min(RULES.apCap, RULES.apPerDazhe + st.apCarry * rate)
}

// ---------- 盖牌方案工厂（可叠加到任意基础策略） ----------

/** 盲盖策略卡。target 语义：enemyRandom=掣肘盲指；allyCarry=叫阵给主C；allyFocus=金疮药保脆皮 */
export function planStrategy(card: StrategyCard): (view: ClientView, picks: number[]) => StrategyPlay | null {
  return (view, picks) => {
    const st = view.sides[view.me]
    switch (card) {
      case '掣肘':
        // 盲指。稳打流按质量降序落位是公开习惯 → 0 号位大概率是对面主 C（对移形阵容会扑空，这是设计好的博弈层）
        return { card, a: 0 }
      case '叫阵': {
        // 给质量最高（主C）槽位
        let best = 0
        picks.forEach((hi, slot) => {
          if ((QUALITY_BALANCED[st.hand[hi]] ?? 0) > (QUALITY_BALANCED[st.hand[picks[best]]] ?? 0)) best = slot
        })
        return { card, a: best }
      }
      case '金疮药': {
        // 保最可能被集火的脆皮（气血上限最低者）
        let best = 0
        picks.forEach((hi, slot) => {
          if (ROSTER[st.hand[hi]].hp < ROSTER[st.hand[picks[best]]].hp) best = slot
        })
        return { card, a: best }
      }
      default:
        return { card } // 拆招/节流/移形（移形由专门策略给参数）
    }
  }
}

/** 盖判定卡到主C槽位 */
export function planJudge(card: JudgeCard): (view: ClientView, picks: number[]) => JudgePlay | null {
  return (view, picks) => {
    const st = view.sides[view.me]
    let best = 0
    picks.forEach((hi, slot) => {
      const a = ROSTER[st.hand[hi]], b = ROSTER[st.hand[picks[best]]]
      if (a.lo + a.hi > b.lo + b.hi) best = slot
    })
    return { card, slot: best }
  }
}

/** 法器指定流：每大局花至多 n 件 AP 给上阵侠客指定法器（适配优先，其次血玉镯/凝神佩） */
export function planArtifacts(perDazhe = 1): (view: ClientView, picks: number[]) => ArtifactDraw[] {
  const PREF: Record<CharId, ArtifactId[]> = {
    甲: ['青钢符', '血玉镯'], 乙: ['灵羽簪', '血玉镯'],
    丙: ['玄甲坠', '血玉镯'], 丁: ['辟魔铃', '血玉镯'],
    戊: ['血玉镯', '辟魔铃'], 己: ['凝神佩', '灵羽簪'],
  }
  return (view, picks) => {
    const st = view.sides[view.me]
    // 按质量从高到低依次武装
    const order = picks
      .map((hi, slot) => ({ char: st.hand[hi], slot }))
      .sort((a, b) => (QUALITY_BALANCED[b.char] ?? 0) - (QUALITY_BALANCED[a.char] ?? 0))
    const draws: ArtifactDraw[] = []
    const reserve = availApAtDraft(view) - RULES.costStrategy // 策略卡之外再盖法器（本方案不与策略卡叠加使用）
    for (const { char } of order) {
      if (draws.length >= perDazhe || draws.length * RULES.costArtifact > reserve - 1e-9) break
      const owned = st.artifacts?.[char] ?? []
      const next = PREF[char].find((a) => !owned.includes(a) && !draws.some((d) => d.char === char && d.artifact === a))
      if (next && owned.length + draws.filter((d) => d.char === char).length < RULES.artifactMaxPerChar) {
        draws.push({ char, artifact: next })
      }
    }
    return draws
  }
}

// ---------- 升星合成方案（任务3） ----------

/** 摸到指定侠客对子/三条时合成：对子→2★，三条→3★（少上1人）。摸不到则退化为普通选 3 张 */
export function planSynthesize(target: CharId, opts?: { anyPair?: boolean }): (view: ClientView) => StarPick | null {
  return (view) => {
    const hand = view.sides[view.me].hand
    const byChar = new Map<CharId, number[]>()
    hand.forEach((c, i) => byChar.set(c, [...(byChar.get(c) ?? []), i]))
    const counts = [...byChar.entries()].filter(([c]) => opts?.anyPair || c === target)
    const triple = counts.find(([, idx]) => idx.length >= 3)
    const pair = counts.find(([, idx]) => idx.length === 2)
    const rest = (exclude: number[]) =>
      hand.map((c, i) => ({ c, i })).filter((x) => !exclude.includes(x.i))
        .sort((a, b) => QUALITY_BALANCED[b.c] - QUALITY_BALANCED[a.c] || a.i - b.i)
    if (triple) {
      const [, idx] = triple
      const other = rest(idx)[0]
      if (!other) return null
      return { picks: [idx[0], other.i], stars: [3, undefined] }
    }
    if (pair) {
      const [, idx] = pair
      const others = rest(idx).slice(0, 2)
      if (others.length < 2) return null
      return { picks: [idx[0], others[0].i, others[1].i], stars: [2, undefined, undefined] }
    }
    return null
  }
}

// ---------- 行动逻辑 ----------

function ultUseful(view: ClientView, slot: number): boolean {
  const f = ownFighters(view)[slot]
  if (!f?.alive || f.mp < RULES.mpMax) return false
  const ult = ROSTER[f.char].ult
  const foes = foeFighters(view)
  switch (ult) {
    case '连珠':
    case '炎爆':
      return weakestFoeSlot(view) !== null
    case '嘲讽':
      return foes.some((x) => x.alive)
    case '反伤甲':
      return !f.reflect && f.hp / f.maxhp > 0.4
    case '回春':
      return ownFighters(view).some((x) => x.alive && x.hp / x.maxhp < 0.65)
    case '鼓舞':
      return ownFighters(view).some((x) => x.alive && x.id !== f.id && x.lo + x.hi > f.lo + f.hi)
    default:
      return false
  }
}

/** 绝技的期望伤害（用于斩杀判断） */
function estUltDmg(view: ClientView, slot: number, target: number): number {
  const f = ownFighters(view)[slot]
  const t = foeFighters(view)[target]
  if (!f || !t) return 0
  const d = ROSTER[f.char]
  const res = d.typ === 'P' ? t.resP : t.resM
  const avg = ((f.lo + f.hi) / 2) * f.atkMult
  const hits = d.ult === '连珠' ? (f.star === 3 ? 4 : f.star === 2 ? 3 : 2) : 1
  const mult = d.ult === '连珠' ? 0.8 : d.ult === '炎爆' ? (f.star === 3 ? 3 : 2.5) : 1
  return Math.max(avg * mult - res, 1) * 1.1 * hits
}

/** 稳打行动：速度顺序；普攻优先保行动密度，绝技只在「斩杀」或「AP 有富余」时放；可选换位闪避 */
function steadyOrders(view: ClientView, opts: SteadyOpts): Order[] {
  const st = view.sides[view.me]
  let ap = st.ap
  const orders: Order[] = []

  // 换位闪避：第 1 小轮不换（省 AP 保火力——换位的收益是废掉对面续火，第 1 小轮自己满血无火可废）；
  // 第 2/3 小轮把将被续火的最残者换去最壮者的槽位（1 AP，行动结算前生效）
  if (opts.dodgeSwap && view.round >= 2 && ap >= RULES.costSwap) {
    const mine = ownFighters(view)
    let weak: number | null = null
    let healthy: number | null = null
    mine.forEach((f, i) => {
      if (!f.alive) return
      // 与攻击方 weakestFoeSlot 同一判定：血最少，同血取威胁最大
      if (weak === null || f.hp < mine[weak].hp || (f.hp === mine[weak].hp && f.lo + f.hi > mine[weak].lo + mine[weak].hi)) weak = i
      if (healthy === null || f.hp > mine[healthy].hp) healthy = i
    })
    if (weak !== null && healthy !== null && weak !== healthy) {
      orders.push({ slot: weak, type: 'swap', targetSlot: healthy })
      ap -= RULES.costSwap
    }
  }

  const target = opts.focus === 'predictSwap' ? (healthiestFoeSlot(view) ?? weakestFoeSlot(view)) : weakestFoeSlot(view)
  if (target === null) return orders
  // 赛点全仓：再输就出局时撤掉 AP 地板搏命
  const floor = view.score[1 - view.me] >= RULES.winScore - 1 ? 0 : (opts.apFloor ?? 0)

  const mine = ownFighters(view)
    .map((f, slot) => ({ f, slot }))
    .filter((x) => x.f.alive)
    .sort((a, b) => ROSTER[b.f.char].spd - ROSTER[a.f.char].spd)

  // 保底：给未来每个小轮的每人留 1 次普攻的 AP（换位流另留每次换位的 AP），超出保底才允许砸绝技
  const futureRounds = RULES.roundsPerDazhe - view.round
  const reserve = futureRounds * mine.length * RULES.costAttack + (opts.dodgeSwap ? futureRounds * RULES.costSwap : 0)
  const aggressive = opts.ultMode === 'aggressive'

  // 'once'：每大局只给第一个功能绝技位放行一次（第 2 小轮），其余老老实实普攻
  const onceSlot =
    opts.utilityUlt === 'once' && view.round === 2
      ? (mine.find((x) => ['嘲讽', '反伤甲', '回春', '鼓舞'].includes(ROSTER[x.f.char].ult))?.slot ?? null)
      : null
  let onceSpent = false

  for (const { f, slot } of mine) {
    const ult = ROSTER[f.char].ult
    const isUtility = ult === '嘲讽' || ult === '反伤甲' || ult === '回春' || ult === '鼓舞'
    const killSecure =
      (ult === '连珠' || ult === '炎爆') &&
      f.mp >= RULES.mpMax &&
      foeFighters(view)[target] &&
      foeFighters(view)[target].hp <= estUltDmg(view, slot, target)
    const gate =
      isUtility && opts.utilityUlt === 'always'
        ? true
        : isUtility && opts.utilityUlt === 'round2'
          ? view.round === 2
          : isUtility && opts.utilityUlt === 'once'
            ? slot === onceSlot && !onceSpent
            : killSecure || ap - RULES.costUlt >= (aggressive ? reserve - mine.length * RULES.costAttack : reserve)
    const canUlt = f.mp >= RULES.mpMax && ap >= RULES.costUlt && ap - RULES.costUlt >= floor && ultUseful(view, slot) && gate
    if (canUlt) {
      if (isUtility) onceSpent = true
      if (ult === '回春' || ult === '反伤甲' || ult === '嘲讽') {
        orders.push({ slot, type: 'ult' })
      } else if (ult === '鼓舞') {
        // 鼓舞给攻击最高的队友（槽位引用，换位跟随本人由引擎改写）
        let best: number | null = null
        ownFighters(view).forEach((x, i) => {
          if (x.alive && x.id !== f.id && (best === null || x.lo + x.hi > ownFighters(view)[best!].lo + ownFighters(view)[best!].hi)) best = i
        })
        if (best === null) continue
        orders.push({ slot, type: 'ult', targetSlot: best })
      } else {
        orders.push({ slot, type: 'ult', targetSlot: target })
      }
      ap -= RULES.costUlt
    } else if (ap >= RULES.costAttack && ap - RULES.costAttack >= Math.max(floor, opts.dodgeSwap ? futureRounds * RULES.costSwap : 0)) {
      orders.push({ slot, type: 'attack', targetSlot: target })
      ap -= RULES.costAttack
    }
  }
  return orders
}

// ---------- 基础机器人 ----------

/** 通用稳打机器人（所有变体的底座） */
export function steadyFocus(opts: SteadyOpts = {}): Bot {
  const quality = opts.quality ?? QUALITY_BALANCED
  return {
    name: opts.name ?? '稳打·集火残血',
    draft(view) {
      const st = view.sides[view.me]
      // 升星合成优先（任务3）；否则按质量选 3 张
      let picks: number[]
      let stars: (2 | 3 | undefined)[] | undefined
      const syn = opts.synthesize?.(view)
      if (syn) {
        picks = syn.picks
        stars = syn.stars
      } else {
        picks = st.hand
          .map((c, i) => ({ c, i }))
          .sort((a, b) => quality[b.c] - quality[a.c] || a.i - b.i)
          .slice(0, 3)
          .map((x) => x.i)
      }
      const strategy = opts.strategy?.(view, picks) ?? null
      const judge = opts.judge?.(view, picks) ?? null
      const artifacts = opts.artifacts?.(view, picks) ?? []
      return { picks, strategy, judge, artifactDraws: artifacts, stars }
    },
    orders(view) {
      // 空城大局：不给指令攒 AP（挂机合法，不花 AP 就是攒 AP）
      if (opts.idleDazhes && view.dazhe <= opts.idleDazhes) return []
      return steadyOrders(view, opts)
    },
  }
}

/** 2. 挂机攒点流：AP 地板（默认 12 ≈ 每大局只花 8 点、其余全攒吃利息；
 *  第 1 大局自然空城（avail=8<12），之后结存滚大持续压制；被拿到赛点时撤地板全仓搏命。
 *  floor=8 是更凶的变种（d1 空城后每大局花 12）；idleDazhes>0 可强制前 N 大局彻底空城。 */
export function idleSaver(idleDazhes = 0, opts: SteadyOpts = {}): Bot {
  return steadyFocus({ apFloor: 12, ...opts, name: opts.name ?? '挂机攒点', idleDazhes })
}

/** 3. 银行流：AP 地板攒息 + 每大局盖节流（未用 AP 利息 ×2 替代 ×1.5）；赛点全仓 */
export function bankThrift(opts: SteadyOpts = {}): Bot {
  return steadyFocus({
    apFloor: 8,
    ...opts,
    name: opts.name ?? '银行节流',
    strategy: (view) => (view.score[1 - view.me] >= RULES.winScore - 1 ? null : { card: '节流' }),
  })
}

/** 4. 全肉阵容：丙丁优先 */
export function allTank(opts: SteadyOpts = {}): Bot {
  return steadyFocus({ quality: QUALITY_TANK, ...opts, name: opts.name ?? '全肉(丙丁优先)' })
}

/** 5a. 换位闪避：每小轮预判集火换位 */
export function swapDodge(opts: SteadyOpts = {}): Bot {
  return steadyFocus({ ...opts, name: opts.name ?? '换位闪避', dodgeSwap: true })
}

/** 5b. 读换位反打：预判对面换位落点，集火其最壮者槽位 */
export function readSwap(opts: SteadyOpts = {}): Bot {
  return steadyFocus({ ...opts, name: opts.name ?? '读换位反打', focus: 'predictSwap' })
}

export const ALL_CHARS = CHARS
