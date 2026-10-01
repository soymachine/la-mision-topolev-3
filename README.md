# La Misión Topolev

Un juego en ASCII ambientado en la Unión Soviética de 1961.
Se juega en el navegador, a pantalla completa, con ratón (y algunos atajos de teclado).

> El juego no tiene tutorial, pero sí una sección de **Instrucciones** en el menú principal.
> El documento `plan.md` contiene el diseño completo (**¡con spoilers!**).

## Cómo jugar en local

No necesita compilación: es HTML + JavaScript (módulos ES). Basta con servir la carpeta:

```bash
npx serve .            # o bien:
python3 -m http.server 8000
```

y abrir `http://localhost:3000` (o `http://localhost:8000`).
Abrir `index.html` directamente con `file://` **no funciona** (los navegadores bloquean los módulos ES).

## Publicar en GitHub Pages

1. En GitHub: **Settings → Pages**.
2. En *Build and deployment*, elige **Source: Deploy from a branch**.
3. Selecciona la rama (`main` o la rama de desarrollo) y la carpeta **`/ (root)`**. Guarda.
4. En uno o dos minutos el juego estará en `https://<usuario>.github.io/<repositorio>/`
   (para este repositorio: `https://soymachine.github.io/la-mision-topolev-3/`).

El fichero `.nojekyll` ya está incluido para que GitHub sirva todos los archivos tal cual.

## Partidas guardadas

Se guardan automáticamente en el `localStorage` del navegador (3 ranuras de expediente,
ajustes y archivo de partidas). Borrar los datos del sitio borra las partidas.

## Pruebas (desarrollo)

```bash
node tests/sim.test.mjs 3        # simulación de vuelos sin navegador
npx http-server -p 8765 -s . &   # servidor para las pruebas visuales
node tests/visual.mjs            # captura de pantalla con Playwright
node tests/fullrun.mjs 10 estajanovista   # partidas completas automáticas (equilibrio)
node tests/monkey.mjs 120        # clics y teclas al azar buscando errores
```

## Créditos

- Fuente: DejaVu Sans Mono (licencia Bitstream Vera / dominio público), en `assets/fonts/`.
- Sonido sintetizado en tiempo real con WebAudio.
