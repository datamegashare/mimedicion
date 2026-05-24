# HANDOFF — Mi Medición
**Versión:** v1.0  
**Fecha:** 2026-05-24  
**Autor:** Ale (datamegashare)  
**Estado:** Diseño aprobado · Pendiente desarrollo  

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
**Sheet ID:** *(a asignar al crear)*

---

## 3. Archivos del proyecto

| Archivo | Descripción |
|---------|-------------|
| `index_v1.html` | SPA principal — login, app, tabs, formularios |
| `sw_v1.js` | Service Worker — caché PWA |
| `manifest.json` | Manifiesto PWA — nombre, íconos, colores |
| `icon-192.png` | Ícono PWA 192×192 |
| `icon-512.png` | Ícono PWA 512×512 |
| `GAS_v1.gs` | Backend Google Apps Script |

---

## 4. Estructura del Google Sheet

### Hoja: `Elementos`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| ID | string | Identificador único (ej: `elem_001`) |
| Nombre | string | Nombre visible del elemento |
| Unidad | string | Unidad de medición (km, litros, años, etc.) |
| FlagMedicion | boolean | TRUE = pide campo medición al registrar |
| FlagDashboard | boolean | TRUE = aparece en Dashboard |
| Activo | boolean | TRUE = visible en la app |

### Hoja: `Registros`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| ID | string | ID único del registro (timestamp + random) |
| Email | string | Email del usuario que cargó |
| Fecha | date | Fecha del recambio (YYYY-MM-DD) |
| Hora | string | Hora del recambio (HH:MM) |
| ElementoID | string | FK → Elementos.ID |
| ElementoNombre | string | Nombre desnormalizado para consultas rápidas |
| Medicion | number | Valor numérico entero (odómetro). Vacío si FlagMedicion = FALSE |
| Valor | number | Precio pagado en pesos argentinos |
| Nota | string | Texto libre opcional |

### Hoja: `Config`
| Clave | Ejemplo de valor |
|-------|-----------------|
| APP_NAME | Mi Medición |
| EMAILS_AUTORIZADOS | ale@gmail.com,otro@gmail.com |
| VERSION_GAS | v1 |

---

## 5. Menú GAS en el Sheet

Menú: **⚙ Mi Medición**
- `Configurar Elementos` → abre sidebar para ABM de elementos
- `Ver Registros` → navega a hoja Registros
- `Agregar Email autorizado` → popup input para whitelist
- `Sobre esta app` → muestra versión GAS y URL de la app

---

## 6. Diseño visual

### Tokens de diseño
```css
--bg       : #f1f5f9
--surface  : #ffffff
--border   : #e2e8f0
--accent   : #0ea5e9   /* azul agua — diferencia de MdT */
--accent2  : #0f172a   /* header oscuro */
--text     : #1e293b
--muted    : #64748b
--success  : #16a34a
--radius   : 12px
--shadow   : 0 1px 3px rgba(0,0,0,.08)
```

### Fuentes
- Títulos / logo: `Bebas Neue`
- Cuerpo: `DM Sans`
- Números / datos: `DM Mono` (mediciones, valores)

### Ícono
Gauge/velocímetro estilizado. Aguja marcando un valor. Paleta: fondo `#0f172a`, aguja y arco `#0ea5e9`, detalles blancos. Vectorial, limpio.

---

## 7. Estructura de pantallas

### 7.1 Login screen
- Logo + ícono de la app
- Versión visible (`v1.0`)
- Botón Google Sign-In
- Solo cuentas autorizadas (whitelist en Config sheet)

### 7.2 App — Header
- Logo "MI MEDICIÓN" (Bebas Neue, accent azul)
- Nombre del usuario
- Versión (`v1.0`)
- Botón Actualizar + semáforo de sync
- Botón Instalar PWA (aparece si disponible)
- Avatar Google

### 7.3 Layout Desktop (>720px)
Tres paneles lado a lado, redimensionables con resizer drag:
```
┌──────────────┬─┬──────────────┬─┬──────────────┐
│  Registros   │ │  Dashboard   │ │  Elementos   │
│  (lista +    │ │  (cards      │ │  (ABM,       │
│   drawer)    │ │   selector)  │ │   solo admin)│
└──────────────┴─┴──────────────┴─┴──────────────┘
```

### 7.4 Layout Mobile (≤720px)
Tab bar inferior con 3 pestañas, una visible a la vez:
- `📋 Registros` — activa por defecto
- `📊 Dashboard`
- `⚙️ Elementos`

---

## 8. Comportamiento detallado por pantalla

### 8.1 Panel / Tab "Registros"

**Lista principal:**
- Una fila por elemento activo
- Muestra: nombre, fecha relativa del último registro ("hace 3 días"), última medición (si aplica), último valor ($)
- Elementos sin registros muestran "Sin registros aún"
- Spinner mientras carga desde GAS

**Al tocar una fila → Drawer lateral (desliza desde derecha):**
- Encabezado: nombre del elemento + unidad
- Historial: últimos 5 registros (fecha, hora, medición, valor, nota)
- Mini gráfico: línea de tiempo con los últimos 3 registros (eje X = fecha, eje Y = medición o valor según FlagMedicion)
- Botón `✏️ Editar último registro` → abre formulario pre-cargado con último registro
- Botón `＋ Nuevo registro` → abre formulario con elemento pre-seleccionado
- Botón cerrar (✕) o swipe derecha

**FAB "+" (fijo abajo-derecha):**
- Abre formulario con elemento vacío (usuario elige)
- Visible en todo momento en tab Registros

### 8.2 Panel / Tab "Dashboard"

- Selector dropdown en header del panel: solo elementos con `FlagDashboard = TRUE`
- Un elemento visible a la vez (no simultáneos)
- **Cards expandibles/colapsables** con bordes redondeados (`radius: 16px`):

| Card | Contenido |
|------|-----------|
| 📅 Último recambio | Fecha completa + "hace N días" |
| 🔁 Frecuencia | Promedio de días entre recambios (calculado sobre todos los registros) |
| 💰 Costo promedio | $ promedio por recambio + total acumulado |
| 📈 Historial | Gráfico línea de tiempo últimos 3 registros (SVG inline, sin librería externa) |

- Cards colapsadas por defecto en mobile, expandidas en desktop

### 8.3 Panel / Tab "Elementos"

- Lista de todos los elementos con sus flags
- Botón `＋ Nuevo elemento` (FAB o header)
- Al tocar → drawer/modal para editar: nombre, unidad, FlagMedicion toggle, FlagDashboard toggle, Activo toggle
- Acceso permitido a cualquier usuario autenticado (no hay rol admin diferenciado en v1)

### 8.4 Formulario de Registro (nuevo / editar)

**Campos en orden:**
1. **Elemento** — `<select>` cargado desde Sheet. Si viene del drawer, pre-seleccionado y bloqueado
2. **Fecha** — date picker nativo, `max = hoy`, sin fechas futuras
3. **Hora** — time picker estilo MdT (flechas ▲▼, pasos 30 min, valor por defecto = hora actual)
4. **Medición** — número entero > 0. Solo visible si `FlagMedicion = TRUE`. Muestra referencia: *"Último: 45.230 km"*. Placeholder: "Ingresá el valor actual"
5. **Valor ($)** — número decimal, en pesos. Placeholder: "0.00"
6. **Nota** — `<textarea>` opcional, max 200 chars

**Comportamiento:**
- Modo "nuevo": todos los campos vacíos (excepto fecha/hora = ahora)
- Modo "editar": campos pre-cargados con valores del último registro
- Validación: Elemento requerido, Fecha requerida, Valor ≥ 0, Medición > 0 si aplica
- Botones: `Guardar` (accent azul) / `Cancelar`
- Semáforo de sincronización (previene doble submit)
- Toast de confirmación: "✅ Registro guardado"

---

## 9. GAS — Acciones API

| Action | Descripción | Parámetros |
|--------|-------------|------------|
| `verificarEmail` | Valida si el email está en whitelist | `email` |
| `getElementos` | Devuelve lista de elementos activos | `email` |
| `getRegistros` | Últimos N registros por elemento | `email`, `elementoID?`, `limit?` |
| `getDashboard` | Stats calculadas para un elemento | `email`, `elementoID` |
| `guardarRegistro` | Inserta nuevo registro | `email`, `fecha`, `hora`, `elementoID`, `medicion?`, `valor`, `nota?` |
| `editarRegistro` | Modifica registro existente | `email`, `id`, `...campos` |
| `guardarElemento` | Crea o edita un elemento | `email`, `...campos elemento` |
| `ping` | Keep-alive para evitar cold start | — |

**Patrón de respuesta GAS:**
```json
{ "ok": true, "data": {...} }
{ "ok": false, "error": "Mensaje legible" }
```

**Keep-alive:** ping cada 4 minutos (igual que MdT).

---

## 10. PWA

- **Service Worker:** estrategia cache-first para assets estáticos, network-first para GAS
- **Caché key:** `mimedicion-v1`
- **Instalable:** botón en header, aparece solo cuando `beforeinstallprompt` está disponible
- **iOS:** instrucción manual "Compartir → Agregar a pantalla de inicio"
- **Theme color:** `#0f172a`
- **Display:** `standalone`

---

## 11. Persistencia local (localStorage)

| Clave | Contenido |
|-------|-----------|
| `mm_usuario` | `{ email, name, picture, token, expiry }` |
| `mm_elementos` | Cache de elementos (invalidar al actualizar) |
| `mm_last_sync` | Timestamp última sincronización |

---

## 12. Convenciones de versioning

| Archivo | Versión en nombre | Versión visible |
|---------|------------------|-----------------|
| `index_v1.html` | En filename | Header app + login screen |
| `sw_v1.js` | En filename + cache key | — |
| `GAS_v1.gs` | En filename + hoja Config | — |

**Semver simplificado:** `vMAJOR.MINOR` · Ejemplo: `v1.0` → `v1.1` por fix, `v2.0` por cambio estructural.

---

## 13. Historial de versiones

| Versión | Fecha | Descripción |
|---------|-------|-------------|
| v1.0 | 2026-05-24 | Diseño inicial aprobado. Arquitectura, pantallas, Sheet, GAS definidos. Pendiente desarrollo. |

---

## 14. Pendientes y decisiones futuras

- [ ] Gráfico de línea de tiempo: SVG inline puro (sin Chart.js) para mantener zero-dependency
- [ ] Multi-usuario en mismo Sheet: no contemplado en v1, evaluar en v2
- [ ] Export de datos: CSV de registros por elemento (candidato v1.x)
- [ ] Notificaciones push: recordatorio de recambio vencido (candidato v2)
- [ ] Modo offline completo: queue de registros pendientes en localStorage (candidato v2)
- [ ] Moneda configurable: hoy hardcoded ARS (candidato v1.x)

---

## 15. Prompt de continuación (copy-paste para próxima sesión)

```
Proyecto: Mi Medición (mimedicion)
Handoff: HANDOFF_mimedicion_v1.0.md (aprobado)
Stack: HTML SPA/PWA + GAS + Google Sheets + GitHub Pages (datamegashare)
UX base: Mesa de Trabajo (index_mdt.html)
Accent: #0ea5e9 (azul agua)
Fuentes: Bebas Neue + DM Sans + DM Mono
Sheet hojas: Registros, Elementos, Config
GAS actions: verificarEmail, getElementos, getRegistros, getDashboard, guardarRegistro, editarRegistro, guardarElemento, ping

Estado actual: Diseño aprobado. A desarrollar en orden:
1. manifest.json
2. Ícono SVG
3. GAS_v1.gs
4. sw_v1.js
5. index_v1.html

Reglas de entrega:
- Siempre como archivos descargables, nunca inline
- Versión visible en login + header (fuente: CONFIG.VERSION_UI)
- Versión en nombre de archivo
- Semáforo de sync (flag guardando)
- Keep-alive ping cada 4 min
- Historial de versiones al final de cada entrega
```
