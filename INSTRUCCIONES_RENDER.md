# De este ZIP a GitHub y Render

## 1. Extraer el proyecto

Descomprime el ZIP y abre `tirante-github-render`. Allí deben estar `package.json`, `README.md`, `render.yaml`, `game/` y `server/`.

**Sube el contenido de esa carpeta al repositorio, no el ZIP.** `package.json` y `render.yaml` deben quedar en la raíz del repositorio. Incluye también `.gitignore`, `.node-version` y `.env.example`.

## 2. Crear el repositorio nuevo

En [GitHub](https://github.com/new), crea un repositorio vacío llamado, por ejemplo, `tirante`. Elige público o privado. No marques la creación automática de README, licencia ni `.gitignore`: este paquete ya contiene los archivos de inicio.

Si usas la terminal, ejecútalo desde la carpeta extraída. Sustituye `TU_USUARIO` por tu usuario de GitHub y `tirante` por el nombre elegido:

```sh
git init
git add .
git commit -m "TIRANTE 1.7.0 preparado para Render"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/tirante.git
git push -u origin main
```

Necesitas tener Git instalado y autenticarte con GitHub. También puedes usar la opción de cargar archivos de GitHub y arrastrar los archivos y carpetas extraídos, respetando la estructura. Conserva una copia local para seguir desarrollando.

## 3. Elegir el tipo de guardado

| Archivo Blueprint | Uso | Datos de salas y estampados |
| --- | --- | --- |
| `render.yaml` | Continuar trabajando con guardado persistente | Servicio de pago y disco persistente de 1 GB en `/var/data` |
| `render-free.yaml` | Prueba gratuita | Archivos temporales: se pierden al reiniciar, redesplegar o suspenderse el servicio |

La opción persistente usa el plan `0.5c-512mb` y una sola instancia. Revisa en Render el costo del servicio y del disco antes de desplegar. La opción gratuita puede suspenderse por inactividad y tardar en despertar; es adecuada para pruebas. Fuente: [discos persistentes](https://render.com/docs/disks) y [limitaciones del plan gratuito](https://render.com/docs/free).

## 4. Conectar Render

1. Abre el [panel de Render](https://dashboard.render.com/).
2. Elige **New → Blueprint** y conecta tu cuenta de GitHub si hace falta.
3. Selecciona el repositorio nuevo y la rama `main`.
4. En **Blueprint Path**, deja `render.yaml` para guardado persistente o escribe `render-free.yaml` para la prueba gratuita. Elige una de las dos opciones.
5. Revisa el servicio y el costo que muestra Render. Pulsa **Deploy Blueprint** cuando quieras crearlo.
6. Espera a que termine el despliegue y abre la dirección que Render le asigne al servicio.

El Blueprint configura Node, el comando de construcción, el arranque, las variables y el chequeo de salud. No necesitas crear Postgres, Redis ni un bucket. Guía oficial: [Render Blueprints](https://render.com/docs/infrastructure-as-code).

### Si prefieres crear el servicio manualmente

Elige **Web Service**, porque el multijugador y la carga de imágenes necesitan ejecutar el servidor. Configúralo así:

| Campo | Valor |
| --- | --- |
| Branch | `main` |
| Root Directory | Vacío si `package.json` está en la raíz |
| Language / Runtime | Node |
| Build Command | `npm ci && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/healthz` |
| `NODE_VERSION` | `24.19.0` |
| `NODE_ENV` | `production` |
| `TRUST_PROXY` | `1` |
| `DATA_DIR` con disco | `/var/data/tirante` |
| `DATA_DIR` en prueba gratuita | `/tmp/tirante-data` |

Para persistencia, selecciona un servicio de pago, adjunta un disco de 1 GB montado en `/var/data` y conserva una sola instancia. Usa un solo proceso Node, sin modo cluster. Render proporciona `PORT`; el servidor escucha en `0.0.0.0`.

## 5. Probar el despliegue

Abre la dirección del servicio y comprueba estas acciones:

- Lanza el volantín y usa soltar, recoger y tirón.
- Abre el taller, mueve los amarres y carga una imagen.
- En Duelo online, crea una sala. Abre el enlace en otro navegador o dispositivo, entra como segundo jugador y pulsa Listo en ambos.
- Comprueba que `/healthz` responda con `"ok":true`.

El ZIP fue comprobado localmente, pero todavía no se ha creado un repositorio ni un servicio Render con él. Los datos e imágenes de la instalación anterior no están dentro del ZIP. El nuevo sitio no hereda el acceso privado de Sites.

## 6. Seguir trabajando

Edita los archivos, prueba con `npm run dev`, ejecuta `npm test` y sube un commit a GitHub. La configuración incluida activa el despliegue automático al subir cambios a la rama conectada.

```sh
git add .
git commit -m "Describe tu cambio"
git push
```

`game/` contiene el juego, `server/` el servidor y `tests/` las pruebas. `.gitignore` excluye `.env`, la base local, imágenes subidas durante el uso y dependencias. No subas la carpeta de datos de una partida.

## Si algo falla

| Síntoma | Revisión |
| --- | --- |
| Render no encuentra `package.json` | Comprueba que subiste los archivos extraídos en la raíz o ajusta Root Directory |
| Error de `node:sqlite` | Comprueba `NODE_VERSION=24.19.0` y usa Node 24 |
| Juego carga, pero online no responde | Revisa que creaste un Web Service y que Start Command sea `npm start` |
| Imágenes desaparecen al desplegar | Usa la opción con disco y `DATA_DIR=/var/data/tirante` |
| El servicio tarda en abrir | Una instancia gratuita puede estar despertando; revisa su estado y logs |
| Arranque falla por permisos de datos | Comprueba el punto de montaje del disco y `DATA_DIR` |

Referencias: [subir código local a GitHub](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github), [Web Services](https://render.com/docs/web-services), [versión de Node](https://render.com/docs/node-version), [referencia de Blueprint](https://render.com/docs/blueprint-spec).
