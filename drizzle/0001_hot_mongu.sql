CREATE SCHEMA "chat-flutter";
--> statement-breakpoint
CREATE TYPE "chat-flutter"."message_status" AS ENUM('sent', 'delivered', 'read');--> statement-breakpoint
CREATE TABLE "chat-flutter"."conversation_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"last_read_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "chat-flutter"."conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"is_group" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat-flutter"."messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"content" text NOT NULL,
	"status" "chat-flutter"."message_status" DEFAULT 'sent',
	"is_edited" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat-flutter"."users" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "chat-flutter"."users" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "chat-flutter"."users" ALTER COLUMN "email" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "chat-flutter"."users" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "chat-flutter"."users" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "chat-flutter"."users" ADD COLUMN "is_online" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "chat-flutter"."users" ADD COLUMN "last_seen" timestamp;--> statement-breakpoint
ALTER TABLE "chat-flutter"."users" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "chat-flutter"."users" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "chat-flutter"."conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "chat-flutter"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat-flutter"."conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "chat-flutter"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat-flutter"."messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "chat-flutter"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat-flutter"."messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "chat-flutter"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat-flutter"."users" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "chat-flutter"."users" DROP COLUMN "password";--> statement-breakpoint
ALTER TABLE "chat-flutter"."users" DROP COLUMN "image";--> statement-breakpoint
ALTER TABLE "chat-flutter"."users" DROP COLUMN "createdAt";--> statement-breakpoint
ALTER TABLE "chat-flutter"."users" DROP COLUMN "updatedAt";