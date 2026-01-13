from typing import Optional, List
from fastapi import FastAPI, Query, HTTPException
from sqlalchemy import (
    Column, Integer, Float, String, ForeignKey,
    select, func, text
)
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

DB_PATH = "datos.db"
DATABASE_URL = f"sqlite+aiosqlite:///{DB_PATH}"

Base = declarative_base()

class Proceso(Base):
    __tablename__ = "procesos"

    proceso_id = Column(Integer, primary_key=True, index=True)
    epoca = Column(String)
    packing = Column(String)
    tunel = Column(String)
    tipo_tunel = Column(String)
    iteracion = Column(Integer)

    mass_group = Column(String)
    masa_ton = Column(Float)
    ocupabilidad = Column(Float)
    caudal_factor = Column(Float)

    anomalia_duracion = Column(Integer)  # 0/1
    duracion_min = Column(Integer)
    duracion_esperada_min = Column(Float)
    delta_duracion_pct = Column(Float)

    setpoint = Column(Float)
    T0 = Column(Float)
    pct_transitorio = Column(Float)
    t_trans_min = Column(Float)
    overshoot_pct = Column(Float)

    mediciones = relationship("Medicion", back_populates="proceso")


class Medicion(Base):
    __tablename__ = "mediciones"

    id = Column(Integer, primary_key=True, autoincrement=True)
    proceso_id = Column(Integer, ForeignKey("procesos.proceso_id"), index=True, nullable=False)
    tiempo_min = Column(Integer, nullable=False)
    temperatura = Column(Float, nullable=False)

    proceso = relationship("Proceso", back_populates="mediciones")


engine = create_async_engine(DATABASE_URL, echo=False, future=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

app = FastAPI(title="API Procesos (SQLite)", version="1.0")


@app.on_event("startup")
async def startup():
    # No creamos tablas porque ya existen en tu DB.
    # Activamos WAL para mejores lecturas concurrentes.
    async with engine.begin() as conn:
        await conn.execute(text("PRAGMA journal_mode=WAL;"))
        await conn.execute(text("PRAGMA synchronous=NORMAL;"))


def proceso_to_dict(p: Proceso):
    return {
        "proceso_id": p.proceso_id,
        "epoca": p.epoca,
        "packing": p.packing,
        "tunel": p.tunel,
        "tipo_tunel": p.tipo_tunel,
        "iteracion": p.iteracion,
        "mass_group": p.mass_group,
        "masa_ton": p.masa_ton,
        "ocupabilidad": p.ocupabilidad,
        "caudal_factor": p.caudal_factor,
        "anomalia_duracion": bool(p.anomalia_duracion),
        "duracion_min": p.duracion_min,
        "duracion_esperada_min": p.duracion_esperada_min,
        "delta_duracion_pct": p.delta_duracion_pct,
        "setpoint": p.setpoint,
        "T0": p.T0,
        "pct_transitorio": p.pct_transitorio,
        "t_trans_min": p.t_trans_min,
        "overshoot_pct": p.overshoot_pct,
    }


@app.get("/health")
async def health():
    return {"ok": True, "db": DB_PATH}


@app.get("/procesos")
async def listar_procesos(
    epoca: Optional[str] = None,
    packing: Optional[str] = None,
    tunel: Optional[str] = None,
    tipo_tunel: Optional[str] = None,
    mass_group: Optional[str] = None,
    anomalia: Optional[bool] = None,

    masa_min: Optional[float] = None,
    masa_max: Optional[float] = None,

    dur_min: Optional[int] = None,
    dur_max: Optional[int] = None,

    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    async with SessionLocal() as db:
        filters = []

        if epoca: filters.append(Proceso.epoca == epoca)
        if packing: filters.append(Proceso.packing == packing)
        if tunel: filters.append(Proceso.tunel == tunel)
        if tipo_tunel: filters.append(Proceso.tipo_tunel == tipo_tunel)
        if mass_group: filters.append(Proceso.mass_group == mass_group)

        if anomalia is not None:
            filters.append(Proceso.anomalia_duracion == (1 if anomalia else 0))

        if masa_min is not None: filters.append(Proceso.masa_ton >= masa_min)
        if masa_max is not None: filters.append(Proceso.masa_ton <= masa_max)

        if dur_min is not None: filters.append(Proceso.duracion_min >= dur_min)
        if dur_max is not None: filters.append(Proceso.duracion_min <= dur_max)

        # Total (para paginación)
        total_stmt = select(func.count()).select_from(Proceso).where(*filters)
        total = (await db.execute(total_stmt)).scalar_one()

        stmt = (
            select(Proceso)
            .where(*filters)
            .order_by(Proceso.proceso_id.desc())
            .limit(limit)
            .offset(offset)
        )
        rows = (await db.execute(stmt)).scalars().all()

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "items": [proceso_to_dict(p) for p in rows],
        }


@app.get("/procesos/{proceso_id}")
async def obtener_proceso(proceso_id: int):
    async with SessionLocal() as db:
        p = (await db.execute(select(Proceso).where(Proceso.proceso_id == proceso_id))).scalar_one_or_none()
        if not p:
            raise HTTPException(status_code=404, detail="Proceso no encontrado")
        return proceso_to_dict(p)


@app.get("/procesos/{proceso_id}/serie")
async def serie_tiempo(
    proceso_id: int,
    # opcional: recortar ventana
    t_min: int = Query(0, ge=0),
    t_max: Optional[int] = None,
    # opcional: downsample (cada N puntos)
    step: int = Query(1, ge=1, le=60),
):
    async with SessionLocal() as db:
        # validar proceso existe
        exists = (await db.execute(select(func.count()).select_from(Proceso).where(Proceso.proceso_id == proceso_id))).scalar_one()
        if not exists:
            raise HTTPException(status_code=404, detail="Proceso no encontrado")

        filters = [Medicion.proceso_id == proceso_id, Medicion.tiempo_min >= t_min]
        if t_max is not None:
            filters.append(Medicion.tiempo_min <= t_max)

        stmt = (
            select(Medicion.tiempo_min, Medicion.temperatura)
            .where(*filters)
            .order_by(Medicion.tiempo_min.asc())
        )

        rows = (await db.execute(stmt)).all()

        # downsample simple
        if step > 1:
            rows = rows[::step]

        return [{"tiempo_min": int(t), "temperatura": float(temp)} for (t, temp) in rows]


@app.get("/stats/resumen")
async def resumen_global(
    group_by: str = Query("mass_group", pattern="^(mass_group|tunel|epoca|packing|tipo_tunel)$")
):
    """
    Resumen agregado para análisis rápido.
    """
    async with SessionLocal() as db:
        col = getattr(Proceso, group_by)

        stmt = (
            select(
                col.label("group"),
                func.count().label("n"),
                func.avg(Proceso.masa_ton).label("masa_ton_avg"),
                func.avg(Proceso.duracion_min).label("duracion_min_avg"),
                func.avg(Proceso.delta_duracion_pct).label("delta_pct_avg"),
                func.sum(Proceso.anomalia_duracion).label("anomalias")
            )
            .group_by(col)
            .order_by(col.asc())
        )

        rows = (await db.execute(stmt)).all()
        return [
            {
                "group": r.group,
                "n": int(r.n),
                "masa_ton_avg": float(r.masa_ton_avg) if r.masa_ton_avg is not None else None,
                "duracion_min_avg": float(r.duracion_min_avg) if r.duracion_min_avg is not None else None,
                "delta_pct_avg": float(r.delta_pct_avg) if r.delta_pct_avg is not None else None,
                "anomalias": int(r.anomalias) if r.anomalias is not None else 0
            }
            for r in rows
        ]
