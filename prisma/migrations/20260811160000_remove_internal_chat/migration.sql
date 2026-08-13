-- Phase 3: remove internal user chat tables (Conversation / Message).
-- THIS MIGRATION IS PREPARED BUT NOT APPLIED AUTOMATICALLY.
-- Data remaining at preparation time (dev DB snapshot):
--   conversations: 1
--   messages: 7
--   conversation_participants: 2
--   message_attachments: 0
--   storage/private/chat files on disk: 15 (NOT deleted by this SQL)
--
-- Apply ONLY after explicit approval (export/backup recommended first):
--   npx prisma migrate deploy
-- or apply this SQL manually against the database.

-- Drop FK-dependent tables first
DROP TABLE IF EXISTS "message_attachments";
DROP TABLE IF EXISTS "messages";
DROP TABLE IF EXISTS "conversation_participants";
DROP TABLE IF EXISTS "conversations";

-- Drop chat-only enums (PostgreSQL)
DROP TYPE IF EXISTS "MessageType";
DROP TYPE IF EXISTS "ConversationParticipantRole";
DROP TYPE IF EXISTS "ConversationType";
