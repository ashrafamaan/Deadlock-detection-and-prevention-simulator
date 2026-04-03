/* ============================================================
   RECOVERY STRATEGIES — recovery.js
   ============================================================ */

let recState = {
  processes: [], resources: [],
  deadlocked: [], scenario: null
};

function setupRecovery() {
  const n = parseInt(document.getElementById('recProcesses').value) || 3;
  const m = parseInt(document.getElementById('recResources').value) || 3;

  // Generate a synthetic deadlock scenario
  recState.processes = Array.from({ length: n }, (_, i) => ({
    id: 'P' + i,
    priority: Math.floor(Math.random() * 10) + 1,
    age: Math.floor(Math.random() * 100) + 10,
    cost: Math.floor(Math.random() * 50) + 5,
    held: [],
    waiting: null,
    state: 'deadlocked',
    checkpointAge: Math.floor(Math.random() * 30) + 5
  }));

  recState.resources = Array.from({ length: m }, (_, i) => ({
    id: 'R' + i,
    heldBy: null, waitQueue: []
  }));

  // Create circular deadlock
  recState.processes.forEach((p, i) => {
    const resHeld = i % m;
    const resWant = (i + 1) % m;
    p.held = ['R' + resHeld];
    p.waiting = 'R' + resWant;
    recState.resources[resHeld].heldBy = p.id;
    recState.resources[resWant].waitQueue.push(p.id);
  });

  recState.deadlocked = [...recState.processes];
  recState.scenario = { n, m };

  displayScenario();
  document.getElementById('recoveryOutput').classList.add('hidden');
  setStatus('recoveryStatus', 'DEADLOCKED', 'unsafe');
}

function displayScenario() {
  const d = document.getElementById('recoveryScenarioDisplay');
  let html = '<table style="font-family:var(--font-mono);font-size:0.75rem;border-collapse:collapse;width:100%">';
  html += '<tr style="color:var(--accent);border-bottom:1px solid var(--border)">';
  html += '<th style="padding:6px 12px;text-align:left">Process</th>';
  html += '<th style="padding:6px 12px;text-align:left">Priority</th>';
  html += '<th style="padding:6px 12px;text-align:left">Age (ms)</th>';
  html += '<th style="padding:6px 12px;text-align:left">Cost</th>';
  html += '<th style="padding:6px 12px;text-align:left">Holds</th>';
  html += '<th style="padding:6px 12px;text-align:left">Waiting For</th>';
  html += '<th style="padding:6px 12px;text-align:left">Checkpoint</th>';
  html += '</tr>';

  recState.processes.forEach(p => {
    html += `<tr style="border-bottom:1px solid var(--border);color:var(--text-sec)">
      <td style="padding:5px 12px;color:var(--accent2)">${p.id}</td>
      <td style="padding:5px 12px">${p.priority}</td>
      <td style="padding:5px 12px">${p.age}</td>
      <td style="padding:5px 12px">${p.cost}</td>
      <td style="padding:5px 12px;color:var(--accent3)">${p.held.join(', ') || '—'}</td>
      <td style="padding:5px 12px;color:var(--accent4)">${p.waiting || '—'}</td>
      <td style="padding:5px 12px">${p.checkpointAge}ms ago</td>
    </tr>`;
  });
  html += '</table>';
  d.innerHTML = html;
}

function loadRecoveryPreset() {
  document.getElementById('recProcesses').value = 4;
  document.getElementById('recResources').value = 4;
  setupRecovery();
}

function applyRecovery(strategy) {
  if (!recState.scenario) {
    showRecoveryOutput('Please set up a scenario first.', false); return;
  }

  // Reset to deadlocked state
  recState.processes.forEach(p => { p.state = 'deadlocked'; });

  switch (strategy) {
    case 'terminate': applyTerminate(); break;
    case 'preempt':   applyPreemption(); break;
    case 'rollback':  applyRollback(); break;
    case 'auto':      applyAutoRecovery(); break;
  }
}

function applyTerminate() {
  const mode = document.querySelector('input[name="termMode"]:checked').value;
  const steps = [];
  const procs = [...recState.processes].sort((a,b) => a.priority - b.priority); // lowest priority first

  steps.push('📋 <b>Process Termination Strategy</b>');
  steps.push(`Mode: ${mode === 'one' ? 'Terminate one at a time' : 'Terminate all deadlocked'}`);
  steps.push('');

  let resolved = false;
  const terminated = [];

  for (const p of procs) {
    if (p.state !== 'deadlocked') continue;
    steps.push(`⚠ Terminating ${p.id} (priority=${p.priority}, cost=${p.cost})`);
    p.state = 'terminated';
    terminated.push(p.id);

    // Release its resources
    p.held.forEach(res => {
      const rObj = recState.resources.find(r => r.id === res);
      if (rObj) {
        steps.push(`  → Released ${res}`);
        rObj.heldBy = null;
        // Grant to waiting
        if (rObj.waitQueue.length > 0) {
          const next = rObj.waitQueue.shift();
          const nextP = recState.processes.find(p2 => p2.id === next);
          rObj.heldBy = next;
          if (nextP && nextP.state === 'deadlocked') {
            nextP.state = 'running';
            nextP.waiting = null;
            steps.push(`  → ${res} granted to ${next} — now running`);
          }
        }
      }
    });

    // Check if deadlock is resolved
    const stillDeadlocked = recState.processes.filter(p2 => p2.state === 'deadlocked');
    if (mode === 'one' && stillDeadlocked.length === 0) {
      resolved = true; break;
    } else if (mode === 'one') {
      steps.push(`  Remaining deadlocked: ${stillDeadlocked.map(p2=>p2.id).join(', ')}`);
      // continue if still deadlocked
      if (isDeadlockResolved()) { resolved = true; break; }
    }
    if (mode === 'all') resolved = true;
  }

  if (isDeadlockResolved() || mode === 'all') resolved = true;

  steps.push('');
  steps.push(`Terminated: ${terminated.join(', ')}`);
  steps.push(resolved ? '✅ Deadlock resolved successfully.' : '⚠ Deadlock may still exist.');
  steps.push(`System overhead: ${terminated.length * 15}ms estimated restart cost`);

  showRecoveryOutput(steps, resolved);
  setStatus('recoveryStatus', resolved ? 'RESOLVED' : 'PARTIAL', resolved ? 'safe' : 'running');
}

function applyPreemption() {
  const victimMode = document.getElementById('victimMode').value;
  const steps = [];
  steps.push('🔄 <b>Resource Preemption Strategy</b>');
  steps.push(`Victim selection: ${victimMode}`);
  steps.push('');

  let round = 0;
  while (!isDeadlockResolved() && round < 10) {
    round++;
    const deadlocked = recState.processes.filter(p => p.state === 'deadlocked');
    if (deadlocked.length === 0) break;

    // Pick victim
    let victim;
    if (victimMode === 'min-cost')    victim = deadlocked.sort((a,b) => a.cost - b.cost)[0];
    if (victimMode === 'youngest')    victim = deadlocked.sort((a,b) => a.age - b.age)[0];
    if (victimMode === 'fewest-res')  victim = deadlocked.sort((a,b) => a.held.length - b.held.length)[0];

    steps.push(`Round ${round}: Preempting from ${victim.id} (cost=${victim.cost})`);
    victim.held.forEach(res => {
      const rObj = recState.resources.find(r => r.id === res);
      if (rObj) {
        rObj.heldBy = null;
        steps.push(`  → Preempted ${res} from ${victim.id}`);
        if (rObj.waitQueue.length > 0) {
          const next = rObj.waitQueue.shift();
          const nextP = recState.processes.find(p => p.id === next);
          rObj.heldBy = next;
          if (nextP) { nextP.state = 'running'; nextP.waiting = null; }
          steps.push(`  → ${res} granted to ${next}`);
        }
      }
    });
    victim.state = 'preempted';
    victim.held = [];
  }

  const resolved = isDeadlockResolved();
  steps.push('');
  steps.push(resolved ? '✅ Deadlock resolved via preemption.' : '⚠ Could not fully resolve.');
  steps.push(`Rollback cost: estimated ${round * 20}ms overhead`);

  showRecoveryOutput(steps, resolved);
  setStatus('recoveryStatus', resolved ? 'RESOLVED' : 'PARTIAL', resolved ? 'safe' : 'running');
}

function applyRollback() {
  const depth = parseInt(document.getElementById('rollbackDepth').value) || 1;
  const steps = [];
  steps.push('↩ <b>Checkpoint Rollback Strategy</b>');
  steps.push(`Rollback depth: ${depth} checkpoint(s)`);
  steps.push('');

  // Sort by oldest checkpoint (roll those back first)
  const sorted = [...recState.processes].filter(p=>p.state==='deadlocked').sort((a,b) => b.checkpointAge - a.checkpointAge);

  for (let d = 0; d < depth && !isDeadlockResolved(); d++) {
    sorted.forEach(p => {
      if (p.state !== 'deadlocked') return;
      steps.push(`Rolling back ${p.id} to checkpoint (${p.checkpointAge}ms ago)`);
      // Release all held resources
      p.held.forEach(res => {
        const rObj = recState.resources.find(r => r.id === res);
        if (rObj) {
          rObj.heldBy = null;
          steps.push(`  → Released ${res}`);
          if (rObj.waitQueue.length > 0) {
            const next = rObj.waitQueue.shift();
            const nextP = recState.processes.find(p2 => p2.id === next);
            rObj.heldBy = next;
            if (nextP) { nextP.state = 'running'; nextP.waiting = null; }
            steps.push(`  → ${res} granted to ${next}`);
          }
        }
      });
      p.state = 'rollback';
      p.held = [];
      p.waiting = null;
    });
  }

  const resolved = isDeadlockResolved();
  steps.push('');
  steps.push(resolved ? '✅ Deadlock resolved. Processes will re-execute from checkpoints.' : '⚠ Deadlock persists.');

  showRecoveryOutput(steps, resolved);
  setStatus('recoveryStatus', resolved ? 'RESOLVED' : 'PARTIAL', resolved ? 'safe' : 'running');
}

function applyAutoRecovery() {
  const optimize = document.getElementById('autoOptimize').checked;
  const steps = [];
  steps.push('🤖 <b>Auto Recovery — Intelligent Strategy Selector</b>');
  steps.push('');

  // Analyze scenario
  const n = recState.processes.length;
  const totalCost = recState.processes.reduce((s,p) => s+p.cost, 0);
  const avgAge = recState.processes.reduce((s,p) => s+p.age, 0) / n;

  steps.push(`Analysis: ${n} deadlocked processes, avg age=${avgAge.toFixed(0)}ms, total cost=${totalCost}`);

  let chosen;
  if (n <= 2) {
    chosen = 'terminate';
    steps.push('Decision: Few processes → Process Termination (minimal overhead)');
  } else if (avgAge < 30) {
    chosen = 'rollback';
    steps.push('Decision: Young processes → Rollback (low re-execution cost)');
  } else if (optimize) {
    chosen = 'preempt';
    steps.push('Decision: Optimize throughput → Resource Preemption');
  } else {
    chosen = 'terminate';
    steps.push('Decision: Default → Process Termination');
  }

  steps.push('');
  steps.push(`Executing: ${chosen.toUpperCase()}...`);
  steps.push('');

  showRecoveryOutput(steps, null);

  // Execute chosen strategy
  setTimeout(() => {
    if (chosen === 'terminate') applyTerminate();
    else if (chosen === 'rollback') applyRollback();
    else applyPreemption();
  }, 300);
}

function isDeadlockResolved() {
  return recState.processes.every(p => p.state !== 'deadlocked');
}

function showRecoveryOutput(steps, success) {
  const out = document.getElementById('recoveryOutput');
  out.classList.remove('hidden');
  const lines = Array.isArray(steps) ? steps : [steps];
  let color = success === null ? 'var(--accent)' : (success ? 'var(--accent3)' : 'var(--accent4)');
  out.innerHTML = `<div style="font-family:var(--font-mono);font-size:0.8rem;line-height:2;color:var(--text-sec)">
    ${lines.map(l => `<div style="${l.startsWith('✅')?'color:var(--accent3)':l.startsWith('⚠')||l.startsWith('⚠')?'color:var(--accent4)':l.startsWith('📋')||l.startsWith('🔄')||l.startsWith('↩')||l.startsWith('🤖')?'color:'+color:''}">${l}</div>`).join('')}
  </div>`;
}
