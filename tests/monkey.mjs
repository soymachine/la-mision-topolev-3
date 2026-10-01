// Prueba del mono: clics, arrastres y teclas al azar durante un rato para cazar excepciones.
// Uso: node tests/monkey.mjs [segundos]   (requiere servidor en :8765)
import { chromium } from 'playwright';

const SECS = Number(process.argv[2] || 60);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message + '\n' + e.stack));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(process.env.URL || 'http://localhost:8765/');
await page.waitForTimeout(1200);
await page.keyboard.press('n');
await page.waitForTimeout(600);
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
const keys = [' ', '1', '2', '3', 'e', 'Escape', 'Enter', 'h', 't', 'd', '1', '2', '3', '4'];
const t0 = Date.now();
const screens = {};
let i = 0;
while (Date.now() - t0 < SECS * 1000) {
  i++;
  const r = Math.random();
  const x = Math.random() * 1440;
  const y = Math.random() * 860;
  try {
    if (r < 0.45) await page.mouse.click(x, y);
    else if (r < 0.6) {
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(Math.random() * 1440, Math.random() * 860, { steps: 6 });
      await page.mouse.up();
    } else if (r < 0.7) await page.mouse.click(x, y, { button: 'right' });
    else if (r < 0.75) await page.mouse.dblclick(x, y);
    else await page.keyboard.press(keys[Math.floor(Math.random() * keys.length)]);
  } catch (e) {
    errors.push('playwright: ' + e.message);
  }
  if (i % 20 === 0) {
    const name = await page.evaluate(() => window.__app?.screens?.name);
    screens[name] = (screens[name] || 0) + 1;
    // si se queda en el título demasiado, empezar otra partida
    if (name === 'title' && Math.random() < 0.5) {
      await page.keyboard.press('n');
      await page.waitForTimeout(300);
      await page.keyboard.press('Enter');
    }
    // desde el mapa, despegar a menudo
    if (name === 'map' && Math.random() < 0.6) {
      await page.evaluate(async () => {
        const a = window.__app;
        const { neighborsOf } = await import('/js/game/map.js');
        const nb = neighborsOf(a.run.map, a.run.map.cur);
        if (nb.length) a.screens.cur.sel = nb[Math.floor(Math.random() * nb.length)];
      });
      await page.keyboard.press('Enter');
    }
    // acelerar vuelos
    await page.evaluate(() => { const a = window.__app; if (a?.run && a.screens.name === 'flight') a.run.speed = 4; });
  }
  await page.waitForTimeout(40);
}
console.log('acciones:', i, 'pantallas visitadas:', JSON.stringify(screens));
console.log(errors.length ? 'ERRORES:\n' + [...new Set(errors)].join('\n---\n') : 'Sin errores');
await browser.close();
