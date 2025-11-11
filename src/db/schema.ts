import { pgTable, text, timestamp, uuid, boolean, pgEnum, pgSchema } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Define custom schema
export const chatFlutterSchema = pgSchema('chat-flutter');

// Message status enum
export const messageStatusEnum = chatFlutterSchema.enum('message_status', ['sent', 'delivered', 'read']);

// Users table (synced with Supabase Auth)
export const users = chatFlutterSchema.table('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  username: text('username'),
  avatarUrl: text('avatar_url'),
  isOnline: boolean('is_online').default(false),
  lastSeen: timestamp('last_seen'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Conversations table
export const conversations = chatFlutterSchema.table('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
  isGroup: boolean('is_group').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Conversation participants (many-to-many relationship)
export const conversationParticipants = chatFlutterSchema.table('conversation_participants', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  lastReadAt: timestamp('last_read_at'),
});

// Messages table
export const messages = chatFlutterSchema.table('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  senderId: uuid('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  status: messageStatusEnum('status').default('sent'),
  isEdited: boolean('is_edited').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  sentMessages: many(messages),
  conversationParticipants: many(conversationParticipants),
}));

export const conversationsRelations = relations(conversations, ({ many }) => ({
  messages: many(messages),
  participants: many(conversationParticipants),
}));

export const conversationParticipantsRelations = relations(conversationParticipants, ({ one }) => ({
  conversation: one(conversations, {
    fields: [conversationParticipants.conversationId],
    references: [conversations.id],
  }),
  user: one(users, {
    fields: [conversationParticipants.userId],
    references: [users.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export type ConversationParticipant = typeof conversationParticipants.$inferSelect;
export type NewConversationParticipant = typeof conversationParticipants.$inferInsert;
