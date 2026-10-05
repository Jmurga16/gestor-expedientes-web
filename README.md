# TRAZA — gestor de expedientes (web)

Frontend del sistema de mesa de entradas municipal. Incluye el modeler BPMN con el que se dibujan los circuitos de cada trámite.

Backend: [gestor-expedientes-api](https://github.com/Jmurga16/gestor-expedientes-api) · Demo: https://traza.devkora.com

![El modeler BPMN con un carril por área: el circuito que después recorre cada expediente](docs/img/modeler-carriles.png)

## Qué hace

Cada tipo de trámite municipal tiene un circuito dibujado en BPMN, con un carril por área. Los expedientes avanzan por ese circuito y cada movimiento queda registrado.

![El login de TRAZA; el layout se adapta de teléfono a escritorio](docs/img/login.jpg)

| Pantalla | Qué permite |
|---|---|
| Dashboard | totales de expedientes por estado |
| Bandeja | listado paginado y filtrado por rol, con búsqueda y exportación a Excel |
| Alta de expediente | si la terna elegida no tiene circuito definido, avisa en el formulario |
| Diagrama del expediente | el BPMN del expediente, el cambio de paso y estado, las observaciones y el historial; si está cerrado avisa y solo el administrador puede reabrirlo |
| Manual de usuario | reglas de paso, estado, permisos, cierre y reapertura, disponible para todos los roles |
| Flujos de trabajo | el modeler: dibujar el circuito, agregar carriles por área, descargarlo como `.bpmn` o como PNG |
| Catálogo | áreas, tipologías y subtipologías |
| Usuarios | ABM con área y roles |

El menú lateral se arma según el rol, y las rutas de administración están detrás de un guard: un vecino no ve Usuarios ni Flujos de Trabajo, y tampoco llega escribiendo la URL.

![La bandeja de expedientes, paginada del lado del servidor y filtrada por el alcance del rol](docs/img/bandeja.png)

## Stack

Angular 18 · PrimeNG 17 · PrimeFlex · bpmn-js 18 · SweetAlert2

## Estructura

```
src/app
├── auth        login, registro y guards
├── core        layout, menú, interceptores y modelos genéricos
├── modules     un módulo por agregado, cargado lazy
│   ├── area
│   ├── tipologia
│   ├── user
│   ├── workflow
│   └── demanda
└── shared      modeler BPMN, loading, pipes y servicios transversales
```

Cada módulo repite la misma forma: `common/models`, `common/services`, `pages/` y su routing. La bandeja de expedientes pagina del lado del servidor (`p-table` en modo lazy), no trae todo y filtra en el navegador.

## Puntos de interés del código

**El modeler** (`shared/components/diagram`) envuelve `bpmn-js`. Agregar un área al circuito no es manipular el XML a mano: usa la API `modeling` de bpmn-js (`addLane`, `updateProperties`), que mantiene la coherencia del diagrama y su DI. El carril queda con `id = Lane_{idArea}`, que es lo que después lee el backend para saber por qué áreas pasa el expediente.

**Exportar el diagrama como imagen** sale de `saveSVG()` rasterizado en un `<canvas>` a 2×, sin dependencias extra.

**Los pasos del expediente** se leen del diagrama, incluidas tareas de usuario y de servicio, más `Inicio` y `Finalizado`. Cada paso se identifica por el ID de su tarea; si dos tareas comparten nombre, el selector agrega el carril. El expediente utiliza un visor sin edición: destaca el paso guardado con el color de su estado, también en el PNG. Al moverlo pide motivo y confirmación; advierte si el destino ya aparece en el historial. No interpreta las flechas ni las condiciones del BPMN, y los circuitos son secuenciales: la API rechaza al guardar un flujo con ramas en paralelo.

Los permisos de cada expediente los decide la API (`/demanda/{id}/permisos`); la pantalla solo habilita lo que corresponde. El referente mueve cuando su área es responsable del paso actual, el colaborador agrega observaciones y el administrador es el único que reabre un cerrado. En la bandeja, el lápiz aparece si se pueden editar los datos y la papelera si se puede eliminar. Si otro usuario guardó antes, la API responde `409`: el formulario ofrece recargar y la pantalla de movimientos recarga conservando lo escrito en Observaciones. La clasificación del expediente se mantiene fija para conservar su relación con el circuito.

**El token** se guarda en `localStorage` y lo inyecta un interceptor. Otro interceptor centraliza los errores y distingue el fallo de conexión del error del servidor, así que ningún componente repite el manejo de errores HTTP.

## Levantarlo local

Hace falta Node 20 o 22 y la API andando en `http://localhost:8080` (ver [gestor-expedientes-api](https://github.com/Jmurga16/gestor-expedientes-api)).

```bash
npm install
npm start
```

Queda en `http://localhost:4200`. La URL de la API y la del storage salen de `src/environments/environment.development.ts`.

## Build y despliegue

```bash
npm run build
```

Deja el sitio en `dist/expedientes-front/browser/`. Es una SPA sin SSR: `src/web.config` reescribe las rutas a `index.html` para que funcione el refresco sobre cualquier ruta en un App Service de Windows.

Ese build apunta a Azure y se publica subiendo el contenido de la carpeta a `site/wwwroot` (la versión congelada está en el tag `demo-azure`).

La demo del VPS usa la configuración `vps`, donde la API y los archivos salen del mismo origen (`/api` y `/almacen`):

```bash
npm run build -- --configuration production,vps
```

El `Dockerfile` construye esa variante y la sirve con Caddy (`deploy/Caddyfile`). Se publica junto con la API, con el `deploy.sh` de [gestor-expedientes-api](https://github.com/Jmurga16/gestor-expedientes-api).

## Tests

```bash
npm test
```

Cubren la precedencia de roles y el vencimiento del token, el modo sólo lectura del formulario de usuarios, y el armado de carriles en el modeler: el id que después lee el backend, que no se dupliquen áreas y que el pool crezca.
