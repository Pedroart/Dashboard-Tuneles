import { db } from "./sqlite.js";

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS plants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tunnels (
      id TEXT PRIMARY KEY,          -- pk1_T01
      plant_id TEXT NOT NULL,
      code TEXT NOT NULL,           -- T01
      name TEXT,
      type TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (plant_id) REFERENCES plants(id)
    );

    CREATE INDEX IF NOT EXISTS idx_tunnels_plant_code ON tunnels(plant_id, code);

    CREATE TABLE IF NOT EXISTS sensors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tunnel_id TEXT NOT NULL,
      code TEXT NOT NULL,           -- AMBIENT, RETURN, P01..P24
      kind TEXT NOT NULL,           -- ambient|return|pinchar
      enabled INTEGER NOT NULL DEFAULT 1,
      UNIQUE(tunnel_id, code),
      FOREIGN KEY (tunnel_id) REFERENCES tunnels(id)
    );

    CREATE INDEX IF NOT EXISTS idx_sensors_tunnel_kind ON sensors(tunnel_id, kind);

    CREATE TABLE IF NOT EXISTS processes (
      id TEXT PRIMARY KEY,
      plant_id TEXT NOT NULL,
      tunnel_id TEXT NOT NULL,
      started_at TEXT NOT NULL,     -- ISO string local (Perú)
      ended_at TEXT,
      status TEXT NOT NULL,         -- open|closed|aborted
      target_temp REAL,
      tarja TEXT,
      envase TEXT,
      formato TEXT,
      kg_per_box REAL,
      box_count INTEGER,
      ocupability REAL,
      FOREIGN KEY (plant_id) REFERENCES plants(id),
      FOREIGN KEY (tunnel_id) REFERENCES tunnels(id)
    );

    CREATE INDEX IF NOT EXISTS idx_processes_plant_tunnel_start ON processes(plant_id, tunnel_id, started_at);

    CREATE TABLE IF NOT EXISTS telemetry_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      process_id TEXT NOT NULL,
      ts TEXT NOT NULL,             -- ISO local
      sensor_code TEXT NOT NULL,
      value REAL NOT NULL,
      FOREIGN KEY (process_id) REFERENCES processes(id)
    );

    CREATE INDEX IF NOT EXISTS idx_tp_process_ts ON telemetry_points(process_id, ts);
    CREATE INDEX IF NOT EXISTS idx_tp_process_sensor_ts ON telemetry_points(process_id, sensor_code, ts);

    CREATE TABLE IF NOT EXISTS process_faults (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      process_id TEXT NOT NULL,
      sensor_code TEXT NOT NULL,
      fault_type TEXT NOT NULL,
      start_ts TEXT NOT NULL,
      end_ts TEXT NOT NULL,
      meta_json TEXT,
      FOREIGN KEY (process_id) REFERENCES processes(id)
    );

    CREATE INDEX IF NOT EXISTS idx_faults_process_sensor ON process_faults(process_id, sensor_code, start_ts);

    CREATE TABLE IF NOT EXISTS process_summary (
      process_id TEXT PRIMARY KEY,
      computed_at TEXT NOT NULL,
      duration_min INTEGER,
      ambient_min REAL, ambient_max REAL, ambient_avg REAL,
      retorno_min REAL, retorno_max REAL, retorno_avg REAL,
      pinchar_min REAL, pinchar_max REAL, pinchar_avg REAL,
      pinchar_count INTEGER,
      temp_min_global REAL, temp_max_global REAL,
      faults_count INTEGER DEFAULT 0,
      faults_preview_json TEXT
    );
  `);
}
