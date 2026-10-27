# Modelos de los NPC

Los dos archivos fueron aportados por el usuario para vestir a los participantes de Tirante. Las licencias HTML originales se conservan sin cambios junto a este documento. Las modificaciones descritas aquí no implican patrocinio ni aprobación de sus autores.

## Shirt Template

- Autor publicado: **jesterelly**. Basado en «blouson», de **zuendholz**.
- Fuente indicada en la licencia: http://www.blendswap.com/blends/view/77218
- Licencia de publicación aportada: **Creative Commons Zero (CC0 / dominio público)**, https://creativecommons.org/publicdomain/zero/1.0/
- Archivo original: `shirts_tpl.blend`, Blender 2.72. Licencia: `shirt-template-original.html`.
- El texto interno del archivo también conserva «(c)2015 Jellyfish Dessert» y una mención genérica a Creative Commons 3.0; el HTML de publicación identifica expresamente CC0. Se mantiene la atribución a pesar de que CC0 no la exige.
- Adaptaciones: aplicado el espejo de la plantilla; conversión de ejes y escala; ajuste de cuello, cintura, mangas y capucha; reducción de polígonos; colores de equipo y ribetes; pesos para cintura, pecho, brazos, antebrazos y cabeza. Se utilizan las dos prendas del archivo: polera y polerón con capucha.

## Sneakers

- Título publicado: **Sneakers**, Blend Swap **#94126**, subido el 11 de junio de 2019.
- Fuente indicada en la licencia: http://www.blendswap.com/blends/view/94126
- Licencia aportada: **Creative Commons Attribution 3.0**, https://creativecommons.org/licenses/by/3.0/
- El HTML aportado también lo identifica como **Fan Art y restringe su uso comercial**. Se conserva esa condición para este recurso y sus adaptaciones; no se declara como CC0 ni como recurso comercial libre.
- El HTML recibido no incluye el nombre del autor. La ficha original no pudo recuperarse durante esta adaptación. Se conserva toda la información de atribución disponible —título, identificador, enlace, fecha y licencia— sin inventar una identidad.
- Archivo original: `sneakers.blend`, Blender 2.79. Licencia: `sneakers-original.html`.
- Adaptaciones: malla `Plane.007`, escala a 28 cm de largo, par izquierdo/derecho, suelas apoyadas en el suelo, difusión de `rb_r_black.PNG` incorporada en colores de vértice y dos niveles de detalle. No se descargan las texturas grandes ni los archivos de Blender durante el juego.

## Conversión reproducible

`wardrobe-manifest.json` registra SHA-256 de los dos originales y los triángulos de cada nivel. La conversión está en `scripts/assets/export_pilot_wardrobe.py`. Solo lee geometría y la imagen empaquetada; no ejecuta scripts dentro de los `.blend`. Dependencias de exportación: Python, numpy, scipy, Pillow y fast-simplification 0.1.12. No se añaden dependencias al servidor ni al navegador.

## Walk Cycle

- Autor: **skywarrior34niraj**, https://sketchfab.com/skywarrior34niraj
- Obra: **Walk Cycle**, https://sketchfab.com/3d-models/walk-cycle-05c7560e49c1441aa0c70d3dc7bc710b
- Licencia incorporada en `asset.extras` del GLB aportado: **CC BY 4.0**, https://creativecommons.org/licenses/by/4.0/
- El GLB original aportado no se redistribuye en este repositorio. Su atribución y SHA-256 se conservan en `walk-cycle.json`.
- Adaptaciones: conversión de escala/ejes, extracción y ajuste del pantalón continuo, pesos de piel reasignados a las piernas del jugador, ciclo muestreado a 48 Hz e interpolado, velocidad según desplazamiento, apoyo mundial del pie y brazos independientes para sostener el carrete. Se conservan las caras, ropa y zapatillas ya adaptadas.
- Conversión reproducible: `python scripts/assets/export_pilot_walk.py /ruta/al/walk_cycle.glb`. Requiere numpy y scipy solo durante la exportación. El navegador carga unos 23 KB de datos derivados, sin cargar el GLB ni añadir bibliotecas.
