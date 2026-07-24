// ─── canvas.js — All canvas card generation for Glacian ───────────────────────
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import {
  OWNER_ID, OWNER_TITLE, TITLES, TIER_NAMES, TITLE_FLAVOR, OWNER_FLAVOR,
  getTitle, getNext, hexColor, fmtNum, fmtDuration,
} from './utils.js';

// ─── EMOJI FONT LOADER ───────────────────────────────────────────────────────
export async function initEmojiFont() {
  try {
    const FONT_URL = 'https://github.com/googlefonts/noto-emoji/raw/main/fonts/NotoColorEmoji.ttf';
    const buf = await fetch(FONT_URL).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); });
    GlobalFonts.register(Buffer.from(buf), 'NotoEmoji');
    console.log('✅  Noto Color Emoji font loaded — emojis will render in canvas.');
  } catch (e) {
    console.warn('⚠️  Could not load emoji font:', e.message, '— using system fallback.');
    GlobalFonts.loadSystemFonts();
  }
}

// ─── FONT HELPERS ─────────────────────────────────────────────────────────────
// Always include emoji font in stacks so emoji render as color glyphs.
// Strip U+FE0F variation selector so Noto maps them to emoji codepoints correctly.
function ec(str) { return String(str ?? '').replace(/\uFE0F/g, ''); }
const F = {
  emoji:  (sz, w='normal') => `${w} ${sz}px NotoEmoji, sans-serif`,
  sans:   (sz, w='normal') => `${w} ${sz}px NotoEmoji, sans-serif`,
  mono:   (sz, w='normal') => `${w} ${sz}px NotoEmoji, monospace`,
};

// ─── AVATAR HELPERS ───────────────────────────────────────────────────────────
export async function fetchAvatarBuf(user) {
  try {
    const url = user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
    if (!url) return null;
    const ab = await fetch(url).then(r => { if (!r.ok) return null; return r.arrayBuffer(); });
    return ab ? Buffer.from(ab) : null;
  } catch { return null; }
}

async function fetchAvatar(user) {
  try {
    const buf = await fetchAvatarBuf(user);
    return buf ? await loadImage(buf) : null;
  } catch { return null; }
}

// ─── DRAWING PRIMITIVES ───────────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapLines(ctx, text, maxWidth) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// ─── ACCENT PRIMITIVES ───────────────────────────────────────────────────────
function drawAccentLine(ctx, W, y, hex, alpha = 'CC') {
  const g = ctx.createLinearGradient(0, y, W, y);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.15, hex + alpha);
  g.addColorStop(0.85, hex + alpha);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.strokeStyle = g; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
}

function drawAccentBar(ctx, H, hex1, hex2) {
  const b = ctx.createLinearGradient(0, 0, 0, H);
  b.addColorStop(0, hex1);
  b.addColorStop(0.6, hex2);
  b.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = b; ctx.fillRect(0, 0, 5, H);
}

function drawProgressBar(ctx, BX, BY, BW, BH, prog, hex1, hex2) {
  // Track
  roundRect(ctx, BX, BY, BW, BH, BH / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fill();

  // Filled portion
  if (prog > 0.005) {
    const fill = Math.max(BH, BW * Math.min(1, prog));
    const f = ctx.createLinearGradient(BX, 0, BX + fill, 0);
    f.addColorStop(0, hex1); f.addColorStop(1, hex2);
    ctx.fillStyle = f;
    ctx.shadowColor = hex1; ctx.shadowBlur = 12;
    roundRect(ctx, BX, BY, fill, BH, BH / 2); ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function drawStatPill(ctx, x, y, w, label, value, hex) {
  const h = 44;
  roundRect(ctx, x, y, w, h, 10);
  ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fill();
  ctx.strokeStyle = hex + '40'; ctx.lineWidth = 1; ctx.stroke();

  ctx.font = F.mono(9, 'bold'); ctx.fillStyle = 'rgba(255,255,255,0.30)';
  ctx.textAlign = 'left';
  ctx.fillText(label.toUpperCase(), x + 10, y + 16);

  ctx.font = F.sans(14, 'bold'); ctx.fillStyle = '#FFFFFF';
  ctx.fillText(ec(String(value)), x + 10, y + 34);
}

function drawBadge(ctx, cx, y, text, hex) {
  ctx.font = F.emoji(10, 'bold');
  const tw = ctx.measureText(ec(text)).width;
  const pw = tw + 24, ph = 24;
  roundRect(ctx, cx - pw / 2, y, pw, ph, 6);
  ctx.fillStyle = hex + '22'; ctx.fill();
  ctx.strokeStyle = hex + '55'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = hex; ctx.textAlign = 'center';
  ctx.fillText(ec(text), cx, y + 16);
}

function drawAvatar(ctx, img, cx, cy, r, glowColor) {
  ctx.save();
  // Glow ring
  ctx.shadowColor = glowColor; ctx.shadowBlur = 24;
  ctx.strokeStyle = glowColor + 'AA'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(cx, cy, r + 3, 0, Math.PI * 2); ctx.stroke();
  ctx.shadowBlur = 0;
  // Clip avatar to circle
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  if (img) {
    ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = glowColor + '44'; ctx.fill();
  }
  ctx.restore();
}

// ─── CHIBI GLACIAN ────────────────────────────────────────────────────────────
function drawChibiGlacian(ctx, x, y, s, A) {
  ctx.save(); ctx.translate(x, y);
  const G = A + '55';
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(0, 32*s, 18*s, 5*s, 0, 0, Math.PI*2); ctx.fill();
  // Body
  ctx.save(); ctx.shadowColor = A; ctx.shadowBlur = 10*s;
  ctx.fillStyle = '#112233'; roundRect(ctx, -12*s, 6*s, 24*s, 22*s, 6*s); ctx.fill(); ctx.restore();
  ctx.strokeStyle = A; ctx.lineWidth = 1.2*s; roundRect(ctx, -12*s, 6*s, 24*s, 22*s, 6*s); ctx.stroke();
  // Crystal emblem
  ctx.fillStyle = G;
  ctx.beginPath(); ctx.moveTo(0,11*s); ctx.lineTo(4*s,15*s); ctx.lineTo(0,19*s); ctx.lineTo(-4*s,15*s); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = A; ctx.lineWidth = 0.8*s; ctx.stroke();
  // Head
  ctx.save(); ctx.shadowColor = A; ctx.shadowBlur = 14*s;
  ctx.fillStyle = '#0A1A2A'; ctx.beginPath(); ctx.arc(0, -6*s, 16*s, 0, Math.PI*2); ctx.fill(); ctx.restore();
  ctx.strokeStyle = A; ctx.lineWidth = 1.5*s; ctx.beginPath(); ctx.arc(0, -6*s, 16*s, 0, Math.PI*2); ctx.stroke();
  // Ears/horns
  [-1, 1].forEach(sd => {
    ctx.fillStyle = G;
    ctx.beginPath(); ctx.moveTo(sd*14*s, -6*s); ctx.lineTo(sd*20*s, -14*s); ctx.lineTo(sd*20*s, -2*s); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = A; ctx.lineWidth = 0.8*s; ctx.stroke();
  });
  // Crown spike
  ctx.strokeStyle = A; ctx.lineWidth = 1.5*s;
  ctx.beginPath(); ctx.moveTo(0, -22*s); ctx.lineTo(0, -28*s); ctx.stroke();
  ctx.fillStyle = A;
  ctx.beginPath(); ctx.moveTo(0,-32*s); ctx.lineTo(3*s,-28*s); ctx.lineTo(-3*s,-28*s); ctx.closePath(); ctx.fill();
  // Eyes
  [-5*s, 5*s].forEach(ex => {
    ctx.fillStyle = A + '33'; ctx.beginPath(); ctx.arc(ex, -7*s, 4*s, 0, Math.PI*2); ctx.fill();
    ctx.save(); ctx.shadowColor = A; ctx.shadowBlur = 8*s;
    ctx.fillStyle = A; ctx.beginPath(); ctx.arc(ex, -7*s, 2.2*s, 0, Math.PI*2); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#FFF'; ctx.beginPath(); ctx.arc(ex+s, -8*s, 0.8*s, 0, Math.PI*2); ctx.fill();
  });
  // Smile
  ctx.strokeStyle = A; ctx.lineWidth = 1.5*s;
  ctx.beginPath(); ctx.arc(0, -3*s, 4*s, 0.2, Math.PI - 0.2); ctx.stroke();
  // Arms
  [[-1, -0.4], [1, 0.4]].forEach(([sx, rot]) => {
    ctx.save(); ctx.translate(sx*12*s, 14*s); ctx.rotate(rot);
    ctx.fillStyle = '#112233'; ctx.strokeStyle = A; ctx.lineWidth = s;
    roundRect(ctx, sx*-4*s, -3*s, 8*s, 10*s, 3*s); ctx.fill(); ctx.stroke();
    ctx.restore();
  });
  // Feet
  [-5*s, 5*s].forEach(px => {
    ctx.fillStyle = '#112233'; ctx.strokeStyle = A; ctx.lineWidth = s;
    roundRect(ctx, px - 3.5*s, 26*s, 7*s, 9*s, 3*s); ctx.fill(); ctx.stroke();
  });
  // Sparkles
  ctx.fillStyle = A + '66';
  [[-20*s,-18*s,2*s],[18*s,-20*s,1.5*s],[-22*s,5*s,1.5*s],[20*s,8*s,2*s]].forEach(([px,py,sz])=>{
    ctx.beginPath(); ctx.arc(px, py, sz, 0, Math.PI*2); ctx.fill();
  });
  ctx.restore();
}

// ─── BACKGROUND THEMES ───────────────────────────────────────────────────────
function drawTier1Bg(ctx, W, H) {
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#050D1A'); bg.addColorStop(0.5, '#091525'); bg.addColorStop(1, '#0B1E38');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // Diagonal lines
  ctx.strokeStyle = 'rgba(79,195,247,0.04)'; ctx.lineWidth = 1;
  for (let i = -H; i < W + H; i += 38) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + H, H); ctx.stroke();
  }
  // Subtle orbs
  ctx.fillStyle = 'rgba(79,195,247,0.05)';
  [[60,40],[200,20],[350,55],[500,15],[680,40],[840,20],[100,190],[400,170],[700,200]].forEach(([px,py])=>{
    ctx.beginPath(); ctx.arc(px, py, 18, 0, Math.PI*2); ctx.fill();
  });
}

function drawTier2Bg(ctx, W, H) {
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#001020'); bg.addColorStop(0.5, '#002233'); bg.addColorStop(1, '#001828');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const hS = 32; ctx.strokeStyle = 'rgba(0,229,255,0.06)'; ctx.lineWidth = 1;
  for (let row = 0; row < 8; row++) for (let col = 0; col < 20; col++) {
    const hx = col*hS*1.73 + (row%2)*hS*0.87, hy = row*hS*1.5;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI/3)*i - Math.PI/6;
      i === 0 ? ctx.moveTo(hx+hS*0.6*Math.cos(a), hy+hS*0.6*Math.sin(a))
              : ctx.lineTo(hx+hS*0.6*Math.cos(a), hy+hS*0.6*Math.sin(a));
    }
    ctx.closePath(); ctx.stroke();
  }
}

function drawTier3Bg(ctx, W, H) {
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#080010'); bg.addColorStop(0.5, '#110020'); bg.addColorStop(1, '#060010');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W*0.6, H*0.4, 10, W*0.6, H*0.4, 220);
  g.addColorStop(0, 'rgba(156,39,176,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(200,150,255,0.5)';
  [[80,30,2],[200,80,1.5],[400,20,2],[550,60,1],[720,40,2],[870,25,1.5],[150,220,1],[350,180,2],[600,200,1.5]].forEach(([px,py,sz])=>{
    ctx.beginPath(); ctx.arc(px, py, sz, 0, Math.PI*2); ctx.fill();
  });
}

function drawTier4Bg(ctx, W, H) {
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#050010'); bg.addColorStop(0.5, '#0A0025'); bg.addColorStop(1, '#050018');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(121,134,203,0.08)'; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  [[0,0],[W,0],[0,H],[W,H]].forEach(([cx,cy]) => {
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 180);
    cg.addColorStop(0, 'rgba(63,81,181,0.15)'); cg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = cg; ctx.fillRect(0, 0, W, H);
  });
}

function drawTier5Bg(ctx, W, H) {
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0D0800'); bg.addColorStop(0.4, '#1A1100'); bg.addColorStop(1, '#0D0800');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,215,0,0.04)'; ctx.lineWidth = 2;
  for (let i = -H; i < W + H; i += 30) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + H, H); ctx.stroke();
  }
  const cg = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, 300);
  cg.addColorStop(0, 'rgba(255,200,0,0.10)'); cg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = cg; ctx.fillRect(0, 0, W, H);
}

function drawOwnerBg(ctx, W, H) {
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#060010'); bg.addColorStop(0.5, '#0A0020'); bg.addColorStop(1, '#040010');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const hS = 28; ctx.strokeStyle = 'rgba(106,13,173,0.18)'; ctx.lineWidth = 1;
  for (let row = 0; row < 10; row++) for (let col = 0; col < 24; col++) {
    const hx = col*hS*1.73 + (row%2)*hS*0.87 - 20, hy = row*hS*1.5 - 20;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI/3)*i - Math.PI/6;
      i === 0 ? ctx.moveTo(hx+hS*0.55*Math.cos(a), hy+hS*0.55*Math.sin(a))
              : ctx.lineTo(hx+hS*0.55*Math.cos(a), hy+hS*0.55*Math.sin(a));
    }
    ctx.closePath(); ctx.stroke();
  }
  const pg = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, 280);
  pg.addColorStop(0, 'rgba(106,13,173,0.18)');
  pg.addColorStop(0.5, 'rgba(13,27,92,0.10)');
  pg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = pg; ctx.fillRect(0, 0, W, H);
  // Corner brackets
  ctx.strokeStyle = 'rgba(138,43,226,0.35)'; ctx.lineWidth = 1.5;
  [[0,0,30,0,0,30],[W,0,W-30,0,W,30],[0,H,0,H-30,30,H],[W,H,W-30,H,W,H-30]].forEach(([x1,y1,x2,y2,x3,y3]) => {
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.moveTo(x1,y1); ctx.lineTo(x3,y3); ctx.stroke();
  });
  ctx.strokeStyle = 'rgba(106,13,173,0.25)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0,8); ctx.lineTo(W,8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,H-8); ctx.lineTo(W,H-8); ctx.stroke();
}

function drawBg(ctx, W, H, title) {
  if (title.isOwner)    return drawOwnerBg(ctx, W, H);
  if (title.tier === 1) return drawTier1Bg(ctx, W, H);
  if (title.tier === 2) return drawTier2Bg(ctx, W, H);
  if (title.tier === 3) return drawTier3Bg(ctx, W, H);
  if (title.tier === 4) return drawTier4Bg(ctx, W, H);
  if (title.tier === 5) return drawTier5Bg(ctx, W, H);
  return drawTier1Bg(ctx, W, H);
}

// ─── WATERMARK ────────────────────────────────────────────────────────────────
function drawWatermark(ctx, x, y, isOwner, align = 'right') {
  ctx.font = F.emoji(10, 'bold');
  ctx.fillStyle = isOwner ? 'rgba(170,68,255,0.22)' : 'rgba(79,195,247,0.22)';
  ctx.textAlign = align;
  ctx.fillText(ec(isOwner ? '\u25C8 GLACIAN' : '\u2744\uFE0F GLACIAN'), x, y);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CARD 1  —  SNOW CARD (snow points, rank, progress)
// ═══════════════════════════════════════════════════════════════════════════════
export async function generateSnowCard(user, sd) {
  const W = 940, H = 340;
  const canvas = createCanvas(W, H); const ctx = canvas.getContext('2d');
  const isOwner = user.id === OWNER_ID;
  const title = getTitle(sd.points, user.id);
  const next  = getNext(sd.points, user.id);
  const hex   = isOwner ? hexColor(OWNER_TITLE.color) : hexColor(title.color);
  const nHex  = next ? hexColor(next.color) : hex;

  drawBg(ctx, W, H, title);

  // Ambient radial center glow
  const rg = ctx.createRadialGradient(130, H/2, 0, 130, H/2, 180);
  rg.addColorStop(0, hex + '14'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);

  drawAccentLine(ctx, W, 0, hex, 'CC');
  drawAccentLine(ctx, W, H - 2, hex, '77');
  drawAccentBar(ctx, H, hex, nHex + '44');

  // ── Avatar ───────────────────────────────────────────────────────────────
  const img = await fetchAvatar(user);
  drawAvatar(ctx, img, 78, H / 2, 60, hex);

  // Tier badge (above avatar)
  drawBadge(ctx, 78, 12, isOwner ? '\u25C8  ABSOLUTE AUTHORITY  \u25C8' : `TIER ${title.tier}  \u00B7  ${(TIER_NAMES[title.tier] ?? '').toUpperCase()}`, hex);

  // ── Right column ─────────────────────────────────────────────────────────
  const RX = 158;

  // Username
  ctx.font = F.sans(27, 'bold'); ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 8;
  ctx.textAlign = 'left';
  ctx.fillText(ec(String(user.username).slice(0, 22)), RX, 68); ctx.shadowBlur = 0;

  // Rank badge inline
  if (!isOwner) {
    const rankLabel = `RANK  #${title.rank} / 50`;
    ctx.font = F.mono(9, 'bold'); ctx.fillStyle = hex + 'BB';
    ctx.fillText(rankLabel, RX, 84);
  }

  // Title name
  ctx.font = F.emoji(15, 'bold'); ctx.fillStyle = hex;
  ctx.shadowColor = hex; ctx.shadowBlur = isOwner ? 18 : 10;
  ctx.fillText(ec(title.name), RX, 106); ctx.shadowBlur = 0;

  // Subtle divider
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(RX, 115); ctx.lineTo(W - 24, 115); ctx.stroke();

  // ── Stat pills row ───────────────────────────────────────────────────────
  const pY = 124, pGap = 8;
  const pW = Math.floor((W - RX - 24 - pGap * 2) / 3);
  drawStatPill(ctx, RX,                   pY, pW, 'Snow Points',   fmtNum(sd.points),          hex);
  drawStatPill(ctx, RX + pW + pGap,       pY, pW, 'Sessions',      fmtNum(sd.sessions),        hex);
  drawStatPill(ctx, RX + pW*2 + pGap*2,   pY, pW, 'Total AFK',     fmtDuration(sd.total_seconds), hex);

  // ── Progress bar ─────────────────────────────────────────────────────────
  const BX = RX, BY = 184, BW = W - BX - 24, BH = 13;
  const prog = isOwner ? 1 : next ? Math.min(1, (sd.points - title.min) / Math.max(1, next.min - title.min)) : 1;

  ctx.font = F.mono(9, 'bold'); ctx.fillStyle = 'rgba(255,255,255,0.40)'; ctx.textAlign = 'left';
  ctx.fillText('RANK PROGRESS', BX, BY - 7);
  ctx.textAlign = 'right'; ctx.fillStyle = hex + 'CC';
  ctx.fillText(isOwner ? '100%' : `${Math.round(prog * 100)}%`, BX + BW, BY - 7);

  drawProgressBar(ctx, BX, BY, BW, BH, prog, hex, nHex);

  ctx.font = F.emoji(10); ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.textAlign = 'left';
  ctx.fillText(ec(title.name), BX, BY + BH + 14);
  ctx.textAlign = 'right';
  ctx.fillText(
    isOwner ? '\u25C8  Absolute Rank  \u25C8' : next ? `${ec(next.name)}  (${fmtNum(next.min - sd.points)} pts)` : '\u{1F451} Max Rank',
    BX + BW, BY + BH + 14,
  );

  // ── Chibi + watermark (bottom-right, below progress labels) ──────────────
  drawChibiGlacian(ctx, W - 52, H - 52, 0.62, hex);
  drawWatermark(ctx, W - 84, H - 10, isOwner);

  return canvas.toBuffer('image/png');
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CARD 2  —  AFK SET CARD (centered design)
// ═══════════════════════════════════════════════════════════════════════════════
export async function generateAfkCard(user, reason, sd, isGlobal = false) {
  const W = 940, H = 420;
  const canvas = createCanvas(W, H); const ctx = canvas.getContext('2d');
  const isOwner = user.id === OWNER_ID;
  const title = getTitle(sd.points, user.id);
  const hex   = isOwner ? hexColor(OWNER_TITLE.color) : hexColor(title.color);
  const next  = getNext(sd.points, user.id);
  const nHex  = next ? hexColor(next.color) : hex;
  const CX    = W / 2;

  drawBg(ctx, W, H, title);

  // Center radial glow
  const rg = ctx.createRadialGradient(CX, H*0.38, 0, CX, H*0.38, 260);
  rg.addColorStop(0, hex + '18'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);

  drawAccentLine(ctx, W, 0, hex, 'CC');
  drawAccentLine(ctx, W, H - 2, hex, '77');

  // Top badge
  const badgeTxt = isGlobal
    ? (isOwner ? '\u25C8  MONARCH AFK — ALL REALMS  \u25C8' : '\u2744\uFE0F  GLOBAL AFK ACTIVATED  \u2744\uFE0F')
    : (isOwner ? '\u25C8  MONARCH HAS GONE SILENT  \u25C8' : '\u2744\uFE0F  AFK ACTIVATED  \u2744\uFE0F');
  drawBadge(ctx, CX, 12, badgeTxt, hex);

  // Global scope pill
  if (isGlobal) {
    ctx.font = F.mono(8, 'bold'); ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillText('ALL SERVERS', CX, 50);
  }

  // Avatar
  const img = await fetchAvatar(user);
  drawAvatar(ctx, img, CX, isGlobal ? 115 : 105, 58, hex);

  const nameY = isGlobal ? 200 : 190;

  // Username
  ctx.font = F.sans(26, 'bold'); ctx.fillStyle = '#FFF'; ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 6;
  ctx.fillText(ec(String(user.username).slice(0, 24)), CX, nameY); ctx.shadowBlur = 0;

  // Title name
  ctx.font = F.emoji(14, 'bold'); ctx.fillStyle = hex;
  ctx.shadowColor = hex; ctx.shadowBlur = 10;
  ctx.fillText(ec(title.name), CX, nameY + 22); ctx.shadowBlur = 0;

  if (!isOwner) {
    ctx.font = F.mono(9); ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillText(`Tier ${title.tier}  \u00B7  Rank #${title.rank}/50`, CX, nameY + 38);
  }

  // Divider
  const divY = nameY + (isOwner ? 28 : 48);
  ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(CX - 220, divY); ctx.lineTo(CX + 220, divY); ctx.stroke();

  // Reason label + text
  const rLabelY = divY + 18;
  ctx.font = F.mono(9, 'bold'); ctx.fillStyle = 'rgba(255,255,255,0.32)'; ctx.textAlign = 'center';
  ctx.fillText('REASON', CX, rLabelY);

  const clean = String(reason).length > 400 ? String(reason).slice(0, 397) + '...' : String(reason);
  ctx.font = F.sans(17, 'bold'); ctx.fillStyle = '#FFF';
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 4;
  const lines = wrapLines(ctx, clean, 680);
  let lineY = rLabelY + 22;
  for (let i = 0; i < Math.min(lines.length, 3); i++) {
    let txt = lines[i]; if (i === 2 && lines.length > 3) txt += '...';
    ctx.fillText(txt, CX, lineY); lineY += 24;
  }
  ctx.shadowBlur = 0;

  // Stat pills
  const sY = Math.max(lineY + 12, H - 88);
  const pW = 200, pGap = 8, pTotal = pW * 3 + pGap * 2;
  const pX = CX - pTotal / 2;
  drawStatPill(ctx, pX,             sY, pW, 'Snow Points',    fmtNum(sd.points),             hex);
  drawStatPill(ctx, pX + pW + pGap, sY, pW, 'Session',        `#${fmtNum(sd.sessions + 1)}`,  hex);
  drawStatPill(ctx, pX+pW*2+pGap*2, sY, pW, 'Total AFK Time', fmtDuration(sd.total_seconds),  hex);

  // Chibi bottom-right
  drawChibiGlacian(ctx, W - 52, H - 52, 0.70, hex);
  drawWatermark(ctx, CX, H - 8, isOwner, 'center');

  return canvas.toBuffer('image/png');
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CARD 3  —  TITLE REVEAL CARD (/snow or /titles)
// ═══════════════════════════════════════════════════════════════════════════════
export async function generateTitleRevealCard(user, sd) {
  const W = 940, H = 460;
  const canvas = createCanvas(W, H); const ctx = canvas.getContext('2d');
  const isOwner = user.id === OWNER_ID;
  const title = getTitle(sd.points, user.id);
  const next  = getNext(sd.points, user.id);
  const hex   = isOwner ? hexColor(OWNER_TITLE.color) : hexColor(title.color);
  const nHex  = next ? hexColor(next.color) : hex;
  const CX    = W / 2;

  drawBg(ctx, W, H, title);

  const cG = ctx.createRadialGradient(CX, H/2, 20, CX, H/2, 320);
  cG.addColorStop(0, hex + '1A'); cG.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = cG; ctx.fillRect(0, 0, W, H);

  drawAccentLine(ctx, W, 0, hex, 'BB');
  drawAccentLine(ctx, W, H - 2, hex, '66');

  // Avatar + chibi side by side
  const img = await fetchAvatar(user);
  drawAvatar(ctx, img, CX - 40, 90, 62, hex);
  drawChibiGlacian(ctx, CX + 100, 86, 0.80, hex);

  if (isOwner) {
    // Owner reveal
    ctx.font = F.mono(10, 'bold'); ctx.fillStyle = 'rgba(138,43,226,0.65)'; ctx.textAlign = 'center';
    ctx.fillText('[ SYSTEM  \u00B7  STATUS NOTIFICATION ]', CX, 178);

    ctx.font = F.emoji(34, 'bold'); ctx.fillStyle = '#CC66FF';
    ctx.shadowColor = '#8800CC'; ctx.shadowBlur = 30;
    ctx.fillText(ec('\u{1F451}  MONARCH OF SHADOWS'), CX, 228); ctx.shadowBlur = 0;

    ctx.font = F.sans(13, 'bold'); ctx.fillStyle = 'rgba(100,120,255,0.80)';
    ctx.fillText(ec('HAS EMERGED FROM THE ETERNAL ABYSS'), CX, 254);

    ctx.strokeStyle = 'rgba(106,13,173,0.4)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(160, 270); ctx.lineTo(W-160, 270); ctx.stroke();

    ctx.fillStyle = 'rgba(170,68,255,0.08)';
    roundRect(ctx, CX-240, 278, 480, 36, 8); ctx.fill();
    ctx.font = F.mono(11); ctx.fillStyle = 'rgba(170,100,255,0.60)'; ctx.textAlign = 'center';
    ctx.fillText(ec(`\u25C8  Absolute Authority  \u00B7  ${fmtNum(sd.points)} snow pts  \u00B7  Sessions: ${fmtNum(sd.sessions)}`), CX, 302);

    ctx.font = F.mono(10, 'bold'); ctx.fillStyle = 'rgba(106,13,173,0.35)';
    ctx.fillText('[ END OF NOTIFICATION ]', CX, 340);
    drawWatermark(ctx, CX, H - 12, true, 'center');
    return canvas.toBuffer('image/png');
  }

  // Normal title reveal
  const tierPill = `TIER ${title.tier}  \u00B7  ${(TIER_NAMES[title.tier] ?? '').toUpperCase()}`;
  ctx.font = F.mono(10, 'bold'); ctx.fillStyle = hex + 'CC'; ctx.textAlign = 'center';
  ctx.fillText(tierPill, CX, 182);

  const fs = String(title.name).length > 22 ? 30 : 38;
  ctx.font = F.emoji(fs, 'bold'); ctx.fillStyle = hex;
  ctx.shadowColor = hex; ctx.shadowBlur = 24;
  ctx.fillText(ec(title.name), CX, 226); ctx.shadowBlur = 0;

  drawBadge(ctx, CX, 236, `RANK  #${title.rank}  /  50`, hex);

  ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(120, 280); ctx.lineTo(W-120, 280); ctx.stroke();

  const flavor = TITLE_FLAVOR[title.rank] ?? '';
  ctx.font = `italic ${F.sans(13)}`; ctx.fillStyle = hex + 'BB'; ctx.textAlign = 'center';
  ctx.fillText(`"${flavor}"`, CX, 300);

  // Progress bar
  const BX = 120, BW = W - 240, BH = 13, BY = 326;
  const prog = next ? Math.min(1, (sd.points - title.min) / Math.max(1, next.min - title.min)) : 1;

  ctx.font = F.mono(9, 'bold'); ctx.fillStyle = 'rgba(255,255,255,0.40)'; ctx.textAlign = 'left';
  ctx.fillText('PROGRESS', BX, BY - 6);
  ctx.textAlign = 'right'; ctx.fillStyle = hex + 'AA';
  ctx.fillText(`${Math.round(prog * 100)}%`, BX + BW, BY - 6);
  drawProgressBar(ctx, BX, BY, BW, BH, prog, hex, nHex);

  ctx.font = F.emoji(10); ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.textAlign = 'left';
  ctx.fillText(ec(title.name), BX, BY + BH + 14);
  ctx.textAlign = 'right';
  ctx.fillText(next ? `${ec(next.name)}  (${fmtNum(next.min - sd.points)} pts)` : '\u{1F451} Max Rank', BX + BW, BY + BH + 14);

  // Stats strip
  const sY = BY + BH + 36;
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  roundRect(ctx, BX, sY, BW, 32, 6); ctx.fill();
  ctx.strokeStyle = hex + '22'; ctx.lineWidth = 1; ctx.stroke();
  ctx.font = F.emoji(11); ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.textAlign = 'center';
  ctx.fillText(ec(`\u2744\uFE0F  ${fmtNum(sd.points)} snow pts  \u00B7  Sessions: ${fmtNum(sd.sessions)}  \u00B7  Time: ${fmtDuration(sd.total_seconds)}`), CX, sY + 21);

  drawWatermark(ctx, CX, H - 10, false, 'center');
  return canvas.toBuffer('image/png');
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CARD 4  —  RETURN / WELCOME BACK CARD
// ═══════════════════════════════════════════════════════════════════════════════
export async function generateReturnCard(user, durationSec, mentions, sd) {
  const W = 940, H = 380;
  const canvas = createCanvas(W, H); const ctx = canvas.getContext('2d');
  const isOwner = user.id === OWNER_ID;
  const title = getTitle(sd.points, user.id);
  const hex   = isOwner ? hexColor(OWNER_TITLE.color) : hexColor(title.color);
  const next  = getNext(sd.points, user.id);
  const nHex  = next ? hexColor(next.color) : hex;

  drawBg(ctx, W, H, title);

  const rg = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, 260);
  rg.addColorStop(0, hex + '14'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);

  drawAccentLine(ctx, W, 0, hex, 'CC');
  drawAccentLine(ctx, W, H - 2, hex, '88');
  drawAccentBar(ctx, H, hex, hex + '44');

  // Badge
  const headerText = isOwner ? '\u25C8  MONARCH RETURNS  \u25C8' : '\u{1F31F}  WELCOME BACK  \u{1F31F}';
  drawBadge(ctx, W / 2, 12, headerText, hex);

  // Avatar (left)
  const img = await fetchAvatar(user);
  drawAvatar(ctx, img, 90, H/2 - 10, 62, hex);

  // Username + title (right of avatar)
  const TX = 175;
  ctx.font = F.sans(28, 'bold'); ctx.fillStyle = '#FFF'; ctx.textAlign = 'left';
  ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 8;
  ctx.fillText(ec(String(user.username).slice(0, 22)), TX, 108); ctx.shadowBlur = 0;

  ctx.font = F.emoji(15, 'bold'); ctx.fillStyle = hex;
  ctx.shadowColor = hex; ctx.shadowBlur = 14;
  ctx.fillText(ec(title.name), TX, 130); ctx.shadowBlur = 0;

  if (!isOwner) {
    ctx.font = F.mono(9); ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillText(`Tier ${title.tier}  \u00B7  Rank #${title.rank}/50`, TX, 148);
  }

  // Divider
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(TX, 162); ctx.lineTo(W - 24, 162); ctx.stroke();

  // Stat pills — 4 columns
  const pillY = 172, pGap = 8;
  const pillW = Math.floor((W - TX - 24 - pGap * 3) / 4);
  drawStatPill(ctx, TX,                        pillY, pillW, 'AFK Time',      fmtDuration(durationSec),  hex);
  drawStatPill(ctx, TX + pillW + pGap,          pillY, pillW, 'Mentions',      String(mentions),           hex);
  drawStatPill(ctx, TX + pillW*2 + pGap*2,      pillY, pillW, 'Snow Earned',   '+' + fmtNum(durationSec), hex);
  drawStatPill(ctx, TX + pillW*3 + pGap*3,      pillY, pillW, 'Total Points',  fmtNum(sd.points),          hex);

  // Flavor text
  const flavor = isOwner ? OWNER_FLAVOR : (TITLE_FLAVOR[title.rank] ?? '');
  if (flavor) {
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(TX, 234); ctx.lineTo(W-24, 234); ctx.stroke();
    ctx.font = `italic ${F.sans(13)}`; ctx.fillStyle = hex + 'AA'; ctx.textAlign = 'left';
    ctx.fillText(`"${flavor}"`, TX, 254);
  }

  // Progress bar
  const BX = TX, BY = 274, BW = W - BX - 24, BH = 12;
  const prog = isOwner ? 1 : next ? Math.min(1, (sd.points - title.min) / Math.max(1, next.min - title.min)) : 1;

  ctx.font = F.mono(9, 'bold'); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.textAlign = 'left';
  ctx.fillText('RANK PROGRESS', BX, BY - 5);
  ctx.textAlign = 'right'; ctx.fillStyle = hex + '99';
  ctx.fillText(`${Math.round(prog * 100)}%`, BX + BW, BY - 5);
  drawProgressBar(ctx, BX, BY, BW, BH, prog, hex, nHex);

  ctx.font = F.emoji(10); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.textAlign = 'left';
  ctx.fillText(ec(title.name), BX, BY + BH + 13);
  ctx.textAlign = 'right';
  ctx.fillText(next ? `${ec(next.name)} (${fmtNum(next.min - sd.points)} pts)` : '\u{1F451} Max Rank', BX + BW, BY + BH + 13);

  drawChibiGlacian(ctx, W - 52, H - 55, 0.68, hex);
  drawWatermark(ctx, W/2, H - 8, isOwner, 'center');
  return canvas.toBuffer('image/png');
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CARD 5  —  MENTION CARD (compact — someone pinged an AFK user)
// ═══════════════════════════════════════════════════════════════════════════════
export async function generateMentionCard(afkUser, reason, afkSince, elapsed, mentionCount) {
  const W = 820, H = 230;
  const canvas = createCanvas(W, H); const ctx = canvas.getContext('2d');

  // Deep violet background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#060012'); bg.addColorStop(1, '#0A001E');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // Hex grid overlay
  const hS = 22; ctx.strokeStyle = 'rgba(106,13,173,0.12)'; ctx.lineWidth = 1;
  for (let row = 0; row < 6; row++) for (let col = 0; col < 18; col++) {
    const hx = col*hS*1.73 + (row%2)*hS*0.87, hy = row*hS*1.5;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI/3)*i - Math.PI/6;
      i === 0 ? ctx.moveTo(hx+hS*0.5*Math.cos(a), hy+hS*0.5*Math.sin(a))
              : ctx.lineTo(hx+hS*0.5*Math.cos(a), hy+hS*0.5*Math.sin(a));
    }
    ctx.closePath(); ctx.stroke();
  }

  // Left gradient bar
  const barG = ctx.createLinearGradient(0, 0, 0, H);
  barG.addColorStop(0, '#8B3DFF'); barG.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = barG; ctx.fillRect(0, 0, 4, H);

  drawAccentLine(ctx, W, 0, '#8B3DFF', 'BB');
  drawAccentLine(ctx, W, H - 2, '#6A0DAD', '55');

  // Badge
  drawBadge(ctx, W / 2, 12, ec('\u{1F328}\uFE0F  AFK  \u2014  DO NOT DISTURB  \u{1F328}\uFE0F'), '#8B3DFF');

  // Avatar
  const img = await fetchAvatar(afkUser);
  drawAvatar(ctx, img, 72, H/2 + 8, 50, '#8B3DFF');

  // Username
  ctx.font = F.sans(21, 'bold'); ctx.fillStyle = '#FFF'; ctx.textAlign = 'left';
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 6;
  ctx.fillText(ec(String(afkUser.username).slice(0, 22)), 142, 88); ctx.shadowBlur = 0;

  // Reason
  ctx.font = F.sans(13); ctx.fillStyle = 'rgba(255,255,255,0.50)';
  const reasonClean = String(reason).length > 80 ? String(reason).slice(0, 77) + '...' : String(reason);
  ctx.fillText(reasonClean, 142, 110);

  // Divider
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(142, 120); ctx.lineTo(W - 20, 120); ctx.stroke();

  // Info pills — compact
  const pills = [
    ['Away For',  fmtDuration(elapsed)],
    ['Since',     new Date(afkSince).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })],
    ['Mentions',  String(mentionCount)],
  ];
  const pW = 148, pGap = 8;
  let px = 142;
  for (const [label, val] of pills) {
    roundRect(ctx, px, 128, pW, 42, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fill();
    ctx.strokeStyle = '#8B3DFF33'; ctx.lineWidth = 1; ctx.stroke();
    ctx.font = F.mono(8, 'bold'); ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.textAlign = 'left';
    ctx.fillText(label.toUpperCase(), px + 8, 128 + 14);
    ctx.font = F.sans(13, 'bold'); ctx.fillStyle = '#CBA6FF';
    ctx.fillText(ec(val), px + 8, 128 + 32);
    px += pW + pGap;
  }

  drawWatermark(ctx, W - 14, H - 10, false, 'right');
  return canvas.toBuffer('image/png');
}
