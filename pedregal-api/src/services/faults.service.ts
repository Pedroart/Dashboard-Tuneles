export type FaultType = "disconnect" | "freeze" | "out_of_range" | "below_ambient";

export type FaultEvent = {
  sensorCode: string;
  faultType: FaultType;
  startMin: number;
  endMin: number; // exclusivo
  meta?: any;
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function poisson(lambda: number, rng: () => number) {
  // Knuth
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do { k++; p *= rng(); } while (p > L);
  return Math.max(0, k - 1);
}

export class FaultInjector {
  injectIntoPincharSeries(opts: {
    sensorCode: string;
    series: number[];
    ambient: number[];
    durationMin: number;
    faultsPerHour: number; // 0.25
    seed: number;
  }) {
    const { sensorCode, series, ambient, durationMin, faultsPerHour, seed } = opts;
    const y = series.slice();
    const rng = mulberry32(seed);

    const hours = durationMin / 60;
    const nEvents = poisson(faultsPerHour * hours, rng);

    const events: FaultEvent[] = [];

    const pickType = (): FaultType => {
      const r = rng();
      if (r < 0.35) return "disconnect";
      if (r < 0.70) return "freeze";
      if (r < 0.90) return "out_of_range";
      return "below_ambient";
    };

    for (let e = 0; e < nEvents; e++) {
      const type = pickType();
      const start = Math.floor(5 + rng() * (durationMin - 10));

      if (type === "disconnect") {
        const dur = 2 + Math.floor(rng() * 10); // 2..11
        const end = Math.min(durationMin, start + dur);
        for (let i = start; i < end; i++) y[i] = 600;
        events.push({ sensorCode, faultType: type, startMin: start, endMin: end, meta: { value: 600 } });
      }

      if (type === "freeze") {
        const dur = 5 + Math.floor(rng() * 20); // 5..24
        const end = Math.min(durationMin, start + dur);
        const frozen = y[Math.max(0, start - 1)];
        for (let i = start; i < end; i++) y[i] = frozen;
        events.push({ sensorCode, faultType: type, startMin: start, endMin: end, meta: { value: frozen } });
      }

      if (type === "out_of_range") {
        const count = 1 + Math.floor(rng() * 4); // 1..4
        const points: Array<[number, number]> = [];
        for (let k = 0; k < count; k++) {
          const idx = Math.min(durationMin, start + Math.floor(rng() * 15));
          const v = [-50, -20, 85, 120, 999][Math.floor(rng() * 5)];
          y[idx] = v;
          points.push([idx, v]);
        }
        const mins = Math.min(...points.map(p => p[0]));
        const maxs = Math.max(...points.map(p => p[0])) + 1;
        events.push({ sensorCode, faultType: type, startMin: mins, endMin: maxs, meta: { points } });
      }

      if (type === "below_ambient") {
        const dur = 3 + Math.floor(rng() * 8); // 3..10
        const end = Math.min(durationMin, start + dur);
        for (let i = start; i < end; i++) y[i] = ambient[i] - (0.3 + rng() * 0.7);
        events.push({ sensorCode, faultType: type, startMin: start, endMin: end, meta: { rule: "ambient-(0.3..1.0)" } });
      }
    }

    return { series: y, events };
  }
}
