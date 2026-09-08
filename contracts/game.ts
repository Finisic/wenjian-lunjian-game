/**
 * 代号：问剑 · 论剑模式 — 规则引擎（前后端共用，纯 JSON 状态 + 纯函数）
 * 论剑模式 v2.4 定稿规则 + v3.1 卡牌库/法器实装。
 * 服务器权威：联网对战中全部判定在服务端执行，客户端只提交意图。
 */

// ---------- 面板（v2.4 §六） ----------
export type CharId = '甲' | '乙' | '丙' | '丁' | '戊' | '己'

export interface CharDef {
  name: string                  // 侠客名（显示用；CharId 仅作内部键）
  lo: number; hi: number; typ: 'P' | 'M'
  hp: number; resP: number; resM: number; spd: number
  prec: number; crit: number; ins: number
  ult: string; role: string
}

export const ROSTER: Record<CharId, CharDef> = {
  甲: { name: '燕惊鸿', lo: 150, hi: 225, typ: 'P', hp: 1000, resP: 35, resM: 35, spd: 115, prec: .95, crit: .25, ins: .05, ult: '连珠', role: '物理输出' },
  乙: { name: '祝红莲', lo: 150, hi: 225, typ: 'M', hp: 850,  resP: 30, resM: 50, spd: 100, prec: .95, crit: .15, ins: .15, ult: '炎爆', role: '法术输出' },
  丙: { name: '铁山河', lo: 135, hi: 203, typ: 'P', hp: 1300, resP: 90, resM: 35, spd: 90,  prec: .95, crit: .15, ins: .05, ult: '嘲讽', role: '物理坦克' },
  丁: { name: '玄镜',   lo: 135, hi: 203, typ: 'P', hp: 1300, resP: 35, resM: 90, spd: 90,  prec: .95, crit: .15, ins: .05, ult: '反伤甲', role: '魔法坦克' },
  戊: { name: '沈青囊', lo: 100, hi: 180, typ: 'M', hp: 1000, resP: 50, resM: 50, spd: 100, prec: .95, crit: .15, ins: .05, ult: '回春', role: '奶妈' },
  己: { name: '萧战歌', lo: 100, hi: 180, typ: 'M', hp: 1000, resP: 50, resM: 50, spd: 105, prec: .95, crit: .15, ins: .05, ult: '鼓舞', role: '增益辅助' },
}

export const RULES = {
  apPerDazhe: 8, apCarry: 1.5, apCarryThrift: 2, apCap: 20,
  costAttack: 1, costUlt: 3, costSwap: 1,
  costStrategy: 1, costJudge: 0, costArtifact: 1,
  shenjiBonus: 0.05, chezhouCut: 0.2, jinchuangCut: 0.4, jiaozhenBoost: 0.5, guzhuBoost: 0.5,
  roundsPerDazhe: 3, winScore: 3, maxDazhe: 9,
  mpMax: 3, mpPerAttack: 3,
  artifactMaxPerChar: 2, artifactStatBonus: 0.2, artifactHalfBonus: 0.1,
} as const

/**
 * 升星·绝技强化（v3.2 正式实装：布阵不传 stars 即与 v3.1 完全一致）。
 * 布阵摸 4 张出现对子/三条时可合成：2★=绝技 Lv2+面板+5%（仍上 3 人）；
 * 3★=绝技 Lv3+面板+10%（少上 1 人，只上 2 人）。面板加成作用于气血与攻击。
 * 数值集中在此便于模拟器扫描调参。
 */
export const STAR_RULES = {
  panel2: 0.05, panel3: 0.1,          // 面板加成（气血/攻击）
  // 甲·连珠：Lv1 两段×0.8 → Lv2 三段×0.85 → Lv3 四段×0.85
  lianzhuHits2: 3, lianzhuHits3: 4, lianzhuMult: 0.8, lianzhuMult2: 0.85, lianzhuMult3: 0.85,
  // 乙·炎爆：Lv1 2.5×单体 → Lv2 2.5×+溅射1.25× → Lv3 3.0×+溅射1.5×
  yanbaoMain2: 2.5, yanbaoSplash2: 1.25, yanbaoMain3: 3.0, yanbaoSplash3: 1.5,
  // 丙·嘲讽：Lv1 锁攻击最高1人 → Lv2 锁2人 → Lv3 锁全体
  tauntTargets2: 2, tauntTargets3: 3,
  // 丁·反伤甲：Lv1 反弹20% → Lv2 反弹20%+自疗15%上限 → Lv3 反弹30%+自疗25%上限
  reflect2: 0.2, reflectHeal2: 0.15, reflect3: 0.3, reflectHeal3: 0.25,
  // 戊·回春：Lv1 最低者30% → Lv2 全体20% → Lv3 全体30%
  heal2: 0.2, heal3: 0.3,
  // 己·鼓舞：Lv1 单人+50% → Lv2 双人+50% → Lv3 全队+50%
  inspireTargets2: 2, inspireTargets3: 3,
}

// ---------- 策略卡 / 判定卡 / 法器（v3.1 实装） ----------
export type StrategyCard = '拆招' | '节流' | '掣肘' | '金疮药' | '叫阵' | '移形'
export type JudgeCard = '乘势' | '稳军' | '孤注' | '神机妙算'
export type ArtifactId = '青钢符' | '灵羽簪' | '玄甲坠' | '辟魔铃' | '血玉镯' | '凝神佩'

/** needsTarget: enemy=盲指敌槽 ally=己方一槽 ally2=己方两槽 null=无需目标 */
export const STRATEGY_CARDS: Record<StrategyCard, { cat: string; desc: string; needsTarget: 'enemy' | 'ally' | 'ally2' | null }> = {
  拆招:   { cat: '反制', desc: '盲盖：抵消对方本大局策略卡；对方未出则白盖', needsTarget: null },
  节流:   { cat: '经济', desc: '本大局未用 AP 利息 ×2（替代 ×1.5）', needsTarget: null },
  掣肘:   { cat: '封锁', desc: '盲指对方一个位置：该人物本大局攻击 −20%', needsTarget: 'enemy' },
  金疮药: { cat: '防御', desc: '指定己方人物：本大局受伤 −40%', needsTarget: 'ally' },
  叫阵:   { cat: '进攻', desc: '指定己方人物：本大局攻击 +50%', needsTarget: 'ally' },
  移形:   { cat: '机动', desc: '布阵时交换己方两个位置（可令掣肘盲指扑空）', needsTarget: 'ally2' },
}

export const JUDGE_CARDS: Record<JudgeCard, { desc: string }> = {
  乘势:     { desc: '打出致命或神妙时，额外追击一次普攻（追击不加内力、不再触发乘势）' },
  稳军:     { desc: '该侠客本大局免擦碰' },
  孤注:     { desc: '该侠客擦碰伤害 +50%' },
  神机妙算: { desc: '该侠客本大局神妙率 +5%' },
}

export const ARTIFACTS: Record<ArtifactId, { desc: string }> = {
  青钢符: { desc: '物攻 +20%（法术侠客佩戴减半）' },
  灵羽簪: { desc: '魔攻 +20%（物理侠客佩戴减半）' },
  玄甲坠: { desc: '物抗 +20%' },
  辟魔铃: { desc: '魔抗 +20%' },
  血玉镯: { desc: '气血上限 +20%' },
  凝神佩: { desc: '上场即满内力' },
}
export const ARTIFACT_IDS = Object.keys(ARTIFACTS) as ArtifactId[]

export interface StrategyPlay { card: StrategyCard; a?: number; b?: number }
export interface JudgePlay { card: JudgeCard; slot: number }
export interface ArtifactDraw { char: CharId; artifact: ArtifactId }  // 指定一件（1 AP），挂给该侠客

export type HitKind = '神妙' | '致命' | '命中' | '擦碰'

export interface Fighter {
  id: number // 固定编号(换位/移形不改变),指令与嘲讽跟随侠客本人
  char: CharId
  hp: number; maxhp: number; mp: number
  alive: boolean
  lo: number; hi: number          // 攻击区间（含法器加成）
  resP: number; resM: number      // 双抗（含法器加成）
  ins: number                     // 神妙率（含神机妙算加成）
  atkMult: number                 // 攻击乘区（掣肘 0.8 / 叫阵 1.5）
  dmgTakenMult: number            // 受伤乘区（金疮药 0.6）
  reflect: boolean                // 反伤甲
  reflectPct: number              // 反伤比例（升星可提升）
  boost: boolean                  // 鼓舞标记
  forcedBy: number | null         // 被嘲讽：强制攻击对方该侠客（fighter.id，换位仍跟随本人）
  judgeCards: JudgeCard[]         // 本大局绑定的判定卡
  arts: ArtifactId[]              // 佩戴的法器（跨大局）
  star: 1 | 2 | 3                 // 升星（合成）：绝技 Lv2/Lv3 + 面板加成
}

export interface Order {
  slot: number                       // 己方槽位
  type: 'attack' | 'ult' | 'idle' | 'swap' // swap：与 targetSlot 交换位置（1 AP，行动结算前生效）
  targetSlot?: number                // 敌方槽位（鼓舞时为己方槽位；swap 时为己方另一槽位）
}

export interface SideState {
  ap: number
  apCarry: number                    // 上大局结存基数
  hand: CharId[]                     // 布阵摸到的 4 张
  picks: number[] | null             // 已选的 3 个手牌下标（有序=槽位）
  fighters: Fighter[]
  strategy: StrategyPlay | null      // 本大局盖的策略卡（翻牌后公开）
  judge: JudgePlay | null            // 本大局盖的判定卡
  thrift: boolean                    // 节流生效中（本大局利息 ×2）
  artifacts: Partial<Record<CharId, ArtifactId[]>>  // 法器培养线（跨大局持续）
  orders: Order[] | null             // 本小轮已提交指令
}

export interface LogEntry {
  side: 0 | 1; slot: number; char: CharId
  action: string
  target?: string
  tSide?: 0 | 1; tSlot?: number      // 结构化受击方（前端飘字用）
  damage?: number; kind?: HitKind
  kills?: boolean
}

export interface RoundLog {
  dazhe: number; round: number
  entries: LogEntry[]
}

export interface DazheSummary {
  dazhe: number
  winner: 0 | 1 | null               // null = 平轮
  reason: string
  alive: [number, number]
  dmg: [number, number]
}

export interface MatchState {
  phase: 'waiting' | 'draft' | 'orders' | 'dazheResult' | 'matchEnd'
  dazhe: number                      // 1-based
  round: number                      // 1..3（phase==='orders' 时有效）
  score: [number, number]
  sides: [SideState, SideState]
  dmg: [number, number]              // 本大局伤害量（层级结算次标准）
  reveals: string[]                  // 翻牌公开信息（双方盖的策略卡/判定卡/法器）
  lastLog: RoundLog | null
  summary: DazheSummary | null
  winner: 0 | 1 | null
  note: string                       // 给前端的提示语
}

// ---------- 内部工具 ----------
const CHARS = Object.keys(ROSTER) as CharId[]

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function makeFighter(char: CharId, id: number, arts: ArtifactId[] = [], star: 1 | 2 | 3 = 1): Fighter {
  const d = ROSTER[char]
  let lo = d.lo, hi = d.hi, resP = d.resP, resM = d.resM, hp = d.hp, mp = 0
  const pm = 1 + (star === 2 ? STAR_RULES.panel2 : star === 3 ? STAR_RULES.panel3 : 0)
  lo *= pm; hi *= pm; hp *= pm                                   // 升星面板：气血/攻击
  for (const a of arts) {
    if (a === '青钢符') { const m = 1 + (d.typ === 'P' ? RULES.artifactStatBonus : RULES.artifactHalfBonus); lo *= m; hi *= m }
    else if (a === '灵羽簪') { const m = 1 + (d.typ === 'M' ? RULES.artifactStatBonus : RULES.artifactHalfBonus); lo *= m; hi *= m }
    else if (a === '玄甲坠') resP *= 1 + RULES.artifactStatBonus
    else if (a === '辟魔铃') resM *= 1 + RULES.artifactStatBonus
    else if (a === '血玉镯') hp *= 1 + RULES.artifactStatBonus
    else if (a === '凝神佩') mp = RULES.mpMax
  }
  lo = Math.round(lo); hi = Math.round(hi); resP = Math.round(resP); resM = Math.round(resM); hp = Math.round(hp)
  return {
    id, char, hp, maxhp: hp, mp, alive: true,
    lo, hi, resP, resM,
    ins: d.ins, atkMult: 1, dmgTakenMult: 1,
    reflect: false, reflectPct: 0.2, boost: false, forcedBy: null,
    judgeCards: [], arts: [...arts],
    star,
  }
}

function blankSide(): SideState {
  return {
    ap: 0, apCarry: 0, hand: [], picks: null, fighters: [],
    strategy: null, judge: null, thrift: false, artifacts: {}, orders: null,
  }
}

// ---------- 对局生命周期 ----------
export function newMatch(): MatchState {
  const s: MatchState = {
    phase: 'draft', dazhe: 1, round: 1, score: [0, 0],
    sides: [blankSide(), blankSide()],
    dmg: [0, 0], reveals: [], lastLog: null, summary: null, winner: null,
    note: '第一大局 · 布阵阶段',
  }
  drawHands(s)
  return s
}

/** 公共池 18 张（每侠客×3），双方各摸 4 张（不放回） */
function drawHands(s: MatchState) {
  const pool = shuffled(CHARS.flatMap((c) => [c, c, c] as CharId[]))
  s.sides[0].hand = pool.slice(0, 4)
  s.sides[1].hand = pool.slice(4, 8)
}

export interface DraftPick {
  picks: number[]                   // 3 个手牌下标（若合成 3★ 少上 1 人则为 2 个）
  strategy: StrategyPlay | null     // 策略卡（1 AP，每大局限 1 张，盲盖）
  judge: JudgePlay | null           // 判定卡（0 AP，盖在人物卡下）
  artifactDraws: ArtifactDraw[]     // 法器抽取（1 AP/次，跨大局培养）
  stars?: (2 | 3 | undefined)[]     // 升星合成（可选，与 picks 平行）：2★消耗手牌 2 张同名，3★消耗 3 张且只上 2 人
}

function draftCost(d: DraftPick): number {
  return (d.strategy ? RULES.costStrategy : 0) + d.artifactDraws.length * RULES.costArtifact
}

function availAp(st: SideState): number {
  // 节流：上大局盖了节流 → 本次结存利息 ×2（消费后失效）
  const rate = st.thrift ? RULES.apCarryThrift : RULES.apCarry
  return Math.min(RULES.apCap, RULES.apPerDazhe + st.apCarry * rate)
}

export function validateDraft(s: MatchState, side: 0 | 1, d: DraftPick): string | null {
  const st = s.sides[side]
  if (s.phase !== 'draft') return '当前不在布阵阶段'
  if (st.picks) return '已提交过布阵'
  const hasStar3 = Array.isArray(d.stars) && d.stars.includes(3)
  const needPicks = hasStar3 ? 2 : 3                     // 3★ 三合一：少上 1 人
  if (!Array.isArray(d.picks) || d.picks.length !== needPicks) return `必须选 ${needPicks} 张`
  if (new Set(d.picks).size !== d.picks.length) return '不能重复选择'
  if (d.picks.some((i) => !Number.isInteger(i) || i < 0 || i >= st.hand.length)) return '无效的手牌下标'
  // 升星合成校验：stars 与 picks 平行；每个上阵位消耗 1 张手牌，2★/3★ 额外消耗 1/2 张同名材料
  if (d.stars !== undefined) {
    if (!Array.isArray(d.stars) || d.stars.length !== d.picks.length) return '升星标记与上场数不一致'
    const usage: Partial<Record<CharId, number>> = {}
    for (let k = 0; k < d.picks.length; k++) {
      const star = d.stars[k]
      if (star !== undefined && star !== 2 && star !== 3) return '升星标记只能为 2 或 3'
      const c = st.hand[d.picks[k]]
      usage[c] = (usage[c] ?? 0) + (star ?? 1)
    }
    for (const c of Object.keys(usage) as CharId[]) {
      if ((usage[c] ?? 0) > st.hand.filter((x) => x === c).length) return `手牌没有足够的「${ROSTER[c].name}」用于合成`
    }
  }
  const pickedChars = d.picks.map((i) => st.hand[i])
  // 槽位上限跟实际上阵人数走：3★ 后本方只有 2 个槽位，避免 lockDraft 访问 undefined
  const ownSlots = d.picks.length
  const foeSlots = s.sides[1 - side].picks?.length ?? 3   // 对方已盖阵则按其上阵数，否则按满编
  // 策略卡
  if (d.strategy) {
    const def = STRATEGY_CARDS[d.strategy.card]
    if (!def) return '未知的策略卡'
    const { a, b } = d.strategy
    const okSlot = (x: number | undefined, max: number) =>
      x !== undefined && Number.isInteger(x) && x >= 0 && x <= max
    if (def.needsTarget === 'enemy' && !okSlot(a, foeSlots - 1)) return '掣肘需要盲指对方一个位置'
    if (def.needsTarget === 'ally' && !okSlot(a, ownSlots - 1)) return `${d.strategy.card}需要指定己方一个位置`
    if (def.needsTarget === 'ally2' && (!okSlot(a, ownSlots - 1) || !okSlot(b, ownSlots - 1) || a === b)) return '移形需要指定己方两个不同位置'
  }
  // 判定卡
  if (d.judge) {
    if (!JUDGE_CARDS[d.judge.card]) return '未知的判定卡'
    if (!Number.isInteger(d.judge.slot) || d.judge.slot < 0 || d.judge.slot > ownSlots - 1) return '判定卡槽位无效'
  }
  // 法器指定
  if (!Array.isArray(d.artifactDraws)) return '法器格式无效'
  const arts = st.artifacts ?? {}
  const drawCount: Partial<Record<CharId, number>> = {}
  for (const dr of d.artifactDraws) {
    if (!ARTIFACTS[dr.artifact]) return '未知的法器'
    if (!pickedChars.includes(dr.char)) return '法器只能挂给本大局上阵的侠客'
    drawCount[dr.char] = (drawCount[dr.char] ?? 0) + 1
    if ((arts[dr.char]?.length ?? 0) + (drawCount[dr.char] ?? 0) > RULES.artifactMaxPerChar)
      return `${ROSTER[dr.char].name}最多佩戴 ${RULES.artifactMaxPerChar} 件法器`
    if ((arts[dr.char] ?? []).includes(dr.artifact)) return `${ROSTER[dr.char].name}已有「${dr.artifact}」，同件不重复佩戴`
    const pendingSame = d.artifactDraws.filter((x) => x !== dr && x.char === dr.char && x.artifact === dr.artifact)
    if (pendingSame.length > 0) return '同一件法器不能重复指定'
  }
  if (draftCost(d) > availAp(st) + 1e-9) return 'AP 不足，盖不起这些牌'
  return null
}

export function submitDraft(s: MatchState, side: 0 | 1, d: DraftPick): void {
  const st = s.sides[side]
  st.picks = d.picks
  // 暂存选择，双方齐了一并生效（盲盖）
  ;(st as any)._strategy = d.strategy
  ;(st as any)._judge = d.judge
  ;(st as any)._draws = d.artifactDraws
  ;(st as any)._stars = d.stars
  if (s.sides[0].picks && s.sides[1].picks) lockDraft(s)
}

function lockDraft(s: MatchState) {
  const reveals: string[] = []
  // 0) 结存 AP 先按上大局节流状态落袋，随后消费掉旧节流标记（本大局新盖的节流留给下大局）
  const carryAp: [number, number] = [availAp(s.sides[0]), availAp(s.sides[1])]
  s.sides[0].thrift = false
  s.sides[1].thrift = false
  // 1) 指定法器，落进培养线
  for (const i of [0, 1] as const) {
    const st = s.sides[i]
    st.artifacts ??= {}
    const draws = ((st as any)._draws ?? []) as ArtifactDraw[]
    for (const dr of draws) {
      ;(st.artifacts[dr.char] ??= []).push(dr.artifact)
      reveals.push(`${SIDE_NAME[i]} 求得法器「${dr.artifact}」→ ${ROSTER[dr.char].name}`)
    }
  }
  // 2) 上阵（法器加成随人物落地）
  for (const i of [0, 1] as const) {
    const st = s.sides[i]
    const stars = ((st as any)._stars ?? []) as (2 | 3 | undefined)[]
    st.fighters = st.picks!.map((hi, idx) => makeFighter(st.hand[hi], idx, st.artifacts![st.hand[hi]] ?? [], stars[idx] ?? 1))
    for (let idx = 0; idx < st.fighters.length; idx++) {
      const star = stars[idx] ?? 1
      if (star > 1) reveals.push(`${SIDE_NAME[i]} 合成 ${star}★「${ROSTER[st.fighters[idx].char].name}」（绝技Lv${star}）`)
    }
  }
  // 3) 移形先行（双方同时）：交换己方两个位置——可令对方掣肘盲指扑空
  for (const i of [0, 1] as const) {
    const st = s.sides[i]
    const play = (st as any)._strategy as StrategyPlay | null
    if (play?.card === '移形' && play.a !== undefined && play.b !== undefined
      && st.fighters[play.a] && st.fighters[play.b]) {
      ;[st.fighters[play.a], st.fighters[play.b]] = [st.fighters[play.b], st.fighters[play.a]]
    }
  }
  // 4) 拆招对消：对方盖了拆招 → 我的策略卡（非拆招）被抵消；双方都拆招则互相白盖
  const plays: (StrategyPlay | null)[] = [(s.sides[0] as any)._strategy, (s.sides[1] as any)._strategy]
  const negated = [plays[1]?.card === '拆招', plays[0]?.card === '拆招']
  for (const i of [0, 1] as const) {
    const st = s.sides[i]
    const play = plays[i]
    if (!play) continue
    const targetDesc = (p: StrategyPlay) =>
      p.card === '掣肘' ? ` → 对方${(p.a! + 1)}号位`
      : p.card === '移形' ? `：${(p.a! + 1)}号位 ↔ ${(p.b! + 1)}号位`
      : p.a !== undefined ? ` → 己方${(p.a + 1)}号位` : ''
    if (negated[i] && play.card !== '拆招') {
      reveals.push(`${SIDE_NAME[i]} 策略卡「${play.card}」被「拆招」抵消！`)
      continue
    }
    reveals.push(`${SIDE_NAME[i]} 策略卡「${play.card}」${targetDesc(play)}`)
    st.strategy = play
    if (play.card === '节流') st.thrift = true
    else if (play.card === '掣肘') {
      // 对方可能后盖 3★ 只上 2 人：盲指的 3 号位无人 → 扑空（不崩溃）
      const ef = s.sides[1 - i].fighters[play.a!]
      if (ef) ef.atkMult *= 1 - RULES.chezhouCut
      else reveals.push(`${SIDE_NAME[i]} 掣肘盲指 ${play.a! + 1} 号位扑空——对方该槽位无人上阵`)
    }
    else if (play.card === '金疮药') st.fighters[play.a!].dmgTakenMult *= 1 - RULES.jinchuangCut
    else if (play.card === '叫阵') st.fighters[play.a!].atkMult *= 1 + RULES.jiaozhenBoost
  }
  if (plays[0]?.card === '拆招' && plays[1]?.card === '拆招') reveals.push('双方互盖「拆招」，两相落空')
  // 5) 判定卡（盖在人物卡下，0 AP）
  for (const i of [0, 1] as const) {
    const st = s.sides[i]
    const jp = (st as any)._judge as JudgePlay | null
    if (!jp) continue
    st.judge = jp
    const f = st.fighters[jp.slot]
    f.judgeCards.push(jp.card)
    if (jp.card === '神机妙算') f.ins += RULES.shenjiBonus
    reveals.push(`${SIDE_NAME[i]} 判定卡「${jp.card}」→ ${jp.slot + 1}号位·${ROSTER[f.char].name}`)
  }
  // 6) AP：结存落袋 − 盖牌费用（被拆招抵消也照付——盲盖的风险）
  for (const i of [0, 1] as const) {
    const st = s.sides[i]
    const d: DraftPick = {
      picks: st.picks!,
      strategy: (st as any)._strategy ?? null,
      judge: (st as any)._judge ?? null,
      artifactDraws: (st as any)._draws ?? [],
    }
    st.ap = carryAp[i] - draftCost(d)
  }
  s.reveals = reveals
  s.phase = 'orders'
  s.round = 1
  s.dmg = [0, 0]
  s.note = `第 ${s.dazhe} 大局 · 第 1 小轮 · 暗置指令`
}

// ---------- 小轮指令 ----------
export function validateOrders(s: MatchState, side: 0 | 1, orders: Order[]): string | null {
  const st = s.sides[side]
  if (s.phase !== 'orders') return '当前不在指令阶段'
  if (st.orders) return '已提交过本小轮指令'
  const seen = new Set<number>()
  let cost = 0
  const swaps = orders.filter((o) => o.type === 'swap')
  if (swaps.length > 1) return '每小轮最多换位一次'
  for (const o of orders) {
    if (!Number.isInteger(o.slot) || o.slot < 0 || o.slot > 2) return '无效的槽位'
    const f = st.fighters[o.slot]
    if (!f || !f.alive) return '该槽位侠客已阵亡'
    if (o.type === 'swap') {
      // 换位是阵型调整（1 AP），不占用行动；指令跟随侠客本人
      cost += RULES.costSwap
      if (o.targetSlot === undefined || o.targetSlot < 0 || o.targetSlot > 2 || o.targetSlot === o.slot) return '换位需要指定另一个己方槽位'
      const f2 = st.fighters[o.targetSlot]
      if (!f2 || !f2.alive) return '换位的另一槽位侠客已阵亡'
      continue
    }
    if (seen.has(o.slot)) return '同一侠客只能行动一次'
    seen.add(o.slot)
    if (o.type === 'attack') {
      cost += RULES.costAttack
      if (o.targetSlot === undefined || o.targetSlot < 0 || o.targetSlot > 2) return '普攻需要指定目标槽位'
    } else if (o.type === 'ult') {
      cost += RULES.costUlt
      if (f.mp < RULES.mpMax) return '内力未满，无法释放绝技'
      const def = ROSTER[f.char]
      if ((def.ult === '连珠' || def.ult === '炎爆') && (o.targetSlot === undefined || o.targetSlot < 0 || o.targetSlot > 2))
        return '该绝技需要指定敌方目标'
      if (def.ult === '鼓舞' && (o.targetSlot === undefined || o.targetSlot < 0 || o.targetSlot > 2))
        return '鼓舞需要指定己方目标'
    }
  }
  if (cost > st.ap + 1e-9) return `AP 不足（需 ${cost} 点，余 ${st.ap} 点）`
  return null
}

export function submitOrders(s: MatchState, side: 0 | 1, orders: Order[]): void {
  const st = s.sides[side]
  st.orders = orders
  let cost = 0
  for (const o of orders) cost += o.type === 'attack' ? RULES.costAttack : o.type === 'ult' ? RULES.costUlt : o.type === 'swap' ? RULES.costSwap : 0
  st.ap -= cost
  if (s.sides[0].orders && s.sides[1].orders) resolveRound(s)
}

// ---------- 判定树（神妙→擦碰→致命→命中 + 溢出转化） ----------
function judge(
  lo: number, hi: number,
  crit: number, ins: number, prec: number, res: number,
): { dmg: number; kind: HitKind } {
  const roll = lo + Math.random() * (hi - lo)
  const critDmg = 1.5 + Math.max(0, crit + ins - 1) * 0.6
  if (Math.random() < ins) return { dmg: Math.max(hi - res, 1) * 1.35, kind: '神妙' }
  if (Math.random() > prec) return { dmg: Math.max(lo - res, 1) * 0.6, kind: '擦碰' }
  if (Math.random() < crit) return { dmg: Math.max(roll - res, 1) * critDmg, kind: '致命' }
  return { dmg: Math.max(roll - res, 1), kind: '命中' }
}

function strike(
  s: MatchState, aSide: 0 | 1, aSlot: number, dSide: 0 | 1, dSlot: number,
  mult: number, log: LogEntry[], actionName: string, isFollowUp = false,
): void {
  const att = s.sides[aSide].fighters[aSlot]
  const tgt = s.sides[dSide].fighters[dSlot]
  if (!att?.alive || !tgt?.alive) return
  const def = ROSTER[att.char]
  const prec = att.judgeCards.includes('稳军') ? 1 : def.prec       // 稳军：免擦碰
  const r = judge(
    att.lo * att.atkMult * mult, att.hi * att.atkMult * mult,
    def.crit, att.ins, prec, tgt[def.typ === 'P' ? 'resP' : 'resM'],
  )
  let dmg = r.dmg
  if (r.kind === '擦碰' && att.judgeCards.includes('孤注')) dmg *= 1 + RULES.guzhuBoost  // 孤注：擦碰 +50%
  if (att.boost) { dmg *= 1.5; att.boost = false }
  dmg *= tgt.dmgTakenMult                                          // 金疮药：受伤 −40%
  dmg = Math.round(dmg)
  tgt.hp -= dmg
  s.dmg[aSide] += dmg
  const entry: LogEntry = {
    side: aSide, slot: aSlot, char: att.char, action: actionName,
    target: `${ROSTER[tgt.char].name}(${dSlot + 1}号位)`, tSide: dSide, tSlot: dSlot,
    damage: dmg, kind: r.kind,
  }
  if (tgt.reflect) {
    const ref = Math.round(dmg * tgt.reflectPct)
    att.hp -= ref
    s.dmg[dSide] += ref
    entry.target += `（反伤 ${ref}）`
    if (att.hp <= 0) att.alive = false
  }
  if (tgt.hp <= 0) { tgt.alive = false; entry.kills = true }
  log.push(entry)
  if (!att.alive) { log.push({ side: aSide, slot: aSlot, char: att.char, action: '被反伤击倒' }); return }
  // 乘势：打出致命/神妙 → 额外追击一次普攻（追击不加内力、不再触发乘势）
  if (!isFollowUp && att.judgeCards.includes('乘势') && (r.kind === '致命' || r.kind === '神妙')) {
    const t2 = tgt.alive ? dSlot : weakestSlot(s, dSide)
    if (t2 !== null) strike(s, aSide, aSlot, dSide, t2, 1, log, '乘势追击', true)
  }
}

function weakestSlot(s: MatchState, side: 0 | 1): number | null {
  let best: number | null = null
  s.sides[side].fighters.forEach((f, i) => {
    if (f.alive && (best === null || f.hp < s.sides[side].fighters[best].hp)) best = i
  })
  return best
}

function resolveRound(s: MatchState) {
  const log: LogEntry[] = []
  // 换位先行：双方暗置的换位同时生效
  // —— 行动指令跟随侠客本人（slot 引用改写）；敌方目标=槽位（不跟随，故换位可令集火扑空）；
  //    己方增益目标=本人（鼓舞的 targetSlot 跟随本人改写）
  for (const i of [0, 1] as const) {
    const st = s.sides[i]
    const sw = st.orders!.find((o) => o.type === 'swap')
    if (sw && sw.targetSlot !== undefined) {
      const a = sw.slot, b = sw.targetSlot
      if (st.fighters[a]?.alive && st.fighters[b]?.alive) {
        const before = [...st.fighters]
        ;[st.fighters[a], st.fighters[b]] = [st.fighters[b], st.fighters[a]]
        const remap = (x: number) => (x === a ? b : x === b ? a : x)
        st.orders = st.orders!.filter((o) => o !== sw).map((o) => {
          const n = { ...o, slot: remap(o.slot) }
          if (n.type === 'ult' && n.targetSlot !== undefined && ROSTER[before[o.slot].char].ult === '鼓舞')
            n.targetSlot = remap(n.targetSlot)
          return n
        })
        log.push({ side: i, slot: b, char: st.fighters[b].char, action: '换位', target: `${a + 1}号位 ↔ ${b + 1}号位` })
      }
    }
  }
  interface Act { side: 0 | 1; slot: number; order: Order; spd: number }
  const acts: Act[] = []
  for (const i of [0, 1] as const) {
    for (const o of s.sides[i].orders!) {
      const f = s.sides[i].fighters[o.slot]
      if (f?.alive && o.type !== 'idle' && o.type !== 'swap') acts.push({ side: i, slot: o.slot, order: o, spd: ROSTER[f.char].spd })
    }
  }
  // 同速随机：先洗牌再稳定排序
  const shuffledActs = shuffled(acts).sort((a, b) => b.spd - a.spd)

  for (const a of shuffledActs) {
    const f = s.sides[a.side].fighters[a.slot]
    if (!f.alive) continue                    // 先手击杀抹掉未兑现的行动
    const foeSide = (1 - a.side) as 0 | 1
    if (a.order.type === 'attack') {
      // 普攻指定目标槽位：打的是「位置」，对方换位可令集火扑空；被嘲讽则强制跟随嘲讽者本人
      let t = a.order.targetSlot!
      if (f.forcedBy !== null) {
        const fi = s.sides[foeSide].fighters.findIndex((x) => x.id === f.forcedBy && x.alive)
        if (fi >= 0) t = fi
      }
      if (!s.sides[foeSide].fighters[t]?.alive) t = weakestSlot(s, foeSide) ?? t
      strike(s, a.side, a.slot, foeSide, t, 1, log, '普攻')
      f.mp = Math.min(RULES.mpMax, f.mp + RULES.mpPerAttack)
      f.forcedBy = null
    } else {
      f.mp = 0
      const ult = ROSTER[f.char].ult
      const star = f.star
      if (ult === '连珠') {
        let t = a.order.targetSlot!
        if (!s.sides[foeSide].fighters[t]?.alive) t = weakestSlot(s, foeSide) ?? t
        const hits = star === 3 ? STAR_RULES.lianzhuHits3 : star === 2 ? STAR_RULES.lianzhuHits2 : 2
        const lmult = star === 3 ? STAR_RULES.lianzhuMult3 : star === 2 ? STAR_RULES.lianzhuMult2 : STAR_RULES.lianzhuMult
        for (let k = 0; k < hits; k++) {
          if (!f.alive) break
          const tk = s.sides[foeSide].fighters[t]?.alive ? t : weakestSlot(s, foeSide)
          if (tk === null) break
          strike(s, a.side, a.slot, foeSide, tk, lmult, log, hits > 2 ? `连珠${hits}段·${'一二三四'[k]}` : `连珠·${'一二'[k]}`)
        }
      } else if (ult === '炎爆') {
        let t = a.order.targetSlot!
        if (!s.sides[foeSide].fighters[t]?.alive) t = weakestSlot(s, foeSide) ?? t
        const mainMult = star === 3 ? STAR_RULES.yanbaoMain3 : STAR_RULES.yanbaoMain2
        strike(s, a.side, a.slot, foeSide, t, mainMult, log, star >= 2 ? `炎爆·Lv${star}` : '炎爆')
        if (star >= 2 && f.alive) {
          // 溅射：对其余存活敌人造成较低倍率伤害
          const splash = star === 3 ? STAR_RULES.yanbaoSplash3 : STAR_RULES.yanbaoSplash2
          s.sides[foeSide].fighters.forEach((ef, i) => {
            if (i !== t && ef.alive && f.alive) strike(s, a.side, a.slot, foeSide, i, splash, log, '炎爆·溅射')
          })
        }
      } else if (ult === '嘲讽') {
        const n = star === 3 ? STAR_RULES.tauntTargets3 : star === 2 ? STAR_RULES.tauntTargets2 : 1
        const ranked = s.sides[foeSide].fighters
          .map((ef, i) => ({ ef, i }))
          .filter((x) => x.ef.alive)
          .sort((x, y) => y.ef.lo + y.ef.hi - (x.ef.lo + x.ef.hi))
          .slice(0, n)
        for (const { ef, i } of ranked) {
          ef.forcedBy = f.id // 跟随嘲讽者本人，换位不失效
          log.push({ side: a.side, slot: a.slot, char: f.char, action: star >= 2 ? `嘲讽·Lv${star}` : '嘲讽', target: `${ROSTER[ef.char].name}(${i + 1}号位)` })
        }
      } else if (ult === '反伤甲') {
        f.reflect = true
        f.reflectPct = star === 3 ? STAR_RULES.reflect3 : STAR_RULES.reflect2
        const healPct = star === 3 ? STAR_RULES.reflectHeal3 : star === 2 ? STAR_RULES.reflectHeal2 : 0
        if (healPct > 0) {
          const heal = Math.round(f.maxhp * healPct)
          f.hp = Math.min(f.maxhp, f.hp + heal)
          log.push({ side: a.side, slot: a.slot, char: f.char, action: `反伤甲·Lv${star}`, target: `自身（反弹${Math.round(f.reflectPct * 100)}%，自疗${heal}）`, damage: -heal })
        } else {
          log.push({ side: a.side, slot: a.slot, char: f.char, action: '反伤甲', target: '自身（本大局反弹20%）' })
        }
      } else if (ult === '回春') {
        if (star >= 2) {
          // 群疗：全体己方存活者回复
          const healPct = star === 3 ? STAR_RULES.heal3 : STAR_RULES.heal2
          s.sides[a.side].fighters.forEach((af, i) => {
            if (!af.alive) return
            const heal = Math.round(af.maxhp * healPct)
            af.hp = Math.min(af.maxhp, af.hp + heal)
            log.push({ side: a.side, slot: a.slot, char: f.char, action: `回春·Lv${star}`, target: `${ROSTER[af.char].name}(${i + 1}号位)`, damage: -heal })
          })
        } else {
          let lowSlot: number | null = null
          let lowRatio = Infinity
          s.sides[a.side].fighters.forEach((af, i) => {
            if (af.alive && af.hp / af.maxhp < lowRatio) { lowRatio = af.hp / af.maxhp; lowSlot = i }
          })
          if (lowSlot !== null) {
            const t = s.sides[a.side].fighters[lowSlot]
            const heal = Math.round(t.maxhp * 0.3)
            t.hp = Math.min(t.maxhp, t.hp + heal)
            log.push({ side: a.side, slot: a.slot, char: f.char, action: '回春', target: `${ROSTER[t.char].name}(${lowSlot + 1}号位)`, damage: -heal })
          }
        }
      } else if (ult === '鼓舞') {
        const n = star === 3 ? STAR_RULES.inspireTargets3 : star === 2 ? STAR_RULES.inspireTargets2 : 1
        if (n === 1) {
          const t = s.sides[a.side].fighters[a.order.targetSlot!]
          if (t?.alive) {
            t.boost = true
            log.push({ side: a.side, slot: a.slot, char: f.char, action: '鼓舞', target: `${ROSTER[t.char].name}(${a.order.targetSlot! + 1}号位)（下次攻击+50%）` })
          }
        } else {
          // 多目标鼓舞：指定目标优先，其余按攻击面板从高到低补足
          const ranked = s.sides[a.side].fighters
            .map((af, i) => ({ af, i }))
            .filter((x) => x.af.alive && x.af.id !== f.id)
            .sort((x, y) => (x.i === a.order.targetSlot ? -1 : 0) - (y.i === a.order.targetSlot ? -1 : 0) || y.af.lo + y.af.hi - (x.af.lo + x.af.hi))
            .slice(0, n)
          for (const { af, i } of ranked) {
            af.boost = true
            log.push({ side: a.side, slot: a.slot, char: f.char, action: `鼓舞·Lv${star}`, target: `${ROSTER[af.char].name}(${i + 1}号位)（下次攻击+50%）` })
          }
        }
      }
    }
  }

  s.lastLog = { dazhe: s.dazhe, round: s.round, entries: log }
  s.sides[0].orders = null
  s.sides[1].orders = null

  if (s.round < RULES.roundsPerDazhe) {
    s.round += 1
    s.note = `第 ${s.dazhe} 大局 · 第 ${s.round} 小轮 · 暗置指令`
  } else {
    settleDazhe(s)
  }
}

// ---------- 层级结算：存活数 → 伤害量 → 平轮 ----------
function settleDazhe(s: MatchState) {
  const alive: [number, number] = [
    s.sides[0].fighters.filter((f) => f.alive).length,
    s.sides[1].fighters.filter((f) => f.alive).length,
  ]
  let winner: 0 | 1 | null = null
  let reason = ''
  if (alive[0] !== alive[1]) {
    winner = alive[0] > alive[1] ? 0 : 1
    reason = `存活数 ${alive[0]} : ${alive[1]}`
  } else if (Math.abs(s.dmg[0] - s.dmg[1]) > 1e-9) {
    winner = s.dmg[0] > s.dmg[1] ? 0 : 1
    reason = `存活持平，伤害量 ${Math.round(s.dmg[0])} : ${Math.round(s.dmg[1])}`
  } else {
    reason = '双空城，平轮'
  }
  if (winner !== null) s.score[winner] += 1
  s.summary = { dazhe: s.dazhe, winner, reason, alive, dmg: [Math.round(s.dmg[0]), Math.round(s.dmg[1])] }

  const done = s.score[0] >= RULES.winScore || s.score[1] >= RULES.winScore || s.dazhe >= RULES.maxDazhe
  if (done) {
    if (s.score[0] === s.score[1]) {
      s.winner = Math.random() < 0.5 ? 0 : 1
      s.note = `九局战平，掷签定胜——${s.winner === 0 ? '甲' : '乙'}方胜`
    } else {
      s.winner = s.score[0] > s.score[1] ? 0 : 1
      s.note = `${s.winner === 0 ? '甲' : '乙'}方 ${Math.max(...s.score)} : ${Math.min(...s.score)} 拿下论剑`
    }
    s.phase = 'matchEnd'
  } else {
    s.phase = 'dazheResult'
    s.note = `第 ${s.dazhe} 大局封盘：${winner === null ? '平轮' : (winner === 0 ? '甲方' : '乙方') + '胜（' + reason + '）'}`
  }
}

/** 大局结算后任意一方推进到下一大局（双方都能看到结果，幂等） */
export function advanceDazhe(s: MatchState): void {
  if (s.phase !== 'dazheResult') return
  s.dazhe += 1
  s.round = 1
  for (const i of [0, 1] as const) {
    const st = s.sides[i]
    st.apCarry = st.ap                        // 未用 AP 进入利息结存（节流 ×2 在下一大局发放时体现）
    st.ap = 0
    st.picks = null
    st.fighters = []
    st.orders = null
    st.strategy = null
    st.judge = null
    delete (st as any)._strategy
    delete (st as any)._judge
    delete (st as any)._draws
    delete (st as any)._stars
  }
  s.dmg = [0, 0]
  s.reveals = []
  drawHands(s)
  s.phase = 'draft'
  s.note = `第 ${s.dazhe} 大局 · 布阵阶段（AP 已按利息结存）`
}

// ---------- 客户端视图（信息隐藏） ----------
export interface ClientView extends Omit<MatchState, 'sides'> {
  me: 0 | 1
  sides: [SideState, SideState]
}

/** 联网模式：隐藏对方未公开的信息（手牌/未翻的布阵与盖牌/未结算的指令） */
export function clientView(s: MatchState, me: 0 | 1): ClientView {
  const v = JSON.parse(JSON.stringify(s)) as ClientView
  v.me = me
  const foe = v.sides[1 - me]
  const bothPicked = !!(v.sides[0].picks && v.sides[1].picks)
  if (!bothPicked) {
    foe.hand = foe.hand.map(() => '?' as unknown as CharId)  // 手牌不可见
    if (foe.picks) foe.picks = []                            // 只知道对方"已盖牌"
  } else {
    foe.hand = []                                            // 已翻牌，手牌无意义
  }
  if (foe.orders) foe.orders = []                            // 只知道对方"已提交指令"
  for (const sd of [foe, v.sides[me]]) {
    delete (sd as any)._strategy
    delete (sd as any)._judge
    delete (sd as any)._draws
    delete (sd as any)._stars
  }
  return v
}

export const SIDE_NAME = ['甲方', '乙方'] as const
