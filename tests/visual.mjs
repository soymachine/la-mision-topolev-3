// Prueba visual: abre el juego en Chromium, captura pantallas y errores de consola.
// Uso: node tests/visual.mjs [script]   (requiere un servidor en :8765)
import { chromium } from 'playwright';
import fs from 'fs';

const url = process.env.URL || 'http://localhost:8765/';
const W = Number(process.env.W || 1600);
const H = Number(process.env.H || 900);
const steps = process.argv[2] ? (await import(process.argv[2])).default : null;

fs.mkdirSync('tests/shots', { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + e.stack));
await page.goto(url);
await page.waitForTimeout(1500);
if (steps) await steps(page);
else await page.screenshot({ path: 'tests/shots/title.png' });
console.log(errors.length ? errors.join('\n') : 'Sin errores de consola');
await browser.close();
