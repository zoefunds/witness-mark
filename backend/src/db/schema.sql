-- WitnessMark backend schema.
--
-- Source-of-truth split (see docs/architecture.md):
--   - Promise FINANCIAL state (stake, status, verdict, payouts) lives on
--     the GenLayer contract. This DB never stores a second copy of money.
--   - This DB stores OFF-CHAIN concerns only: wallet-auth sessions/nonces,
--     evidence file metadata (Cloudinary URLs + who uploaded them + which
--     on-chain promise they belong to), and a thin denormalized index of
--     promise ids per address purely to make "my promises" listing fast
--     without re-scanning the whole chain client-side. That index is
--     advisory/derived -- if it ever disagrees with the chain, the chain
--     wins, and it is safe to drop and rebuild from get_party_promise_ids.

CREATE TABLE IF NOT EXISTS auth_nonces (
    address      TEXT PRIMARY KEY,           -- lowercase 0x-prefixed wallet address
    nonce        TEXT NOT NULL,
    issued_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    address          TEXT PRIMARY KEY,       -- lowercase 0x-prefixed wallet address
    display_name     TEXT,
    twitter_handle   TEXT,                   -- populated only via OAuth connection, never free-typed
    twitter_verified BOOLEAN NOT NULL DEFAULT false,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at    TIMESTAMPTZ
);

-- Denormalized "which promise ids involve this address" index, purely for
-- fast dashboard/list queries. Rebuilt/upserted whenever the frontend
-- confirms a create/accept transaction, and reconcilable at any time from
-- the contract's own get_party_promise_ids(address) view.
CREATE TABLE IF NOT EXISTS promise_index (
    promise_id       INTEGER PRIMARY KEY,
    creator_address  TEXT NOT NULL,
    counterparty_address TEXT NOT NULL,
    title            TEXT NOT NULL,
    category         TEXT NOT NULL,
    last_known_status TEXT NOT NULL,
    stake_wei        NUMERIC(78, 0) NOT NULL,
    created_ts       BIGINT NOT NULL,
    synced_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_promise_index_creator ON promise_index (creator_address);
CREATE INDEX IF NOT EXISTS idx_promise_index_counterparty ON promise_index (counterparty_address);
CREATE INDEX IF NOT EXISTS idx_promise_index_status ON promise_index (last_known_status);

-- Evidence files uploaded through the backend (Cloudinary-backed). Each row
-- is metadata ONLY -- the row's `url` is what actually gets submitted to
-- the contract's submit_evidence(); the contract fetches that URL itself
-- and never trusts anything else about the file from calldata.
CREATE TABLE IF NOT EXISTS evidence_files (
    id               BIGSERIAL PRIMARY KEY,
    promise_id       INTEGER NOT NULL,
    uploaded_by      TEXT NOT NULL,          -- wallet address
    cloudinary_public_id TEXT NOT NULL,
    url              TEXT NOT NULL,
    resource_type    TEXT NOT NULL,          -- image | raw | video
    bytes            INTEGER,
    original_filename TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_evidence_files_promise ON evidence_files (promise_id);

CREATE TABLE IF NOT EXISTS audit_log (
    id          BIGSERIAL PRIMARY KEY,
    actor       TEXT,
    action      TEXT NOT NULL,
    detail      JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
