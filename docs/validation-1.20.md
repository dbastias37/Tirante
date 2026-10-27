# Tirante 1.20 · Adaptación del kit a las partidas

## Decisiones de integración

- Se utilizan las cabezas `make3`, `make5` y `make1`, con ojos y pelo del kit, en Mateo, Alma y Nico. Se elimina el busto que chocaba con la ropa y se ajusta la base al cuello continuo del juego. Los dientes y la lengua invisibles no se cargan.
- El suéter se lleva de su pose de brazos abiertos al esqueleto de Tirante: centros de mangas, hombros, muñecas y holgura. Se conserva el forro con espesor y se ajusta la piel oculta para impedir que asome al doblar los codos. Alma conserva su polera y Nico su polerón, con puños más recogidos.
- El calzado deportivo `make6.001` se ajusta a unos 28 cm, con punteras hacia delante, pares anatómicos y apoyo calculado desde las suelas reales de ambos niveles de detalle. Los zapatos de vestir del kit no se eligen para el claro.
- HandSwap aporta la topología continua y los pesos de los dedos. El conversor corrige un par de caras internas duplicadas, cierra la muñeca y genera dos niveles. El esqueleto de edición y sus acciones de golpe no pasan al juego. La mano derecha rodea el mango fijo y la izquierda sigue la acción de hilo.
- El carrete conserva un único extremo sobresaliente de agarre. Su salida visible sigue coincidiendo con el anclaje físico. Se conserva el ciclo de caminata anterior.

## Texturas y coste

Los atlas conservan las islas UV originales por material y por región conectada. Proyectar cada vértice sin esa separación mezclaba cuello, pelo y ojos al reducir las mallas; el conversor ahora evita ese cruce. Las imágenes se comparten entre NPC e incluyen recorte alfa del pelo. La alternativa Canvas usa las mismas imágenes, interpolación UV con perspectiva y profundidad; los colores horneados permiten dibujar mientras se descargan las texturas.

| NPC | Triángulos cerca | Triángulos lejos | Grupos de dibujo |
| --- | ---: | ---: | ---: |
| Mateo | 12.927 | 6.229 | 17 |
| Alma | 15.128 | 6.578 | 17 |
| Nico | 16.015 | 6.730 | 17 |

## Validación automatizada

- `npm run build`: sintaxis de los módulos del proyecto.
- `npm test`: vuelo, hilo, cortes, vidas, Party, duelo online, cámaras, personalización y servidor HTTP/SQLite, además de los casos de personajes.
- 216 poses de rostro/manos: UV válidos, manos sin bordes abiertos, dedos que deforman la malla, muñeca estable, agarre, pausa y buffers finitos.
- 72 combinaciones de ropa y nivel de detalle: cintura, mangas, límites del cuerpo, cambios de cámara y profundidad Canvas.
- 54 poses con pruebas de rayos y topología: codos, muñecas, cuello, forro interior, zapatos y mango de un solo lado.
- Pruebas de atlas: ningún triángulo salta entre materiales; orientación UV, perspectiva, transparencia sin escritura de profundidad, imágenes pendientes y cambio de nivel de detalle.
- Caminata: talón/punta, pies plantados, avance/retroceso/lateral, pausas y reapariciones.

## Alcance y límites

Las prendas usan deformación por pesos; no hay una simulación física de tela. Los rostros son adaptaciones de las mallas y mapas recibidos, sin animación facial. HandSwap no contiene la textura original y el juego no la recrea ni la redistribuye. Las licencias no especificadas de los nuevos archivos se registran como tales en Créditos, sin atribuirles CC0. Solo se publican recursos derivados para el juego, conversores y verificaciones; los `.blend`, referencias originales y archivos del editor permanecen fuera del repositorio.

La revisión de navegador utiliza el renderer disponible en el entorno. El modo Canvas permite comprobar la malla y la interacción, pero no constituye una medición de FPS ni una validación visual de GPU en hardware real.
