# TIRANTE · El pulso del viento

> Documento histórico del modelo y las versiones anteriores. Las menciones a Vinext, Workers, Sites, D1 y R2 describen el alojamiento original. Para ejecutar o desplegar esta exportación Node/SQLite, sigue el README y `INSTRUCCIONES_RENDER.md` de la raíz.

Single-line kite simulator with first-person and orbital views, free flight, a collectible time trial, local Party rounds against 1–3 NPCs and authoritative online duels for two. Three.js is vendored locally. A Canvas perspective fallback uses the same 3D state when WebGL is unavailable. The game does not add accounts or analytics; hosting access is controlled separately by Sites.

## Running and validation

Run `npm run dev` for the Vinext/Workers app. `npm run build` produces the Worker and client assets. `game/` is the source of the imperative game; the prebuild/predev script copies it into public assets and generates the server-rendered shell. Run `npm run check` for flight, rope/contact, camera, customization, uploads and online regressions. Online rooms need the D1 `DB` binding in `.openai/hosting.json` and the generated `drizzle/` migrations. Uploaded sail prints use the R2 `BUCKET` binding. Sites provisions the hosted bindings and applies migrations at deployment; local previews need those migrations applied separately.

## Controls

- Launch button or Space: launch from the ground. Space in flight: short pull.
- Hold Q / E or the screen controls: release / retrieve line. Holding Shift multiplies either rate by 2.5, including when added or released mid-action.
- Hold F or Aserruchar during a commission: alternate actual payout/retrieval strokes while the ropes touch. Q / E can also perform manual strokes. Shift accelerates the same line motion.
- Shift + Space: exactly two short pulls, separated by 0.22 seconds of simulation time. The on-screen Boost toggle also enables double pulls.
- Giving line permits multiple rotations. Retrieval and pulls arrest rotation at the current heading, including a downward dive; line slack must first be taken up. The HUD counts complete rotations.
- V: switch first-person / third-person orbital camera. Drag the sky to look or orbit around the kite; the orbital wheel and + / − buttons set distance between 2 and 24 m. C resets the orbit or toggles first-person tracking. First-person wheel keeps optical zoom.
- G: Rastro de luz, an eight-spark time trial. N: local Party.
- T: bridle workshop. R: reset to ground. Escape: menu (local flight pauses; online continues).
- Wind and configuration changes save locally. Audio is optional and starts only on request.

## Physical scope

The real-time model integrates translation at a fixed 240 Hz using apparent wind, lift and drag, gravity, a unilateral elastic tether, a reduced orientation/spin equation, and tension-dependent visible sail flex. Rotation is freer during payout; active retrieval and tug pulses temporarily reduce automatic self-righting. Pulse timing is part of the fixed-step simulation and therefore freezes with pause, and resets on landing/restart. The flight body uses lumped tether weight and drag; a segmented XPBD chain now supplies the visible rope, collisions and contact deflection. A loaded crossing changes the tether path and the direction of the force on the kite. Bridle knots shorten their effective line lengths. Asymmetry, lower-bridle trim, mass and the damping tail alter the model.

It is a qualitative reduced model, not a CFD, cloth, or fully coupled engineering cable solver, and has not been calibrated against an instrumented physical specimen. No numeric claim of physical fidelity is made. The triangle is a comparative setup aid, not a measured performance chart. Left/right trim sign is a convention of this model and depends on bridle geometry in a real kite.

Primary background: NASA Glenn kite forces; Donnelly, RIT (2013), *An Experimental Study of the Dynamics of a Fighter Kite*; Fechner et al. (2015), *Dynamic Model of a Pumping Kite Power System*; Puga, ARQ (2003), *Volantín*. The large-power-kite coefficients are not copied into this small-kite model.

## Source layout

- `game/physics.js`: deterministic physics and setup mapping.
- `game/scene.js`: procedural landscape, sail, bridle, reel, camera and rope.
- `game/app.js`: input, menus, workshop, instruments, persistence and sound.
- `game/style.css`: desktop and mobile presentation.
- `tests/physics.mjs`: meaningful simulation checks (no WebGL needed).

Three.js is distributed under the MIT license; see `game/vendor/LICENSE.three.txt`.

## Version 1.2: supplies and commissions

- Select a 30, 65, 100 or 150 m spool in the right-hand flight panel. Remaining line updates live; a smaller spool cannot discard line already deployed. The choice persists locally.
- Character stamina pays for line work and pulls. Boost uses 14–22 energy/s, regular retrieval uses a smaller tension-dependent amount, and resting restores 6/s. A single pull costs 7 energy, a double pull 14. Empty stamina disables boost until recovery reaches 20%; gentle retrieval remains available. The queued second pulse is prepaid.
- Wind now ranges from 3.6 to 43.2 km/h at the reference height. The “Viento firme” preset starts at 32.4 km/h; shear and gusts can raise the live measured value above the base. New players start with 19.8 km/h, while saved settings are retained.
- Press N or choose Comisiones to challenge Mateo, a local NPC. Choose normal or competitive behavior. Both use the same wind, spool limit, stamina rules and physical integrator. A round lasts up to 90 seconds, following a three-second launch phase. Changing wind, trim or spool is disabled during a round.
- The NPC steers with a fixed bridle and the same payout/retrieval controls. Version 1.3 replaces the former proximity damage rule with physical strand contact and localized work-based abrasion; see below.
- A cut line or grounded opponent ends the round; otherwise remaining line integrity decides at the time limit. The result screen offers a rematch or free flight. Results persist in this browser. Pause, hidden-tab handling and menus freeze both simulations and the timer.
- NPC commissions remain optional and local. Version 1.4 adds a separate online mode.

Context for the term “comisión”: Chile para Niños, Biblioteca Nacional, [El volantín](https://www.chileparaninos.gob.cl/639/articles-589192_archivo_01.pdf), describes aerial battles between kites. The implementation uses virtual line integrity and does not model or instruct the preparation of physical cutting line.

Run the regression suites with `npm run check`.


## Version 1.3: physical rope contact and sawing

`rope.js` runs 28 distance-constrained segments per intact tether at the same 240 Hz as flight. Wind and gravity move the internal particles. XPBD compliance softens extension, with ten alternating solver sweeps and additional contact/length sweeps during a collision. Segment pairs receive equal, opposite, mass-weighted separation and Coulomb-limited tangential correction. The original separating-plane crossing test is superseded in version 1.6 by distance-based conservative advancement and a final motion acceptance guard. The 3D contact vertices, rather than projected screen lines, determine a collision.

Both renderers draw those solver vertices. Since version 1.3.1, the physical hand boundary coincides with the visible reel outlet; there is no separate rendered join. Version 1.6 includes the hand-side edges in collision and keeps the physical hand fixed while the camera moves. The magnified contact panel projects the same vertices into the contact plane; it displays estimated normal load and measured stroke reversals. Gold highlights and fraying show the contact and local wear. No independent sag curve is used for the airborne tether.

The reduced body solver uses the deflected path through a contact to change extension and force direction. Contact load also resists payout/retrieval. Short sawing strokes under tension provide less free spin than paying out loose line. The NPC can visibly walk forward/backward (limited to 0.65 m/s over a 6 m band) to align a real crossing; it never teleports a kite onto the player.

Abrasion uses measured payout/retrieval travel, normal pressure and a friction coefficient. A reversal needs at least 4.5 cm of travel over 45 ms; alternating key events faster than that do not count as saw strokes. Holding still does no wear. A one-way pass gives only 8% of the alternating-work factor. Both strands receive symmetric wear rules: the moving strand exposes fresh fibres while its stroke works mostly into the opposing patch. Wear is stored in 12.5 cm material bins measured from the kite; integrity reports the weakest remaining patch. Capacity and stamina still limit actual movement. F performs actual alternating controls, not an abstract damage action.

When a patch fails, two free endpoints are inserted at the contact fraction and their connecting constraint is removed. The hand-side and kite-side strands continue under gravity/wind and recoil; the cut line does not disappear. Reset clears all wear, contact and fracture state. The result dialog waits 2.5 simulation seconds to let the break play out.

### Numerical scope

This is a playable reduced physical simulation, not a calibrated prediction of real thread fracture. The effective collision radius is 8 mm per strand (16 mm separation), intentionally thicker than real kite thread for stable real-time contact. Version 1.6 resolves multiple edge contacts and nonadjacent self contacts and guards the final motion continuously. It still does not model twist, fibre-level mechanics or the full mechanics of tied knots. Compliance uses normalized internal particle weights. Normal force is estimated from the flight tension and crossing angle; the body/rope coupling is reduced, not a unified force solve. Friction (0.36), local fracture-work scale (1.2 model joules), wear allocation and stamina are tunable gameplay estimates. No 99.5% or 100% fidelity claim is supported.

Algorithm sources consulted:
- Macklin, Müller and Chentanez (2016), [XPBD: Position-Based Simulation of Compliant Constrained Dynamics](https://matthias-research.github.io/pages/publications/XPBD.pdf).
- Interactive Computer Graphics, [Position-Based Dynamics teaching example](https://learn.physics-simulation.org/examples/pbd.html).

These sources inform constraint integration; they do not validate the cotton wear coefficients or this game's aerodynamics.

## Version 1.3.2: clearer commission view

During commissions, the compact scoreboard sits at the left edge on desktop, and the rope contact detail is collapsed until “Ver cruce” is opened. The sawing control is part of the bottom action dock. Portrait layouts use a shallow top scoreboard and compact corner instruments, leaving the middle for flight.

The commission camera eases 1.15 m behind the usual eye position and uses a minimum vertical field of view of 74° (82° for portrait viewports), expanding as needed to fit both sails and the crossing. The physical pilot and reel stay in place when the view retreats. The “Ver ambos” control restores tracking after free-look; close optical zoom is available in free flight. Returning to free flight restores its original viewpoint.


## Version 1.4: online duels for two

Choose **Duelo online**, enter a nickname and create a room or join with its 8-character invitation code. The host chooses the wind and spool. Both players bring their workshop setup and must press Ready. A round starts after a three-second launch; play uses Q/E, F, Shift, Space, and W/A/S/D or on-screen arrows for bounded physical footwork. Results offer a rematch; both must ready again. Local NPC play is retained.

### Authority and transport

`server/online-match.js` runs the existing 240 Hz kite, XPBD rope, contact, wear and fracture model. The NPC controller is disabled for online matches. Clients send controls, never positions, damage or outcomes. Full integrator state, both strands and sparse material wear survive Worker restarts in D1. A revision-checked update serializes concurrent requests; a failed revision retries against the latest room instead of overwriting the other player. Private seat tokens are random, stored in sessionStorage, hashed in D1, and absent from invitation URLs and snapshots. A room has exactly two seats. Input/tug sequence numbers reject replayed commands; a double tug is scheduled once by simulation time.

This version uses same-origin HTTP input/snapshot requests, approximately every 90 ms plus round-trip time while active, and less often in the lobby/background. Rendering interpolates successive server frames. This is real networked multiplayer, not a same-browser channel. It is **not WebSocket transport** and does not provide client prediction or lag compensation. Expect input delay on distant/slow connections; it is intended for small private two-player trials, not a load-tested tournament service. Requests simulate at most 250 ms of catch-up to bound Worker CPU; prolonged latency can slow the simulation.

Controls time out to hold after 700 ms without a fresh heartbeat. After 3.5 seconds without a player, the match pauses and grants 25 seconds to reconnect using the same tab/session. Expired grace awards a forfeit; both absent gives a draw. Reloading reconnects the same seat. Opening a menu releases controls but does not pause the online opponent. Leaving ends that player's participation; create another room for a different opponent. Idle rooms expire after 30 minutes. Room creation/join attempts are limited per hashed network identifier/hour.

Online camera movement never changes the server rope anchor; the visible reel is positioned at the shared physical outlet. Each client translates world geometry to its own pilot, preserving the shared rope geometry. The result dialog waits 2.5 seconds so the cut strands remain visible.

### Validation

- Existing physical flight, rope, anchor, camera and NPC suites remain unchanged in meaning.
- `tests/online.mjs`: independent controls, serialized integrator continuation, concurrent ticks and joins, seat authorization, duplicate double-tug rejection, exact cut vertices for both views, reconnect, forfeit and rematch.
- Browser: two independent tabs joined the same D1 room, readied, completed a 90-second round and received the same result. A Shift-click on player two produced two authoritative pulls, with zero player-one pulls. A 390×844 mobile viewport joined a separate desktop client; touch footwork moved its physical anchor and releasing the button cleared the command. Reloading the desktop client resumed the same round/seat.
- Browser QA uses the Canvas fallback because the cloud browser does not expose WebGL. WebGL geometry/camera behavior is covered by the Node regressions; a hardware WebGL session and two geographically separated connections remain useful follow-up checks.

The current hosting audience remains private until the owner chooses a wider audience or invites a viewer. An in-game room code does not override hosting access.


## Version 1.5: local Party, one player against up to three NPCs

Choose **Modo Party** from the start screen or press **N** during free flight. Select 1, 2 or 3 NPCs and Tranquilo/Competitivo. Mateo, Alma and Nico have distinct sail/line colours, spawn positions and attack timing. The NPC count persists in this browser. One opponent allows 90 seconds; two or three allow 120, after a three-second launch. Everyone uses the player's wind and spool capacity, with full starting stamina. A calm preset is replaced by the same 6.5 m/s launch breeze used by local commissions.

`game/party.js` extends the local commission controller without changing the two-seat online server or protocol. Each pilot and its 28-segment tether step once at 240 Hz. All six unordered pairs can collide in a four-kite round, including NPC/NPC pairs. Stroke measurements advance once per pilot, not once per contact. Every crossing deforms both ropes and contributes localized abrasion. The reduced flight body follows its strongest current contact; version 1.6 adds geometric self contact and multiple contacts, while force coupling still follows the strongest contact rather than a unified cable/body force solve.

A cut or grounded NPC is eliminated independently; the other opponents continue. Broken strands keep simulating and rendering. The human wins by remaining airborne after all NPCs are eliminated; losing the human kite ends the round. Simultaneous elimination of everyone is a draw. At the limit, compare the human's integrity with the highest integrity among surviving NPCs; a difference below one percentage point is a draw. Pause and hidden tabs freeze local play. The result lists every participant, and a rematch resets all cuts, wear, stamina, AI state and elimination events.

Desktop uses a compact four-player roster at the left edge; portrait layouts arrange it in two columns. Each row shows line integrity, stamina and elimination status. The camera frames all surviving sails and current contact points; it retreats up to 2.55 m from the normal eye, while the physical hand remains anchored. **Ver todos** restores tracking after free-look. Both WebGL and Canvas render all three independent NPC models and the actual rope geometry.

`tests/party.mjs` covers roster sizes, equal simulation time, all six collision pairs, static contact without wear, actual sawing wear, no distant damage, exact cut points, sequential elimination, win/loss/draw/timeout, complete natural rounds with 1–3 NPCs, rematch cleanup, online handoff, and portrait/desktop four-kite framing without rope-anchor movement.

Browser validation for 1.5 used the Canvas fallback: started all three roster sizes, verified paused time and locked roster settings, saw an NPC eliminated while the round continued, verified participant results and a full-health rematch, and checked 390×844 portrait framing. Screenshots are in `docs/tirante-party-desktop.jpg` and `docs/tirante-party-mobile.jpg`. Extra competitive three-NPC simulations with gusts at 1, 9 and 12 m/s remained finite and reached results. Full existing flight/rope/camera/online suites and TypeScript checks passed. Hardware WebGL browser verification remains outside this environment; shared geometry/anchor/camera regressions cover the rendering math.


## Version 1.6: Rastro de luz, orbital camera and preserved strand order

**Rastro de luz** is a local sequential time trial. After a three-second launch, fly through eight golden targets in order. The next two appear as faint breadcrumbs. The timer starts at 90 simulation seconds; each pickup adds two. A swept kite-center/sphere test catches a target crossed between ticks. The visible ring and pickup sphere share a 0.95 m radius. Collecting produces a spark burst, highlights progress and reveals the next target; an edge indicator points toward an offscreen target. Finish earns gold (≤30 s), silver (≤55 s) or bronze. A course-versioned best completion time is stored locally. Timeout or landing ends the attempt. Menus and hidden tabs pause local clocks. Restart clears every pickup, timer and result.

The course fixes the breeze at 5.5 m/s, the spool at 65 m, the default balanced bridle, and wind phase, preserving paper colour. Returning to free flight or entering Party/online restores the player's saved setup, wind and spool. Settings cannot be changed during an active trial. Course points are fixed world positions: they are not dragged toward the kite, and no autopilot or positional capture force is used.

**Orbital camera** centers on the kite in every flight mode. Mouse/touch drag adjusts azimuth and elevation; wheel or on-screen + / − changes distance. The eye stays above the ground. Camera position eases, but orientation always targets the kite. V returns to first person; C restores the default orbit. Rendering never writes to the physical hand anchor. The first-person reel is drawn at that boundary; it is hidden while orbiting. The Canvas fallback now draws a full horizon panorama to avoid projecting hills from behind the observer.

**Rope system** (`game/rope-system.js`) considers all intact strands together, including hand-side edges, low/ground-level contacts, multiple cross contacts, and nonadjacent edges of the same strand. A swept AABB broad phase feeds conservative advancement using a bound on relative endpoint displacement. This detects crossings including parallel and tangential cases without relying on a separating-plane flip or fixed temporal samples. Six mass-weighted contact projection passes interleave length constraints. A final continuous guard checks the fully corrected motion and, if necessary, limits the accepted step before the first unresolved crossing. It retains the previous ordering rather than teleporting the cord through a snag. Near-contact starting pairs use an adaptive positive clearance; exactly intersecting initial fixtures have no previous ordering and are separated by projection.

Contacts target a 20 mm solver skin, with a 4 mm final guard. These are numerical clearances for a playable reduced chain, not measured thread thickness. A difficult unresolved tangle can restrict motion until it slides free or wears through. Collision itself never cuts a strand, deletes a knot, resets a rope, or invents wear. Abrasion still requires actual line travel under load; the strongest contact per strand pair represents work so a densely sampled contact does not multiply damage. Self contact blocks geometry but does not yet generate self-abrasion. After fracture the severed rope continues to render its moving free ends and is removed from intact-strand collision constraints. Grounded, unbroken strands remain collision participants while the round runs. The online client's interpolated geometry receives the same final guard so snapshots cannot visually reverse strand ordering between server updates.

This is not a full IPC implementation, a fibre simulation, or a mathematical guarantee for arbitrary invalid initial knots, unlimited timestep/displacements or machine precision. The guarded reduced model is tested within the game's fixed-step regime; no 99.5%/100% physical-accuracy claim is made. The continuous-distance approach is informed by primary research: [Codimensional Incremental Potential Contact, Li et al. (2021)](https://ipc-sim.github.io/C-IPC/) and its [paper](https://ipc-sim.github.io/C-IPC/file/paper_small.pdf), plus the reference [IPC Toolkit](https://github.com/ipc-sim/ipc-toolkit). These inform numerical collision detection, not the game's uncalibrated wear/flight coefficients.

Validation: `tests/rope-system.mjs` covers rapid crossings up to 100 m per candidate step, parallel/grazing contacts, finite-edge near misses, self contact, simultaneous contacts, hand/floor edges, final XPBD separation, static zero wear, release after fracture, serialized contact-state continuation, and 931,234 edge-pair checks during a natural four-pilot round. It also checks the online render guard and authoritative fracture. `tests/trail-orbit.mjs` completes the eight-target course in 30.97 s with ordinary Q/E commands and the actual rope solver, checks ordered/swept pickup, timeout, landing, no idle win, restart, restored settings, orbital bounds/centering, stationary hand, and WebGL target/burst geometry. Existing flight, commission, Party and online regressions remain part of `npm run check`.

Browser QA for 1.6: 1363×936 desktop and a 390×844 portrait viewport, sequential first pickup and new target, mouse orbital drag with centered kite, mobile distance buttons, paused clock staying at 01:17, locked challenge setup, and switching modes. The visual review uses Canvas because the cloud browser has WebGL disabled; GPU rendering is covered here by camera/rope/target geometry regressions, not a hardware browser run. Screenshot: `docs/tirante-rastro-orbital-v16.jpg`.


## Version 1.6.1: unobstructed mobile flight

`game/compact-ui.js` activates for widths up to 760 px or landscape viewports up to 560 px high, including the space lost to mobile browser chrome. The top edge shows line length, wind and stamina; independent 56 px controls sit along the bottom edges. There is no central message/boost/control panel. **Datos** opens the full instruments, spool selector, turns, stamina and round scoreboard; **Vista** opens camera mode, distance and centering. Sound, visual assists, help and game modes remain in the menu. Local play pauses in the data sheet; online play continues and the sheet explicitly says so.

Existing instrument nodes move into the sheet rather than being duplicated, preserving all bindings and game state. Returning to desktop restores the same nodes to their original positions. Breakpoint/orientation changes release held controls; camera tools dismiss when the sky is touched or a modal opens. Safe-area insets protect the controls from notches and the home indicator. Party and Rastro de luz use a single 44 px round summary; online footwork uses one row of four 44 px arrows. The short landscape start screen exposes every game mode.

Browser QA covers 844×334 and 740×300 landscape, 390×780 and 360×640 portrait, and restoration to 1280×800 desktop. Checked launch, held release/reel, boost, double pull, camera mode/zoom, spool selection, data-sheet dismissal, three-NPC Party, the time trial (one target collected), and state-preserving layout changes. Browser rendering uses the existing Canvas fallback; this UI change does not modify flight, rope or network physics. Full physical/online regression suites, JavaScript syntax, TypeScript and production packaging are checked before deployment.

## Version 1.7: movable attachments and custom paper

The straight and bowed spars sit behind the sail (negative local Z); the bridle anchors, lines and knots are on the opposite, pilot-facing side. Their positions follow sail deformation. The workshop offers front/back inspection and the same curved-spar geometry as both renderers.

In **Tirantes**, drag I/D on the diagram or use either range/keyboard control. Each attachment travels independently from the midpoint to 95% of its half-span. Wider symmetric placement increases stability and spin damping. Symmetric central placement remains balanced but turns faster during payout. Unequal placement contributes a signed turning bias, combined with effective bridle lengths and knots. The stability triangle and bias indicator update immediately. Presets open, normalize or center both mounts; “Igualar posiciones” preserves their average spread. Old saved setups retain the original 55%/55% behavior.

These spread/turn coefficients implement the requested qualitative behavior; they are not empirical measurements or a 99.5% fidelity claim. General bridle/torque background: [NASA Glenn, Kite Stability](https://www.grc.nasa.gov/www/k-12/airplane/kitestab.html) and [Kite Trim](https://www.grc.nasa.gov/www/K-12/airplane/kitetrim.html).

In **Diseño**, choose the classic pattern, a flat color (eight presets or a color picker), or upload PNG/JPEG/WebP up to 12 MB. The client decodes and reduces the image to a PNG with a longest side of at most 768 px (512 px if needed to fit the 1.1 MB storage limit). “Imagen completa” fits the rectangular image inside the diamond; “Cubrir” fills the paper and crops its edges. Scale adjusts from 1–2.5×. Appearance does not alter mass or flight trim.

`POST /api/prints` validates the bounded PNG and stores it by SHA-256 in R2; `GET /api/prints/[id]` serves immutable raster images through the same Site access boundary. Setup saves the content ID locally, and online payloads carry that small reference instead of image bytes. Upload attempts share a separately keyed 30/hour D1 limit. Removing a print detaches it from this kite; it does not erase a shared immutable object. Party keeps the player's design and gives NPCs their own classic colors. The time trial preserves appearance while applying its existing standard physical setup, then restores the player's full setup on exit.

Validation: existing flight/contact/Party/online/trail suites; real flight comparisons for mount separation and mirrored imbalance; actual Three.js spar, bridle, knot and UV geometry under deformation; online setup serialization; durable image writes and streamed size limits. Browser QA covers image upload/readback, fit modes, reload persistence, flat colors, SVG dragging, desktop and 390×780 / 844×334 layouts, and the printed kite in orbital flight. This browser used the Canvas fallback; WebGL geometry/materials were checked without a GPU. No claim of testing on a physical phone is made.


## Tensión y cruces · 1.9.0

El guardado continuo del movimiento y el recogido de contactos ahora comparten los cruces que empiezan dentro del radio de contacto. También se incorporan los contactos que aparecen en la última corrección de longitud. Antes podían bloquear un hilo sin activar carga ni desgaste. La fracción de movimiento se limita por componentes de candidatos barridos; las hebras alejadas continúan su recorrido. Se conserva la separación continua, incluidos autoenredos, sin teletransportar ni reiniciar las cuerdas.

`line-stress.js` usa una resistencia inicial de 90 unidades de fuerza del modelo, reducida según el desgaste del punto: `90 × max(0,12; 1 − 0,88 × desgaste)`. No es una especificación medida de hilo de algodón. En un cruce, la carga combina la tensión de vuelo, el pulso de recogida y la deformación acumulada por el movimiento rechazado. Soltar hilo descarga esa deformación. Se evalúa el punto más exigido de cada hebra una vez por paso, sin multiplicar daño por el número de contactos geométricos. Una sobrecarga debe acumular una dosis de 0,03 segundos normalizados para fracturar; un pico aislado se recupera. Entre fallos listos del mismo cruce, cede primero la mayor proporción de carga/resistencia, y la otra hebra se descarga. Un empate exacto puede cortar ambas: no hay preferencia por jugador ni NPC.

Cada lanzamiento deriva una sola selección del 10 % de una semilla por vuelo. Para viento base de al menos 8 m/s y perfil distinto de calma, esa selección puede producir una ráfaga de 2,4 s entre los segundos 12 y 30. La intensidad sube y baja suavemente hasta 2,55 veces el viento normal; entra en las fuerzas aerodinámicas reales del simulador. No se resta vida al azar: el corte requiere superar la resistencia durante suficiente tiempo, después de la fase inicial de lanzamiento. Soltar rápido puede salvar el hilo, pero sigue siendo necesario controlar el giro y evitar tocar tierra. La selección, la dosis, el desgaste y el motivo del corte se conservan al serializar una sala; los dos asientos reciben el resultado del servidor.

Los valores de resistencia, pulso y ráfaga son calibración de jugabilidad. El 10 % se refiere a la selección por vuelo, no a un porcentaje de cortes garantizado para toda duración, viento o técnica de control.


## Party y supervivencia · 1.10.0

El papel usa alpha 0,45: corresponde al 55 % de transparencia solicitado. Los participantes parten en x = 0, 6, −6 y 12 m, con 6 s de preparación. Los pasos de los NPC conservan al menos 2,5 m entre pilotos; nunca mueven directamente el volantín. El trabajo local de fractura por desgaste pasa de 1,2 a 3,6 unidades y la dosis de sobrecarga en un cruce de 0,03 a 0,06 segundos normalizados. Son reglas simétricas para humanos y NPC; el corte por ráfaga libre conserva la dosis de 0,03.

La IA decide cada 0,18 s (Hábil) o 0,10 s (Competitivo). Escoge el rival vivo más cercano, aproxima los segmentos reales del hilo, hace barridos controlados para buscar contacto, recoge para igualar distancia, descarga por sobrecarga, protege energía y usa tirones cuando tiene margen frente a un hilo rival exigido. Sigue sujeta a los controles y a la misma física. No garantiza victoria ni recuperación de cualquier picada.

Party mantiene el estado `playing` cuando el jugador cae y quedan al menos dos pilotos. `spectating` desactiva sus controles; la cámara orbital sigue a un superviviente o la cámara general encuadra solo a los que siguen en juego. Cambiar el observado o la cámara no modifica la simulación. Los NPC siguen eligiendo rivales vivos. En Último en pie no hay desempate por reloj: la partida concluye con cero o un superviviente. La variante con tiempo conserva la comparación de integridad al acabar los 180/240 s, considerando solo participantes vivos.

Una cuerda intacta cuyo dueño está en `grounded` se fractura antes de reunir contactos, con motivo `ground`. Conserva su estado de aterrizaje y los dos extremos visibles; no participa después en las barreras de colisión. La limpieza se aplica también al duelo de dos asientos, y los mensajes distinguen aterrizar de perder el hilo durante el vuelo.
