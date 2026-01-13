async function getDataTuneles(started_from, started_to, temporada_anio, limit, offset){

    const url = `http://127.0.0.1:8000/procesos?temporada_anio=${temporada_anio}&limit=${limit}&offset=${offset}`;
    try{
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Error en la solicitud');
        }

        const result = await response.json();
        console.log(result);
    } catch (error) {
        console.error('Error:', error);
    }
} 

async function getTemporadas(){
    const url = `http://127.0.0.1:8000/temporadas`;
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

async function getPackings(temporada, fruta){
    const url = `http://127.0.0.1:8000/packings?temporada=${temporada}&fruta=${fruta}`;
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