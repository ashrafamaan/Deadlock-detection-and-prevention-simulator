/* ============================================================
   RESOURCE ALLOCATION GRAPH — graph.js
   ============================================================ */

let ragState = {
  processes: 3, resources: 3,
  nodes: [], edges: [],
  dragging: null, dragOffX: 0, dragOffY: 0
};

let ragCanvas, ragCtx;

function initRAG() {
  ragState.processes = parseInt(document.getElementById('ragProcesses').value) || 3;
  ragState.resources = parseInt(document.getElementById('ragResources').value) || 3;
  ragState.nodes = [];
  ragState.edges = [];

  ragCanvas = document.getElementById('ragCanvas');
  ragCtx = ragCanvas.getContext('2d');
  resizeRAGCanvas();

  // Create process nodes (circles) — left column
  const px = ragCanvas.width * 0.25;
  for (let i = 0; i < ragState.processes; i++) {
    const yStep = ragCanvas.height / (ragState.processes + 1);
    ragState.nodes.push({ id: 'P' + i, type: 'process', x: px, y: yStep * (i + 1) });
  }

  // Create resource nodes (squares) — right column
  const rx = ragCanvas.width * 0.75;
  for (let i = 0; i < ragState.resources; i++) {
    const yStep = ragCanvas.height / (ragState.resources + 1);
    ragState.nodes.push({ id: 'R' + i, type: 'resource', x: rx, y: yStep * (i + 1) });
  }

  populateEdgeSelects();
  drawRAG();
  setStatus('ragStatus', 'READY', 'running');

  // Drag events
  ragCanvas.onmousedown = ragMouseDown;
  ragCanvas.onmousemove = ragMouseMove;
  ragCanvas.onmouseup   = () => { ragState.dragging = null; };
  document.getElementById('ragOutput').classList.add('hidden');
}

function resizeRAGCanvas() {
  const wrap = document.querySelector('.rag-canvas-wrap');
  ragCanvas.width  = wrap.clientWidth  || 700;
  ragCanvas.height = Math.max(400, ragState.processes * 80 + 100);
}

function populateEdgeSelects() {
  const ps = document.getElementById('edgeProcess');
  const rs = document.getElementById('edgeResource');
  ps.innerHTML = ragState.nodes.filter(n => n.type === 'process').map(n => `<option value="${n.id}">${n.id}</option>`).join('');
  rs.innerHTML = ragState.nodes.filter(n => n.type === 'resource').map(n => `<option value="${n.id}">${n.id}</option>`).join('');
}

function addRAGEdge() {
  const type = document.getElementById('edgeType').value;
  const proc = document.getElementById('edgeProcess').value;
  const res  = document.getElementById('edgeResource').value;
  const from = type === 'request' ? proc : res;
  const to   = type === 'request' ? res  : proc;

  // Check duplicate
  if (ragState.edges.find(e => e.from === from && e.to === to)) {
    showRAGMessage('Edge already exists.', 'warn'); return;
  }
  ragState.edges.push({ from, to, type });
  drawRAG();
  showRAGMessage(`Added ${type} edge: ${from} → ${to}`, 'info');
}

function removeRAGEdge() {
  const proc = document.getElementById('edgeProcess').value;
  const res  = document.getElementById('edgeResource').value;
  const before = ragState.edges.length;
  ragState.edges = ragState.edges.filter(e =>
    !((e.from === proc && e.to === res) || (e.from === res && e.to === proc))
  );
  drawRAG();
  showRAGMessage(ragState.edges.length < before ? `Removed edge between ${proc} ↔ ${res}` : 'No edge found to remove.', 'info');
}

function clearRAG() {
  ragState.edges = [];
  drawRAG();
  document.getElementById('ragOutput').classList.add('hidden');
  setStatus('ragStatus', 'READY', 'running');
}

function loadRAGPreset() {
  document.getElementById('ragProcesses').value = 3;
  document.getElementById('ragResources').value = 3;
  initRAG();
  // Circular wait preset
  ragState.edges = [
    { from: 'P0', to: 'R0', type: 'request' },
    { from: 'R0', to: 'P1', type: 'assignment' },
    { from: 'P1', to: 'R1', type: 'request' },
    { from: 'R1', to: 'P2', type: 'assignment' },
    { from: 'P2', to: 'R2', type: 'request' },
    { from: 'R2', to: 'P0', type: 'assignment' },
  ];
  drawRAG();
}

/* ── DRAW ── */
function drawRAG(highlightCycle = []) {
  if (!ragCtx) return;
  const ctx = ragCtx;
  const W = ragCanvas.width, H = ragCanvas.height;

  ctx.clearRect(0, 0, W, H);

  // Background grid
  ctx.strokeStyle = 'rgba(26,42,74,0.4)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  // Draw edges
  ragState.edges.forEach(e => {
    const fromNode = ragState.nodes.find(n => n.id === e.from);
    const toNode   = ragState.nodes.find(n => n.id === e.to);
    if (!fromNode || !toNode) return;

    const inCycle = highlightCycle.includes(e.from) && highlightCycle.includes(e.to);
    const color = inCycle ? '#ff3a6e' : (e.type === 'request' ? '#ff6b9d' : '#39ff14');

    drawArrow(ctx, fromNode.x, fromNode.y, toNode.x, toNode.y, color, inCycle);
  });

  // Draw nodes
  ragState.nodes.forEach(node => {
    const inCycle = highlightCycle.includes(node.id);
    if (node.type === 'process') {
      drawProcess(ctx, node.x, node.y, node.id, inCycle);
    } else {
      drawResource(ctx, node.x, node.y, node.id, inCycle);
    }
  });
}

function drawArrow(ctx, x1, y1, x2, y2, color, thick = false) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx*dx + dy*dy);
  const nx = dx/len, ny = dy/len;
  const offset = 26;
  const sx = x1 + nx*offset, sy = y1 + ny*offset;
  const ex = x2 - nx*offset, ey = y2 - ny*offset;

  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.strokeStyle = color;
  ctx.lineWidth = thick ? 3 : 1.5;
  ctx.setLineDash(thick ? [] : []);
  ctx.stroke();

  // Arrowhead
  const angle = Math.atan2(ey - sy, ex - sx);
  const aLen = 10;
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex - aLen * Math.cos(angle - Math.PI/6), ey - aLen * Math.sin(angle - Math.PI/6));
  ctx.lineTo(ex - aLen * Math.cos(angle + Math.PI/6), ey - aLen * Math.sin(angle + Math.PI/6));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  if (thick) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

function drawProcess(ctx, x, y, id, highlight) {
  const r = 24;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = highlight ? 'rgba(255,58,110,0.25)' : 'rgba(0,212,255,0.12)';
  ctx.fill();
  ctx.strokeStyle = highlight ? '#ff3a6e' : '#00d4ff';
  ctx.lineWidth = highlight ? 2.5 : 1.5;
  if (highlight) { ctx.shadowColor = '#ff3a6e'; ctx.shadowBlur = 16; }
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.fillStyle = highlight ? '#ff3a6e' : '#00d4ff';
  ctx.font = 'bold 13px "Share Tech Mono"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(id, x, y);
}

function drawResource(ctx, x, y, id, highlight) {
  const s = 22;
  ctx.beginPath();
  ctx.rect(x - s, y - s, s*2, s*2);
  ctx.fillStyle = highlight ? 'rgba(255,58,110,0.25)' : 'rgba(255,184,0,0.12)';
  ctx.fill();
  ctx.strokeStyle = highlight ? '#ff3a6e' : '#ffb800';
  ctx.lineWidth = highlight ? 2.5 : 1.5;
  if (highlight) { ctx.shadowColor = '#ff3a6e'; ctx.shadowBlur = 16; }
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.fillStyle = highlight ? '#ff3a6e' : '#ffb800';
  ctx.font = 'bold 13px "Share Tech Mono"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(id, x, y);
}

/* ── CYCLE DETECTION (DFS) ── */
function detectCycle() {
  const { nodes, edges } = ragState;
  const adj = {};
  nodes.forEach(n => { adj[n.id] = []; });
  edges.forEach(e => { if (adj[e.from]) adj[e.from].push(e.to); });

  const visited  = {};
  const recStack = {};
  let cycleNodes = [];

  function dfs(v, path) {
    visited[v] = true;
    recStack[v] = true;
    path = [...path, v];

    for (const neighbor of (adj[v] || [])) {
      if (!visited[neighbor]) {
        const result = dfs(neighbor, path);
        if (result.length) return result;
      } else if (recStack[neighbor]) {
        // Found cycle
        const cycleStart = path.indexOf(neighbor);
        return path.slice(cycleStart);
      }
    }
    recStack[v] = false;
    return [];
  }

  for (const node of nodes) {
    if (!visited[node.id]) {
      const cycle = dfs(node.id, []);
      if (cycle.length) { cycleNodes = cycle; break; }
    }
  }

  if (cycleNodes.length) {
    drawRAG(cycleNodes);
    showRAGMessage(`🚨 DEADLOCK DETECTED! Cycle: ${cycleNodes.join(' → ')} → ${cycleNodes[0]}`, 'error');
    setStatus('ragStatus', 'DEADLOCK', 'unsafe');
  } else {
    drawRAG([]);
    showRAGMessage('✅ No cycle detected. System is deadlock-free.', 'ok');
    setStatus('ragStatus', 'NO CYCLE', 'safe');
  }
}

function showRAGMessage(msg, type) {
  const out = document.getElementById('ragOutput');
  out.classList.remove('hidden');
  const colorMap = { error: 'var(--accent2)', ok: 'var(--accent3)', info: 'var(--accent)', warn: 'var(--accent4)' };
  out.innerHTML = `<span style="font-family:var(--font-mono);font-size:0.85rem;color:${colorMap[type]||'var(--text-sec)'}">${msg}</span>`;
}

/* ── DRAG ── */
function ragMouseDown(e) {
  const rect = ragCanvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (ragCanvas.width / rect.width);
  const my = (e.clientY - rect.top)  * (ragCanvas.height / rect.height);
  for (const node of ragState.nodes) {
    const dx = mx - node.x, dy = my - node.y;
    if (Math.sqrt(dx*dx + dy*dy) < 30) {
      ragState.dragging = node;
      ragState.dragOffX = dx;
      ragState.dragOffY = dy;
      return;
    }
  }
}

function ragMouseMove(e) {
  if (!ragState.dragging) return;
  const rect = ragCanvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (ragCanvas.width / rect.width);
  const my = (e.clientY - rect.top)  * (ragCanvas.height / rect.height);
  ragState.dragging.x = mx - ragState.dragOffX;
  ragState.dragging.y = my - ragState.dragOffY;
  drawRAG();
}
