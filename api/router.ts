import { createRouter, publicQuery } from "./middleware";
import { lunjianRouter } from "./lunjianRouter";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  lunjian: lunjianRouter,
});

export type AppRouter = typeof appRouter;
