import math
import json
import random
from dataclasses import dataclass, asdict
from typing import List, Dict, Tuple

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt


# -------------------------
# Utilidades
# -------------------------
def clamp(v, lo, hi):
    return lo if v < lo else hi if v > hi else v


def base_curve(t_min, T0=24.0, Tf=0.0, tf_min=480, alpha=0.08):
    u = clamp(t_min / tf_min, 0.0, 1.0)
    return Tf + (T0 - Tf) * (1.0 - (u ** alpha))


def simulate_series(
    t: np.ndarray,
    T0=24.0,
    Tf=0.0,
    tf_min=480,
    alpha=0.08,
    osc_threshold=2.0,
    A=0.25,
    period_min=10.0,
    noise_sigma=0.05,
    offset=0.0,
    phase=0.0,
    seed=42,
    lo_margin=1.0,
    hi_margin=1.0
) -> np.ndarray:
    w = 2.0 * math.pi / period_min
    out = []

    for tt in t:
        T_base = base_curve(tt, T0=T0, Tf=Tf, tf_min=tf_min, alpha=alpha) + offset

        osc = 0.0
        if T_base <= osc_threshold:
            osc = A * math.sin(w * tt + phase)

        rng = random.Random(seed + int(tt * 100) + int(phase * 1000))
        noise = rng.gauss(0.0, noise_sigma)

        val = clamp(T_base + osc + noise, Tf - lo_margin, T0 + hi_margin)
        out.append(val)

    return np.array(out)


# -------------------------
# Estructuras de fallas
# -------------------------
@dataclass
class FaultEvent:
    sensor: str        # "pinchar_1"..."pinchar_8"
    fault_type: str    # "disconnect" "freeze" "out_of_range" "below_ambient"
    start_min: int
    end_min: int
    meta: Dict


def poisson_sample(lam: float, rng: random.Random) -> int:
    # Poisson simple (Knuth)
    L = math.exp(-lam)
    k = 0
    p = 1.0
    while p > L:
        k += 1
        p *= rng.random()
    return max(0, k - 1)


def inject_faults_pinchar(
    series: np.ndarray,
    ambient: np.ndarray,
    sensor_name: str,
    seed: int,
    tf_min: int,
    fault_rate_per_hour: float = 0.25,  # pocas fallas
    p_disconnect: float = 0.35,
    p_freeze: float = 0.35,
    p_out_of_range: float = 0.20,
    p_below_ambient: float = 0.10,
) -> Tuple[np.ndarray, List[FaultEvent]]:
    rng = random.Random(seed)
    y = series.copy()
    events: List[FaultEvent] = []

    hours = tf_min / 60.0
    n_events = poisson_sample(fault_rate_per_hour * hours, rng)

    def pick_type():
        r = rng.random()
        if r < p_disconnect:
            return "disconnect"
        r -= p_disconnect
        if r < p_freeze:
            return "freeze"
        r -= p_freeze
        if r < p_out_of_range:
            return "out_of_range"
        return "below_ambient"

    for _ in range(n_events):
        etype = pick_type()
        start = rng.randint(5, tf_min - 5)

        if etype == "disconnect":
            dur = rng.randint(2, 12)
            end = min(tf_min, start + dur)
            y[start:end] = 600.0
            events.append(FaultEvent(sensor_name, etype, start, end, {"value": 600}))

        elif etype == "freeze":
            dur = rng.randint(5, 25)
            end = min(tf_min, start + dur)
            frozen_val = float(y[start - 1] if start > 0 else y[start])
            y[start:end] = frozen_val
            events.append(FaultEvent(sensor_name, etype, start, end, {"value": frozen_val}))

        elif etype == "out_of_range":
            count = rng.randint(1, 4)
            idxs = [rng.randint(start, min(tf_min - 1, start + 15)) for _ in range(count)]
            vals = []
            for idx in idxs:
                v = rng.choice([-50.0, -20.0, 85.0, 120.0, 999.0])
                y[idx] = v
                vals.append((idx, v))
            events.append(FaultEvent(sensor_name, etype, min(idxs), max(idxs) + 1, {"points": vals}))

        elif etype == "below_ambient":
            dur = rng.randint(3, 10)
            end = min(tf_min, start + dur)
            for i in range(start, end):
                y[i] = ambient[i] - rng.uniform(0.3, 1.0)
            events.append(FaultEvent(sensor_name, etype, start, end, {"delta": "ambient - (0.3..1.0)"}))

    return y, events


# -------------------------
# Guardado
# -------------------------
def save_csv_and_events(df: pd.DataFrame, events: List[FaultEvent], csv_path: str, json_path: str):
    df.to_csv(csv_path, index=False)
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump([asdict(e) for e in events], f, ensure_ascii=False, indent=2)


# -------------------------
# Detector (ventana 20 min)
# -------------------------
def detect_faults_20min(
    df: pd.DataFrame,
    window_min: int = 20,
    disconnect_value: float = 600.0,
    out_low: float = -10.0,
    out_high: float = 60.0,
    below_amb_margin: float = 0.0,     # si pinchar < ambient - margin => falla
    freeze_eps: float = 0.02,          # std muy bajo => congelado
    freeze_min_points: int = 8         # mínimo puntos dentro de ventana para declarar freeze
) -> List[Dict]:
    """
    Devuelve lista de eventos detectados con rangos [start_min, end_min)
    basados en ventana deslizante.
    """
    t = df["minute"].to_numpy()
    ambient = df["ambient"].to_numpy()

    sensor_cols = [c for c in df.columns if c.startswith("pinchar_")]
    detected = []

    # Helper para compactar indices consecutivos en rangos
    def ranges_from_bool(mask: np.ndarray):
        idx = np.where(mask)[0]
        if len(idx) == 0:
            return []
        ranges = []
        s = idx[0]
        prev = idx[0]
        for k in idx[1:]:
            if k == prev + 1:
                prev = k
            else:
                ranges.append((s, prev + 1))
                s = k
                prev = k
        ranges.append((s, prev + 1))
        return ranges

    for col in sensor_cols:
        y = df[col].to_numpy()

        # 1) Disconnect: presencia de 600
        disc_mask = (y == disconnect_value)
        for a, b in ranges_from_bool(disc_mask):
            detected.append({
                "sensor": col,
                "fault_type": "disconnect",
                "start_min": int(t[a]),
                "end_min": int(t[b-1]) + 1,
                "meta.ensure": f"value=={disconnect_value}"
            })

        # 2) Out of range
        oor_mask = (y < out_low) | (y > out_high)
        for a, b in ranges_from_bool(oor_mask):
            detected.append({
                "sensor": col,
                "fault_type": "out_of_range",
                "start_min": int(t[a]),
                "end_min": int(t[b-1]) + 1,
                "meta.ensure": f"<{out_low} or >{out_high}"
            })

        # 3) Below ambient
        below_mask = (y < (ambient - below_amb_margin))
        for a, b in ranges_from_bool(below_mask):
            detected.append({
                "sensor": col,
                "fault_type": "below_ambient",
                "start_min": int(t[a]),
                "end_min": int(t[b-1]) + 1,
                "meta.ensure": f"y < ambient - {below_amb_margin}"
            })

        # 4) Freeze: std muy baja en ventana 20 min
        # Calculamos rolling std y marcamos ventana congelada
        ys = pd.Series(y)
        roll_std = ys.rolling(window=window_min, min_periods=freeze_min_points).std()
        freeze_win = (roll_std <= freeze_eps).to_numpy()

        # freeze_win[i] corresponde a ventana que termina en i
        # lo convertimos a máscara por minuto para rangos aproximados
        freeze_mask = np.zeros_like(freeze_win, dtype=bool)
        for i in range(len(freeze_win)):
            if freeze_win[i]:
                start = max(0, i - window_min + 1)
                freeze_mask[start:i+1] = True

        for a, b in ranges_from_bool(freeze_mask):
            detected.append({
                "sensor": col,
                "fault_type": "freeze",
                "start_min": int(t[a]),
                "end_min": int(t[b-1]) + 1,
                "meta.ensure": f"rolling_std({window_min}) <= {freeze_eps}"
            })

    # Ordena por tiempo
    detected.sort(key=lambda e: (e["start_min"], e["sensor"]))
    return detected


# -------------------------
# MAIN: Generar + guardar + detectar
# -------------------------
def main():
    # Config principal
    T0 = 24.0
    Tf = 0.0
    tf_min = 480
    alpha = 0.08
    t = np.arange(0, tf_min + 1, 1)

    # Aire (ambiente/retorno) un poco más frío
    ambient = simulate_series(
        t, T0=T0, Tf=Tf, tf_min=tf_min, alpha=alpha,
        osc_threshold=3.0, A=0.14, period_min=9.0, noise_sigma=0.03,
        offset=-0.35, phase=0.4, seed=100
    )
    retorno = simulate_series(
        t, T0=T0, Tf=Tf, tf_min=tf_min, alpha=alpha,
        osc_threshold=3.0, A=0.16, period_min=8.0, noise_sigma=0.03,
        offset=-0.20, phase=1.1, seed=200
    )

    # Pinchar (8) “limpios”
    n = 8
    target_ends = np.linspace(0.1, 0.5, n)
    margin_over_amb = 0.08
    pin_clean = []

    for i in range(n):
        A_i = 0.18 + 0.05 * (i / (n - 1))
        period_i = 7.0 + 2.5 * (i / (n - 1))
        sigma_i = 0.04 + 0.03 * (i / (n - 1))
        phase_i = 0.7 * i + 0.2
        offset_i = 0.15 + 0.10 * math.sin(i)

        raw = simulate_series(
            t, T0=T0, Tf=Tf, tf_min=tf_min, alpha=alpha,
            osc_threshold=2.2, A=A_i, period_min=period_i, noise_sigma=sigma_i,
            offset=offset_i, phase=phase_i, seed=1000 + i * 999
        )

        shift = target_ends[i] - raw[-1]
        p = raw + shift
        p = np.maximum(p, ambient + margin_over_amb)  # “normal”
        pin_clean.append(p)

    # Inyectar fallas y juntar eventos
    pin_faulty = []
    injected_events: List[FaultEvent] = []
    for i in range(n):
        name = f"pinchar_{i+1}"
        faulty, evs = inject_faults_pinchar(
            pin_clean[i], ambient, sensor_name=name,
            seed=9000 + i * 77, tf_min=tf_min,
            fault_rate_per_hour=0.25  # baja frecuencia
        )
        pin_faulty.append(faulty)
        injected_events.extend(evs)

    # Construir dataframe
    df = pd.DataFrame({
        "minute": t,
        "ambient": ambient,
        "retorno": retorno,
    })
    for i in range(n):
        df[f"pinchar_{i+1}"] = pin_faulty[i]

    # Guardar archivos
    save_csv_and_events(df, injected_events, "telemetria.csv", "fallas_inyectadas.json")

    # Detectar fallas con ventana 20 min
    detected = detect_faults_20min(
        df,
        window_min=20,
        disconnect_value=600.0,
        out_low=-10.0,
        out_high=60.0,
        below_amb_margin=0.0,
        freeze_eps=0.02,
        freeze_min_points=8
    )
    with open("fallas_detectadas.json", "w", encoding="utf-8") as f:
        json.dump(detected, f, ensure_ascii=False, indent=2)

    # Graficar (opcional)
    plt.figure(figsize=(11, 5))
    plt.plot(t, ambient, label="Ambiente", linewidth=2)
    plt.plot(t, retorno, label="Retorno", linewidth=2)
    for i in range(n):
        plt.plot(t, df[f"pinchar_{i+1}"], linewidth=1.0, alpha=0.9, label=f"Pinchar {i+1}")
    plt.title("Telemetría con fallas inyectadas (guardar + detectar)")
    plt.xlabel("Tiempo (min)")
    plt.ylabel("Temp (°C)")
    plt.grid(True)
    plt.legend(ncol=3, fontsize=8)
    plt.tight_layout()
    plt.show()

    print("✅ Guardado: telemetria.csv")
    print("✅ Ground truth: fallas_inyectadas.json")
    print("✅ Detectadas: fallas_detectadas.json")
    print(f"Eventos inyectados: {len(injected_events)} | Detectados: {len(detected)}")


if __name__ == "__main__":
    main()
