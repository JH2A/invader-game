const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const W = canvas.width, H = canvas.height;

const keys = new Set();

addEventListener("keydown", (e) => {
  if (["ArrowLeft", "ArrowRight", " ", "Space"].includes(e.key)) e.preventDefault();
  keys.add(e.key === " " ? "Space" : e.key);
});
addEventListener("keyup", (e) => keys.delete(e.key === " " ? "Space" : e.key));

const player = { x: W / 2 - 18, y: H - 40, w: 36, h: 16, speed: 5, cooldown: 0 };
let bullets = [];
let invBullets = [];

let score = 0;
let lives = 3;
let gameOver = false;

const inv = {
  rows: 4,
  cols: 9,
  w: 26,
  h: 18,
  gapX: 10,
  gapY: 12,
  offsetX: 40,
  offsetY: 70,
  vx: 0.5,
  dir: 1,
  stepDown: 8,
  alive: [],
};

function resetInvaders() {
  inv.alive = [];
  for (let r = 0; r < inv.rows; r++) {
    for (let c = 0; c < inv.cols; c++) {
      inv.alive.push({ r, c, dead: false });
    }
  }
}
resetInvaders();

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function invaderPos(cell, baseX, baseY) {
  return {
    x: baseX + cell.c * (inv.w + inv.gapX),
    y: baseY + cell.r * (inv.h + inv.gapY),
    w: inv.w,
    h: inv.h,
  };
}

let invBaseX = inv.offsetX;
let invBaseY = inv.offsetY;

function shootPlayer() {
  if (player.cooldown > 0) return;
  bullets.push({ x: player.x + player.w / 2 - 2, y: player.y - 10, w: 4, h: 10, vy: -7 });
  player.cooldown = 12;
}

function shootInvader() {
  // 生存している侵略者からランダムに発射
  const alive = inv.alive.filter(v => !v.dead);
  if (alive.length === 0) return;

  if (Math.random() < 0.02) {
    const pick = alive[(Math.random() * alive.length) | 0];
    const p = invaderPos(pick, invBaseX, invBaseY);
    invBullets.push({ x: p.x + p.w / 2 - 2, y: p.y + p.h + 2, w: 4, h: 10, vy: 4.5 });
  }
}

function update() {
  if (gameOver) return;

  // 入力
  if (keys.has("ArrowLeft")) player.x -= player.speed;
  if (keys.has("ArrowRight")) player.x += player.speed;
  player.x = Math.max(8, Math.min(W - player.w - 8, player.x));

  if (keys.has("Space")) shootPlayer();
  if (player.cooldown > 0) player.cooldown--;

  // 弾更新
  bullets.forEach(b => b.y += b.vy);
  bullets = bullets.filter(b => b.y + b.h > 0);

  invBullets.forEach(b => b.y += b.vy);
  invBullets = invBullets.filter(b => b.y < H + 20);

  // 侵略者の移動（左右→端で下へ）
  const aliveCells = inv.alive.filter(v => !v.dead);
  if (aliveCells.length === 0) {
    // 次のウェーブ
    inv.vx *= 1.08;
    invBaseX = inv.offsetX;
    invBaseY = inv.offsetY;
    resetInvaders();
  } else {
    let minX = Infinity, maxX = -Infinity;
    for (const cell of aliveCells) {
      const p = invaderPos(cell, invBaseX, invBaseY);
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x + p.w);
    }

    invBaseX += inv.vx * inv.dir;

    if (minX <= 8 || maxX >= W - 8) {
      inv.dir *= -1;
      invBaseY += inv.stepDown;
    }
  }

  // 侵略者の射撃
  shootInvader();

  // 当たり判定：自弾→侵略者
  for (const b of bullets) {
    for (const cell of inv.alive) {
      if (cell.dead) continue;
      const p = invaderPos(cell, invBaseX, invBaseY);
      if (rectsOverlap(b, p)) {
        cell.dead = true;
        b.hit = true;
        score += 10;
        break;
      }
    }
  }
  bullets = bullets.filter(b => !b.hit);

  // 当たり判定：敵弾→プレイヤー
  for (const b of invBullets) {
    if (rectsOverlap(b, player)) {
      b.hit = true;
      lives--;
      if (lives <= 0) gameOver = true;
    }
  }
  invBullets = invBullets.filter(b => !b.hit);

  // 侵略者が下まで来たら負け
  for (const cell of inv.alive) {
    if (cell.dead) continue;
    const p = invaderPos(cell, invBaseX, invBaseY);
    if (p.y + p.h >= player.y) gameOver = true;
  }
}

function draw() {
  // 背景
  ctx.clearRect(0, 0, W, H);

  // UI
  ctx.fillStyle = "#e6edf3";
  ctx.font = "14px system-ui";
  ctx.fillText(`SCORE: ${score}`, 12, 20);
  ctx.fillText(`LIVES: ${lives}`, W - 90, 20);

  // プレイヤー
  ctx.fillStyle = "#6ee7ff";
  ctx.fillRect(player.x, player.y, player.w, player.h);
  ctx.fillRect(player.x + 10, player.y - 6, player.w - 20, 6); // 砲身

  // 自弾
  ctx.fillStyle = "#fbbf24";
  bullets.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));

  // 敵弾
  ctx.fillStyle = "#fb7185";
  invBullets.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));

  // 侵略者
  ctx.fillStyle = "#a7f3d0";
  inv.alive.forEach(cell => {
    if (cell.dead) return;
    const p = invaderPos(cell, invBaseX, invBaseY);
    ctx.fillRect(p.x, p.y, p.w, p.h);
    // 目っぽいドット
    ctx.clearRect(p.x + 6, p.y + 5, 4, 4);
    ctx.clearRect(p.x + p.w - 10, p.y + 5, 4, 4);
  });

  // ゲームオーバー
  if (gameOver) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    ctx.font = "28px system-ui";
    ctx.fillText("GAME OVER", 140, 320);
    ctx.font = "14px system-ui";
    ctx.fillText("リロードで再開", 190, 350);
  }
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}
loop();
