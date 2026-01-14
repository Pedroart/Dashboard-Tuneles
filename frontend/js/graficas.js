/************************************
 * 1) CONFIG BASE (MISMO ESTILO)
 ************************************/
const UI = {
  axisText: "rgba(255,255,255,0.75)",
  grid: "rgba(255,255,255,0.08)",
  legendText: "rgba(255,255,255,0.80)",
};

function baseOptions({
  xTitle = "",
  yTitle = "",
  stacked = false,
  yMin = null,
  yMax = null,
  ySuffix = "",
} = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: {
        display: true,
        position: "top",
        labels: { color: UI.legendText },
      },
      tooltip: {
        enabled: true,
        callbacks: {
          label: (c) => {
            const v = c.raw;
            // si es número, formatea con 0 decimales por defecto
            const vv = typeof v === "number" ? v : Number(v);
            return `${c.dataset.label}: ${
              Number.isFinite(vv) ? vv.toFixed(0) : v
            }${ySuffix}`;
          },
        },
      },
    },
    scales: {
      x: {
        stacked,
        title: { display: !!xTitle, text: xTitle, color: UI.axisText },
        ticks: { color: UI.axisText, maxRotation: 45, minRotation: 45 },
        grid: { color: UI.grid },
      },
      y: {
        stacked,
        title: { display: !!yTitle, text: yTitle, color: UI.axisText },
        ticks: {
          color: UI.axisText,
          callback: (v) => (ySuffix ? `${v}${ySuffix}` : v),
        },
        grid: { color: UI.grid },
        ...(yMin !== null ? { min: yMin } : {}),
        ...(yMax !== null ? { max: yMax } : {}),
      },
    },
  };
}

/************************************
 * 2) DATA DUMMY (TUNELES + CAJAS)
 ************************************/
const tuneles = [
  "T01",
  "T02",
  "T03",
  "T04",
  "T05",
  "T06",
  "T07",
  "T08",
  "T09",
  "T10",
];
const tipoTunel = (t) =>
  ["T01", "T02", "T03", "T04", "T05"].includes(t) ? "MP" : "PT";

const cajas = ["caja_1kg", "caja_2kg", "caja_5kg", "clamshell_500g"];
const coloresCaja = {
  caja_1kg: "rgba(255, 99, 132, 0.7)",
  caja_2kg: "rgba(54, 162, 235, 0.7)",
  caja_5kg: "rgba(255, 206, 86, 0.7)",
  clamshell_500g: "rgba(75, 192, 192, 0.7)",
};

function randInt(min, max) {
  // inclusive
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randFloat(min, max) {
  return Math.random() * (max - min) + min;
}

/************************************
 * 3) CHART 1: OCUPABILIDAD - LIQUID GAUGE
 ************************************/
let liquidGaugeData = {};

function initLiquidGaugeData() {
  tuneles.forEach(t => {
    const ocupabilidad = tipoTunel(t) === "MP" ? randInt(65, 90) : randInt(55, 85);
    const capacidad = randInt(45, 60);
    liquidGaugeData[t] = {
      ocupabilidad,
      capacidad,
      palets: Math.round((ocupabilidad * capacidad) / 100),
      tipo: tipoTunel(t)
    };
  });
}

function getGaugeColor(percent) {
  if (percent >= 85) return { liquid: '#4ade80', glow: 'rgba(74, 222, 128, 0.4)' }; // Verde - Lleno
  if (percent >= 75) return { liquid: '#fbbf24', glow: 'rgba(251, 191, 36, 0.4)' }; // Ámbar - Medio
  return { liquid: '#ef4444', glow: 'rgba(239, 68, 68, 0.4)' }; // Rojo - Vacío
}

function renderLiquidGauge(tunelId) {
  const container = document.getElementById('gaugeDisplay');
  if (!container) return;
  
  const data = liquidGaugeData[tunelId];
  if (!data) return;
  
  const colors = getGaugeColor(data.ocupabilidad);
  const objetivo = 85;
  const diferencia = (data.ocupabilidad - objetivo).toFixed(1);
  const signo = diferencia > 0 ? '+' : '';
  
  container.innerHTML = `
    <div class="liquid-tank">
      <div class="tank-container">
        <div class="tank-bg"></div>
        <div class="liquid-fill" style="height: ${data.ocupabilidad}%; background: linear-gradient(180deg, ${colors.liquid} 0%, ${colors.liquid}dd 100%); box-shadow: 0 0 30px ${colors.glow}, inset 0 0 20px rgba(255,255,255,0.1);">
          <div class="wave"></div>
        </div>
        <div class="tank-overlay">
          <div class="tank-value">${data.ocupabilidad}<span class="tank-unit">%</span></div>
        </div>
      </div>
      <div class="tank-label">${tunelId}</div>
    </div>
    
    <div class="gauge-stats">
      <div class="stat-card">
        <div class="stat-label">Tipo</div>
        <div class="stat-value">${data.tipo === 'MP' ? 'Materia Prima' : 'Producto Terminado'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Palets</div>
        <div class="stat-value">${data.palets} / ${data.capacidad}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">vs Objetivo</div>
        <div class="stat-value" style="color: ${diferencia > 0 ? '#4ade80' : '#ef4444'}">${signo}${diferencia}%</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Estado</div>
        <div class="stat-value">${data.ocupabilidad >= 85 ? '✓ Óptimo' : data.ocupabilidad >= 75 ? '⚠ Medio' : '⛔ Bajo'}</div>
      </div>
    </div>
  `;
}

function setupLiquidGauge() {
  initLiquidGaugeData();
  
  const selector = document.getElementById('tunelSelector');
  if (!selector) return;
  
  selector.addEventListener('change', (e) => {
    renderLiquidGauge(e.target.value);
  });
  
  // Render inicial
  renderLiquidGauge('T01');
}

/************************************
 * 4) CHART 2: FALLAS APILADAS (Dummy)
 *    - Fuera de rango + Desconectado
 ************************************/
let chartFallas = null;

function renderFallasDummy() {
  const el = document.getElementById("chartFallasTunel");
  if (!el) return;
  if (chartFallas) chartFallas.destroy();

  // Dummy: MP suele tener algo más de fallas
  const fueraRango = tuneles.map((t) =>
    tipoTunel(t) === "MP" ? randInt(0, 5) : randInt(0, 3)
  );
  const desconectado = tuneles.map((t) =>
    tipoTunel(t) === "MP" ? randInt(0, 3) : randInt(0, 2)
  );

  chartFallas = new Chart(el, {
    type: "bar",
    data: {
      labels: tuneles,
      datasets: [
        {
          label: "Sensor fuera de rango",
          data: fueraRango,
          backgroundColor: "rgba(244, 67, 54, 0.75)",
          borderRadius: 4,
          barThickness: 16,
        },
        {
          label: "Sensor desconectado",
          data: desconectado,
          backgroundColor: "rgba(255, 152, 0, 0.75)",
          borderRadius: 4,
          barThickness: 16,
        },
      ],
    },
    options: baseOptions({
      xTitle: "Túnel",
      yTitle: "N° de fallas",
      stacked: true,
      yMin: 0,
      ySuffix: "",
    }),
  });
}

/************************************
 * 5) CHART 3: TIEMPO PROMEDIO POR TÚNEL Y TIPO DE CAJA (Dummy)
 *    - Igual estilo que tu referencia
 ************************************/
let chartTiempoTunel = null;

function renderTiempoTunelDummy() {
  const el = document.getElementById("chartTiempoTunel");
  if (!el) return;
  if (chartTiempoTunel) chartTiempoTunel.destroy();

  // Dummy: tiempos promedio por túnel y caja
  // MP tiende a más minutos que PT
  const datasets = cajas.map((caja) => {
    const data = tuneles.map((t) => {
      const base =
        tipoTunel(t) === "MP" ? randInt(230, 340) : randInt(180, 300);
      // variación por tipo de caja
      const factor =
        caja === "caja_1kg"
          ? randFloat(0.95, 1.05)
          : caja === "caja_2kg"
          ? randFloat(0.98, 1.08)
          : caja === "caja_5kg"
          ? randFloat(1.02, 1.15)
          : randFloat(0.9, 1.05); // clamshell
      return Math.round(base * factor);
    });

    return {
      label: caja,
      data,
      backgroundColor: coloresCaja[caja] || "rgba(128,128,128,0.7)",
    };
  });

  chartTiempoTunel = new Chart(el, {
    type: "bar",
    data: { labels: tuneles, datasets },
    options: {
      ...baseOptions({
        xTitle: "Túnel",
        yTitle: "Tiempo promedio (min)",
        stacked: false,
        yMin: 0,
        ySuffix: " min",
      }),
      plugins: {
        ...baseOptions().plugins,
        tooltip: {
          enabled: true,
          callbacks: {
            label: (c) => `${c.dataset.label}: ${Number(c.raw).toFixed(0)} min`,
          },
        },
      },
    },
  });
}

/* Grafica de Numero de Pales por dia - BASTONES DE VARIACION */

let chartPaletsDia = null;

function renderPaletsPorDiaDummy() {
  const el = document.getElementById("chartPaletsDia");
  if (!el) return;
  if (chartPaletsDia) chartPaletsDia.destroy();

  // Dummy: últimos 14 días
  const days = 14;
  const labels = [];
  const palets = [];
  const barData = [];

  const today = new Date();
  
  // Generar datos de palets por día
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const label = d.toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "short",
    });
    labels.push(label);
    palets.push(randInt(30, 80));
  }

  // Calcular promedio
  const promedio = palets.reduce((a, b) => a + b, 0) / palets.length;

  // Crear datos para los bastones (desde valor anterior hasta valor actual)
  for (let i = 0; i < palets.length; i++) {
    const valorActual = palets[i];
    const valorAnterior = i === 0 ? promedio : palets[i - 1];
    const isPositive = valorActual >= valorAnterior;
    
    barData.push({
      x: i,
      y: [valorAnterior, valorActual],
      actual: valorActual,
      anterior: valorAnterior,
      variacion: valorActual - valorAnterior,
      variacionPct: ((valorActual - valorAnterior) / valorAnterior * 100),
      isPositive,
    });
  }

  // Calcular min/max para el eje Y
  const allValues = palets;
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const padding = Math.max(5, Math.round((maxValue - minValue) * 0.15));
  const yMin = Math.max(0, minValue - padding);
  const yMax = maxValue + padding;

  // Plugin para dibujar bastones y línea con gradiente
  const barStickPlugin = {
    id: 'barStick',
    afterDatasetsDraw(chart) {
      const { ctx, scales } = chart;
      const xScale = scales.x;
      const yScale = scales.y;
      const activeElements = chart.getActiveElements();
      const hoveredIndex = activeElements.length > 0 ? activeElements[0].index : -1;

      ctx.save();

      // Primero dibujar los bastones
      barData.forEach((bar, i) => {
        const x = xScale.getPixelForValue(i);
        const yStart = yScale.getPixelForValue(bar.y[0]);
        const yEnd = yScale.getPixelForValue(bar.y[1]);
        
        const isHovered = i === hoveredIndex;
        const color = bar.isPositive ? '#4ade80' : '#ef4444';
        const glowColor = bar.isPositive ? 'rgba(74, 222, 128, 0.4)' : 'rgba(239, 68, 68, 0.4)';
        
        const barWidth = isHovered ? 20 : 16;
        const glowIntensity = isHovered ? 15 : 10;

        // Dibujar bastón con glow
        ctx.fillStyle = color;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = glowIntensity;
        ctx.fillRect(x - barWidth / 2, Math.min(yStart, yEnd), barWidth, Math.abs(yEnd - yStart) || 2);

        // Borde si está en hover
        if (isHovered) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.lineWidth = 2;
          ctx.shadowBlur = 0;
          ctx.strokeRect(x - barWidth / 2, Math.min(yStart, yEnd), barWidth, Math.abs(yEnd - yStart) || 2);
        }
      });

      // Ahora dibujar la línea con gradiente por segmentos
      ctx.shadowBlur = 0;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'miter';

      for (let i = 0; i < palets.length - 1; i++) {
        const x1 = xScale.getPixelForValue(i);
        const y1 = yScale.getPixelForValue(palets[i]);
        const x2 = xScale.getPixelForValue(i + 1);
        const y2 = yScale.getPixelForValue(palets[i + 1]);

        // Color del segmento según si sube o baja
        const isRising = palets[i + 1] >= palets[i];
        const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
        
        if (isRising) {
          gradient.addColorStop(0, '#4ade80');
          gradient.addColorStop(1, '#22c55e');
        } else {
          gradient.addColorStop(0, '#ef4444');
          gradient.addColorStop(1, '#dc2626');
        }

        ctx.strokeStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // Dibujar puntos en cada valor
      palets.forEach((val, i) => {
        const x = xScale.getPixelForValue(i);
        const y = yScale.getPixelForValue(val);
        const isRising = i === 0 ? true : val >= palets[i - 1];
        const color = isRising ? '#4ade80' : '#ef4444';

        ctx.fillStyle = color;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });

      ctx.restore();
    },
  };

  chartPaletsDia = new Chart(el, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Palets por día",
          data: palets,
          borderColor: 'transparent',
          backgroundColor: 'transparent',
          pointRadius: 8,
          pointHoverRadius: 10,
          pointBackgroundColor: 'transparent',
          pointBorderColor: 'transparent',
          pointHoverBackgroundColor: 'transparent',
          pointHoverBorderColor: 'transparent',
          showLine: false,
        },
        {
          label: `Promedio período (${promedio.toFixed(0)})`,
          data: new Array(days).fill(promedio),
          type: "line",
          borderColor: "rgba(139, 92, 246, 0.9)",
          borderWidth: 2,
          borderDash: [8, 4],
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: { 
            color: UI.legendText,
            padding: 15,
            boxWidth: 40,
          },
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(15, 27, 45, 0.95)',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          borderColor: 'rgba(255, 255, 255, 0.2)',
          borderWidth: 1,
          padding: 12,
          displayColors: false,
          filter: (tooltipItem) => {
            return tooltipItem.datasetIndex === 0;
          },
          callbacks: {
            title: (tooltipItems) => {
              return tooltipItems[0].label;
            },
            label: (c) => {
              const bar = barData[c.dataIndex];
              const signo = bar.variacion >= 0 ? "+" : "";
              const vsProm = ((bar.actual - promedio) / promedio * 100).toFixed(1);
              const signoP = vsProm > 0 ? "+" : "";
              const diaRef = c.dataIndex === 0 ? "promedio" : "día anterior";

              return [
                `Palets del día: ${bar.actual}`,
                `───────────────`,
                `Valor ${diaRef}: ${bar.anterior.toFixed(0)}`,
                `Variación: ${signo}${bar.variacion.toFixed(0)} (${signo}${bar.variacionPct.toFixed(1)}%) ${bar.isPositive ? '↑' : '↓'}`,
                `vs Promedio: ${signoP}${vsProm}%`,
              ];
            },
          },
        },
      },
      layout: {
        padding: {
          top: 10,
          bottom: 10,
          left: 10,
          right: 10,
        },
      },
      scales: {
        x: {
          type: 'category',
          ticks: {
            color: UI.axisText,
            maxRotation: 45,
            minRotation: 45,
            font: { size: 11 },
          },
          grid: { display: false },
          title: {
            display: true,
            text: "Día",
            color: UI.axisText,
          },
        },
        y: {
          min: yMin,
          max: yMax,
          ticks: {
            color: UI.axisText,
            precision: 0,
          },
          grid: { 
            color: UI.grid,
            drawBorder: false,
          },
          title: {
            display: true,
            text: "N° de palets",
            color: UI.axisText,
          },
        },
      },
    },
    plugins: [barStickPlugin],
  });
}

let chartTiempoTunelMix = null;

function renderTiempoTunelBoxplotDummy() {
  const el = document.getElementById("chartTiempoTunelMix");
  if (!el) return;
  if (chartTiempoTunelMix) chartTiempoTunelMix.destroy();

  const labels = [
    "T01",
    "T02",
    "T03",
    "T04",
    "T05",
    "T06",
    "T07",
    "T08",
    "T09",
    "T10",
  ];
  const isMP = (t) => ["T01", "T02", "T03", "T04", "T05"].includes(t);

  // ---- Dummy: tiempos de enfriamiento por túnel (listas) ----
  const dataPorTunel = labels.map((t) => {
    const base = isMP(t) ? randInt(260, 310) : randInt(210, 260);
    const n = randInt(18, 30);
    const valores = [];

    for (let i = 0; i < n; i++) {
      const ruido = randInt(-30, 35);
      const outlier = Math.random() < 0.08 ? randInt(40, 90) : 0;
      valores.push(Math.max(60, base + ruido + outlier));
    }
    return valores;
  });

  // ---- Calcular min/max global para NO empezar desde 0 ----
  const flat = dataPorTunel.flat();
  const minV = Math.min(...flat);
  const maxV = Math.max(...flat);
  const pad = Math.max(10, Math.round((maxV - minV) * 0.06)); // margen visual
  const yMin = Math.max(0, minV - pad);
  const yMax = maxV + pad;

  // ---- Color por túnel (MP vs PT) ----
  const bgColors = labels.map((t) =>
    isMP(t) ? "rgba(54, 162, 235, 0.25)" : "rgba(75, 192, 192, 0.25)"
  );
  const borderColors = labels.map((t) =>
    isMP(t) ? "rgba(54, 162, 235, 0.85)" : "rgba(75, 192, 192, 0.85)"
  );

  chartTiempoTunelMix = new Chart(el, {
    type: "boxplot",
    data: {
      labels,
      datasets: [
        {
          label: "Tiempo de enfriamiento (min)",
          data: dataPorTunel,

          /* ❌ Caja invisible */
          backgroundColor: "rgba(49, 14, 14, 0)",
          borderColor: "rgb(30, 63, 122)",
          borderWidth: 0,

          /* ✅ Bigotes = MIN / MAX */
          whiskerColor: "rgb(235, 44, 44)",
          whiskerWidth: 2,

          /* ✅ Mediana */
          medianColor: "rgb(0, 81, 255)",
          medianWidth: 2,

          /* ✅ Outliers (casos atípicos) */
          outlierColor: "rgba(255,255,255,0.95)",
          outlierBorderColor: "rgba(255,255,255,1)",
          outlierRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: { color: UI.legendText },
        },
        tooltip: {
          callbacks: {
            label: (c) => {
              const v = c.raw;
              if (v && typeof v === "object" && "median" in v) {
                return [
                  `Mediana: ${v.median.toFixed(0)} min`,
                  `Q1: ${v.q1.toFixed(0)} | Q3: ${v.q3.toFixed(0)}`,
                  `Min: ${v.min.toFixed(0)} | Max: ${v.max.toFixed(0)}`,
                ];
              }
              return "";
            },
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: UI.axisText,
            maxRotation: 45,
            minRotation: 45,
          },
          grid: { display: false },
          title: {
            display: true,
            text: "Túnel",
            color: UI.axisText,
          },
        },
        y: {
          min: yMin, // ✅ ya no arranca en 0
          max: yMax,
          ticks: { color: UI.axisText },
          grid: { color: UI.grid },
          title: {
            display: true,
            text: "Tiempo de enfriamiento (min)",
            color: UI.axisText,
          },
        },
      },
    },
  });
}

//let chartTiempoTunelMix = null;

function renderTiempoTunelMinMaxPromDummy() {
  const el = document.getElementById("chartTiempoTunelMix");
  if (!el) return;
  if (chartTiempoTunelMix) chartTiempoTunelMix.destroy();

  const labels = ["T01","T02","T03","T04","T05","T06","T07","T08","T09","T10"];
  const isMP = (t) => ["T01","T02","T03","T04","T05"].includes(t);

  // 1) Generar data dummy por túnel (lista de duraciones)
  const series = labels.map(t => {
    const base = isMP(t) ? randInt(260, 310) : randInt(210, 260);
    const n = randInt(18, 30);
    const arr = [];
    for (let i = 0; i < n; i++) {
      const ruido = randInt(-30, 35);
      const outlier = Math.random() < 0.08 ? randInt(40, 90) : 0;
      arr.push(Math.max(60, base + ruido + outlier));
    }
    return arr;
  });

  // 2) Calcular min/max/avg por túnel
  const stats = series.map(arr => {
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    return { min, max, avg };
  });

  const mins = stats.map(s => s.min);
  const maxs = stats.map(s => s.max);
  const avgs = stats.map(s => s.avg);

  // 3) Ajustar eje Y para NO empezar en 0 (usa min/max reales + padding)
  const globalMin = Math.min(...mins);
  const globalMax = Math.max(...maxs);
  const pad = Math.max(10, Math.round((globalMax - globalMin) * 0.06));
  const yMin = Math.max(0, globalMin - pad);
  const yMax = globalMax + pad;

  // 4) Separar puntos de promedio por tipo (MP / PT)
  const meanMP = [];
  const meanPT = [];

  labels.forEach((t, i) => {
    const point = { x: i, y: avgs[i] };
    if (isMP(t)) meanMP.push(point);
    else meanPT.push(point);
  });

  // 5) Plugin: dibuja rango min-max (línea vertical) + caps horizontales
  const whiskerPlugin = {
    id: "minMaxWhiskers",
    afterDatasetsDraw(chart) {
      const { ctx, scales } = chart;
      const xScale = scales.x;
      const yScale = scales.y;

      ctx.save();
      ctx.lineWidth = 2;

      const capWidth = 12;

      for (let i = 0; i < labels.length; i++) {
        const x = xScale.getPixelForValue(i);
        const yMinPx = yScale.getPixelForValue(mins[i]);
        const yMaxPx = yScale.getPixelForValue(maxs[i]);

        // Color por tipo (MP/PT) igual que tus otras gráficas
        ctx.strokeStyle = isMP(labels[i])
          ? "rgba(54,162,235,0.85)"
          : "rgba(75,192,192,0.85)";

        // línea vertical min->max
        ctx.beginPath();
        ctx.moveTo(x, yMaxPx);
        ctx.lineTo(x, yMinPx);
        ctx.stroke();

        // cap superior (max)
        ctx.beginPath();
        ctx.moveTo(x - capWidth / 2, yMaxPx);
        ctx.lineTo(x + capWidth / 2, yMaxPx);
        ctx.stroke();

        // cap inferior (min)
        ctx.beginPath();
        ctx.moveTo(x - capWidth / 2, yMinPx);
        ctx.lineTo(x + capWidth / 2, yMinPx);
        ctx.stroke();
      }

      ctx.restore();
    }
  };

  // 6) Crear chart (solo puntos de promedio) + plugin dibuja el rango
  chartTiempoTunelMix = new Chart(el, {
    type: "scatter",
    data: {
      labels,
      datasets: [
        {
          label: "Materia Prima",
          data: meanMP,
          parsing: false,
          showLine: false,
          pointRadius: 4,
          pointHoverRadius: 5,
          pointBackgroundColor: "rgba(54,162,235,0.95)",
          pointBorderColor: "rgba(255,255,255,0.9)",
          pointBorderWidth: 1
        },
        {
          label: "Producto Terminado",
          data: meanPT,
          parsing: false,
          showLine: false,
          pointRadius: 4,
          pointHoverRadius: 5,
          pointBackgroundColor: "rgba(75,192,192,0.95)",
          pointBorderColor: "rgba(255,255,255,0.9)",
          pointBorderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: { color: UI.legendText }
        },
        tooltip: {
          callbacks: {
            label: (c) => {
              // c.raw.x es el índice del túnel
              const i = Math.round(c.raw.x);
              const tipo = isMP(labels[i]) ? "Materia Prima" : "Producto Terminado";
              return [
                `${tipo}`,
                `Promedio: ${avgs[i].toFixed(0)} min`,
                `Min: ${mins[i].toFixed(0)} | Max: ${maxs[i].toFixed(0)}`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          type: "linear",
          min: -0.5,
          max: labels.length - 0.5,
          grid: { display: false },
          ticks: {
            color: UI.axisText,
            stepSize: 1,
            callback: (v) => {
              const idx = Math.round(v);
              return (idx >= 0 && idx < labels.length) ? labels[idx] : "";
            }
          },
          title: { display: true, text: "Túnel", color: UI.axisText }
        },
        y: {
          min: yMin,
          max: yMax,
          beginAtZero: false,
          grid: { color: UI.grid },
          ticks: { color: UI.axisText },
          title: { display: true, text: "Tiempo de enfriamiento (min)", color: UI.axisText }
        }
      }
    },
    plugins: [whiskerPlugin]
  });
}


let chartAsentamientoTipo = null;

function renderAsentamientoTipoDummy() {
  const el = document.getElementById("chartAsentamientoTipo");
  if (!el) return;
  if (chartAsentamientoTipo) chartAsentamientoTipo.destroy();

  // ---- Data dummy (minutos) ----
  // MP suele tardar más en asentarse
  const asentamientoMP = randInt(45, 70);
  const asentamientoPT = randInt(30, 50);

  chartAsentamientoTipo = new Chart(el, {
    type: "bar",
    data: {
      labels: ["Materia Prima", "Producto Terminado"],
      datasets: [{
        label: "Tiempo de asentamiento",
        data: [asentamientoMP, asentamientoPT],
        backgroundColor: [
          "rgba(54,162,235,0.85)",   // MP
          "rgba(75,192,192,0.85)"    // PT
        ],
        borderRadius: 6,
        barThickness: 20
      }]
    },
    options: {
      indexAxis: "y",              // 🔑 horizontal
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (c) => ` ${c.raw.toFixed(0)} min`
          }
        }
      },
      scales: {
        x: {
          beginAtZero: false,
          ticks: {
            color: UI.axisText,
            callback: (v) => `${v} min`
          },
          grid: { color: UI.grid },
          title: {
            display: true,
            text: "Tiempo de asentamiento (min)",
            color: UI.axisText
          }
        },
        y: {
          ticks: {
            color: UI.axisText
          },
          grid: { display: false }
        }
      }
    }
  });
}

let chartAsentamientoTopGrupos = null;

function renderAsentamientoTop3PorGrupoDummy() {
  const el = document.getElementById("chartAsentamientoTop5Grupos");
  if (!el) return;
  if (chartAsentamientoTopGrupos) chartAsentamientoTopGrupos.destroy();

  const tunelesBase = (typeof tuneles !== "undefined" && tuneles.length)
    ? tuneles
    : ["T01","T02","T03","T04","T05","T06","T07","T08","T09","T10"];

  const isMP = (t) => ["T01","T02","T03","T04","T05"].includes(t);

  // Dummy: tiempo de asentamiento (min)
  const data = tunelesBase.map(t => ({
    tunel: t,
    tipo: isMP(t) ? "MP" : "PT",
    asentamiento: isMP(t) ? randInt(40, 75) : randInt(30, 60)
  }));

  // Top 3 por grupo
  const mp = data.filter(d => d.tipo === "MP")
                 .sort((a,b)=>b.asentamiento - a.asentamiento)
                 .slice(0, 3)
                 .reverse();

  const pt = data.filter(d => d.tipo === "PT")
                 .sort((a,b)=>b.asentamiento - a.asentamiento)
                 .slice(0, 3)
                 .reverse();

  const labels = [...mp.map(d => d.tunel), ...pt.map(d => d.tunel)];
  const values = [...mp.map(d => d.asentamiento), ...pt.map(d => d.asentamiento)];

  const valuesMP = [...mp.map(d => d.asentamiento), ...new Array(pt.length).fill(null)];
  const valuesPT = [...new Array(mp.length).fill(null), ...pt.map(d => d.asentamiento)];

  // Plugin para dibujar etiquetas dentro de las barras
  const datalabelsPlugin = {
    id: 'datalabels',
    afterDatasetsDraw(chart) {
      const { ctx, scales } = chart;
      const xScale = scales.x;
      const yScale = scales.y;

      ctx.save();
      ctx.font = 'bold 13px system-ui';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      chart.data.datasets.forEach((dataset, datasetIndex) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        if (!meta.hidden) {
          meta.data.forEach((bar, index) => {
            const value = dataset.data[index];
            if (value !== null && value !== undefined) {
              const xEnd = xScale.getPixelForValue(value);
              const xStart = xScale.getPixelForValue(0);
              const xCenter = (xStart + xEnd) / 2;
              const y = yScale.getPixelForValue(index);
              ctx.fillText(`${value} min`, xCenter, y);
            }
          });
        }
      });

      ctx.restore();
    },
  };

  // Crear gradientes
  const ctx = el.getContext('2d');
  const gradientMP = ctx.createLinearGradient(0, 0, 400, 0);
  gradientMP.addColorStop(0, 'rgba(54, 162, 235, 0.9)');
  gradientMP.addColorStop(1, 'rgba(6, 182, 212, 1)');

  const gradientPT = ctx.createLinearGradient(0, 0, 400, 0);
  gradientPT.addColorStop(0, 'rgba(75, 192, 192, 0.9)');
  gradientPT.addColorStop(1, 'rgba(16, 185, 129, 1)');

  chartAsentamientoTopGrupos = new Chart(el, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Materia Prima (Top 3)",
          data: valuesMP,
          backgroundColor: gradientMP,
          borderRadius: 20,
          barThickness: 22
        },
        {
          label: "Producto Terminado (Top 3)",
          data: valuesPT,
          backgroundColor: gradientPT,
          borderRadius: 20,
          barThickness: 22
        }
      ]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: { color: UI.legendText }
        },
        tooltip: {
          callbacks: { 
            label: (c) => `${c.raw} min`
          }
        }
      },
      scales: {
        x: {
          beginAtZero: false,
          ticks: {
            color: UI.axisText,
            callback: (v) => `${v} min`
          },
          grid: { color: UI.grid },
          title: {
            display: true,
            text: "Tiempo de asentamiento (min)",
            color: UI.axisText
          }
        },
        y: {
          ticks: { color: UI.axisText },
          grid: { display: false }
        }
      }
    },
    plugins: [datalabelsPlugin],
  });
}



/************************************
 * 6) INIT: render todo dummy
 ************************************/
function renderAllDummy() {
  setupLiquidGauge();
  renderFallasDummy();
  renderTiempoTunelDummy();
  renderPaletsPorDiaDummy();
  renderPaletsPorDiaSolidDummy();
  renderPaletsPorDiaDashedDummy();
  renderTiempoTunelMinMaxPromDummy();
  renderAsentamientoTop3PorGrupoDummy();
}

// Llama esto cuando cargue tu página
document.addEventListener("DOMContentLoaded", renderAllDummy);


/* Grafica de Palets - LINEA SOLIDA CYAN */

let chartPaletsDiaSolid = null;

function renderPaletsPorDiaSolidDummy() {
  const el = document.getElementById("chartPaletsDiaSolid");
  if (!el) return;
  if (chartPaletsDiaSolid) chartPaletsDiaSolid.destroy();

  const days = 14;
  const labels = [];
  const palets = [];
  const barData = [];

  const today = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const label = d.toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "short",
    });
    labels.push(label);
    palets.push(randInt(30, 80));
  }

  const promedio = palets.reduce((a, b) => a + b, 0) / palets.length;

  for (let i = 0; i < palets.length; i++) {
    const valorActual = palets[i];
    const valorAnterior = i === 0 ? promedio : palets[i - 1];
    const isPositive = valorActual >= valorAnterior;
    
    barData.push({
      x: i,
      y: [valorAnterior, valorActual],
      actual: valorActual,
      anterior: valorAnterior,
      variacion: valorActual - valorAnterior,
      variacionPct: ((valorActual - valorAnterior) / valorAnterior * 100),
      isPositive,
    });
  }

  const allValues = palets;
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const padding = Math.max(5, Math.round((maxValue - minValue) * 0.15));
  const yMin = Math.max(0, minValue - padding);
  const yMax = maxValue + padding;

  const barStickPluginSolid = {
    id: 'barStickSolid',
    afterDatasetsDraw(chart) {
      const { ctx, scales } = chart;
      const xScale = scales.x;
      const yScale = scales.y;
      const activeElements = chart.getActiveElements();
      const hoveredIndex = activeElements.length > 0 ? activeElements[0].index : -1;

      ctx.save();

      barData.forEach((bar, i) => {
        const x = xScale.getPixelForValue(i);
        const yStart = yScale.getPixelForValue(bar.y[0]);
        const yEnd = yScale.getPixelForValue(bar.y[1]);
        
        const isHovered = i === hoveredIndex;
        const color = bar.isPositive ? '#4ade80' : '#ef4444';
        const glowColor = bar.isPositive ? 'rgba(74, 222, 128, 0.4)' : 'rgba(239, 68, 68, 0.4)';
        
        const barWidth = isHovered ? 20 : 16;
        const glowIntensity = isHovered ? 15 : 10;

        ctx.fillStyle = color;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = glowIntensity;
        ctx.fillRect(x - barWidth / 2, Math.min(yStart, yEnd), barWidth, Math.abs(yEnd - yStart) || 2);

        if (isHovered) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.lineWidth = 2;
          ctx.shadowBlur = 0;
          ctx.strokeRect(x - barWidth / 2, Math.min(yStart, yEnd), barWidth, Math.abs(yEnd - yStart) || 2);
        }
      });

      // Línea sólida cyan
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(6, 182, 212, 0.5)';
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'miter';

      ctx.beginPath();
      palets.forEach((val, i) => {
        const x = xScale.getPixelForValue(i);
        const y = yScale.getPixelForValue(val);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Puntos
      ctx.shadowBlur = 0;
      palets.forEach((val, i) => {
        const x = xScale.getPixelForValue(i);
        const y = yScale.getPixelForValue(val);

        ctx.fillStyle = '#06b6d4';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });

      ctx.restore();
    },
  };

  chartPaletsDiaSolid = new Chart(el, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Palets por día",
          data: palets,
          borderColor: 'transparent',
          backgroundColor: 'transparent',
          pointRadius: 8,
          pointHoverRadius: 10,
          pointBackgroundColor: 'transparent',
          pointBorderColor: 'transparent',
          pointHoverBackgroundColor: 'transparent',
          pointHoverBorderColor: 'transparent',
          showLine: false,
        },
        {
          label: `Promedio período (${promedio.toFixed(0)})`,
          data: new Array(days).fill(promedio),
          type: "line",
          borderColor: "rgba(139, 92, 246, 0.9)",
          borderWidth: 2,
          borderDash: [8, 4],
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: { 
            color: UI.legendText,
            padding: 15,
            boxWidth: 40,
          },
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(15, 27, 45, 0.95)',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          borderColor: 'rgba(255, 255, 255, 0.2)',
          borderWidth: 1,
          padding: 12,
          displayColors: false,
          filter: (tooltipItem) => {
            return tooltipItem.datasetIndex === 0;
          },
          callbacks: {
            title: (tooltipItems) => {
              return tooltipItems[0].label;
            },
            label: (c) => {
              const bar = barData[c.dataIndex];
              const signo = bar.variacion >= 0 ? "+" : "";
              const vsProm = ((bar.actual - promedio) / promedio * 100).toFixed(1);
              const signoP = vsProm > 0 ? "+" : "";
              const diaRef = c.dataIndex === 0 ? "promedio" : "día anterior";

              return [
                `Palets del día: ${bar.actual}`,
                `───────────────`,
                `Valor ${diaRef}: ${bar.anterior.toFixed(0)}`,
                `Variación: ${signo}${bar.variacion.toFixed(0)} (${signo}${bar.variacionPct.toFixed(1)}%) ${bar.isPositive ? '↑' : '↓'}`,
                `vs Promedio: ${signoP}${vsProm}%`,
              ];
            },
          },
        },
      },
      layout: {
        padding: {
          top: 10,
          bottom: 10,
          left: 10,
          right: 10,
        },
      },
      scales: {
        x: {
          type: 'category',
          ticks: {
            color: UI.axisText,
            maxRotation: 45,
            minRotation: 45,
            font: { size: 11 },
          },
          grid: { display: false },
          title: {
            display: true,
            text: "Día",
            color: UI.axisText,
          },
        },
        y: {
          min: yMin,
          max: yMax,
          ticks: {
            color: UI.axisText,
            precision: 0,
          },
          grid: { 
            color: UI.grid,
            drawBorder: false,
          },
          title: {
            display: true,
            text: "N° de palets",
            color: UI.axisText,
          },
        },
      },
    },
    plugins: [barStickPluginSolid],
  });
}

/* Grafica de Palets - LINEA PUNTEADA CON COLORES */

let chartPaletsDiaDashed = null;

function renderPaletsPorDiaDashedDummy() {
  const el = document.getElementById("chartPaletsDiaDashed");
  if (!el) return;
  if (chartPaletsDiaDashed) chartPaletsDiaDashed.destroy();

  const days = 14;
  const labels = [];
  const palets = [];
  const barData = [];

  const today = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const label = d.toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "short",
    });
    labels.push(label);
    palets.push(randInt(30, 80));
  }

  const promedio = palets.reduce((a, b) => a + b, 0) / palets.length;

  for (let i = 0; i < palets.length; i++) {
    const valorActual = palets[i];
    const valorAnterior = i === 0 ? promedio : palets[i - 1];
    const isPositive = valorActual >= valorAnterior;
    
    barData.push({
      x: i,
      y: [valorAnterior, valorActual],
      actual: valorActual,
      anterior: valorAnterior,
      variacion: valorActual - valorAnterior,
      variacionPct: ((valorActual - valorAnterior) / valorAnterior * 100),
      isPositive,
    });
  }

  const allValues = palets;
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const padding = Math.max(5, Math.round((maxValue - minValue) * 0.15));
  const yMin = Math.max(0, minValue - padding);
  const yMax = maxValue + padding;

  const barStickPluginDashed = {
    id: 'barStickDashed',
    afterDatasetsDraw(chart) {
      const { ctx, scales } = chart;
      const xScale = scales.x;
      const yScale = scales.y;
      const activeElements = chart.getActiveElements();
      const hoveredIndex = activeElements.length > 0 ? activeElements[0].index : -1;

      ctx.save();

      barData.forEach((bar, i) => {
        const x = xScale.getPixelForValue(i);
        const yStart = yScale.getPixelForValue(bar.y[0]);
        const yEnd = yScale.getPixelForValue(bar.y[1]);
        
        const isHovered = i === hoveredIndex;
        const color = bar.isPositive ? '#4ade80' : '#ef4444';
        const glowColor = bar.isPositive ? 'rgba(74, 222, 128, 0.4)' : 'rgba(239, 68, 68, 0.4)';
        
        const barWidth = isHovered ? 20 : 16;
        const glowIntensity = isHovered ? 15 : 10;

        ctx.fillStyle = color;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = glowIntensity;
        ctx.fillRect(x - barWidth / 2, Math.min(yStart, yEnd), barWidth, Math.abs(yEnd - yStart) || 2);

        if (isHovered) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.lineWidth = 2;
          ctx.shadowBlur = 0;
          ctx.strokeRect(x - barWidth / 2, Math.min(yStart, yEnd), barWidth, Math.abs(yEnd - yStart) || 2);
        }
      });

      // Línea punteada con colores por segmento
      ctx.shadowBlur = 0;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'miter';
      ctx.setLineDash([8, 4]);

      for (let i = 0; i < palets.length - 1; i++) {
        const x1 = xScale.getPixelForValue(i);
        const y1 = yScale.getPixelForValue(palets[i]);
        const x2 = xScale.getPixelForValue(i + 1);
        const y2 = yScale.getPixelForValue(palets[i + 1]);

        const isRising = palets[i + 1] >= palets[i];
        const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
        
        if (isRising) {
          gradient.addColorStop(0, '#4ade80');
          gradient.addColorStop(1, '#22c55e');
        } else {
          gradient.addColorStop(0, '#ef4444');
          gradient.addColorStop(1, '#dc2626');
        }

        ctx.strokeStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // Puntos
      ctx.setLineDash([]);
      palets.forEach((val, i) => {
        const x = xScale.getPixelForValue(i);
        const y = yScale.getPixelForValue(val);
        const isRising = i === 0 ? true : val >= palets[i - 1];
        const color = isRising ? '#4ade80' : '#ef4444';

        ctx.fillStyle = color;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });

      ctx.restore();
    },
  };

  chartPaletsDiaDashed = new Chart(el, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Palets por día",
          data: palets,
          borderColor: 'transparent',
          backgroundColor: 'transparent',
          pointRadius: 8,
          pointHoverRadius: 10,
          pointBackgroundColor: 'transparent',
          pointBorderColor: 'transparent',
          pointHoverBackgroundColor: 'transparent',
          pointHoverBorderColor: 'transparent',
          showLine: false,
        },
        {
          label: `Promedio período (${promedio.toFixed(0)})`,
          data: new Array(days).fill(promedio),
          type: "line",
          borderColor: "rgba(139, 92, 246, 0.9)",
          borderWidth: 2,
          borderDash: [8, 4],
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: { 
            color: UI.legendText,
            padding: 15,
            boxWidth: 40,
          },
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(15, 27, 45, 0.95)',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          borderColor: 'rgba(255, 255, 255, 0.2)',
          borderWidth: 1,
          padding: 12,
          displayColors: false,
          filter: (tooltipItem) => {
            return tooltipItem.datasetIndex === 0;
          },
          callbacks: {
            title: (tooltipItems) => {
              return tooltipItems[0].label;
            },
            label: (c) => {
              const bar = barData[c.dataIndex];
              const signo = bar.variacion >= 0 ? "+" : "";
              const vsProm = ((bar.actual - promedio) / promedio * 100).toFixed(1);
              const signoP = vsProm > 0 ? "+" : "";
              const diaRef = c.dataIndex === 0 ? "promedio" : "día anterior";

              return [
                `Palets del día: ${bar.actual}`,
                `───────────────`,
                `Valor ${diaRef}: ${bar.anterior.toFixed(0)}`,
                `Variación: ${signo}${bar.variacion.toFixed(0)} (${signo}${bar.variacionPct.toFixed(1)}%) ${bar.isPositive ? '↑' : '↓'}`,
                `vs Promedio: ${signoP}${vsProm}%`,
              ];
            },
          },
        },
      },
      layout: {
        padding: {
          top: 10,
          bottom: 10,
          left: 10,
          right: 10,
        },
      },
      scales: {
        x: {
          type: 'category',
          ticks: {
            color: UI.axisText,
            maxRotation: 45,
            minRotation: 45,
            font: { size: 11 },
          },
          grid: { display: false },
          title: {
            display: true,
            text: "Día",
            color: UI.axisText,
          },
        },
        y: {
          min: yMin,
          max: yMax,
          ticks: {
            color: UI.axisText,
            precision: 0,
          },
          grid: { 
            color: UI.grid,
            drawBorder: false,
          },
          title: {
            display: true,
            text: "N° de palets",
            color: UI.axisText,
          },
        },
      },
    },
    plugins: [barStickPluginDashed],
  });
}
