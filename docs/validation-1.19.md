# Tirante 1.19 — cierre de superficies y orientación

Corrección de las capturas del usuario: huecos visibles en codos/cuello/ropa, alineación del calzado y mango por ambos lados del carrete. No se publican las capturas recibidas ni se incorporan archivos de rostro o brazos todavía no recibidos.

## Reparaciones

- Los dos segmentos visibles de cada brazo se sustituyen por una superficie tubular continua, con sección variable, codo redondeado y transición a la palma. Los objetos que controlan la ropa se conservan; muñeca y dedos mantienen su pose de agarre.
- Cuello cerrado que conecta el torso con la base inclinada de la cabeza. Volumen interior bajo la polera y puños de tobillo para evitar ver el fondo por las uniones. El volumen cubierto se reduce dentro del polerón para evitar que atraviese la tela.
- Forro a 2,8 mm de la superficie exterior, triángulos orientados hacia el interior y paredes de borde en mangas, cuello, bajo y capucha. Las dos capas comparten exactamente los pesos de animación; no se cierran las aberturas funcionales con discos de tela.
- El mango fijo va de −0,09 a +0,21 m en el eje local del carrete: sobresale por la mano derecha y queda al ras por la mano guía. Se conserva el giro independiente del carrete y su salida física del hilo.
- La puntera apunta a −Z, igual que el personaje. Corregidos los signos del giro: apertura hacia fuera en reposo y hacia el sentido del paso lateral al caminar. No se gira 180° una malla cuya puntera ya apuntaba hacia delante.
- La textura de zapatillas se vuelve a muestrear desde el asset aportado en cada esquina de cara, conservando separaciones de color entre islas UV. Las normales suaves se conservan al separar vértices; no se mezclan colores de islas distintas en una costura. Conversor: `scripts/assets/rebake_shoe_colors.py`.
- La tela recalcula sus normales después de deformarse. Se corrige la orientación de las tapas de los volúmenes interiores. Canvas ahora aplica el mismo descarte de caras traseras que WebGL, incluyendo la inversión de los objetos reflejados; la comprobación anterior de Canvas podía ocultar errores visibles en GPU.

## Pruebas

`npm run build`: 86 módulos comprobados. `npm test`: batería completa aprobada; 10 pruebas HTTP/SQLite aprobadas.

- `tests/pilot-solidity.mjs`: 54 poses, tres personajes y dos niveles de detalle. Todas las aristas de las superficies cerradas tienen dos caras. Rayos con descarte de caras traseras rodean codos, muñecas y cuello; desde dentro de la ropa interceptan el forro. También comprueba pesos de ambas capas, orientación del pie, mango unilateral y salida exacta del hilo.
- Pruebas de apariencia: 216 poses, agarre fijo, dedos, caras faciales, buffers finitos y pausa estable.
- Pruebas de vestuario: 72 combinaciones de pose y detalle, mangas, cintura, niveles de detalle y profundidad.
- Pruebas de caminata: apoyo sobre el suelo, contacto sin deslizamiento, alcance de pierna, parada, pausa y orientación del calzado durante pasos laterales.
- Revisión visual controlada desde delante, de lado, desde atrás y desde abajo con el mismo descarte de caras que WebGL.

| Personaje | Triángulos cerca | Triángulos lejos | Grupos de dibujo |
|---|---:|---:|---:|
| Mateo | 15.197 | 6.778 | 19 |
| Alma | 14.458 | 6.934 | 20 |
| Nico | 16.733 | 7.128 | 19 |

El forro aumenta la geometría pero se integra en el mismo grupo de dibujo de la prenda. Se mantienen los niveles de detalle a distancia y el renderizador descarta caras traseras antes de rasterizarlas. No se afirma una medición de FPS de GPU: el navegador de prueba usa Canvas.

## Límites

Los brazos actuales son una reconstrucción continua para reparar los huecos. El rostro y las manos mantienen el diseño existente hasta recibir los nuevos archivos. Los colores de zapatillas siguen horneados por vértice para compartirlos entre WebGL y Canvas; no se añadió un mapa PBR de mayor resolución ni una simulación de tela.
