function actualizarWidget1(total, items) {
  document.getElementById('nProcesos').textContent = total || 0;
  
  if (!items || items.length === 0) {
    document.getElementById('tipoProceso').textContent = '-';
    return;
  }
  
  let materiaPrima = 0;
  let productoTerminado = 0;
  
  items.forEach(item => {
    const tipoCaja = item.tipo_caja || '';
    if (tipoCaja.includes('caja_5kg')) {
      materiaPrima++;
    } else {
      productoTerminado++;
    }
  });
  
  document.getElementById('tipoProceso').innerHTML = `MP: ${materiaPrima}<br>PT: ${productoTerminado}`;
}

function actualizarWidget2(items) {
  if (!items || items.length === 0) {
    document.getElementById('toneladas').textContent = '-';
    document.getElementById('tipoCaja').textContent = '-';
    return;
  }
  
  let totalToneladas = 0;
  let cajas = { caja_1kg: 0, caja_2kg: 0, caja_5kg: 0, clamshell_500g: 0 };
  
  items.forEach(item => {
    totalToneladas += item.masa_total_ton || 0;
    const tipoCaja = item.tipo_caja || '';
    if (cajas.hasOwnProperty(tipoCaja)) {
      cajas[tipoCaja]++;
    }
  });
  
  document.getElementById('toneladas').textContent = `${totalToneladas.toFixed(2)} ton`;
  document.getElementById('tipoCaja').innerHTML = 
    `<div>1kg: ${cajas.caja_1kg}</div><div>2kg: ${cajas.caja_2kg}</div><div>5kg: ${cajas.caja_5kg}</div><div>500g: ${cajas.clamshell_500g}</div>`;
}
