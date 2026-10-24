# Validación de la exportación

## Reparación de Render · 24 de octubre de 2026

El despliegue original `Tirante` era un Static Site que publicaba la raíz del repositorio. Su HTML pedía `/app.js` y `/style.css`, que devolvían 404. Las API tampoco se ejecutaban. El build estaba correcto; el tipo de servicio y la entrada publicada no correspondían al servidor de esta exportación.

Se creó el Web Service gratuito `tirante-vuelo`, desde `main`, con Node 24.19.0, `npm ci && npm run build`, `npm start`, una instancia y datos temporales en `/tmp/tirante-data`. Su primer despliegue llegó a `live`. La configuración se administra directamente en Render; los YAML del repositorio siguen siendo plantillas opcionales.

Comprobaciones realizadas:

- El build y todas las pruebas automatizadas de la exportación pasan localmente.
- En `https://tirante-vuelo.onrender.com`, la página inicial, JavaScript, CSS y Three.js responden con HTTP 200 y sus tipos de contenido correctos. `/healthz` devuelve `ok: true` y `storage: sqlite+files`.
- Se abrió el sitio en un navegador, se inició el vuelo libre y se lanzó el volantín. El navegador de pruebas no dispone de WebGL; se comprobó el renderer Canvas alternativo, sin modificar el renderer 3D.
- Dos pestañas independientes crearon y unieron una sala, marcaron ambos jugadores como listos y mostraron el duelo en juego con el mismo reloj. Se cerraron los asientos de prueba al terminar.
- Se cargó un PNG sintético por `/api/prints` y se verificó que su descarga devolviera exactamente los mismos bytes.
- La redirección del `index.html` de la raíz conserva tanto los parámetros como `#sala=...`. `game/index.html` permanece como entrada del servidor, sin cambios.
- Se restituyeron `.gitignore`, `.node-version` y `.env.example`, mencionados en la exportación pero ausentes de la carga inicial a GitHub.

Esta instalación gratuita no conserva salas ni estampados tras reinicios o nuevos despliegues. No se añadió un disco de pago. La [captura de comprobación](tirante-render.jpg) corresponde al navegador sin WebGL.

## Comprobaciones originales de la exportación

Fecha: 23 de octubre de 2026. Entorno de comprobación: Linux, Node.js 24.19.0.

## Resultados

- `npm ci`: instalación correcta desde el archivo de bloqueo, sin dependencias npm externas.
- `npm run build`: sintaxis de los 39 módulos JavaScript y archivos de entrada correctos.
- `npm test`: todas las suites de vuelo, hilo, anclajes, cámaras, comisiones, Party, online, colisiones continuas, contrarreloj, personalización y estampados completadas sin fallos.
- `tests/server.test.mjs`: 9 pruebas aprobadas. Incluye entrega HTTP del juego, errores de solicitudes, dos asientos con autorización, rechazo de un tercer jugador, entradas concurrentes, carga y descarga de estampados, límites de carga y recuperación de datos después de cerrar y reabrir el servidor.
- `render.yaml` y `render-free.yaml`: válidos contra el esquema JSON público de Blueprint consultado el día de la exportación. También se contrastaron runtime, comandos, variables, disco y health check con la documentación oficial de Render.
- Los 24 archivos de `game/` coinciden byte por byte con el proyecto original en el commit `9fa2925c52902c2aa917e38b6d5f9cdfbb350248`. El proyecto original no se modificó durante la exportación.

La prueba de persistencia usa una carpeta temporal, crea una sala de dos personas y un estampado, reinicia el servidor con esa misma carpeta y recupera el asiento, la configuración, el estado físico y la imagen. La persistencia en Render requiere usar el disco configurado en `render.yaml`.

Los YAML fueron validados localmente. No se ha realizado un despliegue en una cuenta de Render ni una prueba de carga de múltiples salas simultáneas. La configuración gratuita tiene menos CPU y no conserva el almacenamiento al reiniciar. El juego y su interfaz no se modificaron en esta exportación; la validación nueva se concentró en el servidor y la portabilidad.

## Repetir las comprobaciones

```sh
npm ci
npm run build
npm test
```

Para ejecutar únicamente la integración del servidor:

```sh
node --test tests/server.test.mjs
```

El modelo físico sigue teniendo el alcance descrito en `MODELO_Y_CAMBIOS.md`; aprobar las pruebas no equivale a certificar una precisión física porcentual.
