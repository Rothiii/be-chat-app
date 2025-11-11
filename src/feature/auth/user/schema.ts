import { getTableColumns, type InferSelectModel } from "drizzle-orm";
import { boolean, pgSchema, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import type z from "zod";


export const chatFlutterSchema = pgSchema('chat-flutter');

// Define the users table
export const users = chatFlutterSchema.table("users", {
    id: text("id").primaryKey(),
    name: varchar("name").notNull(),
    email: varchar("email").notNull().unique(),
    password: varchar("password").notNull(),
    image: varchar("image"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const insertUsersSchema = createInsertSchema(users);
export const updateUsersSchema = createInsertSchema(users).omit({ createdAt: true });

export type Users = InferSelectModel<typeof users>;
export type NewUsers = z.infer<typeof insertUsersSchema>;
export type UpdateUsers = z.infer<typeof updateUsersSchema>;

export const UsersColumns = getTableColumns(users);
