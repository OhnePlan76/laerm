CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  filename TEXT NOT NULL UNIQUE,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS laermereignisse (
  id SERIAL PRIMARY KEY,
  datum DATE NOT NULL,
  beginn_uhrzeit TIME NOT NULL,
  ende_uhrzeit TIME,
  dauer_minuten INTEGER NOT NULL CHECK (dauer_minuten >= 0),
  wahrnehmungsort TEXT NOT NULL,
  laermart TEXT NOT NULL,
  intensitaet INTEGER NOT NULL CHECK (intensitaet BETWEEN 1 AND 5),
  auswirkung TEXT NOT NULL,
  vermuteter_ursprung TEXT,
  zeugen TEXT,
  notiz TEXT,
  pruefungshinweis TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_laermereignisse_datum ON laermereignisse (datum DESC);
CREATE INDEX IF NOT EXISTS idx_laermereignisse_beginn ON laermereignisse (beginn_uhrzeit);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_laermereignisse_updated_at ON laermereignisse;

CREATE TRIGGER trg_laermereignisse_updated_at
BEFORE UPDATE ON laermereignisse
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
