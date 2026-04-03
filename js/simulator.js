/* ============================================================
   DEADLOCK SIMULATOR — simulator.js
   ============================================================ */

let simState = {
  processes: 3, resources: 2,
  procList: [], resList: [],
  steps: [], currentStep: 0,
  isRunning: false,
  allocation: {}, waiting: {},
  speed: 2,
  animFrame: null
};

let simCanvas, simCtx;

function initSimulator() {
  simState.processes = parseInt(document.getElementById('simProcesses').value) || 3;
  simState.resources = parseInt(document.getElementById('simResources').value) || 2;
  simState.procList = Array.from({ length: simState.processes }, (_, i) => ({ id: 'P' + i, state: 'ready', heldRes: [] }));
  simState.resList  = Array.from({ length: simState.resources }, (_, i) => ({ id: 'R' + i, heldBy: null, waitQueue: [] }));
  simState.steps = [];
  simState.currentStep = 0;
  simState.isRunning = false;
  simState.allocation = {};
  simState.waiting = {};

  simCanvas = document.getElementById('simCanvas');
  simCtx = simCanvas.getContext('2d');
  resizeSimCanvas();
  populateSimSelects();
  drawSim();
  clearEventLog();
  document.getElementById('simOutput').classList.add('hidden');
  setStatus('simStatus', 'READY', 'running');
}

function resizeSimCanvas() {
  const wrap = document.querySelector('.sim-visual');
  simCanvas.width  = wrap.clientWidth  || 600;
  simCanvas.height = 320;
}

function populateSimSelects() {
  const ps = document.getElementById('simProcess');
  const rs = document.getElementById('simResource');
  ps.innerHTML = simState.procList.map(p => `<option value="${p.id}">${p.id}</option>`).join('');
  rs.innerHTML = simState.resList.map(r => `<option value="${r.id}">${r.id}</option>`).join('');
}

function addSimStep() {
  const proc   = document.getElementById('simProcess').value;
  const action = document.getElementById('simAction').value;
  const res    = document.getElementById('simResource').value;
  simState.steps.push({ proc, action, res });
  logEvent(`Step ${simState.steps.length}: ${proc} → ${action} ${res}`, 'info');
}

function runSimulation() {
  if (simState.steps.length === 0) {
    logEvent('No steps defined. Add steps or load a preset.', 'warn'); return;
  }
  simState.currentStep = 0;
  resetSimState();
  simState.isRunning = true;
  setStatus('simStatus', 'RUNNING', 'running');
  runNextStep();
}

function stepSimulation() {
  if (simState.currentStep >= simState.steps.length) {
    logEvent('All steps executed.', 'info'); return;
  }
  executeStep(simState.steps[simState.currentStep]);
  simState.currentStep++;
}

function resetSimulation() {
  simState.currentStep = 0;
  simState.isRunning = false;
  if (simState.animFrame) clearTimeout(simState.animFrame);
  resetSimState();
  clearEventLog();
  drawSim();
  setStatus('simStatus', 'READY', 'running');
  document.getElementById('simOutput').classList.add('hidden');
}

function resetSimState() {
  simState.procList.forEach(p => { p.state = 'ready'; p.heldRes = []; });
  simState.resList.forEach(r => { r.heldBy = null; r.waitQueue = []; });
}

function runNextStep() {
  if (!simState.isRunning || simState.currentStep >= simState.steps.length) {
    simState.isRunning = false;
    checkDeadlock();
    return;
  }
  executeStep(simState.steps[simState.currentStep]);
  simState.currentStep++;
  const delays = [800, 600, 400, 200, 100];
  simState.animFrame = setTimeout(runNextStep, delays[simState.speed - 1] || 400);
}

function executeStep(step) {
  const { proc, action, res } = step;
  const pObj = simState.procList.find(p => p.id === proc);
  const rObj = simState.resList.find(r => r.id === res);
  if (!pObj || !rObj) return;

  if (action === 'request') {
    if (rObj.heldBy === null) {
      logEvent(`${proc} requested ${res} — blocked (resource free, use Acquire)`, 'warn');
    } else if (rObj.heldBy === proc) {
      logEvent(`${proc} already holds ${res}`, 'info');
    } else {
      pObj.state = 'waiting';
      rObj.waitQueue.push(proc);
      logEvent(`${proc} requested ${res} — BLOCKED (held by ${rObj.heldBy})`, 'err');
    }
  } else if (action === 'acquire') {
    if (rObj.heldBy === null) {
      rObj.heldBy = proc;
      pObj.heldRes.push(res);
      pObj.state = 'running';
      logEvent(`${proc} ACQUIRED ${res} ✓`, 'ok');
    } else {
      pObj.state = 'waiting';
      rObj.waitQueue.push(proc);
      logEvent(`${proc} wants ${res} — BLOCKED (held by ${rObj.heldBy})`, 'err');
    }
  } else if (action === 'release') {
    if (rObj.heldBy === proc) {
      rObj.heldBy = null;
      pObj.heldRes = pObj.heldRes.filter(r => r !== res);
      pObj.state = pObj.heldRes.length > 0 ? 'running' : 'ready';
      logEvent(`${proc} RELEASED ${res}`, 'ok');
      // Grant to next in queue
      if (rObj.waitQueue.length > 0) {
        const next = rObj.waitQueue.shift();
        const nextP = simState.procList.find(p => p.id === next);
        rObj.heldBy = next;
        if (nextP) { nextP.heldRes.push(res); nextP.state = 'running'; }
        logEvent(`${res} granted to ${next} from wait queue`, 'ok');
      }
    } else {
      logEvent(`${proc} cannot release ${res} — doesn't hold it`, 'warn');
    }
  }
  drawSim();
}

function checkDeadlock() {
  const deadlocked = simState.procList.filter(p => p.state === 'waiting');
  if (deadlocked.length > 0) {
    const names = deadlocked.map(p => p.id).join(', ');
    logEvent(`🚨 DEADLOCK DETECTED! Processes blocked: ${names}`, 'err');
    setStatus('simStatus', 'DEADLOCK', 'unsafe');
    showSimOutput(`Deadlock detected involving: ${names}`, false);
  } else {
    logEvent('✅ Simulation complete. No deadlock detected.', 'ok');
    setStatus('simStatus', 'OK', 'safe');
    showSimOutput('Simulation complete — no deadlock.', true);
  }
}

/* ── DRAWING ── */
function drawSim() {
  if (!simCtx) return;
  const ctx = simCtx;
  const W = simCanvas.width, H = simCanvas.height;
  ctx.clearRect(0, 0, W, H);

  // Background grid
  ctx.strokeStyle = 'rgba(26,42,74,0.3)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 50) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = 0; y < H; y += 50) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  const pCount = simState.procList.length;
  const rCount = simState.resList.length;

  // Position nodes
  const pX = W * 0.25;
  const rX = W * 0.75;
  const pPositions = simState.procList.map((p, i) => ({ ...p, x: pX, y: (H / (pCount + 1)) * (i + 1) }));
  const rPositions = simState.resList.map((r, i) => ({ ...r, x: rX, y: (H / (rCount + 1)) * (i + 1) }));

  // Draw allocation arrows (R → P, green)
  simState.resList.forEach(r => {
    if (r.heldBy) {
      const rPos = rPositions.find(rp => rp.id === r.id);
      const pPos = pPositions.find(pp => pp.id === r.heldBy);
      if (rPos && pPos) drawSimArrow(ctx, rPos.x, rPos.y, pPos.x, pPos.y, '#39ff14');
    }
    r.waitQueue.forEach(proc => {
      const rPos = rPositions.find(rp => rp.id === r.id);
      const pPos = pPositions.find(pp => pp.id === proc);
      if (rPos && pPos) drawSimArrow(ctx, pPos.x, pPos.y, rPos.x, rPos.y, '#ff3a6e', true);
    });
  });

  // Draw process nodes
  pPositions.forEach(p => {
    const stateColors = { ready: '#00d4ff', running: '#39ff14', waiting: '#ff3a6e' };
    const col = stateColors[p.state] || '#00d4ff';
    ctx.beginPath(); ctx.arc(p.x, p.y, 26, 0, Math.PI*2);
    ctx.fillStyle = `${col}22`;
    ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    if (p.state === 'waiting') { ctx.shadowColor = '#ff3a6e'; ctx.shadowBlur = 16; }
    ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = col; ctx.font = 'bold 12px "Share Tech Mono"';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(p.id, p.x, p.y - 4);
    ctx.font = '9px "Share Tech Mono"'; ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(p.state, p.x, p.y + 10);
  });

  // Draw resource nodes
  rPositions.forEach(r => {
    const s = 22;
    const col = r.heldBy ? '#ffb800' : '#39ff14';
    ctx.beginPath(); ctx.rect(r.x - s, r.y - s, s*2, s*2);
    ctx.fillStyle = `${col}18`; ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = col; ctx.font = 'bold 12px "Share Tech Mono"';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(r.id, r.x, r.y - 4);
    ctx.font = '9px "Share Tech Mono"'; ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(r.heldBy ? `held:${r.heldBy}` : 'free', r.x, r.y + 10);
  });
}

function drawSimArrow(ctx, x1, y1, x2, y2, color, dashed = false) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx*dx+dy*dy);
  const nx = dx/len, ny = dy/len, off = 28;
  const sx = x1+nx*off, sy = y1+ny*off, ex = x2-nx*off, ey = y2-ny*off;
  ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(ex,ey);
  ctx.strokeStyle = color; ctx.lineWidth = 1.8;
  ctx.setLineDash(dashed ? [6,4] : []);
  ctx.stroke(); ctx.setLineDash([]);
  const angle = Math.atan2(ey-sy, ex-sx), aL = 9;
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex-aL*Math.cos(angle-Math.PI/6), ey-aL*Math.sin(angle-Math.PI/6));
  ctx.lineTo(ex-aL*Math.cos(angle+Math.PI/6), ey-aL*Math.sin(angle+Math.PI/6));
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}

function showSimOutput(msg, ok) {
  const out = document.getElementById('simOutput');
  out.classList.remove('hidden');
  out.innerHTML = `<span style="font-family:var(--font-mono);font-size:0.85rem;color:${ok?'var(--accent3)':'var(--accent2)'}">
    ${ok ? '✅' : '🚨'} ${msg}</span>`;
}

function logEvent(msg, type) {
  const log = document.getElementById('simEventLog');
  const cls = { ok:'ev-ok', warn:'ev-warn', err:'ev-err', info:'ev-info' }[type] || '';
  log.innerHTML += `<div class="${cls}">[${String(simState.currentStep+1).padStart(2,'0')}] ${msg}</div>`;
  log.scrollTop = log.scrollHeight;
}

function clearEventLog() { document.getElementById('simEventLog').innerHTML = ''; }

function updateSpeed(val) {
  simState.speed = parseInt(val);
  const labels = ['','0.5x','1x','2x','3x','5x'];
  document.getElementById('speedLabel').textContent = labels[val] || val + 'x';
}

/* ── PRESETS ── */
const PRESETS = {
  circular: {
    processes: 3, resources: 3,
    steps: [
      { proc:'P0', action:'acquire', res:'R0' },
      { proc:'P1', action:'acquire', res:'R1' },
      { proc:'P2', action:'acquire', res:'R2' },
      { proc:'P0', action:'acquire', res:'R1' }, // blocked by P1
      { proc:'P1', action:'acquire', res:'R2' }, // blocked by P2
      { proc:'P2', action:'acquire', res:'R0' }, // blocked by P0 → deadlock
    ]
  },
  dining: {
    processes: 4, resources: 4,
    steps: [
      { proc:'P0', action:'acquire', res:'R0' },
      { proc:'P1', action:'acquire', res:'R1' },
      { proc:'P2', action:'acquire', res:'R2' },
      { proc:'P3', action:'acquire', res:'R3' },
      { proc:'P0', action:'acquire', res:'R1' },
      { proc:'P1', action:'acquire', res:'R2' },
      { proc:'P2', action:'acquire', res:'R3' },
      { proc:'P3', action:'acquire', res:'R0' },
    ]
  },
  producer: {
    processes: 2, resources: 2,
    steps: [
      { proc:'P0', action:'acquire', res:'R0' },
      { proc:'P1', action:'acquire', res:'R1' },
      { proc:'P0', action:'acquire', res:'R1' },
      { proc:'P1', action:'acquire', res:'R0' },
    ]
  },
  twoprocess: {
    processes: 2, resources: 2,
    steps: [
      { proc:'P0', action:'acquire', res:'R0' },
      { proc:'P1', action:'acquire', res:'R1' },
      { proc:'P0', action:'acquire', res:'R1' },
      { proc:'P1', action:'acquire', res:'R0' },
    ]
  },
  custom: {
    processes: 3, resources: 2,
    steps: []
  }
};

function loadPreset(name) {
  const p = PRESETS[name]; if (!p) return;
  document.getElementById('simProcesses').value = p.processes;
  document.getElementById('simResources').value = p.resources;
  initSimulator();
  simState.steps = [...p.steps];
  p.steps.forEach((s,i) => logEvent(`Step ${i+1}: ${s.proc} → ${s.action} ${s.res}`, 'info'));
  logEvent(`--- Preset "${name}" loaded (${p.steps.length} steps) ---`, 'ok');
}
