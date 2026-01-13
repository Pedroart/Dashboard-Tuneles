document.addEventListener("DOMContentLoaded", function () {
  const elems = document.querySelectorAll(".datepicker");
  M.Datepicker.init(elems, {
    format: "yyyy-mm-dd",
    autoClose: true,
    firstDay: 1,
    showClearBtn: true,
    i18n: {
      cancel: "Cancelar",
      clear: "Limpiar",
      done: "OK",
      months: [
        "Enero",
        "Febrero",
        "Marzo",
        "Abril",
        "Mayo",
        "Junio",
        "Julio",
        "Agosto",
        "Septiembre",
        "Octubre",
        "Noviembre",
        "Diciembre",
      ],
      monthsShort: [
        "Ene",
        "Feb",
        "Mar",
        "Abr",
        "May",
        "Jun",
        "Jul",
        "Ago",
        "Sep",
        "Oct",
        "Nov",
        "Dic",
      ],
      weekdays: [
        "Domingo",
        "Lunes",
        "Martes",
        "Miércoles",
        "Jueves",
        "Viernes",
        "Sábado",
      ],
      weekdaysShort: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
      weekdaysAbbrev: ["D", "L", "M", "M", "J", "V", "S"],
    },
  });
});

document.addEventListener("DOMContentLoaded", function () {
  var elems = document.querySelectorAll("select");
  var instances = M.FormSelect.init(elems);
  cargarPackings();
});

async function cargarPackings() {
  const packings = await getPackings();
  const select = document.getElementById('packing');
  packings.forEach(p => {
    const option = document.createElement('option');
    option.value = p;
    option.textContent = p;
    select.appendChild(option);
  });
  M.FormSelect.init(document.querySelectorAll('select'));
}

document.getElementById('packing').addEventListener('change', async function() {
  const packing = this.value;
  const temporadas = await getTemporadas(packing);
  const selectTemp = document.getElementById('temporada');
  selectTemp.innerHTML = '<option value="" disabled selected>Seleccione temporada</option>';
  temporadas.forEach(t => {
    const option = document.createElement('option');
    option.value = t;
    option.textContent = t;
    selectTemp.appendChild(option);
  });
  selectTemp.disabled = false;
  document.getElementById('fruta').disabled = true;
  document.getElementById('fruta').innerHTML = '<option value="" disabled selected>Seleccione fruta</option>';
  M.FormSelect.init(document.querySelectorAll('select'));
});

document.getElementById('temporada').addEventListener('change', async function() {
  const packing = document.getElementById('packing').value;
  const temporada = this.value;
  const frutas = await getFrutas(packing, temporada);
  const selectFruta = document.getElementById('fruta');
  selectFruta.innerHTML = '<option value="" disabled selected>Seleccione fruta</option>';
  frutas.forEach(f => {
    const option = document.createElement('option');
    option.value = f;
    option.textContent = f;
    selectFruta.appendChild(option);
  });
  selectFruta.disabled = false;
  M.FormSelect.init(document.querySelectorAll('select'));
});

async function cargarDatos() {
  const packing = document.getElementById('packing').value;
  const temporada = document.getElementById('temporada').value;
  const fruta = document.getElementById('fruta').value;
  
  if (!temporada) {
    M.toast({html: 'Seleccione al menos una temporada'});
    return;
  }
  
  const dataCount =  await wraperGetProcesos({
    packing_id: packing ? Number(packing) : null,
    temporada_anio: temporada ? Number(temporada) : null,
    epoca: fruta,
    limit: 50,
    offset: 0
  })

  console.log(dataCount)
}