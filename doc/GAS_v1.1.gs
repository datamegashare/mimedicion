// ============================================================
//  Mi Medición — GAS_v1.gs
//  Backend Google Apps Script
//  Versión: v1.0
//  Fecha:   2026-05-24
// ============================================================
//  Historial de versiones
//  v1.0  2026-05-24  Versión inicial. Actions: ping, verificarEmail,
//                    getElementos, getRegistros, getDashboard,
//                    guardarRegistro, editarRegistro, guardarElemento.
//                    Menú en Sheet: configurar, ver registros,
//                    agregar email, sobre la app.
// ============================================================

/* ── Constantes de hojas ──────────────────────────────────── */
const SHEET_REGISTROS  = 'Registros';
const SHEET_ELEMENTOS  = 'Elementos';
const SHEET_CONFIG     = 'Config';
const VERSION_GAS      = 'v1.0';

/* ── Cabeceras esperadas ──────────────────────────────────── */
const HDR_REGISTROS = ['ID','Email','Fecha','Hora','ElementoID','ElementoNombre','Medicion','Valor','Nota'];
const HDR_ELEMENTOS = ['ID','Nombre','Unidad','FlagMedicion','FlagDashboard','Activo'];
const HDR_CONFIG    = ['Clave','Valor'];

// ============================================================
//  ENTRY POINT — doGet / doPost
// ============================================================

function doGet(e) {
  return _handle(e);
}

function doPost(e) {
  return _handle(e);
}

function _handle(e) {
  const cors = {
    'Access-Control-Allow-Origin' : '*',
    'Access-Control-Allow-Methods': 'GET, POST',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  try {
    const params = _parseParams(e);
    const action  = params.action || '';

    // Acciones sin autenticación
    if (action === 'ping') return _ok({ pong: true, version: VERSION_GAS }, cors);

    // Todas las demás requieren email válido
    const email = (params.email || '').trim().toLowerCase();
    if (!email) return _err('Email requerido.', cors);

    const autenticado = _emailAutorizado(email);
    if (!autenticado) return _err('Email no autorizado: ' + email, cors);

    switch (action) {
      case 'verificarEmail':   return _ok({ autorizado: true, email }, cors);
      case 'getElementos':     return _getElementos(email, cors);
      case 'getRegistros':     return _getRegistros(params, cors);
      case 'getDashboard':     return _getDashboard(params, cors);
      case 'guardarRegistro':  return _guardarRegistro(params, cors);
      case 'editarRegistro':   return _editarRegistro(params, cors);
      case 'guardarElemento':  return _guardarElemento(params, cors);
      default:
        return _err('Acción desconocida: ' + action, cors);
    }
  } catch (err) {
    return _err('Error interno: ' + err.message, cors);
  }
}

// ============================================================
//  ACTIONS
// ============================================================

/* ── getElementos ─────────────────────────────────────────── */
function _getElementos(email, cors) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = _getOrCreateSheet(ss, SHEET_ELEMENTOS, HDR_ELEMENTOS);
  const rows  = _sheetToObjects(sheet);
  const activos = rows.filter(r => _bool(r.Activo));
  return _ok({ elementos: activos }, cors);
}

/* ── getRegistros ─────────────────────────────────────────── */
function _getRegistros(params, cors) {
  const email      = params.email;
  const elementoID = params.elementoID || null;
  const limit      = parseInt(params.limit) || 20;

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = _getOrCreateSheet(ss, SHEET_REGISTROS, HDR_REGISTROS);
  const rows  = _sheetToObjects(sheet);

  // Filtrar por email del usuario
  let filtrados = rows.filter(r => (r.Email || '').toLowerCase() === email.toLowerCase());

  // Filtrar por elemento si se pide
  if (elementoID) {
    filtrados = filtrados.filter(r => r.ElementoID === elementoID);
  }

  // Ordenar por fecha+hora descendente
  filtrados.sort((a, b) => {
    const da = new Date((a.Fecha || '') + 'T' + (a.Hora || '00:00'));
    const db = new Date((b.Fecha || '') + 'T' + (b.Hora || '00:00'));
    return db - da;
  });

  const resultado = filtrados.slice(0, limit).map(r => ({
    id            : r.ID,
    fecha         : r.Fecha,
    hora          : r.Hora,
    elementoID    : r.ElementoID,
    elementoNombre: r.ElementoNombre,
    medicion      : r.Medicion !== '' ? Number(r.Medicion) : null,
    valor         : r.Valor   !== '' ? Number(r.Valor)    : 0,
    nota          : r.Nota || ''
  }));

  return _ok({ registros: resultado }, cors);
}

/* ── getDashboard ─────────────────────────────────────────── */
function _getDashboard(params, cors) {
  const email      = params.email;
  const elementoID = params.elementoID;

  if (!elementoID) return _err('elementoID requerido para dashboard.', cors);

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = _getOrCreateSheet(ss, SHEET_REGISTROS, HDR_REGISTROS);
  const rows  = _sheetToObjects(sheet);

  const registros = rows
    .filter(r =>
      (r.Email || '').toLowerCase() === email.toLowerCase() &&
      r.ElementoID === elementoID
    )
    .map(r => ({
      id      : r.ID,
      fecha   : r.Fecha,
      hora    : r.Hora,
      medicion: r.Medicion !== '' ? Number(r.Medicion) : null,
      valor   : r.Valor    !== '' ? Number(r.Valor)    : 0,
      nota    : r.Nota || ''
    }))
    .sort((a, b) => {
      const da = new Date((a.fecha || '') + 'T' + (a.hora || '00:00'));
      const db = new Date((b.fecha || '') + 'T' + (b.hora || '00:00'));
      return db - da;
    });

  if (registros.length === 0) {
    return _ok({
      elementoID,
      totalRegistros : 0,
      ultimaFecha    : null,
      diasDesdeUltimo: null,
      frecuenciaPromedio: null,
      costoPromedio  : null,
      costoTotal     : null,
      historial      : []
    }, cors);
  }

  // Cálculos
  const hoy         = new Date();
  const ultimaFecha = new Date(registros[0].fecha + 'T12:00:00');
  const diasDesdeUltimo = Math.floor((hoy - ultimaFecha) / (1000 * 60 * 60 * 24));

  // Frecuencia promedio entre recambios (días)
  let frecuenciaPromedio = null;
  if (registros.length >= 2) {
    let sumaDias = 0;
    for (let i = 0; i < registros.length - 1; i++) {
      const d1 = new Date(registros[i].fecha   + 'T12:00:00');
      const d2 = new Date(registros[i+1].fecha + 'T12:00:00');
      sumaDias += Math.abs(d1 - d2) / (1000 * 60 * 60 * 24);
    }
    frecuenciaPromedio = Math.round(sumaDias / (registros.length - 1));
  }

  // Costos
  const valores = registros.map(r => r.valor).filter(v => v > 0);
  const costoTotal   = valores.reduce((s, v) => s + v, 0);
  const costoPromedio = valores.length > 0 ? Math.round(costoTotal / valores.length) : null;

  // Historial para gráfico — últimos 3 registros, orden cronológico
  const historial = registros.slice(0, 3).reverse().map(r => ({
    fecha   : r.fecha,
    medicion: r.medicion,
    valor   : r.valor
  }));

  return _ok({
    elementoID,
    totalRegistros    : registros.length,
    ultimaFecha       : registros[0].fecha,
    ultimaHora        : registros[0].hora,
    diasDesdeUltimo,
    frecuenciaPromedio,
    costoPromedio,
    costoTotal,
    historial,
    ultimoRegistro    : registros[0]
  }, cors);
}

/* ── guardarRegistro ──────────────────────────────────────── */
function _guardarRegistro(params, cors) {
  const email   = params.email;
  const fecha   = (params.fecha   || '').trim();
  const hora    = (params.hora    || '00:00').trim();
  const elemID  = (params.elementoID || '').trim();
  const medicion = params.medicion !== undefined && params.medicion !== '' ? parseInt(params.medicion) : '';
  const valor   = params.valor !== undefined ? parseFloat(params.valor) : 0;
  const nota    = (params.nota    || '').trim();

  if (!fecha)   return _err('Fecha requerida.',   cors);
  if (!elemID)  return _err('Elemento requerido.', cors);

  // Validar fecha no futura
  const hoy      = new Date(); hoy.setHours(23, 59, 59, 999);
  const fechaObj = new Date(fecha + 'T12:00:00');
  if (fechaObj > hoy) return _err('No se permiten fechas futuras.', cors);

  // Obtener nombre del elemento
  const ss       = SpreadsheetApp.getActiveSpreadsheet();
  const sheetElem = _getOrCreateSheet(ss, SHEET_ELEMENTOS, HDR_ELEMENTOS);
  const elementos = _sheetToObjects(sheetElem);
  const elem      = elementos.find(e => e.ID === elemID);
  if (!elem) return _err('Elemento no encontrado: ' + elemID, cors);

  // Generar ID único
  const id = 'reg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

  const sheetReg = _getOrCreateSheet(ss, SHEET_REGISTROS, HDR_REGISTROS);
  sheetReg.appendRow([id, email, fecha, hora, elemID, elem.Nombre, medicion, valor, nota]);

  return _ok({ id, guardado: true }, cors);
}

/* ── editarRegistro ───────────────────────────────────────── */
function _editarRegistro(params, cors) {
  const email    = params.email;
  const id       = (params.id || '').trim();
  const fecha    = (params.fecha   || '').trim();
  const hora     = (params.hora    || '00:00').trim();
  const medicion = params.medicion !== undefined && params.medicion !== '' ? parseInt(params.medicion) : '';
  const valor    = params.valor !== undefined ? parseFloat(params.valor) : 0;
  const nota     = (params.nota    || '').trim();

  if (!id) return _err('ID de registro requerido.', cors);

  // Validar fecha no futura
  if (fecha) {
    const hoy      = new Date(); hoy.setHours(23, 59, 59, 999);
    const fechaObj = new Date(fecha + 'T12:00:00');
    if (fechaObj > hoy) return _err('No se permiten fechas futuras.', cors);
  }

  const ss       = SpreadsheetApp.getActiveSpreadsheet();
  const sheetReg = _getOrCreateSheet(ss, SHEET_REGISTROS, HDR_REGISTROS);
  const data     = sheetReg.getDataRange().getValues();
  const headers  = data[0];
  const colIdx   = {}; headers.forEach((h, i) => colIdx[h] = i);

  for (let i = 1; i < data.length; i++) {
    if (data[i][colIdx['ID']] === id) {
      // Verificar que el registro pertenece al usuario
      if ((data[i][colIdx['Email']] || '').toLowerCase() !== email.toLowerCase()) {
        return _err('No tenés permiso para editar este registro.', cors);
      }
      if (fecha)             sheetReg.getRange(i+1, colIdx['Fecha']    +1).setValue(fecha);
      if (hora)              sheetReg.getRange(i+1, colIdx['Hora']     +1).setValue(hora);
      if (medicion !== '')   sheetReg.getRange(i+1, colIdx['Medicion'] +1).setValue(medicion);
                             sheetReg.getRange(i+1, colIdx['Valor']    +1).setValue(valor);
                             sheetReg.getRange(i+1, colIdx['Nota']     +1).setValue(nota);
      return _ok({ id, editado: true }, cors);
    }
  }
  return _err('Registro no encontrado: ' + id, cors);
}

/* ── guardarElemento ──────────────────────────────────────── */
function _guardarElemento(params, cors) {
  const id            = (params.id      || '').trim();
  const nombre        = (params.nombre  || '').trim();
  const unidad        = (params.unidad  || '').trim();
  const flagMedicion  = params.flagMedicion  === 'true' || params.flagMedicion  === true;
  const flagDashboard = params.flagDashboard === 'true' || params.flagDashboard === true;
  const activo        = params.activo === undefined ? true : (params.activo === 'true' || params.activo === true);

  if (!nombre) return _err('Nombre del elemento requerido.', cors);

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = _getOrCreateSheet(ss, SHEET_ELEMENTOS, HDR_ELEMENTOS);
  const data  = sheet.getDataRange().getValues();
  const headers = data[0];
  const colIdx  = {}; headers.forEach((h, i) => colIdx[h] = i);

  // Editar si viene ID y existe
  if (id) {
    for (let i = 1; i < data.length; i++) {
      if (data[i][colIdx['ID']] === id) {
        sheet.getRange(i+1, colIdx['Nombre']       +1).setValue(nombre);
        sheet.getRange(i+1, colIdx['Unidad']        +1).setValue(unidad);
        sheet.getRange(i+1, colIdx['FlagMedicion']  +1).setValue(flagMedicion);
        sheet.getRange(i+1, colIdx['FlagDashboard'] +1).setValue(flagDashboard);
        sheet.getRange(i+1, colIdx['Activo']        +1).setValue(activo);
        return _ok({ id, guardado: true, nuevo: false }, cors);
      }
    }
  }

  // Crear nuevo
  const nuevoId = 'elem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
  sheet.appendRow([nuevoId, nombre, unidad, flagMedicion, flagDashboard, activo]);
  return _ok({ id: nuevoId, guardado: true, nuevo: true }, cors);
}

// ============================================================
//  MENÚ EN SHEET
// ============================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚙ Mi Medición')
    .addItem('📋 Configurar Elementos',  'menuConfigurarElementos')
    .addItem('📊 Ver Registros',         'menuVerRegistros')
    .addSeparator()
    .addItem('✉ Agregar Email autorizado', 'menuAgregarEmail')
    .addItem('🗑 Quitar Email autorizado',  'menuQuitarEmail')
    .addSeparator()
    .addItem('ℹ Sobre esta app',          'menuSobreApp')
    .addToUi();
}

function menuConfigurarElementos() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = _getOrCreateSheet(ss, SHEET_ELEMENTOS, HDR_ELEMENTOS);
  ss.setActiveSheet(sheet);
  SpreadsheetApp.getUi().alert(
    'Hoja Elementos',
    'Editá directamente las filas.\n\n' +
    'Columnas:\n' +
    '• ID         — no modificar (auto-generado)\n' +
    '• Nombre     — nombre visible en la app\n' +
    '• Unidad     — ej: km, litros, kg, años\n' +
    '• FlagMedicion  — TRUE/FALSE (pide medición al registrar)\n' +
    '• FlagDashboard — TRUE/FALSE (aparece en dashboard)\n' +
    '• Activo     — TRUE/FALSE (visible en la app)\n\n' +
    'Para agregar un elemento nuevo usá la app o agregá una fila con ID único.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function menuVerRegistros() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = _getOrCreateSheet(ss, SHEET_REGISTROS, HDR_REGISTROS);
  ss.setActiveSheet(sheet);
}

function menuAgregarEmail() {
  const ui       = SpreadsheetApp.getUi();
  const respuesta = ui.prompt(
    '✉ Agregar Email autorizado',
    'Ingresá el email de Google a autorizar:',
    ui.ButtonSet.OK_CANCEL
  );
  if (respuesta.getSelectedButton() !== ui.Button.OK) return;

  const email = (respuesta.getResponseText() || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    ui.alert('Email inválido.');
    return;
  }

  const ss     = SpreadsheetApp.getActiveSpreadsheet();
  const sheet  = _getOrCreateSheet(ss, SHEET_CONFIG, HDR_CONFIG);
  const emails = _getConfig(sheet, 'EMAILS_AUTORIZADOS');
  const lista  = emails ? emails.split(',').map(e => e.trim()).filter(Boolean) : [];

  if (lista.includes(email)) {
    ui.alert('El email ' + email + ' ya está autorizado.');
    return;
  }

  lista.push(email);
  _setConfig(sheet, 'EMAILS_AUTORIZADOS', lista.join(','));
  ui.alert('✅ Email autorizado: ' + email);
}

function menuQuitarEmail() {
  const ui       = SpreadsheetApp.getUi();
  const respuesta = ui.prompt(
    '🗑 Quitar Email autorizado',
    'Ingresá el email a quitar:',
    ui.ButtonSet.OK_CANCEL
  );
  if (respuesta.getSelectedButton() !== ui.Button.OK) return;

  const email = (respuesta.getResponseText() || '').trim().toLowerCase();
  if (!email) return;

  const ss     = SpreadsheetApp.getActiveSpreadsheet();
  const sheet  = _getOrCreateSheet(ss, SHEET_CONFIG, HDR_CONFIG);
  const emails = _getConfig(sheet, 'EMAILS_AUTORIZADOS');
  const lista  = emails ? emails.split(',').map(e => e.trim()).filter(Boolean) : [];
  const nueva  = lista.filter(e => e !== email);

  if (nueva.length === lista.length) {
    ui.alert('Email no encontrado en la lista: ' + email);
    return;
  }

  _setConfig(sheet, 'EMAILS_AUTORIZADOS', nueva.join(','));
  ui.alert('✅ Email quitado: ' + email);
}

function menuSobreApp() {
  const ss     = SpreadsheetApp.getActiveSpreadsheet();
  const sheet  = _getOrCreateSheet(ss, SHEET_CONFIG, HDR_CONFIG);
  const emails = _getConfig(sheet, 'EMAILS_AUTORIZADOS') || '(ninguno)';
  const url    = _getConfig(sheet, 'APP_URL') || 'https://datamegashare.github.io/mimedicion/';

  SpreadsheetApp.getUi().alert(
    'ℹ Mi Medición',
    'Versión GAS : ' + VERSION_GAS + '\n' +
    'App URL     : ' + url         + '\n\n' +
    'Emails autorizados:\n' + emails.split(',').join('\n'),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

// ============================================================
//  SETUP — crear hojas y config inicial
// ============================================================

function setupInicial() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sheetElem = _getOrCreateSheet(ss, SHEET_ELEMENTOS, HDR_ELEMENTOS);
  const sheetReg  = _getOrCreateSheet(ss, SHEET_REGISTROS, HDR_REGISTROS);
  const sheetCfg  = _getOrCreateSheet(ss, SHEET_CONFIG,    HDR_CONFIG);

  // Config por defecto
  _setConfigIfEmpty(sheetCfg, 'APP_NAME',            'Mi Medición');
  _setConfigIfEmpty(sheetCfg, 'VERSION_GAS',          VERSION_GAS);
  _setConfigIfEmpty(sheetCfg, 'EMAILS_AUTORIZADOS',   '');
  _setConfigIfEmpty(sheetCfg, 'APP_URL',              'https://datamegashare.github.io/mimedicion/');

  // Elementos de ejemplo si la hoja está vacía
  const filas = sheetElem.getLastRow();
  if (filas <= 1) {
    const ejemplos = [
      ['elem_001', 'Garrafa de gas',   'recambio', false, true,  true],
      ['elem_002', 'Cambio de aceite', 'km',        true,  true,  true],
      ['elem_003', 'Jardín / poda',    'sesión',   false, false, true],
      ['elem_004', 'Filtro de agua',   'meses',    false, true,  true],
    ];
    ejemplos.forEach(r => sheetElem.appendRow(r));
  }

  SpreadsheetApp.getUi().alert(
    '✅ Setup completado',
    'Hojas creadas: Registros, Elementos, Config.\n' +
    'Agregá tu email desde Menú → ✉ Agregar Email autorizado.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

// ============================================================
//  HELPERS — Sheet
// ============================================================

function _getOrCreateSheet(ss, nombre, headers) {
  let sheet = ss.getSheetByName(nombre);
  if (!sheet) {
    sheet = ss.insertSheet(nombre);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#0f172a')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function _sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      let val = row[i];
      if (val instanceof Date) {
        // Columna Hora → extraer HH:MM (Sheets guarda horas como fecha 1899-12-30 + fracción)
        if (h === 'Hora') {
          val = String(val.getHours()).padStart(2,'0') + ':' +
                String(val.getMinutes()).padStart(2,'0');
        } else {
          // Columna Fecha y cualquier otra → YYYY-MM-DD
          const y = val.getFullYear();
          const m = String(val.getMonth()+1).padStart(2,'0');
          const d = String(val.getDate()).padStart(2,'0');
          val = y + '-' + m + '-' + d;
        }
      }
      obj[h] = val === null || val === undefined ? '' : val;
    });
    return obj;
  });
}

function _bool(val) {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string')  return val.toUpperCase() === 'TRUE';
  return !!val;
}

// ============================================================
//  HELPERS — Config
// ============================================================

function _getConfig(sheet, clave) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === clave) return String(data[i][1] || '');
  }
  return null;
}

function _setConfig(sheet, clave, valor) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === clave) {
      sheet.getRange(i+1, 2).setValue(valor);
      return;
    }
  }
  sheet.appendRow([clave, valor]);
}

function _setConfigIfEmpty(sheet, clave, valor) {
  const actual = _getConfig(sheet, clave);
  if (actual === null) _setConfig(sheet, clave, valor);
}

// ============================================================
//  HELPERS — Auth
// ============================================================

function _emailAutorizado(email) {
  const ss     = SpreadsheetApp.getActiveSpreadsheet();
  const sheet  = _getOrCreateSheet(ss, SHEET_CONFIG, HDR_CONFIG);
  const emails = _getConfig(sheet, 'EMAILS_AUTORIZADOS') || '';
  const lista  = emails.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  return lista.includes(email.toLowerCase());
}

// ============================================================
//  HELPERS — Parámetros
// ============================================================

function _parseParams(e) {
  // Primero intenta leer del body (POST con JSON)
  if (e && e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch(_) {}
  }
  // Fallback: query string (GET o POST form)
  if (e && e.parameter) return e.parameter;
  return {};
}

// ============================================================
//  HELPERS — Respuestas
// ============================================================

function _ok(data, cors) {
  const payload = JSON.stringify({ ok: true, data });
  return ContentService
    .createTextOutput(payload)
    .setMimeType(ContentService.MimeType.JSON);
}

function _err(msg, cors) {
  const payload = JSON.stringify({ ok: false, error: msg });
  return ContentService
    .createTextOutput(payload)
    .setMimeType(ContentService.MimeType.JSON);
}
