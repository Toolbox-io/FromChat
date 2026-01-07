-- Create tables for FromChat microservices
-- This script creates the necessary tables in their respective schemas

-- Note: In production, tables will be created by Alembic migrations
-- This script provides a fallback or reference for manual setup

-- Account schema tables
CREATE TABLE IF NOT EXISTS account_schema.users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    salt VARCHAR(64) NOT NULL,
    display_name VARCHAR(100),
    bio TEXT,
    avatar_url VARCHAR(255),
    is_online BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret VARCHAR(255),
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    public_key TEXT,
    private_key TEXT,
    encryption_enabled BOOLEAN DEFAULT FALSE,
    suspended BOOLEAN DEFAULT FALSE,
    suspension_reason TEXT,
    deleted BOOLEAN DEFAULT FALSE
);

-- Profile schema tables (references account_schema.users)
CREATE TABLE IF NOT EXISTS profile_schema.user_profiles (
    user_id BIGINT PRIMARY KEY REFERENCES account_schema.users(id) ON DELETE CASCADE,
    display_name VARCHAR(100),
    bio TEXT,
    avatar_url VARCHAR(255),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Device schema tables
CREATE TABLE IF NOT EXISTS device_schema.devices (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES account_schema.users(id) ON DELETE CASCADE,
    device_id VARCHAR(255) UNIQUE NOT NULL,
    device_name VARCHAR(255),
    device_type VARCHAR(50),
    public_key TEXT,
    signed_prekey TEXT,
    one_time_prekeys JSONB,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS device_schema.device_session (
    id SERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES account_schema.users(id) ON DELETE CASCADE,
    raw_user_agent TEXT,
    device_name VARCHAR(128),
    device_type VARCHAR(32),
    os_name VARCHAR(64),
    os_version VARCHAR(64),
    browser_name VARCHAR(64),
    browser_version VARCHAR(64),
    brand VARCHAR(64),
    model VARCHAR(64),
    session_id VARCHAR(64) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked BOOLEAN DEFAULT FALSE
);

-- Messaging schema tables
CREATE TABLE IF NOT EXISTS messaging_schema.messages (
    id BIGSERIAL PRIMARY KEY,
    sender_id BIGINT REFERENCES account_schema.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    content_type VARCHAR(50) DEFAULT 'text',
    encrypted_content TEXT,
    signature TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    edited_at TIMESTAMP,
    edited BOOLEAN DEFAULT FALSE,
    deleted BOOLEAN DEFAULT FALSE,
    reply_to_id BIGINT REFERENCES messaging_schema.messages(id),
    thread_id BIGINT REFERENCES messaging_schema.messages(id),
    is_public BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS messaging_schema.message_recipients (
    id BIGSERIAL PRIMARY KEY,
    message_id BIGINT REFERENCES messaging_schema.messages(id) ON DELETE CASCADE,
    recipient_id BIGINT REFERENCES account_schema.users(id) ON DELETE CASCADE,
    read_at TIMESTAMP,
    delivered_at TIMESTAMP,
    encrypted_key TEXT
);

CREATE TABLE IF NOT EXISTS messaging_schema.message_reactions (
    id BIGSERIAL PRIMARY KEY,
    message_id BIGINT REFERENCES messaging_schema.messages(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES account_schema.users(id) ON DELETE CASCADE,
    reaction VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Push schema tables
CREATE TABLE IF NOT EXISTS push_schema.push_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES account_schema.users(id) ON DELETE CASCADE,
    device_id BIGINT REFERENCES device_schema.devices(id),
    endpoint VARCHAR(500) NOT NULL,
    p256dh VARCHAR(255) NOT NULL,
    auth VARCHAR(255) NOT NULL,
    user_agent VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- WebRTC schema tables
CREATE TABLE IF NOT EXISTS webrtc_schema.webrtc_sessions (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    initiator_id BIGINT REFERENCES account_schema.users(id),
    participant_ids JSONB NOT NULL,
    offer JSONB,
    answer JSONB,
    ice_candidates JSONB,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Moderation schema tables
CREATE TABLE IF NOT EXISTS moderation_schema.moderation_actions (
    id BIGSERIAL PRIMARY KEY,
    moderator_id BIGINT REFERENCES account_schema.users(id),
    target_user_id BIGINT REFERENCES account_schema.users(id),
    target_message_id BIGINT REFERENCES messaging_schema.messages(id),
    action_type VARCHAR(50) NOT NULL,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- Grant permissions on sequences (after all tables are created)
GRANT USAGE ON SEQUENCE account_schema.users_id_seq TO account_service_user;
GRANT USAGE ON SEQUENCE device_schema.devices_id_seq TO device_service_user;
GRANT USAGE ON SEQUENCE device_schema.device_session_id_seq TO account_service_user;
GRANT USAGE ON SEQUENCE messaging_schema.messages_id_seq TO messaging_service_user;
GRANT USAGE ON SEQUENCE messaging_schema.message_recipients_id_seq TO messaging_service_user;
GRANT USAGE ON SEQUENCE messaging_schema.message_reactions_id_seq TO messaging_service_user;
GRANT USAGE ON SEQUENCE push_schema.push_subscriptions_id_seq TO push_service_user;
GRANT USAGE ON SEQUENCE webrtc_schema.webrtc_sessions_id_seq TO webrtc_service_user;
GRANT USAGE ON SEQUENCE moderation_schema.moderation_actions_id_seq TO moderation_service_user;
