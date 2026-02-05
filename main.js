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

// ====== 変更点：スコアをCO2削減量(kg)に ======
let co2Kg = 0;       // スコア＝CO2削減量(kg)
let lives = 3;
let gameOver = false;
let cleared = false; // クリアしたか
let gameOverReason = ""; // "warming" | "clear" | "lives"

// ====== 侵略者設定 ======
const inv = {
  rows: 4,
  cols: 9,
  w: 26,
  h: 18,
  gapX: 10,
  gapY: 12,
  offsetX: 40,
  offsetY: 70,
  vx: 0.5,      // 横移動スピード
  dir: 1,
  stepDown: 8,  // 端で降りる量
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
  const alive = inv.alive.filter(v => !v.dead);
  if (alive.length === 0) return;

  if (Math.random() < 0.02) {
    const pick = alive[(Math.random() * alive.length) | 0];
    const p = invaderPos(pick, invBaseX, invBaseY);
    invBullets.push({ x: p.x + p.w / 2 - 2, y: p.y + p.h + 2, w: 4, h: 10, vy: 4.5 });
  }
}

function endGame(reason) {
  gameOver = true;
  gameOverReason = reason;
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

  // ====== 侵略者の移動（はみ出し補正＋降下は1回だけ） ======
  const aliveCells = inv.alive.filter(v => !v.dead);

  // 全滅＝クリア（次ウェーブにせず終了）
  if (aliveCells.length === 0) {
    cleared = true;
    endGame("clear");
    return;
  }

  const nextX = invBaseX + inv.vx * inv.dir;

  let nextMinX = Infinity, nextMaxX = -Infinity;
  for (const cell of aliveCells) {
    const p = invaderPos(cell, nextX, invBaseY);
    nextMinX = Math.min(nextMinX, p.x);
    nextMaxX = Math.max(nextMaxX, p.x + p.w);
  }

  const leftWall = 8;
  const rightWall = W - 8;

  // はみ出し補正（必ず画面内へ戻す）
  let correction = 0;
  if (nextMinX < leftWall) correction = leftWall - nextMinX;
  if (nextMaxX > rightWall) correction = rightWall - nextMaxX;

  if (correction !== 0) {
    invBaseX = nextX + correction; // 押し戻す
    inv.dir *= -1;                // 反転
    invBaseY += inv.stepDown;     // 1回だけ降下
  } else {
    invBaseX = nextX;
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

        // ====== 変更点：倒したらCO2削減量(kg)を増やす ======
        co2Kg += 50; // 1体=50kg（好きに変えてOK）

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
      if (lives <= 0) endGame("lives");
    }
  }
  invBullets = invBullets.filter(b => !b.hit);

  // 侵略者が下まで来たら負け（温暖化）
  for (const cell of inv.alive) {
    if (cell.dead) continue;
    const p = invaderPos(cell, invBaseX, invBaseY);
    if (p.y + p.h >= player.y) {
      endGame("warming");
      break;
    }
  }
}

function draw() {
  // 背景
  ctx.clearRect(0, 0, W, H);

  // UI
  ctx.fillStyle = "#e6edf3";
  ctx.font = "14px system-ui";
  ctx.fillText(`CO₂削減: ${co2Kg} kg`, 12, 20);
  ctx.fillText(`LIVES: ${lives}`, W - 90, 20);

  // プレイヤー
  ctx.fillStyle = "#6ee7ff";
  ctx.fillRect(player.x, player.y, player.w, player.h);
  ctx.fillRect(player.x + 10, player.y - 6, player.w - 20, 6);

  // 自弾
  ctx.fillStyle = "#fbbf24";
  bullets.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));

  // 敵弾
  ctx.fillStyle = "#fb7185";
  invBullets.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));

  // 侵略者（見た目はそのまま）
  ctx.fillStyle = "#a7f3d0";
  inv.alive.forEach(cell => {
    if (cell.dead) return;
    const p = invaderPos(cell, invBaseX, invBaseY);
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.clearRect(p.x + 6, p.y + 5, 4, 4);
    ctx.clearRect(p.x + p.w - 10, p.y + 5, 4, 4);
  });

  // 終了表示（温暖化 / クリア / ライフ切れ）
  if (gameOver) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#fff";

    if (gameOverReason === "clear") {
      ctx.font = "22px system-ui";
      ctx.fillText("おめでとう！", 170, 285);

      ctx.font = "14px system-ui";
      ctx.fillText("景品応募キーワードは", 155, 320);

      ctx.font = "20px system-ui";
      ctx.fillText("“サクラサク”", 165, 350);

      ctx.font = "14px system-ui";
      ctx.fillText(`CO₂削減: ${co2Kg} kg`, 170, 385);
      ctx.fillText("リロードで再挑戦", 175, 415);
    } else if (gameOverReason === "warming") {
      ctx.font = "22px system-ui";
      ctx.fillText("地球温暖化 GAME OVER", 110, 320);

      ctx.font = "14px system-ui";
      ctx.fillText(`CO₂削減: ${co2Kg} kg`, 180, 350);
      ctx.fillText("リロードで再挑戦", 175, 380);
    } else {
      ctx.font = "22px system-ui";
      ctx.fillText("GAME OVER", 160, 320);

      ctx.font = "14px system-ui";
      ctx.fillText(`CO₂削減: ${co2Kg} kg`, 180, 350);
      ctx.fillText("リロードで再挑戦", 175, 380);
    }
  }
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}
loop();
