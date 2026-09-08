# sim/ — 《问剑·论剑》蒙特卡洛策略模拟器

直接 import `contracts/game.ts`（线上同款规则引擎，纯函数 + JSON 状态），用 AI 机器人驱动整局 Bo5，
批量跑对局并输出带 95% 置信区间的胜率统计。**规则即真相**：模拟器内不含任何战斗/结算逻辑。

## 运行

```bash
# 方式一（推荐）：esbuild 打包后 node 运行
npm run sim -- anchors   # 任务1·锚点回归（镜像组 2 万局，其余 5000 局）
npm run sim -- thrift    # 任务2·节流银行流全参数扫描（定稿组 2 万局）
npm run sim -- stars     # 任务3·升星绝技强化（每侠客 2 万局）
npm run sim -- extras    # 锚点超差查因的补充实验
npm run sim -- all       # 全部

# 方式二：vitest 冒烟（小样本，验证链路/可复现性/方向）
npx vitest run sim/
```

结果写入 `sim/results/*.json`，控制台同步打印。`npm run check`（tsc -b）覆盖 sim/ 目录。

## 随机性可复现

引擎用 `Math.random`（洗牌/三率判定/伤害区间）。`harness.runExperiment` 在每组实验前把
`Math.random` 替换为 `mulberry32(seed)`，实验结束恢复原实现；每组实验的 seed 记录在结果 JSON 里。
同一 seed 重跑结果逐字节一致（有 vitest 用例保证）。每场实验左右座位对半互换，消除位置偏差。

## AI 策略如何抽象（bots.ts）

一个机器人 = 布阵策略 + 盖牌方案 + 行动策略，全部只读 `clientView`（与真人相同的信息集）：

- **布阵**：按「质量表」从 4 张手牌选 3 张（均衡表：输出>辅助>坦克；全肉表：丙丁优先）；
  可叠加**升星合成方案**（摸到指定对子/三条时合成 2★/3★）。
- **盖牌**：参数化的策略卡（`planStrategy`：掣肘盲指 0 号位——稳打流按质量降序落位是公开习惯；
  叫阵给主 C；金疮药保最脆皮；拆招/节流无目标）、判定卡（`planJudge`：盖给攻击最高者）、
  法器方案（`planArtifacts`：每大局指定 1 件，适配优先）。
- **行动**：集火目标 = 击杀所需攻击次数最少（血 ÷ 我方期望每击），同次数取威胁最大；
  **AP 预算**：给未来每个小轮的每人留 1 次普攻的 AP，超出保底才允许砸绝技，
  绝技另设斩杀闸门（预计能击杀时立即放）——先手击杀可抹掉对方未兑现的行动；
  **AP 地板**（挂机/银行流）：大局结束时保留的最低 AP，吃 ×1.5/×2 利息结存，赛点自动全仓；
  **换位闪避**：第 2/3 小轮预判对面续火，把最残者换去最壮者槽位（1 AP）；
  **读换位反打**：直接集火对面最壮者槽位（预判换向落点）。

机器人清单：`steadyFocus`（v3.1 基线）/ `idleSaver` / `bankThrift` / `allTank` / `swapDodge` / `readSwap`，
盖牌与升星方案均可参数化叠加。

## 结果怎么读（results/*.json）

```jsonc
{
  "experiment": "anchor/镜像基线",
  "seed": 11000,              // 复现用种子
  "matches": 20000,           // 局数（左右互换对半）
  "a": { "winrate": 0.509, "eps": 0.007, "lo": 0.502, "hi": 0.516 },
                              // A 方胜率与 95% 置信区间（±1.96√(p(1-p)/n)）
  "avgKillsPerDazhe": 1.03,   // 大局均击杀（健康区间 1.5~2.5，见策划案§十一）
  "avgDazhes": 4.2,           // 场均大局数
  "drawDazheRate": 0.0006,    // 平轮率
  "rules": { "apCap": 24 }    // 本实验的规则参数覆盖（如有）
}
```

`stars.json` 另有：对子/三条出现率、首大局有/无对子的条件胜率（方差评估）。

## 升星扩展（任务3）

`contracts/game.ts` 新增 `STAR_RULES` 与 `DraftPick.stars`（**默认不启用**，不传 stars 时与 v3.1 完全一致，
锚点回归可证）。布阵摸 4 张出现对子/三条时可合成：2★=绝技 Lv2+面板 +5%（仍上 3 人）；
3★=绝技 Lv3+面板 +10%（少上 1 人）。各侠客 Lv2/Lv3 绝技质变方案见 `STAR_RULES` 注释与 REPORT.md 定稿表。

## 文件

- `harness.ts` — 对局驱动（newMatch/submitDraft/submitOrders/advanceDazhe）+ 实验运行器
- `bots.ts` — 策略机器人库
- `rng.ts` — mulberry32 + Math.random 替换/恢复
- `stats.ts` — 胜率 95% 置信区间、结果落盘
- `runs/` — 每个实验一个脚本（anchors/thrift/stars/extras + CLI run.ts）
- `results/` — 实验结果 JSON
- `REPORT.md` — 中文调参报告
