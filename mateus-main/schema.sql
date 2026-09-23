CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS newsletter (
  email VARCHAR(254) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS adoptions (
  id TEXT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  city VARCHAR(100) NOT NULL,
  message VARCHAR(1000) NOT NULL,
  pet VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  status VARCHAR(20) NOT NULL CHECK (status IN ('perdido', 'encontrado')),
  name VARCHAR(100) NOT NULL,
  animal VARCHAR(40) NOT NULL,
  location VARCHAR(150) NOT NULL,
  description VARCHAR(1000) NOT NULL,
  photo TEXT,
  date DATE NOT NULL,
  date_label VARCHAR(40) NOT NULL DEFAULT 'agora',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE reports ADD COLUMN IF NOT EXISTS photo TEXT;

CREATE TABLE IF NOT EXISTS partners (
  id TEXT PRIMARY KEY,
  organization VARCHAR(150) NOT NULL,
  partner_type VARCHAR(80) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  location VARCHAR(150) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'em-analise' CHECK (status IN ('em-analise', 'aprovado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reports_created_at_idx ON reports (created_at DESC);
CREATE INDEX IF NOT EXISTS partners_created_at_idx ON partners (created_at DESC);