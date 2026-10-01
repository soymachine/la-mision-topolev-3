// Entrada: ratón (en celdas, con fracción), clics, rueda, teclado y arrastre.

export class Input {
  constructor(target, term) {
    this.term = term;
    this.m = {
      px: -1, py: -1, // píxeles CSS
      fx: -1, fy: -1, // celdas fraccionarias
      cx: -1, cy: -1, // celda entera
      down: false, pressed: false, released: false,
      rdown: false, rpressed: false, rreleased: false,
      wheel: 0, moved: false, inside: false,
      downX: 0, downY: 0, dragging: false, dblclick: false,
    };
    this.keys = []; // pulsaciones de este frame: {key, code, shift, ctrl}
    this.held = new Set();
    this.lastClickT = 0;
    this.lastClickCell = '';
    const m = this.m;

    const setPos = (e) => {
      m.px = e.clientX;
      m.py = e.clientY;
      const [fx, fy] = term.pxToCell(m.px, m.py);
      m.fx = fx;
      m.fy = fy;
      m.cx = Math.floor(fx);
      m.cy = Math.floor(fy);
      m.moved = true;
      m.inside = true;
      if (m.down && !m.dragging) {
        const dx = m.px - m.downX;
        const dy = m.py - m.downY;
        if (dx * dx + dy * dy > 36) m.dragging = true;
      }
    };
    target.addEventListener('mousemove', setPos);
    target.addEventListener('mouseleave', () => {
      m.inside = false;
      m.cx = -1;
      m.cy = -1;
    });
    target.addEventListener('mousedown', (e) => {
      setPos(e);
      if (e.button === 0) {
        m.down = true;
        m.pressed = true;
        m.downX = m.px;
        m.downY = m.py;
        m.dragging = false;
        const now = performance.now();
        const cell = m.cx + ',' + m.cy;
        if (now - this.lastClickT < 350 && cell === this.lastClickCell) m.dblclick = true;
        this.lastClickT = now;
        this.lastClickCell = cell;
      } else if (e.button === 2) {
        m.rdown = true;
        m.rpressed = true;
      }
      this.onFirstInteraction && this.onFirstInteraction();
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0 && m.down) {
        m.down = false;
        m.released = true;
      } else if (e.button === 2 && m.rdown) {
        m.rdown = false;
        m.rreleased = true;
      }
    });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
    target.addEventListener(
      'wheel',
      (e) => {
        m.wheel += Math.sign(e.deltaY);
        e.preventDefault();
      },
      { passive: false },
    );
    // Táctil básico: un dedo = ratón
    target.addEventListener(
      'touchstart',
      (e) => {
        const t = e.touches[0];
        setPos(t);
        m.down = true;
        m.pressed = true;
        m.downX = m.px;
        m.downY = m.py;
        m.dragging = false;
        this.onFirstInteraction && this.onFirstInteraction();
        e.preventDefault();
      },
      { passive: false },
    );
    target.addEventListener(
      'touchmove',
      (e) => {
        setPos(e.touches[0]);
        e.preventDefault();
      },
      { passive: false },
    );
    target.addEventListener('touchend', (e) => {
      m.down = false;
      m.released = true;
      e.preventDefault();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' || e.key === ' ' || e.key.startsWith('Arrow')) e.preventDefault();
      if (e.key === 'F5' || e.key === 'F12') return;
      this.keys.push({ key: e.key, code: e.code, shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey, repeat: e.repeat });
      this.held.add(e.key);
      this.onFirstInteraction && this.onFirstInteraction();
    });
    window.addEventListener('keyup', (e) => this.held.delete(e.key));
    window.addEventListener('blur', () => {
      this.held.clear();
      m.down = false;
      m.dragging = false;
    });
  }

  // Recalcula celda tras redimensionar
  refresh() {
    const m = this.m;
    if (m.px < 0) return;
    const [fx, fy] = this.term.pxToCell(m.px, m.py);
    m.fx = fx;
    m.fy = fy;
    m.cx = Math.floor(fx);
    m.cy = Math.floor(fy);
  }

  key(k) {
    // ¿Se pulsó esta tecla en este frame? (insensible a mayúsculas para letras)
    const lk = k.length === 1 ? k.toLowerCase() : k;
    for (const e of this.keys) {
      const ek = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (ek === lk) return true;
    }
    return false;
  }

  consumeKey(k) {
    const lk = k.length === 1 ? k.toLowerCase() : k;
    const i = this.keys.findIndex((e) => (e.key.length === 1 ? e.key.toLowerCase() : e.key) === lk);
    if (i >= 0) {
      this.keys.splice(i, 1);
      return true;
    }
    return false;
  }

  endFrame() {
    const m = this.m;
    m.pressed = false;
    m.released = false;
    m.rpressed = false;
    m.rreleased = false;
    m.wheel = 0;
    m.moved = false;
    m.dblclick = false;
    if (!m.down) m.dragging = false;
    this.keys.length = 0;
  }
}
