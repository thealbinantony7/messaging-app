-- LINKUP Database Schema
-- PostgreSQL 15+
-- Run with: psql -d linkup -f schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- USERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    display_name    VARCHAR(100) NOT NULL,
    avatar_url      TEXT,
    status          VARCHAR(140),
    last_seen_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================================================
-- CONVERSATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type        VARCHAR(10) NOT NULL CHECK (type IN ('dm', 'group')),
    name        VARCHAR(100),
    avatar_url  TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);

-- ============================================================================
-- CONVERSATION MEMBERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversation_members (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id     UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role                VARCHAR(10) DEFAULT 'member' NOT NULL CHECK (role IN ('admin', 'member')),
    last_read_msg_id    UUID,
    muted_until         TIMESTAMPTZ,
    joined_at           TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    UNIQUE(conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_members_user ON conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_members_conv ON conversation_members(conversation_id);

-- ============================================================================
-- MESSAGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES users(id),
    content         TEXT,
    type            VARCHAR(20) DEFAULT 'text' NOT NULL CHECK (type IN ('text', 'image', 'video', 'voice', 'system')),
    reply_to_id     UUID REFERENCES messages(id) ON DELETE SET NULL,
    edited_at       TIMESTAMPTZ,
    deleted_at      TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,  -- PHASE 6: Backend-authoritative delivery timestamp
    read_at         TIMESTAMPTZ,  -- PHASE 6: Backend-authoritative read timestamp
    created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_reply ON messages(reply_to_id) WHERE reply_to_id IS NOT NULL;

-- PHASE 6: Add columns to existing table if not present (idempotent migration)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'messages' AND column_name = 'delivered_at') THEN 
        ALTER TABLE messages ADD COLUMN delivered_at TIMESTAMPTZ NULL; 
    END IF; 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'messages' AND column_name = 'read_at') THEN 
        ALTER TABLE messages ADD COLUMN read_at TIMESTAMPTZ NULL; 
    END IF; 
END $$;

-- Add foreign key for last_read_msg_id safely
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_last_read_msg') THEN 
        ALTER TABLE conversation_members 
            ADD CONSTRAINT fk_last_read_msg 
            FOREIGN KEY (last_read_msg_id) REFERENCES messages(id) ON DELETE SET NULL; 
    END IF; 
END $$;

-- ============================================================================
-- REACTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS reactions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id  UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji       VARCHAR(10) NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    UNIQUE(message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reactions_message ON reactions(message_id);

-- ============================================================================
-- ATTACHMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS attachments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id  UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    type        VARCHAR(10) NOT NULL CHECK (type IN ('image', 'video', 'voice')),
    url         TEXT NOT NULL,
    mime_type   VARCHAR(50) NOT NULL,
    size_bytes  BIGINT NOT NULL,
    duration_ms INT,
    thumbnail   TEXT,
    width       INT,
    height      INT,
    created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attachments_message ON attachments(message_id);

-- ============================================================================
-- REFRESH TOKENS (for JWT rotation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    revoked_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update conversation.updated_at on new message
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations 
    SET updated_at = NOW() 
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_conversation_timestamp ON messages;

CREATE TRIGGER trigger_update_conversation_timestamp
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_timestamp();
