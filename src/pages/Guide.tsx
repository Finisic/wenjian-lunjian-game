import { BookOpen, Coins, Mountain, ScrollText, Swords, TrendingUp } from 'lucide-react'
import { BOSS_MECHANICS, COMBAT, ELITE, GACHA, PVE_EVENTS, TOWER_CURVE } from '../game/config'
import type { AffixId } from '../game/types'

function Block({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="paper-panel p-4">
      <h3 className="font-display tracking-widest mb-3 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  )
}

export default function Guide() {
  return (
    <div className="space-y-4 text-sm leading-relaxed">
      <section className="paper-panel p-5 relative overflow-hidden">
        <div className="seal mb-2">玩法说明</div>
        <h2 className="font-display text-xl tracking-widest mb-2 flex items-center gap-2">
          <BookOpen size={20} style={{ color: 'var(--cinnabar)' }} />
          侠客行 · 规则一览
        </h2>
        <p style={{ color: 'var(--ink-soft)' }}>
          爬塔推层，闯关得玉璧与经验丹；养成侠客、寻侠抽卡，挑战更高层。
          本页数值与游戏内实际生效规则一致。
        </p>
        <div className="mtn-silhouette" aria-hidden="true" />
      </section>

      <Block title="一 · 伤害公式" icon={<Swords size={15} style={{ color: 'var(--cinnabar)' }} />}>
        <div className="paper-panel p-3 mb-3 font-mono text-xs" style={{ background: 'rgba(33,29,22,0.04)' }}>
          伤害 = (攻击取值 × 技能倍率 − 目标防御) × 判定倍率 × 气竭加成
          <br />攻击取值 ∈ U[最小攻击, 最大攻击]
        </div>
        <ul className="list-disc pl-5 space-y-1" style={{ color: 'var(--ink-soft)' }}>
          <li><b>基础区</b>：攻击−防御。防御只做减法。</li>
          <li><b>判定区</b>：会意×{(1.35).toFixed(2)} / 会心×{(1.5).toFixed(1)}（含溢出转化） / 擦伤×{COMBAT.grazeMult} / 白字×1.0。</li>
          <li><b>窗口区</b>：气竭两回合受伤+{(COMBAT.exhaustDmgBonus * 100).toFixed(0)}%，削韧打空可制造爆发窗口。</li>
        </ul>
      </Block>

      <Block title="二 · 三率判定" icon={<ScrollText size={15} style={{ color: 'var(--cinnabar)' }} />}>
        <p className="mb-2" style={{ color: 'var(--ink-soft)' }}>
          判定顺序：<b>会意 → 精准 → 会心</b>，后置判定的实际触发率 = 面板率 × 前置全部未中的概率。
          白字概率随覆盖率平滑收敛到 0；会意+会心超出 100% 的部分按 {(COMBAT.overflowConvert * 100).toFixed(0)}% 转化为会心伤害，溢出仍有收益。
        </p>
      </Block>

      <Block title="三 · 抽卡保底" icon={<Coins size={15} style={{ color: 'var(--gold)' }} />}>
        <table className="w-full text-xs tnum mb-2">
          <tbody>
            <tr className="border-b" style={{ borderColor: 'rgba(33,29,22,0.15)' }}>
              <td className="py-1.5">5★ 基础概率</td><td className="text-right">{(GACHA.base5 * 100).toFixed(1)}%</td>
            </tr>
            <tr className="border-b" style={{ borderColor: 'rgba(33,29,22,0.15)' }}>
              <td className="py-1.5">软保底</td><td className="text-right">第{GACHA.softPityStart}抽起每抽+{(GACHA.softPityStep * 100).toFixed(0)}%</td>
            </tr>
            <tr>
              <td className="py-1.5">硬保底 / 小保底</td><td className="text-right">{GACHA.hardPity}抽必得5★ / {GACHA.pity4}抽必得4★</td>
            </tr>
          </tbody>
        </table>
        <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>
          「寻侠」页内置成本模拟器，可实机模拟 5 万名玩家的 5★ 抽数分布。
        </p>
      </Block>

      <Block title="四 · 成长曲线" icon={<TrendingUp size={15} style={{ color: 'var(--cinnabar)' }} />}>
        <ul className="list-disc pl-5 space-y-1" style={{ color: 'var(--ink-soft)' }}>
          <li><b>升级经验</b>：expNeed = 50L + 25L<sup>1.7</sup>。</li>
          <li><b>属性成长</b>：每级+6%基础攻击/气血；升星+8%全属性（独立乘区）。</li>
          <li><b>敌人成长</b>：气血×{TOWER_CURVE.hpGrowth}/层，攻击×{TOWER_CURVE.atkGrowth}/层，防御+{TOWER_CURVE.defPerFloor}/层。</li>
          <li><b>高层衰减</b>：第{TOWER_CURVE.softenFloor}层起气血×{TOWER_CURVE.hpGrowthHigh}、攻击×{TOWER_CURVE.atkGrowthHigh}。</li>
        </ul>
      </Block>

      <Block title="五 · 战斗复盘" icon={<ScrollText size={15} style={{ color: 'var(--ink-faint)' }} />}>
        <p style={{ color: 'var(--ink-soft)' }}>
          每场战斗结束展示「实测伤害 vs 理论期望」「三率判定分布」，可对照检验本场运气。
        </p>
      </Block>

      <Block title="六 · 奇遇 / 精英词缀 / Boss 机制" icon={<Mountain size={15} style={{ color: 'var(--cinnabar)' }} />}>
        <div className="space-y-3">
          <div>
            <div className="font-display mb-1" style={{ color: 'var(--cinnabar)' }}>奇遇事件（每通关{PVE_EVENTS.triggerEvery}层三选一）</div>
            <table className="w-full text-xs tnum">
              <tbody>
                {PVE_EVENTS.choices.map(c => (
                  <tr key={c.id} className="border-b" style={{ borderColor: 'rgba(33,29,22,0.15)' }}>
                    <td className="py-1.5 font-display">{c.name}</td>
                    <td className="py-1.5 text-right" style={{ color: 'var(--ink-soft)' }}>{c.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="huiwen-divider" aria-hidden="true" />
          <div>
            <div className="font-display mb-1" style={{ color: 'var(--cinnabar)' }}>
              精英词缀（第{ELITE.startFloor}层起普通层 {(ELITE.chance * 100).toFixed(0)}% 概率，气血×{ELITE.hpMul} 攻击×{ELITE.atkMul}，击杀+{ELITE.jadeBonus}玉璧）
            </div>
            <table className="w-full text-xs tnum">
              <tbody>
                {(Object.keys(ELITE.affixes) as AffixId[]).map(a => (
                  <tr key={a} className="border-b" style={{ borderColor: 'rgba(33,29,22,0.15)' }}>
                    <td className="py-1.5"><span className="seal" style={{ fontSize: 11 }}>{ELITE.affixes[a].name}</span></td>
                    <td className="py-1.5 text-right" style={{ color: 'var(--ink-soft)' }}>{ELITE.affixes[a].desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs mt-1" style={{ color: 'var(--ink-faint)' }}>
              精英刷新按层数固定——预览、实战一致，可提前研究打法。
            </p>
          </div>
          <div className="huiwen-divider" aria-hidden="true" />
          <div>
            <div className="font-display mb-1" style={{ color: 'var(--cinnabar)' }}>Boss 阶段机制（每5层）</div>
            <ul className="list-disc pl-5 space-y-1 text-xs" style={{ color: 'var(--ink-soft)' }}>
              <li><b>困兽</b>：气血跌破{(BOSS_MECHANICS.corneredBelow * 100).toFixed(0)}% 后攻击×{BOSS_MECHANICS.corneredAtkMul}、受伤+{((BOSS_MECHANICS.corneredDmgTakenMul - 1) * 100).toFixed(0)}%。</li>
              <li><b>护卫</b>：每{BOSS_MECHANICS.guardEvery}层大关底开局带1名护卫（同层山贼×{BOSS_MECHANICS.guardHpMul}气血）。</li>
              <li>Boss 层为单体首领战：血量×{BOSS_MECHANICS.hpMul}起、每深入一个阶层（5层）+{BOSS_MECHANICS.hpMulPerTier}；第{TOWER_CURVE.softenFloor}层起普通层波次收敛为双个体。</li>
            </ul>
          </div>
        </div>
      </Block>

      <p className="text-center text-xs pt-2 pb-4" style={{ color: 'var(--ink-faint)' }}>
        本页所有公式与参数与游戏内实际规则一致
      </p>
    </div>
  )
}
