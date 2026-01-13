let performanceChart = null;

async function renderChart(procesoId) {
  const data = await getSerie(procesoId);
  
  if (!data || data.length === 0) {
    console.log('No hay datos para mostrar');
    return;
  }

  const chartData = data.map(d => ({ x: d.tiempo_min, y: d.temperatura }));

  const ctx = document.getElementById('performanceChart').getContext('2d');

  if (performanceChart) {
    performanceChart.destroy();
  }

  performanceChart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [{
        label: 'Temperatura',
        data: chartData,
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        borderWidth: 1,
        radius: 0,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      parsing: false,
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      },
      plugins: {
        decimation: {
          enabled: true,
          algorithm: 'min-max',
        },
        legend: { display: false },
        tooltip: { enabled: true }
      },
      scales: {
        x: {
          type: 'linear',
          display: false
        },
        y: {
          display: false
        }
      }
    }
  });
}
