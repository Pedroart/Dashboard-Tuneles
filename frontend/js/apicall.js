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
  limit = 500,
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

async function getPackings(){
    const url = `${API_BASE}/packings`;
    try{
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Error en la solicitud');
        }
        const result = await response.json();
        return result;
    }
    catch (error) {
        console.error('Error:', error);
        return [];
    }
}

async function getTemporadas(packing){
    const url = `${API_BASE}/temporadas?packing=${packing}`;
    try{
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Error en la solicitud');
        }
        const result = await response.json();
        return result;
    }
    catch (error) {
        console.error('Error:', error);
        return [];
    }
}

async function getFrutas(packing, temporada){
    const url = `${API_BASE}/frutas?packing=${packing}&temporada=${temporada}`;
    try{
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Error en la solicitud');
        }
        const result = await response.json();
        return result;
    }
    catch (error) {
        console.error('Error:', error);
        return [];
    }
}


async function wraperGetProcesos({
  packing_id = null,
  started_from = null,
  started_to = null,
  temporada_anio = null,
  epoca = null,
  limit = 500,
  offset = 0
} = {}) {

  const result = await getProcesos(temporada_anio,packing_id,epoca,limit,offset);
  
  return result["total"]
  
}
