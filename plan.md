# LA MISIÓN TOPOLEV — Plan de desarrollo

> ⚠️ **AVISO DE SPOILERS**: este documento describe el diseño completo del juego
> (premisa, mecánicas, finales). Si quieres jugar con sorpresa, **no sigas leyendo**:
> ve directamente a `README.md` para saber cómo abrir el juego.

---

## 0. Cómo usar este plan (para la siguiente sesión)

- Cada tarea tiene una casilla `[ ]`. Cuando se completa se marca `[x]`.
- Trabajar **en orden de fases**. Dentro de cada fase, en orden de tareas salvo que se indique.
- Tras completar cada fase (o un bloque grande de tareas): `git commit` + `git push` a la rama de desarrollo.
- Rama de desarrollo: `claude/great-thompson-4ohn15`.
- El juego es **HTML + JavaScript (módulos ES) sin build**: se abre con cualquier servidor estático
  (`npx serve .` o `python3 -m http.server`) y se publica tal cual en GitHub Pages.
- Pruebas:
  - Lógica (Node, sin DOM): `node tests/sim.test.mjs` (simulación acelerada de partidas completas).
  - Visual (Playwright + Chromium preinstalado): `node tests/visual.mjs` (capturas en `tests/shots/`, no se suben).
- Convenciones de código: 2 espacios, `;`, módulos ES, estado de partida = **JSON plano** (serializable
  directamente a `localStorage`), lógica de juego **sin dependencias del DOM** (`js/game/*`),
  presentación en `js/screens/*`, motor en `js/engine/*`.

---

## 1. Documento de diseño (resumen)

### 1.1 Premisa
1961. Desde el epicentro de Tunguska llega una señal de radio imposible. El Comité Central activa la
**Misión Topolev**: el **T-0 «Topolev»**, un colosal avión-laboratorio de propulsión atómica experimental
diseñado por la OKB del académico A. N. Topolev, debe cruzar la URSS desde Moscú hasta Tunguska con una
tripulación reducida, alcanzar el epicentro y recuperar **«el Objeto»**. El KGB vigila cada paso.

### 1.2 Género
Roguelite de **gestión de tripulación en tiempo real con pausa** + **rutas procedurales** + **equipamiento
modular** (estilo Cogmind) + **prosa procedural** (estilo Ultima Ratio Regum) + toques de FTL/RimWorld.

### 1.3 Bucle de juego
1. **Mapa regional** (estrategia): elegir el siguiente destino en un grafo de nodos sobre un terreno
   procedural de la región. Cada tramo tiene distancia, consumo estimado, peligro y meteorología.
2. **Vuelo** (táctica, tiempo real con pausa): corte transversal ASCII del Topolev. La tripulación se mueve
   entre salas, ocupa estaciones y atiende tareas: incendios, brechas, hielo, averías, heridos, combate,
   cocina, fabricación, política... **Micro-gestión** mediante arrastrar y soltar, matriz de prioridades,
   distribución de energía del reactor y régimen de motores.
3. **Llegada al nodo** (narrativa): evento con texto procedural y decisiones con tiradas de habilidad,
   o servicios (aeródromo: comerciar, reparar, repostar, reclutar).
4. **Hangar** (entre vuelos): instalar/desinstalar módulos procedurales arrastrándolos a las ranuras de cada
   sala; gestionar bodega, expedientes y prioridades.
5. Repetir a través de **5 regiones** hasta el **Epicentro**, con varios finales.

### 1.4 Recursos
| Recurso | Uso |
|---|---|
| Combustible (t) | Consumo de los motores por km según régimen y eficiencia |
| Raciones | Materia prima: el cocinero las convierte en comidas; sin cocinero se comen crudas (peor) |
| Comidas | Stock preparado en la cocina |
| Piezas | Reparaciones, fabricación, moneda de trueque |
| Medicinas | Curar heridas, radiación, enfermedades |
| Munición | Torretas |
| Vodka | Moral (riesgo de embriaguez) |
| Rublos | Comercio |
| Conocimiento | Se obtiene estudiando la Señal y anomalías; afecta a la región final y finales |
| **Sospecha (KGB)** | 0–100. A 100 la misión es intervenida: derrota |
| **Plazo** | Días límite marcados por Moscú; pasarse aumenta la sospecha |

### 1.5 La nave (T-0 «Topolev»)
Corte lateral con dos cubiertas, góndolas de motor y torretas. Salas:
Cabina (piloto/copiloto), Navegación, Radio, Comisaría (comisario político), Comedor-Cocina,
Dormitorio (literas limitadas → turnos), Enfermería, Taller, Sala de máquinas, Reactor, Bodega,
Góndolas de motor ×2, Torretas dorsal / ventral / de cola.
Cada sala tiene estado: temperatura, presión/oxígeno, fuego, brecha, radiación, integridad, iluminación.
Cada sala tiene **ranuras de módulo** (motor, reactor, radar, radio, arma, blindaje, literas, cocina...).

**Energía**: el reactor produce N unidades que se reparten entre sistemas: Calefacción, Soporte vital,
Armas, Radar, Radio, Enfermería, Cocina, Taller. Más carga = más calor del reactor → radiación,
riesgo de fusión; el operador puede hacer **SCRAM**.

**Motores**: régimen Económico / Crucero / Máximo (velocidad vs. consumo vs. desgaste). Hielo, averías.

### 1.6 Tripulación
Generada proceduralmente: nombre, patronímico, apellido, origen, retrato ASCII procedural, 9 habilidades
(Pilotaje, Navegación, Ingeniería, Medicina, Radio, Artillería, Cocina, Política, Ciencia),
2–3 rasgos (positivos, negativos y **ocultos**: informante, saboteador...), necesidades
(salud, fatiga, hambre, frío, moral, radiación, embriaguez).
**Matriz de prioridades** por tripulante y categoría de tarea (0–3). Órdenes directas por arrastrar y soltar.
Comportamiento autónomo según necesidades + **política de turnos**. Crisis nerviosas con moral baja.

### 1.7 Incidentes y combate (en vuelo)
Director de incidentes según peligro del tramo, meteorología, estado de la nave y rasgos:
avería, incendio, brecha, engelamiento, turbulencias, sobrecalentamiento, heridos, mensajes de Moscú,
peleas, sabotaje, anomalías, PVO (código IFF), interceptores.
**Combate**: contactos en un radar ASCII con barrido; torretas tripuladas disparan (munición, energía,
habilidad); el enemigo golpea salas (daño, fuego, brecha, heridos); maniobra evasiva, selección de
objetivo, señuelos.

### 1.8 Mapa
5 regiones: I Llanura Rusa, II Montes Urales, III Siberia Occidental (pantanos), IV Taiga Central,
V Zona Tunguska (árboles abatidos en patrón radial). Terreno por ruido + ríos + Transiberiano + ciudades.
Grafo de nodos por columnas (oeste→este). Frentes meteorológicos que se mueven cada salto.
Tipos de nodo: Aeródromo, Koljós, Ciudad cerrada, Gulag, Estación científica, Restos de avión,
Base militar (PVO), Aldea, Anomalía, Desconocido, Frontera regional, Epicentro.

### 1.9 Partido / KGB
Sospecha sube por: decisiones desleales, directivas fallidas, retrasos, disidentes descubiertos, informante.
Baja con: el comisario (informes, sesiones políticas), directivas cumplidas, decisiones ortodoxas.
Rasgos ocultos (informante, saboteador) que el comisario puede **investigar**.

### 1.10 Final
Región V → nodo **Epicentro**: fase de vuelo final «La Señal» (anomalías intensas) y decisión final:
entregar el Objeto a Moscú, estudiarlo, destruirlo o desertar. Finales según sospecha, conocimiento,
tripulación viva. Puntuación.

### 1.11 Rejugabilidad
Semillas, 3 dificultades (Camarada / Estajanovista / Purga), 3 variantes del avión desbloqueables,
archivo de expedientes (historial), logros/desbloqueos, eventos con condiciones múltiples, rasgos ocultos,
módulos con afijos procedurales.

### 1.12 Dirección visual
Fondo negro, paleta de **naranjas** (del ámbar pálido al óxido), colores especiales: rojo (peligro/Partido),
azul hielo (frío/agua), verde radiactivo, blanco (destacados), dorado (medallas).
Todo es ASCII sobre una rejilla de canvas a pantalla completa. Capa moderna «lógica»: rollovers con
transición, arrastrar y soltar con fantasma suave, partículas ASCII (chispas, humo, nieve, brasas, trazadoras,
explosiones), barras con bloques parciales animadas, textos flotantes, sacudida de pantalla, efecto CRT
sutil (scanlines, viñeta, bloom), transiciones entre pantallas, sonido sintetizado.

---

## 2. Arquitectura de archivos

```
index.html            · punto de entrada (GitHub Pages)
css/style.css         · capas canvas, CRT, fuente
assets/fonts/         · DejaVu Sans Mono (woff2) + licencia
js/main.js            · arranque, bucle principal
js/engine/            · motor ASCII genérico
  term.js             · terminal canvas (rejilla, buffers, render de celdas sucias, glifos de caja)
  input.js            · ratón/teclado/rueda
  ui.js               · UI inmediata: paneles, botones, barras, tooltips, scroll, drag & drop, modales
  particles.js        · partículas ASCII (capa FX)
  fx.js               · tweens, easing, sacudida, destellos, textos flotantes
  audio.js            · sfx sintetizados con WebAudio
  rng.js              · RNG con semilla serializable + ruido
  storage.js          · localStorage (ranuras, ajustes, meta)
  util.js             · utilidades (clamp, lerp, colores, ajuste de texto, BFS)
js/game/              · lógica pura (sin DOM)
  constants.js        · paleta y constantes de ajuste
  data/*.js           · nombres, rasgos, módulos, eventos, incidentes, directivas, textos
  crew.js ship.js tasks.js ai.js flight.js combat.js director.js
  map.js events.js loot.js economy.js run.js meta.js
js/screens/           · pantallas (título, instrucciones, ajustes, nueva partida, mapa, vuelo,
                        evento, aeródromo, hangar, tripulación, fin, archivo)
tests/                · pruebas de simulación (Node) y visuales (Playwright)
```

---

## 3. Fases y tareas

### Fase 0 — Preparación
- [x] 0.1 Analizar requisitos y diseñar el juego
- [x] 0.2 Escribir `plan.md`
- [x] 0.3 Estructura del repo: `index.html`, `.nojekyll`, `css/`, fuente empaquetada, `README.md`

### Fase 1 — Motor ASCII
- [x] 1.1 Terminal canvas: rejilla a pantalla completa, HiDPI, redimensionado, tamaño de celda configurable
- [x] 1.2 Doble buffer (glifo, color, fondo) y render solo de celdas modificadas
- [x] 1.3 Dibujo procedural de caracteres de caja (─│┌┐└┘├┤┬┴┼ ═║╔╗╚╝...) y bloques (█▀▄▌▐░▒▓ y parciales)
- [x] 1.4 Capa FX (canvas superior) limpiada cada frame
- [x] 1.5 Input: ratón→celda (con fracción), clics, rueda, teclado, detección de arrastre
- [x] 1.6 UI inmediata: panel, texto con marcado de color `{o}...{/}`, ajuste de líneas
- [x] 1.7 UI: botones con rollover animado, deshabilitados, atajos de teclado
- [x] 1.8 UI: barras con bloques parciales y valor animado
- [x] 1.9 UI: tooltips enriquecidos, listas con scroll, modales con bloqueo
- [x] 1.10 UI: arrastrar y soltar (fantasma suave, destinos que aceptan/rechazan)
- [x] 1.11 Partículas ASCII (emisores: chispas, humo, nieve, brasas, explosión, trazadora, texto flotante)
- [x] 1.12 FX: tweens/easing, sacudida de pantalla, destellos, efecto CRT (scanlines, viñeta, bloom)
- [x] 1.13 Audio sintetizado (clic, hover, alarma, explosión, radio, motor, éxito) + volumen
- [x] 1.14 RNG con semilla (estado serializable) + ruido 2D
- [x] 1.15 Gestor de pantallas con transiciones (barrido/disolución ASCII)
- [x] 1.16 Persistencia: ranuras de guardado, ajustes y meta en localStorage

### Fase 2 — Pantallas base
- [x] 2.1 Título: logo ASCII animado, ambiente (nieve/brasas), menú (Continuar, Nueva, Cargar, Instrucciones, Archivo, Ajustes)
- [x] 2.2 Instrucciones: secciones navegables con ejemplos ASCII
- [x] 2.3 Ajustes: tamaño de letra, volumen, CRT, partículas, velocidad por defecto
- [x] 2.4 Nueva partida: dificultad, variante del avión, semilla, ranura
- [x] 2.5 Cargar partida: lista de ranuras con resumen

### Fase 3 — Datos y generación procedural
- [x] 3.1 Nombres rusos (nombres, patronímicos, apellidos, apodos), orígenes, topónimos por sílabas
- [x] 3.2 Rasgos (≥25) con efectos y visibilidad (oculto/visible)
- [x] 3.3 Generador de tripulantes (habilidades por especialidad, rasgos, retrato ASCII procedural)
- [x] 3.4 Generador de módulos: tipos, fabricantes (OKB ficticias), calidad, afijos, estadísticas, nombre
- [x] 3.5 Precios y rareza

### Fase 4 — La nave
- [x] 4.1 Plantilla ASCII del Topolev → salas, suelos, escaleras, puertas, estaciones, ranuras
- [x] 4.2 Estado por sala (temp, presión, fuego, brecha, radiación, integridad, luz)
- [x] 4.3 Render del corte transversal con estados animados
- [x] 4.4 Pathfinding (BFS sobre suelo + escaleras) y movimiento suave de tripulantes
- [x] 4.5 Módulos instalados → estadísticas de la nave (empuje, consumo, energía, blindaje...)
- [x] 4.6 Variantes del avión (Topolev, Bogatyr, Rassvet)

### Fase 5 — Tareas y tripulación (micro-gestión)
- [x] 5.1 Modelo de tareas: estaciones persistentes, tareas de incidente, órdenes de taller/política
- [x] 5.2 Matriz de prioridades (tripulante × categoría, 0–3)
- [x] 5.3 Asignación automática (prioridad, urgencia, habilidad, distancia, inercia)
- [x] 5.4 Órdenes directas: arrastrar tripulante a sala/estación/tarea; cancelar
- [x] 5.5 Necesidades y su evolución (salud, fatiga, hambre, frío, moral, radiación, embriaguez)
- [x] 5.6 Acciones autónomas (dormir, comer, calentarse, curarse, beber) y política de turnos
- [x] 5.7 Crisis nerviosas (beber, negarse, pánico, pelea) y efectos de rasgos
- [x] 5.8 Ritmo de trabajo (habilidad, fatiga, moral, frío, rasgos, embriaguez)

### Fase 6 — Simulación de vuelo
- [x] 6.1 Reloj de juego, pausa (Espacio) y velocidades ×1 ×2 ×4
- [x] 6.2 Motores: régimen, empuje, consumo, desgaste, hielo; progreso del tramo
- [x] 6.3 Reactor: calor, energía disponible, radiación, SCRAM
- [x] 6.4 Distribución de energía (pips clicables por sistema)
- [x] 6.5 Riesgos por sala: fuego (propagación), brechas, temperatura, presión, radiación
- [x] 6.6 Cocina (raciones→comidas), comedor, enfermería (curar), taller (órdenes de fabricación)
- [x] 6.7 Pantalla de vuelo completa: barra superior, plantilla, nave, tareas, energía, radar, registro
- [x] 6.8 Llegada / aterrizaje forzoso (sin combustible) / destrucción

### Fase 7 — Incidentes y combate
- [x] 7.1 Director de incidentes (programación del tramo + fallos por fiabilidad)
- [x] 7.2 Catálogo de incidentes (≥15)
- [x] 7.3 Combate: contactos, radar ASCII con barrido, torretas, objetivo, maniobra evasiva, señuelos
- [x] 7.4 PVO: transmitir código IFF contrarreloj
- [x] 7.5 Efectos: impactos, explosiones, trazadoras, sacudidas, alarmas

### Fase 8 — Mapa procedural
- [x] 8.1 Terreno por región (ruido + perfil regional, ríos, lagos, Transiberiano, ciudades)
- [x] 8.2 Grafo de nodos por columnas sin cruces + nombres procedurales
- [x] 8.3 Tipos de nodo con pesos por región; nodo inicial, frontera y epicentro
- [x] 8.4 Frentes meteorológicos móviles
- [x] 8.5 Pantalla de mapa: hover, ruta animada, información del tramo, leyenda
- [x] 8.6 Reconocimiento (radar/navegante revelan tipos de nodo)

### Fase 9 — Eventos y nodos
- [x] 9.1 Motor de eventos: condiciones, plantillas de texto, opciones con requisitos, tiradas, resultados
- [x] 9.2 Catálogo de eventos (≥40) por tipo de nodo y región
- [x] 9.3 Pantalla de evento (texto con efecto máquina de escribir, opciones con probabilidad)
- [x] 9.4 Aeródromo: comerciar, reparar, repostar, reclutar, vender módulos
- [x] 9.5 Paso del tiempo en nodos (descanso, consumo agregado)

### Fase 10 — Hangar y gestión
- [x] 10.1 Hangar: ranuras de módulos por sala con arrastrar y soltar (estilo Cogmind)
- [x] 10.2 Bodega/inventario de módulos y comparación en tooltip
- [x] 10.3 Expediente de tripulante (retrato, habilidades, rasgos, historial)
- [x] 10.4 Matriz de prioridades editable (pantalla de tripulación)
- [x] 10.5 Desmontar módulos para piezas / reparar en taller

### Fase 11 — Partido, directivas y final
- [x] 11.1 Sospecha (fuentes y sumideros), comisario, informante, saboteador, investigación
- [x] 11.2 Directivas de Moscú (generación, seguimiento, recompensa/penalización)
- [x] 11.3 Plazo en días y consecuencias
- [x] 11.4 Región V y nodo Epicentro: vuelo final «La Señal»
- [x] 11.5 Decisión final y finales múltiples
- [x] 11.6 Pantalla de fin (derrota/victoria) con puntuación y resumen

### Fase 12 — Meta y rejugabilidad
- [x] 12.1 Archivo de expedientes (historial de partidas)
- [x] 12.2 Desbloqueos (variantes del avión) y logros
- [x] 12.3 Dificultades con modificadores
- [x] 12.4 Semillas compartibles

### Fase 13 — Pulido y pruebas
- [x] 13.1 Test de simulación en Node (partidas automáticas sin errores)
- [x] 13.2 Test visual con Playwright (capturas de cada pantalla, sin errores de consola)
- [x] 13.3 Balance (consumos, ritmos de necesidades, frecuencia de incidentes, precios)
- [x] 13.4 Rendimiento (render por celdas sucias, límite de partículas)
- [x] 13.5 Atajos de teclado y ayudas contextuales (tooltips por todas partes)
- [x] 13.6 Autoguardado (llegada a nodo, cada 30 s en vuelo, al salir)

### Fase 14 — Publicación
- [x] 14.1 Verificar rutas relativas para GitHub Pages
- [x] 14.2 README con instrucciones para jugar y publicar (sin spoilers)

---

## 4. Registro de sesiones
- Sesión 1: diseño y plan; motor ASCII completo; todas las pantallas; simulación de vuelo;
  mapas procedurales; 67 eventos; finales; meta-progresión; pruebas en Node y Playwright;
  equilibrio inicial (partidas automáticas: `node tests/fullrun.mjs 10 estajanovista`).

## 5. Ideas pendientes / mejoras futuras (no bloquean)
- [x] Más incidentes de vuelo (intoxicación, fuga del refrigerante, impacto de aves, corrientes en chorro).
- [x] Puertas y escotillas que se pueden cerrar (fuego, humo, aire, radiación).
- [x] Relaciones entre tripulantes (amistades/rivalidades).
- [ ] Más variantes de distribución de la nave.
- [x] Música generativa de fondo.
- [x] Condiciones de misión aleatorias (invierno, purga, escasez...) y maestrías de habilidad (nivel 8).
- [x] Despresurizar salas, sobrecarga del reactor, baterías de emergencia, ciclo día/noche.
- [x] Prueba del mono (`node tests/monkey.mjs 120`) y partidas automáticas completas.
- [ ] Soporte táctil completo para móviles.
