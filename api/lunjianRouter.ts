import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { lunjianRooms } from "@db/schema";
import { eq } from "drizzle-orm";
import {
  newMatch, submitDraft, submitOrders, advanceDazhe,
  validateDraft, validateOrders, clientView,
} from "@contracts/game";
import type { MatchState } from "@contracts/game";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const roomCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
const token = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

class GameError extends Error {}

async function loadRoom(code: string) {
  const room = await getDb().query.lunjianRooms.findFirst({ where: eq(lunjianRooms.code, code.toUpperCase()) });
  if (!room) throw new GameError("房间不存在，检查一下房间码");
  return room;
}

function sideOf(room: { hostToken: string; guestToken: string | null }, tk: string): 0 | 1 {
  if (tk === room.hostToken) return 0;
  if (tk === room.guestToken) return 1;
  throw new GameError("你不是这局的玩家");
}

async function saveRoom(id: number, state: MatchState) {
  await getDb().update(lunjianRooms).set({ state }).where(eq(lunjianRooms.id, id));
}

const draftInput = z.object({
  code: z.string().min(4).max(8),
  token: z.string().min(8),
  // 升星实装：3★ 三合一少上 1 人（picks=2），否则上 3 人；stars 与 picks 平行（可选，不传即 v3.1）
  picks: z.array(z.number().int()).min(2).max(3),
  stars: z.array(z.union([z.literal(2), z.literal(3)]).optional()).max(3).optional(),
  strategy: z.object({
    card: z.enum(["拆招", "节流", "掣肘", "金疮药", "叫阵", "移形"]),
    a: z.number().int().min(0).max(2).optional(),
    b: z.number().int().min(0).max(2).optional(),
  }).nullable(),
  judge: z.object({
    card: z.enum(["乘势", "稳军", "孤注", "神机妙算"]),
    slot: z.number().int().min(0).max(2),
  }).nullable(),
  artifactDraws: z.array(z.object({
    char: z.enum(["甲", "乙", "丙", "丁", "戊", "己"]),
    artifact: z.enum(["青钢符", "灵羽簪", "玄甲坠", "辟魔铃", "血玉镯", "凝神佩"]),
  })).max(6),
}).superRefine((v, ctx) => {
  // 形状预检（权威校验仍在服务端 validateDraft）：含 3★ 必须只上 2 人
  const hasStar3 = v.stars?.includes(3) ?? false;
  if (hasStar3 && v.picks.length !== 2) {
    ctx.addIssue({ code: "custom", message: "合成 3★ 少上 1 人：picks 必须为 2 张" });
  }
  if (!hasStar3 && v.picks.length !== 3) {
    ctx.addIssue({ code: "custom", message: "未合成 3★ 时 picks 必须为 3 张" });
  }
  if (v.stars && v.stars.length !== v.picks.length) {
    ctx.addIssue({ code: "custom", message: "升星标记与上场数不一致" });
  }
});

const ordersInput = z.object({
  code: z.string().min(4).max(8),
  token: z.string().min(8),
  orders: z.array(z.object({
    slot: z.number().int().min(0).max(2),
    type: z.enum(["attack", "ult", "idle", "swap"]),
    targetSlot: z.number().int().min(0).max(2).optional(),
  })),
});

export const lunjianRouter = createRouter({
  /** 建房：返回房间码 + 甲方身份令牌 */
  create: publicQuery.mutation(async () => {
    const code = roomCode();
    const hostToken = token();
    const state = newMatch();
    state.phase = "waiting";
    state.note = "等待乙方加入…";
    await getDb().insert(lunjianRooms).values({ code, hostToken, state });
    return { code, token: hostToken };
  }),

  /** 加入：返回乙方身份令牌 */
  join: publicQuery
    .input(z.object({ code: z.string().min(4).max(8) }))
    .mutation(async ({ input }) => {
      const room = await loadRoom(input.code);
      if (room.guestToken) throw new GameError("这个房间已经满员了");
      const guestToken = token();
      const state = room.state as MatchState;
      state.phase = "draft";
      state.note = "乙方已入座 · 第一大局布阵";
      await getDb().update(lunjianRooms).set({ guestToken, state }).where(eq(lunjianRooms.id, room.id));
      return { code: room.code, token: guestToken };
    }),

  /** 轮询取状态（按身份脱敏） */
  state: publicQuery
    .input(z.object({ code: z.string(), token: z.string() }))
    .query(async ({ input }) => {
      const room = await loadRoom(input.code);
      const me = sideOf(room, input.token);
      return clientView(room.state as MatchState, me);
    }),

  /** 提交布阵 */
  draft: publicQuery.input(draftInput).mutation(async ({ input }) => {
    const room = await loadRoom(input.code);
    const me = sideOf(room, input.token);
    const state = room.state as MatchState;
    const err = validateDraft(state, me, input);
    if (err) throw new GameError(err);
    submitDraft(state, me, input);
    await saveRoom(room.id, state);
    return clientView(state, me);
  }),

  /** 提交小轮指令 */
  orders: publicQuery.input(ordersInput).mutation(async ({ input }) => {
    const room = await loadRoom(input.code);
    const me = sideOf(room, input.token);
    const state = room.state as MatchState;
    const err = validateOrders(state, me, input.orders);
    if (err) throw new GameError(err);
    submitOrders(state, me, input.orders);
    await saveRoom(room.id, state);
    return clientView(state, me);
  }),

  /** 大局结算后推进（幂等，双方谁点都行） */
  next: publicQuery
    .input(z.object({ code: z.string(), token: z.string() }))
    .mutation(async ({ input }) => {
      const room = await loadRoom(input.code);
      sideOf(room, input.token);
      const state = room.state as MatchState;
      advanceDazhe(state);
      await saveRoom(room.id, state);
      return { ok: true };
    }),

  /** 再战一局：双方令牌均可发起，直接重置 */
  rematch: publicQuery
    .input(z.object({ code: z.string(), token: z.string() }))
    .mutation(async ({ input }) => {
      const room = await loadRoom(input.code);
      sideOf(room, input.token);
      const state = newMatch();
      await saveRoom(room.id, state);
      return { ok: true };
    }),
});
