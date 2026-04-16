/* ============================================================
   마우스 지글러 — app.js
   ============================================================ */

'use strict';

// ── DOM refs ─────────────────────────────────────────────────
const btn = document.getElementById('mainBtn');
const btnIcon = btn.querySelector('.btn-icon');
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
let direction = 1;

// ── Helpers ───────────────────────────────────────────────────

function formatUptime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const sec = String(totalSec % 60).padStart(2, '0');
  return h + ':' + m + ':' + sec;
}

function addLog(msg) {
  const time = new Date().toLocaleTimeString('ko-KR', { hour12: false });
  const entry = document.createElement('div');
  entry.className = 'log-entry new';
  entry.textContent = '[' + time + '] ' + msg;
  logEntries.insertBefore(entry, logEntries.firstChild);
  setTimeout(() => entry.classList.remove('new'), 400);
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
    wakeLockObj.addEventListener('release', () => { wakeLockObj = null; });
  } catch (err) {
    addLog('Wake Lock 실패: ' + err.message);
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

function doJiggle() {
  moveCount++;
  direction *= -1;
  const px = stealthMode.checked ? direction : direction * 3;

  document.dispatchEvent(new MouseEvent('mousemove', {
    bubbles: true,
    cancelable: true,
    clientX: window.innerWidth / 2 + px,
    clientY: window.innerHeight / 2 + px,
  }));

  window.focus();
  document.title = '● 지글러 작동 중 (' + moveCount + ')';
  addLog('신호 전송 #' + moveCount + ' (' + (px > 0 ? '+' : '') + px + 'px)');
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
    running = true;
    moveCount = 0;
    startTime = Date.now();

    btn.classList.add('on');
    btnIcon.textContent = '\u23F9';
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
    running = false;

    stopJiggle();
    clearInterval(uptimeTimer);
    uptimeTimer = null;
    uptimeEl.textContent = '00:00:00';

    btn.classList.remove('on');
    btnIcon.textContent = '\u25B6';
    dot.classList.remove('on');
    statusText.textContent = '대기 중';
    statusText.classList.remove('on');
    card.classList.remove('active');

    document.title = '마우스 지글러';
    await releaseWakeLock();
    addLog('중지됨 — 총 ' + moveCount + '회 신호 전송');
  }
}

// ── Event Listeners ───────────────────────────────────────────

// 클릭
btn.addEventListener('click', toggleRunning);

// 스페이스바 — input/textarea 포커스 중엔 제외, 나머지 어디서든 동작
document.addEventListener('keydown', function(e) {
  if (e.code !== 'Space') return;
  const tag = document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  e.preventDefault();
  toggleRunning();
});

// 슬라이더
intervalSlider.addEventListener('input', function() {
  intervalVal.textContent = intervalSlider.value + '초';
  if (running) { stopJiggle(); startJiggle(); }
});

// Wake Lock 토글
wakeLockToggle.addEventListener('change', async function() {
  if (wakeLockToggle.checked && running) await requestWakeLock();
  else await releaseWakeLock();
});

// 탭 복귀 시 Wake Lock 재취득
document.addEventListener('visibilitychange', async function() {
  if (
    document.visibilityState === 'visible' &&
    running &&
    wakeLockToggle.checked &&
    !wakeLockObj
  ) {
    await requestWakeLock();
  }
});
