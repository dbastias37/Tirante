# TIRANTE · El pulso del viento

Proyecto completo, versión 1.7.0, preparado para un repositorio nuevo en GitHub y un Web Service en Render.

**Empieza por [INSTRUCCIONES_RENDER.md](INSTRUCCIONES_RENDER.md)**: explica cómo subir los archivos y elegir entre guardado persistente y una prueba gratuita.

## Qué incluye

- Vuelo 3D en primera persona y cámara orbital, viento, ráfagas y controles de hilo.
- Tirantes ajustables, nudos, masa y cola; posiciones independientes de los amarres izquierdo y derecho sobre el palillo curvo. Los palillos están detrás del papel y los tirantes delante.
- Estampados con imágenes propias, colores planos y ajustes de encuadre.
- Hilo segmentado con contacto físico, enredos, desgaste y corte dentro de la simulación.
- Energía, boost, doble tirón y selección de carrete.
- Party local contra 1–3 NPC, Rastro de luz contrarreloj y duelo online para dos personas.
- Interfaz compacta para móvil, renderer WebGL y alternativa Canvas.
- Servidor Node.js, base SQLite, almacenamiento de estampados y pruebas automatizadas.

## Probar en tu computador

Instala **Node.js 24.19.0 o posterior de la rama 24**. La versión fijada para Render y usada en las pruebas es 24.19.0. Abre una terminal dentro de esta carpeta:

```sh
npm ci
npm start
```

Abre [http://localhost:3000](http://localhost:3000). Para detenerlo, usa Ctrl+C. No necesitas claves de servicios externos ni crear una base de datos: se inicializa automáticamente al arrancar.

Para editar con reinicio automático del servidor:

```sh
npm run dev
```

Guarda los cambios y recarga el navegador para ver las modificaciones visuales. `npm run build` verifica la sintaxis y los archivos de entrada; el servidor entrega directamente el contenido de `game/`, sin generar una carpeta `dist`.

## Controles

| Acción | Control |
| --- | --- |
| Lanzar / tirón corto en vuelo | Espacio |
| Soltar / recoger hilo | Mantener Q / E |
| Acelerar soltar o recoger | Mantener Shift |
| Dos tirones | Shift + Espacio |
| Aserruchar en comisión | Mantener F |
| Cambiar cámara | V |
| Mirar / orbitar | Arrastrar sobre el cielo |
| Distancia orbital | Rueda o botones + / − |
| Centrar cámara | C |
| Taller | T |
| Party | N |
| Rastro de luz | G |
| Reiniciar / menú | R / Escape |

En móvil están disponibles los botones en pantalla. En duelo online, W/A/S/D o las flechas en pantalla permiten desplazarse dentro del área de juego.

## Desarrollo

| Archivo o carpeta | Responsabilidad |
| --- | --- |
| `game/index.html`, `game/style.css` | Interfaz y adaptación móvil |
| `game/app.js` | Controles y coordinación del juego |
| `game/physics.js`, `game/rope*.js` | Vuelo, hilo y colisiones |
| `game/scene.js`, `game/canvas-scene.js` | Escena y cámaras |
| `game/kite-shape.js`, `game/workshop-design.js`, `game/sail-art.js` | Tirantes, palillos y estampados |
| `game/party.js`, `game/trail.js`, `game/online.js` | Modos de juego |
| `server/index.mjs` | HTTP, archivos estáticos y rutas API |
| `server/storage.mjs` | SQLite y archivos de estampados |
| `server/rooms.js`, `server/online-match.js` | Salas, autorización y simulación compartida |
| `tests/` | Pruebas de física, controles y servidor |
| `render.yaml`, `render-free.yaml` | Dos opciones de despliegue |

Three.js se incluye en `game/vendor/`, con su licencia MIT. No se descargan dependencias desde un CDN al jugar. El servidor usa módulos incorporados en Node 24, incluido `node:sqlite`; no requiere paquetes npm externos.

### Variables de entorno

`npm start` carga `.env` si existe. Puedes copiar `.env.example` a `.env` para cambiar valores locales. En Render, las variables ya están declaradas en los YAML.

| Variable | Valor local por defecto | Uso |
| --- | --- | --- |
| `PORT` | `3000` | Puerto HTTP; en Render se respeta el puerto que entrega la plataforma |
| `HOST` | `0.0.0.0` | Interfaz de escucha |
| `DATA_DIR` | `./data` | Base SQLite y estampados |
| `TRUST_PROXY` | `0` | Usa `1` detrás del proxy de Render para los límites por dirección de red |
| `NODE_ENV` | Sin definir | Los Blueprint lo fijan en `production` |

### API y guardado

- `POST /api/pvp`: crear sala, entrar, indicar listo, enviar controles y salir.
- `POST /api/prints`: cargar el PNG normalizado por el taller.
- `GET /api/prints/:id`: recuperar el estampado por su identificador.
- `GET /healthz`: estado del servicio para Render.

El directorio de datos contiene `tirante.sqlite` y `prints/`. La base se crea sin migraciones manuales. Las actualizaciones de sala comprueban su revisión para evitar que dos solicitudes se sobrescriban. Los estampados se escriben de forma atómica y se identifican por su contenido.

Usa **una instancia y un proceso Node** por directorio de datos. El duelo sincroniza controles y estados mediante solicitudes HTTP; el servidor calcula la física. Está pensado para partidas pequeñas de dos personas. Una demora larga puede pausar o terminar una ronda según las reglas de reconexión, aunque la sala siga almacenada. Las salas inactivas vencen a los 30 minutos.

Para respaldar SQLite manualmente, detén el servicio y copia el directorio de datos completo, incluidos los archivos auxiliares de SQLite si existen. Mantén esos respaldos fuera del repositorio.

## Comprobar cambios

```sh
npm run build
npm test
```

Las pruebas cubren vuelo, viento, tirantes, giros, boost, energía, hilo, cortes, cámaras, Party, contrarreloj, estampados, sincronización online y persistencia del servidor después de reiniciar. Los resultados de esta entrega están en [docs/VALIDACION.md](docs/VALIDACION.md).

## Procedencia y alcance de la exportación

Se conserva el código de juego de TIRANTE 1.7.0, origen `9fa2925c52902c2aa917e38b6d5f9cdfbb350248`. Esta edición sustituye el alojamiento de Sites/Workers por Node.js y el almacenamiento D1/R2 por SQLite y archivos. El adaptador D1 original permanece en `server/rooms.js` como referencia; el servidor de esta edición usa `SQLiteRooms`.

El ZIP contiene el código y los recursos necesarios para desplegar. Las salas activas y los estampados ya almacenados en el alojamiento anterior no se transfieren. En el dominio nuevo debes volver a cargar tus imágenes; los ajustes guardados en el navegador pertenecen al dominio anterior.

El acceso privado de Sites tampoco se traslada: este servidor no incluye cuentas ni una pantalla de acceso. Al publicarlo como Web Service, la dirección de Render será accesible por internet. La versión anterior permanece independiente.

La descripción del modelo físico y el historial están en [docs/MODELO_Y_CAMBIOS.md](docs/MODELO_Y_CAMBIOS.md). Es un modelo jugable reducido, no una medición de fidelidad física del 99,5 %.
