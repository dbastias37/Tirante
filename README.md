# TIRANTE · El pulso del viento

Simulador de volantines, versión 1.15.0, publicado desde este repositorio en Render.

## Instalación actual en Render

El simulador completo se sirve desde **https://tirante-vuelo.onrender.com** mediante el Web Service `tirante-vuelo`, conectado a `main` de este repositorio con despliegue automático. El servicio ejecuta `npm ci && npm run build` y después `npm start`.

El enlace anterior, **https://tirante.onrender.com**, corresponde a un Static Site. Su `index.html` de la raíz redirige al Web Service y conserva los parámetros y las invitaciones `#sala=...`. La entrada real del juego es `game/index.html`, que publica el servidor Node. No copies ese archivo a la raíz: sus recursos están dentro de `game/`, y un Static Site no ejecuta las API de salas o estampados.

La instalación actual usa el plan gratuito, una instancia y `DATA_DIR=/tmp/tirante-data`. Puede tardar en despertar después de estar inactiva. Las salas y las imágenes subidas al servidor se pierden cuando Render reinicia, redespliega o suspende la instancia. Los archivos Blueprint de abajo siguen siendo plantillas opcionales; no administran esta instalación creada directamente en Render.

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

## Cambios de la versión 1.15.0

- Hilo más fino y natural, sin la curva de pantalla impuesta en 1.14 ni el contorno grueso de Canvas. Se conservan la holgura física, la unión al carrete y los tirantes, y la flexibilidad después del corte.
- Puestos a **18 m (19,7 yd)**, con los ocho segundos de elevación y las reglas de vidas anteriores.
- Contrincantes vestidos y articulados, adaptados a partir del análisis del modelo Body Chan / Body Kun aportado. Miran su volantín, manejan el carrete, acompañan tirones y caminan cuando se desplazan; la salida del carrete coincide con el anclaje físico.
- Botón **Ver jugadores / P** para observar a los participantes en la partida. Pulsa otra vez para cambiar de rival; **C o V** vuelven al cielo.
- Modelos compartidos entre WebGL y Canvas, con geometría acotada, agrupación de piezas estáticas y profundidad por píxel en el renderer alternativo. [Análisis y adaptación de la referencia](docs/REFERENCIA_PERSONAJES.md).

## Cambios de la versión 1.14.0

- Hilo cortado flexible: los tramos sueltos dejan de resistir compresión, incorporan más articulaciones cuando son largos, rozan el suelo y se dibujan con curvas suaves. Cada extremo conserva su independencia; el tramo intacto mantiene sus colisiones físicas.
- Salida del carrete sin gancho hacia la parte inferior de la pantalla. La conexión de primera persona se une delante de la cámara y conserva el punto exacto de los tirantes.
- Puestos separados **24 m (26,2 yd)**, con 8 segundos de preparación. Los NPC ganan altura con soltadas cortas y calculan la longitud necesaria para buscar el cruce desde su puesto.
- **Duelo online y Party normal: 3 vidas. Último en pie: 3, 5 o 10 vidas**. Cada corte o caída consume una vida. Si quedan reservas, el participante vuelve a lanzar en 6 segundos; durante la espera se puede observar.
- El resultado espera a que se agoten las vidas. En rondas con tiempo cuentan primero las vidas restantes y después el estado del hilo. Último en pie no termina por reloj.
- Contadores de vidas, espera y resultados visibles también en móvil. Las vidas y las reapariciones online se conservan al guardar/restaurar; un nuevo lanzamiento no se interpola a través del cielo desde la posición del volantín anterior.

## Cambios de la versión 1.13.0

- Estabilidad al dar hilo, recuperar con boost y tirar: la sustentación cambia la dirección del aire relativo sin añadir energía artificial, el arrastre se integra de forma estable y la tensión absorbe la recuperación brusca. Corregida la explosión numérica de los volantines más livianos con viento fuerte.
- La punta del hilo y los tres tirantes usan el mismo punto de unión, también con amarres desiguales, nudos y durante la interpolación online.
- Carrete de primera persona más grande, entrando por el borde inferior derecho y conectado visualmente al hilo. Sin mano. La transición del tramo cercano es solo visual; girar la cámara no mueve el anclaje ni las colisiones. La vista orbital conserva la línea física completa.
- Carretes de **300 yd (274,3 m)** y **1000 yd (914,4 m)** en la preparación y en las salas online. Desgaste y corte cubren también las partes del hilo que superan los 150 m anteriores.
- Campo de 2400 × 2400 m, área plana para las 1000 yd y distancias de cámara/niebla ampliadas. La cantidad de geometría del suelo no aumenta.
- Recuperación de los récords de altura imposibles que quedaron guardados por el fallo numérico. Los ajustes y récords válidos se conservan.

## Cambios de la versión 1.12.0

- Inicio ordenado: título → Enter o toque → menú principal → nueva partida → modo → preparación → comenzar. Cinco modos: vuelo libre, Party, Último en pie, Rastro de luz y duelo online.
- Preparación con vista del volantín, tirantes, hilo, carrete, rodamiento, longitud, viento y rivales. Guardar un ajuste vuelve a la preparación. Rastro mantiene sus condiciones fijas; online continúa a crear o unirse a una sala.
- Carrete sin mano, visible en la esquina inferior derecha de la primera persona y separado de los controles. Sigue el equipo elegido y gira al soltar o recoger; no cambia el anclaje físico del hilo.
- Longitudes y alturas en yardas, con metros entre paréntesis más pequeños. Un carrete de 150 m aparece como 164,0 yd (150,0 m); la física conserva metros internamente.
- Volantín cortado más suave: velocidad inicial limitada a 8 m/s, arrastre gradual por el viento y aceleración lateral limitada. Conserva planeo, aleteo, picada y cámaras de espectador.
- Eliminado el suelo duplicado bajo el campo, borde del terreno unido al exterior, precisión de profundidad mejorada y separación del camino y la sombra para evitar parpadeos a distancia.

## Cambios de la versión 1.10.0

- Papel con 55 % de transparencia (45 % de opacidad), tanto en WebGL como en Canvas y en los estampados.
- Party configurable: nombres de los NPC, color, diseño clásico/liso o imagen propia por rival; también puedes copiarles tu diseño. Perfil e intensidad de viento elegibles antes de jugar. Los ajustes quedan guardados en este navegador.
- Separación inicial mínima de 6 m y preparación de 6 s. Tres veces más trabajo de roce para desgastar una hebra y el doble de exposición necesaria para cortarla por tensión en un cruce. La ráfaga rara de vuelo libre conserva su calibración.
- NPC con decisiones de defensa, recuperación, selección de rivales vivos, pasos de aproximación y tirones cuando el contrario se acerca al límite. Nivel Hábil o Competitivo.
- Ronda con tiempo de 180/240 s y modo **Último en pie / Last man standing**, todos contra todos, sin victoria por reloj. Party local admite un jugador y hasta tres NPC; el duelo online sigue siendo de dos personas.
- Si te abaten y quedan dos o más participantes, la ronda continúa en modo espectador: siguiente rival, cámara orbital, vista general y salida. El resultado anuncia al ganador real de la ronda.
- El hilo de un volantín que toca tierra se corta y se libera antes de calcular nuevas colisiones, para no bloquear a los supervivientes.

## Cambios de la versión 1.9.0

- Corregidos los cruces bruscos que frenaban el movimiento sin registrar contacto ni carga. Un cruce tampoco detiene a los volantines alejados.
- La carga del cruce y los tirones se comparan con la resistencia restante de cada hilo. El más exigido puede ceder, incluido el del jugador que ataca; el desgaste reduce su margen.
- Los enredos acumulan carga por el movimiento que intentas hacer. Soltar hilo la reduce; forzar un cruce puede fracturar una hebra y liberar sus extremos.
- Una ráfaga extrema se selecciona con probabilidad del 10 % por vuelo con viento fuerte. El corte depende de la carga sostenida y de cómo controles el hilo. No se sortea un corte por fotograma.
- La barra muestra el porcentaje del límite y avisa de la sobrecarga. E recoge, Espacio tira y Q descarga; Shift acelera. Las mismas reglas se ejecutan en el servidor del duelo online.

## Cambios de la versión 1.8.0

- Campo verde de 800 × 800 m, con el radio de vuelo de 150 m despejado y plano. Árboles y montañas más lejos, cámara y niebla ajustadas al escenario ampliado.
- Se retiró el pasto animado. La vela usa 112 vértices compartidos en vez de 972; la resolución interna se limita más durante los duelos para reducir trabajo gráfico en pantallas de alta densidad.
- Papel al 40 % de opacidad, también con estampados y en el modo Canvas. Palillos, tirantes y contorno conservan su visibilidad.
- Respuesta de giro aumentada un 10 %, compartida por el cliente y el servidor.
- Las colisiones descartan antes los segmentos alejados, conservando las comprobaciones continuas, el orden de resolución, el desgaste y los cortes.
- El duelo online enlaza cada actualización con la posición que está dibujada, evitando saltos cuando varía el intervalo de red.

Resultados y alcance de las pruebas en [docs/VALIDACION.md](docs/VALIDACION.md).

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

El juego parte de TIRANTE 1.7.0, origen `9fa2925c52902c2aa917e38b6d5f9cdfbb350248`. Esta edición sustituye el alojamiento de Sites/Workers por Node.js y el almacenamiento D1/R2 por SQLite y archivos. El adaptador D1 original permanece en `server/rooms.js` como referencia; el servidor de esta edición usa `SQLiteRooms`.

El ZIP contiene el código y los recursos necesarios para desplegar. Las salas activas y los estampados ya almacenados en el alojamiento anterior no se transfieren. En el dominio nuevo debes volver a cargar tus imágenes; los ajustes guardados en el navegador pertenecen al dominio anterior.

El acceso privado de Sites tampoco se traslada: este servidor no incluye cuentas ni una pantalla de acceso. Al publicarlo como Web Service, la dirección de Render será accesible por internet. La versión anterior permanece independiente.

La descripción del modelo físico y el historial están en [docs/MODELO_Y_CAMBIOS.md](docs/MODELO_Y_CAMBIOS.md). Es un modelo jugable reducido, no una medición de fidelidad física del 99,5 %.


### Novedades 1.11.0

- Caída libre con viento aparente, planeo, balanceo y picada según la orientación; cola articulada con inercia.
- Cámaras «Mi volantín», «A bordo» y «Ver todos» después de perder el hilo. El resultado deja continuar observando.
- Taller → Hilo, carrete y rodamiento: catálogo tridimensional giratorio, arrastre 360°, flechas laterales para cambiar de pieza y arriba/abajo para cambiar de categoría; estadísticas bajo cada selección.
- Cuatro hilos, tres carretes de madera y tres mecanismos de giro. El equipo modifica arrastre, peso del hilo, resistencia, desgaste, velocidad y esfuerzo. Los NPC reciben el mismo equipo que el jugador; online conserva el equipo individual validado por el servidor.
