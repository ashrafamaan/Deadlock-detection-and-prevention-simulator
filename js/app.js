/* ============================================================
   APP ORCHESTRATOR — app.js
   ============================================================ */

/* ── SHARED UTILITIES ── */
function showSection(id) {
  document.querySelectorAll('.toolkit-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-pill').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');

  const btns = document.querySelectorAll('.nav-pill');
  const names = { banker: 0, rag: 1, simulator: 2, recovery: 3 };
  if (names[id] !== undefined) btns[names[id]].classList.add('active');

  if (id === 'banker'    && !document.getElementById('availableContainer').innerHTML) initBanker();
  if (id === 'rag'       && !ragState.nodes.length)    initRAG();
  if (id === 'simulator' && !simState.procList.length) initSimulator();
  if (id === 'recovery'  && !recState.scenario)        { /* user will press setup */ }
}

function setStatus(elId, text, cls) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = text;
  el.className = 'status-led ' + (cls || '');
}

/* ── TOAST NOTIFICATIONS ── */
function showToast(msg, type = 'info') {
  const existing = document.getElementById('import-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'import-toast';
  const colorMap = {
    info:    'var(--accent)',
    ok:      'var(--accent3)',
    warn:    'var(--accent4)',
    error:   'var(--accent2)'
  };
  toast.style.cssText = `
    position: fixed; bottom: 2rem; right: 2rem; z-index: 9999;
    font-family: var(--font-mono); font-size: 0.78rem; letter-spacing: 0.05em;
    padding: 12px 20px; border-radius: var(--radius);
    background: var(--bg-card); border: 1px solid ${colorMap[type]};
    color: ${colorMap[type]}; box-shadow: 0 0 24px ${colorMap[type]}44;
    animation: toastIn 0.3s ease; max-width: 360px; line-height: 1.5;
  `;
  toast.innerHTML = msg;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* ── INJECT IMPORT BARS INTO EACH SECTION ── */
function buildImportBars() {
  const bars = {
    banker: [
      { label: '⟵ Import from Simulator', fn: 'importSimToBanker()', tip: 'Load process/resource count & allocation from Simulator' },
    ],
    rag: [
      { label: '⟵ Import from Banker',    fn: 'importBankerToRAG()',    tip: 'Build RAG edges from Banker allocation & need matrices' },
      { label: '⟵ Import from Simulator', fn: 'importSimToRAG()',       tip: 'Mirror current Simulator allocation/wait state as RAG' },
    ],
    simulator: [
      { label: '⟵ Import from Banker',    fn: 'importBankerToSim()',    tip: 'Pre-load process & resource counts from Banker' },
    ],
    recovery: [
      { label: '⟵ Import from Banker',    fn: 'importBankerToRecovery()',    tip: 'Send unsafe Banker state as deadlock scenario' },
      { label: '⟵ Import from Simulator', fn: 'importSimToRecovery()',       tip: 'Send deadlocked Simulator processes to Recovery' },
      { label: '⟵ Import from RAG',       fn: 'importRAGToRecovery()',       tip: 'Use RAG cycle nodes as the deadlock scenario' },
    ]
  };

  Object.entries(bars).forEach(([sectionId, btns]) => {
    const section = document.getElementById(sectionId);
    if (!section) return;

    const bar = document.createElement('div');
    bar.className = 'import-bar';
    bar.innerHTML = `
      <span class="import-bar-label">⬡ IMPORT DATA:</span>
      ${btns.map(b => `
        <button class="btn-import" onclick="${b.fn}" title="${b.tip}">${b.label}</button>
      `).join('')}
    `;

    // Insert after section-header
    const header = section.querySelector('.section-header');
    if (header && header.nextSibling) {
      section.insertBefore(bar, header.nextSibling);
    } else {
      section.appendChild(bar);
    }
  });
}

/* ══════════════════════════════════════════
   TRANSFER FUNCTIONS
   ══════════════════════════════════════════ */

/* ── 1. BANKER → RAG ──
   Reads allocation matrix → creates assignment edges (R→P)
   Reads need matrix      → creates request edges (P→R) for non-zero needs   */
function importBankerToRAG() {
  readMatrices(); // ensure fresh data
  const { n, m, allocation, need } = bankerState;

  if (!n || !m) {
    showToast('⚠ Initialize Banker first.', 'warn'); return;
  }

  // Set RAG dimensions and reinit
  document.getElementById('ragProcesses').value = n;
  document.getElementById('ragResources').value = m;
  initRAG();

  let edgesAdded = 0;

  // Assignment edges: R→P where allocation[i][j] > 0
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (allocation[i][j] > 0) {
        const from = 'R' + j, to = 'P' + i;
        if (!ragState.edges.find(e => e.from === from && e.to === to)) {
          ragState.edges.push({ from, to, type: 'assignment' });
          edgesAdded++;
        }
      }
    }
  }

  // Request edges: P→R where need[i][j] > 0 (only first non-zero need per process to keep graph clean)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (need[i][j] > 0) {
        const from = 'P' + i, to = 'R' + j;
        if (!ragState.edges.find(e => e.from === from && e.to === to)) {
          ragState.edges.push({ from, to, type: 'request' });
          edgesAdded++;
          break; // one request per process keeps it readable
        }
      }
    }
  }

  drawRAG();
  showSection('rag');
  showToast(`✓ Imported Banker → RAG<br>${n} processes, ${m} resources, ${edgesAdded} edges built.`, 'ok');
  setStatus('ragStatus', 'IMPORTED', 'running');
}

/* ── 2. BANKER → SIMULATOR ──
   Copies process & resource counts into Simulator and reinitializes          */
function importBankerToSim() {
  const n = bankerState.n, m = bankerState.m;
  if (!n || !m) {
    showToast('⚠ Initialize Banker first.', 'warn'); return;
  }
  document.getElementById('simProcesses').value = n;
  document.getElementById('simResources').value = m;
  initSimulator();
  showSection('simulator');
  showToast(`✓ Imported Banker → Simulator<br>${n} processes, ${m} resources loaded.`, 'ok');
}

/* ── 3. BANKER → RECOVERY ──
   Reads Banker state; if unsafe, builds a recovery scenario from the
   deadlocked processes (those whose finish=false after safety check).
   If safe, still lets user import the process/resource skeleton.             */
function importBankerToRecovery() {
  readMatrices();
  const { n, m, available, max, allocation, need } = bankerState;
  if (!n || !m) {
    showToast('⚠ Initialize Banker first.', 'warn'); return;
  }

  // Run safety check silently to find which processes are deadlocked
  const work   = [...available];
  const finish = Array(n).fill(false);
  let count = 0, iter = 0;
  while (count < n && iter < n * n + 5) {
    iter++;
    let found = false;
    for (let i = 0; i < n; i++) {
      if (!finish[i]) {
        let ok = true;
        for (let j = 0; j < m; j++) { if (need[i][j] > work[j]) { ok = false; break; } }
        if (ok) {
          for (let j = 0; j < m; j++) work[j] += allocation[i][j];
          finish[i] = true; count++; found = true;
        }
      }
    }
    if (!found) break;
  }

  const deadlockedIdx = finish.map((f, i) => f ? null : i).filter(x => x !== null);

  // Build recState from Banker data
  document.getElementById('recProcesses').value = n;
  document.getElementById('recResources').value = m;

  recState.processes = Array.from({ length: n }, (_, i) => ({
    id: 'P' + i,
    priority: Math.floor(Math.random() * 10) + 1,
    age: Math.floor(Math.random() * 100) + 10,
    cost: allocation[i] ? allocation[i].reduce((s, v) => s + v, 0) * 10 + 5 : 15,
    held: allocation[i] ? allocation[i].map((v, j) => v > 0 ? 'R' + j : null).filter(Boolean) : [],
    waiting: need[i] ? (() => { for (let j = 0; j < m; j++) { if (need[i][j] > 0 && available[j] === 0) return 'R' + j; } return null; })() : null,
    state: deadlockedIdx.includes(i) ? 'deadlocked' : 'running',
    checkpointAge: Math.floor(Math.random() * 30) + 5
  }));

  recState.resources = Array.from({ length: m }, (_, j) => {
    const holder = recState.processes.find(p => p.held.includes('R' + j));
    const waiters = recState.processes.filter(p => p.waiting === 'R' + j).map(p => p.id);
    return { id: 'R' + j, heldBy: holder ? holder.id : null, waitQueue: waiters };
  });

  recState.deadlocked = recState.processes.filter(p => p.state === 'deadlocked');
  recState.scenario   = { n, m };

  displayScenario();
  showSection('recovery');

  const msg = deadlockedIdx.length > 0
    ? `✓ Imported Banker → Recovery<br>Deadlocked: ${deadlockedIdx.map(i => 'P' + i).join(', ')}`
    : `✓ Imported Banker → Recovery<br>System was safe — no deadlocked processes.`;
  showToast(msg, deadlockedIdx.length > 0 ? 'warn' : 'ok');
  setStatus('recoveryStatus', deadlockedIdx.length > 0 ? 'DEADLOCKED' : 'SAFE', deadlockedIdx.length > 0 ? 'unsafe' : 'safe');
}

/* ── 4. SIMULATOR → BANKER ──
   Copies process & resource counts into Banker and reinitializes             */
function importSimToBanker() {
  const n = simState.processes, m = simState.resources;
  if (!n || !m) {
    showToast('⚠ Initialize Simulator first.', 'warn'); return;
  }
  document.getElementById('numProcesses').value = n;
  document.getElementById('numResources').value = m;

  // Build allocation from simulator's live state
  bankerState.n = n; bankerState.m = m;
  bankerState.allocation = Array.from({ length: n }, (_, i) => {
    const p = simState.procList[i];
    return Array.from({ length: m }, (_, j) => {
      const res = 'R' + j;
      return (p && p.heldRes && p.heldRes.includes(res)) ? 1 : 0;
    });
  });
  // Available = total pool minus currently held.
  // Pool = holders + waiters + 1 slack so Banker always has room to find a safe sequence.
  // This prevents false deadlock when all single-instance resources happen to be held.
  bankerState.available = Array.from({ length: m }, (_, j) => {
    const r = simState.resList[j];
    if (!r) return 1;
    const holdersCount = r.heldBy ? 1 : 0;
    const waitersCount = r.waitQueue ? r.waitQueue.length : 0;
    const totalPool = holdersCount + waitersCount + 1;
    return Math.max(0, totalPool - holdersCount);
  });
  // Max = allocation + random headroom so safety check has something to evaluate
  bankerState.max = bankerState.allocation.map(row => row.map(v => v + Math.floor(Math.random() * 3) + 1));

  renderAvailableMatrix();
  renderMaxMatrix();
  renderAllocationMatrix();
  showSection('banker');
  showToast(`✓ Imported Simulator → Banker<br>${n} processes, ${m} resources. Allocation matrix loaded.`, 'ok');
}

/* ── 5. SIMULATOR → RAG ──
   Mirrors the Simulator's live allocation & wait queue as RAG edges          */
function importSimToRAG() {
  const n = simState.processes, m = simState.resources;
  if (!n || !m || !simState.procList.length) {
    showToast('⚠ Initialize Simulator first.', 'warn'); return;
  }

  document.getElementById('ragProcesses').value = n;
  document.getElementById('ragResources').value = m;
  initRAG();

  let edgesAdded = 0;

  // Assignment edges: R→P for held resources
  simState.resList.forEach(r => {
    if (r.heldBy) {
      ragState.edges.push({ from: r.id, to: r.heldBy, type: 'assignment' });
      edgesAdded++;
    }
    // Request edges: P→R for wait queue
    r.waitQueue.forEach(pid => {
      if (!ragState.edges.find(e => e.from === pid && e.to === r.id)) {
        ragState.edges.push({ from: pid, to: r.id, type: 'request' });
        edgesAdded++;
      }
    });
  });

  drawRAG();
  showSection('rag');
  showToast(`✓ Imported Simulator → RAG<br>${edgesAdded} edges mirrored from live sim state.`, 'ok');
  setStatus('ragStatus', 'IMPORTED', 'running');
}

/* ── 6. SIMULATOR → RECOVERY ──
   Sends processes in 'waiting' state to Recovery as the deadlock scenario    */
function importSimToRecovery() {
  const n = simState.processes, m = simState.resources;
  if (!n || !m || !simState.procList.length) {
    showToast('⚠ Initialize Simulator first.', 'warn'); return;
  }

  document.getElementById('recProcesses').value = n;
  document.getElementById('recResources').value = m;

  recState.processes = simState.procList.map((p, i) => ({
    id: p.id,
    priority: Math.floor(Math.random() * 10) + 1,
    age: Math.floor(Math.random() * 100) + 10,
    cost: (p.heldRes ? p.heldRes.length : 0) * 10 + 5,
    held: [...(p.heldRes || [])],
    waiting: (() => {
      for (const r of simState.resList) {
        if (r.waitQueue && r.waitQueue.includes(p.id)) return r.id;
      }
      return null;
    })(),
    state: p.state === 'waiting' ? 'deadlocked' : p.state,
    checkpointAge: Math.floor(Math.random() * 30) + 5
  }));

  recState.resources = simState.resList.map(r => ({
    id: r.id,
    heldBy: r.heldBy,
    waitQueue: [...(r.waitQueue || [])]
  }));

  recState.deadlocked = recState.processes.filter(p => p.state === 'deadlocked');
  recState.scenario   = { n, m };

  displayScenario();
  showSection('recovery');

  const dl = recState.deadlocked.map(p => p.id).join(', ') || 'none';
  showToast(`✓ Imported Simulator → Recovery<br>Deadlocked: ${dl}`, recState.deadlocked.length ? 'warn' : 'ok');
  setStatus('recoveryStatus', recState.deadlocked.length ? 'DEADLOCKED' : 'OK', recState.deadlocked.length ? 'unsafe' : 'safe');
}

/* ── 7. RAG → RECOVERY ──
   Runs cycle detection silently; sends cycle nodes as the deadlock scenario   */
function importRAGToRecovery() {
  if (!ragState.nodes.length) {
    showToast('⚠ Initialize RAG first.', 'warn'); return;
  }

  // Detect cycle silently
  const { nodes, edges } = ragState;
  const adj = {};
  nodes.forEach(n => { adj[n.id] = []; });
  edges.forEach(e => { if (adj[e.from]) adj[e.from].push(e.to); });

  const visited = {}, recStack = {};
  let cycleNodes = [];

  function dfs(v, path) {
    visited[v] = true; recStack[v] = true; path = [...path, v];
    for (const nb of (adj[v] || [])) {
      if (!visited[nb]) { const r = dfs(nb, path); if (r.length) return r; }
      else if (recStack[nb]) { return path.slice(path.indexOf(nb)); }
    }
    recStack[v] = false; return [];
  }
  for (const node of nodes) {
    if (!visited[node.id]) { const c = dfs(node.id, []); if (c.length) { cycleNodes = c; break; } }
  }

  if (!cycleNodes.length) {
    showToast('⚠ No cycle found in RAG — nothing to import.', 'warn'); return;
  }

  // Filter to only process nodes in the cycle
  const cycleProcs = cycleNodes.filter(id => id.startsWith('P'));
  const cycleRes   = cycleNodes.filter(id => id.startsWith('R'));
  const n = cycleProcs.length, m = Math.max(cycleRes.length, 1);

  document.getElementById('recProcesses').value = n;
  document.getElementById('recResources').value = m;

  recState.processes = cycleProcs.map((pid, i) => {
    const held = edges.filter(e => e.type === 'assignment' && e.to === pid).map(e => e.from);
    const wants = edges.filter(e => e.type === 'request'    && e.from === pid).map(e => e.to);
    return {
      id: pid,
      priority: Math.floor(Math.random() * 10) + 1,
      age: Math.floor(Math.random() * 100) + 10,
      cost: held.length * 10 + 5,
      held,
      waiting: wants[0] || null,
      state: 'deadlocked',
      checkpointAge: Math.floor(Math.random() * 30) + 5
    };
  });

  recState.resources = cycleRes.map(rid => {
    const holder = recState.processes.find(p => p.held.includes(rid));
    const waiters = recState.processes.filter(p => p.waiting === rid).map(p => p.id);
    return { id: rid, heldBy: holder ? holder.id : null, waitQueue: waiters };
  });

  recState.deadlocked = [...recState.processes];
  recState.scenario   = { n, m };

  displayScenario();
  showSection('recovery');
  showToast(`✓ Imported RAG cycle → Recovery<br>Cycle: ${cycleNodes.join(' → ')} → ${cycleNodes[0]}`, 'warn');
  setStatus('recoveryStatus', 'DEADLOCKED', 'unsafe');
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
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 3 + 2,
        type: Math.random() > 0.5 ? 'process' : 'resource',
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.02 + Math.random() * 0.03
      });
    }
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
    edges.forEach(e => {
      const na = nodes[e.a], nb = nodes[e.b];
      const dx = nb.x - na.x, dy = nb.y - na.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > 300) return;
      const opacity = (1 - dist/300) * 0.15 * (e.life / e.maxLife);
      ctx.beginPath(); ctx.moveTo(na.x, na.y); ctx.lineTo(nb.x, nb.y);
      ctx.strokeStyle = `rgba(0,212,255,${opacity})`; ctx.lineWidth = 0.8; ctx.stroke();
      e.life--;
    });
    edges = edges.filter(e => e.life > 0);
    if (edges.length < NODE_COUNT * 0.8) {
      const a = Math.floor(Math.random() * NODE_COUNT);
      const b = Math.floor(Math.random() * NODE_COUNT);
      if (a !== b) edges.push({ a, b, life: 200+Math.random()*300, maxLife: 200+Math.random()*300 });
    }
    nodes.forEach(n => {
      n.pulse += n.pulseSpeed;
      const glow = Math.sin(n.pulse) * 0.5 + 0.5;
      const color = n.type === 'process'
        ? `rgba(0,212,255,${0.3 + glow * 0.4})`
        : `rgba(255,184,0,${0.3 + glow * 0.4})`;
      ctx.beginPath();
      if (n.type === 'process') ctx.arc(n.x, n.y, n.r + glow * 2, 0, Math.PI * 2);
      else ctx.rect(n.x - n.r - glow, n.y - n.r - glow, (n.r + glow) * 2, (n.r + glow) * 2);
      ctx.fillStyle = color; ctx.fill();
      n.x += n.vx; n.y += n.vy;
      if (n.x < 0 || n.x > W) n.vx *= -1;
      if (n.y < 0 || n.y > H) n.vy *= -1;
    });
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
      ctx.lineWidth = 1; ctx.stroke();
      r += 3; requestAnimationFrame(expand);
    }
    expand();
  }

  window.addEventListener('resize', () => { resize(); createNodes(); });
  resize(); createNodes(); draw();
})();

/* ── INIT ON LOAD ── */
document.addEventListener('DOMContentLoaded', () => {
  initBanker();
  buildImportBars();
});

/* NOTE: Add the following CSS block to style.css */