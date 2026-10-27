# Contrincantes de Tirante · referencia y adaptación

Referencia aportada: `BodyChan - BodyKun  Posable Drawing Figures.blend`, Blender 2.81, comprimido con gzip. SHA-256: `d01efc62cf39aee85b6cefb4f12ae229297cebd5fab27da03e6ce5f4bc1683af`.

Se leyeron directamente los bloques y la descripción SDNA del archivo, sin ejecutar scripts incrustados. Hay 328 objetos, 322 mallas y tres armatures (dos figuras y un metarig). Solo 37 mallas tienen polígonos de superficie: suman 32.696 vértices y 34.203 polígonos; las demás incluyen controles de edición. Se reconstruyeron vistas frontal y lateral de ambas figuras a partir de MVert/MLoop/MPoly.

La figura masculina separa busto, abdomen, pelvis, cuello, cabeza, brazos, antebrazos, manos/dedos, muslos, pantorrillas y pies. La femenina también separa las falanges. Esto permite identificar centros de articulación y silueta sin tratar el modelo como una estatua. En la figura femenina, por ejemplo, el hombro izquierdo está en (4,35; 0,41; 45,08), el codo en (9,03; 0,95; 39,12), la muñeca en (14,45; 0,75; 34,84), la rodilla en (2,72; −0,52; 17,33) y el tobillo en (2,11; 1,27; 2,28), en las unidades originales.

## Modelo utilizado por el juego

- Las cabezas conservan la silueta y los planos faciales de la referencia. Se normalizaron a 23,5 cm, se soldaron vértices cercanos y se corrigió el orden de las caras al convertir de Z vertical a Y vertical. Las versiones resultantes tienen 2.625 y 1.910 triángulos.
- El cuerpo y el sistema de animación se construyeron para Tirante. Desde 1.16, las poleras, el polerón con capucha y las zapatillas se adaptan de los archivos aportados por el usuario, según se detalla abajo. Los pantalones y manos pertenecen al rig del juego; los colores identifican al rival correspondiente.
- Los brazos usan cadenas de dos articulaciones para alcanzar el carrete. Los dedos forman una mano con palma, pulgar y falanges curvadas. Las piernas responden al desplazamiento real del NPC; no caminan si el anclaje está quieto.
- El personaje mira su propio volantín, mueve el carrete según soltar/recoger, acompaña los tirones y relaja el brazo al quedar eliminado. La animación se detiene con el tiempo de la simulación.
- El carrete mantiene su salida exactamente sobre el anclaje físico, también al girar y moverse. La representación del personaje nunca modifica las fuerzas del volantín.
- En 1.16 cada personaje usa 9.966–11.076 triángulos de cerca y 4.614–5.022 a distancia, con 16–21 grupos de dibujo. Las piezas estáticas de manos y carrete se agrupan por material; cada prenda y cada zapatilla ocupan un solo grupo. WebGL y Canvas usan los mismos modelos; Canvas interpola el color y resuelve la profundidad en buffers reutilizables de 64×96, 128×192 o 192×288 según el tamaño proyectado.
- «Ver jugadores» / P enfoca a los contrincantes dentro de la partida en curso. Permite recorrerlos y orbitar; C o V regresan al vuelo. No abre una demostración separada del modelo.

El archivo de Blender original y sus controles no se descargan ni se ejecutan en el navegador.

## Ropa aportada · 1.16

`shirts_tpl.blend` contiene dos mallas de media prenda (`Cube.000` y `Cube.001`), con un modificador de espejo. Se aplicó el espejo, se soldó la costura central y se convirtió de Z vertical a Y vertical con corrección del orden de las caras. Se conservaron las formas del cuello, las mangas y la capucha, ajustando su escala y holgura al personaje. Dos niveles de detalle: 1.999/460 triángulos para la polera y 2.799/650 para el polerón. No se usan las cámaras, luces ni subdivisiones de edición del archivo.

Las prendas son superficies continuas. Sus pesos conectan cintura, pecho, brazos, antebrazos y cabeza con el rig del juego. La cintura se fija a la pelvis para que el pantalón no atraviese el borde durante un tirón. La manga larga termina junto a la muñeca y la capucha tiene espacio para el cráneo y gira con la mirada. El resultado de esa deformación se escribe en la misma malla que consumen los dos renderers, sin añadir simulación de tela a la física de batalla.

`sneakers.blend` contiene un modelo con 4.521 triángulos por zapatilla. Se utilizó `Plane.007`, se ajustó a 28 cm de largo, se apoyó la suela en Y=0 y se generó el pie opuesto por simetría con normales y caras corregidas. La imagen difusa empaquetada `rb_r_black.PNG` se muestreó usando los UV originales y se incorporó en colores de vértice: permite conservar la suela clara, las piezas oscuras y los cordones sin descargar mapas grandes. Los niveles finales usan 1.399 y 540 triángulos por zapatilla.

El cambio de detalle entra a más de 10 m de cámara y regresa a menos de 8 m, con histéresis para no alternar al oscilar alrededor de un límite. También se simplifican las cabezas lejanas; las manos y la salida del hilo permanecen en las mismas posiciones. «Ver jugadores» activa naturalmente el nivel cercano.

El código de conversión está en `scripts/assets/`. Para repetirlo, instalar las dependencias de exportación indicadas en su cabecera y ejecutar:

```sh
python scripts/assets/export_pilot_wardrobe.py /ruta/a/los/archivos
```

Las licencias originales y SHA-256 de entrada están en `game/assets/licenses/`; los créditos públicos están en `/credits.html`. Los archivos `.blend` solo se leen como datos durante la exportación y no forman parte de la descarga del juego.
