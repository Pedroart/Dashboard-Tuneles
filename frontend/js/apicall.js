const API_BASE = "http://127.0.0.1:8000";

let dataProcesos = []

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error ${response.status}: ${response.statusText}`);
  }
  return await response.json();
}

async function getProcesos({
  started_from = null,
  started_to = null,
  temporada_anio = null,
  packing_id = null,
  epoca = null,
  limit = 50,
  offset = 0
} = {}) {

  const params = new URLSearchParams();

  if (started_from) params.append("started_from", started_from);
  if (started_to) params.append("started_to", started_to);
  if (temporada_anio !== null) params.append("temporada_anio", temporada_anio);
  if (packing_id !== null) params.append("packing_id", packing_id);
  if (epoca) params.append("epoca", epoca);

  params.append("limit", limit);
  params.append("offset", offset);

  const url = `${API_BASE}/procesos?${params.toString()}`;

  try {
    const result = await fetchJSON(url);
    console.log("Procesos:", result);
    return result;
  } catch (error) {
    console.error("Error getProcesos:", error);
    return null;
  }
}

async function getTemporadas() {
  try {
    const result = await fetchJSON(`${API_BASE}/temporadas`);
    console.log("Temporadas:", result);
    return result; // [2025, 2024, ...]
  } catch (error) {
    console.error("Error getTemporadas:", error);
    return [];
  }
}


async function getPackings() {
  try {
    const result = await fetchJSON(`${API_BASE}/packings`);
    console.log("Packings:", result);
    return result; // [{id, nombre}]
  } catch (error) {
    console.error("Error getPackings:", error);
    return [];
  }
}


async function getVariedades({
  temporada_anio = null,
  packing_id = null,
  tunel_id = null
} = {}) {

  const params = new URLSearchParams();

  if (temporada_anio !== null) params.append("temporada_anio", temporada_anio);
  if (packing_id !== null) params.append("packing_id", packing_id);
  if (tunel_id !== null) params.append("tunel_id", tunel_id);

  const url = `${API_BASE}/variedad?${params.toString()}`;

  try {
    const result = await fetchJSON(url);
    console.log("Variedades:", result);
    return result; // [{id, name}]
  } catch (error) {
    console.error("Error getVariedades:", error);
    return [];
  }
}


async function wraperGetProcesos({
  started_from = null,
  started_to = null,
  temporada_anio = null,
  packing_id = null,
  epoca = null,
  limit = 50,
  offset = 0
} = {}) {

  const result = await getProcesos(started_from,started_to,temporada_anio,packing_id,epoca,limit,offset);
  
  
}