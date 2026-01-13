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

# Offsets específicos por fruta
offsets_fruta = {
    'mora': 0.5,
    'uva': -0.3,
    'mixtura': 0.1
}

# Directorio base
base_dir = 'datos_generados'
os.makedirs(base_dir, exist_ok=True)

# 50% túneles cortos (<= 60 min) y 50% largos (~ 7 h)
# (Puedes cambiar esta regla si quieres asignación aleatoria fija.)
tunnel_type = {t: ('corto' if int(t[1:]) <= 5 else 'largo') for t in tuneles}

# Rangos de duración (minutos)
DURACION_CORTO_NORMAL = (90, 180)     # dentro de la normal <= 1h
DURACION_LARGO_NORMAL = (390, 600)   # ~6.5h a 7.5h (aprox 7h)
# Duración “totalmente diferente” (anomalía: tipo opuesto)
DURACION_CORTO_ANOM = (180, 200)     # si era corto, anómalo largo (6h a 9h)
DURACION_LARGO_ANOM = (600, 630)       # si era largo, anómalo corto (0.5h a 1.5h)

# Para guardar metadatos globales
metadata_rows = []
proceso_id = 0

def generar_serie_temperatura(t, T0, setpoint, t_trans, overshoot_pct, rng):
    """
    Genera una respuesta tipo 2do orden en transitorio + oscilación pequeña en régimen.
    """
    n = len(t)
    T = np.zeros(n, dtype=float)

    # Parámetros del 2do orden (puedes ajustar)
    zeta = 0.4
    wn = 5 / max(t_trans, 1e-6)
    wd = wn * np.sqrt(max(1 - zeta**2, 1e-6))

    # Overshoot (definición simple)
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
            # Régimen: oscilación pequeña
            osc_amp = abs(T0 - setpoint) * 2 / 100
            freq = 2 * np.pi / 30  # periodo ~30 min
            T[i] = setpoint + osc_amp * np.sin(freq * ti)

    # Ruido
    T += rng.normal(0, 0.1, n)
    return T

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

            # 10 iteraciones: 9 normales + 1 anómala
            for iteracion in range(1, 11):
                proceso_id += 1
                rng = np.random.default_rng(123 + proceso_id)

                # Duración variable
                es_anomalia = (iteracion == 10)

                if tipo == 'corto':
                    if not es_anomalia:
                        duracion_min = rng.integers(DURACION_CORTO_NORMAL[0], DURACION_CORTO_NORMAL[1] + 1)
                    else:
                        duracion_min = rng.integers(DURACION_CORTO_ANOM[0], DURACION_CORTO_ANOM[1] + 1)
                else:  # largo
                    if not es_anomalia:
                        duracion_min = rng.integers(DURACION_LARGO_NORMAL[0], DURACION_LARGO_NORMAL[1] + 1)
                    else:
                        duracion_min = rng.integers(DURACION_LARGO_ANOM[0], DURACION_LARGO_ANOM[1] + 1)

                # Vector de tiempo (1 punto por minuto)
                t = np.arange(0, duracion_min)

                # Parámetros variables
                T0 = 24 + rng.uniform(-1, 1)
                setpoint = -0.1 + offsets_fruta[epoca] + rng.uniform(-0.05, 0.05)
                overshoot_pct = 10 + rng.uniform(-2, 2)

                # Transitorio proporcional a duración (pero nunca 0)
                t_trans = max(duracion_min * pct_transitorio / 100, 5)

                # Generación de datos
                T = generar_serie_temperatura(t, T0, setpoint, t_trans, overshoot_pct, rng)

                # Guardar CSV individual (incluyendo setpoint y metadatos)
                df = pd.DataFrame({
                    'proceso_id': proceso_id,
                    'epoca': epoca,
                    'packing': packing,
                    'tunel': tunel,
                    'tipo_tunel': tipo,
                    'iteracion': iteracion,
                    'anomalia_duracion': es_anomalia,
                    'duracion_min': duracion_min,
                    'setpoint': setpoint,
                    'T0': T0,
                    'tiempo_min': t,
                    'temperatura': T
                })

                csv_path = os.path.join(csv_dir, f'{tunel}_iter{iteracion}_dur{duracion_min}min.csv')
                df.to_csv(csv_path, index=False)

                # Guardar metadatos resumidos (una fila por proceso)
                metadata_rows.append({
                    'proceso_id': proceso_id,
                    'epoca': epoca,
                    'packing': packing,
                    'tunel': tunel,
                    'tipo_tunel': tipo,
                    'iteracion': iteracion,
                    'anomalia_duracion': es_anomalia,
                    'duracion_min': duracion_min,
                    'setpoint': setpoint,
                    'T0': T0,
                    'pct_transitorio': pct_transitorio,
                    't_trans_min': t_trans,
                    'overshoot_pct': overshoot_pct
                })

                # Gráfica
                plt.figure(figsize=(10, 5))
                plt.scatter(t, T, s=5, alpha=0.6)
                plt.xlabel('Tiempo (min)')
                plt.ylabel('Temperatura (°C)')
                plt.title(f'{epoca.capitalize()} - {packing} - {tunel} ({tipo}) - Iter {iteracion} - {duracion_min} min')
                plt.grid(True, alpha=0.3)
                plt.axhline(y=setpoint, color='r', linestyle='--', alpha=0.5)
                plt.tight_layout()
                png_path = os.path.join(img_dir, f'{tunel}_iter{iteracion}_dur{duracion_min}min.png')
                plt.savefig(png_path, dpi=150)
                plt.close()

    print(f"✅ Época '{epoca}' completada")

# Guardar un metadata global para filtrar rápido sin abrir todos los CSVs
meta_df = pd.DataFrame(metadata_rows)
meta_path = os.path.join(base_dir, 'procesos_metadata.csv')
meta_df.to_csv(meta_path, index=False)

print(f"\n✅ Total: {proceso_id} procesos generados")
print(f"✅ Metadata global: {meta_path}")
