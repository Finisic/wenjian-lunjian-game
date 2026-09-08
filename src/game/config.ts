// ============================================================
// 参数配表 —— 全部数值参数集中在此文件
// 规则说明见游戏内「玩法」页
// ============================================================
import type { HeroDef, EnemyDef, AffixId, EventId } from './types'

// ---------- 战斗公式参数 ----------
export const COMBAT = {
  grazeMult: 0.6,        // 擦伤惩罚倍率（精准未命中）
  toughNormal: 12,       // 普攻削韧值
  exhaustDmgBonus: 0.35, // 气竭窗口受伤加成
  exhaustRounds: 2,      // 气竭持续回合
  rageStart: 50,         // 初始怒气
  ragePerAttack: 30,     // 普攻回怒
  ragePerHit: 15,        // 受击回怒
  rageMax: 100,          // 怒气上限=绝技消耗
  overflowConvert: 0.6,  // 【核心改良】会心+会意超出100%的部分，按60%转化为会心伤害加成
} as const

// ---------- 侠客池 ----------
export const HEROES: HeroDef[] = [
  // 5★
  {
    id: 'shen_guhong', name: '沈孤鸿', title: '孤鸿剑客', rarity: 5, school: '剑',
    desc: '剑走偏锋，会心一击可断山河。',
    hp: 1150, atkMin: 185, atkMax: 305, def: 60, spd: 108,
    prec: 0.99, crit: 0.34, insight: 0.08, critDmg: 1.5, insDmg: 1.35, toughMul: 1.0,
    skill: { name: '孤鸿照影', mult: 2.8, tough: 30, desc: '单体2.8倍伤害' },
  },
  {
    id: 'su_wanyue', name: '苏挽月', title: '月下执扇', rarity: 5, school: '扇',
    desc: '扇影流转，会意一击直取要害。',
    hp: 1050, atkMin: 170, atkMax: 300, def: 55, spd: 112,
    prec: 0.98, crit: 0.16, insight: 0.24, critDmg: 1.5, insDmg: 1.35, toughMul: 1.0,
    skill: { name: '月下挽歌', mult: 2.3, tough: 34, desc: '2.3倍伤害，削韧更强' },
  },
  // 4★
  {
    id: 'tie_wuzong', name: '铁无踪', title: '无影刀客', rarity: 4, school: '刀',
    desc: '刀法沉稳，攻守兼备。',
    hp: 1300, atkMin: 190, atkMax: 265, def: 75, spd: 100,
    prec: 0.97, crit: 0.22, insight: 0.10, critDmg: 1.5, insDmg: 1.35, toughMul: 1.0,
    skill: { name: '无影连环斩', mult: 2.2, tough: 26, desc: '单体2.2倍伤害' },
  },
  {
    id: 'lei_wanjun', name: '雷万钧', title: '裂碑拳师', rarity: 4, school: '拳',
    desc: '拳可裂碑，专攻敌人破绽。',
    hp: 1400, atkMin: 175, atkMax: 240, def: 80, spd: 95,
    prec: 0.96, crit: 0.15, insight: 0.08, critDmg: 1.5, insDmg: 1.35, toughMul: 1.5,
    skill: { name: '裂碑崩山', mult: 2.0, tough: 45, desc: '2.0倍伤害，大幅削韧' },
  },
  {
    id: 'yan_xiaoyi', name: '燕小乙', title: '快剑浪子', rarity: 4, school: '剑',
    desc: '剑快如电，身法无双。',
    hp: 1080, atkMin: 165, atkMax: 260, def: 55, spd: 115,
    prec: 0.98, crit: 0.30, insight: 0.06, critDmg: 1.5, insDmg: 1.35, toughMul: 1.0,
    skill: { name: '燕返', mult: 2.4, tough: 22, desc: '单体2.4倍伤害' },
  },
  {
    id: 'hua_manlou', name: '花满楼', title: '春风医仙', rarity: 4, school: '扇',
    desc: '医者仁心，妙手回春。',
    hp: 1100, atkMin: 150, atkMax: 230, def: 60, spd: 110,
    prec: 0.98, crit: 0.12, insight: 0.10, critDmg: 1.5, insDmg: 1.35, toughMul: 1.0,
    skill: { name: '春风一度', mult: 0, tough: 0, heal: 0.3, desc: '回复气血最低队友30%气血' },
  },
  // 3★
  {
    id: 'liu_qing', name: '柳青', title: '青衫剑客', rarity: 3, school: '剑',
    desc: '初出茅庐的剑客。',
    hp: 950, atkMin: 140, atkMax: 220, def: 45, spd: 105,
    prec: 0.96, crit: 0.22, insight: 0.05, critDmg: 1.5, insDmg: 1.35, toughMul: 1.0,
    skill: { name: '青衫一剑', mult: 1.9, tough: 18, desc: '单体1.9倍伤害' },
  },
  {
    id: 'shi_gandang', name: '石敢当', title: '莽拳大汉', rarity: 3, school: '拳',
    desc: '一身蛮力，拳风刚猛。',
    hp: 1200, atkMin: 135, atkMax: 190, def: 60, spd: 90,
    prec: 0.95, crit: 0.10, insight: 0.05, critDmg: 1.5, insDmg: 1.35, toughMul: 1.5,
    skill: { name: '莽牛劲', mult: 1.7, tough: 32, desc: '1.7倍伤害，削韧较强' },
  },
  {
    id: 'bai_xiaochun', name: '白小纯', title: '执扇书生', rarity: 3, school: '扇',
    desc: '手无缚鸡之力，偶有妙手。',
    hp: 900, atkMin: 120, atkMax: 200, def: 40, spd: 108,
    prec: 0.96, crit: 0.10, insight: 0.15, critDmg: 1.5, insDmg: 1.35, toughMul: 1.0,
    skill: { name: '书生一扇', mult: 1.8, tough: 16, desc: '单体1.8倍伤害' },
  },
  {
    id: 'mo_da', name: '莫大', title: '独行刀客', rarity: 3, school: '刀',
    desc: '沉默寡言的刀客。',
    hp: 1100, atkMin: 150, atkMax: 210, def: 55, spd: 98,
    prec: 0.96, crit: 0.15, insight: 0.07, critDmg: 1.5, insDmg: 1.35, toughMul: 1.0,
    skill: { name: '独刀式', mult: 1.8, tough: 20, desc: '单体1.8倍伤害' },
  },
]

// ---------- 敌人与爬塔成长曲线 ----------
// 数值说明：气血按几何级数增长（每层×1.22）制造养成压力，
// 攻击按较慢几何增长（×1.12）保证生存压力可控，
// 防御线性微增，避免"防御通胀"吃掉低攻击侠客的收益。
// v2.1 调整：第10层后增长软着陆（气血×1.15/攻击×1.08）——
// 几何通胀若不衰减，12层起所需练度将超出丹药经济的供给上限（自检暴露的结构问题）。
export const TOWER_CURVE = {
  hpGrowth: 1.22,        // 1~10层气血增长
  atkGrowth: 1.12,       // 1~10层攻击增长
  defPerFloor: 2,        // 防御线性微增
  toughPerFloor: 15,     // 韧性线性增长
  softenFloor: 10,       // 软着陆起始层（含）
  hpGrowthHigh: 1.10,    // 10层后气血增长
  atkGrowthHigh: 1.03,   // 10层后攻击增长
} as const
const ENEMY_BASES = [
  { id: 'shanzai', name: '山贼', hp: 1000, atkMin: 100, atkMax: 160, def: 35, spd: 92, tough: 80 },
  { id: 'eba', name: '恶霸', hp: 1500, atkMin: 110, atkMax: 150, def: 45, spd: 85, tough: 110 },
  { id: 'kuaidaoshou', name: '快刀手', hp: 800, atkMin: 140, atkMax: 200, def: 30, spd: 118, tough: 60 },
]

// ---------- 精英词缀 ----------
// 第3层起普通层概率刷精英（种子随机：按层数确定，保证预览/实战/模拟三方一致，可复盘）
export const ELITE = {
  startFloor: 3,        // 精英出现的起始层
  chance: 0.35,         // 普通层刷出精英的概率
  hpMul: 1.2,           // 精英气血强化
  atkMul: 1.05,         // 精英攻击强化（轻微，词缀才是主威胁，避免"数值墙"掩盖机制）
  jadeBonus: 8,         // 击杀精英的额外玉璧（风险-收益对价）
  affixes: {
    jingji:   { name: '荆棘', desc: '受击反弹10%伤害', reflect: 0.10 },
    kuangbao: { name: '狂暴', desc: '气血低于30%时攻击+40%', below: 0.3, atkMul: 0.4 },
    jianren:  { name: '坚韧', desc: '免疫擦伤（擦伤按白字结算）' },
    xunjie:   { name: '迅捷', desc: '速度+20，行动序列中必先出手（先制）', spdAdd: 20 },
  } as Record<AffixId, { name: string; desc: string; reflect?: number; below?: number; atkMul?: number; spdAdd?: number }>,
} as const

// ---------- BOSS 阶段机制 ----------
export const BOSS_MECHANICS = {
  // Boss 层为单体首领战：血量倍率（乘在层膨胀曲线上），每深入一个阶层（5层）+0.3
  hpMul: 1.8,
  hpMulPerTier: 0.3,
  // 每5层的头领：气血跌破50%进入「困兽」——攻击×1.3但受伤+15%，制造斩杀窗口博弈
  corneredBelow: 0.5,
  corneredAtkMul: 1.4,
  corneredDmgTakenMul: 1.15,
  // 每10层大关底：开局带1个「护卫」小怪（血量为同层山贼的80%，逼队伍交转火决策）
  guardEvery: 10,
  guardHpMul: 0.8,
} as const

// ---------- 奇遇事件 ----------
// 每通关 triggerEvery 层触发一次三选一。设计原则：稳妥项收益温和，激进项带真实代价。
export const PVE_EVENTS = {
  triggerEvery: 3,
  choices: [
    {
      id: 'qingquan' as EventId, name: '山涧清泉',
      flavor: '泉水清冽，饮之洗尘。',
      desc: '经验丹+4，本层开局怒气+30',
      expPills: 4, startRage: 30,
    },
    {
      id: 'jianpu' as EventId, name: '破旧剑谱',
      flavor: '残卷剑意凌厉，强练恐伤经脉。',
      desc: '本层攻击+18%，但受伤+8%',
      atkMul: 0.18, dmgTakenMul: 0.08,
    },
    {
      id: 'mojin' as EventId, name: '摸金校尉',
      flavor: '分金定穴，财帛动人心。',
      desc: '立即玉璧+80，但本层受伤+12%、敌人攻击+6%',
      jade: 80, dmgTakenMul: 0.12, enemyAtkMul: 0.06,
    },
  ] as {
    id: EventId; name: string; flavor: string; desc: string
    jade?: number; expPills?: number; startRage?: number
    atkMul?: number; dmgTakenMul?: number; enemyAtkMul?: number
  }[],
} as const

// 种子随机（层数→[0,1) 哈希），同一层数的精英/词缀结果固定，保证可复盘
function seeded(floor: number, salt: number): number {
  let h = (floor + salt * 0x9E3779B9) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad)
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97)
  h ^= h >>> 15
  return (h >>> 0) / 4294967296
}

export function enemiesOfFloor(floor: number): EnemyDef[] {
  const lo = Math.min(floor - 1, TOWER_CURVE.softenFloor - 1)
  const hi = Math.max(0, floor - TOWER_CURVE.softenFloor)
  const hpMul = Math.pow(TOWER_CURVE.hpGrowth, lo) * Math.pow(TOWER_CURVE.hpGrowthHigh, hi)
  const atkMul = Math.pow(TOWER_CURVE.atkGrowth, lo) * Math.pow(TOWER_CURVE.atkGrowthHigh, hi)
  const isBoss = floor % 5 === 0
  // Boss 血量倍率随阶层递增（第5层1.8、第10层2.1、第15层2.4……）
  const bossMul = BOSS_MECHANICS.hpMul + BOSS_MECHANICS.hpMulPerTier * (Math.floor(floor / 5) - 1)
  const scale = (b: typeof ENEMY_BASES[number], boss = false): EnemyDef => ({
    ...b,
    hp: Math.round(b.hp * hpMul * (boss ? bossMul : 1)),
    atkMin: Math.round(b.atkMin * atkMul),
    atkMax: Math.round(b.atkMax * atkMul),
    def: Math.round(b.def + TOWER_CURVE.defPerFloor * (floor - 1)),
    tough: b.tough + TOWER_CURVE.toughPerFloor * (floor - 1) + (boss ? 60 : 0),
    isBoss: boss,
    name: boss ? `${b.name}头领` : b.name,
  })
  // 第1层为教学层：单挑山贼，保证首战必胜（v2 调整）
  let out: EnemyDef[]
  if (floor === 1) out = [scale(ENEMY_BASES[0])]
  else if (isBoss) {
    // Boss 层 = 单体首领战，突出阶段机制而非数量堆叠
    // 首领轮换：山贼(5)→快刀手(10)→恶霸(15)……高气血基底落在更深阶层，配合阶层血量倍率形成梯度
    const BOSS_ROTATION = [0, 2, 1]
    out = [scale(ENEMY_BASES[BOSS_ROTATION[(Math.floor(floor / 5) - 1) % BOSS_ROTATION.length]], true)]
  } else {
    // 每关敌人组合随波次变化
    const comp = floor % 3
    if (comp === 1) out = [scale(ENEMY_BASES[0]), scale(ENEMY_BASES[1])]
    else if (comp === 2) {
      // 第10层起波次收敛为双个体：三敌人波次的3倍出手行动经济
      // 在高层攻击曲线下对线性气血成长无解（自检暴露），数量压力转为质量压力
      out = floor >= TOWER_CURVE.softenFloor
        ? [scale(ENEMY_BASES[2]), scale(ENEMY_BASES[0])]
        : [scale(ENEMY_BASES[2]), scale(ENEMY_BASES[0]), scale(ENEMY_BASES[0])]
    }
    else out = [scale(ENEMY_BASES[1]), scale(ENEMY_BASES[2])]
  }
  // 精英词缀：第3层起的普通层按种子概率刷出（boss层不刷，避免与阶段机制叠加失控）
  if (!isBoss && floor >= ELITE.startFloor && seeded(floor, 1) < ELITE.chance) {
    const idx = Math.floor(seeded(floor, 2) * out.length)
    const affixIds = Object.keys(ELITE.affixes) as AffixId[]
    const affix = affixIds[Math.floor(seeded(floor, 3) * affixIds.length)]
    const e = out[idx]
    out[idx] = {
      ...e, elite: true, affixes: [affix], name: `精英·${e.name}`,
      hp: Math.round(e.hp * ELITE.hpMul),
      atkMin: Math.round(e.atkMin * ELITE.atkMul),
      atkMax: Math.round(e.atkMax * ELITE.atkMul),
      spd: e.spd + (affix === 'xunjie' ? (ELITE.affixes.xunjie.spdAdd ?? 0) : 0),
    }
  }
  // 大关底（每10层）：头领开局带1个护卫
  if (isBoss && floor % BOSS_MECHANICS.guardEvery === 0) {
    const g = scale(ENEMY_BASES[0])
    out.push({ ...g, isGuard: true, name: '护卫·山贼', hp: Math.round(g.hp * BOSS_MECHANICS.guardHpMul) })
  }
  return out
}

// ---------- 关卡奖励 ----------
export function floorReward(floor: number) {
  const eliteCount = enemiesOfFloor(floor).filter(e => e.elite).length
  return {
    jade: 12 + 3 * floor + (floor % 5 === 0 ? 40 : 0) + eliteCount * ELITE.jadeBonus, // boss层/精英额外奖励
    expPills: 2 + Math.floor(floor / 2),
  }
}

// ---------- 养成曲线 ----------
// 经验需求 = 线性项 + 幂次项：前期升级快（正反馈），后期放缓（拉长养成线）
export function expNeed(level: number): number {
  return Math.round(50 * level + 25 * Math.pow(level, 1.7))
}
export const LEVEL_CAP = 60
export const EXP_PILL_VALUE = 100
// 每级属性成长：攻击/气血 +6%（基于1级基础值线性成长，保证曲线可预期）
export const GROWTH_PER_LEVEL = 0.06
// 每升一星：全属性 +8%（升星为稀有投放，独立乘区，收益不稀释）
export const GROWTH_PER_STAR = 0.08

// ---------- 抽卡概率与保底 ----------
// 参照行业通行模型：基础概率低 + 软保底递增 + 硬保底封顶 + 小保底（10连必得4★）
export const GACHA = {
  costPerPull: 160,          // 单抽价格（玉璧）
  base5: 0.012,              // 5★基础概率
  softPityStart: 74,         // 第74抽起进入软保底
  softPityStep: 0.06,        // 软保底每抽 +6%
  hardPity: 90,              // 90抽硬保底必得5★
  base4: 0.051,              // 4★基础概率
  pity4: 10,                 // 10抽内必得4★及以上
} as const

// 单抽5★概率（含软/硬保底）
export function prob5(pullsSince5: number): number {
  const n = pullsSince5 + 1
  if (n >= GACHA.hardPity) return 1
  if (n >= GACHA.softPityStart) return Math.min(1, GACHA.base5 + GACHA.softPityStep * (n - GACHA.softPityStart + 1))
  return GACHA.base5
}

export function poolByRarity(r: 3 | 4 | 5) {
  return HEROES.filter(h => h.rarity === r)
}

// ---------- 新手续航 ----------
export const INITIAL_SAVE = {
  jade: 1600,      // 开局送十连
  expPills: 10,
}
