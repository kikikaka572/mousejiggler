/* ============================================================
   마우스 지글러 — app.js
   ============================================================ */

'use strict';

// ── DOM refs ─────────────────────────────────────────────────
const btn = document.getElementById('mainBtn');
const dot = document.getElementById('dot');
const statusText = document.getElementById('statusText');
const uptimeEl = document.getElementById('uptime');
const intervalSlider = document.getElementById('intervalSlider');
const intervalVal = document.getElementById('intervalVal');
const stealthMode = document.getElementById('stealthMode');
const wakeLockToggle = document.getElementById('wakeLock');
const logEntries = document.getElementById('logEntries');
const card = document.getElementById('card');

// ── State ─────────────────────────────────────────────────────
let running = false;
let jiggleTimer = null;
let uptimeTimer = null;
let startTime = null;
let wakeLockObj = null;
let moveCount = 0;
let direction = 1; // alternates +1 / -1 for natural movement

// ── Helpers ───────────────────────────────────────────────────

/** Format milliseconds → HH:MM:SS */
function formatUptime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const sec = String(totalSec % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
}

/** Prepend a timestamped entry to the activity log (max 3 lines). */
function addLog(msg) {
  const time = new Date().toLocaleTimeString('ko-KR', { hour12: false });
  const entry = document.createElement('div');
  entry.className = 'log-entry new';
  entry.textContent = `[${time}] ${msg}`;
  logEntries.insertBefore(entry, logEntries.firstChild);

  // Remove highlight after animation
  setTimeout(() => entry.classList.remove('new'), 400);

  // Keep at most 3 entries visible
  while (logEntries.children.length > 3) {
    logEntries.removeChild(logEntries.lastChild);
  }
}

// ── Wake Lock ─────────────────────────────────────────────────

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) {
    addLog('Wake Lock 미지원 환경');
    wakeLockToggle.checked = false;
    return;
  }
  try {
    wakeLockObj = await navigator.wakeLock.request('screen');
    addLog('Wake Lock 활성화');
    // Re-acquire on page becoming visible again
    wakeLockObj.addEventListener('release', () => {
      wakeLockObj = null;
    });
  } catch (err) {
    addLog(`Wake Lock 실패: ${err.message}`);
    wakeLockToggle.checked = false;
  }
}

async function releaseWakeLock() {
  if (wakeLockObj) {
    await wakeLockObj.release();
    wakeLockObj = null;
    addLog('Wake Lock 해제');
  }
}

// ── Core Jiggle ───────────────────────────────────────────────

/**
 * Sends a synthetic mousemove event and pings the window to
 * prevent browser/OS idle detection and Slack/Teams away status.
 *
 * True OS-level cursor movement requires a native app; this
 * browser approach is sufficient for most enterprise presence tools.
 */
function doJiggle() {
  moveCount++;
  direction *= -1; // alternate direction each tick

  const px = stealthMode.checked ? direction : direction * 3;

  // Synthetic mousemove
  document.dispatchEvent(new MouseEvent('mousemove', {
    bubbles: true,
    cancelable: true,
    clientX: window.innerWidth / 2 + px,
    clientY: window.innerHeight / 2 + px,
  }));

  // Keep window focused / active
  window.focus();

  // Update tab title so the OS doesn't treat it as idle
  document.title = `● 지글러 작동 중 (${moveCount})`;

  addLog(`신호 전송 #${moveCount} (${px > 0 ? '+' : ''}${px}px)`);
}

// ── Start / Stop ──────────────────────────────────────────────

function startJiggle() {
  const ms = parseInt(intervalSlider.value, 10) * 1000;
  jiggleTimer = setInterval(doJiggle, ms);
}

function stopJiggle() {
  clearInterval(jiggleTimer);
  jiggleTimer = null;
}

async function toggleRunning() {
  if (!running) {
    /* ── START ── */
    running = true;
    moveCount = 0;
    startTime = Date.now();

    btn.classList.add('on');
    dot.classList.add('on');
    statusText.textContent = '작동 중';
    statusText.classList.add('on');
    card.classList.add('active');

    addLog('지글러 시작됨');

    if (wakeLockToggle.checked) await requestWakeLock();

    startJiggle();

    uptimeTimer = setInterval(() => {
      uptimeEl.textContent = formatUptime(Date.now() - startTime);
    }, 1000);

  } else {
    /* ── STOP ── */
    running = false;

    stopJiggle();
    clearInterval(uptimeTimer);
    uptimeTimer = null;
    uptimeEl.textContent = '00:00:00';

    btn.classList.remove('on');
    dot.classList.remove('on');
    statusText.textContent = '대기 중';
    statusText.classList.remove('on');
    card.classList.remove('active');

    document.title = '마우스 지글러';

    await releaseWakeLock();

    addLog(`중지됨 — 총 ${moveCount}회 신호 전송`);
  }
}

// ── Event Listeners ───────────────────────────────────────────

btn.addEventListener('click', toggleRunning);

// Space key shortcut
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && e.target === document.body) {
    e.preventDefault();
    toggleRunning();
  }
});

// Interval slider
intervalSlider.addEventListener('input', () => {
  intervalVal.textContent = `${intervalSlider.value}초`;
  if (running) {
    stopJiggle();
    startJiggle();
  }
});

// Wake Lock toggle
wakeLockToggle.addEventListener('change', async () => {
  if (wakeLockToggle.checked && running) {
    await requestWakeLock();
  } else {
    await releaseWakeLock();
  }
});

// Re-acquire Wake Lock when tab regains visibility
document.addEventListener('visibilitychange', async () => {
  if (
    document.visibilityState === 'visible' &&
    running &&
    wakeLockToggle.checked &&
    !wakeLockObj
  ) {
    await requestWakeLock();
  }
});
