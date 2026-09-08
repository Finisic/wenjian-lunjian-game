// ============================================================
// 战斗引擎 —— 伤害公式与三率判定（平滑改良版）
//
// 【与拆解对象《燕云十六声》原版机制的差异】
// 原版：会心+会意≥100% 时"强制会心"，白字在断点处一次性清零，
//       期望伤害在临界点跳变，且超出部分率值被浪费。
// 本设计：① 不做强制判定，白字概率随覆盖率平滑收敛到0；
//        ② 溢出部分（会心+会意-100%）按60%转化为会心伤害加成，
//        消除断点挫败感，同时保留"堆满覆盖"的毕业价值。
// ============================================================
import type { BattleUnit, DamageResult, EventBuff, HitKind, HeroDef, OwnedHero, EnemyDef } from './types'
import { BOSS_MECHANICS, COMBAT, ELITE, GROWTH_PER_LEVEL, GROWTH_PER_STAR, HEROES, PVE_EVENTS, enemiesOfFloor } from './config'

export function heroDef(id: string): HeroDef {
  return HEROES.find(h => h.id === id)!
}

/** 养成后的实际面板（等级线性成长 + 星级独立乘区） */
export function grownStats(o: OwnedHero) {
  const d = heroDef(o.heroId)
  const lvMul = 1 + GROWTH_PER_LEVEL * (o.level - 1)
  const starMul = 1 + GROWTH_PER_STAR * (o.star - 1)
  const m = lvMul * starMul
  return {
    ...d,
    hp: Math.round(d.hp * m),
    atkMin: Math.round(d.atkMin * m),
    atkMax: Math.round(d.atkMax * m),
    def: Math.round(d.def * (1 + 0.03 * (o.level - 1))),
  }
}

/** 三率有效面板：计算溢出转化后的实际会心伤害 */
export function effectiveRates(u: Pick<BattleUnit, 'prec' | 'crit' | 'insight' | 'critDmg' | 'insDmg'>) {
  const overflow = Math.max(0, u.crit + u.insight - 1)
  return {
    prec: Math.min(u.prec, 1),
    crit: u.crit,
    insight: u.insight,
    critDmg: u.critDmg + overflow * COMBAT.overflowConvert, // 溢出转化
    insDmg: u.insDmg,
    overflow,
  }
}

/**
 * 期望伤害解析解（复盘面板与侠客详情页展示用）
 * 判定树：会意 → (未中) 精准 → (未中=擦伤 / 命中) 会心 → (未中=白字)
 */
export function expectedDamage(
  u: Pick<BattleUnit, 'atkMin' | 'atkMax' | 'prec' | 'crit' | 'insight' | 'critDmg' | 'insDmg'>,
  mult: number, targetDef: number, exhausted: boolean,
): number {
  const r = effectiveRates(u)
  const base = (t: number) => {
    const atk = u.atkMin + t * (u.atkMax - u.atkMin)
    return Math.max(atk * mult - targetDef, 1)
  }
  const bMid = base(0.5)
  let e = r.insight * base(1) * r.insDmg
    + (1 - r.insight) * r.prec * r.crit * bMid * r.critDmg
    + (1 - r.insight) * r.prec * (1 - r.crit) * bMid
    + (1 - r.insight) * (1 - r.prec) * base(0) * COMBAT.grazeMult
  if (exhausted) e *= 1 + COMBAT.exhaustDmgBonus
  return e
}

/** 攻击方的动态攻击倍率（精英词缀「狂暴」、Boss「困兽」） */
export function attackerAtkMul(u: BattleUnit): number {
  let m = 1
  if (u.affixes?.includes('kuangbao') && u.hp / u.maxHp < (ELITE.affixes.kuangbao.below ?? 0.3)) {
    m *= 1 + (ELITE.affixes.kuangbao.atkMul ?? 0.4)
  }
  if (u.cornered) m *= BOSS_MECHANICS.corneredAtkMul
  return m
}

/** 单次伤害判定（蒙特卡洛一次采样） */
export function rollDamage(attacker: BattleUnit, target: BattleUnit, mult: number): DamageResult {
  const r = effectiveRates(attacker)
  const exhausted = target.exhaustTurns > 0
  const t = Math.random()
  const atkMul = attackerAtkMul(attacker)
  const atk = (attacker.atkMin + t * (attacker.atkMax - attacker.atkMin)) * atkMul
  const base = Math.max(atk * mult - target.def, 1)
  const baseMax = Math.max(attacker.atkMax * atkMul * mult - target.def, 1)
  const baseMin = Math.max(attacker.atkMin * atkMul * mult - target.def, 1)

  let dmg: number
  let kind: HitKind
  const roll1 = Math.random()
  if (roll1 < r.insight) {
    dmg = baseMax * r.insDmg; kind = '会意'           // 会意：按最大攻击结算
  } else if (Math.random() > r.prec) {
    if (target.affixes?.includes('jianren')) {
      dmg = base; kind = '白字'                        // 「坚韧」：擦伤免疫，按白字结算
    } else {
      dmg = baseMin * COMBAT.grazeMult; kind = '擦伤' // 擦伤：最小攻击+惩罚倍率
    }
  } else if (Math.random() < r.crit) {
    dmg = base * r.critDmg; kind = '会心'             // 会心：含溢出转化加成
  } else {
    dmg = base; kind = '白字'
  }
  if (exhausted) dmg *= 1 + COMBAT.exhaustDmgBonus
  if (target.cornered) dmg *= BOSS_MECHANICS.corneredDmgTakenMul // 困兽：受伤+15%
  dmg *= target.dmgTakenMul                                       // 奇遇等全局修正
  return {
    dmg: Math.round(dmg),
    kind,
    expected: expectedDamage(attacker, mult, target.def, exhausted),
  }
}

// ---------- 单位构建 ----------
export function allyUnit(o: OwnedHero, idx: number): BattleUnit {
  const s = grownStats(o)
  return {
    key: `ally${idx}`, name: s.name, side: 'ally', school: s.school,
    maxHp: s.hp, hp: s.hp,
    atkMin: s.atkMin, atkMax: s.atkMax, def: s.def, spd: s.spd,
    prec: s.prec, crit: s.crit, insight: s.insight, critDmg: s.critDmg, insDmg: s.insDmg,
    toughMul: s.toughMul, maxTough: 0, tough: 0, exhaustTurns: 0,
    rage: COMBAT.rageStart,
    skillName: s.skill.name, skillMult: s.skill.mult, skillTough: s.skill.tough, skillHeal: s.skill.heal,
    alive: true,
    dmgTakenMul: 1,
  }
}

export function enemyUnit(e: EnemyDef, idx: number): BattleUnit {
  return {
    key: `enemy${idx}`, name: e.name, side: 'enemy',
    maxHp: e.hp, hp: e.hp,
    atkMin: e.atkMin, atkMax: e.atkMax, def: e.def, spd: e.spd,
    prec: 0.95, crit: 0.1, insight: 0.02, critDmg: 1.5, insDmg: 1.35,
    toughMul: 1, maxTough: e.tough, tough: e.tough, exhaustTurns: 0,
    rage: 0, skillName: '', skillMult: 1, skillTough: 0,
    alive: true,
    isBoss: e.isBoss, elite: e.elite, affixes: e.affixes, cornered: false,
    dmgTakenMul: 1,
  }
}

/** 奇遇 buff 生效（仅当 buff.floor 与当前层一致时由调用方传入） */
export function applyEventBuff(allies: BattleUnit[], enemies: BattleUnit[], buff?: EventBuff | null) {
  if (!buff) return
  const c = PVE_EVENTS.choices.find(x => x.id === buff.id)
  if (!c) return
  for (const a of allies) {
    if (c.atkMul) { a.atkMin = Math.round(a.atkMin * (1 + c.atkMul)); a.atkMax = Math.round(a.atkMax * (1 + c.atkMul)) }
    if (c.dmgTakenMul) a.dmgTakenMul *= 1 + c.dmgTakenMul
    if (c.startRage) a.rage = Math.min(COMBAT.rageMax, a.rage + c.startRage)
  }
  if (c.enemyAtkMul) {
    for (const e of enemies) {
      e.atkMin = Math.round(e.atkMin * (1 + c.enemyAtkMul))
      e.atkMax = Math.round(e.atkMax * (1 + c.enemyAtkMul))
    }
  }
}

/** Boss 阶段检测：气血跌破50%进入「困兽」（返回是否本次新触发） */
export function updateBossPhase(u: BattleUnit): boolean {
  if (!u.isBoss || !u.alive || u.cornered) return false
  if (u.hp / u.maxHp < BOSS_MECHANICS.corneredBelow) {
    u.cornered = true
    return true
  }
  return false
}

/** 行动排序：「迅捷」先制（首轮置于队首），其余按速度降序 */
export function battleOrder(units: BattleUnit[]): BattleUnit[] {
  return [...units].sort((a, b) => {
    const fa = a.affixes?.includes('xunjie') ? 1 : 0
    const fb = b.affixes?.includes('xunjie') ? 1 : 0
    return fb - fa || b.spd - a.spd
  })
}

// ---------- 行动结算 ----------
export interface ActionLog {
  actor: string
  action: string
  target: string
  dmg?: number
  heal?: number
  kind?: HitKind
  exhausted?: boolean  // 目标是否被打进气竭
  reflect?: number     // 「荆棘」反弹回攻击方的伤害
}

/** 对目标施加削韧，返回是否触发气竭 */
export function applyToughness(target: BattleUnit, amount: number): boolean {
  if (target.exhaustTurns > 0) return false
  target.tough = Math.max(0, target.tough - amount)
  if (target.tough === 0) {
    target.exhaustTurns = COMBAT.exhaustRounds + 1 // 本回合+后续回合
    return true
  }
  return false
}

/** 我方侠客行动（普攻或绝技），返回日志与伤害结果 */
export function allyAction(
  attacker: BattleUnit, target: BattleUnit, useSkill: boolean, allies: BattleUnit[],
): { log: ActionLog; result?: DamageResult } {
  // 治疗技
  if (useSkill && attacker.skillHeal) {
    const ally = allies.filter(a => a.alive).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]
    const heal = Math.round(attacker.maxHp * attacker.skillHeal)
    ally.hp = Math.min(ally.maxHp, ally.hp + heal)
    attacker.rage = 0
    return { log: { actor: attacker.name, action: attacker.skillName, target: ally.name, heal } }
  }
  const mult = useSkill ? attacker.skillMult : 1.0
  const tough = (useSkill ? attacker.skillTough : COMBAT.toughNormal) * attacker.toughMul
  if (useSkill) attacker.rage = 0
  else attacker.rage = Math.min(COMBAT.rageMax, attacker.rage + COMBAT.ragePerAttack)

  const result = rollDamage(attacker, target, mult)
  target.hp = Math.max(0, target.hp - result.dmg)
  if (target.hp === 0) target.alive = false
  const broke = target.alive ? applyToughness(target, tough) : false
  target.rage = Math.min(COMBAT.rageMax, (target.rage || 0) + COMBAT.ragePerHit)
  // 「荆棘」：受击反弹15%伤害（可致死攻击方）
  let reflect: number | undefined
  if (target.affixes?.includes('jingji') && result.dmg > 0) {
    reflect = Math.round(result.dmg * (ELITE.affixes.jingji.reflect ?? 0.15))
    attacker.hp = Math.max(0, attacker.hp - reflect)
    if (attacker.hp === 0) attacker.alive = false
  }
  return {
    log: {
      actor: attacker.name, action: useSkill ? attacker.skillName : '普攻',
      target: target.name, dmg: result.dmg, kind: result.kind, exhausted: broke, reflect,
    },
    result,
  }
}

// ---------- 自动战斗模拟（平衡自检用，与 Battle.tsx 同引擎同规则） ----------
export interface SimResult {
  win: boolean
  rounds: number      // 完整轮次数
  alliesLeft: number
  actions: number
}

/**
 * 自动战斗：我方策略 = 怒气满则绝技、集火气血最低敌人；敌方策略 = 随机目标。
 * 与线上 Battle.tsx 的行动循环一致（削韧/气竭/先制/词缀/困兽全量生效）。
 */
export function simulateBattle(team: OwnedHero[], floor: number, buff?: EventBuff | null): SimResult {
  const allies = team.map((o, i) => allyUnit(o, i))
  const enemies = enemiesOfFloor(floor).map((e, i) => enemyUnit(e, i))
  applyEventBuff(allies, enemies, buff)
  const order = battleOrder([...allies, ...enemies])
  let rounds = 1
  let actions = 0
  const MAX_ACTIONS = 300 // 防死循环兜底

  outer: while (actions < MAX_ACTIONS) {
    for (const u of order) {
      actions++
      if (!u.alive) continue
      if (u.exhaustTurns > 0) {
        u.exhaustTurns--
        if (u.exhaustTurns === 0) u.tough = u.maxTough
        continue
      }
      if (u.side === 'ally') {
        const targets = enemies.filter(e => e.alive)
        if (!targets.length) break outer
        const t = targets.sort((a, b) => a.hp - b.hp)[0]
        const useSkill = u.rage >= COMBAT.rageMax
        allyAction(u, t, useSkill, allies)
      } else {
        if (!allies.some(a => a.alive)) break outer
        enemyAction(u, allies)
      }
      for (const e of enemies) updateBossPhase(e)
      if (!enemies.some(e => e.alive) || !allies.some(a => a.alive)) break outer
    }
    rounds++
  }
  return { win: enemies.every(e => !e.alive), rounds, alliesLeft: allies.filter(a => a.alive).length, actions }
}

/** 敌方行动（简单AI：随机打一个存活我方单位） */
export function enemyAction(attacker: BattleUnit, allies: BattleUnit[]): { log: ActionLog; result?: DamageResult } {
  const targets = allies.filter(a => a.alive)
  const target = targets[Math.floor(Math.random() * targets.length)]
  const result = rollDamage(attacker, target, 1.0)
  target.hp = Math.max(0, target.hp - result.dmg)
  if (target.hp === 0) target.alive = false
  target.rage = Math.min(COMBAT.rageMax, target.rage + COMBAT.ragePerHit)
  return { log: { actor: attacker.name, action: '攻击', target: target.name, dmg: result.dmg, kind: result.kind }, result }
}
