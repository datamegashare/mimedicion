# HANDOFF — Mi Medición
**Versión:** v1.1  
**Fecha:** 2026-05-24  
**Autor:** Ale (datamegashare)  
**Estado:** ✅ Deployado y funcionando en producción  

---

## 1. Descripción del proyecto

PWA para registrar recambios y consumos domésticos/personales. Permite conocer estadísticas de duración, precio y rendimiento de elementos recurrentes (garrafa de gas, cambio de aceite, reparaciones, jardinería, etc.). Algunos elementos tienen un valor de medición numérico acumulativo (tipo odómetro).

---

## 2. Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | HTML5 + CSS3 + JS vanilla (SPA/PWA) |
| Backend | Google Apps Script (GAS) |
| Base de datos | Google Sheets |
| Hosting | GitHub Pages (`datamegashare.github.io/mimedicion/`) |
| Autenticación | Google Identity Services (GSI) |
| Persistencia local | localStorage |

**Repositorio:** `github.com/datamegashare/mimedicion`  
**Sheet ID:** `1TtzMID2vttlOXVlg7UszB11UF1ZYpr8X-T0B7DfSrik`  
**GAS URL:** `https://script.google.com/macros/s/AKfycbzRcQECvOb9-BkJTXhsW8MGhd3ltliDDJIrQ6Bt7KtTmJII8AeR6xt6Ygy7nMZgJM_E3g/exec`  
**GCP Proyecto:** `dms-inventario-app`  
**OAuth Client ID:** `985022387906-5h3qtmq6jifdl5jdv77o4amf9nb3mcdn.apps.googleusercontent.com`  
**URL producción:** `https://datamegashare.github.io/mimedicion/`

---

## 3. Archivos del proyecto

| Archivo | Versión | Estado | Descripción |
|---------|---------|--------|-------------|
| `index_mm_v1.html` | v1.0 | ✅ Producción | SPA principal — login, app, tabs, formularios |
| `sw_v1.js` | v1.0 | ✅ Producción | Service Worker — caché PWA |
| `manifest.json` | v1.0 | ✅ Producción | Manifiesto PWA — nombre, íconos, colores |
| `icon-192.png` | v1.0 | ✅ Producción | Ícono PWA 192×192 |
| `icon-512.png` | v1.0 | ✅ Producción | Ícono PWA 512×512 |
| `icon_mimedicion.svg` | v1.0 | ✅ Producción | Ícono fuente vectorial |
| `GAS_v1.gs` | v1.1 | ✅ Producción | Backend Google Apps Script |

> **Nota de nombre:** el archivo HTML en producción se renombró a `index_mm_v1.html` para diferenciar del index raíz del repo.

---

## 4. Estructura del Google Sheet

**Sheet ID:** `1TtzMID2vttlOXVlg7UszB11UF1ZYpr8X-T0B7DfSrik`

### Hoja: `Elementos`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| ID | string | Identificador único — formato `elem_XXXXXXXXXX_XXXX` (auto-generado por GAS) |
| Nombre | string | Nombre visible del elemento |
| Unidad | string | Unidad de medición (km, litros, kg, recambio, etc.) |
| FlagMedicion | boolean | TRUE = pide campo medición al registrar |
| FlagDashboard | boolean | TRUE = aparece en Dashboard |
| Activo | boolean | TRUE = visible en la app |

> ⚠ **Importante:** NO cargar elementos directo en el Sheet sin ID. Siempre usar el panel Elementos de la app para que el GAS genere el ID correctamente. Si se cargan manualmente, la columna ID debe tener formato `elem_XXX` — nunca dejar vacío ni poner número de fila.

### Hoja: `Registros`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| ID | string | ID único del registro — formato `reg_TIMESTAMP_XXXXX` |
| Email | string | Email del usuario |
| Fecha | date | Fecha del recambio (YYYY-MM-DD) |
| Hora | string | Hora del recambio (HH:MM) |
| ElementoID | string | FK → Elementos.ID |
| ElementoNombre | string | Nombre desnormalizado |
| Medicion | number | Valor numérico entero. Vacío si FlagMedicion = FALSE |
| Valor | number | Precio pagado en pesos argentinos |
| Nota | string | Texto libre opcional |

### Hoja: `Config`
| Clave | Valor actual |
|-------|-------------|
| APP_NAME | Mi Medición |
| VERSION_GAS | v1.0 |
| EMAILS_AUTORIZADOS | alejandro.perin@gmail.com |
| APP_URL | https://datamegashare.github.io/mimedicion/ |

---

## 5. Menú GAS en el Sheet

Menú: **⚙ Mi Medición**
- `📋 Configurar Elementos` → navega a hoja Elementos + instrucciones
- `📊 Ver Registros` → navega a hoja Registros
- `✉ Agregar Email autorizado` → popup input para whitelist
- `🗑 Quitar Email autorizado` → popup para remover de whitelist
- `ℹ Sobre esta app` → muestra versión GAS, URL y emails autorizados

---

## 6. Diseño visual

### Tokens de diseño
```css
--bg        : #f1f5f9
--surface   : #ffffff
--border    : #e2e8f0
--accent    : #0ea5e9   /* azul agua */
--accent-dk : #0284c7
--accent-lt : #e0f2fe
--accent2   : #0f172a   /* header oscuro */
--text      : #1e293b
--muted     : #64748b
--success   : #16a34a
--warning   : #d97706
--danger    : #dc2626
--radius    : 12px
--radius-sm : 8px
--radius-lg : 16px
```

### Fuentes
- Títulos / logo: `Bebas Neue`
- Cuerpo: `DM Sans`
- Números / datos: `DM Mono`

---

## 7. Arquitectura de pantallas

### Desktop (>720px)
Tres paneles lado a lado con resizer drag:
```
┌──────────────┬─┬──────────────┬─┬──────────────┐
│  Registros   │ │  Dashboard   │ │  Elementos   │
│  (38%)       │ │  (flex)      │ │  (26%)       │
└──────────────┴─┴──────────────┴─┴──────────────┘
```

### Mobile (≤720px)
Tab bar inferior con 3 pestañas:
- `📋 Registros` — activa por defecto
- `📊 Dashboard`
- `⚙️ Elementos`

---

## 8. Comportamiento por pantalla

### Panel Registros
- Lista de elementos con último estado: nombre, fecha relativa, última medición (si aplica), último valor
- Al tocar fila → **drawer lateral** desliza desde derecha:
  - Último valor de referencia (medición)
  - Mini gráfico SVG línea de tiempo (últimos 3 registros)
  - Historial últimos 5 registros
  - Botón `✏ Editar último` + botón `＋ Nuevo registro`
- **FAB "+"** fijo abajo-derecha → formulario con elemento vacío

### Panel Dashboard
- Selector dropdown → solo elementos con `FlagDashboard = TRUE`
- Cards expandibles/colapsables:
  - 📅 Último recambio (fecha + días desde)
  - 🔁 Frecuencia (promedio días entre recambios)
  - 💰 Costo (promedio y total acumulado)
  - 📈 Historial (gráfico SVG últimos 3 registros)

### Panel Elementos
- Lista ABM con flags MED / DASH visibles
- Botón `+ Nuevo` en header del panel
- Al tocar → modal con toggles: FlagMedicion, FlagDashboard, Activo

### Formulario Registro
1. Elemento — `<select>` (pre-seleccionado si viene del drawer)
2. Fecha — date picker, `max = hoy`, sin fechas futuras
3. Hora — time picker nativo, valor por defecto = hora actual (pasos 30 min)
4. Medición — solo si `FlagMedicion = TRUE`, muestra referencia "Último: X unidad"
5. Valor ($) — número en pesos
6. Nota — textarea opcional, max 200 chars

---

## 9. GAS — Acciones API

| Action | Descripción | Parámetros clave |
|--------|-------------|-----------------|
| `ping` | Keep-alive | — |
| `verificarEmail` | Valida whitelist | `email` |
| `getElementos` | Lista elementos activos | `email` |
| `getRegistros` | Registros por usuario/elemento | `email`, `elementoID?`, `limit?` |
| `getDashboard` | Stats calculadas para un elemento | `email`, `elementoID` |
| `guardarRegistro` | Inserta nuevo registro | `email`, `fecha`, `hora`, `elementoID`, `medicion?`, `valor`, `nota?` |
| `editarRegistro` | Modifica registro por ID | `email`, `id`, `...campos` |
| `guardarElemento` | Crea o edita elemento | `email`, `id?`, `nombre`, `unidad`, `flagMedicion`, `flagDashboard`, `activo` |

**Patrón de respuesta:**
```json
{ "ok": true,  "data": { ... } }
{ "ok": false, "error": "Mensaje legible" }
```

**Keep-alive:** ping automático cada 4 minutos desde el frontend.

---

## 10. PWA

| Parámetro | Valor |
|-----------|-------|
| Cache key | `mimedicion-v1.0` |
| Theme color | `#0f172a` |
| Display | `standalone` |
| SW estrategia assets | Cache-first |
| SW estrategia GAS | Network-first |
| SW fallback offline | Devuelve `index_mm_v1.html` |
| Mensaje SKIP_WAITING | Botón "Actualizar" en header |

---

## 11. Persistencia local (localStorage)

| Clave | Contenido |
|-------|-----------|
| `mm_usuario` | `{ email, name, picture, token }` |
| `mm_elementos` | Cache de elementos |
| `mm_last_sync` | Timestamp última sincronización |

---

## 12. OAuth / GCP

| Parámetro | Valor |
|-----------|-------|
| Proyecto GCP | `dms-inventario-app` |
| OAuth Client ID | `985022387906-5h3qtmq6jifdl5jdv77o4amf9nb3mcdn.apps.googleusercontent.com` |
| JS Origins autorizados | `https://datamegashare.github.io` |
| Redirect URIs | `https://datamegashare.github.io/mimedicion/` |
| Tipo de flujo | GSI credential callback (sin redirect) |

---

## 13. Convenciones de versioning

| Archivo | Versión en nombre | Versión visible |
|---------|------------------|--------------------|
| `index_mm_vX.html` | En filename | Header app + login screen |
| `sw_vX.js` | En filename + cache key | — |
| `GAS_vX.gs` | En filename + hoja Config | — |

**Semver simplificado:** `vMAJOR.MINOR`
- MINOR (+0.1): fixes, ajustes visuales, correcciones de datos
- MAJOR (+1.0): cambios estructurales de pantallas, Sheet o GAS

---

## 14. Historial de versiones

| Versión | Fecha | Archivo | Descripción |
|---------|-------|---------|-------------|
| v1.0 | 2026-05-24 | Todos | Diseño aprobado. Arquitectura, pantallas, Sheet, GAS definidos. |
| v1.0 | 2026-05-24 | `GAS_v1.gs` | Versión inicial deployada. Actions completas. setupInicial(). Menú Sheet. |
| v1.0 | 2026-05-24 | `index_mm_v1.html` | SPA completa deployada. Login GSI, 3 paneles/tabs, drawer, dashboard, formulario. |
| v1.1 | 2026-05-24 | `GAS_v1.gs` | Fix: `_sheetToObjects` — columna Hora se leía como fecha `1899-12-30`. Ahora extrae `HH:MM` correctamente. |

---

## 15. Bugs resueltos

| # | Síntoma | Causa | Fix |
|---|---------|-------|-----|
| 1 | "Elemento no encontrado: 1" al guardar registro | Columna ID de Elementos tenía número de fila en lugar de `elem_XXX` | Corregir IDs en Sheet manualmente. En adelante solo agregar desde la app. |
| 2 | Dashboard mostraba hora `1899-12-30` | `_sheetToObjects` convertía celdas de tipo Hora como fecha completa | Fix en GAS v1.1: detectar columna `Hora` y extraer `HH:MM` |
| 3 | Error `thttps://` — URL scheme not supported | Al pegar la GAS URL quedó `T` mayúscula adelante | Corregir manualmente a `https://` en `index_mm_v1.html` |

---

## 16. Pendientes y decisiones futuras

- [ ] Validar que al editar un registro, el elemento esté bloqueado (no editable) en el formulario
- [ ] Mostrar cantidad total de registros en la lista principal (badge)
- [ ] Export CSV de registros por elemento
- [ ] Notificaciones push: recordatorio de recambio vencido (candidato v2)
- [ ] Modo offline completo: queue de registros pendientes en localStorage (candidato v2)
- [ ] Multi-usuario en mismo Sheet (candidato v2)
- [ ] Moneda configurable: hoy hardcoded ARS (candidato v1.x)
- [ ] Gráfico con más de 3 puntos en el historial (configurable por elemento)

---

## 17. Prompt de continuación (copy-paste para próxima sesión)

```
Proyecto: Mi Medición (mimedicion)
Handoff: HANDOFF_mimedicion_v1.1.md (estado actual)
Stack: HTML SPA/PWA + GAS + Google Sheets + GitHub Pages (datamegashare)
UX base: Mesa de Trabajo

Datos de producción:
- URL: https://datamegashare.github.io/mimedicion/
- Sheet ID: 1TtzMID2vttlOXVlg7UszB11UF1ZYpr8X-T0B7DfSrik
- GAS URL: https://script.google.com/macros/s/AKfycbzRcQECvOb9-BkJTXhsW8MGhd3ltliDDJIrQ6Bt7KtTmJII8AeR6xt6Ygy7nMZgJM_E3g/exec
- GCP: dms-inventario-app
- OAuth Client ID: 985022387906-5h3qtmq6jifdl5jdv77o4amf9nb3mcdn.apps.googleusercontent.com

Archivos actuales:
- index_mm_v1.html (v1.0) — SPA producción
- GAS_v1.gs (v1.1) — fix hora 1899-12-30
- sw_v1.js (v1.0)
- manifest.json (v1.0)

Design tokens: accent #0ea5e9, header #0f172a, fuentes Bebas Neue + DM Sans + DM Mono
Sheet hojas: Registros, Elementos, Config
GAS actions: ping, verificarEmail, getElementos, getRegistros, getDashboard,
             guardarRegistro, editarRegistro, guardarElemento

Reglas de entrega:
- Siempre archivos descargables, nunca inline
- Versión visible en login + header
- Versión en nombre de archivo
- Semáforo de sync
- Keep-alive ping cada 4 min
- Historial de versiones al final de cada entrega
```
