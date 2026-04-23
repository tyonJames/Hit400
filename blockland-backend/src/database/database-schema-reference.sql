-- =============================================================================
-- docs/database-schema-reference.sql
-- BlockLand Zimbabwe — Raw PostgreSQL Schema Reference
-- =============================================================================
-- PURPOSE: Secondary reference documentation for the dissertation appendix.
--          The PRIMARY deliverable is the TypeORM entity classes.
--          This SQL is auto-generated from the TypeORM migration for reference.
--
-- TARGET DATABASE: PostgreSQL 15+
-- ENCODING: UTF-8
-- TIMEZONE: UTC (all TIMESTAMPTZ columns are stored in UTC)
--
-- TO APPLY DIRECTLY (dev/test only — use migrations in production):
--   psql -U postgres -d blockland_db -f docs/database-schema-reference.sql
--
-- NORMALIZATION: 3NF
--   1NF: All columns are atomic (GPS split, no multi-value columns)
--   2NF: No partial dependencies (all non-key fields depend on the whole PK)
--   3NF: No transitive dependencies (status fields are stored, not derived)
-- =============================================================================

-- Enable UUID generation (PostgreSQL 13+ includes gen_random_uuid() natively)
-- For older versions: CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- ENUM TYPE DEFINITIONS
-- =============================================================================

CREATE TYPE user_role_enum AS ENUM (
    'REGISTRAR',  -- Land officer at the Deeds Registry
    'OWNER',      -- Current property owner / potential seller
    'BUYER',      -- Incoming transfer recipient
    'PUBLIC',     -- Read-only public viewer
    'ADMIN'       -- System administrator
);

CREATE TYPE property_status_enum AS ENUM (
    'ACTIVE',            -- Normal state — property is freely transferable
    'PENDING_TRANSFER',  -- Transfer initiated — property is locked
    'DISPUTED',          -- Formally disputed — all transfers blocked
    'INACTIVE'           -- Soft-deleted / decommissioned (off-chain only)
);

CREATE TYPE land_size_unit_enum AS ENUM ('SQM', 'HECTARE', 'ACRE');

CREATE TYPE zoning_type_enum AS ENUM (
    'RESIDENTIAL', 'COMMERCIAL', 'AGRICULTURAL', 'INDUSTRIAL'
);

CREATE TYPE file_type_enum AS ENUM ('PDF', 'JPG', 'PNG');

CREATE TYPE acquisition_type_enum AS ENUM (
    'INITIAL_REGISTRATION',  -- First registration of the property
    'TRANSFER',              -- Ownership changed via 3-step transfer workflow
    'DISPUTE_RESOLUTION'     -- Registrar reassigned ownership during dispute
);

CREATE TYPE transfer_status_enum AS ENUM (
    'PENDING_BUYER',      -- Awaiting buyer-approve-transfer on-chain
    'PENDING_REGISTRAR',  -- Awaiting registrar-finalize-transfer on-chain
    'CONFIRMED',          -- Ownership changed — blockchain_tx_hash set
    'CANCELLED'           -- Cancelled at any point in the workflow
);

CREATE TYPE approver_role_enum AS ENUM ('BUYER', 'REGISTRAR');

CREATE TYPE approval_action_enum AS ENUM ('APPROVED', 'REJECTED');

CREATE TYPE dispute_type_enum AS ENUM (
    'OWNERSHIP_CLAIM', 'BOUNDARY_DISPUTE', 'FRAUD', 'OTHER'
);

CREATE TYPE dispute_status_enum AS ENUM (
    'OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'
);

CREATE TYPE verification_query_type_enum AS ENUM (
    'PROPERTY_ID', 'TITLE_DEED', 'OWNER_ID'
);

CREATE TYPE verification_result_status_enum AS ENUM (
    'VERIFIED',   -- DB and on-chain agree — record is authentic
    'MISMATCH',   -- DB and on-chain disagree — integrity issue
    'NOT_FOUND'   -- No matching property found
);

-- =============================================================================
-- TABLE DEFINITIONS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- users — Core user record for all system actors
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name       VARCHAR(100)    NOT NULL,
    national_id     VARCHAR(20)     NOT NULL UNIQUE,
    email           VARCHAR(100)    NOT NULL UNIQUE,
    phone           VARCHAR(15)     NOT NULL,
    password_hash   VARCHAR(255)    NOT NULL,
    wallet_address  VARCHAR(50)     NULL,           -- Stacks principal (optional)
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT CHK_users_full_name_length
        CHECK (char_length(full_name) >= 3),
    CONSTRAINT CHK_users_email_format
        CHECK (email ~* '^[^@]+@[^@]+\.[^@]+$'),
    CONSTRAINT CHK_users_phone_format
        CHECK (phone ~ '^[0-9]{10,15}$'),
    CONSTRAINT CHK_users_wallet_format
        CHECK (wallet_address IS NULL
               OR wallet_address ~ '^S[PT][A-Z0-9]{38,39}$')
);

CREATE INDEX IDX_users_wallet ON users (wallet_address);

-- -----------------------------------------------------------------------------
-- roles — Role lookup table (seeded with 5 rows — never changes)
-- -----------------------------------------------------------------------------
CREATE TABLE roles (
    id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    name        user_role_enum  NOT NULL UNIQUE,
    description VARCHAR(200)    NULL,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Seed data — these 5 rows are inserted by the migration
INSERT INTO roles (name, description) VALUES
    ('REGISTRAR', 'Land Officer — register properties, approve transfers, manage disputes'),
    ('OWNER',     'Property Owner — initiate transfers, view portfolio'),
    ('BUYER',     'Buyer — must approve transfers directed to them'),
    ('PUBLIC',    'Public Viewer — read-only access to verification portal'),
    ('ADMIN',     'System Administrator — manage accounts and registrar assignments');

-- -----------------------------------------------------------------------------
-- user_roles — M:N join table (composite PK)
-- -----------------------------------------------------------------------------
CREATE TABLE user_roles (
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id     UUID        NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

-- -----------------------------------------------------------------------------
-- auth_tokens — Refresh token store (hashed, not plaintext)
-- -----------------------------------------------------------------------------
CREATE TABLE auth_tokens (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked     BOOLEAN     NOT NULL DEFAULT FALSE,
    ip_address  VARCHAR(45) NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IDX_auth_tokens_user_id    ON auth_tokens (user_id);
CREATE INDEX IDX_auth_tokens_expires_at ON auth_tokens (expires_at);

-- -----------------------------------------------------------------------------
-- properties — Central land record (token_id, blockchain_tx_hash, ipfs_hash: NOT NULL)
-- -----------------------------------------------------------------------------
CREATE TABLE properties (
    id                  UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    plot_number         VARCHAR(20)             NOT NULL UNIQUE,
    title_deed_number   VARCHAR(30)             NOT NULL UNIQUE,
    address             VARCHAR(150)            NOT NULL,
    gps_lat             DECIMAL(10,7)           NULL,
    gps_lng             DECIMAL(10,7)           NULL,
    land_size           DECIMAL(12,4)           NOT NULL,
    unit                land_size_unit_enum     NOT NULL DEFAULT 'SQM',
    zoning_type         zoning_type_enum        NOT NULL,
    registration_date   DATE                    NOT NULL,
    status              property_status_enum    NOT NULL DEFAULT 'ACTIVE',
    token_id            VARCHAR(100)            NOT NULL UNIQUE,    -- On-chain property-id
    blockchain_tx_hash  VARCHAR(100)            NOT NULL,           -- register-property txid
    ipfs_hash           VARCHAR(100)            NOT NULL,           -- Title deed IPFS CID
    notes               VARCHAR(500)            NULL,
    current_owner_id    UUID                    NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_by          UUID                    NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

    CONSTRAINT CHK_properties_plot_length    CHECK (char_length(plot_number) >= 3),
    CONSTRAINT CHK_properties_address_length CHECK (char_length(address) >= 5),
    CONSTRAINT CHK_properties_land_size      CHECK (land_size > 0),
    CONSTRAINT CHK_properties_title_deed_len CHECK (char_length(title_deed_number) >= 5),
    CONSTRAINT CHK_properties_reg_date       CHECK (registration_date <= CURRENT_DATE)
);

CREATE INDEX IDX_properties_current_owner ON properties (current_owner_id);
CREATE INDEX IDX_properties_status        ON properties (status);
CREATE INDEX IDX_properties_token_id      ON properties (token_id);
CREATE INDEX IDX_properties_blockchain_tx ON properties (blockchain_tx_hash);

-- -----------------------------------------------------------------------------
-- property_documents — IPFS-linked documents per property
-- -----------------------------------------------------------------------------
CREATE TABLE property_documents (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id     UUID            NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    uploaded_by     UUID            NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    file_name       VARCHAR(255)    NOT NULL,
    file_type       file_type_enum  NOT NULL,
    file_size_bytes INTEGER         NOT NULL,
    ipfs_hash       VARCHAR(100)    NOT NULL,
    file_hash       CHAR(64)        NOT NULL,   -- SHA-256 hex digest
    uploaded_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT CHK_prop_docs_file_size
        CHECK (file_size_bytes > 0 AND file_size_bytes <= 5242880)
);

CREATE INDEX IDX_prop_docs_property_id ON property_documents (property_id);
CREATE INDEX IDX_prop_docs_uploaded_by ON property_documents (uploaded_by);

-- -----------------------------------------------------------------------------
-- transfers — One row per transfer attempt through the 3-step workflow
-- -----------------------------------------------------------------------------
CREATE TABLE transfers (
    id                  UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id         UUID                    NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    seller_id           UUID                    NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    buyer_id            UUID                    NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status              transfer_status_enum    NOT NULL DEFAULT 'PENDING_BUYER',
    initiated_at        TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    confirmed_at        TIMESTAMPTZ             NULL,
    cancelled_at        TIMESTAMPTZ             NULL,
    sale_value          DECIMAL(15,2)           NULL,
    blockchain_tx_hash  VARCHAR(100)            NULL,   -- Set only on CONFIRMED
    notes               VARCHAR(500)            NULL,
    created_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

    CONSTRAINT CHK_transfers_sale_value
        CHECK (sale_value IS NULL OR sale_value > 0)
);

CREATE INDEX IDX_transfers_property_id ON transfers (property_id);
CREATE INDEX IDX_transfers_seller_id   ON transfers (seller_id);
CREATE INDEX IDX_transfers_buyer_id    ON transfers (buyer_id);
CREATE INDEX IDX_transfers_status      ON transfers (status);

-- -----------------------------------------------------------------------------
-- ownership_records — Immutable history of all ownership periods per property
-- -----------------------------------------------------------------------------
CREATE TABLE ownership_records (
    id                  UUID                        PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id         UUID                        NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    owner_id            UUID                        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    transfer_id         UUID                        NULL REFERENCES transfers(id) ON DELETE SET NULL,
    acquired_at         TIMESTAMPTZ                 NOT NULL,
    released_at         TIMESTAMPTZ                 NULL,   -- NULL = currently owned
    acquisition_type    acquisition_type_enum       NOT NULL,
    blockchain_tx_hash  VARCHAR(100)                NOT NULL,
    created_at          TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ                 NOT NULL DEFAULT NOW()
);

CREATE INDEX IDX_ownership_property_id   ON ownership_records (property_id);
CREATE INDEX IDX_ownership_owner_id      ON ownership_records (owner_id);
CREATE INDEX IDX_ownership_prop_released ON ownership_records (property_id, released_at);

-- PARTIAL INDEX: O(1) current-owner lookup — only indexes rows where released_at IS NULL
-- This is the single most important performance index in the schema.
-- Query: SELECT * FROM ownership_records WHERE property_id = $1 AND released_at IS NULL
CREATE INDEX IDX_ownership_current
    ON ownership_records (property_id)
    WHERE released_at IS NULL;

-- -----------------------------------------------------------------------------
-- transfer_approvals — Audit record of each step in a transfer
-- -----------------------------------------------------------------------------
CREATE TABLE transfer_approvals (
    id              UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id     UUID                    NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
    approved_by     UUID                    NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    approver_role   approver_role_enum      NOT NULL,
    approved_at     TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    action          approval_action_enum    NOT NULL,
    notes           VARCHAR(500)            NULL,
    created_at      TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

CREATE INDEX IDX_transfer_approvals_transfer_id ON transfer_approvals (transfer_id);
CREATE INDEX IDX_transfer_approvals_approved_by ON transfer_approvals (approved_by);

-- -----------------------------------------------------------------------------
-- disputes — Formal land disputes with mandatory on-chain blockchain linkage
-- -----------------------------------------------------------------------------
CREATE TABLE disputes (
    id                  UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id         UUID                    NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    raised_by           UUID                    NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    dispute_type        dispute_type_enum       NOT NULL,
    description         TEXT                    NOT NULL,
    status              dispute_status_enum     NOT NULL DEFAULT 'OPEN',
    raised_at           TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    resolved_at         TIMESTAMPTZ             NULL,
    blockchain_tx_hash  VARCHAR(100)            NOT NULL,   -- flag-dispute txid
    created_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

    CONSTRAINT CHK_disputes_description_length
        CHECK (char_length(description) BETWEEN 20 AND 1000)
);

CREATE INDEX IDX_disputes_property_id ON disputes (property_id);
CREATE INDEX IDX_disputes_status      ON disputes (status);
CREATE INDEX IDX_disputes_raised_by   ON disputes (raised_by);

-- -----------------------------------------------------------------------------
-- dispute_evidence — IPFS-linked evidence files for disputes
-- -----------------------------------------------------------------------------
CREATE TABLE dispute_evidence (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    dispute_id      UUID            NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
    uploaded_by     UUID            NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    file_name       VARCHAR(255)    NOT NULL,
    file_type       file_type_enum  NOT NULL,
    file_size_bytes INTEGER         NOT NULL,
    ipfs_hash       VARCHAR(100)    NOT NULL,
    file_hash       CHAR(64)        NOT NULL,
    uploaded_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT CHK_dispute_evidence_file_size
        CHECK (file_size_bytes > 0 AND file_size_bytes <= 5242880)
);

CREATE INDEX IDX_dispute_evidence_dispute_id  ON dispute_evidence (dispute_id);
CREATE INDEX IDX_dispute_evidence_uploaded_by ON dispute_evidence (uploaded_by);

-- -----------------------------------------------------------------------------
-- dispute_resolutions — One-to-one resolution record per dispute
-- -----------------------------------------------------------------------------
CREATE TABLE dispute_resolutions (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    dispute_id          UUID        NOT NULL UNIQUE REFERENCES disputes(id) ON DELETE CASCADE,
    resolved_by         UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    resolution_notes    TEXT        NOT NULL,
    resolved_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    blockchain_tx_hash  VARCHAR(100) NOT NULL   -- resolve-dispute txid
);

CREATE INDEX IDX_dispute_res_resolved_by ON dispute_resolutions (resolved_by);

-- -----------------------------------------------------------------------------
-- verification_logs — Public title verification query audit trail
-- -----------------------------------------------------------------------------
CREATE TABLE verification_logs (
    id              UUID                                PRIMARY KEY DEFAULT gen_random_uuid(),
    query_type      verification_query_type_enum        NOT NULL,
    query_value     VARCHAR(100)                        NOT NULL,
    result_status   verification_result_status_enum     NOT NULL,
    queried_at      TIMESTAMPTZ                         NOT NULL DEFAULT NOW(),
    ip_address      VARCHAR(45)                         NULL
);

CREATE INDEX IDX_verification_queried_at  ON verification_logs (queried_at);
CREATE INDEX IDX_verification_query_value ON verification_logs (query_value);
CREATE INDEX IDX_verification_result      ON verification_logs (result_status);

-- -----------------------------------------------------------------------------
-- activity_logs — Full audit trail of all system actions
-- -----------------------------------------------------------------------------
CREATE TABLE activity_logs (
    id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID          NULL REFERENCES users(id) ON DELETE SET NULL,
    action        VARCHAR(100)  NOT NULL,
    entity_type   VARCHAR(50)   NOT NULL,
    entity_id     UUID          NOT NULL,
    metadata      JSONB         NULL,
    performed_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IDX_activity_user_id       ON activity_logs (user_id);
CREATE INDEX IDX_activity_entity        ON activity_logs (entity_type, entity_id);
CREATE INDEX IDX_activity_performed_at  ON activity_logs (performed_at);
CREATE INDEX IDX_activity_action        ON activity_logs (action);
-- GIN index for efficient JSONB field queries
CREATE INDEX IDX_activity_metadata_gin ON activity_logs USING GIN (metadata);

-- =============================================================================
-- NORMALIZATION ANALYSIS
-- =============================================================================
--
-- 1NF (First Normal Form) — Atomic columns:
--   ✓ GPS stored as gps_lat + gps_lng (not "lat,lng" string)
--   ✓ No comma-separated values in any column
--   ✓ No repeating groups — ownership history uses a separate table
--   ✓ Every column has a single, atomic data type
--
-- 2NF (Second Normal Form) — No partial dependencies:
--   ✓ All PKs are single-column UUIDs (except user_roles composite PK)
--   ✓ user_roles: assigned_at depends on (user_id, role_id) together — valid
--   ✓ property_metadata removed — all property fields on properties table directly
--   ✓ No field depends on only PART of a composite key
--
-- 3NF (Third Normal Form) — No transitive dependencies:
--   ✓ properties.status is stored explicitly — not derived from transfer count
--   ✓ disputes.status is stored explicitly — not derived from resolutions count
--   ✓ transfers.status is stored explicitly — not derived from approvals count
--   ✓ current_owner_id on properties is a denormalized convenience cache,
--     explicitly acknowledged — authoritative source is ownership_records
--     WHERE released_at IS NULL. Both updated atomically in transactions.
--
-- BLOCKCHAIN INTEGRITY LINKS:
--   properties.blockchain_tx_hash    → register-property Stacks txid
--   properties.token_id              → uint property-id in Clarity contract
--   properties.ipfs_hash             → IPFS CID of title deed document
--   transfers.blockchain_tx_hash     → registrar-finalize-transfer txid
--   ownership_records.blockchain_tx_hash → txid that caused this ownership change
--   disputes.blockchain_tx_hash      → flag-dispute txid
--   dispute_resolutions.blockchain_tx_hash → resolve-dispute txid
-- =============================================================================
