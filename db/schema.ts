import {
  mysqlTable,
  serial,
  varchar,
  json,
  timestamp,
  index,
} from "drizzle-orm/mysql-core";

/** 论剑房间：整局状态为一个 JSON（MatchState），轮询同步 */
export const lunjianRooms = mysqlTable(
  "lunjian_rooms",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 8 }).notNull().unique(),
    hostToken: varchar("host_token", { length: 64 }).notNull(),
    guestToken: varchar("guest_token", { length: 64 }),
    state: json("state").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    codeIdx: index("code_idx").on(table.code),
  }),
);

export type LunjianRoom = typeof lunjianRooms.$inferSelect;
