const API_BASE = "http://127.0.0.1:8000";

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error ${response.status}: ${response.statusText}`);
  }
  return await response.json();
}

async function getDataTuneles(packing, temporada, fruta, limit = 50, offset = 0) {
    let url = `${API_BASE}/procesos?limit=${limit}&offset=${offset}`;
    
    if (temporada) url += `&temporada_anio=${temporada}`;
    if (fruta) url += `&epoca=${fruta}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Error en la solicitud');
        }
        const result = await response.json();
        console.log('Datos de procesos:', result);
        return result;
    } catch (error) {
        console.error('Error:', error);
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
