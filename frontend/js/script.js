  document.addEventListener('DOMContentLoaded', function () {
    const elems = document.querySelectorAll('.datepicker');
    M.Datepicker.init(elems, {
      format: 'yyyy-mm-dd',
      autoClose: true,
      firstDay: 1,
      showClearBtn: true,
      i18n: {
        cancel: 'Cancelar',
        clear: 'Limpiar',
        done: 'OK',
        months: [
          'Enero','Febrero','Marzo','Abril','Mayo','Junio',
          'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
        ],
        monthsShort: [
          'Ene','Feb','Mar','Abr','May','Jun',
          'Jul','Ago','Sep','Oct','Nov','Dic'
        ],
        weekdays: [
          'Domingo','Lunes','Martes','Miércoles',
          'Jueves','Viernes','Sábado'
        ],
        weekdaysShort: ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'],
        weekdaysAbbrev: ['D','L','M','M','J','V','S']
      }
    });
  });