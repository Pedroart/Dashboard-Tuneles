import os
import glob
import sqlite3
import pandas as pd
from datetime import datetime, timedelta

BASE_DIR = "datos_generados"
DB_PATH = "datos_2025.db"

DDL = """
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

CREATE TABLE IF NOT EXISTS packings (
  packing_id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS tuneles (
  tunel_id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,
  tipo_tunel TEXT NOT NULL,
  palets_max INTEGER NOT NULL,
  descripcion TEXT
);

CREATE TABLE IF NOT EXISTS tipos_caja (
  caja_id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo_caja TEXT NOT NULL UNIQUE,
  masa_caja_kg REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS procesos (
  proceso_id INTEGER PRIMARY KEY,
  epoca TEXT NOT NULL,
  packing_id INTEGER NOT NULL,
  tunel_id INTEGER NOT NULL,
  caja_id INTEGER NOT NULL,

  iteracion INTEGER NOT NULL,
  anomalia_duracion INTEGER NOT NULL,

  num_cajas INTEGER NOT NULL,
  masa_total_kg REAL NOT NULL,
  masa_total_ton REAL NOT NULL,

  palets_usados INTEGER NOT NULL,
  ocupabilidad REAL NOT NULL,

  caudal_factor REAL NOT NULL,

  duracion_min INTEGER NOT NULL,
  duracion_esperada_min REAL NOT NULL,
  delta_duracion_pct REAL NOT NULL,

  setpoint REAL NOT NULL,
  T0 REAL NOT NULL,
  pct_transitorio REAL NOT NULL,
  t_trans_min REAL NOT NULL,
  overshoot_pct REAL NOT NULL,

  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  temporada_anio INTEGER NOT NULL,

  FOREIGN KEY (packing_id) REFERENCES packings(packing_id),
  FOREIGN KEY (tunel_id) REFERENCES tuneles(tunel_id),
  FOREIGN KEY (caja_id) REFERENCES tipos_caja(caja_id)
);

CREATE TABLE IF NOT EXISTS mediciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proceso_id INTEGER NOT NULL,
  tiempo_min INTEGER NOT NULL,
  temperatura REAL NOT NULL,
  FOREIGN KEY (proceso_id) REFERENCES procesos(proceso_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_procesos_epoca ON procesos(epoca);
CREATE INDEX IF NOT EXISTS idx_procesos_packing ON procesos(packing_id);
CREATE INDEX IF NOT EXISTS idx_procesos_tunel ON procesos(tunel_id);
CREATE INDEX IF NOT EXISTS idx_procesos_started_at ON procesos(started_at);
CREATE INDEX IF NOT EXISTS idx_mediciones_proc ON mediciones(proceso_id);
CREATE INDEX IF NOT EXISTS idx_mediciones_proc_t ON mediciones(proceso_id, tiempo_min);
"""

def to_int_bool(x):
    if isinstance(x, bool):
        return int(x)
    if isinstance(x, (int, float)):
        return int(x != 0)
    s = str(x).strip().lower()
    return 1 if s in ("true", "1", "yes", "si") else 0

def upsert_get_id(cur, table, id_col, key_col, key_val, extra_cols=None, extra_vals=None):
    """
    Inserta si no existe y devuelve el id_col real.
    """
    if extra_cols:
        cols = [key_col] + extra_cols
        placeholders = ",".join(["?"] * len(cols))
        sql = f"INSERT OR IGNORE INTO {table} ({','.join(cols)}) VALUES ({placeholders})"
        cur.execute(sql, [key_val] + extra_vals)
    else:
        cur.execute(f"INSERT OR IGNORE INTO {table} ({key_col}) VALUES (?)", [key_val])

    cur.execute(f"SELECT {id_col} FROM {table} WHERE {key_col} = ?", [key_val])
    row = cur.fetchone()
    if row is None:
        raise RuntimeError(f"No se pudo obtener {id_col} para {table} con {key_col}={key_val}")
    return row[0]


def start_date_for_epoca_2025(epoca: str) -> datetime:
    """
    Distribución por temporada 2025 (ajústalo como quieras):
    - mora: Ene-Abr
    - uva: May-Ago
    - mixtura: Sep-Dic
    """
    epoca = epoca.lower().strip()
    if epoca == "mora":
        return datetime(2025, 1, 5, 6, 0, 0)
    if epoca == "uva":
        return datetime(2025, 5, 5, 6, 0, 0)
    return datetime(2025, 9, 5, 6, 0, 0)

def assign_process_datetime(epoca: str, packing: str, tunel: str, iteracion: int, duracion_min: int) -> tuple[str, str]:
    """
    Genera started_at/ended_at en 2025 de manera determinística:
    - Base por epoca
    - Offset por packing, túnel e iteración
    """
    base = start_date_for_epoca_2025(epoca)

    # offsets determinísticos (para que siempre quede ordenado)
    packing_map = {"packing_A": 0, "packing_B": 1, "packing_C": 2}
    p_off = packing_map.get(packing, 0)

    tnum = int(tunel[1:])  # T01->1
    # espaciamos: cada proceso "salta" unas horas para no solaparse feo
    minutes_offset = (p_off * 7 * 24 * 60) + (tnum * 24 * 60) + (iteracion * 6 * 60)

    started = base + timedelta(minutes=minutes_offset)
    ended = started + timedelta(minutes=int(duracion_min))

    return started.isoformat(sep=" "), ended.isoformat(sep=" ")

def main():
    csv_files = glob.glob(os.path.join(BASE_DIR, "**", "csv", "*.csv"), recursive=True)
    if not csv_files:
        raise SystemExit(f"No se encontraron CSV dentro de {BASE_DIR}/**/csv/*.csv")

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.executescript(DDL)

    conn.execute("BEGIN")
    procesos = 0
    mediciones = 0

    try:
        for path in csv_files:
            df = pd.read_csv(path)

            # Validación mínima
            needed = {"proceso_id","epoca","packing","tunel","tipo_tunel","iteracion",
                      "tipo_caja","masa_caja_kg","num_cajas","masa_total_kg","masa_total_ton",
                      "palets_max","palets_usados","ocupabilidad",
                      "caudal_factor","anomalia_duracion","duracion_min","duracion_esperada_min","delta_duracion_pct",
                      "setpoint","T0","pct_transitorio","t_trans_min","overshoot_pct",
                      "tiempo_min","temperatura"}
            if not needed.issubset(set(df.columns)):
                print(f"⚠️ Saltando (faltan columnas) -> {path}")
                continue

            r = df.iloc[0]
            proceso_id = int(r["proceso_id"])
            epoca = str(r["epoca"])
            packing = str(r["packing"])
            tunel = str(r["tunel"])
            tipo_tunel = str(r["tipo_tunel"])
            iteracion = int(r["iteracion"])

            tipo_caja = str(r["tipo_caja"])
            masa_caja_kg = float(r["masa_caja_kg"])
            num_cajas = int(r["num_cajas"])
            masa_total_kg = float(r["masa_total_kg"])
            masa_total_ton = float(r["masa_total_ton"])

            palets_max = int(r["palets_max"])
            palets_usados = int(r["palets_usados"])
            ocupabilidad = float(r["ocupabilidad"])

            caudal_factor = float(r["caudal_factor"])
            anomalia = to_int_bool(r["anomalia_duracion"])

            duracion_min = int(r["duracion_min"])
            dur_esp = float(r["duracion_esperada_min"])
            delta_pct = float(r["delta_duracion_pct"])

            setpoint = float(r["setpoint"])
            T0 = float(r["T0"])
            pct_transitorio = float(r["pct_transitorio"])
            t_trans_min = float(r["t_trans_min"])
            overshoot_pct = float(r["overshoot_pct"])

            started_at, ended_at = assign_process_datetime(epoca, packing, tunel, iteracion, duracion_min)

            # Catálogos
            packing_id = upsert_get_id(cur, "packings", "packing_id", "nombre", packing)

            tunel_id = upsert_get_id(
                cur, "tuneles", "tunel_id", "codigo", tunel,
                extra_cols=["tipo_tunel", "palets_max", "descripcion"],
                extra_vals=[tipo_tunel, palets_max, f"Túnel {tunel} ({tipo_tunel})"]
            )

            caja_id = upsert_get_id(
                cur, "tipos_caja", "caja_id", "tipo_caja", tipo_caja,
                extra_cols=["masa_caja_kg"],
                extra_vals=[masa_caja_kg]
            )


            # Insert proceso (resumen/búsqueda)
            cur.execute("""
                INSERT OR REPLACE INTO procesos (
                  proceso_id, epoca, packing_id, tunel_id, caja_id,
                  iteracion, anomalia_duracion,
                  num_cajas, masa_total_kg, masa_total_ton,
                  palets_usados, ocupabilidad,
                  caudal_factor,
                  duracion_min, duracion_esperada_min, delta_duracion_pct,
                  setpoint, T0, pct_transitorio, t_trans_min, overshoot_pct,
                  started_at, ended_at, temporada_anio
                ) VALUES (?,?,?,?,?,
                          ?,?,
                          ?,?,?,
                          ?,?,
                          ?,
                          ?,?,?,
                          ?,?,?,?,?,
                          ?,?,?)
            """, (
                proceso_id, epoca, packing_id, tunel_id, caja_id,
                iteracion, anomalia,
                num_cajas, masa_total_kg, masa_total_ton,
                palets_usados, ocupabilidad,
                caudal_factor,
                duracion_min, dur_esp, delta_pct,
                setpoint, T0, pct_transitorio, t_trans_min, overshoot_pct,
                started_at, ended_at, 2025
            ))
            procesos += 1

            # Insert serie de tiempo
            rows = [(proceso_id, int(t), float(temp)) for t, temp in zip(df["tiempo_min"], df["temperatura"])]
            cur.executemany("INSERT INTO mediciones (proceso_id, tiempo_min, temperatura) VALUES (?,?,?)", rows)
            mediciones += len(rows)

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    print(f"✅ DB creada: {DB_PATH}")
    print(f"✅ Procesos: {procesos}")
    print(f"✅ Mediciones: {mediciones}")

if __name__ == "__main__":
    main()
