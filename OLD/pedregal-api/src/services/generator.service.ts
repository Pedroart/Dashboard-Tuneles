export type CurveParams = {
  ti: number;              // temp inicio
  tf: number;              // temp fin
  durationMin: number;     // 480
  alpha: number;           // 0.08
};

export type SignalParams = {
  offset: number;
  oscThreshold: number;
  oscAmp: number;
  oscPeriodMin: number;
  noiseSigma: number;
  phase: number;
  seed: number;
};

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function baseCurve(tMin: number, p: CurveParams) {
  const u = clamp(tMin / p.durationMin, 0, 1);
  return p.tf + (p.ti - p.tf) * (1 - Math.pow(u, p.alpha));
}

// Gauss (Box–Muller) con rng determinístico
function gaussian(rng: () => number) {
  const u1 = 1 - rng();
  const u2 = 1 - rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class TelemetryGenerator {
  generateSeries(t: number[], curve: CurveParams, sig: SignalParams) {
    const rng = mulberry32(sig.seed);
    const w = (2 * Math.PI) / sig.oscPeriodMin;

    return t.map((tt) => {
      const b = baseCurve(tt, curve) + sig.offset;

      const osc = (b <= sig.oscThreshold)
        ? sig.oscAmp * Math.sin(w * tt + sig.phase)
        : 0;

      const noise = sig.noiseSigma > 0 ? gaussian(rng) * sig.noiseSigma : 0;
      return b + osc + noise;
    });
  }

  // Ajuste para que el final sea exactamente targetEnd, sin romper pinchar > ambient + margin
  shiftAndEnforce(
    series: number[],
    ambient: number[],
    targetEnd: number,
    marginOverAmb: number
  ) {
    const shift = targetEnd - series[series.length - 1];
    const out: number[] = new Array(series.length);

    for (let i = 0; i < series.length; i++) {
      const v = series[i] + shift;
      out[i] = Math.max(v, ambient[i] + marginOverAmb);
    }

    // Re-fijar final (puede mover todo), vuelve a enforce
    const shift2 = targetEnd - out[out.length - 1];
    for (let i = 0; i < out.length; i++) {
      out[i] = Math.max(out[i] + shift2, ambient[i] + marginOverAmb);
    }

    return out;
  }
}
