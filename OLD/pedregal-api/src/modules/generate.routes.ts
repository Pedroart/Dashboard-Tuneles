import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/sqlite.js";
import { randomUUID } from "crypto";

import { TelemetryGenerator } from "../services/generator.service.js";
import { FaultInjector } from "../services/faults.service.js";
import { SummaryBuilder } from "../services/summary.service.js";

const bodySchema = z.object({
  plant: z.string().min(1),
  tunnel: z.string().min(3),          // T01
  duration_min: z.number().int().min(10).max(24 * 60).default(480),

  // curva
  ti: z.number().default(24),
  tf: z.number().default(0),
  alpha: z.number().default(0.08),

  // oscilación general
  osc_threshold: z.number().default(2.0),
  osc_amp: z.number().default(0.25),
  osc_period_min: z.number().default(10),

  // fallas
  faults_per_hour: z.number().default(0.25),

  // metadata de producción
  tarja: z.string().optional(),
  envase: z.string().optional(),
  formato: z.string().optional(),
  kg_per_box: z.number().optional(),
  box_count: z.number().int().optional(),
  ocupability: z.number().optional(),

});

function nowLocalIso() {
  // guardamos ISO "naive" local (sin offset)
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function addMinutesIso(isoLocal: string, minutes: number) {
  const d = new Date(isoLocal);
  d.setMinutes(d.getMinutes() + minutes);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export async function generateRoutes(app: FastifyInstance) {
  const generator = new TelemetryGenerator();
  const injector = new FaultInjector();
  const summaryBuilder = new SummaryBuilder();

  app.post("/dev/generate-process", async (req, reply) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const b = parsed.data;
    const tunnelId = `${b.plant}_${b.tunnel}`;

    const tunnel = db.prepare(`SELECT id FROM tunnels WHERE id = ? AND enabled = 1`).get(tunnelId);
    if (!tunnel) return reply.code(400).send({ error: "tunnel not found", tunnelId });

    // sensores del túnel
    const sensors = db.prepare(`
      SELECT code, kind
      FROM sensors
      WHERE tunnel_id = ? AND enabled = 1
      ORDER BY kind ASC, code ASC
    `).all(tunnelId) as Array<{ code: string; kind: string }>;

    const ambientSensor = sensors.find(s => s.code === "AMBIENT");
    const returnSensor = sensors.find(s => s.code === "RETURN");
    const pinchars = sensors.filter(s => s.kind === "pinchar" && s.code.startsWith("P"));

    if (!ambientSensor || !returnSensor) {
      return reply.code(400).send({ error: "missing AMBIENT/RETURN sensors in config", tunnelId });
    }
    if (pinchars.length === 0) {
      return reply.code(400).send({ error: "no pinchar sensors configured", tunnelId });
    }

    const processId = randomUUID();
    const startedAt = nowLocalIso();
    const endedAt = addMinutesIso(startedAt, b.duration_min);

    db.prepare(`
    INSERT INTO processes (
        id, plant_id, tunnel_id, started_at, ended_at, status, target_temp,
        tarja, envase, formato, kg_per_box, box_count, ocupability
    )
    VALUES (
        ?, ?, ?, ?, ?, 'closed', ?,
        ?, ?, ?, ?, ?, ?
    )
    `).run(
    processId, b.plant, tunnelId, startedAt, endedAt, b.tf,
    b.tarja ?? null,
    b.envase ?? null,
    b.formato ?? null,
    b.kg_per_box ?? null,
    b.box_count ?? null,
    b.ocupability ?? null
    );

    const t = Array.from({ length: b.duration_min + 1 }, (_, i) => i);

    // AMBIENT y RETURN (aire)
    const curve = { ti: b.ti, tf: b.tf, durationMin: b.duration_min, alpha: b.alpha };

    const ambient = generator.generateSeries(t, curve, {
      offset: -0.35,
      oscThreshold: 3.0,
      oscAmp: 0.14,
      oscPeriodMin: 9,
      noiseSigma: 0.03,
      phase: 0.4,
      seed: 1000 + processId.length,
    });

    const retorno = generator.generateSeries(t, curve, {
      offset: -0.20,
      oscThreshold: 3.0,
      oscAmp: 0.16,
      oscPeriodMin: 8,
      noiseSigma: 0.03,
      phase: 1.1,
      seed: 2000 + processId.length,
    });

    // PINCHAR base (sin fallas aún)
    const marginOverAmb = 0.08;
    const pincharSeries: Record<string, number[]> = {};

    // objetivos 0.1..0.5 repartidos en la cantidad de pinchars configurados
    const n = pinchars.length;
    const targets = Array.from({ length: n }, (_, i) => 0.1 + (0.4 * i) / Math.max(1, n - 1));

    pinchars.forEach((s, idx) => {
      const A_i = 0.18 + 0.05 * (idx / Math.max(1, n - 1));
      const period_i = 7.0 + 2.5 * (idx / Math.max(1, n - 1));
      const sigma_i = 0.04 + 0.03 * (idx / Math.max(1, n - 1));
      const phase_i = 0.7 * idx + 0.2;
      const offset_i = 0.15 + 0.10 * Math.sin(idx);

      const base = generator.generateSeries(t, curve, {
        offset: offset_i,
        oscThreshold: b.osc_threshold,
        oscAmp: b.osc_amp,
        oscPeriodMin: b.osc_period_min,
        noiseSigma: sigma_i,
        phase: phase_i,
        seed: 3000 + idx * 999 + processId.length,
      });

      // enforce y final target
      const fixed = generator.shiftAndEnforce(base, ambient, targets[idx], marginOverAmb);
      pincharSeries[s.code] = fixed;
    });

    // Inyectar fallas (solo pinchars)
    const allFaults: Array<{
      sensorCode: string; faultType: string; startMin: number; endMin: number; meta?: any;
    }> = [];

    for (let idx = 0; idx < pinchars.length; idx++) {
      const code = pinchars[idx].code;
      const injected = injector.injectIntoPincharSeries({
        sensorCode: code,
        series: pincharSeries[code],
        ambient,
        durationMin: b.duration_min,
        faultsPerHour: b.faults_per_hour / n, // repartir por sensor
        seed: 9000 + idx * 77 + processId.length,
      });

      pincharSeries[code] = injected.series;
      allFaults.push(...injected.events);
    }

    // Guardar telemetry_points en batch (transacción)
    const insTP = db.prepare(`
      INSERT INTO telemetry_points (process_id, ts, sensor_code, value)
      VALUES (?, ?, ?, ?)
    `);

    const tx = db.transaction(() => {
      for (let i = 0; i < t.length; i++) {
        const ts = addMinutesIso(startedAt, i);

        insTP.run(processId, ts, "AMBIENT", ambient[i]);
        insTP.run(processId, ts, "RETURN", retorno[i]);

        for (const code of Object.keys(pincharSeries)) {
          insTP.run(processId, ts, code, pincharSeries[code][i]);
        }
      }
    });
    tx();

    // Guardar fallas
    const insF = db.prepare(`
      INSERT INTO process_faults (process_id, sensor_code, fault_type, start_ts, end_ts, meta_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const txF = db.transaction(() => {
      for (const f of allFaults) {
        insF.run(
          processId,
          f.sensorCode,
          f.faultType,
          addMinutesIso(startedAt, f.startMin),
          addMinutesIso(startedAt, f.endMin),
          f.meta ? JSON.stringify(f.meta) : null
        );
      }
    });
    txF();

    // Summary
    const summary = summaryBuilder.build({
      durationMin: b.duration_min,
      ambient,
      retorno,
      pinchars: pincharSeries,
      faults: allFaults as any,
    });

    db.prepare(`
      INSERT INTO process_summary (
        process_id, computed_at, duration_min,
        ambient_min, ambient_max, ambient_avg,
        retorno_min, retorno_max, retorno_avg,
        pinchar_min, pinchar_max, pinchar_avg, pinchar_count,
        temp_min_global, temp_max_global,
        faults_count, faults_preview_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      processId, summary.computed_at, summary.duration_min,
      summary.ambient_min, summary.ambient_max, summary.ambient_avg,
      summary.retorno_min, summary.retorno_max, summary.retorno_avg,
      summary.pinchar_min, summary.pinchar_max, summary.pinchar_avg, summary.pinchar_count,
      summary.temp_min_global, summary.temp_max_global,
      summary.faults_count, summary.faults_preview_json
    );

    return {
      ok: true,
      process_id: processId,
      plant: b.plant,
      tunnel: b.tunnel,
      started_at: startedAt,
      ended_at: endedAt,
      pinchar_count: pinchars.length,
      faults_count: allFaults.length,
    };
  });
}
