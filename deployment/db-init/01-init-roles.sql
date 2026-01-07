-- Initialize database roles and schemas for FromChat microservices
-- This script creates dedicated users with limited privileges for each service

-- Create service-specific database roles with limited privileges
-- All services use the same password from DB_PASSWORD environment variable
CREATE ROLE account_service_user LOGIN PASSWORD '${DB_PASSWORD}';
CREATE ROLE profile_service_user LOGIN PASSWORD '${DB_PASSWORD}';
CREATE ROLE device_service_user LOGIN PASSWORD '${DB_PASSWORD}';
CREATE ROLE messaging_service_user LOGIN PASSWORD '${DB_PASSWORD}';
CREATE ROLE push_service_user LOGIN PASSWORD '${DB_PASSWORD}';
CREATE ROLE webrtc_service_user LOGIN PASSWORD '${DB_PASSWORD}';
CREATE ROLE moderation_service_user LOGIN PASSWORD '${DB_PASSWORD}';
CREATE ROLE gateway_user LOGIN PASSWORD '${DB_PASSWORD}';

-- Create dedicated schemas for each service
CREATE SCHEMA IF NOT EXISTS account_schema AUTHORIZATION account_service_user;
CREATE SCHEMA IF NOT EXISTS profile_schema AUTHORIZATION profile_service_user;
CREATE SCHEMA IF NOT EXISTS device_schema AUTHORIZATION device_service_user;
CREATE SCHEMA IF NOT EXISTS messaging_schema AUTHORIZATION messaging_service_user;
CREATE SCHEMA IF NOT EXISTS push_schema AUTHORIZATION push_service_user;
CREATE SCHEMA IF NOT EXISTS webrtc_schema AUTHORIZATION webrtc_service_user;
CREATE SCHEMA IF NOT EXISTS moderation_schema AUTHORIZATION moderation_service_user;

-- Grant basic connection privileges
GRANT CONNECT ON DATABASE fromchat TO account_service_user, profile_service_user, device_service_user, messaging_service_user, push_service_user, webrtc_service_user, moderation_service_user;

-- Grant schema-level privileges (limited to each service's schema)
-- Account service
GRANT USAGE ON SCHEMA account_schema TO account_service_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA account_schema TO account_service_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA account_schema TO account_service_user;

-- Profile service
GRANT USAGE ON SCHEMA profile_schema TO profile_service_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA profile_schema TO profile_service_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA profile_schema TO profile_service_user;

-- Device service
GRANT USAGE ON SCHEMA device_schema TO device_service_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA device_schema TO device_service_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA device_schema TO device_service_user;

-- Messaging service
GRANT USAGE ON SCHEMA messaging_schema TO messaging_service_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA messaging_schema TO messaging_service_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA messaging_schema TO messaging_service_user;

-- Push service
GRANT USAGE ON SCHEMA push_schema TO push_service_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA push_schema TO push_service_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA push_schema TO push_service_user;

-- WebRTC service
GRANT USAGE ON SCHEMA webrtc_schema TO webrtc_service_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA webrtc_schema TO webrtc_service_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA webrtc_schema TO webrtc_service_user;

-- Moderation service
GRANT USAGE ON SCHEMA moderation_schema TO moderation_service_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA moderation_schema TO moderation_service_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA moderation_schema TO moderation_service_user;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA account_schema GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO account_service_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA profile_schema GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO profile_service_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA device_schema GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO device_service_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA messaging_schema GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO messaging_service_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA push_schema GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO push_service_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA webrtc_schema GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO webrtc_service_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA moderation_schema GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO moderation_service_user;
