import numpy as np
import matplotlib.pyplot as plt
import pandas as pd
import os

# Configuración
epocas = ['mora', 'uva', 'mixtura']
packings = ['packing_A', 'packing_B', 'packing_C']
tuneles = [f'T{str(i).zfill(2)}' for i in range(1, 11)]  # T01 a T10
n = 480  # Un punto por minuto
duracion_proceso_min = 480
pct_transitorio = 60

# Offsets específicos por fruta
offsets_fruta = {
    'mora': 0.5,
    'uva': -0.3,
    'mixtura': 0.1
}

proceso_id = 0
base_dir = 'datos_generados'
os.makedirs(base_dir, exist_ok=True)

for epoca in epocas:
    # Crear directorio por época
    epoca_dir = os.path.join(base_dir, epoca)
    os.makedirs(epoca_dir, exist_ok=True)
    
    for packing in packings:
        # Crear directorio por packing dentro de época
        packing_dir = os.path.join(epoca_dir, packing)
        os.makedirs(packing_dir, exist_ok=True)
        
        for tunel in tuneles:
            # Crear directorio por túnel
            tunel_dir = os.path.join(packing_dir, tunel)
            csv_dir = os.path.join(tunel_dir, 'csv')
            img_dir = os.path.join(tunel_dir, 'imagenes')
            os.makedirs(csv_dir, exist_ok=True)
            os.makedirs(img_dir, exist_ok=True)
            
            for iteracion in range(1, 11):  # 10 iteraciones
                proceso_id += 1
                np.random.seed(123 + proceso_id)
                t = np.arange(0, n)  # 0 a 479 minutos
                
                # Parámetros variables
                T0 = 24 + np.random.uniform(-1, 1)
                setpoint = -0.1 + offsets_fruta[epoca] + np.random.uniform(-0.05, 0.05)
                overshoot_pct = 10 + np.random.uniform(-2, 2)
                
                t_trans = duracion_proceso_min * pct_transitorio / 100
                overshoot = setpoint - abs(T0 - setpoint) * overshoot_pct / 100
                
                zeta = 0.4
                wn = 5 / t_trans
                wd = wn * np.sqrt(1 - zeta**2)
                
                T = np.zeros(n)
                for i, ti in enumerate(t):
                    if ti <= t_trans:
                        exp_decay = np.exp(-zeta * wn * ti)
                        osc = np.cos(wd * ti)
                        T[i] = setpoint + (T0 - setpoint) * exp_decay * osc + (overshoot - setpoint) * exp_decay * np.sin(wd * ti)
                    else:
                        osc_amp = abs(T0 - setpoint) * 2 / 100
                        freq = 2 * np.pi / 30
                        T[i] = setpoint + osc_amp * np.sin(freq * ti)
                
                T += np.random.normal(0, 0.1, n)
                
                # Guardar CSV individual
                df = pd.DataFrame({
                    'tiempo_min': t,
                    'temperatura': T
                })
                csv_path = os.path.join(csv_dir, f'{tunel}_iter{iteracion}.csv')
                df.to_csv(csv_path, index=False)
                
                # Gráfica
                plt.figure(figsize=(10, 5))
                plt.scatter(t, T, s=5, alpha=0.6)
                plt.xlabel('Tiempo (min)')
                plt.ylabel('Temperatura (°C)')
                plt.title(f'{epoca.capitalize()} - {packing} - {tunel} - Iteración {iteracion}')
                plt.grid(True, alpha=0.3)
                plt.axhline(y=setpoint, color='r', linestyle='--', alpha=0.5)
                plt.tight_layout()
                png_path = os.path.join(img_dir, f'{tunel}_iter{iteracion}.png')
                plt.savefig(png_path, dpi=150)
                plt.close()
    
    print(f"✅ Época '{epoca}' completada")

print(f"\n✅ Total: {proceso_id} procesos generados (3 épocas × 3 packings × 10 túneles × {n} puntos)")
