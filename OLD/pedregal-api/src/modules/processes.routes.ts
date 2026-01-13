import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/sqlite.js";

const qListSchema = z.object({
  plant: z.string().min(1),
  from: z.string().min(8).optional(),  // "YYYY-MM-DD" o ISO
  to: z.string().min(8).optional(),    // "YYYY-MM-DD" o ISO
  tunnel: z.string().min(3).optional(),// "T01".."T16" (code)
  status: z.string().optional(),       // open|closed|aborted
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

function toIsoStartOfDay(localDate: string) {
  // recibe "YYYY-MM-DD" => "YYYY-MM-DDT00:00:00"
  if (localDate.length === 10) return `${localDate}T00:00:00`;
  return localDate; // ya es ISO
}

function toIsoEndOfDay(localDate: string) {
  // "YYYY-MM-DD" => "YYYY-MM-DDT23:59:59"
  if (localDate.length === 10) return `${localDate}T23:59:59`;
  return localDate;
}

export async function processesRoutes(app: FastifyInstance) {
  // GET /api/processes?plant=pk1&from=2026-01-01&to=2026-01-05&tunnel=T03&status=closed&limit=50&offset=0
  app.get("/processes", async (req, reply) => {
    const parsed = qListSchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const { plant, from, to, tunnel, status, limit, offset } = parsed.data;

    // tunnelId es pk1_T03 si envías tunnel="T03"
    const tunnelId = tunnel ? `${plant}_${tunnel}` : undefined;

    const where: string[] = [`p.plant_id = ?`];
    const params: any[] = [plant];

    if (tunnelId) { where.push(`p.tunnel_id = ?`); params.push(tunnelId); }
    if (status)   { where.push(`p.status = ?`); params.push(status); }

    if (from) { where.push(`p.started_at >= ?`); params.push(toIsoStartOfDay(from)); }
    if (to)   { where.push(`p.started_at <= ?`); params.push(toIsoEndOfDay(to)); }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const total = db.prepare(`
      SELECT COUNT(*) as c
      FROM processes p
      ${whereSql}
    `).get(...params).c as number;

    const items = db.prepare(`
      SELECT
        p.id as process_id,
        p.plant_id as plant,
        p.tunnel_id as tunnel_id,
        p.started_at,
        p.ended_at,
        p.status,
        p.target_temp,
        p.tarja,
        p.envase,
        p.formato,
        p.kg_per_box,
        p.box_count,
        p.ocupability,
        s.duration_min,
        s.temp_min_global,
        s.temp_max_global,
        s.faults_count
      FROM processes p
      LEFT JOIN process_summary s ON s.process_id = p.id
      ${whereSql}
      ORDER BY p.started_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    // tunnel_code para UI
    const mapped = items.map((x: any) => ({
      ...x,
      tunnel_code: String(x.tunnel_id).split("_")[1] ?? x.tunnel_id,
    }));

    return { total, limit, offset, items: mapped };
  });

  // GET /api/processes/:id/summary
  app.get("/processes/:id/summary", async (req, reply) => {
    const { id } = req.params as { id: string };

    const summary = db.prepare(`
      SELECT *
      FROM process_summary
      WHERE process_id = ?
    `).get(id);

    if (!summary) return reply.code(404).send({ error: "summary not found" });
    return summary;
  });

  // GET /api/processes/:id/faults
  app.get("/processes/:id/faults", async (req, reply) => {
    const { id } = req.params as { id: string };

    const faults = db.prepare(`
      SELECT id, sensor_code, fault_type, start_ts, end_ts, meta_json
      FROM process_faults
      WHERE process_id = ?
      ORDER BY start_ts ASC
    `).all(id);

    return { process_id: id, faults };
  });
}
