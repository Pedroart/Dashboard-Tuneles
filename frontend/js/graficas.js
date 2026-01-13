
const ctx = document.getElementById('chartOcupabilidad');

const labels = [
  "T01","T02","T03","T04","T05",
  "T06","T07","T08","T09","T10"
];

const ocupabilidad = [78, 65, 82, 71, 69, 75, 80, 66, 73, 77];

const colors = labels.map(t =>
  ["T01","T02","T03","T04","T05"].includes(t)
    ? "rgba(54, 162, 235, 0.7)"
    : "rgba(75, 192, 192, 0.7)"
);

new Chart(ctx, {
  type: "bar",
  data: {
    labels,
    datasets: [{
      label: "Ocupabilidad promedio",
      data: ocupabilidad,
      backgroundColor: colors,
      borderRadius: 4,
      barThickness: 16
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: c => `Ocupabilidad: ${c.raw}%`
        }
      }
    },
    scales: {
      x: {
        ticks: {
          color: "rgba(0,0,0,0.7)",
          maxRotation: 45,
          minRotation: 45
        },
        grid: { display: false }
      },
      y: {
        min: 0,
        max: 100,
        ticks: {
          color: "rgba(0,0,0,0.7)",
          callback: v => `${v}%`
        },
        grid: { color: "rgba(0,0,0,0.1)" }
      }
    }
  }
});

let chartEnfriamiento = null;

function renderChartEnfriamiento(tiposCaja) {
  const ctx = document.getElementById('chartEnfriamiento');
  if (!ctx) return;
  
  if (chartEnfriamiento) chartEnfriamiento.destroy();
  
  const colores = {
    'caja_1kg': 'rgb(255, 99, 132)',
    'caja_2kg': 'rgb(54, 162, 235)',
    'caja_5kg': 'rgb(255, 206, 86)',
    'clamshell_500g': 'rgb(75, 192, 192)'
  };
  
  const datasets = [];
  
  for (const [tipo, series] of Object.entries(tiposCaja)) {
    if (series.length === 0) continue;
    
    const promedios = {};
    series.forEach(serie => {
      serie.forEach(punto => {
        if (!promedios[punto.tiempo_min]) promedios[punto.tiempo_min] = [];
        promedios[punto.tiempo_min].push(punto.temperatura);
      });
    });
    
    const data = Object.keys(promedios).sort((a, b) => a - b).map(t => ({
      x: parseInt(t),
      y: promedios[t].reduce((a, b) => a + b, 0) / promedios[t].length
    }));
    
    datasets.push({
      label: tipo,
      data: data,
      borderColor: colores[tipo] || 'rgb(128, 128, 128)',
      backgroundColor: (colores[tipo] || 'rgb(128, 128, 128)').replace('rgb', 'rgba').replace(')', ', 0.1)'),
      borderWidth: 2,
      radius: 0,
      tension: 0.4
    });
  }
  
  chartEnfriamiento = new Chart(ctx, {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      parsing: false,
      plugins: {
        legend: { display: true, position: 'top' },
        tooltip: { enabled: true }
      },
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: 'Tiempo (min)', color: 'rgba(0,0,0,0.7)' },
          ticks: { color: 'rgba(0,0,0,0.7)' },
          grid: { color: 'rgba(0,0,0,0.1)' }
        },
        y: {
          title: { display: true, text: 'Temperatura (°C)', color: 'rgba(0,0,0,0.7)' },
          ticks: { color: 'rgba(0,0,0,0.7)' },
          grid: { color: 'rgba(0,0,0,0.1)' }
        }
      }
    }
  });
}

let chartTiempoTunel = null;

function renderChartTiempoTunel(items) {
  const ctx = document.getElementById('chartTiempoTunel');
  if (!ctx) return;
  
  if (chartTiempoTunel) chartTiempoTunel.destroy();
  
  const datos = {};
  
  items.forEach(item => {
    const tunel = item.tunel_nick || `T${item.tunel_id}`;
    const tipoCaja = item.tipo_caja;
    const duracion = item.duracion_min;
    
    if (!duracion || !tipoCaja) return;
    
    const key = `${tunel}_${tipoCaja}`;
    if (!datos[key]) datos[key] = { tunel, tipoCaja, duraciones: [] };
    datos[key].duraciones.push(duracion);
  });
  
  const labels = [];
  const datasetsPorCaja = {};
  
  Object.values(datos).forEach(d => {
    const promedio = d.duraciones.reduce((a, b) => a + b, 0) / d.duraciones.length;
    const label = d.tunel;
    
    if (!labels.includes(label)) labels.push(label);
    if (!datasetsPorCaja[d.tipoCaja]) datasetsPorCaja[d.tipoCaja] = {};
    datasetsPorCaja[d.tipoCaja][label] = promedio;
  });
  
  const colores = {
    'caja_1kg': 'rgba(255, 99, 132, 0.7)',
    'caja_2kg': 'rgba(54, 162, 235, 0.7)',
    'caja_5kg': 'rgba(255, 206, 86, 0.7)',
    'clamshell_500g': 'rgba(75, 192, 192, 0.7)'
  };
  
  const datasets = Object.entries(datasetsPorCaja).map(([tipoCaja, valores]) => ({
    label: tipoCaja,
    data: labels.map(l => valores[l] || 0),
    backgroundColor: colores[tipoCaja] || 'rgba(128, 128, 128, 0.7)'
  }));
  
  chartTiempoTunel = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top' },
        tooltip: {
          callbacks: {
            label: c => `${c.dataset.label}: ${c.raw.toFixed(0)} min`
          }
        }
      },
      scales: {
        x: { title: { display: true, text: 'Túnel' } },
        y: { 
          title: { display: true, text: 'Tiempo promedio (min)' },
          beginAtZero: true
        }
      }
    }
  });
}
