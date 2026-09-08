import { useState } from 'react'
import { ARTIFACTS, JUDGE_CARDS, ROSTER, RULES, STRATEGY_CARDS } from '@contracts/game'
import type { ArtifactId, CharId, JudgeCard } from '@contracts/game'
import HotSeat from './HotSeat'
import Online from './Online'
import { BookMarked, BookOpen, Dices, Gem, GraduationCap, Layers, Star, Users, Wifi, Zap } from 'lucide-react'
import { SectionTitle } from '../../components/seal'
import GuideSteps from '../../components/GuideSteps'

const C = { faint: 'var(--ink-faint)', soft: 'var(--ink-soft)', cinnabar: 'var(--cinnabar)', gold: 'var(--gold)', ink: 'var(--ink)' }

/** 论剑模式入口：同屏双人 / 联网对战 / 规则书 */
export default function LunjianTab() {
  const [mode, setMode] = useState<'menu' | 'hotseat' | 'online' | 'rules'>('menu')

  if (mode === 'hotseat') return (
    <div className="space-y-3 page-enter">
      <BackBar label="同屏双人 · 传手机轮流暗置" onBack={() => setMode('menu')} />
      <HotSeat />
    </div>
  )
  if (mode === 'online') return (
    <div className="space-y-3 page-enter">
      <BackBar label="联网对战" onBack={() => setMode('menu')} />
      <Online />
    </div>
  )
  if (mode === 'rules') return (
    <div className="space-y-3 page-enter">
      <BackBar label="论剑规则书" onBack={() => setMode('menu')} />
      <RulesView />
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="paper-panel px-4 py-3">
        <div className="font-display text-lg tracking-widest">代号：问剑 · 论剑</div>
        <div className="text-xs mt-1 leading-5" style={{ color: C.soft }}>
          五局三胜 · 大局套三小轮 · 公共池抽4选3强制布阵 · 对子/三条可升星强化绝技 · 盖牌站位 · 策略卡盲盖 · 判定卡联动三率 ·
          法器跨大局培养 · AP 利息经济 · 层级结算（存活数→伤害量→平轮）。
        </div>
      </div>
      <button className="paper-panel w-full px-4 py-5 text-left min-h-[64px]" onClick={() => setMode('hotseat')}>
        <div className="font-display text-lg tracking-widest flex items-center gap-2">
          <Users size={18} style={{ color: C.soft }} />同屏双人
        </div>
        <div className="text-xs mt-1" style={{ color: C.faint }}>一部手机轮流操作，幕布遮信息，当面开打</div>
      </button>
      <button className="paper-panel w-full px-4 py-5 text-left min-h-[64px]" onClick={() => setMode('online')}>
        <div className="font-display text-lg tracking-widest flex items-center gap-2" style={{ color: C.cinnabar }}>
          <Wifi size={18} />联网对战
        </div>
        <div className="text-xs mt-1" style={{ color: C.faint }}>建房拿码发给朋友，异地也能论剑</div>
      </button>
      <button className="paper-panel w-full px-4 py-5 text-left min-h-[64px]" onClick={() => setMode('rules')}>
        <div className="font-display text-lg tracking-widest flex items-center gap-2" style={{ color: C.gold }}>
          <BookOpen size={18} />论剑规则书
        </div>
        <div className="text-xs mt-1" style={{ color: C.faint }}>侠客名录 · 卡牌图鉴 · 法器谱 · 结算细则</div>
      </button>
    </div>
  )
}

function BackBar({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <button className="btn-ink text-xs px-3 py-1" onClick={onBack}>← 返回</button>
      <span className="text-xs" style={{ color: C.faint }}>{label}</span>
    </div>
  )
}

function Sec({ title, seal, gold, icon, children }: { title: string; seal?: string; gold?: boolean; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="paper-panel px-3 py-2.5">
      <SectionTitle title={title} seal={seal} gold={gold} icon={icon} />
      {children}
    </div>
  )
}

const ULT_DESC: Record<string, string> = {
  连珠: '3 AP · 对指定敌槽连击两次（各 0.8 倍）',
  炎爆: '3 AP · 对指定敌槽 2.5 倍重击',
  嘲讽: '3 AP · 强制敌方攻击最高者下次普攻改打自己（跟随本人，换位不解）',
  反伤甲: '3 AP · 本大局反弹所受伤害 20%',
  回春: '3 AP · 治疗己方气血比例最低者 30% 上限',
  鼓舞: '3 AP · 指定己方一人，下次攻击 +50%（跟随本人）',
}

/** 升星绝技三档（与 contracts/game.ts 的 STAR_RULES 定稿一致） */
const STAR_ULT_DESC: Record<string, [string, string, string]> = {
  连珠:   ['Lv1 两段×0.8', 'Lv2 三段×0.85', 'Lv3 四段×0.85'],
  炎爆:   ['Lv1 2.5×单体', 'Lv2 2.5×+溅射1.25×', 'Lv3 3.0×+溅射1.5×'],
  嘲讽:   ['Lv1 锁攻击最高1人', 'Lv2 锁2人', 'Lv3 锁全体'],
  反伤甲: ['Lv1 反弹20%', 'Lv2 反弹20%+自疗15%上限', 'Lv3 反弹30%+自疗25%上限'],
  回春:   ['Lv1 最低者30%上限', 'Lv2 全体20%上限', 'Lv3 全体30%上限'],
  鼓舞:   ['Lv1 单人+50%', 'Lv2 双目标+50%', 'Lv3 全队+50%'],
}

/** 可展开的图鉴条目：点标题展开/收起详情 */
function CodexRow({ head, meta, detail, tone }: { head: string; meta: string; detail: string; tone?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="dashed-divider first:border-0 first:pt-0 pt-1.5">
      <button
        type="button"
        className="w-full text-left flex items-baseline gap-1.5 min-h-[44px] py-1"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <b className="font-display text-sm" style={{ color: tone ?? C.ink }}>{head}</b>
        <span className="text-xs truncate" style={{ color: C.faint }}>{meta}</span>
        <span className="ml-auto text-xs shrink-0" style={{ color: C.faint }}>{open ? '收起 ▲' : '详情 ▼'}</span>
      </button>
      {open && (
        <div className="rise-in text-xs leading-5 pb-2 pl-1 whitespace-pre-line" style={{ color: C.soft }}>{detail}</div>
      )}
    </div>
  )
}

const GUIDE_STEPS = [
  {
    title: '一 · AP 与结存',
    seal: '息',
    body: `每大局发放 ${RULES.apPerDazhe} AP。普攻 1 AP，绝技 3 AP，换位 1 AP，策略卡 1 AP。未用完的 AP 按 ×${RULES.apCarry} 结存到下一大局，上限 ${RULES.apCap}；盖「节流」则按 ×${RULES.apCarryThrift} 结存。`,
  },
  {
    title: '二 · 槽位与集火',
    seal: '集',
    body: '普攻指定敌方槽位，不是指定人。封盘先比存活数：三人两轮集火同一槽位 ≈ 击杀一人。',
  },
  {
    title: '三 · 换位',
    seal: '换位',
    body: '换位 1 AP，每小轮限 1 次。暗置，结算前双方同时生效，指向原槽位的攻击落到换位后的人身上。',
  },
]

function RulesView() {
  return (
    <div className="space-y-3 text-xs leading-5" style={{ color: C.soft }}>
      <Sec title="对局结构" seal="局" icon={<Layers size={14} style={{ color: C.cinnabar }} />}>
        五局三胜（先取 {RULES.winScore} 子，{RULES.maxDazhe} 局封顶，战平掷签）。每大局 = 布阵 → {RULES.roundsPerDazhe} 小轮暗置指令 → 封盘结算。
        封盘比<b>存活数</b>，持平比<b>伤害量</b>，再持平记平轮。气血每大局重置，AP 未用完按 ×{RULES.apCarry} 利息结存（上限 {RULES.apCap}）。
      </Sec>

      <Sec title="侠客名录" seal="侠" icon={<Users size={14} style={{ color: C.cinnabar }} />}>
        <div>
          {(Object.keys(ROSTER) as CharId[]).map(c => {
            const d = ROSTER[c]
            return (
              <CodexRow
                key={c}
                head={d.name}
                meta={`${d.role} · ${d.typ === 'P' ? '物理' : '法术'}${d.lo}~${d.hi} · 速${d.spd}`}
                detail={`血 ${d.hp} · 双抗 ${d.resP}/${d.resM} · 精准 ${Math.round(d.prec * 100)}% · 致命 ${Math.round(d.crit * 100)}% · 神妙 ${Math.round(d.ins * 100)}%\n绝技·${d.ult}：${ULT_DESC[d.ult]}`}
              />
            )
          })}
        </div>
      </Sec>

      <Sec title="升星 · 绝技强化" seal="星" gold icon={<Star size={14} style={{ color: C.gold }} />}>
        <div>
          布阵摸 4 张出现<b>对子（≈60%）</b>可合 <b>2★</b>：消耗 2 张同名手牌，绝技升 Lv2、面板（气血/攻击）+5%，<b>仍上 3 人</b>；
          出现<b>三条（≈2.9%）</b>可合 <b>3★</b>：消耗 3 张同名，绝技升 Lv3、面板 +10%，<b>少上 1 人（只上 2 人）</b>。
          合成在布阵面板点大按钮触发，翻牌时公开；不合成则按原规则上场。
          合成与不合成强度接近，是风格选择而非唯一最优解。
        </div>
        <div className="mt-1.5">
          {(Object.keys(ROSTER) as CharId[]).map(c => {
            const d = ROSTER[c]
            const [lv1, lv2, lv3] = STAR_ULT_DESC[d.ult]
            return (
              <CodexRow
                key={`star-${c}`}
                head={`${d.name} · ${d.ult}`}
                meta={lv1}
                detail={`${lv1}\n${lv2}（+面板5%）\n${lv3}（+面板10%，少上1人）`}
                tone={C.gold}
              />
            )
          })}
        </div>
      </Sec>

      <Sec title="行动与 AP（每大局发放 8 点）" seal="令" icon={<Zap size={14} style={{ color: C.cinnabar }} />}>
        普攻 1 AP（指<b>敌方槽位</b>：打的是位置，对方换位可令集火扑空）· 绝技 3 AP（需满内力，普攻一次积满）·
        换位 1 AP（每小轮限 1 次，暗置，结算前双方同时生效，不占行动，指令跟随本人）·
        策略卡 1 AP（每大局限盖 1 张）· 判定卡 0 AP · 法器 1 AP/件（指定获取）。
      </Sec>

      <Sec title="策略卡（盲盖，翻牌才公开）" seal="策" icon={<BookMarked size={14} style={{ color: C.cinnabar }} />}>
        <div>
          {Object.entries(STRATEGY_CARDS).map(([k, v]) => (
            <CodexRow key={k} head={k} meta={`${v.cat} · ${needsTargetLabel(v.needsTarget)}`} detail={v.desc} tone={C.cinnabar} />
          ))}
        </div>
      </Sec>

      <Sec title="判定卡（盖在人物卡下，联动三率）" seal="判" icon={<Dices size={14} style={{ color: C.cinnabar }} />}>
        <div>
          {(Object.keys(JUDGE_CARDS) as JudgeCard[]).map(k => (
            <CodexRow key={k} head={k} meta="0 AP · 盖在人物卡下" detail={JUDGE_CARDS[k].desc} tone={C.ink} />
          ))}
        </div>
        <div className="mt-1" style={{ color: C.faint }}>
          判定树：神妙（按满攻结算 ×1.35）→ 擦碰（按下限 ×0.6）→ 致命（×1.5，三率溢出转爆伤）→ 命中。
        </div>
      </Sec>

      <Sec title="法器谱（1 AP/件指定获取，跨大局培养，每人限 2 件）" seal="器" gold icon={<Gem size={14} style={{ color: C.gold }} />}>
        <div>
          {(Object.keys(ARTIFACTS) as ArtifactId[]).map(k => (
            <CodexRow key={k} head={`「${k}」`} meta="跨大局生效" detail={ARTIFACTS[k].desc} tone={C.gold} />
          ))}
        </div>
      </Sec>

      <Sec title="新手入门 · 三条规则" seal="学" icon={<GraduationCap size={14} style={{ color: C.cinnabar }} />}>
        <GuideSteps steps={GUIDE_STEPS} />
      </Sec>
    </div>
  )
}

function needsTargetLabel(t: 'enemy' | 'ally' | 'ally2' | null): string {
  return t === 'enemy' ? '盲指敌槽' : t === 'ally' ? '指己方一人' : t === 'ally2' ? '指己方两人' : '无需目标'
}
