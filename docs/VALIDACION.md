# Validación de la exportación

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
