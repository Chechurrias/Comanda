-- ============================================================
-- CORE DE PLATAFORMA (Control comercial y seguridad)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TENANTS
CREATE TABLE IF NOT EXISTS tenants (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(150) NOT NULL,
  slug            VARCHAR(80)  NOT NULL UNIQUE,
  status          VARCHAR(20)  NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','suspended','trial','cancelled')),
  timezone        VARCHAR(50)  NOT NULL DEFAULT 'America/Bogota',
  currency        CHAR(3)      NOT NULL DEFAULT 'COP',
  contact_email   VARCHAR(150),
  contact_phone   VARCHAR(30),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 2. LICENSES
CREATE TABLE IF NOT EXISTS licenses (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan                  VARCHAR(30) NOT NULL DEFAULT 'basic',
  max_devices           SMALLINT NOT NULL DEFAULT 1,
  max_waiters           SMALLINT NOT NULL DEFAULT 5,
  max_tables            SMALLINT NOT NULL DEFAULT 20,
  starts_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at            TIMESTAMPTZ NOT NULL,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  revoked_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. ROLES
CREATE TABLE IF NOT EXISTS roles (
  id     SMALLSERIAL PRIMARY KEY,
  code   VARCHAR(30) NOT NULL UNIQUE,
  name   VARCHAR(60) NOT NULL,
  scope  VARCHAR(20) NOT NULL
);

INSERT INTO roles (code, name, scope) VALUES
  ('super_admin',  'Super Administrador',       'platform'),
  ('tenant_admin', 'Administrador Restaurante', 'tenant'),
  ('waiter',       'Mesero',                    'tenant')
ON CONFLICT (code) DO NOTHING;

-- 4. USERS (Extendiendo auth.users vía triggers o tabla vinculada)
-- En Supabase, usamos la tabla pública 'profiles' o similar vinculada a auth.users
CREATE TABLE IF NOT EXISTS profiles (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id      UUID REFERENCES tenants(id) ON DELETE CASCADE,
  role_id        SMALLINT NOT NULL REFERENCES roles(id),
  full_name      VARCHAR(120) NOT NULL,
  pin_hash       TEXT,
  status         VARCHAR(20) NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active','inactive','locked')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. DEVICES (Seat Licensing)
CREATE TABLE IF NOT EXISTS devices (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  android_id     VARCHAR(64) NOT NULL,
  device_model   VARCHAR(80),
  os_version     VARCHAR(30),
  app_version    VARCHAR(20),
  status         VARCHAR(20) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','authorized','blocked')),
  last_seen_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, android_id)
);

-- 6. APP_VERSIONS (Force Update)
CREATE TABLE IF NOT EXISTS app_versions (
  id              SERIAL PRIMARY KEY,
  platform        VARCHAR(10) NOT NULL DEFAULT 'android',
  latest_version  VARCHAR(20) NOT NULL,
  min_version     VARCHAR(20) NOT NULL,
  apk_url         TEXT NOT NULL,
  release_notes   TEXT,
  is_mandatory    BOOLEAN NOT NULL DEFAULT TRUE,
  published_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

-- Políticas básicas (Ejemplo para profiles)
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles in their tenant" ON profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() 
      AND r.code = 'tenant_admin'
      AND p.tenant_id = profiles.tenant_id
    )
  );
