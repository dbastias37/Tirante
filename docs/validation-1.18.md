# Tirante 1.18 — rostro, vestuario y agarre

La revisión mejora las mallas que ya usa el juego. Las fotografías aportadas sirven como referencia de postura del carrete; no se publican las fotografías ni se reproduce la identidad de sus personas.

## Cambios

- Rostros: ojos con iris y pupila, cejas, labios cerrados, matices de piel y sombra de barba en Nico. Suavizado de la malla y sus normales; nacimiento del pelo recortado de forma continua. Los rasgos siguen la superficie de la cara y su orientación durante el vuelo.
- Prendas: algo más de holgura en las mangas para cubrir el hombro durante el nuevo agarre; bordes de cuello y puños, bolsillos, cordones del polerón, costuras y pequeños pliegues. Detalles integrados en la misma malla con sus pesos de animación, sin simulación adicional de tela.
- Manos de NPC: palma redondeada, cuatro dedos y pulgar separados, curvatura continua al recoger o soltar. Son mallas reconstruidas para el agarre, no una extracción de la mano original del GLB.
- Postura de referencia: mano derecha cerrada alrededor del eje fijo; mano izquierda vertical sobre el costado para guiar/frenar. Se relaja el brazo libre al ser eliminado. Carrete con seis perforaciones por tapa y giro independiente del eje.
- El hilo mantiene su salida exacta sobre el carrete. La caminata, su apoyo en el suelo y las reglas de combate se conservan.
- Canvas ofrece un búfer de 432 px de altura cuando se observa al personaje de cerca. Conserva los tamaños pequeños a distancia. WebGL y Canvas comparten geometría, colores y poses.

## Presupuesto de geometría

| Personaje | Cerca, triángulos | Lejos, triángulos | Grupos de dibujo |
|---|---:|---:|---:|
| Mateo | 12.364 | 5.606 | 18 |
| Alma | 11.625 | 5.762 | 19 |
| Nico | 12.712 | 5.358 | 14 |

Los datos cuentan también la sombra de contacto. Los detalles de tela no añaden grupos de dibujo; los rasgos faciales se reúnen en uno por personaje. Las manos tienen un grupo cada una y dos niveles de detalle.

## Validación automatizada

- `npm run build`: 84 módulos comprobados.
- `npm test`: batería completa aprobada (física, hilo, Party, vidas, online, renderizado y almacenamiento); 10 pruebas HTTP/SQLite aprobadas.
- `tests/pilot-appearance.mjs`: 216 poses en tres personajes y dos niveles de detalle; mano de apoyo fija al eje, dedos cerrados por fuera, caras faciales orientadas hacia fuera, pausa estable y anclaje del hilo exacto. Verifica que los nuevos vértices de la ropa tengan colores y normales completos y finitos.
- `tests/pilot-wardrobe.mjs`: 72 combinaciones de pose/nivel de detalle, unión de cintura y mangas, profundidad de Canvas y cambios de detalle por distancia.
- `tests/pilot-model.mjs`: geometría acotada, posturas de recoger/tirar/caminar/eliminación y coincidencia entre salida del carrete y anclaje físico.
- `tests/pilot-locomotion.mjs`: continuidad del ciclo, suelas sobre el terreno, apoyo fijo, límites de alcance de pierna, arranques, paradas y desplazamiento lateral/hacia atrás.

## Comparación y límites visuales

[Rostros antes/después](tirante-1-18-rostros.jpg) y [vestuario con el agarre nuevo](tirante-1-18-vestuario.jpg) se generan con las mallas y el renderizador del juego. Son vistas controladas de revisión; no son capturas del navegador ni una medición de FPS.

El resultado sigue siendo estilizado. Las cabezas provienen de una figura de dibujo y las prendas no cuentan con mapas fotográficos de tela. Ojos y labios son detalles de superficie; no hay rig facial, parpadeo ni expresiones animadas. No se ha medido el rendimiento GPU en el navegador de pruebas, que usa la alternativa Canvas.

## Archivos para un siguiente nivel de realismo

1. **Un personaje completo en `.glb` o `.blend`**, con cabeza detallada, ojos separados, boca bien modelada y manos con cinco dedos articulados. Idealmente en A-pose o T-pose, con escala conocida y un esqueleto humano compatible con las animaciones.
2. **Texturas incluidas y UVs correctas**: color/base color, normal y roughness para piel y ropa; AO opcional. Como punto de partida proponemos 2K para cara y 1K–2K para prendas, ajustándolo después al equipo objetivo. Los recursos deben venir empaquetados en el GLB o junto al `.blend` con rutas completas.
3. **Ropa ajustada al mismo cuerpo y esqueleto**, con pesos de deformación de hombros, codos y muñecas. Entregar las prendas por separado permite cambiar polera/polerón sin duplicar el personaje entero.
4. Para expresiones: párpados y blendshapes de parpadeo/boca. Para una identidad concreta: referencias de frente, perfil y tres cuartos, con iluminación pareja.

Incluir autor y licencia que permitan integrar y publicar los assets en el juego. Las fotografías ayudan a definir forma y postura; por sí solas no contienen geometría, UVs, pesos ni los materiales necesarios.

Referencia técnica: [exportación glTF de Blender](https://docs.blender.org/manual/en/latest/addons/scene_gltf2.html), con materiales PBR y animación/esqueletos. La compatibilidad de un archivo concreto se comprueba al importarlo.

## Publicación verificada

- Commit de implementación: `e5574a44be7190c96b44d575ecff684c09f2a4a8`. Render lo publicó con el deploy `dep-dbgbj78473hc73fliq50`, estado `live`.
- `/healthz` devolvió HTTP 200 y versión 1.18.0. Los seis módulos de modelo, rostro, manos, tela, vestuario y Canvas publicados coinciden byte a byte con los archivos probados.
- Revisión real en navegador: inicio → Party con tres NPC → vistas de Mateo, Alma y Nico; soltar, recoger y tirón durante una batalla activa. Sin errores de la aplicación aparte del aviso esperado de WebGL no disponible en ese navegador.
- [Captura de Party publicada](tirante-1-18-party.jpg), con el polerón, rostro, manos y carrete visibles.
