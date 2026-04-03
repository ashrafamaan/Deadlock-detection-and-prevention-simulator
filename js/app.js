/* ============================================================
   APP ORCHESTRATOR — app.js
   ============================================================ */

/* ── SHARED UTILITIES ── */
function showSection(id) {
  document.querySelectorAll('.toolkit-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-pill').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');

  // Find matching nav pill
  const btns = document.querySelectorAll('.nav-pill');
  const names = { banker: 0, rag: 1, simulator: 2, recovery: 3 };
  if (names[id] !== undefined) btns[names[id]].classList.add('active');

  // Init section on first view
  if (id === 'banker' && !document.getElementById('availableContainer').innerHTML) initBanker();
  if (id === 'rag' && !ragState.nodes.length) initRAG();
  if (id === 'simulator' && !simState.procList.length) initSimulator();
  if (id === 'recovery' && !recState.scenario) { /* user will press setup */ }
}

function setStatus(elId, text, cls) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = text;
  el.className = 'status-led ' + (cls || '');
}

/* ── HERO CANVAS ANIMATION ── */
(function heroAnimation() {
  const canvas = document.getElementById('heroCanvas');
  const ctx = canvas.getContext('2d');
  let W, H, nodes = [], edges = [], frame = 0;
  const NODE_COUNT = 22;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function createNodes() {
    nodes = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      nodes.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 3 + 2,
        type: Math.random() > 0.5 ? 'process' : 'resource',
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.02 + Math.random() * 0.03
      });
    }
    // Create random edges
    edges = [];
    for (let i = 0; i < NODE_COUNT * 0.8; i++) {
      const a = Math.floor(Math.random() * NODE_COUNT);
      const b = Math.floor(Math.random() * NODE_COUNT);
      if (a !== b) edges.push({ a, b, life: 1, maxLife: 200 + Math.random() * 300 });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    frame++;

    // Draw edges
    edges.forEach(e => {
      const na = nodes[e.a], nb = nodes[e.b];
      const dx = nb.x - na.x, dy = nb.y - na.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > 300) return;
      const opacity = (1 - dist/300) * 0.15 * (e.life / e.maxLife);
      ctx.beginPath();
      ctx.moveTo(na.x, na.y);
      ctx.lineTo(nb.x, nb.y);
      ctx.strokeStyle = `rgba(0,212,255,${opacity})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      e.life--;
    });

    // Remove dead edges, add new ones
    edges = edges.filter(e => e.life > 0);
    if (edges.length < NODE_COUNT * 0.8) {
      const a = Math.floor(Math.random() * NODE_COUNT);
      const b = Math.floor(Math.random() * NODE_COUNT);
      if (a !== b) edges.push({ a, b, life: 200+Math.random()*300, maxLife: 200+Math.random()*300 });
    }

    // Draw nodes
    nodes.forEach(n => {
      n.pulse += n.pulseSpeed;
      const glow = Math.sin(n.pulse) * 0.5 + 0.5;
      const color = n.type === 'process' ? `rgba(0,212,255,${0.3 + glow * 0.4})` : `rgba(255,184,0,${0.3 + glow * 0.4})`;

      ctx.beginPath();
      if (n.type === 'process') ctx.arc(n.x, n.y, n.r + glow * 2, 0, Math.PI * 2);
      else ctx.rect(n.x - n.r - glow, n.y - n.r - glow, (n.r + glow) * 2, (n.r + glow) * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Move
      n.x += n.vx; n.y += n.vy;
      if (n.x < 0 || n.x > W) n.vx *= -1;
      if (n.y < 0 || n.y > H) n.vy *= -1;
    });

    // Occasional data pulse
    if (frame % 60 === 0) {
      const src = nodes[Math.floor(Math.random() * nodes.length)];
      drawDataPulse(ctx, src.x, src.y);
    }

    requestAnimationFrame(draw);
  }

  function drawDataPulse(ctx, x, y) {
    let r = 0;
    function expand() {
      if (r > 60) return;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(0,212,255,${0.4 - r/150})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      r += 3;
      requestAnimationFrame(expand);
    }
    expand();
  }

  window.addEventListener('resize', () => { resize(); createNodes(); });
  resize();
  createNodes();
  draw();
})();

/* ── INIT ON LOAD ── */
document.addEventListener('DOMContentLoaded', () => {
  // Auto-init banker section (default visible)
  initBanker();
});
