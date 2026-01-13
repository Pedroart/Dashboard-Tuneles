import type { FaultEvent } from "./faults.service.js";

function stats(arr: number[]) {
  let min = Infinity, max = -Infinity, sum = 0;
  for (const v of arr) { if (v < min) min = v; if (v > max) max = v; sum += v; }
  return { min, max, avg: arr.length ? sum / arr.length : null };
}

export class SummaryBuilder {
  build(opts: {
    durationMin: number;
    ambient: number[];
    retorno: number[];
    pinchars: Record<string, number[]>; // sensorCode -> series
    faults: FaultEvent[];
  }) {
    const { durationMin, ambient, retorno, pinchars, faults } = opts;

    const a = stats(ambient);
    const r = stats(retorno);

    const pinSeries = Object.values(pinchars).flat();
    const p = stats(pinSeries);

    const gmin = Math.min(a.min, r.min, p.min);
    const gmax = Math.max(a.max, r.max, p.max);

    return {
      computed_at: new Date().toISOString(),
      duration_min: durationMin,
      ambient_min: a.min, ambient_max: a.max, ambient_avg: a.avg,
      retorno_min: r.min, retorno_max: r.max, retorno_avg: r.avg,
      pinchar_min: p.min, pinchar_max: p.max, pinchar_avg: p.avg,
      pinchar_count: Object.keys(pinchars).length,
      temp_min_global: gmin,
      temp_max_global: gmax,
      faults_count: faults.length,
      faults_preview_json: JSON.stringify(faults.slice(0, 10)),
    };
  }
}
