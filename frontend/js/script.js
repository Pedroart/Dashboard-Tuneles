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
        "Enero","Febrero","Marzo","Abril","Mayo","Junio",
        "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
      ],
      monthsShort: ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"],
      weekdays: ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"],
      weekdaysShort: ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"],
      weekdaysAbbrev: ["D","L","M","M","J","V","S"],
    },
  });
});

document.addEventListener("DOMContentLoaded", function () {
  const elems = document.querySelectorAll("select");
  M.FormSelect.init(elems);
  cargarPackings();
});

// Helpers para selects
function setSelectOptions(selectEl, placeholderText, items, { disabled = false } = {}) {
  selectEl.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.disabled = true;
  placeholder.selected = true;
  placeholder.textContent = placeholderText;
  selectEl.appendChild(placeholder);

  items.forEach((it) => {
    const option = document.createElement("option");
    option.value = String(it.id);
    option.textContent = it.name;
    selectEl.appendChild(option);
  });

  selectEl.disabled = disabled;
  M.FormSelect.init(document.querySelectorAll("select"));
}

function resetSelect(selectId, placeholderText, disabled = true) {
  const el = document.getElementById(selectId);
  setSelectOptions(el, placeholderText, [], { disabled });
}

async function cargarPackings() {
  const packings = await getPackings(); // -> [{id, name}]
  const select = document.getElementById("packing");

  setSelectOptions(select, "Seleccione packing", packings, { disabled: false });

  // resetea dependientes
  resetSelect("temporada", "Seleccione temporada", true);
  resetSelect("fruta", "Seleccione fruta", true);
}

document.getElementById("packing").addEventListener("change", async function () {
  const packingIdStr = this.value;
  const packing_id = packingIdStr ? Number(packingIdStr) : null;

  // reset fruta mientras carga temporada
  resetSelect("fruta", "Seleccione fruta", true);

  if (!packing_id) {
    resetSelect("temporada", "Seleccione temporada", true);
    return;
  }

  const temporadas = await getTemporadas(packing_id); // -> [{id, name}]
  const selectTemp = document.getElementById("temporada");

  setSelectOptions(selectTemp, "Seleccione temporada", temporadas, { disabled: false });
});

document.getElementById("temporada").addEventListener("change", async function () {
  const packingIdStr = document.getElementById("packing").value;
  const temporadaStr = this.value;

  const packing_id = packingIdStr ? Number(packingIdStr) : null;
  const temporada_anio = temporadaStr ? Number(temporadaStr) : null;

  if (!packing_id || !temporada_anio) {
    resetSelect("fruta", "Seleccione fruta", true);
    return;
  }

  const frutas = await getFrutas(packing_id, temporada_anio); // -> [{id, name}] (epoca)
  const selectFruta = document.getElementById("fruta");

  setSelectOptions(selectFruta, "Seleccione fruta", frutas, { disabled: false });
});

async function cargarDatos() {
  const packingIdStr = document.getElementById("packing").value;
  const temporadaStr = document.getElementById("temporada").value;
  const frutaStr = document.getElementById("fruta").value;

  const packing_id = packingIdStr ? Number(packingIdStr) : null;
  const temporada_anio = temporadaStr ? Number(temporadaStr) : null;
  const epoca = frutaStr || null; // epoca es string normalmente

  if (!temporada_anio) {
    M.toast({ html: "Seleccione al menos una temporada" });
    return;
  }

  const { total, items } = await wraperGetProcesos({
    packing_id,
    temporada_anio,
    epoca,
    limit: 500,
    offset: 0,
  });

  console.log("Total procesos:", total);
  console.log("Listado procesos:", items);

  if (total === 0) {
    M.toast({ html: "No se encontraron procesos" });
    return;
  }
}


