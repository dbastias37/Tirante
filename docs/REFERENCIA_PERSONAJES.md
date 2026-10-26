# Contrincantes de Tirante · referencia y adaptación

Referencia aportada: `BodyChan - BodyKun  Posable Drawing Figures.blend`, Blender 2.81, comprimido con gzip. SHA-256: `d01efc62cf39aee85b6cefb4f12ae229297cebd5fab27da03e6ce5f4bc1683af`.

Se leyeron directamente los bloques y la descripción SDNA del archivo, sin ejecutar scripts incrustados. Hay 328 objetos, 322 mallas y tres armatures (dos figuras y un metarig). Solo 37 mallas tienen polígonos de superficie: suman 32.696 vértices y 34.203 polígonos; las demás incluyen controles de edición. Se reconstruyeron vistas frontal y lateral de ambas figuras a partir de MVert/MLoop/MPoly.

La figura masculina separa busto, abdomen, pelvis, cuello, cabeza, brazos, antebrazos, manos/dedos, muslos, pantorrillas y pies. La femenina también separa las falanges. Esto permite identificar centros de articulación y silueta sin tratar el modelo como una estatua. En la figura femenina, por ejemplo, el hombro izquierdo está en (4,35; 0,41; 45,08), el codo en (9,03; 0,95; 39,12), la muñeca en (14,45; 0,75; 34,84), la rodilla en (2,72; −0,52; 17,33) y el tobillo en (2,11; 1,27; 2,28), en las unidades originales.

## Modelo utilizado por el juego

- Las cabezas conservan la silueta y los planos faciales de la referencia. Se normalizaron a 23,5 cm, se soldaron vértices cercanos y se corrigió el orden de las caras al convertir de Z vertical a Y vertical. Las versiones resultantes tienen 2.625 y 1.910 triángulos.
- El cuerpo, la ropa y el sistema de animación se construyeron para Tirante. La ropa cubre los huecos de las articulaciones del maniquí e incorpora mangas, puños, bolsillos, cierres, pantalones y zapatillas. Los colores identifican al rival correspondiente. Hay variantes de pelo y gorra.
- Los brazos usan cadenas de dos articulaciones para alcanzar el carrete. Los dedos forman una mano con palma, pulgar y falanges curvadas. Las piernas responden al desplazamiento real del NPC; no caminan si el anclaje está quieto.
- El personaje mira su propio volantín, mueve el carrete según soltar/recoger, acompaña los tirones y relaja el brazo al quedar eliminado. La animación se detiene con el tiempo de la simulación.
- El carrete mantiene su salida exactamente sobre el anclaje físico, también al girar y moverse. La representación del personaje nunca modifica las fuerzas del volantín.
- Cada personaje queda por debajo de 7.500 triángulos. Las piezas estáticas de manos, zapatos y carrete se agrupan por material para reducir llamadas de dibujo. WebGL y Canvas usan los mismos modelos; Canvas resuelve la profundidad en un búfer pequeño reutilizable.
- «Ver jugadores» / P enfoca a los contrincantes dentro de la partida en curso. Permite recorrerlos y orbitar; C o V regresan al vuelo. No abre una demostración separada del modelo.

El archivo de Blender original y sus controles no se descargan ni se ejecutan en el navegador.
