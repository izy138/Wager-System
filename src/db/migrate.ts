import { pool } from '@/db/pool.js';

export async function migrate(): Promise<void> {
  const client = await pool.connect();
  // NOTE: pgcrypto provides gen_random_uuid() for UUID primary keys
  try {
    await client.query(`

CREATE TABLE IF NOT EXISTS users(
    user_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      VARCHAR(50) NOT NULL UNIQUE,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name  VARCHAR(100),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status        VARCHAR(20) NOT NULL DEFAULT 'active'
       CHECK (status IN ('active', 'inactive', 'banned'))
);

CREATE TABLE IF NOT EXISTS sessions (
    session_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_user_id  UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title         VARCHAR(200) NOT NULL,
    description   TEXT,
    activity_type VARCHAR(30) NOT NULL
      CHECK (activity_type IN ('sports', 'gaming', 'trivia', 'custom')),
    display_name  VARCHAR(200),
    visibility    VARCHAR(20) NOT NULL DEFAULT 'public'
      CHECK (visibility IN ('public', 'private', 'friends_only')),
    start_time    TIMESTAMPTZ,
    end_time      TIMESTAMPTZ,
    status        VARCHAR(20) NOT NULL DEFAULT 'scheduled'
      CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS wagers (
    wager_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id         UUID NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    created_by_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title              VARCHAR(200) NOT NULL,
    description        TEXT,
    wager_type         VARCHAR(30) NOT NULL
        CHECK (wager_type IN ('over_under', 'yes_no', 'pick_winner', 'custom')),
    point_risk_limit   INTEGER,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    close_time         TIMESTAMPTZ,
    resolved_at        TIMESTAMPTZ,
    result_status      VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (result_status IN ('pending', 'resolved', 'cancelled', 'disputed'))
);

CREATE TABLE IF NOT EXISTS wager_participations (
    participation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wager_id         UUID NOT NULL REFERENCES wagers(wager_id) ON DELETE CASCADE,
    user_id          UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    prediction_value VARCHAR(200) NOT NULL,
    points_risked    INTEGER NOT NULL CHECK (points_risked > 0),
    outcome_status   VARCHAR(20) NOT NULL DEFAULT 'pending' 
      CHECK (outcome_status IN ('pending', 'won', 'lost', 'cancelled')),
    points_awarded   INTEGER DEFAULT 0,
    joined_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    UNIQUE (wager_id, user_id)
);

CREATE TABLE IF NOT EXISTS groups (
    group_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_name         VARCHAR(100) NOT NULL,
    description        TEXT,
    group_type         VARCHAR(20) NOT NULL DEFAULT 'public'
        CHECK (group_type IN ('public', 'private', 'invite_only')),
    created_by_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_memberships (
    membership_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id          UUID NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
    user_id           UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role              VARCHAR(20) NOT NULL DEFAULT 'member'
       CHECK (role IN ('owner', 'admin', 'member')),
    joined_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    membership_status VARCHAR(20) NOT NULL DEFAULT 'active'
       CHECK (membership_status IN ('active', 'invited', 'removed', 'left'))
    UNIQUE (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS  group_leaderboards (
    leaderboard_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id          UUID NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
    user_id           UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    total_points      INTEGER NOT NULL DEFAULT 0,
    rank_last_updated TIMESTAMPTZ
    UNIQUE (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS badges (
    badge_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    badge_name  VARCHAR(100) NOT NULL,
    description TEXT,
    badge_type  VARCHAR(20) NOT NULL
        CHECK (badge_type IN ('achievement', 'milestone', 'streak', 'special')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_badges (
    user_badge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    badge_id      UUID NOT NULL REFERENCES badges(badge_id) ON DELETE CASCADE,
    wager_id      UUID REFERENCES wagers(wager_id) ON DELETE SET NULL,
    awarded_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason        TEXT
);

CREATE TABLE IF NOT EXISTS point_transactions (
    transaction_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    session_id       UUID REFERENCES sessions(session_id) ON DELETE SET NULL,
    wager_id         UUID REFERENCES wagers(wager_id) ON DELETE SET NULL,
    group_id         UUID REFERENCES groups(group_id) ON DELETE SET NULL,
    points_change    INTEGER NOT NULL,
    transaction_type VARCHAR(20) NOT NULL
        CHECK (transaction_type IN ('wager_placed', 'wager_won', 'wager_lost', 'bonus', 'refund')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
    message_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id   UUID NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    message_text TEXT NOT NULL,
    sent_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    edited_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS  refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE refresh_tokens
    ADD COLUMN IF NOT EXISTS family_id UUID NOT NULL DEFAULT gen_random_uuid(),
    ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS refresh_tokens_token_idx ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_family_id_idx ON refresh_tokens(family_id);
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
CREATE INDEX IF NOT EXISTS sessions_host_idx ON sessions(host_user_id);
CREATE INDEX IF NOT EXISTS wagers_session_idx ON wagers(session_id);
CREATE INDEX IF NOT EXISTS wager_participations_wager_idx ON wager_participations(wager_id);
CREATE INDEX IF NOT EXISTS wager_participations_user_idx ON wager_participations(user_id);
CREATE INDEX IF NOT EXISTS group_memberships_group_idx ON group_memberships(group_id);
CREATE INDEX IF NOT EXISTS group_memberships_user_idx ON group_memberships(user_id);
CREATE INDEX IF NOT EXISTS group_leaderboards_group_idx ON group_leaderboards(group_id);
CREATE INDEX IF NOT EXISTS chat_messages_session_idx ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS point_transactions_user_idx ON point_transactions(user_id);




    `);
    console.log('Migrations complete');
  } finally {
    client.release();
  }
}


  //  CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      // CREATE TABLE IF NOT EXISTS users (
      //   id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      //   name          TEXT        NOT NULL,
      //   email         TEXT        NOT NULL UNIQUE,
      //   password_hash TEXT        NOT NULL,
      //   created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      // );

      // ALTER TABLE users
      //   ADD COLUMN IF NOT EXISTS display_name TEXT;
      //   ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active'
      //     CHECK (status IN ('active', 'inactive', 'banned'));
        


      // CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);

      // CREATE TABLE IF NOT EXISTS refresh_tokens (
      //   id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      //   user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      //   token      TEXT        NOT NULL UNIQUE,
      //   expires_at TIMESTAMPTZ NOT NULL,
      //   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      // );

      // ALTER TABLE refresh_tokens
      //   ADD COLUMN IF NOT EXISTS family_id UUID NOT NULL DEFAULT gen_random_uuid(),
      //   ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ;

      // CREATE INDEX IF NOT EXISTS refresh_tokens_token_idx     ON refresh_tokens(token);
      // CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx   ON refresh_tokens(user_id);
      // CREATE INDEX IF NOT EXISTS refresh_tokens_family_id_idx ON refresh_tokens(family_id);