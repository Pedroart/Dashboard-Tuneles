import os
import glob
import sqlite3
import pandas as pd

BASE_DIR = "datos_generados"
DB_PATH = "datos.db"

# Si tus CSV tienen todas las columnas repetidas por fila (como los tuyos),
# tomamos metadatos desde la primera fila y mediciones desde tiempo_min/temperatura.

CREATE_SQL = """
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

CREATE TABLE IF NOT EXISTS procesos (
  proceso_id INTEGER PRIMARY KEY,
  epoca TEXT,
  packing TEXT,
  tunel TEXT,
  tipo_tunel TEXT,
  iteracion INTEGER,

  mass_group TEXT,
  masa_ton REAL,
  ocupabilidad REAL,
  caudal_factor REAL,

  anomalia_duracion INTEGER,
  duracion_min INTEGER,
  duracion_esperada_min REAL,
  delta_duracion_pct REAL,

  setpoint REAL,
  T0 REAL,
  pct_transitorio REAL,
  t_trans_min REAL,
  overshoot_pct REAL
);

CREATE TABLE IF NOT EXISTS mediciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proceso_id INTEGER NOT NULL,
  tiempo_min INTEGER NOT NULL,
  temperatura REAL NOT NULL,
  FOREIGN KEY (proceso_id) REFERENCES procesos(proceso_id)
);

CREATE INDEX IF NOT EXISTS idx_mediciones_proceso ON mediciones(proceso_id);
CREATE INDEX IF NOT EXISTS idx_mediciones_proceso_tiempo ON mediciones(proceso_id, tiempo_min);
"""

INSERT_PROCESO_SQL = """
INSERT OR REPLACE INTO procesos (
  proceso_id, epoca, packing, tunel, tipo_tunel, iteracion,
  mass_group, masa_ton, ocupabilidad, caudal_factor,
  anomalia_duracion, duracion_min, duracion_esperada_min, delta_duracion_pct,
  setpoint, T0, pct_transitorio, t_trans_min, overshoot_pct
) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
"""

INSERT_MEDICIONES_SQL = """
INSERT INTO mediciones (proceso_id, tiempo_min, temperatura)
VALUES (?,?,?)
"""

def to_int_bool(x):
  # convierte True/False, "true"/"false", 0/1, etc. a 0/1
  if isinstance(x, bool):
    return int(x)
  if isinstance(x, (int, float)):
    return int(x != 0)
  s = str(x).strip().lower()
  return 1 if s in ("true", "1", "yes", "si") else 0

def main():
  csv_files = glob.glob(os.path.join(BASE_DIR, "**", "csv", "*.csv"), recursive=True)
  if not csv_files:
    raise SystemExit(f"No se encontraron CSV dentro de {BASE_DIR}/**/csv/*.csv")

  conn = sqlite3.connect(DB_PATH)
  cur = conn.cursor()
  cur.executescript(CREATE_SQL)

  total_procesos = 0
  total_mediciones = 0

  # Transacción grande (mucho más rápido)
  conn.execute("BEGIN")

  try:
    for path in csv_files:
      df = pd.read_csv(path)

      # Validación mínima
      if "proceso_id" not in df.columns or "tiempo_min" not in df.columns or "temperatura" not in df.columns:
        print(f"⚠️ Saltando (faltan columnas) -> {path}")
        continue

      # Metadatos: 1ra fila
      r = df.iloc[0]

      proceso_id = int(r["proceso_id"])
      epoca = str(r.get("epoca", ""))
      packing = str(r.get("packing", ""))
      tunel = str(r.get("tunel", ""))
      tipo_tunel = str(r.get("tipo_tunel", ""))
      iteracion = int(r.get("iteracion", 0))

      mass_group = str(r.get("mass_group", ""))
      masa_ton = float(r.get("masa_ton", 0.0))
      ocupabilidad = float(r.get("ocupabilidad", 0.0))
      caudal_factor = float(r.get("caudal_factor", 0.0))

      anomalia = to_int_bool(r.get("anomalia_duracion", 0))
      duracion_min = int(r.get("duracion_min", len(df)))
      dur_esp = float(r.get("duracion_esperada_min", 0.0))
      delta_pct = float(r.get("delta_duracion_pct", 0.0))

      setpoint = float(r.get("setpoint", 0.0))
      T0 = float(r.get("T0", 0.0))
      pct_trans = float(r.get("pct_transitorio", 0.0))
      t_trans = float(r.get("t_trans_min", 0.0))
      overshoot_pct = float(r.get("overshoot_pct", 0.0))

      # Insert proceso
      cur.execute(INSERT_PROCESO_SQL, (
        proceso_id, epoca, packing, tunel, tipo_tunel, iteracion,
        mass_group, masa_ton, ocupabilidad, caudal_factor,
        anomalia, duracion_min, dur_esp, delta_pct,
        setpoint, T0, pct_trans, t_trans, overshoot_pct
      ))
      total_procesos += 1

      # Insert mediciones (solo tiempo y temperatura)
      rows = [(proceso_id, int(t), float(temp)) for t, temp in zip(df["tiempo_min"], df["temperatura"])]
      cur.executemany(INSERT_MEDICIONES_SQL, rows)
      total_mediciones += len(rows)

    conn.commit()
  except Exception:
    conn.rollback()
    raise
  finally:
    conn.close()

  print(f"✅ DB creada: {DB_PATH}")
  print(f"✅ Procesos importados: {total_procesos}")
  print(f"✅ Mediciones importadas: {total_mediciones}")

if __name__ == "__main__":
  main()
