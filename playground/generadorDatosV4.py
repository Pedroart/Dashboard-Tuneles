import numpy as np
import matplotlib.pyplot as plt
import pandas as pd
import os

# -----------------------------
# Configuración general
# -----------------------------
epocas = ['mora', 'uva', 'mixtura']
packings = ['packing_A', 'packing_B', 'packing_C']
tuneles = [f'T{str(i).zfill(2)}' for i in range(1, 11)]  # T01 a T10

pct_transitorio = 60  # % de la duración total

# Más procesos:
ITERACIONES_POR_TUNEL = 40
ANOMALIA_CADA_N = 10  # cada 10 procesos, 1 anómalo (9 normales + 1 anómalo)

# Guardar imágenes (si son muchos procesos, pesa bastante)
GUARDAR_IMAGENES = True
GUARDAR_CADA = 1

# Offsets específicos por fruta
offsets_fruta = {
    'mora': 0.5,
    'uva': -0.3,
    'mixtura': 0.1
}

# Directorio base
base_dir = 'datos_generados'
os.makedirs(base_dir, exist_ok=True)

# 50% túneles cortos y 50% largos
tunnel_type = {t: ('corto' if int(t[1:]) <= 5 else 'largo') for t in tuneles}

# -----------------------------
# CAJAS: patrón por "grupitos"
# -----------------------------
# En vez de masa total directa, generamos (tipo_caja, masa_caja_kg, num_cajas)
# y de ahí calculamos masa_total.
BOX_TYPES = [
    {"tipo": "clamshell_250g", "masa_caja_kg": 0.25},
    {"tipo": "clamshell_500g", "masa_caja_kg": 0.50},
    {"tipo": "caja_1kg",       "masa_caja_kg": 1.00},
    {"tipo": "caja_2kg",       "masa_caja_kg": 2.00},
    {"tipo": "caja_5kg",       "masa_caja_kg": 5.00},
]

# Patrón repetible de "tipo de caja" para que haya bloques claros en análisis
BOX_PATTERN = ["caja_2kg","caja_2kg","caja_5kg","caja_1kg","caja_1kg",
               "clamshell_500g","caja_5kg","caja_2kg","caja_5kg","caja_1kg"]

def pick_box(iteracion, rng):
    """
    Escoge tipo_caja por patrón repetible.
    """
    tipo = BOX_PATTERN[(iteracion - 1) % len(BOX_PATTERN)]
    box = next(b for b in BOX_TYPES if b["tipo"] == tipo)
    return box["tipo"], float(box["masa_caja_kg"])

def sample_num_cajas(rng, tipo_tunel, tipo_caja):
    """
    Cantidad de cajas depende del tipo de túnel y del tipo de caja.
    Ajusta rangos si quieres.
    """
    # cajas más pequeñas suelen venir en mayor cantidad
    if "clamshell" in tipo_caja:
        if tipo_tunel == "corto":
            return int(rng.integers(800, 2500))
        else:
            return int(rng.integers(2500, 8000))
    else:
        if tipo_tunel == "corto":
            return int(rng.integers(200, 1200))
        else:
            return int(rng.integers(800, 3500))

# -----------------------------
# PALETS: calcular ocupabilidad
# -----------------------------
def sample_palets(rng, tunel):
    """
    Define capacidad y palets usados.
    Puedes hacerlo por túnel fijo, o por tipo.
    Aquí lo hacemos semi-realista por número de túnel.
    """
    # capacidad máxima por túnel (ejemplo)
    # T01..T10 => capacidad base distinta
    idx = int(tunel[1:])
    palets_max = 10 + (idx % 6) * 2  # 10,12,14,16,18,20...
    palets_max = int(palets_max)

    # usados: entre 40% y 95% de capacidad
    palets_usados = int(rng.integers(max(1, int(palets_max * 0.4)), int(palets_max * 0.95) + 1))
    ocupabilidad = float(palets_usados / palets_max)

    return palets_max, palets_usados, ocupabilidad

# -----------------------------
# Modelo duración (usa masa_total_ton)
# -----------------------------
def duracion_esperada_por_masa_ton(masa_ton, tipo, ocupabilidad, caudal_factor):
    masa_kg = masa_ton * 1000.0

    if tipo == 'corto':
        base = 35
        a = 0.020
        b = 0.90
        f_occ = 0.85 + 0.45 * ocupabilidad
        f_caudal = 1.12 - 0.30 * (caudal_factor - 0.8) / 0.4
        dur = (base + a * (masa_kg ** b)) * f_occ * f_caudal
        dur = np.clip(dur, 30, 240)
    else:
        base = 180
        a = 0.040
        b = 0.92
        f_occ = 0.90 + 0.40 * ocupabilidad
        f_caudal = 1.18 - 0.33 * (caudal_factor - 0.8) / 0.4
        dur = (base + a * (masa_kg ** b)) * f_occ * f_caudal
        dur = np.clip(dur, 240, 720)

    return float(dur)

def sample_duracion_con_variacion(rng, duracion_esperada, es_anomalia, tipo):
    if not es_anomalia:
        factor = float(rng.lognormal(mean=0.0, sigma=0.08))
        dur = duracion_esperada * factor
    else:
        if rng.random() < 0.5:
            factor = float(rng.uniform(0.45, 0.70))
        else:
            factor = float(rng.uniform(1.40, 2.10))
        dur = duracion_esperada * factor

    if tipo == 'corto':
        dur = np.clip(dur, 20, 300)
    else:
        dur = np.clip(dur, 180, 900)

    return int(round(dur))

def generar_serie_temperatura(t, T0, setpoint, t_trans, overshoot_pct, rng):
    n = len(t)
    T = np.zeros(n, dtype=float)

    zeta = 0.4
    wn = 5 / max(t_trans, 1e-6)
    wd = wn * np.sqrt(max(1 - zeta**2, 1e-6))

    overshoot = setpoint - abs(T0 - setpoint) * (overshoot_pct / 100)

    for i, ti in enumerate(t):
        if ti <= t_trans:
            exp_decay = np.exp(-zeta * wn * ti)
            osc = np.cos(wd * ti)
            T[i] = (
                setpoint
                + (T0 - setpoint) * exp_decay * osc
                + (overshoot - setpoint) * exp_decay * np.sin(wd * ti)
            )
        else:
            osc_amp = abs(T0 - setpoint) * 2 / 100
            freq = 2 * np.pi / 30
            T[i] = setpoint + osc_amp * np.sin(freq * ti)

    T += rng.normal(0, 0.1, n)
    return T

# -----------------------------
# Generación
# -----------------------------
metadata_rows = []
proceso_id = 0

for epoca in epocas:
    epoca_dir = os.path.join(base_dir, epoca)
    os.makedirs(epoca_dir, exist_ok=True)

    for packing in packings:
        packing_dir = os.path.join(epoca_dir, packing)
        os.makedirs(packing_dir, exist_ok=True)

        for tunel in tuneles:
            tunel_dir = os.path.join(packing_dir, tunel)
            csv_dir = os.path.join(tunel_dir, 'csv')
            img_dir = os.path.join(tunel_dir, 'imagenes')
            os.makedirs(csv_dir, exist_ok=True)
            os.makedirs(img_dir, exist_ok=True)

            tipo_tunel = tunnel_type[tunel]

            for iteracion in range(1, ITERACIONES_POR_TUNEL + 1):
                proceso_id += 1
                rng = np.random.default_rng(123 + proceso_id)

                es_anomalia = (iteracion % ANOMALIA_CADA_N == 0)

                # 1) Caja: tipo, masa caja, num cajas
                tipo_caja, masa_caja_kg = pick_box(iteracion, rng)
                num_cajas = sample_num_cajas(rng, tipo_tunel, tipo_caja)

                # 2) Masa total (derivada)
                masa_total_kg = float(num_cajas * masa_caja_kg)
                masa_total_ton = float(masa_total_kg / 1000.0)

                # 3) Palets: capacidad, usados, ocupabilidad derivada
                palets_max, palets_usados, ocupabilidad = sample_palets(rng, tunel)

                # 4) Caudal/otros factores
                caudal_factor = float(rng.uniform(0.8, 1.2))

                # 5) Duración (en función de masa_total_ton + ocupabilidad + caudal)
                dur_esp = duracion_esperada_por_masa_ton(masa_total_ton, tipo_tunel, ocupabilidad, caudal_factor)
                duracion_min = sample_duracion_con_variacion(rng, dur_esp, es_anomalia, tipo_tunel)

                # Tiempo
                t = np.arange(0, duracion_min)

                # Parámetros térmicos
                T0 = 24 + rng.uniform(-1, 1)
                setpoint = -0.1 + offsets_fruta[epoca] + rng.uniform(-0.05, 0.05)
                overshoot_pct = 10 + rng.uniform(-2, 2)
                t_trans = max(duracion_min * pct_transitorio / 100, 5)

                # Serie
                T = generar_serie_temperatura(t, T0, setpoint, t_trans, overshoot_pct, rng)

                # DataFrame (incluye extras + derivados)
                df = pd.DataFrame({
                    'proceso_id': proceso_id,
                    'epoca': epoca,
                    'packing': packing,
                    'tunel': tunel,
                    'tipo_tunel': tipo_tunel,
                    'iteracion': iteracion,

                    # cajas / masa
                    'tipo_caja': tipo_caja,
                    'masa_caja_kg': masa_caja_kg,
                    'num_cajas': num_cajas,
                    'masa_total_kg': masa_total_kg,
                    'masa_total_ton': masa_total_ton,

                    # palets / ocupabilidad
                    'palets_max': palets_max,
                    'palets_usados': palets_usados,
                    'ocupabilidad': ocupabilidad,

                    # factores + duración
                    'caudal_factor': caudal_factor,
                    'anomalia_duracion': es_anomalia,
                    'duracion_min': duracion_min,
                    'duracion_esperada_min': dur_esp,
                    'delta_duracion_pct': (duracion_min - dur_esp) / max(dur_esp, 1e-6) * 100,

                    # térmico
                    'setpoint': setpoint,
                    'T0': T0,
                    'pct_transitorio': pct_transitorio,
                    't_trans_min': t_trans,
                    'overshoot_pct': overshoot_pct,

                    # serie
                    'tiempo_min': t,
                    'temperatura': T
                })

                csv_path = os.path.join(csv_dir, f'{tunel}_iter{iteracion}_dur{duracion_min}min.csv')
                df.to_csv(csv_path, index=False)

                # metadata (1 fila por proceso)
                metadata_rows.append({
                    'proceso_id': proceso_id,
                    'epoca': epoca,
                    'packing': packing,
                    'tunel': tunel,
                    'tipo_tunel': tipo_tunel,
                    'iteracion': iteracion,

                    'tipo_caja': tipo_caja,
                    'masa_caja_kg': masa_caja_kg,
                    'num_cajas': num_cajas,
                    'masa_total_kg': masa_total_kg,
                    'masa_total_ton': masa_total_ton,

                    'palets_max': palets_max,
                    'palets_usados': palets_usados,
                    'ocupabilidad': ocupabilidad,

                    'caudal_factor': caudal_factor,
                    'anomalia_duracion': es_anomalia,
                    'duracion_min': duracion_min,
                    'duracion_esperada_min': dur_esp,
                    'delta_duracion_pct': (duracion_min - dur_esp) / max(dur_esp, 1e-6) * 100,

                    'setpoint': setpoint,
                    'T0': T0,
                    'pct_transitorio': pct_transitorio,
                    't_trans_min': t_trans,
                    'overshoot_pct': overshoot_pct
                })

                # Imagen (si aplica)
                if GUARDAR_IMAGENES and (iteracion % GUARDAR_CADA == 0):
                    plt.figure(figsize=(10, 5))
                    plt.scatter(t, T, s=5, alpha=0.6)
                    plt.xlabel('Tiempo (min)')
                    plt.ylabel('Temperatura (°C)')
                    plt.title(
                        f'{epoca.capitalize()} - {packing} - {tunel} ({tipo_tunel}) '
                        f'- Iter {iteracion} - {duracion_min} min - '
                        f'{tipo_caja} x{num_cajas} ({masa_total_ton:.2f} t)'
                    )
                    plt.grid(True, alpha=0.3)
                    plt.axhline(y=setpoint, color='r', linestyle='--', alpha=0.5)
                    plt.tight_layout()
                    png_path = os.path.join(img_dir, f'{tunel}_iter{iteracion}_dur{duracion_min}min.png')
                    plt.savefig(png_path, dpi=120)
                    plt.close()

    print(f"✅ Época '{epoca}' completada")

# Metadata global
meta_df = pd.DataFrame(metadata_rows)
meta_path = os.path.join(base_dir, 'procesos_metadata.csv')
meta_df.to_csv(meta_path, index=False)

print(f"\n✅ Total: {proceso_id} procesos generados")
print(f"✅ Metadata global: {meta_path}")
