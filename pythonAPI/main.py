from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import aiosqlite

DB_PATH = "datos_2025.db"  # <-- cambia si tu db se llama distinto

app = FastAPI(title="API Procesos (SQLite) - RAW", version="3.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PROCESOS_COLS = []
MEDICIONES_COLS = []
CATALOGS = {
    "packings": [],
    "tuneles": [],
    "tipos_caja": [],
}

# -------------------------
# Helpers compatibles con cualquier aiosqlite
# -------------------------
async def fetchone(db: aiosqlite.Connection, sql: str, params=None):
    cur = await db.execute(sql, params or [])
    row = await cur.fetchone()
    await cur.close()
    return row

async def fetchall(db: aiosqlite.Connection, sql: str, params=None):
    cur = await db.execute(sql, params or [])
    rows = await cur.fetchall()
    await cur.close()
    return rows

async def table_columns(table: str):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        rows = await fetchall(db, f"PRAGMA table_info({table})")
        return [r["name"] for r in rows]

def build_where(filters):
    where = []
    params = []
    for col, op, val in filters:
        if val is None:
            continue
        where.append(f"{col} {op} ?")
        params.append(val)
    where_sql = (" WHERE " + " AND ".join(where)) if where else ""
    return where_sql, params

# -------------------------
# Startup: leer columnas reales
# -------------------------
@app.on_event("startup")
async def startup():
    global PROCESOS_COLS, MEDICIONES_COLS

    PROCESOS_COLS = await table_columns("procesos")
    MEDICIONES_COLS = await table_columns("mediciones")

    for t in list(CATALOGS.keys()):
        try:
            CATALOGS[t] = await table_columns(t)
        except Exception:
            CATALOGS[t] = []

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("PRAGMA journal_mode=WAL;")
        await db.execute("PRAGMA synchronous=NORMAL;")
        await db.commit()

# -------------------------
# Endpoints
# -------------------------
@app.get("/health")
async def health():
    return {
        "ok": True,
        "db": DB_PATH,
        "procesos_cols": PROCESOS_COLS,
        "mediciones_cols": MEDICIONES_COLS,
    }

@app.get("/catalog/{name}")
async def catalog(name: str):
    if name not in CATALOGS or not CATALOGS[name]:
        raise HTTPException(404, detail=f"Catálogo '{name}' no existe en la DB")

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        rows = await fetchall(db, f"SELECT * FROM {name}")
        return [dict(r) for r in rows]


@app.get("/temporadas")
async def get_temporadas(packing_id: Optional[int] = Query(None)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        if packing_id:
            rows = await fetchall(
                db,
                """
                SELECT DISTINCT p.temporada_anio AS value
                FROM procesos p
                WHERE p.packing_id = ?
                  AND p.temporada_anio IS NOT NULL
                ORDER BY p.temporada_anio DESC
                """,
                [packing_id]
            )
        else:
            rows = await fetchall(
                db,
                """
                SELECT DISTINCT temporada_anio AS value
                FROM procesos
                WHERE temporada_anio IS NOT NULL
                ORDER BY temporada_anio DESC
                """
            )

        return [{"id": r["value"], "name": str(r["value"])} for r in rows]


@app.get("/packings")
async def get_packings():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        rows = await fetchall(
            db,
            """
            SELECT packing_id AS id, nombre AS name
            FROM packings
            GROUP BY packing_id, nombre
            ORDER BY nombre ASC
            """
        )

        return [{"id": r["id"], "name": r["name"]} for r in rows]



@app.get("/frutas")
async def get_frutas(
    packing_id: Optional[int] = Query(None),
    temporada: Optional[int] = Query(None)
):
    filters = ["p.epoca IS NOT NULL"]
    params = []

    if packing_id:
        filters.append("p.packing_id = ?")
        params.append(packing_id)

    if temporada:
        filters.append("p.temporada_anio = ?")
        params.append(temporada)

    where_sql = " WHERE " + " AND ".join(filters)

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        rows = await fetchall(
            db,
            f"""
            SELECT DISTINCT p.epoca AS value
            FROM procesos p
            {where_sql}
            ORDER BY p.epoca ASC
            """,
            params
        )

        return [{"id": r["value"], "name": r["value"]} for r in rows]


# -------------------------
# Procesos (lista) - filtros simples
# -------------------------
@app.get("/procesos")
async def listar_procesos(
    # fechas
    started_from: Optional[str] = None,   # "2025-05-01 00:00:00"
    started_to: Optional[str] = None,     # "2025-05-31 23:59:59"

    # filtros opcionales
    temporada_anio: Optional[int] = None,
    packing_id: Optional[int] = None,
    epoca: Optional[str] = None,

    # paginación
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    def col_exists(c): 
        return c in PROCESOS_COLS

    filters = []

    # temporada
    if temporada_anio is not None and col_exists("temporada_anio"):
        filters.append(("temporada_anio", "=", temporada_anio))

    # packing
    if packing_id is not None and col_exists("packing_id"):
        filters.append(("packing_id", "=", packing_id))

    # epoca (variada)
    if epoca and col_exists("epoca"):
        filters.append(("epoca", "=", epoca))

    # fechas
    if started_from and col_exists("started_at"):
        filters.append(("started_at", ">=", started_from))
    if started_to and col_exists("started_at"):
        filters.append(("started_at", "<=", started_to))

    # WHERE dinámico
    where_sql, params = build_where(filters)

    sql_items = f"""
        SELECT p.*, tc.tipo_caja
        FROM procesos p
        JOIN tipos_caja tc ON p.caja_id = tc.caja_id
        {where_sql}
        ORDER BY p.proceso_id DESC
        LIMIT ? OFFSET ?
    """

    sql_total = f"""
        SELECT COUNT(*) as total
        FROM procesos p
        {where_sql}
    """

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        total_row = await fetchone(db, sql_total, params)
        total = int(total_row["total"]) if total_row else 0

        rows = await fetchall(db, sql_items, params + [limit, offset])

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "items": [dict(r) for r in rows]
        }


# -------------------------
# Proceso (detalle metadata)
# -------------------------
@app.get("/procesos/{proceso_id}")
async def get_proceso(proceso_id: int):
    cols_sql = ", ".join([f'"{c}"' for c in PROCESOS_COLS])
    sql = f"SELECT {cols_sql} FROM procesos WHERE proceso_id = ?"

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        row = await fetchone(db, sql, [proceso_id])
        if not row:
            raise HTTPException(404, detail="Proceso no encontrado")
        return dict(row)

# -------------------------
# Métricas por proceso (de mediciones)
# -------------------------
@app.get("/procesos/{proceso_id}/metricas")
async def metricas_proceso(proceso_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        exists = await fetchone(db, "SELECT 1 FROM procesos WHERE proceso_id = ? LIMIT 1", [proceso_id])
        if not exists:
            raise HTTPException(404, detail="Proceso no encontrado")

        # métricas básicas de la serie
        row = await fetchone(db, """
            SELECT
                COUNT(*) as n,
                MIN(temperatura) as temp_min,
                MAX(temperatura) as temp_max,
                AVG(temperatura) as temp_avg,
                MIN(tiempo_min) as t_min,
                MAX(tiempo_min) as t_max
            FROM mediciones
            WHERE proceso_id = ?
        """, [proceso_id])

        if not row or row["n"] == 0:
            return {"proceso_id": proceso_id, "n": 0}

        # duración en minutos desde serie (t_max - t_min)
        dur_serie = int(row["t_max"] - row["t_min"]) if row["t_max"] is not None else None

        return {
            "proceso_id": proceso_id,
            "n": int(row["n"]),
            "temp_min": float(row["temp_min"]) if row["temp_min"] is not None else None,
            "temp_max": float(row["temp_max"]) if row["temp_max"] is not None else None,
            "temp_avg": float(row["temp_avg"]) if row["temp_avg"] is not None else None,
            "t_min": int(row["t_min"]) if row["t_min"] is not None else None,
            "t_max": int(row["t_max"]) if row["t_max"] is not None else None,
            "duracion_min_aprox": dur_serie
        }

# -------------------------
# Serie de tiempo
# -------------------------
@app.get("/procesos/{proceso_id}/serie")
async def get_serie(
    proceso_id: int,
    t_min: int = Query(0, ge=0),
    t_max: Optional[int] = None,
    step: int = Query(1, ge=1, le=60),
):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        exists = await fetchone(db, "SELECT 1 FROM procesos WHERE proceso_id = ? LIMIT 1", [proceso_id])
        if not exists:
            raise HTTPException(404, detail="Proceso no encontrado")

        filters = [("proceso_id", "=", proceso_id), ("tiempo_min", ">=", t_min)]
        if t_max is not None:
            filters.append(("tiempo_min", "<=", t_max))

        where_sql, params = build_where(filters)

        sql = f"""
            SELECT tiempo_min, temperatura
            FROM mediciones
            {where_sql}
            ORDER BY tiempo_min ASC
        """
        rows = await fetchall(db, sql, params)
        out = [dict(r) for r in rows]
        if step > 1:
            out = out[::step]
        return out

# -------------------------
# Resumen global (como antes, simple)
# -------------------------
@app.get("/stats/resumen")
async def stats_resumen(
    group_by: str = Query("epoca")
):
    allowed = set(PROCESOS_COLS) | {"mes"}
    if group_by not in allowed:
        raise HTTPException(400, detail=f"group_by inválido. Opciones: {sorted(list(allowed))}")

    if group_by == "mes":
        if "started_at" not in PROCESOS_COLS:
            raise HTTPException(400, detail="No existe started_at para agrupar por mes")
        group_expr = "substr(started_at, 1, 7)"  # YYYY-MM
    else:
        group_expr = f'"{group_by}"'

    masa_col = "masa_total_ton" if "masa_total_ton" in PROCESOS_COLS else None
    dur_col = "duracion_min" if "duracion_min" in PROCESOS_COLS else None
    delta_col = "delta_duracion_pct" if "delta_duracion_pct" in PROCESOS_COLS else None
    anom_col = "anomalia_duracion" if "anomalia_duracion" in PROCESOS_COLS else None

    select_parts = [f"{group_expr} as grupo", "COUNT(*) as n"]
    if masa_col: select_parts.append(f"AVG({masa_col}) as masa_ton_avg")
    if dur_col: select_parts.append(f"AVG({dur_col}) as duracion_min_avg")
    if delta_col: select_parts.append(f"AVG({delta_col}) as delta_pct_avg")
    if anom_col: select_parts.append(f"SUM({anom_col}) as anomalias")

    sql = f"""
        SELECT {", ".join(select_parts)}
        FROM procesos
        GROUP BY {group_expr}
        ORDER BY {group_expr} ASC
    """

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        rows = await fetchall(db, sql)
        return [dict(r) for r in rows]
