-- Migration: Add RegistrationSessions table for tracking user registration state
-- This table is used by lt_tg_start worker to manage the registration flow

CREATE TABLE IF NOT EXISTS RegistrationSessions (
    SessionID INTEGER PRIMARY KEY AUTOINCREMENT,
    UserID INTEGER NOT NULL UNIQUE,
    TelegramChatID TEXT NOT NULL,
    Username TEXT,
    State TEXT NOT NULL,  -- 'awaiting_wallet', etc.
    CreatedAt TEXT DEFAULT (datetime('now')),
    UpdatedAt TEXT DEFAULT (datetime('now'))
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS IX_RegistrationSessions_UserID ON RegistrationSessions(UserID);
CREATE INDEX IF NOT EXISTS IX_RegistrationSessions_State ON RegistrationSessions(State);
CREATE INDEX IF NOT EXISTS IX_RegistrationSessions_CreatedAt ON RegistrationSessions(CreatedAt);

-- Add comment
-- This table stores temporary session data during user registration
-- Sessions are deleted once registration is complete
