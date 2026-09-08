/**
 * 升星实装冒烟：直接驱动引擎验证三条布阵路径 + 槽位健壮性。
 * 运行：esbuild 打包后 node 执行（见 npm 脚本外手动命令）。
 */
import { newMatch, submitDraft, validateDraft, clientView, ROSTER } from '../../contracts/game'
import type { DraftPick, CharId } from '../../contracts/game'

let failures = 0
const ok = (cond: boolean, msg: string) => {
  console.log(`${cond ? '✅' : '❌'} ${msg}`)
  if (!cond) failures++
}

function matchWithHand(hand: CharId[]) {
  const s = newMatch()
  s.sides[0].hand = [...hand]
  return s
}
const draft = (picks: number[], stars?: (2 | 3 | undefined)[], extra?: Partial<DraftPick>): DraftPick => ({
  picks, ...(stars ? { stars } : {}), strategy: null, judge: null, artifactDraws: [], ...extra,
})

// ---------- 路径 1：普通 3 人无 stars（v3.1 兼容） ----------
{
  const s = matchWithHand(['甲', '乙', '丙', '丁'])
  const err = validateDraft(s, 0, draft([0, 1, 2]))
  ok(err === null, `普通3人无stars 校验通过（${err}）`)
  submitDraft(s, 0, draft([0, 1, 2]))
  submitDraft(s, 1, draft([0, 1, 2]))
  ok(s.phase === 'orders' && s.sides[0].fighters.length === 3, '双方盖齐 → 3 人上阵进入指令阶段')
  ok(s.sides[0].fighters.every(f => f.star === 1), '无 stars → 全员 1★')
  ok(!s.reveals.some(r => r.includes('合成')), '无 stars → 翻牌无合成信息')
}

// ---------- 路径 2：对子合 2★（仍上 3 人） ----------
{
  const s = matchWithHand(['甲', '甲', '乙', '丙'])
  const err = validateDraft(s, 0, draft([0, 2, 3], [2, undefined, undefined]))
  ok(err === null, `对子2★ 校验通过（${err}）`)
  submitDraft(s, 0, draft([0, 2, 3], [2, undefined, undefined]))
  submitDraft(s, 1, draft([0, 1, 2]))
  const f = s.sides[0].fighters
  ok(f.length === 3 && f[0].star === 2, '2★ 仍上 3 人且 1 号位为 2★')
  ok(f[0].maxhp === Math.round(ROSTER['甲'].hp * 1.05), `2★ 面板 +5%（maxhp=${f[0].maxhp}）`)
  ok(s.reveals.some(r => r.includes('合成 2★') && r.includes('燕惊鸿')), '翻牌公开 2★ 合成信息')
  // 校验拦截：材料不足
  const s2 = matchWithHand(['甲', '乙', '丙', '丁'])
  ok(validateDraft(s2, 0, draft([0, 1, 2], [2, undefined, undefined])) !== null, '无对子合2★ 被拒绝')
  // 校验拦截：2★主卡+同名平卡 超出材料数（3卡价值 from 2卡）
  const s3 = matchWithHand(['甲', '甲', '乙', '丙'])
  ok(validateDraft(s3, 0, draft([0, 1, 2], [2, undefined, undefined])) !== null, '2★+同名平卡 超耗材料被拒绝')
}

// ---------- 路径 3：三条合 3★（只上 2 人） ----------
{
  const s = matchWithHand(['丙', '丙', '丙', '戊'])
  const err = validateDraft(s, 0, draft([0, 3], [3, undefined]))
  ok(err === null, `三条3★ 校验通过（${err}）`)
  submitDraft(s, 0, draft([0, 3], [3, undefined]))
  submitDraft(s, 1, draft([0, 1, 2]))
  const f = s.sides[0].fighters
  ok(f.length === 2 && f[0].star === 3, '3★ 只上 2 人且 1 号位为 3★')
  ok(f[0].maxhp === Math.round(ROSTER['丙'].hp * 1.1), `3★ 面板 +10%（maxhp=${f[0].maxhp}）`)
  ok(s.reveals.some(r => r.includes('合成 3★') && r.includes('铁山河')), '翻牌公开 3★ 合成信息')
  // 校验拦截：含3★但 picks=3
  const s4 = matchWithHand(['丙', '丙', '丙', '戊'])
  ok(validateDraft(s4, 0, draft([0, 1, 3], [3, undefined, undefined])) !== null, '含3★但选3张 被拒绝')
  // 校验拦截：无 stars 时 picks=2
  const s5 = matchWithHand(['甲', '乙', '丙', '丁'])
  ok(validateDraft(s5, 0, draft([0, 1])) !== null, '无3★只选2张 被拒绝')
}

// ---------- 健壮性：3★ 后槽位上限 ----------
{
  // 判定卡 slot=2 在 2 人阵被拒绝
  const s = matchWithHand(['丙', '丙', '丙', '戊'])
  const err = validateDraft(s, 0, draft([0, 3], [3, undefined], { judge: { card: '乘势', slot: 2 } }))
  ok(err !== null, `3★ 2人阵 判定卡 slot=2 被拒绝（${err}）`)
  ok(validateDraft(s, 0, draft([0, 3], [3, undefined], { judge: { card: '乘势', slot: 1 } })) === null, '3★ 2人阵 判定卡 slot=1 通过')
  // 己方策略卡 ally 目标 slot=2 在 2 人阵被拒绝
  ok(validateDraft(s, 0, draft([0, 3], [3, undefined], { strategy: { card: '叫阵', a: 2 } })) !== null, '3★ 2人阵 叫阵 slot=2 被拒绝')
  // 对方先盖 3★（2人）：我方掣肘 slot=2 被拒绝
  const s2 = matchWithHand(['甲', '乙', '丙', '丁'])
  submitDraft(s2, 1, (() => { s2.sides[1].hand = ['丙', '丙', '丙', '戊']; return draft([0, 3], [3, undefined]) })())
  ok(validateDraft(s2, 0, draft([0, 1, 2], undefined, { strategy: { card: '掣肘', a: 2 } })) !== null, '对方2人阵 掣肘 slot=2 被拒绝')
  // 对方后盖 3★：我方先盖掣肘 slot=2 → lockDraft 不崩溃、扑空有揭示
  const s3 = matchWithHand(['甲', '乙', '丙', '丁'])
  submitDraft(s3, 0, draft([0, 1, 2], undefined, { strategy: { card: '掣肘', a: 2 } }))
  s3.sides[1].hand = ['丙', '丙', '丙', '戊']
  let crashed = false
  try {
    submitDraft(s3, 1, draft([0, 3], [3, undefined]))
  } catch (e) {
    crashed = true
    console.error(e)
  }
  ok(!crashed && s3.phase === 'orders', '先盖掣肘 slot=2 vs 后盖3★ → lockDraft 不崩溃')
  ok(s3.reveals.some(r => r.includes('扑空')), '掣肘扑空写入翻牌公开')
  // clientView 不泄漏 _stars
  const v = clientView(s3, 0)
  ok(!('_stars' in v.sides[0]) && !('_stars' in v.sides[1]), 'clientView 剥离 _stars')
  ok(v.sides[1].fighters.length === 2, '联网视图可见对方 3★ 只上 2 人')
}

console.log(failures === 0 ? '\n全部冒烟通过' : `\n${failures} 项失败`)
process.exit(failures === 0 ? 0 : 1)
