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
ITERACIONES_POR_TUNEL = 40      # <-- sube esto (ej. 80, 120)
ANOMALIA_CADA_N = 10           # cada 10 procesos, 1 anómalo (9 normales + 1 anómalo)

# Guardar imágenes (si son muchos procesos, pesa bastante)
GUARDAR_IMAGENES = True
GUARDAR_CADA = 1               # 1 = todas, 5 = 1 de cada 5, etc.

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
# PATRÓN DE MASA (TONELADAS)
# -----------------------------
# "Grupitos" = clusters de masa en toneladas.
# Ajusta a tu caso real:
MASS_CLUSTERS = [
    {"name": "G1", "mean_ton": 2.5, "std_ton": 0.15},   # ~2.5 t
    {"name": "G2", "mean_ton": 4.0, "std_ton": 0.20},   # ~4.0 t
    {"name": "G3", "mean_ton": 6.0, "std_ton": 0.30},   # ~6.0 t
    {"name": "G4", "mean_ton": 8.5, "std_ton": 0.35},   # ~8.5 t
]

# Patrón repetible: secuencia por iteración (puedes cambiarla)
# Esto hace que haya "bloques" claros para análisis.
MASS_PATTERN = ["G1","G1","G1","G2","G2","G3","G3","G4","G4","G2"]

# -----------------------------
# Utilidades
# -----------------------------
def pick_mass_cluster(iteracion, rng):
    """
    Selecciona el cluster de masa siguiendo un patrón repetible.
    Puedes meter un poquito de aleatoriedad si quieres.
    """
    name = MASS_PATTERN[(iteracion - 1) % len(MASS_PATTERN)]
    cluster = next(c for c in MASS_CLUSTERS if c["name"] == name)
    masa_ton = float(rng.normal(cluster["mean_ton"], cluster["std_ton"]))
    masa_ton = max(masa_ton, 0.3)  # mínimo para evitar negativos/0
    return name, masa_ton

def duracion_esperada_por_masa_ton(masa_ton, tipo, ocupabilidad, caudal_factor):
    """
    Duración esperada (min) en función de masa (toneladas) + factores.
    Ajusta parámetros para que encaje con tus rangos reales.
    """
    # Convertimos a kg para tener escala más familiar si quieres:
    masa_kg = masa_ton * 1000.0

    if tipo == 'corto':
        # base + a*(kg^b)
        base = 35
        a = 0.020
        b = 0.90
        f_occ = 0.85 + 0.45 * ocupabilidad          # 0.85..1.28
        f_caudal = 1.12 - 0.30 * (caudal_factor - 0.8) / 0.4  # ~1.12..0.82
        dur = (base + a * (masa_kg ** b)) * f_occ * f_caudal
        dur = np.clip(dur, 30, 240)                 # cortos: 0.5h..4h
    else:
        base = 180
        a = 0.040
        b = 0.92
        f_occ = 0.90 + 0.40 * ocupabilidad          # 0.90..1.26
        f_caudal = 1.18 - 0.33 * (caudal_factor - 0.8) / 0.4  # ~1.18..0.85
        dur = (base + a * (masa_kg ** b)) * f_occ * f_caudal
        dur = np.clip(dur, 240, 720)                # largos: 4h..12h

    return float(dur)

def sample_duracion_con_variacion(rng, duracion_esperada, es_anomalia, tipo):
    """
    Normal: variación moderada alrededor de lo esperado.
    Anomalía: duración incoherente para la masa.
    """
    if not es_anomalia:
        factor = float(rng.lognormal(mean=0.0, sigma=0.08))  # ~±10-15% típico
        dur = duracion_esperada * factor
    else:
        # muy corto o muy largo para esa masa
        if rng.random() < 0.5:
            factor = float(rng.uniform(0.45, 0.70))  # demasiado corto
        else:
            factor = float(rng.uniform(1.40, 2.10))  # demasiado largo
        dur = duracion_esperada * factor

    # límites razonables por tipo
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

            tipo = tunnel_type[tunel]

            for iteracion in range(1, ITERACIONES_POR_TUNEL + 1):
                proceso_id += 1
                rng = np.random.default_rng(123 + proceso_id)

                # 9 normales + 1 anómala (cada ANOMALIA_CADA_N)
                es_anomalia = (iteracion % ANOMALIA_CADA_N == 0)

                # Masa por patrón (toneladas)
                mass_group, masa_ton = pick_mass_cluster(iteracion, rng)

                # Variables latentes (explican variación con misma masa)
                ocupabilidad = float(rng.uniform(0.4, 0.95))
                caudal_factor = float(rng.uniform(0.8, 1.2))

                # Duración esperada + variación
                dur_esp = duracion_esperada_por_masa_ton(masa_ton, tipo, ocupabilidad, caudal_factor)
                duracion_min = sample_duracion_con_variacion(rng, dur_esp, es_anomalia, tipo)

                # Tiempo
                t = np.arange(0, duracion_min)

                # Parámetros térmicos
                T0 = 24 + rng.uniform(-1, 1)
                setpoint = -0.1 + offsets_fruta[epoca] + rng.uniform(-0.05, 0.05)
                overshoot_pct = 10 + rng.uniform(-2, 2)
                t_trans = max(duracion_min * pct_transitorio / 100, 5)

                # Serie
                T = generar_serie_temperatura(t, T0, setpoint, t_trans, overshoot_pct, rng)

                # DataFrame (incluye extras)
                df = pd.DataFrame({
                    'proceso_id': proceso_id,
                    'epoca': epoca,
                    'packing': packing,
                    'tunel': tunel,
                    'tipo_tunel': tipo,
                    'iteracion': iteracion,

                    'mass_group': mass_group,
                    'masa_ton': masa_ton,

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
                    'overshoot_pct': overshoot_pct,

                    'tiempo_min': t,
                    'temperatura': T
                })

                csv_path = os.path.join(csv_dir, f'{tunel}_iter{iteracion}_dur{duracion_min}min.csv')
                df.to_csv(csv_path, index=False)

                metadata_rows.append({
                    'proceso_id': proceso_id,
                    'epoca': epoca,
                    'packing': packing,
                    'tunel': tunel,
                    'tipo_tunel': tipo,
                    'iteracion': iteracion,

                    'mass_group': mass_group,
                    'masa_ton': masa_ton,

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
                    plt.title(f'{epoca.capitalize()} - {packing} - {tunel} ({tipo}) - Iter {iteracion} - {duracion_min} min - {masa_ton:.2f} t ({mass_group})')
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
