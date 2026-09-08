// ============ 类型定义 ============

/** 流派：剑=会心流 / 扇=会意流 / 刀=均衡 / 拳=削韧流 */
export type School = '剑' | '扇' | '刀' | '拳'

/** 侠客（配表静态数据） */
export interface HeroDef {
  id: string
  name: string
  title: string        // 称号
  rarity: 3 | 4 | 5
  school: School
  desc: string
  // 基础面板（1级）
  hp: number
  atkMin: number
  atkMax: number
  def: number
  spd: number
  prec: number         // 精准率
  crit: number         // 会心率
  insight: number      // 会意率
  critDmg: number      // 会心伤害倍率（初始1.5）
  insDmg: number       // 会意伤害倍率（初始1.35）
  toughMul: number     // 削韧倍率（拳系1.5，其他1.0）
  skill: {
    name: string
    mult: number       // 技能倍率
    tough: number      // 技能削韧值
    desc: string
    heal?: number      // 若为治疗技：治疗系数（按自身最大气血）
  }
}

/** 玩家拥有的侠客实例（养成进度） */
export interface OwnedHero {
  heroId: string
  level: number
  star: number         // 1~5
  exp: number
}

/** 精英词缀 id */
export type AffixId = 'jingji' | 'kuangbao' | 'jianren' | 'xunjie'

/** 敌人（配表静态数据 + 层数缩放） */
export interface EnemyDef {
  id: string
  name: string
  hp: number
  atkMin: number
  atkMax: number
  def: number
  spd: number
  tough: number        // 韧性上限
  isBoss?: boolean
  elite?: boolean      // 精英怪（带词缀）
  affixes?: AffixId[]
  isGuard?: boolean    // 大关底护卫召唤物
}

/** 奇遇事件 id */
export type EventId = 'qingquan' | 'jianpu' | 'mojin'

/** 存档中记录的本层生效奇遇 buff（通关或层数变化后清除） */
export interface EventBuff {
  id: EventId
  floor: number        // 生效层
}

/** 战斗中的单位运行时状态 */
export interface BattleUnit {
  key: string
  name: string
  side: 'ally' | 'enemy'
  school?: School
  maxHp: number
  hp: number
  atkMin: number
  atkMax: number
  def: number
  spd: number
  prec: number
  crit: number
  insight: number
  critDmg: number
  insDmg: number
  toughMul: number
  maxTough: number     // 敌方韧性
  tough: number
  exhaustTurns: number // 气竭剩余回合
  rage: number         // 怒气（我方）
  skillName: string
  skillMult: number
  skillTough: number
  skillHeal?: number
  alive: boolean
  // ---- PVE 扩展 ----
  isBoss?: boolean
  elite?: boolean
  affixes?: AffixId[]
  cornered?: boolean   // Boss「困兽」阶段（气血跌破50%触发）
  dmgTakenMul: number  // 受伤倍率（奇遇 debuff 等，默认1）
}

/** 单次伤害的判定结果 */
export type HitKind = '会意' | '会心' | '白字' | '擦伤'

export interface DamageResult {
  dmg: number
  kind: HitKind
  // 理论期望（复盘面板用）
  expected: number
}

/** 战斗复盘统计 */
export interface BattleReview {
  hits: Record<HitKind, number>
  totalDmg: number
  expectedDmg: number
  rounds: number
}

/** 全局存档 */
export interface SaveData {
  heroes: OwnedHero[]
  team: string[]       // heroId 最多3个
  floor: number        // 当前可挑战层
  jade: number         // 玉璧（抽卡货币）
  expPills: number     // 经验丹
  pullsSince5: number  // 距上次5星的抽数（保底计数）
  pullsSince4: number
  totalPulls: number
  fiveStars: number    // 抽到的5星总数（统计用）
  pendingEvent?: boolean      // 是否有待抉择的奇遇（每通关3层触发）
  eventBuff?: EventBuff | null // 当前生效的奇遇 buff
}
