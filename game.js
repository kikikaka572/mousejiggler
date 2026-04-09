/* =============================================
   🐰 토끼의 동전 받기 — game.js
   ============================================= */

/* ── 별 & 구름 생성 ── */
const sky = document.getElementById('sky');
for (let i = 0; i < 90; i++) {
  const s = document.createElement('div');
  s.className = 'star';
  const sz = Math.random() * 2.5 + 0.7;
  s.style.cssText = `width:${sz}px;height:${sz}px;top:${Math.random()*92}%;left:${Math.random()*100}%;--d:${(Math.random()*2+1).toFixed(1)}s;animation-delay:${(Math.random()*3).toFixed(1)}s`;
  sky.appendChild(s);
}
for (let i = 0; i < 5; i++) {
  const c = document.createElement('div');
  c.className = 'cloud';
  const w = 80 + Math.random() * 120, h = w * 0.4;
  c.style.cssText = `width:${w}px;height:${h}px;top:${4+Math.random()*28}%;left:${Math.random()*100}%;animation-duration:${(22+Math.random()*28).toFixed(0)}s;animation-delay:-${(Math.random()*30).toFixed(0)}s`;
  sky.appendChild(c);
}

/* ── 캔버스 초기화 ── */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let W, H, GROUND_Y;
function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
  GROUND_Y = H - 110;
}
resize();
window.addEventListener('resize', resize);

/* ── 게임 상태 ── */
let score, best = 0, timeLeft, lives, gameRunning = false;
let lastTime = 0, spawnTimer = 0;
let particleList = [], floaties = [], items = [];
let keys = {};

/* ── DOM 참조 ── */
const scoreEl = document.getElementById('scoreDisplay');
const timerEl = document.getElementById('timerDisplay');
const bestEl = document.getElementById('bestDisplay');
const overlay = document.getElementById('overlay');
const goBox = document.getElementById('gameOverBox');
const goScore = document.getElementById('goScore');
const goBest = document.getElementById('goBest');
const bombFlash = document.getElementById('bombFlash');

/* ── 토끼 객체 ── */
const R = {
  w: 52, h: 60, x: 0, y: 0, vx: 0, facing: 1,
  legAnim: 0, earWiggle: 0, blinkTimer: 0, blinking: false,
  basketW: 72,
  basketCX() { return this.x + this.w / 2; },
  basketTopY() { return this.y - 8; },
  reset() {
    this.x = W / 2 - this.w / 2;
    this.y = GROUND_Y - this.h;
    this.vx = 0;
  }
};

/* ── 동전 종류 ── */
const COIN_TYPES = [
  { type: 'coin', value: 1, r: 14, color: '#c0a020', shine: '#ffe566', baseSpeed: 3.2 },
  { type: 'coin', value: 5, r: 16, color: '#a0a0a0', shine: '#e8e8e8', baseSpeed: 3.8 },
  { type: 'coin', value: 10, r: 18, color: '#c8720a', shine: '#ffcc88', baseSpeed: 4.4 },
];

/* ── 아이템 스폰 ── */
function spawnItem() {
  const x = 55 + Math.random() * (W - 110);
  const elapsed = 60 - timeLeft;
  const bombChance = 0.15 + elapsed * 0.004;

  if (Math.random() < bombChance) {
    items.push({ type: 'bomb', x, y: -25, r: 20, vy: 2.8 + Math.random() * 1.4, spin: 0, active: true });
  } else {
    const t = COIN_TYPES[Math.floor(Math.random() * (Math.random() < 0.5 ? 1 : COIN_TYPES.length))];
    const speed = t.baseSpeed + elapsed * 0.04 + Math.random() * 0.8;
    items.push({ ...t, x, y: -20, vy: speed, spin: 0, spinV: 0.055 + Math.random() * 0.04, active: true });
  }
}

/* ── 파티클 스폰 ── */
function spawnParticles(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 1.5 + Math.random() * 3.5;
    particleList.push({
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2,
      life: 1, decay: 0.026 + Math.random() * 0.018,
      color, r: 2.5 + Math.random() * 3
    });
  }
}

/* ── 팝업 텍스트 스폰 ── */
function spawnFloatie(x, y, text, color) {
  floaties.push({ x, y, text, color, life: 1, vy: -1.9 });
}

/* ── 목숨 UI 갱신 ── */
function updateLifeUI() {
  for (let i = 0; i < 3; i++) {
    const el = document.getElementById('h' + i);
    if (i < lives) { el.textContent = '💚'; el.classList.remove('lost'); }
    else { el.textContent = '🖤'; el.classList.add('lost'); }
  }
}

/* ── 폭탄 플래시 ── */
function triggerBombFlash() {
  bombFlash.classList.add('active');
  setTimeout(() => bombFlash.classList.remove('active'), 160);
}

/* ── 충돌 판정 (바구니 입구) ── */
function checkCatch(item) {
  const bx = R.basketCX(), by = R.basketTopY();
  const half = R.basketW / 2;
  return item.x >= bx - half && item.x <= bx + half
      && item.y >= by - 14 && item.y <= by + 26;
}

/* ── 토끼 & 바구니 그리기 ── */
function drawRabbit() {
  const cx = R.x + R.w / 2;
  const midY = R.y + R.h / 2;
  const isMoving = Math.abs(R.vx) > 0.3;
  const legSwing = isMoving ? Math.sin(R.legAnim * 0.22) * 10 : 0;

  ctx.save();
  ctx.translate(cx, midY);
  ctx.scale(R.facing, 1);

  // 그림자
  ctx.beginPath(); ctx.ellipse(0, R.h / 2, 22, 6, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fill();

  // 뒷다리
  ctx.save(); ctx.translate(0, 12); ctx.rotate((legSwing - 7) * Math.PI / 180);
  ctx.beginPath(); ctx.roundRect(-6, 0, 12, 20, 6);
  ctx.fillStyle = '#f0e8e0'; ctx.fill(); ctx.restore();

  // 몸통
  ctx.beginPath(); ctx.ellipse(0, 8, 16, 20, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#f5f0ea'; ctx.fill();
  ctx.strokeStyle = '#d8cfc4'; ctx.lineWidth = 1.2; ctx.stroke();

  // 배
  ctx.beginPath(); ctx.ellipse(2, 10, 9, 13, 0.1, 0, Math.PI * 2);
  ctx.fillStyle = '#fffdf9'; ctx.fill();

  // 꼬리
  ctx.beginPath(); ctx.arc(-14, 8, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#fff'; ctx.fill();

  // 팔 (바구니 받침)
  ctx.save(); ctx.translate(-11, -1); ctx.rotate(-72 * Math.PI / 180);
  ctx.beginPath(); ctx.roundRect(-4, 0, 8, 17, 4);
  ctx.fillStyle = '#f0e8e0'; ctx.fill(); ctx.restore();

  ctx.save(); ctx.translate(11, -1); ctx.rotate(72 * Math.PI / 180);
  ctx.beginPath(); ctx.roundRect(-4, 0, 8, 17, 4);
  ctx.fillStyle = '#f0e8e0'; ctx.fill(); ctx.restore();

  // 머리
  ctx.beginPath(); ctx.ellipse(3, -13, 13, 14, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#f5f0ea'; ctx.fill();
  ctx.strokeStyle = '#d8cfc4'; ctx.lineWidth = 1; ctx.stroke();

  // 귀
  const wgl = Math.sin(R.earWiggle * 0.09) * 4;
  [[-4, -22, -8 + wgl], [10, -24, 6 - wgl * 0.5]].forEach(([ex, ey, rot]) => {
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(rot * Math.PI / 180);
    ctx.beginPath(); ctx.ellipse(0, -10, 5, 14, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#f5f0ea'; ctx.fill();
    ctx.strokeStyle = '#d8cfc4'; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, -10, 2.5, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#f8cece'; ctx.fill();
    ctx.restore();
  });

  // 눈
  const ey = -17;
  if (R.blinking) {
    ctx.beginPath(); ctx.moveTo(-2, ey); ctx.lineTo(2, ey + 2);
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, ey); ctx.lineTo(12, ey + 2); ctx.stroke();
  } else {
    [[-1, ey], [10, ey]].forEach(([ex, eey]) => {
      ctx.beginPath(); ctx.arc(ex, eey, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#333'; ctx.fill();
      ctx.beginPath(); ctx.arc(ex + 1, eey - 1, 1, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
    });
  }

  // 코 & 입 & 볼
  ctx.beginPath(); ctx.arc(5, ey + 6, 2, 0, Math.PI * 2);
  ctx.fillStyle = '#ffb3c6'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(3, ey + 8); ctx.quadraticCurveTo(5, ey + 12, 7, ey + 8);
  ctx.strokeStyle = '#c08080'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.globalAlpha = 0.35;
  ctx.beginPath(); ctx.arc(-2, ey + 4, 4, 0, Math.PI * 2); ctx.fillStyle = '#ffb3c6'; ctx.fill();
  ctx.beginPath(); ctx.arc(13, ey + 4, 4, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  ctx.restore();

  // ── 바구니 ──
  const bx = cx, bTopY = R.y - 8;
  const bw = R.basketW, bh = 30;

  ctx.save();
  ctx.translate(bx, bTopY);

  ctx.beginPath();
  ctx.moveTo(-bw / 2 + 8, bh); ctx.lineTo(bw / 2 - 8, bh);
  ctx.lineTo(bw / 2, 0); ctx.lineTo(-bw / 2, 0);
  ctx.closePath();
  const bg = ctx.createLinearGradient(0, 0, 0, bh);
  bg.addColorStop(0, '#d4920e'); bg.addColorStop(1, '#8b5e08');
  ctx.fillStyle = bg; ctx.fill();
  ctx.strokeStyle = '#6b4806'; ctx.lineWidth = 2; ctx.stroke();

  // 격자
  ctx.save(); ctx.clip();
  ctx.strokeStyle = 'rgba(0,0,0,.16)'; ctx.lineWidth = 1.5;
  for (let xi = -bw / 2; xi < bw / 2; xi += 10) {
    ctx.beginPath(); ctx.moveTo(xi, 0); ctx.lineTo(xi + 7, bh); ctx.stroke();
  }
  for (let yi = 0; yi <= bh; yi += 8) {
    ctx.beginPath(); ctx.moveTo(-bw / 2, yi); ctx.lineTo(bw / 2, yi); ctx.stroke();
  }
  ctx.restore();

  // 윗테두리
  ctx.beginPath(); ctx.moveTo(-bw / 2, 0); ctx.lineTo(bw / 2, 0);
  ctx.strokeStyle = '#e8a820'; ctx.lineWidth = 4; ctx.stroke();

  // 손잡이
  ctx.beginPath(); ctx.arc(0, -4, bw / 3, Math.PI, 0);
  ctx.strokeStyle = '#6b4806'; ctx.lineWidth = 4.5; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -4, bw / 3, Math.PI, 0);
  ctx.strokeStyle = '#d4920e'; ctx.lineWidth = 2.5; ctx.stroke();

  ctx.restore();
}

/* ── 동전 그리기 ── */
function drawCoin(c) {
  c.spin += c.spinV;
  const scaleX = Math.abs(Math.cos(c.spin));

  ctx.save(); ctx.translate(c.x, c.y); ctx.scale(scaleX, 1);
  ctx.beginPath(); ctx.arc(0, 0, c.r, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(-c.r * 0.3, -c.r * 0.3, 0, 0, 0, c.r);
  g.addColorStop(0, c.shine); g.addColorStop(1, c.color);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = c.color; ctx.lineWidth = 2; ctx.stroke();

  if (scaleX > 0.15) {
    ctx.globalAlpha = scaleX;
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.font = `bold ${c.r * 0.9}px Jua,cursive`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(c.value, 0, 1); ctx.globalAlpha = 1;
  }
  ctx.beginPath(); ctx.arc(-c.r * 0.25, -c.r * 0.28, c.r * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,.26)'; ctx.fill();
  ctx.restore();
}

/* ── 폭탄 그리기 ── */
function drawBomb(b) {
  b.spin += 0.045;
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.spin);

  ctx.beginPath(); ctx.arc(0, 2, b.r, 0, Math.PI * 2);
  const bg = ctx.createRadialGradient(-b.r * 0.3, -b.r * 0.1, 0, 0, 2, b.r);
  bg.addColorStop(0, '#555'); bg.addColorStop(1, '#111');
  ctx.fillStyle = bg; ctx.fill();
  ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 2.5; ctx.stroke();

  ctx.beginPath(); ctx.arc(-b.r * 0.28, -b.r * 0.1, b.r * 0.26, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fill();

  // 도화선
  ctx.beginPath();
  ctx.moveTo(0, -b.r);
  ctx.bezierCurveTo(8, -b.r - 12, 14, -b.r - 6, 10, -b.r - 18);
  ctx.strokeStyle = '#8b6914'; ctx.lineWidth = 2.5; ctx.stroke();

  // 불꽃
  const flicker = Math.sin(Date.now() * 0.03) * 2.5;
  ctx.beginPath(); ctx.arc(10, -b.r - 18 + flicker, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#ff8800'; ctx.fill();
  ctx.beginPath(); ctx.arc(10, -b.r - 18 + flicker, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#ffee00'; ctx.fill();
  ctx.beginPath(); ctx.arc(10, -b.r - 19 + flicker, 1.5, 0, Math.PI * 2);
  ctx.fillStyle = '#fff'; ctx.fill();

  ctx.restore();
}

/* ── 업데이트 ── */
function update(dt) {
  if (!gameRunning) return;
  const SPEED = 6.5;

  R.vx = 0;
  if (keys['ArrowLeft'] || keys['touchLeft']) { R.vx = -SPEED; R.facing = -1; }
  if (keys['ArrowRight'] || keys['touchRight']) { R.vx = SPEED; R.facing = 1; }
  R.x += R.vx;
  if (R.x < 0) R.x = 0;
  if (R.x + R.w > W) R.x = W - R.w
