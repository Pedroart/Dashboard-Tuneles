// ========================
// Config / “API” mock
// ========================
// Aquí luego lo cambias por tu backend real (fetch).
// Por ahora: generamos procesos demo y filtramos en frontend.
const MOCK_PROCESOS = buildMockProcesos();

function buildMockProcesos() {
  const now = new Date();
  const arr = [];
  for (let i = 0; i < 40; i++) {
    const started = new Date(now.getTime() - (i * 6 + 2) * 3600_000); // horas atrás
    const durMin = 240 + Math.floor(Math.random() * 500);
    const ended = new Date(started.getTime() + durMin * 60_000);

    const palets = 4 + Math.floor(Math.random() * 20);
    const masa = Math.round((palets * (450 + Math.random() * 350)) * 10) / 10;

    const statusPool = ["open", "closed", "error"];
    const status = statusPool[Math.floor(Math.random() * statusPool.length)];

    arr.push({
      process_id: crypto?.randomUUID ? crypto.randomUUID() : String(i),
      plant: i % 2 ? "pk1" : "pk2",
      tunnel_id: i % 2 ? "T01" : "T02",
      started_at: started.toISOString(),
      ended_at: ended.toISOString(),
      status,
      palets,
      masa_kg: masa,
      duration_min: durMin,
      // stats demo
      temp_min_global: Math.round((-4 + Math.random() * 2) * 10) / 10,
      temp_max_global: Math.round((2 + Math.random() * 4) * 10) / 10,
      temp_avg_global: Math.round((-2 + Math.random() * 2) * 10) / 10,
      faults_count: Math.floor(Math.random() * 8),
    });
  }
  return arr;
}

// ========================
// Materialize init
// ========================
document.addEventListener("DOMContentLoaded", () => {
  M.FormSelect.init(document.querySelectorAll("select"));
  M.Datepicker.init(document.querySelectorAll(".datepicker"), {
    format: "yyyy-mm-dd",
    autoClose: true,
    firstDay: 1,
    showClearBtn: true,
    i18n: {
      cancel: "Cancelar",
      clear: "Limpiar",
      done: "OK",
      months: ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"],
      monthsShort: ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"],
      weekdays: ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"],
      weekdaysShort: ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"],
      weekdaysAbbrev: ["D","L","M","M","J","V","S"]
    }
  });

  wireEvents();
  resetDetail();
});

// ========================
// Charts
// ========================
const chartTemp = new Chart(document.getElementById("chartTemp"), {
  type: "line",
  data: { labels: [], datasets: [{ label: "°C", data: [], tension: 0.25, pointRadius: 0, borderWidth: 2 }] },
  options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true } } }
});

const chartEstado = new Chart(document.getElementById("chartEstado"), {
  type: "bar",
  data: { labels: ["open","closed","error"], datasets: [{ label: "Procesos", data: [0,0,0], borderWidth: 1 }] },
  options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
});

// ========================
// UI helpers
// ========================
function setText(id, value) {
  document.getElementById(id).textContent = value;
}

function valNumber(id) {
  const v = document.getElementById(id).value;
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function valString(id) {
  const v = document.getElementById(id).value;
  return (v === "" ? null : v);
}

function toDateOnlyISO(input) {
  // input: "yyyy-mm-dd"
  if (!input) return null;
  // lo convertimos a fecha a medianoche local
  const [y,m,d] = input.split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d, 0, 0, 0);
  return dt;
}

function fmtDT(iso) {
  const d = new Date(iso);
  return d.toLocaleString("es-PE", { hour12: false });
}

function withinRange(n, min, max) {
  if (min !== null && n < min) return false;
  if (max !== null && n > max) return false;
  return true;
}

// ========================
// Events
// ========================
function wireEvents() {
  const adv = document.getElementById("advancedBox");
  const btnToggle = document.getElementById("btnToggleAdvanced");

  btnToggle.addEventListener("click", () => {
    const open = adv.style.display !== "none";
    adv.style.display = open ? "none" : "block";
    btnToggle.innerHTML = open
      ? `<i class="material-icons left">expand_more</i>Mostrar`
      : `<i class="material-icons left">expand_less</i>Ocultar`;
    M.updateTextFields();
    M.FormSelect.init(document.querySelectorAll("select"));
  });

  document.getElementById("btnBuscar").addEventListener("click", () => {
    buscarProcesos();
  });

  document.getElementById("btnReset").addEventListener("click", () => {
    resetFilters();
    renderProcesos([]);
    resetDetail();
    setText("searchStatus", "—");
    M.toast({ html: "Filtros limpiados" });
  });

  document.getElementById("btnNavRefresh").addEventListener("click", () => {
    buscarProcesos();
  });
}

// ========================
// Search (PK + túnel + fecha + filtros avanzados)
// ========================
function collectFilters() {
  return {
    pk: valString("selPK"),
    tunel: valString("selTunel"),
    from: toDateOnlyISO(document.getElementById("dateFrom").value),
    to: toDateOnlyISO(document.getElementById("dateTo").value),

    minPalets: valNumber("minPalets"),
    maxPalets: valNumber("maxPalets"),
    minMasa: valNumber("minMasa"),
    maxMasa: valNumber("maxMasa"),
    minDurMin: valNumber("minDurMin"),
    maxDurMin: valNumber("maxDurMin"),

    estado: valString("selEstado"),
    q: valString("qText"),
  };
}

function validateRequired(f) {
  if (!f.pk) return "Seleccione PK";
  if (!f.tunel) return "Seleccione Túnel";
  if (!f.from) return "Seleccione fecha Desde";
  if (!f.to) return "Seleccione fecha Hasta";
  // Asegurar to incluye el día completo
  if (f.to < f.from) return "Rango de fechas inválido";
  return null;
}

function buscarProcesos() {
  const f = collectFilters();
  const err = validateRequired(f);
  if (err) {
    M.toast({ html: err });
    return;
  }

  // rango de fechas: desde 00:00 hasta 23:59 del "to"
  const fromMs = f.from.getTime();
  const toEnd = new Date(f.to.getTime());
  toEnd.setHours(23,59,59,999);
  const toMs = toEnd.getTime();

  // Filtro base (en backend esto debería ser query params)
  let items = MOCK_PROCESOS
    .filter(p => p.plant === f.pk)
    .filter(p => p.tunnel_id === f.tunel)
    .filter(p => {
      const started = new Date(p.started_at).getTime();
      return started >= fromMs && started <= toMs;
    });

  // Avanzados
  items = items
    .filter(p => withinRange(p.palets, f.minPalets, f.maxPalets))
    .filter(p => withinRange(p.masa_kg, f.minMasa, f.maxMasa))
    .filter(p => withinRange(p.duration_min, f.minDurMin, f.maxDurMin));

  if (f.estado) items = items.filter(p => p.status === f.estado);

  if (f.q) {
    const q = f.q.toLowerCase();
    // aquí puedes comparar con tarja, envase, lote, etc si existe en tu data
    items = items.filter(p =>
      (p.process_id || "").toLowerCase().includes(q)
    );
  }

  // Orden: más reciente primero
  items.sort((a,b) => new Date(b.started_at) - new Date(a.started_at));

  renderProcesos(items);
  resetDetail();

  setText("searchStatus", `${items.length} proceso(s) encontrado(s)`);
  if (items.length === 0) M.toast({ html: "Sin resultados con esos filtros" });

  // Demo: estado chart global de la búsqueda (opcional)
  updateStatusChart(items);
}

function updateStatusChart(items) {
  const counts = { open: 0, closed: 0, error: 0 };
  for (const p of items) counts[p.status] = (counts[p.status] ?? 0) + 1;
  chartEstado.data.datasets[0].data = [counts.open, counts.closed, counts.error];
  chartEstado.update();
}

// ========================
// Render tabla de procesos + seleccionar 1
// ========================
function renderProcesos(items) {
  const tbody = document.getElementById("tbodyProcesos");
  if (!items || items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="grey-text">No hay procesos para mostrar.</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map(p => `
    <tr>
      <td>${fmtDT(p.started_at)}</td>
      <td>${fmtDT(p.ended_at)}</td>
      <td><span class="chip">${p.status}</span></td>
      <td>${p.palets ?? "—"}</td>
      <td>${p.masa_kg ?? "—"}</td>
      <td>${p.duration_min ?? "—"}</td>
      <td style="white-space:nowrap;">
        <a href="#!" class="btn-small waves-effect" data-pid="${p.process_id}">
          <i class="material-icons left">visibility</i>Ver
        </a>
      </td>
    </tr>
  `).join("");

  // bind botones Ver
  tbody.querySelectorAll("a[data-pid]").forEach(btn => {
    btn.addEventListener("click", () => {
      const pid = btn.getAttribute("data-pid");
      const proc = items.find(x => x.process_id === pid);
      if (!proc) return;
      selectProceso(proc);
    });
  });
}

function selectProceso(proc) {
  // Aquí normalmente: fetch detalle del proceso (series de temps, sensores, etc.)
  // Por ahora usamos stats demo y una serie simulada.
  document.getElementById("selectedProcessTag").textContent = proc.process_id.slice(0, 8);
  document.getElementById("selectedProcessTag").classList.remove("grey");
  document.getElementById("selectedProcessTag").classList.add("blue");

  setText("kpiTempProm", proc.temp_avg_global ?? "—");
  setText("kpiTempMax", proc.temp_max_global ?? "—");
  setText("kpiTempMin", proc.temp_min_global ?? "—");
  setText("kpiFaults", proc.faults_count ?? "—");

  // Serie demo (si luego traes de backend: labels = timestamps reales)
  const labels = [];
  const values = [];
  for (let i = 0; i < 120; i++) {
    labels.push(`t-${120 - i}m`);
    values.push((proc.temp_avg_global ?? -1) + Math.sin(i / 8) * 0.8 + (Math.random() - 0.5) * 0.3);
  }
  chartTemp.data.labels = labels;
  chartTemp.data.datasets[0].data = values;
  chartTemp.update();

  M.toast({ html: `Proceso seleccionado: ${proc.process_id.slice(0, 8)}` });
}

function resetDetail() {
  const tag = document.getElementById("selectedProcessTag");
  tag.textContent = "Sin selección";
  tag.classList.remove("blue");
  tag.classList.add("grey");

  setText("kpiTempProm", "—");
  setText("kpiTempMax", "—");
  setText("kpiTempMin", "—");
  setText("kpiFaults", "—");

  chartTemp.data.labels = [];
  chartTemp.data.datasets[0].data = [];
  chartTemp.update();

  chartEstado.data.datasets[0].data = [0, 0, 0];
  chartEstado.update();
}

function resetFilters() {
  document.getElementById("selPK").selectedIndex = 0;
  document.getElementById("selTunel").selectedIndex = 0;
  document.getElementById("dateFrom").value = "";
  document.getElementById("dateTo").value = "";

  ["minPalets","maxPalets","minMasa","maxMasa","minDurMin","maxDurMin","qText"].forEach(id => {
    document.getElementById(id).value = "";
  });

  document.getElementById("selEstado").selectedIndex = 0;

  M.FormSelect.init(document.querySelectorAll("select"));
  M.updateTextFields();

  document.getElementById("tbodyProcesos").innerHTML =
    `<tr><td colspan="7" class="grey-text">Aún no has buscado.</td></tr>`;
}
