
const ctx = document.getElementById('chartOcupabilidad');

const labels = [
  "T01","T02","T03","T04","T05",
  "T06","T07","T08","T09","T10"
];

// Ocupabilidad promedio por túnel
const ocupabilidad = [78, 65, 82, 71, 69, 75, 80, 66, 73, 77];

// Colores según tipo de túnel
const colors = labels.map(t =>
  ["T01","T02","T03","T04","T05"].includes(t)
    ? "rgba(33,150,243,0.65)"   // MP
    : "rgba(76,175,80,0.65)"   // PT
);

new Chart(ctx, {
  type: "bar",
  data: {
    labels,
    datasets: [{
      label: "Ocupabilidad promedio",
      data: ocupabilidad,
      backgroundColor: colors,
      borderRadius: 6,
      barThickness: 16
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,

    plugins: {
      legend: {
        display: false   // usamos leyenda custom
      },
      tooltip: {
        callbacks: {
          label: c => `Ocupabilidad: ${c.raw}%`
        }
      }
    },

    scales: {
      x: {
        ticks: {
          color: "rgba(255,255,255,0.65)",
          maxRotation: 45,
          minRotation: 45
        },
        grid: {
          display: false
        }
      },
      y: {
        min: 0,
        max: 100,
        ticks: {
          color: "rgba(255,255,255,0.65)",
          callback: v => `${v}%`
        },
        grid: {
          color: "rgba(255,255,255,0.08)"
        }
      }
    }
  }
});
