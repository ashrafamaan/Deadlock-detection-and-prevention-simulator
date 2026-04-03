/* ============================================================
   BANKER'S ALGORITHM — banker.js
   ============================================================ */

let bankerState = { n: 4, m: 3, available: [], max: [], allocation: [], need: [] };

function initBanker() {
  bankerState.n = parseInt(document.getElementById('numProcesses').value) || 4;
  bankerState.m = parseInt(document.getElementById('numResources').value) || 3;
  renderAvailableMatrix();
  renderMaxMatrix();
  renderAllocationMatrix();
  document.getElementById('bankerOutput').classList.add('hidden');
  setStatus('bankerStatus', 'IDLE', '');
}

function renderAvailableMatrix() {
  const { m } = bankerState;
  const c = document.getElementById('availableContainer');
  let html = '<div class="matrix-row">';
  for (let j = 0; j < m; j++) {
    const val = bankerState.available[j] !== undefined ? bankerState.available[j] : 3;
    html += `<input type="number" class="avail-input" id="avail_${j}" value="${val}" min="0" max="20" onchange="computeNeed()">`;
  }
  html += '</div>';
  c.innerHTML = html;
}

function renderMaxMatrix() {
  const { n, m } = bankerState;
  const c = document.getElementById('maxContainer');
  let html = '';
  for (let i = 0; i < n; i++) {
    html += `<div class="matrix-row"><span class="matrix-label">P${i}</span>`;
    for (let j = 0; j < m; j++) {
      const val = (bankerState.max[i] && bankerState.max[i][j] !== undefined) ? bankerState.max[i][j] : Math.floor(Math.random() * 6) + 2;
      html += `<input type="number" id="max_${i}_${j}" value="${val}" min="0" max="20" onchange="computeNeed()">`;
    }
    html += '</div>';
  }
  c.innerHTML = html;
}

function renderAllocationMatrix() {
  const { n, m } = bankerState;
  const c = document.getElementById('allocationContainer');
  let html = '';
  for (let i = 0; i < n; i++) {
    html += `<div class="matrix-row"><span class="matrix-label">P${i}</span>`;
    for (let j = 0; j < m; j++) {
      const val = (bankerState.allocation[i] && bankerState.allocation[i][j] !== undefined) ? bankerState.allocation[i][j] : Math.floor(Math.random() * 3);
      html += `<input type="number" id="alloc_${i}_${j}" value="${val}" min="0" max="20" onchange="computeNeed()">`;
    }
    html += '</div>';
  }
  c.innerHTML = html;
  computeNeed();
}

function readMatrices() {
  const { n, m } = bankerState;
  bankerState.available = [];
  bankerState.max = [];
  bankerState.allocation = [];
  bankerState.need = [];

  for (let j = 0; j < m; j++) {
    bankerState.available[j] = parseInt(document.getElementById(`avail_${j}`).value) || 0;
  }
  for (let i = 0; i < n; i++) {
    bankerState.max[i] = [];
    bankerState.allocation[i] = [];
    bankerState.need[i] = [];
    for (let j = 0; j < m; j++) {
      bankerState.max[i][j] = parseInt(document.getElementById(`max_${i}_${j}`).value) || 0;
      bankerState.allocation[i][j] = parseInt(document.getElementById(`alloc_${i}_${j}`).value) || 0;
      bankerState.need[i][j] = bankerState.max[i][j] - bankerState.allocation[i][j];
    }
  }
}

function computeNeed() {
  readMatrices();
  const { n, m } = bankerState;
  const c = document.getElementById('needContainer');
  let html = '';
  for (let i = 0; i < n; i++) {
    html += `<div class="matrix-row"><span class="matrix-label">P${i}</span>`;
    for (let j = 0; j < m; j++) {
      const need = bankerState.need[i][j];
      const cls = need < 0 ? 'style="color:var(--accent2)"' : '';
      html += `<span class="computed-value" ${cls}>${need}</span>`;
    }
    html += '</div>';
  }
  c.innerHTML = html;
}

function runBankerAlgorithm() {
  readMatrices();
  const { n, m, available, max, allocation, need } = bankerState;

  // Validate
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (need[i][j] < 0) {
        showBankerResult(false, [], ['<span class="step-warn">✗ Error: Allocation exceeds Max for P' + i + ' R' + j + '. Fix inputs.</span>']);
        return;
      }
    }
  }

  setStatus('bankerStatus', 'RUNNING', 'running');
  const steps = [];
  const work = [...available];
  const finish = Array(n).fill(false);
  const safeSeq = [];
  const maxIter = n * n + 5;

  steps.push(`<span class="step-info">▶ Starting Banker's Algorithm</span>`);
  steps.push(`<span class="step-info">  Work = [${work.join(', ')}]</span>`);
  steps.push(`<span class="step-info">  Finish = [${finish.join(', ')}]</span>`);
  steps.push('');

  let count = 0, iter = 0;
  while (count < n && iter < maxIter) {
    iter++;
    let found = false;
    for (let i = 0; i < n; i++) {
      if (!finish[i]) {
        let canAllocate = true;
        for (let j = 0; j < m; j++) {
          if (need[i][j] > work[j]) { canAllocate = false; break; }
        }
        if (canAllocate) {
          steps.push(`<span class="step-ok">✓ P${i}: Need[${need[i].join(',')}] ≤ Work[${work.join(',')}] → CAN proceed</span>`);
          for (let j = 0; j < m; j++) work[j] += allocation[i][j];
          finish[i] = true;
          safeSeq.push(i);
          count++;
          found = true;
          steps.push(`<span class="step-ok">  Work updated → [${work.join(', ')}]</span>`);
        } else {
          steps.push(`<span class="step-warn">✗ P${i}: Need[${need[i].join(',')}] > Work[${work.join(',')}] → waiting</span>`);
        }
      }
    }
    if (!found) break;
  }

  const isSafe = count === n;
  if (isSafe) {
    steps.push('');
    steps.push(`<span class="step-ok">✅ System is in SAFE STATE</span>`);
    steps.push(`<span class="step-ok">   Safe Sequence: &lt;${safeSeq.map(p=>'P'+p).join(' → ')}&gt;</span>`);
    setStatus('bankerStatus', 'SAFE', 'safe');
  } else {
    steps.push('');
    steps.push(`<span class="step-warn">💀 System is in UNSAFE STATE — Deadlock possible!</span>`);
    const deadlocked = finish.map((f,i) => f ? null : 'P'+i).filter(Boolean);
    steps.push(`<span class="step-warn">   Deadlocked processes: ${deadlocked.join(', ')}</span>`);
    setStatus('bankerStatus', isSafe ? 'SAFE' : 'UNSAFE', isSafe ? 'safe' : 'unsafe');
  }

  showBankerResult(isSafe, safeSeq, steps);
}

function showBankerResult(isSafe, seq, steps) {
  const out = document.getElementById('bankerOutput');
  const badge = document.getElementById('bankerResult');
  const seqEl = document.getElementById('safeSequence');
  const stepsEl = document.getElementById('bankerSteps');

  out.classList.remove('hidden');
  badge.className = 'result-badge ' + (isSafe ? 'safe' : 'unsafe');
  badge.textContent = isSafe ? '✅ SAFE STATE' : '🚨 UNSAFE STATE';
  seqEl.textContent = isSafe ? `Safe Sequence: ${seq.map(p => 'P' + p).join(' → ')}` : 'No safe sequence exists';
  stepsEl.innerHTML = steps.join('<br>');
}

function loadBankerPreset() {
  bankerState.n = 5; bankerState.m = 3;
  document.getElementById('numProcesses').value = 5;
  document.getElementById('numResources').value = 3;

  const presetMax       = [[7,5,3],[3,2,2],[9,0,2],[2,2,2],[4,3,3]];
  const presetAlloc     = [[0,1,0],[2,0,0],[3,0,2],[2,1,1],[0,0,2]];
  const presetAvail     = [3,3,2];

  bankerState.max = presetMax;
  bankerState.allocation = presetAlloc;
  bankerState.available = presetAvail;

  renderAvailableMatrix();
  renderMaxMatrix();
  renderAllocationMatrix();
}
