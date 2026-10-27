# Tirante 1.17 — ciclo de caminata

Se usa `walk_cycle.glb`, aportado por el usuario: **Walk Cycle**, de **skywarrior34niraj**, CC BY 4.0. Su metadato original y SHA-256 quedan en `game/assets/licenses/walk-cycle.json`; conversor en `scripts/assets/`. El GLB original no se redistribuye en GitHub.

## Implementación

- Animación original `Armature|Walk`: un segundo, 45 articulaciones en el skin, curvas extraídas a 48 Hz e interpoladas. La fase sigue la distancia recorrida (zancada original aproximada de 1,026 m).
- Cadera, tobillo, rodilla y balanceo talón/punta adaptados al personaje vestido. Contactos de apoyo fijados en coordenadas mundiales; transferencia del apoyo del talón a la punta; altura de pelvis limitada por el alcance real de las piernas.
- Avance, retroceso y desplazamiento lateral derivados del ciclo frontal. El archivo recibido contiene un solo ciclo; estos movimientos son adaptaciones, no clips de captura adicionales.
- Pantalón continuo de 408 triángulos derivado de la malla del GLB. Las caras, poleras/polerón, zapatillas, manos y carretes anteriores se conservan. Los brazos usan la pose de manejo del carrete, no el balanceo libre del clip.
- El anclaje físico del hilo conserva su coincidencia exacta con la salida del carrete.
- Avance de NPC a 0,65 m/s en cada tick de física, independiente de sus decisiones de combate. Mantiene 13 m de separación, límites del campo y gasto de energía según distancia efectiva.
- CPU skinning común a WebGL y Canvas. Unos 23 KB de datos de animación/malla; no se descarga el GLB durante el juego. Las poleras reducen cuatro llamadas de dibujo al sustituir cinco piezas del pantalón por una.

## Pruebas

`tests/pilot-locomotion.mjs` prueba cinco direcciones durante 1.800 actualizaciones: suelas reales sobre el suelo, alcance de pierna ≤0,855 m, 2.412 contactos fijados sin deslizamiento horizontal medible (>1e-7 m), detenerse, pausa, teletransporte y fase equivalente a 30/60/120 actualizaciones por segundo. También comprueba continuidad del ciclo y velocidad/separación del anclaje NPC.

Las pruebas de vestuario verifican 72 combinaciones de pose y nivel de detalle: posiciones/normales finitas, cintura acompañando la pelvis y mangas siguiendo las muñecas. Las pruebas existentes cubren carrete, tensión, vuelo, Party, vidas, online y almacenamiento HTTP.

`docs/tirante-1-17-caminata.gif` es una secuencia reproducible del renderizador del juego, con desplazamiento controlado; no es una grabación del navegador ni una medición de FPS.

## Límites

No se incorporó el cuerpo completo del GLB: se adaptaron su ciclo y malla de piernas para conservar la identidad y el vestuario existentes. La animación es una adaptación para vuelo con carrete; giros, frenadas y pasos laterales no cuentan con capturas específicas. El navegador de pruebas usa Canvas por falta de WebGL; no se ha medido rendimiento GPU.

## Resultado verificado

- `npm run build`: 80 módulos comprobados.
- `npm test`: batería completa aprobada; 10 pruebas HTTP/SQLite aprobadas.
- Render publicó el commit de implementación `1e1dfa0a919d89c86a7e76a483daf9622d042922` (deploy `dep-dbgaqda9lscs7396etfg`, estado `live`).
- `/healthz`: HTTP 200, versión 1.17.0. `pilot-locomotion.js`, `pilot-walk-data.js`, `pilot-model.js` y `npc-pilot.js` publicados coinciden byte a byte con los archivos locales probados.
- Revisión de Party con tres NPC, selección de Mateo/Alma/Nico y tirón durante partida activa. El fallback Canvas muestra las prendas, piernas y carrete; no aparecieron errores de la aplicación aparte del aviso esperado de WebGL no disponible.
- Captura real de la web: [Party 1.17](tirante-1-17-party.jpg). El GIF del ciclo se genera por separado con el renderizador del juego y un desplazamiento controlado.
