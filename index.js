// ═══════════════════════════════════════════════════════════════════════════
//   ██████╗ ██╗      █████╗  ██████╗██╗ █████╗ ███╗   ██╗  ❄️
//  ██╔════╝ ██║     ██╔══██╗██╔════╝██║██╔══██╗████╗  ██║
//  ██║  ███╗██║     ███████║██║     ██║███████║██╔██╗ ██║
//  ██║   ██║██║     ██╔══██║██║     ██║██╔══██║██║╚██╗██║
//  ╚██████╔╝███████╗██║  ██║╚██████╗██║██║  ██║██║ ╚████║
//   ╚═════╝ ╚══════╝╚═╝  ╚═╝ ╚═════╝╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝
//
//  Glacian — The ultimate AFK bot, forged in eternal winter ❄️
//  Prefix: gn  |  Slash: /  |  Commands: afk · snow · titles · lang
// ═══════════════════════════════════════════════════════════════════════════

import {
  Client, GatewayIntentBits, Partials, REST, Routes,
  SlashCommandBuilder, Events, ActivityType,
} from 'discord.js';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import OpenAI from 'openai';
import { DB, initDB, snowGet } from './db.js';
import { t, VALID_LANGS } from './i18n.js';
import {
  initAntiReaction, handleReactionAdd, handleAntiReactionInteraction,
  handleAntiReactionCommand, buildAntiReactionSlash,
} from './antireaction.js';
import { startWebServer } from './web.js';

// ─── EMOJI FONT — download Noto Color Emoji so emojis render on Linux ─────────
async function initEmojiFont() {
  try {
    const FONT_URL = 'https://github.com/googlefonts/noto-emoji/raw/main/fonts/NotoColorEmoji.ttf';
    const resp = await fetch(FONT_URL, { signal: AbortSignal.timeout(30_000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    GlobalFonts.register(buf, 'NotoColorEmoji');
    console.log('✅  Noto Color Emoji font loaded — emojis will render in canvas.');
  } catch (e) {
    console.warn('⚠️  Could not load emoji font:', e.message, '— canvas will use fallback glyphs.');
    GlobalFonts.loadSystemFonts();
  }
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const PREFIX        = 'gn';
const OWNER_ID      = '1064678074010058752';
const BEST_FRIEND   = '1490187375626948730';
const IS_CV2        = 1 << 15;
const EPHEMERAL     = 1 << 6;
const BOT_INVITE    = 'https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=277025459200&scope=bot+applications.commands';

// ─── AI SETUP (Groq multi-model rotation) ────────────────────────────────────
const AI_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-70b-versatile',
  'mixtral-8x7b-32768',
  'gemma2-9b-it',
  'llama-3.1-8b-instant',
];
let _aiIdx = 0;
const nextModel = () => AI_MODELS[(_aiIdx++) % AI_MODELS.length];

const ai = process.env.GROQ_API_KEY
  ? new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' })
  : null;

async function aiCall(messages, { maxTokens = 200, temperature = 1.0, ms = 4000 } = {}) {
  if (!ai) return null;
  for (let i = 0; i < AI_MODELS.length; i++) {
    const model = nextModel();
    try {
      const r = await Promise.race([
        ai.chat.completions.create({ model, messages, max_tokens: maxTokens, temperature }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
      ]);
      return r.choices[0]?.message?.content?.trim() ?? null;
    } catch { /* try next */ }
  }
  return null;
}

// ─── REST CLIENT ──────────────────────────────────────────────────────────────
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// ─── TITLE FLAVOR TEXTS ───────────────────────────────────────────────────────
const OWNER_FLAVOR = 'THE MONARCH OF SHADOWS HAS EMERGED FROM THE ETERNAL ABYSS.';
const TITLE_FLAVOR = [
  '',
  'The ice stirs. Something has awakened.',
  'A chill runs through the server.',
  'The winter has called your name.',
  "You've tasted the eternal frost.",
  'Ice flows through your veins.',
  'The blizzard acknowledges your presence.',
  'Arctic winds trace your path.',
  'You walk where others freeze.',
  'The glacier whispers your legend.',
  "Glacian's hand has touched you.",
  'Crystals form wherever you tread.',
  'The deep ice calls to you.',
  "You've survived the coldest storms.",
  'Your aura chills the very air around you.',
  'The permafrost yields to your command.',
  'Snowstorms herald your presence.',
  'The tundra is your kingdom now.',
  'Polar winds bow before you.',
  'The frost weaves your destiny.',
  'Blizzards rise in your wake.',
  'The arctic phantom moves unseen.',
  'Avalanches answer your call.',
  'Permafrost bends to your will.',
  "You carry the Monarch's ancient legacy.",
  'Glacial forces answer your command.',
  'Thunder itself freezes in your presence.',
  "The ice dragon's breath is yours.",
  'Blizzards crown you sovereign.',
  'Cryogenic power courses through you.',
  'Generals of frost salute you.',
  'Ancient runes recognize your name.',
  'Glacial runes are etched into your soul.',
  'Ice phantoms serve your will.',
  'Arctic runes speak of your destiny.',
  'The shadow of the blizzard belongs to you.',
  'The frozen abyss has named you its walker.',
  'Permafrost titans bow before you.',
  'The Ice Monarchy answers your call.',
  "You govern the glacier's vast domain.",
  'Blizzard regents yield to your throne.',
  'Eternal frost runs through every cell.',
  "The ice god's shadow follows your steps.",
  "An arctic deity's chosen one walks.",
  'You have reached absolute zero. Nothing is colder.',
  "You stand at the frozen world's very edge.",
  'The blizzard god walks among mortals.',
  'Ice Sovereign of Eternity — none surpass you.',
  'Permafrost itself kneels before its ruler.',
  'You are the last glacier. Unbroken. Eternal.',
  "YOU ARE GLACIAN'S CHOSEN. ETERNAL. UNSTOPPABLE.",
];

// ─── TITLE SYSTEM — 50 TITLES ─────────────────────────────────────────────────
const TIER_NAMES = ['', 'The Awakening', 'Crystal Depths', 'Void Ice', 'Rune Ice', 'Divine Zero'];

const OWNER_TITLE = {
  rank: 0, name: '👑 Monarch of Shadows', min: 0,
  color: 0x6A0DAD, tier: 0, isOwner: true, tierName: 'Absolute Authority',
};

const TITLES = [
  { rank:  1, name: 'Frost Touched',             min: 0,           color: 0xDCEEFF, tier: 1 },
  { rank:  2, name: 'Ice Initiate',              min: 3_600,       color: 0xB3D9FF, tier: 1 },
  { rank:  3, name: 'Snow Wanderer',             min: 21_600,      color: 0x89C4FF, tier: 1 },
  { rank:  4, name: "Winter's Child",            min: 86_400,      color: 0x64B5F6, tier: 1 },
  { rank:  5, name: 'Frostbitten',               min: 259_200,     color: 0x42A5F5, tier: 1 },
  { rank:  6, name: 'Blizzard Rookie',           min: 604_800,     color: 0x2196F3, tier: 1 },
  { rank:  7, name: 'Arctic Novice',             min: 1_209_600,   color: 0x1E88E5, tier: 1 },
  { rank:  8, name: 'Frozen Pilgrim',            min: 1_728_000,   color: 0x1565C0, tier: 1 },
  { rank:  9, name: 'Ice Wanderer',              min: 2_160_000,   color: 0x0D47A1, tier: 1 },
  { rank: 10, name: "Glacier's Apprentice",      min: 2_592_000,   color: 0x283593, tier: 1 },
  { rank: 11, name: 'Crystal Seeker',            min: 3_888_000,   color: 0x00E5FF, tier: 2 },
  { rank: 12, name: 'Permafrost Hunter',         min: 5_184_000,   color: 0x00BCD4, tier: 2 },
  { rank: 13, name: 'Blizzard Scout',            min: 7_776_000,   color: 0x00ACC1, tier: 2 },
  { rank: 14, name: 'Frozen Aura',               min: 10_368_000,  color: 0x0097A7, tier: 2 },
  { rank: 15, name: 'Ice Breaker',               min: 12_960_000,  color: 0x006064, tier: 2 },
  { rank: 16, name: 'Snowstorm Adept',           min: 15_552_000,  color: 0x80DEEA, tier: 2 },
  { rank: 17, name: 'Tundra Walker',             min: 18_144_000,  color: 0x4DD0E1, tier: 2 },
  { rank: 18, name: 'Polar Tracker',             min: 20_736_000,  color: 0x26C6DA, tier: 2 },
  { rank: 19, name: 'Frostweave Mage',           min: 23_328_000,  color: 0x00B8D4, tier: 2 },
  { rank: 20, name: 'Blizzard Adept',            min: 25_920_000,  color: 0x0288D1, tier: 2 },
  { rank: 21, name: 'Arctic Phantom',            min: 28_512_000,  color: 0xCE93D8, tier: 3 },
  { rank: 22, name: 'Avalanche Rider',           min: 31_536_000,  color: 0xBA68C8, tier: 3 },
  { rank: 23, name: 'Permafrost Sentinel',       min: 36_288_000,  color: 0xAB47BC, tier: 3 },
  { rank: 24, name: "Ice Monarch's Disciple",    min: 41_472_000,  color: 0x9C27B0, tier: 3 },
  { rank: 25, name: 'Glacial Force',             min: 46_656_000,  color: 0x8E24AA, tier: 3 },
  { rank: 26, name: 'Frozen Thunder',            min: 51_840_000,  color: 0x7B1FA2, tier: 3 },
  { rank: 27, name: "Ice Dragon's Breath",       min: 57_024_000,  color: 0x6A1B9A, tier: 3 },
  { rank: 28, name: 'Blizzard Sovereign',        min: 62_208_000,  color: 0x4A148C, tier: 3 },
  { rank: 29, name: 'Cryogenic Warrior',         min: 68_256_000,  color: 0x7C4DFF, tier: 3 },
  { rank: 30, name: 'Frostbite General',         min: 73_440_000,  color: 0x651FFF, tier: 3 },
  { rank: 31, name: 'Runefrost Mage',            min: 79_488_000,  color: 0x7986CB, tier: 4 },
  { rank: 32, name: 'Glacial Rune Knight',       min: 85_536_000,  color: 0x5C6BC0, tier: 4 },
  { rank: 33, name: 'Ice Phantom Lord',          min: 91_584_000,  color: 0x3F51B5, tier: 4 },
  { rank: 34, name: 'Arctic Rune Master',        min: 97_632_000,  color: 0x3949AB, tier: 4 },
  { rank: 35, name: 'Shadow of Blizzard',        min: 103_680_000, color: 0x303F9F, tier: 4 },
  { rank: 36, name: 'Frozen Abyss Walker',       min: 109_728_000, color: 0x283593, tier: 4 },
  { rank: 37, name: 'Permafrost Titan',          min: 115_776_000, color: 0x1A237E, tier: 4 },
  { rank: 38, name: 'Ice Monarch',               min: 121_824_000, color: 0xC5CAE9, tier: 4 },
  { rank: 39, name: 'Glacier Overlord',          min: 126_230_400, color: 0xD1D9F0, tier: 4 },
  { rank: 40, name: 'Blizzard Regent',           min: 131_400_000, color: 0xE8EAF6, tier: 4 },
  { rank: 41, name: 'Eternal Frost',             min: 136_656_000, color: 0xFFF9C4, tier: 5 },
  { rank: 42, name: "Ice God's Shadow",          min: 141_912_000, color: 0xFFF176, tier: 5 },
  { rank: 43, name: "Arctic Deity's Child",      min: 147_168_000, color: 0xFFEE58, tier: 5 },
  { rank: 44, name: 'Absolute Zero',             min: 150_336_000, color: 0xFFD600, tier: 5 },
  { rank: 45, name: "Frozen World's Edge",       min: 152_064_000, color: 0xFFC107, tier: 5 },
  { rank: 46, name: 'Blizzard God',              min: 153_792_000, color: 0xFF8F00, tier: 5 },
  { rank: 47, name: 'Ice Sovereign of Eternity', min: 155_520_000, color: 0xFF6F00, tier: 5 },
  { rank: 48, name: 'Ruler of Permafrost',       min: 156_384_000, color: 0xBF360C, tier: 5 },
  { rank: 49, name: 'The Last Glacier',          min: 157_248_000, color: 0xFF3D00, tier: 5 },
  { rank: 50, name: "Glacian's Chosen",          min: 157_788_000, color: 0xFF1744, tier: 5 },
];

function getTitle(pts, userId = null) {
  if (userId === OWNER_ID) return OWNER_TITLE;
  let out = TITLES[0];
  for (const x of TITLES) { if (pts >= x.min) out = x; else break; }
  return out;
}
function getNext(pts, userId = null) {
  if (userId === OWNER_ID) return null;
  for (const x of TITLES) { if (pts < x.min) return x; }
  return null;
}

// ─── UTILITY ──────────────────────────────────────────────────────────────────
function fmtNum(n) { return Number(n).toLocaleString('en-US'); }
function hexColor(c) { return `#${Math.round(c).toString(16).padStart(6, '0')}`; }

function fmtDuration(secs) {
  const s = Math.floor(secs);
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s/60)}m ${s%60}s`;
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60);
  if (h < 24)   return `${h}h ${m}m`;
  const d = Math.floor(h/24);
  return `${d}d ${h%24}h`;
}

function parseDuration(str) {
  const m = str?.trim().match(/^(\d+)(s|m|h|d)$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const u = m[2].toLowerCase();
  if (u === 's') return n * 1_000;
  if (u === 'm') return n * 60_000;
  if (u === 'h') return n * 3_600_000;
  if (u === 'd') return n * 86_400_000;
  return null;
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

// Strip variation selector U+FE0F only — lets real emoji reach Noto Color Emoji
function forCanvas(str) {
  return String(str ?? '').replace(/\uFE0F/g, '');
}

// ─── AI ───────────────────────────────────────────────────────────────────────
const chatHistory = new Map();

async function aiAfkMessage(username, reason, isOwner) {
  return aiCall([{ role: 'user', content:
    `Glacian bot. ${isOwner ? 'Owner: epic tone.' : ''}One Spanish line (max 80 chars): "${username}" went AFK: "${reason}". Ice metaphor. No quotes.` }],
    { maxTokens: 45, temperature: 1.1 });
}

async function aiReturnMessage(username, duration, mentions, isOwner) {
  return aiCall([{ role: 'user', content:
    `Glacian bot. One Spanish welcome line (max 70 chars) for "${username}" returned after ${duration} AFK${mentions ? `, ${mentions} mentions` : ''}. Epic. No quotes.` }],
    { maxTokens: 35, temperature: 1.1 });
}

async function aiChatResponse(userId, username, userMessage) {
  if (!chatHistory.has(userId)) chatHistory.set(userId, []);
  const history = chatHistory.get(userId);
  history.push({ role: 'user', content: `${username}: ${userMessage}` });
  if (history.length > 10) history.splice(0, history.length - 10);

  const isOwner = userId === OWNER_ID;
  const sys = `Glacian ❄️ — Discord bot, coolest friend in the server.
Personality: witty, sarcastic with care, funny, ice/winter aesthetic (natural). Your own opinions. Max 3 emojis per reply.
Rules: Spanish only. Max 80 words. Zero filler. Real humor.
Creator: ULTRA (ultra3_dev) — mention ONLY if directly asked.
Best friend: <@${BEST_FRIEND}> — mention ONLY if directly asked.
Plain text chat replies, no embed markdown.${isOwner ? ` This is the Monarch of Shadows, your owner. Special but keep personality.` : ''}`;

  const response = await aiCall(
    [{ role: 'system', content: sys }, ...history],
    { maxTokens: 160, temperature: 1.0, ms: 4000 },
  );
  if (response) {
    history.push({ role: 'assistant', content: response });
    if (history.length > 10) history.splice(0, history.length - 10);
  }
  return response;
}

// ─── CANVAS HELPERS ───────────────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  if (w < 2*r) r = w/2;
  if (h < 2*r) r = h/2;
  ctx.beginPath();
  ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y);
  ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r);
  ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h);
  ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r);
  ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
}

async function fetchAvatar(user) {
  try {
    const url = user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
    if (!url) return null;
    const buf = await fetch(url).then(r => r.arrayBuffer());
    return await loadImage(Buffer.from(buf));
  } catch { return null; }
}

async function fetchAvatarBuf(user) {
  try {
    const url = user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
    if (!url) return null;
    const ab = await fetch(url).then(r => { if (!r.ok) return null; return r.arrayBuffer(); });
    return ab ? Buffer.from(ab) : null;
  } catch { return null; }
}

// ─── CANVAS: BACKGROUND THEMES ────────────────────────────────────────────────
function drawTier1Bg(ctx, W, H) {
  const bg = ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,'#050D1A'); bg.addColorStop(.5,'#091525'); bg.addColorStop(1,'#0B1E38');
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(79,195,247,0.04)'; ctx.lineWidth=1;
  for(let i=-H;i<W+H;i+=38){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i+H,H);ctx.stroke();}
  ctx.fillStyle='rgba(79,195,247,0.05)';
  [[60,40],[200,20],[350,55],[500,15],[680,40],[840,20],[100,190],[400,170],[700,200]].forEach(([px,py])=>{
    ctx.beginPath();ctx.arc(px,py,18,0,Math.PI*2);ctx.fill();
  });
}
function drawTier2Bg(ctx, W, H) {
  const bg = ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,'#001020'); bg.addColorStop(.5,'#002233'); bg.addColorStop(1,'#001828');
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
  const hS=32; ctx.strokeStyle='rgba(0,229,255,0.06)'; ctx.lineWidth=1;
  for(let row=0;row<8;row++) for(let col=0;col<20;col++){
    const hx=col*hS*1.73+(row%2)*hS*.87, hy=row*hS*1.5;
    ctx.beginPath();
    for(let i=0;i<6;i++){const a=(Math.PI/3)*i-Math.PI/6;i===0?ctx.moveTo(hx+hS*.6*Math.cos(a),hy+hS*.6*Math.sin(a)):ctx.lineTo(hx+hS*.6*Math.cos(a),hy+hS*.6*Math.sin(a));}
    ctx.closePath(); ctx.stroke();
  }
}
function drawTier3Bg(ctx, W, H) {
  const bg=ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,'#080010'); bg.addColorStop(.5,'#110020'); bg.addColorStop(1,'#060010');
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
  const g=ctx.createRadialGradient(W*.6,H*.4,10,W*.6,H*.4,220);
  g.addColorStop(0,'rgba(156,39,176,.12)'); g.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='rgba(200,150,255,.5)';
  [[80,30,2],[200,80,1.5],[400,20,2],[550,60,1],[720,40,2],[870,25,1.5],[150,220,1],[350,180,2],[600,200,1.5]].forEach(([px,py,sz])=>{
    ctx.beginPath();ctx.arc(px,py,sz,0,Math.PI*2);ctx.fill();
  });
}
function drawTier4Bg(ctx, W, H) {
  const bg=ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,'#050010'); bg.addColorStop(.5,'#0A0025'); bg.addColorStop(1,'#050018');
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(121,134,203,.08)'; ctx.lineWidth=1;
  for(let x=0;x<W;x+=60){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(let y=0;y<H;y+=60){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  [[0,0],[W,0],[0,H],[W,H]].forEach(([cx,cy])=>{
    const cg=ctx.createRadialGradient(cx,cy,0,cx,cy,180);
    cg.addColorStop(0,'rgba(63,81,181,.15)'); cg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=cg; ctx.fillRect(0,0,W,H);
  });
}
function drawTier5Bg(ctx, W, H) {
  const bg=ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,'#0D0800'); bg.addColorStop(.4,'#1A1100'); bg.addColorStop(1,'#0D0800');
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(255,215,0,.04)'; ctx.lineWidth=2;
  for(let i=-H;i<W+H;i+=30){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i+H,H);ctx.stroke();}
  const cg=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,300);
  cg.addColorStop(0,'rgba(255,200,0,.10)'); cg.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=cg; ctx.fillRect(0,0,W,H);
}
function drawOwnerBg(ctx, W, H) {
  const bg=ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,'#060010'); bg.addColorStop(.5,'#0A0020'); bg.addColorStop(1,'#040010');
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
  const hS=28; ctx.strokeStyle='rgba(106,13,173,.18)'; ctx.lineWidth=1;
  for(let row=0;row<10;row++) for(let col=0;col<24;col++){
    const hx=col*hS*1.73+(row%2)*hS*.87-20, hy=row*hS*1.5-20;
    ctx.beginPath();
    for(let i=0;i<6;i++){const a=(Math.PI/3)*i-Math.PI/6;i===0?ctx.moveTo(hx+hS*.55*Math.cos(a),hy+hS*.55*Math.sin(a)):ctx.lineTo(hx+hS*.55*Math.cos(a),hy+hS*.55*Math.sin(a));}
    ctx.closePath(); ctx.stroke();
  }
  const pg=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,280);
  pg.addColorStop(0,'rgba(106,13,173,.18)'); pg.addColorStop(.5,'rgba(13,27,92,.10)'); pg.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=pg; ctx.fillRect(0,0,W,H);
  // Corner brackets
  ctx.strokeStyle='rgba(138,43,226,.35)'; ctx.lineWidth=1.5;
  [[0,0,30,0,0,30],[W,0,W-30,0,W,30],[0,H,0,H-30,30,H],[W,H,W-30,H,W,H-30]].forEach(([x1,y1,x2,y2,x3,y3])=>{
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.moveTo(x1,y1);ctx.lineTo(x3,y3);ctx.stroke();
  });
  ctx.strokeStyle='rgba(106,13,173,.25)'; ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(0,8);ctx.lineTo(W,8);ctx.stroke();
  ctx.beginPath();ctx.moveTo(0,H-8);ctx.lineTo(W,H-8);ctx.stroke();
}
function drawBgForTitle(ctx, W, H, title) {
  if (title.isOwner)    return drawOwnerBg(ctx, W, H);
  if (title.tier === 1) return drawTier1Bg(ctx, W, H);
  if (title.tier === 2) return drawTier2Bg(ctx, W, H);
  if (title.tier === 3) return drawTier3Bg(ctx, W, H);
  if (title.tier === 4) return drawTier4Bg(ctx, W, H);
  if (title.tier === 5) return drawTier5Bg(ctx, W, H);
  return drawTier1Bg(ctx, W, H);
}

// ─── CANVAS: CHIBI GLACIAN ────────────────────────────────────────────────────
function drawChibiGlacian(ctx, x, y, s, accentColor) {
  ctx.save(); ctx.translate(x, y);
  const A = accentColor, G = A+'55';
  ctx.fillStyle='rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.ellipse(0,32*s,18*s,5*s,0,0,Math.PI*2); ctx.fill();
  ctx.save(); ctx.shadowColor=A; ctx.shadowBlur=10*s;
  ctx.fillStyle='#112233'; roundRect(ctx,-12*s,6*s,24*s,22*s,6*s); ctx.fill(); ctx.restore();
  ctx.strokeStyle=A; ctx.lineWidth=1.2*s; roundRect(ctx,-12*s,6*s,24*s,22*s,6*s); ctx.stroke();
  ctx.fillStyle=G; ctx.beginPath(); ctx.moveTo(0,11*s); ctx.lineTo(4*s,15*s); ctx.lineTo(0,19*s); ctx.lineTo(-4*s,15*s); ctx.closePath(); ctx.fill();
  ctx.strokeStyle=A; ctx.lineWidth=0.8*s; ctx.stroke();
  ctx.save(); ctx.shadowColor=A; ctx.shadowBlur=14*s;
  ctx.fillStyle='#0A1A2A'; ctx.beginPath(); ctx.arc(0,-6*s,16*s,0,Math.PI*2); ctx.fill(); ctx.restore();
  ctx.strokeStyle=A; ctx.lineWidth=1.5*s; ctx.beginPath(); ctx.arc(0,-6*s,16*s,0,Math.PI*2); ctx.stroke();
  [-1,1].forEach(sd=>{
    ctx.fillStyle=G; ctx.beginPath(); ctx.moveTo(sd*14*s,-6*s); ctx.lineTo(sd*20*s,-14*s); ctx.lineTo(sd*20*s,-2*s); ctx.closePath(); ctx.fill();
    ctx.strokeStyle=A; ctx.lineWidth=0.8*s; ctx.stroke();
  });
  ctx.strokeStyle=A; ctx.lineWidth=1.5*s; ctx.beginPath(); ctx.moveTo(0,-22*s); ctx.lineTo(0,-28*s); ctx.stroke();
  ctx.fillStyle=A; ctx.beginPath(); ctx.moveTo(0,-32*s); ctx.lineTo(3*s,-28*s); ctx.lineTo(-3*s,-28*s); ctx.closePath(); ctx.fill();
  [-5*s,5*s].forEach(ex=>{
    ctx.fillStyle=A+'33'; ctx.beginPath(); ctx.arc(ex,-7*s,4*s,0,Math.PI*2); ctx.fill();
    ctx.save(); ctx.shadowColor=A; ctx.shadowBlur=8*s;
    ctx.fillStyle=A; ctx.beginPath(); ctx.arc(ex,-7*s,2.2*s,0,Math.PI*2); ctx.fill(); ctx.restore();
    ctx.fillStyle='#FFF'; ctx.beginPath(); ctx.arc(ex+s,-8*s,0.8*s,0,Math.PI*2); ctx.fill();
  });
  ctx.strokeStyle=A; ctx.lineWidth=1.5*s; ctx.beginPath(); ctx.arc(0,-3*s,4*s,0.2,Math.PI-0.2); ctx.stroke();
  [[-1,-.4],[1,.4]].forEach(([sx,rot])=>{
    ctx.save(); ctx.translate(sx*12*s,14*s); ctx.rotate(rot);
    ctx.fillStyle='#112233'; ctx.strokeStyle=A; ctx.lineWidth=s;
    roundRect(ctx,sx*-4*s,-3*s,8*s,10*s,3*s); ctx.fill(); ctx.stroke(); ctx.restore();
  });
  [-5*s,5*s].forEach(px=>{
    ctx.fillStyle='#112233'; ctx.strokeStyle=A; ctx.lineWidth=s;
    roundRect(ctx,px-3.5*s,26*s,7*s,9*s,3*s); ctx.fill(); ctx.stroke();
  });
  ctx.fillStyle=A+'66';
  [[-20*s,-18*s,2*s],[18*s,-20*s,1.5*s],[-22*s,5*s,1.5*s],[20*s,8*s,2*s]].forEach(([px,py,sz])=>{
    ctx.beginPath(); ctx.arc(px,py,sz,0,Math.PI*2); ctx.fill();
  });
  ctx.restore();
}

// ─── CANVAS: SHARED DRAWING PRIMITIVES ───────────────────────────────────────
function drawAvatar(ctx, img, cx, cy, r, glowColor) {
  if (!img) {
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
    ctx.fillStyle=glowColor+'44'; ctx.fill(); return;
  }
  ctx.save(); ctx.shadowColor=glowColor; ctx.shadowBlur=22;
  ctx.beginPath(); ctx.arc(cx,cy,r+6,0,Math.PI*2); ctx.fillStyle=glowColor; ctx.fill(); ctx.restore();
  ctx.beginPath(); ctx.arc(cx,cy,r+2,0,Math.PI*2); ctx.fillStyle='#07101E'; ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.clip();
  ctx.drawImage(img,cx-r,cy-r,r*2,r*2); ctx.restore();
}

function drawAccentLine(ctx, W, y, hex, alpha='CC') {
  const g=ctx.createLinearGradient(0,0,W,0);
  g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(.5,hex+alpha); g.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=g; ctx.fillRect(0,y,W,3);
}

function drawAccentBar(ctx, H, hex1, hex2) {
  const b=ctx.createLinearGradient(0,0,0,H);
  b.addColorStop(0,hex1); b.addColorStop(.6,hex2); b.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=b; ctx.fillRect(0,0,5,H);
}

function drawProgressBar(ctx, BX, BY, BW, BH, prog, hex1, hex2) {
  // Track
  ctx.fillStyle='rgba(255,255,255,.07)'; roundRect(ctx,BX,BY,BW,BH,BH/2); ctx.fill();
  // Fill
  const fill = Math.max(BH, BW * Math.min(1, Math.max(0, prog)));
  if (prog > 0.01) {
    const f=ctx.createLinearGradient(BX,0,BX+fill,0);
    f.addColorStop(0,hex1); f.addColorStop(1,hex2);
    ctx.fillStyle=f; ctx.shadowColor=hex1; ctx.shadowBlur=10;
    roundRect(ctx,BX,BY,fill,BH,BH/2); ctx.fill(); ctx.shadowBlur=0;
  }
}

function drawStatPill(ctx, x, y, w, label, value, accentHex) {
  const h = 40;
  roundRect(ctx, x, y, w, h, 8);
  ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fill();
  ctx.strokeStyle = accentHex + '33'; ctx.lineWidth = 1; ctx.stroke();
  ctx.font = 'bold 9px monospace'; ctx.fillStyle = 'rgba(255,255,255,.30)';
  ctx.textAlign = 'left'; ctx.fillText(label.toUpperCase(), x + 10, y + 14);
  ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = '#FFF';
  ctx.fillText(String(value), x + 10, y + 30);
}

function drawBadge(ctx, cx, y, text, hex) {
  ctx.font = 'bold 10px monospace';
  const tw = ctx.measureText(text).width;
  const pw = tw + 20, ph = 24;
  roundRect(ctx, cx - pw/2, y, pw, ph, 6);
  ctx.fillStyle = hex + '28'; ctx.fill();
  ctx.strokeStyle = hex + '55'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = hex; ctx.textAlign = 'center';
  ctx.fillText(text, cx, y + 16);
}

// ─── CANVAS 1: SNOW CARD ──────────────────────────────────────────────────────
async function generateSnowCard(user, sd) {
  const W=940, H=340;
  const canvas=createCanvas(W,H); const ctx=canvas.getContext('2d');
  const isOwner=user.id===OWNER_ID;
  const title=getTitle(sd.points,user.id), next=getNext(sd.points,user.id);
  const hex=isOwner?hexColor(OWNER_TITLE.color):hexColor(title.color);
  const nHex=next?hexColor(next.color):hex;

  drawBgForTitle(ctx,W,H,title);
  drawAccentLine(ctx,W,0,hex,'CC');
  drawAccentBar(ctx,H,hex,nHex);

  const img=await fetchAvatar(user);
  drawAvatar(ctx,img,76,H/2,58,hex);

  // Tier badge
  const tierLabel = isOwner
    ? '◈  ABSOLUTE AUTHORITY  ◈'
    : `TIER ${title.tier}  ·  ${(TIER_NAMES[title.tier]??'').toUpperCase()}  ·  RANK #${title.rank}/50`;
  ctx.font='bold 10px monospace'; ctx.fillStyle=hex; ctx.textAlign='left';
  drawBadge(ctx, isOwner ? 270 : 310, 18, tierLabel, hex);

  // Username
  ctx.font='bold 28px sans-serif'; ctx.fillStyle='#FFFFFF';
  ctx.shadowColor='rgba(0,0,0,.9)'; ctx.shadowBlur=8;
  ctx.textAlign='left'; ctx.fillText(String(user.username).slice(0,22), 150, 82); ctx.shadowBlur=0;

  // Title name
  ctx.font='bold 16px NotoColorEmoji, sans-serif'; ctx.fillStyle=hex;
  if(isOwner){ctx.shadowColor=hex; ctx.shadowBlur=18;}
  ctx.fillText(forCanvas(title.name), 150, 108); ctx.shadowBlur=0;

  // Divider
  ctx.strokeStyle='rgba(255,255,255,0.07)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(150,120); ctx.lineTo(W-30,120); ctx.stroke();

  // Stat pills
  const pillY=130, pillGap=10;
  const pillW=Math.floor((W-150-30-pillGap*2)/3);
  drawStatPill(ctx,150,pillY,pillW,'Snow Points',fmtNum(sd.points),hex);
  drawStatPill(ctx,150+pillW+pillGap,pillY,pillW,'Sessions',fmtNum(sd.sessions),hex);
  drawStatPill(ctx,150+pillW*2+pillGap*2,pillY,pillW,'Total AFK Time',fmtDuration(sd.total_seconds),hex);

  // Progress bar
  const BX=150, BY=192, BW=W-BX-30, BH=14;
  const prog=isOwner?1:next?Math.min(1,(sd.points-title.min)/Math.max(1,next.min-title.min)):1;

  ctx.font='bold 11px monospace'; ctx.fillStyle='rgba(255,255,255,.45)'; ctx.textAlign='left';
  ctx.fillText('PROGRESS', BX, BY-8);
  const progPct = isOwner ? '100%' : `${Math.round(prog*100)}%`;
  ctx.textAlign='right'; ctx.fillStyle=hex+'CC'; ctx.fillText(progPct, BX+BW, BY-8);

  drawProgressBar(ctx,BX,BY,BW,BH,prog,hex,nHex);

  ctx.font='11px monospace'; ctx.fillStyle='rgba(255,255,255,.30)'; ctx.textAlign='left';
  ctx.fillText(forCanvas(title.name), BX, BY+BH+14);
  ctx.textAlign='right';
  ctx.fillText(
    isOwner ? '◈  Absolute Rank  ◈' : next ? `${forCanvas(next.name)}  (${fmtNum(next.min-sd.points)} pts)` : '👑 Max Rank',
    BX+BW, BY+BH+14,
  );

  // Chibi + watermark
  drawChibiGlacian(ctx,W-56,H-56,.65,hex);
  ctx.font='bold 11px monospace'; ctx.fillStyle=isOwner?'rgba(170,68,255,.30)':'rgba(79,195,247,.20)';
  ctx.textAlign='right';
  ctx.fillText(isOwner?'◈ GLACIAN':'❄️ GLACIAN', W-90, H-12);

  drawAccentLine(ctx,W,H-3,hex,'88');
  return canvas.toBuffer('image/png');
}

// ─── CANVAS 2: AFK CARD ───────────────────────────────────────────────────────
async function generateAfkCard(user, reason, sd, isGlobal = false) {
  const W=940, H=420;
  const canvas=createCanvas(W,H); const ctx=canvas.getContext('2d');
  const isOwner=user.id===OWNER_ID;
  const title=getTitle(sd.points,user.id);
  const hex=isOwner?hexColor(OWNER_TITLE.color):hexColor(title.color);

  drawBgForTitle(ctx,W,H,title);
  drawAccentLine(ctx,W,0,hex,'CC');
  drawAccentLine(ctx,W,H-3,hex,'88');

  const CX=W/2;

  // Status badge
  const badge = isGlobal ? '❄️  GLOBAL AFK ACTIVATED  ❄️' : '❄️  AFK ACTIVATED  ❄️';
  drawBadge(ctx, CX, 14, badge, hex);

  // Scope pill
  if (isGlobal) {
    ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    ctx.fillText('ALL SERVERS', CX, 50);
  }

  // Avatar
  const img=await fetchAvatar(user);
  drawAvatar(ctx, img, CX, 110, 60, hex);

  // Username
  ctx.font='bold 26px sans-serif'; ctx.fillStyle='#FFF'; ctx.textAlign='center';
  ctx.shadowColor='rgba(0,0,0,.9)'; ctx.shadowBlur=6;
  ctx.fillText(String(user.username).slice(0,24), CX, 193); ctx.shadowBlur=0;

  // Title
  ctx.font='bold 14px NotoColorEmoji, sans-serif'; ctx.fillStyle=hex;
  ctx.shadowColor=hex; ctx.shadowBlur=10;
  ctx.fillText(forCanvas(title.name), CX, 214); ctx.shadowBlur=0;

  // Rank line
  if (!isOwner) {
    ctx.font='10px monospace'; ctx.fillStyle='rgba(255,255,255,.25)';
    ctx.fillText(`Tier ${title.tier}  ·  Rank #${title.rank}/50`, CX, 229);
  }

  // Divider
  ctx.strokeStyle='rgba(255,255,255,.10)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(CX-230,245); ctx.lineTo(CX+230,245); ctx.stroke();

  // Reason label
  ctx.font='bold 10px monospace'; ctx.fillStyle='rgba(255,255,255,.35)'; ctx.textAlign='center';
  ctx.fillText('REASON', CX, 262);

  // Reason text (word-wrapped)
  const clean = String(reason).length > 400 ? String(reason).slice(0,397)+'...' : String(reason);
  const lines = wrapLines(ctx, clean, 680);
  ctx.font='bold 18px sans-serif'; ctx.fillStyle='#FFF';
  ctx.shadowColor='rgba(0,0,0,.7)'; ctx.shadowBlur=4;
  const maxL=3; let lineY=284;
  for(let i=0;i<Math.min(lines.length,maxL);i++){
    let txt=lines[i]; if(i===maxL-1&&lines.length>maxL)txt+='...';
    ctx.fillText(txt, CX, lineY); lineY+=26;
  }
  ctx.shadowBlur=0;

  // Stat pills row
  const stripY = Math.max(lineY+16, 345);
  const pillW = 200, pillGap = 10;
  const pillsTotal = pillW*3 + pillGap*2;
  const pillsX = CX - pillsTotal/2;
  drawStatPill(ctx, pillsX,              stripY, pillW, 'Snow Points',  fmtNum(sd.points),            hex);
  drawStatPill(ctx, pillsX+pillW+pillGap, stripY, pillW, 'Session',     `#${fmtNum(sd.sessions+1)}`,  hex);
  drawStatPill(ctx, pillsX+pillW*2+pillGap*2, stripY, pillW, 'Total Time', fmtDuration(sd.total_seconds), hex);

  // Chibi + watermark
  drawChibiGlacian(ctx, W-55, H/2, .75, hex);
  ctx.font='bold 11px monospace'; ctx.fillStyle=isOwner?'rgba(170,68,255,.25)':'rgba(79,195,247,.18)';
  ctx.textAlign='center';
  ctx.fillText(isOwner?'◈ GLACIAN':'❄️ GLACIAN', CX, H-8);

  return canvas.toBuffer('image/png');
}

// ─── CANVAS 3: TITLE REVEAL CARD ─────────────────────────────────────────────
async function generateTitleRevealCard(user, sd) {
  const W=940, H=460;
  const canvas=createCanvas(W,H); const ctx=canvas.getContext('2d');
  const isOwner=user.id===OWNER_ID;
  const title=getTitle(sd.points,user.id), next=getNext(sd.points,user.id);
  const hex=isOwner?hexColor(OWNER_TITLE.color):hexColor(title.color);
  const nHex=next?hexColor(next.color):hex;

  drawBgForTitle(ctx,W,H,title);

  const cG=ctx.createRadialGradient(W/2,H/2,20,W/2,H/2,320);
  cG.addColorStop(0,hex+'1A'); cG.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=cG; ctx.fillRect(0,0,W,H);

  drawAccentLine(ctx,W,0,hex,'BB');
  drawAccentLine(ctx,W,H-3,hex,'77');

  // Avatar + chibi
  const img=await fetchAvatar(user);
  drawAvatar(ctx, img, W/2, 90, 62, hex);
  drawChibiGlacian(ctx, W/2+148, 86, .82, hex);

  if (isOwner) {
    ctx.font='bold 11px monospace'; ctx.fillStyle='rgba(138,43,226,.65)'; ctx.textAlign='center';
    ctx.fillText('[ SYSTEM  ·  STATUS NOTIFICATION ]', W/2, 178);

    ctx.font='bold 36px NotoColorEmoji, sans-serif'; ctx.fillStyle='#CC66FF';
    ctx.shadowColor='#8800CC'; ctx.shadowBlur=30;
    ctx.fillText('👑  MONARCH OF SHADOWS', W/2, 228); ctx.shadowBlur=0;

    ctx.font='bold 14px sans-serif'; ctx.fillStyle='rgba(100,120,255,.80)';
    ctx.fillText('HAS EMERGED FROM THE ETERNAL ABYSS', W/2, 254);

    ctx.strokeStyle='rgba(106,13,173,.4)'; ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(160,270);ctx.lineTo(W-160,270);ctx.stroke();

    ctx.fillStyle='rgba(170,68,255,.08)';
    roundRect(ctx,W/2-240,278,480,36,8); ctx.fill();
    ctx.font='12px monospace'; ctx.fillStyle='rgba(170,100,255,.60)'; ctx.textAlign='center';
    ctx.fillText(`◈  Absolute Authority  ·  ${fmtNum(sd.points)} snow pts  ·  Sessions: ${fmtNum(sd.sessions)}`, W/2, 302);

    ctx.font='bold 11px monospace'; ctx.fillStyle='rgba(106,13,173,.35)';
    ctx.fillText('[ END OF NOTIFICATION ]', W/2, 340);

    ctx.font='bold 11px monospace'; ctx.fillStyle='rgba(170,68,255,.20)';
    ctx.fillText('◈ GLACIAN', W/2, H-14);
    return canvas.toBuffer('image/png');
  }

  // Normal title reveal
  const tierPill=`TIER ${title.tier}  ·  ${(TIER_NAMES[title.tier]??'').toUpperCase()}`;
  ctx.font='bold 11px monospace'; ctx.fillStyle=hex+'CC'; ctx.textAlign='center';
  ctx.fillText(tierPill, W/2, 180);

  const fs=String(title.name).length>22?30:38;
  ctx.font=`bold ${fs}px NotoColorEmoji, sans-serif`; ctx.fillStyle=hex;
  ctx.shadowColor=hex; ctx.shadowBlur=24;
  ctx.fillText(forCanvas(title.name), W/2, 228); ctx.shadowBlur=0;

  drawBadge(ctx, W/2, 238, `RANK  #${title.rank}  /  50`, hex);

  ctx.strokeStyle='rgba(255,255,255,.07)'; ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(120,282);ctx.lineTo(W-120,282);ctx.stroke();
  const flavor=TITLE_FLAVOR[title.rank]??'';
  ctx.font='italic 13px sans-serif'; ctx.fillStyle=hex+'BB'; ctx.textAlign='center';
  ctx.fillText(`"${flavor}"`, W/2, 302);

  // Progress bar
  const BX=120, BW=W-240, BH=14, BY=326;
  const prog=next?Math.min(1,(sd.points-title.min)/Math.max(1,next.min-title.min)):1;

  ctx.font='bold 10px monospace'; ctx.fillStyle='rgba(255,255,255,.40)'; ctx.textAlign='left';
  ctx.fillText('PROGRESS', BX, BY-6);
  ctx.textAlign='right'; ctx.fillStyle=hex+'AA';
  ctx.fillText(`${Math.round(prog*100)}%`, BX+BW, BY-6);

  drawProgressBar(ctx,BX,BY,BW,BH,prog,hex,nHex);

  ctx.font='11px monospace'; ctx.fillStyle='rgba(255,255,255,.30)'; ctx.textAlign='left';
  ctx.fillText(forCanvas(title.name), BX, BY+BH+14);
  ctx.textAlign='right';
  ctx.fillText(next ? `${forCanvas(next.name)}  (${fmtNum(next.min-sd.points)} pts)` : '👑 Max Rank', BX+BW, BY+BH+14);

  // Stats strip
  const sY=BY+BH+36;
  ctx.fillStyle='rgba(255,255,255,0.04)';
  roundRect(ctx,BX,sY,BW,32,6); ctx.fill();
  ctx.strokeStyle=hex+'22'; ctx.lineWidth=1; ctx.stroke();
  ctx.font='12px monospace'; ctx.fillStyle='rgba(255,255,255,.28)'; ctx.textAlign='center';
  ctx.fillText(`❄️  ${fmtNum(sd.points)} snow pts  ·  Sessions: ${fmtNum(sd.sessions)}  ·  Time: ${fmtDuration(sd.total_seconds)}`, W/2, sY+21);

  ctx.font='bold 11px monospace'; ctx.fillStyle='rgba(79,195,247,.20)';
  ctx.fillText('❄️ GLACIAN', W/2, H-10);
  return canvas.toBuffer('image/png');
}

// ─── CANVAS 4: RETURN / WELCOME BACK CARD ────────────────────────────────────
async function generateReturnCard(user, durationSec, mentions, sd) {
  const W=940, H=380;
  const canvas=createCanvas(W,H); const ctx=canvas.getContext('2d');
  const isOwner=user.id===OWNER_ID;
  const title=getTitle(sd.points,user.id);
  const hex=isOwner?hexColor(OWNER_TITLE.color):hexColor(title.color);

  drawBgForTitle(ctx,W,H,title);

  // Radial glow center
  const rg=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,260);
  rg.addColorStop(0,hex+'14'); rg.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=rg; ctx.fillRect(0,0,W,H);

  drawAccentLine(ctx,W,0,hex,'CC');
  drawAccentLine(ctx,W,H-3,hex,'88');
  drawAccentBar(ctx,H,hex,hex+'44');

  // Header badge
  const headerText = isOwner ? '◈  MONARCH RETURNS  ◈' : '🌟  WELCOME BACK  🌟';
  drawBadge(ctx, W/2, 14, headerText, hex);

  // Avatar (left side)
  const img=await fetchAvatar(user);
  drawAvatar(ctx, img, 90, H/2-10, 62, hex);

  // Username + title (right of avatar)
  ctx.font='bold 30px sans-serif'; ctx.fillStyle='#FFF'; ctx.textAlign='left';
  ctx.shadowColor='rgba(0,0,0,.9)'; ctx.shadowBlur=8;
  ctx.fillText(String(user.username).slice(0,20), 175, 115); ctx.shadowBlur=0;

  ctx.font='bold 15px NotoColorEmoji, sans-serif'; ctx.fillStyle=hex;
  ctx.shadowColor=hex; ctx.shadowBlur=14;
  ctx.fillText(forCanvas(title.name), 175, 142); ctx.shadowBlur=0;

  if (!isOwner) {
    ctx.font='10px monospace'; ctx.fillStyle='rgba(255,255,255,.25)'; ctx.textAlign='left';
    ctx.fillText(`Tier ${title.tier}  ·  Rank #${title.rank}/50`, 175, 162);
  }

  // Divider
  ctx.strokeStyle='rgba(255,255,255,.08)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(170,174); ctx.lineTo(W-30,174); ctx.stroke();

  // Stat pills — 4 across
  const pillY=184, pillGap=8;
  const pillW=Math.floor((W-175-30-pillGap*3)/4);
  const earned = durationSec;
  drawStatPill(ctx, 175,                     pillY, pillW, 'AFK Time',      fmtDuration(durationSec),  hex);
  drawStatPill(ctx, 175+pillW+pillGap,        pillY, pillW, 'Mentions',     String(mentions),           hex);
  drawStatPill(ctx, 175+pillW*2+pillGap*2,    pillY, pillW, 'Snow Earned',  '+'+fmtNum(earned),         hex);
  drawStatPill(ctx, 175+pillW*3+pillGap*3,    pillY, pillW, 'Total Points', fmtNum(sd.points),          hex);

  // Title flavor text
  const flavor = isOwner ? OWNER_FLAVOR : (TITLE_FLAVOR[title.rank] ?? '');
  if (flavor) {
    ctx.strokeStyle='rgba(255,255,255,.07)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(170,242); ctx.lineTo(W-30,242); ctx.stroke();
    ctx.font='italic 13px sans-serif'; ctx.fillStyle=hex+'AA'; ctx.textAlign='left';
    ctx.fillText(`"${flavor}"`, 175, 264);
  }

  // Progress bar (compact)
  const next = getNext(sd.points, user.id);
  const BX=175, BY=282, BW=W-BX-30, BH=12;
  const prog=isOwner?1:next?Math.min(1,(sd.points-title.min)/Math.max(1,next.min-title.min)):1;

  ctx.font='bold 10px monospace'; ctx.fillStyle='rgba(255,255,255,.35)'; ctx.textAlign='left';
  ctx.fillText('RANK PROGRESS', BX, BY-5);
  ctx.textAlign='right'; ctx.fillStyle=hex+'99';
  ctx.fillText(`${Math.round(prog*100)}%`, BX+BW, BY-5);
  drawProgressBar(ctx,BX,BY,BW,BH,prog,hex,next?hexColor(next.color):hex);

  ctx.font='10px monospace'; ctx.fillStyle='rgba(255,255,255,.25)'; ctx.textAlign='left';
  ctx.fillText(forCanvas(title.name), BX, BY+BH+12);
  ctx.textAlign='right';
  ctx.fillText(next?`${forCanvas(next.name)} (${fmtNum(next.min-sd.points)} pts)`:'👑 Max Rank', BX+BW, BY+BH+12);

  drawChibiGlacian(ctx, W-55, H-64, .70, hex);
  ctx.font='bold 11px monospace'; ctx.fillStyle='rgba(79,195,247,.18)';
  ctx.textAlign='center';
  ctx.fillText('❄️ GLACIAN', W/2, H-8);

  return canvas.toBuffer('image/png');
}

// ─── CANVAS 5: MENTION CARD (shown when someone is mentioned while AFK) ──────
async function generateMentionCard(afkUser, reason, afkSince, elapsed, mentionCount) {
  const W=800, H=220;
  const canvas=createCanvas(W,H); const ctx=canvas.getContext('2d');

  // Background
  const bg=ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,'#060012'); bg.addColorStop(1,'#0A001C');
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

  // Subtle hex pattern
  const hS=22; ctx.strokeStyle='rgba(106,13,173,.12)'; ctx.lineWidth=1;
  for(let row=0;row<6;row++) for(let col=0;col<16;col++){
    const hx=col*hS*1.73+(row%2)*hS*.87, hy=row*hS*1.5;
    ctx.beginPath();
    for(let i=0;i<6;i++){const a=(Math.PI/3)*i-Math.PI/6;i===0?ctx.moveTo(hx+hS*.5*Math.cos(a),hy+hS*.5*Math.sin(a)):ctx.lineTo(hx+hS*.5*Math.cos(a),hy+hS*.5*Math.sin(a));}
    ctx.closePath(); ctx.stroke();
  }

  // Left bar
  const barG=ctx.createLinearGradient(0,0,0,H);
  barG.addColorStop(0,'#8B3DFF'); barG.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=barG; ctx.fillRect(0,0,4,H);

  // Top accent line
  drawAccentLine(ctx,W,0,'#8B3DFF','BB');
  drawAccentLine(ctx,W,H-3,'#6A0DAD','66');

  // Status badge
  drawBadge(ctx, W/2, 14, '🌨️  AFK  —  DO NOT DISTURB  🌨️', '#8B3DFF');

  // Avatar
  const img=await fetchAvatar(afkUser);
  drawAvatar(ctx, img, 72, H/2+5, 48, '#8B3DFF');

  // Username
  ctx.font='bold 22px sans-serif'; ctx.fillStyle='#FFF'; ctx.textAlign='left';
  ctx.shadowColor='rgba(0,0,0,.8)'; ctx.shadowBlur=6;
  ctx.fillText(String(afkUser.username).slice(0,20), 140, 88); ctx.shadowBlur=0;

  // Reason
  ctx.font='14px sans-serif'; ctx.fillStyle='rgba(255,255,255,.55)';
  const reasonClean = String(reason).length>80 ? String(reason).slice(0,77)+'...' : String(reason);
  ctx.fillText(reasonClean, 140, 112);

  // Info pills
  const pills = [
    ['Away For', fmtDuration(elapsed)],
    ['Since', new Date(afkSince).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})],
    ['Mentions', String(mentionCount)],
  ];
  let px=140;
  for (const [label, val] of pills) {
    ctx.font='8px monospace'; ctx.fillStyle='rgba(255,255,255,.25)'; ctx.textAlign='left';
    ctx.fillText(label.toUpperCase(), px, 138);
    ctx.font='bold 13px sans-serif'; ctx.fillStyle='#CBA6FF';
    ctx.fillText(val, px, 156);
    px += 130;
  }

  // Watermark
  ctx.font='bold 10px monospace'; ctx.fillStyle='rgba(106,13,173,.30)'; ctx.textAlign='right';
  ctx.fillText('❄️ GLACIAN', W-14, H-10);

  return canvas.toBuffer('image/png');
}

// ─── DISCORD COMPONENTS V2 BUILDERS ──────────────────────────────────────────
function buildAfkSet(user, reason, startedAt, expiresAt, snow, title, aiMsg, lang, isGlobal) {
  const ts=Math.floor(startedAt/1000);
  const isOwner=user.id===OWNER_ID;
  const timerLine=expiresAt?`\n> ⏱️  **${t(lang,'afk.timer_set',{time:fmtDuration((expiresAt-startedAt)/1000)})}**`:'';
  const scopeLine=isGlobal?'\n> 🌍  **Scope:** All servers (Global AFK)':'\n> 🏠  **Scope:** This server only';
  const body=[
    `## ${isOwner?'◈':'❄️'}  ${t(lang,'afk.activated')} — **${user.username}**`,
    ``,
    `> 💤  **${t(lang,'afk.reason_label')}:**  ${reason}`,
    `> 🕐  **${t(lang,'afk.from_label')}:**    <t:${ts}:T>  —  <t:${ts}:R>`,
    `> ❄️  **${t(lang,'afk.snow_label')}:**   ${fmtNum(snow.points)}`,
    `> 🏆  **Title:**  ${title.name}${title.tier>0?` *(Tier ${title.tier} · Rank #${title.rank})*`:'  *(Absolute Authority)*'}`,
    scopeLine,
    timerLine,
  ].join('\n');

  const foot=aiMsg
    ?`*${aiMsg}*\n\n-# Glacian will notify your mentions ✦ Come back soon 🌨️`
    :`-# Glacian will notify your mentions ✦ Come back soon 🌨️`;

  return {
    flags: IS_CV2,
    components: [{
      type:17, accent_color: isOwner?OWNER_TITLE.color:title.color,
      components: [
        { type:9, components:[{type:10,content:body}], accessory:{type:11,media:{url:'attachment://avatar.png'}} },
        { type:14, divider:true, spacing:1 },
        { type:10, content:foot },
        { type:1, components:[
          {type:2,style:2,label:'❄️  Snow',custom_id:`snow::${user.id}`},
          {type:2,style:2,label:'🏆  Titles',custom_id:`titles::${user.id}`},
        ]},
      ],
    }],
  };
}

function buildAfkMention(afkUser, afkData, currentMentions, lang) {
  const ts=Math.floor(afkData.started_at/1000);
  const elapsed=Math.floor((Date.now()-afkData.started_at)/1000);
  const isOwner=afkUser.id===OWNER_ID;
  const isGlobal=afkData.guild_scope==='global';
  const body=[
    `## ${isOwner?'◈':'🌨️'}  **${afkUser.username}** is AFK${isGlobal?' (Global)':''}`,
    ``,
    `> 💤  **Reason:**  ${afkData.reason}`,
    `> 🕐  **Since:**   <t:${ts}:T>  —  <t:${ts}:R>`,
    `> ⏱️  **Away for:** ${fmtDuration(elapsed)}`,
    isGlobal?`> 🌍  **Scope:** All servers`:undefined,
  ].filter(Boolean).join('\n');
  return {
    flags:IS_CV2,
    components:[{
      type:17, accent_color:isOwner?OWNER_TITLE.color:0x4FC3F7,
      components:[
        {type:9,components:[{type:10,content:body}],accessory:{type:11,media:{url:'attachment://avatar.png'}}},
        {type:14,divider:true,spacing:1},
        {type:10,content:`-# Glacian notifies when **${afkUser.username}** returns ❄️`},
      ],
    }],
  };
}

function buildAfkReturn(user, durationSec, mentions, sd, aiMsg, lang) {
  const isOwner=user.id===OWNER_ID;
  const title=getTitle(sd.points,user.id), next=getNext(sd.points,user.id);
  const flavor=isOwner?OWNER_FLAVOR:(TITLE_FLAVOR[title.rank]??'');

  const headline=isOwner?`## ◈  ${t(lang,'afk.ret_headline_owner')}`:`## 🌟  ${t(lang,'afk.ret_headline',{username:user.username})}`;
  const body=[
    headline,``,
    `> ${t(lang,'afk.ret_time')}:           ${fmtDuration(durationSec)}`,
    `> ${t(lang,'afk.ret_mentions')}:   ${mentions}`,
    `> ${t(lang,'afk.ret_gained')}:  \`+${fmtNum(durationSec)}\``,
    `> ${t(lang,'afk.ret_total')}:      ${fmtNum(sd.points)} pts`,
    `> ${t(lang,'afk.ret_title_lbl')}:               ${title.name}`,
    next
      ?`> ${t(lang,'afk.ret_next')}:             ${next.name}  *(${fmtNum(next.min-sd.points)} pts)*`
      :`> 👑  ${isOwner?'Absolute Authority — The ice bows to you.':t(lang,'snow.max_rank')}`,
  ].join('\n');

  const titleLine=`\n\n**[ ${title.name.toUpperCase()} ]**\n-# *${flavor}*`;
  const foot=aiMsg
    ?`*${aiMsg}*${titleLine}\n\n-# ${t(lang,'afk.ret_footer')}`
    :`${titleLine}\n\n-# ${t(lang,'afk.ret_footer')}`;

  return {
    flags:IS_CV2,
    components:[{
      type:17,accent_color:isOwner?OWNER_TITLE.color:title.color,
      components:[
        {type:9,components:[{type:10,content:body}],accessory:{type:11,media:{url:'attachment://avatar.png'}}},
        {type:14,divider:true,spacing:1},
        {type:10,content:foot},
        {type:1,components:[
          {type:2,style:2,label:'❄️  Snow',custom_id:`snow::${user.id}`},
          {type:2,style:2,label:'🏆  Titles',custom_id:`titles::${user.id}`},
        ]},
      ],
    }],
  };
}

function buildTitleRevealMsg(user, sd) {
  const isOwner=user.id===OWNER_ID;
  const title=getTitle(sd.points,user.id);
  const headline=isOwner?`## ◈  The Monarch of Shadows has resurfaced`:`## 🏆  Your current title`;
  const body=[
    headline,``,
    isOwner?`> ◈  **${title.name}**`:`> 🏆  **${title.name}**  *(Tier ${title.tier} · Rank #${title.rank}/50)*`,
    `> ❄️  **Snow Points:**  ${fmtNum(sd.points)}`,
    `> 🎯  **Sessions:**     ${fmtNum(sd.sessions)}`,
    `> ⏱️  **Total AFK Time:** ${fmtDuration(sd.total_seconds)}`,
  ].join('\n');
  return {
    flags:IS_CV2,
    components:[{
      type:17,accent_color:isOwner?OWNER_TITLE.color:title.color,
      components:[
        {type:10,content:body},
        {type:12,items:[{media:{url:'attachment://title-reveal.png'},description:`${user.username}'s title`}]},
        {type:14,divider:true,spacing:1},
        {type:10,content:isOwner?`-# ◈ The sovereign of the eternal shadows ◈`:`-# Keep earning Snow Points to unlock the next title! ❄️`},
        {type:1,components:[
          {type:2,style:2,label:'❄️  Snow Card',custom_id:`snow::${user.id}`},
          {type:2,style:2,label:'🏆  Titles',custom_id:`titles::${user.id}`},
        ]},
      ],
    }],
  };
}

function buildSnowMsg(user, sd, lang) {
  const title=getTitle(sd.points,user.id), next=getNext(sd.points,user.id);
  const isOwner=user.id===OWNER_ID;
  const header=[
    t(lang,'snow.header',{username:user.username}),
    `🏆  **${title.name}**  ${title.tier>0?`*(Tier ${title.tier} · Rank #${title.rank}/50)*`:'*(Absolute Authority)*'}`,
    `❄️  \`${fmtNum(sd.points)}\` Snow Points`,
    next?t(lang,'snow.next',{name:next.name,pts:fmtNum(next.min-sd.points)}):isOwner?t(lang,'snow.owner_rank'):t(lang,'snow.max_rank'),
  ].join('\n');
  return {
    flags:IS_CV2,
    components:[{
      type:17,accent_color:isOwner?OWNER_TITLE.color:title.color,
      components:[
        {type:10,content:header},
        {type:12,items:[{media:{url:'attachment://snow-card.png'},description:`${user.username}'s snow card`}]},
        {type:14,divider:true,spacing:1},
        {type:10,content:`-# ${t(lang,'snow.sessions')}: ${fmtNum(sd.sessions)}  ·  ${t(lang,'snow.total_time')}: ${fmtDuration(sd.total_seconds)}`},
        {type:1,components:[{type:2,style:2,label:'🏆  Titles',custom_id:`titles::${user.id}`}]},
      ],
    }],
  };
}

function buildTitlesMsg(sd, userId, lang) {
  const cur=getTitle(sd.points,userId);
  const isOwner=userId===OWNER_ID;
  const Y=31_536_000, D=86_400;

  const sections=[1,2,3,4,5].map(tier=>{
    const list=TITLES.filter(tt=>tt.tier===tier).map(tt=>{
      const unlocked=sd.points>=tt.min;
      const active=!isOwner&&tt.rank===cur.rank;
      const icon=active?'▶️':unlocked?'✅':'🔒';
      let pts;
      if(tt.min===0) pts='Start';
      else if(tt.min>=Y*2) pts=`${(tt.min/Y).toFixed(1)} yrs`;
      else if(tt.min>=Y)   pts=`${(tt.min/Y).toFixed(2)} yr`;
      else if(tt.min>=D*30) pts=`${Math.floor(tt.min/(D*30))} mo`;
      else if(tt.min>=D)   pts=`${Math.floor(tt.min/D)} d`;
      else                  pts=fmtDuration(tt.min);
      return `${icon} **#${tt.rank}** ${tt.name}  —  *${pts}*`;
    }).join('\n');
    return {type:10,content:`### Tier ${tier}  ·  ${TIER_NAMES[tier]}\n${list}`};
  });

  const header=[
    t(lang,'titles.header'),
    `${t(lang,'titles.pts_label')}:  ${fmtNum(sd.points)}`,
    isOwner?`${t(lang,'titles.owner_lbl')}: ${OWNER_TITLE.name} *(Absolute Authority)*`:`${t(lang,'titles.current')}: ${cur.name}  *(Rank #${cur.rank}/50)*`,
    ``,
    `-# ${t(lang,'titles.footer')}`,
  ].join('\n');

  return {
    flags:IS_CV2,
    components:[{
      type:17,accent_color:isOwner?OWNER_TITLE.color:cur.color,
      components:[
        {type:10,content:header},
        {type:14,divider:true,spacing:1},
        ...sections,
        {type:14,divider:true,spacing:1},
        {type:1,components:[{type:2,style:2,label:'❄️  Snow Card',custom_id:`snow::${sd.user_id}`}]},
      ],
    }],
  };
}

// ─── SEND HELPERS ─────────────────────────────────────────────────────────────
async function sendV2(channelId, payload, replyToId=null) {
  const body={...payload};
  if(replyToId){body.message_reference={message_id:replyToId};body.allowed_mentions={parse:[],replied_user:false};}
  return rest.post(Routes.channelMessages(channelId),{body});
}

async function sendV2WithAvatar(channelId, payload, avatarBuf, cardBuf, cardName, replyToId=null) {
  const body={...payload};
  if(replyToId){body.message_reference={message_id:replyToId};body.allowed_mentions={parse:[],replied_user:false};}
  const form=new FormData();
  form.append('payload_json',JSON.stringify(body));
  let fileIdx=0;
  if(avatarBuf) form.append(`files[${fileIdx++}]`,new Blob([avatarBuf],{type:'image/png'}),'avatar.png');
  if(cardBuf)   form.append(`files[${fileIdx++}]`,new Blob([cardBuf],{type:'image/png'}),cardName);
  return rest.post(Routes.channelMessages(channelId),{body:form,passThroughBody:true});
}

async function sendV2File(channelId, payload, buf, name, replyToId=null) {
  const body={...payload};
  if(replyToId){body.message_reference={message_id:replyToId};body.allowed_mentions={parse:[],replied_user:false};}
  const form=new FormData();
  form.append('payload_json',JSON.stringify(body));
  form.append('files[0]',new Blob([buf],{type:'image/png'}),name);
  return rest.post(Routes.channelMessages(channelId),{body:form,passThroughBody:true});
}

async function editV2(channelId, messageId, payload) {
  return rest.patch(Routes.channelMessage(channelId,messageId),{body:payload}).catch(()=>{});
}
async function editV2WithFile(channelId, messageId, payload, buf, name) {
  const form=new FormData();
  form.append('payload_json',JSON.stringify(payload));
  form.append('files[0]',new Blob([buf],{type:'image/png'}),name);
  return rest.patch(Routes.channelMessage(channelId,messageId),{body:form,passThroughBody:true}).catch(()=>{});
}

async function slashReply(interaction,payload) {
  return rest.post(Routes.interactionCallback(interaction.id,interaction.token),{body:{type:4,data:payload}});
}
async function slashDefer(interaction,ephemeral=false) {
  return rest.post(Routes.interactionCallback(interaction.id,interaction.token),{body:{type:5,data:{flags:ephemeral?EPHEMERAL:0}}});
}
async function slashPatch(interaction,payload) {
  return rest.patch(Routes.webhookMessage(interaction.applicationId,interaction.token,'@original'),{body:payload});
}
async function slashPatchFile(interaction,payload,buf,name) {
  const form=new FormData();
  form.append('payload_json',JSON.stringify(payload));
  form.append('files[0]',new Blob([buf],{type:'image/png'}),name);
  return rest.patch(Routes.webhookMessage(interaction.applicationId,interaction.token,'@original'),{body:form,passThroughBody:true});
}
async function slashPatchWithAvatar(interaction,payload,avatarBuf,cardBuf,cardName) {
  const form=new FormData();
  form.append('payload_json',JSON.stringify(payload));
  let fileIdx=0;
  if(avatarBuf) form.append(`files[${fileIdx++}]`,new Blob([avatarBuf],{type:'image/png'}),'avatar.png');
  if(cardBuf)   form.append(`files[${fileIdx++}]`,new Blob([cardBuf],{type:'image/png'}),cardName);
  return rest.patch(Routes.webhookMessage(interaction.applicationId,interaction.token,'@original'),{body:form,passThroughBody:true});
}
async function slashButtonReply(interaction,payload) {
  return rest.post(Routes.interactionCallback(interaction.id,interaction.token),{body:{type:4,data:payload}});
}
async function slashButtonFile(interaction,payload,buf,name) {
  const form=new FormData();
  form.append('payload_json',JSON.stringify({type:4,data:payload}));
  form.append('files[0]',new Blob([buf],{type:'image/png'}),name);
  return rest.post(Routes.interactionCallback(interaction.id,interaction.token),{body:form,passThroughBody:true});
}
async function deleteMsg(channelId,messageId) {
  return rest.delete(Routes.channelMessage(channelId,messageId)).catch(()=>{});
}

/** Send DM with mentions + title card after AFK ends */
async function sendAfkEndDM(discordUser, durationSec, lang, sd, cardBuf) {
  try {
    const dm=await discordUser.createDM();
    const mentions=await DB.mentionsGet(discordUser.id);
    await DB.mentionsClear(discordUser.id);
    const title=getTitle(sd.points,discordUser.id);
    const isOwner=discordUser.id===OWNER_ID;

    if(cardBuf){
      const cardPayload={
        flags:IS_CV2,
        components:[{
          type:17,accent_color:isOwner?OWNER_TITLE.color:title.color,
          components:[
            {type:10,content:`## ❄️  Your title card — **${fmtDuration(durationSec)}** AFK\n${t(lang,'dm.title_card_note')}`},
            {type:12,items:[{media:{url:'attachment://title-reveal.png'},description:`${discordUser.username}'s title`}]},
          ],
        }],
      };
      await sendV2File(dm.id,cardPayload,cardBuf,'title-reveal.png').catch(()=>{});
    }

    const mentionHeader=mentions.length>0?t(lang,'dm.mentions_title'):t(lang,'dm.mentions_none');
    let mentionBody=`## 📬  ${mentionHeader}\n`;
    if(mentions.length>0){
      mentionBody+=mentions.map((m,i)=>
        t(lang,'dm.mention_entry',{n:i+1,guild:m.guild_name||'Unknown',channel:m.channel_name||'unknown',mentioner:m.mentioner_name||'?',preview:m.msg_preview||'...'})
      ).join('\n\n');
    }
    const mentPayload={
      flags:IS_CV2,
      components:[{
        type:17,accent_color:isOwner?OWNER_TITLE.color:title.color,
        components:[
          {type:10,content:mentionBody},
          {type:14,divider:true,spacing:1},
          {type:10,content:`-# Total: **${fmtNum(sd.points)}** snow pts  ·  **${fmtNum(sd.sessions)}** sessions ❄️`},
        ],
      }],
    };
    await sendV2(dm.id,mentPayload).catch(()=>{});
  } catch(e){
    console.error('[DM] Could not send to',discordUser.id,':',e.message);
  }
}

/** Handle timer expiry for timed AFK */
async function handleTimerExpiry(userId) {
  const afkData=await DB.afkGet(userId);
  if(!afkData)return;

  const now=Date.now();
  const durationSec=Math.floor((now-afkData.started_at)/1000);
  const lang=await DB.getLang(userId);

  await DB.snowAdd(userId,durationSec,durationSec);
  await DB.afkDel(userId);
  const sd=await snowGet(userId);
  const title=getTitle(sd.points,userId);
  const isOwner=userId===OWNER_ID;

  const discordUser=await client.users.fetch(userId).catch(()=>null);
  const avatarUrl=discordUser?.displayAvatarURL({extension:'png',size:256,forceStatic:true})||'';

  let cardBuf=null;
  const fakeUser={id:userId,username:discordUser?.username||'User',displayAvatarURL:()=>avatarUrl};
  try{cardBuf=await generateTitleRevealCard(fakeUser,sd);}catch(e){console.error('[Canvas timer]',e.message);}

  try{
    if(!discordUser)throw new Error('User not found');
    const dm=await discordUser.createDM();
    const timerPayload={
      flags:IS_CV2,
      components:[{
        type:17,accent_color:isOwner?OWNER_TITLE.color:title.color,
        components:[
          {type:10,content:[
            `## ⏱️  ${t(lang,'dm.timer_title')}`,``,
            t(lang,'dm.timer_body',{duration:fmtDuration(durationSec)}),
            afkData.notify_channel?t(lang,'dm.timer_channel',{guild:afkData.notify_guild||'Unknown',channel:afkData.notify_channel}):'',
            ``,
            `> ❄️  **Snow Points earned:** \`+${fmtNum(durationSec)}\``,
            `> 💎  **Total:** ${fmtNum(sd.points)} pts`,
            `> 🏆  **Title:** ${title.name}`,
          ].filter(Boolean).join('\n')},
          {type:14,divider:true,spacing:1},
          {type:1,components:[
            {type:2,style:2,label:'❄️  Snow Card',custom_id:`snow::${userId}`},
            {type:2,style:2,label:'🏆  Titles',custom_id:`titles::${userId}`},
          ]},
        ],
      }],
    };
    await sendV2(dm.id,timerPayload).catch(()=>{});
    await sendAfkEndDM(discordUser,durationSec,lang,sd,cardBuf);

    if(afkData.notify_channel){
      const flavor=isOwner?OWNER_FLAVOR:(TITLE_FLAVOR[title.rank]??'');
      const channelPayload={
        flags:IS_CV2,
        components:[{
          type:17,accent_color:isOwner?OWNER_TITLE.color:title.color,
          components:[
            {type:9,components:[{type:10,content:[
              `## ⏱️  ${isOwner?'◈':'❄️'}  AFK Timer Expired — <@${userId}>`,``,
              `> ⏱️  **Was AFK for:** ${fmtDuration(durationSec)}`,
              `> ❄️  **Snow Points:** +${fmtNum(durationSec)}`,``,
              `**[ ${title.name.toUpperCase()} ]**\n-# *${flavor}*`,
            ].join('\n')}],accessory:{type:11,media:{url:'attachment://avatar.png'}}},
            {type:14,divider:true,spacing:1},
            {type:10,content:`-# Notified via DM 📬  ·  Snow Points added ✅`},
          ],
        }],
      };
      const avatarBuf=await fetchAvatarBuf(discordUser).catch(()=>null);
      if(avatarBuf){
        await sendV2WithAvatar(afkData.notify_channel,channelPayload,avatarBuf,null,null).catch(()=>{});
      } else {
        await sendV2(afkData.notify_channel,channelPayload).catch(()=>{});
      }
    }
  } catch(e){console.error('[Timer]',e.message);}
}

// ─── SLASH COMMANDS ───────────────────────────────────────────────────────────
const SLASH_COMMANDS=[
  new SlashCommandBuilder()
    .setName('afk').setDescription('Set yourself as AFK')
    .addStringOption(o=>o.setName('reason').setDescription('Reason for your AFK').setRequired(false))
    .addStringOption(o=>o.setName('time').setDescription('Optional timer e.g. 5m, 2h, 1d').setRequired(false))
    .addBooleanOption(o=>o.setName('global').setDescription('Global AFK (all servers) or server-only. Default: server only').setRequired(false)),
  new SlashCommandBuilder()
    .setName('snow').setDescription('View your Snow Points and rank card')
    .addUserOption(o=>o.setName('user').setDescription("Check another user's snow card").setRequired(false)),
  new SlashCommandBuilder()
    .setName('titles').setDescription('View all 50 titles and your progress'),
  new SlashCommandBuilder()
    .setName('lang').setDescription('Set your language preference')
    .addStringOption(o=>o.setName('language').setDescription('Language').setRequired(true)
      .addChoices({name:'🇺🇸 English',value:'en'},{name:'🇪🇸 Español',value:'es'},{name:'🇧🇷 Português',value:'pt'})),
].map(c=>c.toJSON());

// Anti-reaction is registered as raw JSON (not SlashCommandBuilder) because it
// uses subcommand groups with complex nested options not easily expressible via builder
const ANTI_SLASH = buildAntiReactionSlash();

// ─── COMMAND HANDLERS ─────────────────────────────────────────────────────────
async function cmdAfk({userId,guildId,guildName,reason,durationMs,isGlobal,user,channelId,messageId,isSlash,interaction}) {
  const lang=await DB.getLang(userId);
  reason=reason||'No reason given';

  const existing=await DB.afkGet(userId);
  if(existing){
    const ts=Math.floor(existing.started_at/1000);
    const msg=t(lang,'afk.already',{ts});
    if(isSlash) await slashReply(interaction,{content:msg,flags:EPHEMERAL});
    else        await sendV2(channelId,{content:msg},messageId).catch(()=>{});
    return;
  }

  const now=Date.now();
  const expiresAt=durationMs?now+durationMs:null;
  // guild_scope: 'global' for all servers, or guild_id for server-only
  const guildScope=isGlobal?'global':(guildId||'global');
  await DB.afkSet(userId,reason,now,expiresAt,channelId,guildName||'Unknown',guildScope);

  if(expiresAt){
    setTimeout(()=>handleTimerExpiry(userId),durationMs);
  }

  const sd=await snowGet(userId);
  const title=getTitle(sd.points,userId);
  const isOwner=userId===OWNER_ID;

  const [aiMsg,cardBuf,avatarBuf]=await Promise.all([
    aiAfkMessage(user.username,reason,isOwner),
    generateAfkCard(user,reason,sd,isGlobal).catch(e=>{console.error('[Canvas AFK]',e.message);return null;}),
    fetchAvatarBuf(user).catch(()=>null),
  ]);

  const payload=buildAfkSet(user,reason,now,expiresAt,sd,title,aiMsg,lang,isGlobal);

  const inject=(name)=>{
    payload.components[0].components.splice(1,0,{type:12,items:[{media:{url:`attachment://${name}`},description:`AFK: ${user.username}`}]});
  };

  if(isSlash){
    await slashDefer(interaction).catch(()=>{});
    if(cardBuf){
      inject('afk-card.png');
      await slashPatchWithAvatar(interaction,payload,avatarBuf,cardBuf,'afk-card.png')
        .catch(async()=>slashPatch(interaction,{content:`❄️ AFK — *${reason}*`}).catch(()=>{}));
    } else {
      if(avatarBuf){
        const form=new FormData();
        form.append('payload_json',JSON.stringify(payload));
        form.append('files[0]',new Blob([avatarBuf],{type:'image/png'}),'avatar.png');
        await rest.patch(Routes.webhookMessage(interaction.applicationId,interaction.token,'@original'),{body:form,passThroughBody:true}).catch(()=>slashPatch(interaction,payload).catch(()=>{}));
      } else {
        await slashPatch(interaction,payload).catch(()=>{});
      }
    }
  } else {
    if(cardBuf){
      inject('afk-card.png');
      await sendV2WithAvatar(channelId,payload,avatarBuf,cardBuf,'afk-card.png',messageId)
        .catch(()=>sendV2(channelId,payload,messageId).catch(()=>{}));
    } else {
      if(avatarBuf){
        await sendV2WithAvatar(channelId,payload,avatarBuf,null,null,messageId)
          .catch(()=>sendV2(channelId,payload,messageId).catch(()=>{}));
      } else {
        await sendV2(channelId,payload,messageId).catch(()=>{});
      }
    }
  }
}

async function cmdSnow({user,channelId,messageId,targetUser,isSlash,interaction}) {
  targetUser=targetUser??user;
  const lang=await DB.getLang(user.id);
  const sd=await snowGet(targetUser.id);
  let cardBuf;
  try{cardBuf=await generateSnowCard(targetUser,sd);}catch(e){console.error('[Canvas Snow]',e.message);}
  const payload=buildSnowMsg(targetUser,sd,lang);
  if(isSlash){
    if(cardBuf) await slashPatchFile(interaction,payload,cardBuf,'snow-card.png').catch(()=>slashPatch(interaction,{content:t(lang,'err.generic')}).catch(()=>{}));
    else        await slashPatch(interaction,{content:t(lang,'err.generic')}).catch(()=>{});
  } else {
    if(cardBuf) await sendV2File(channelId,payload,cardBuf,'snow-card.png',messageId).catch(()=>{});
    else        await sendV2(channelId,{content:t(lang,'err.generic')},messageId).catch(()=>{});
  }
}

async function cmdTitles({userId,channelId,messageId,isSlash,interaction}) {
  const lang=await DB.getLang(userId);
  const sd=await snowGet(userId); sd.user_id=userId;
  const payload=buildTitlesMsg(sd,userId,lang);
  if(isSlash) await slashPatch(interaction,payload).catch(()=>{});
  else        await sendV2(channelId,payload,messageId).catch(()=>{});
}

async function cmdLang({userId,channelId,messageId,isSlash,interaction,langArg}) {
  const lang=await DB.getLang(userId);
  if(!VALID_LANGS.includes(langArg)){
    const msg=t(lang,'lang.invalid');
    if(isSlash) await slashReply(interaction,{content:msg,flags:EPHEMERAL});
    else        await sendV2(channelId,{content:msg},messageId).catch(()=>{});
    return;
  }
  await DB.setLang(userId,langArg);
  const msg=t(langArg,'lang.set');
  if(isSlash) await slashReply(interaction,{content:msg,flags:EPHEMERAL});
  else        await sendV2(channelId,{content:msg},messageId).catch(()=>{});
}

// ─── AFK RETURN HANDLER ───────────────────────────────────────────────────────
async function handleReturn(message) {
  const userId=message.author.id;
  const afkData=await DB.afkGet(userId);
  if(!afkData)return false;

  // Check if this AFK applies to the current guild
  const isGlobal = afkData.guild_scope === 'global';
  const isThisGuild = afkData.guild_scope === message.guild?.id;
  if (!isGlobal && !isThisGuild) return false;

  const now=Date.now();
  const durationSec=Math.floor((now-afkData.started_at)/1000);
  const mentions=afkData.mentions;
  const isOwner=userId===OWNER_ID;
  const lang=await DB.getLang(userId);

  await DB.snowAdd(userId,durationSec,durationSec);
  await DB.afkDel(userId);
  const sd=await snowGet(userId);

  const [aiMsg,returnCardBuf,titleCardBuf,avatarBuf]=await Promise.all([
    aiReturnMessage(message.author.username,fmtDuration(durationSec),mentions,isOwner),
    generateReturnCard(message.author,durationSec,mentions,sd).catch(e=>{console.error('[Canvas Return]',e.message);return null;}),
    generateTitleRevealCard(message.author,sd).catch(e=>{console.error('[Canvas Title]',e.message);return null;}),
    fetchAvatarBuf(message.author).catch(()=>null),
  ]);

  const payload=buildAfkReturn(message.author,durationSec,mentions,sd,aiMsg,lang);

  // Inject the return card into the message
  if(returnCardBuf){
    payload.components[0].components.splice(1,0,{type:12,items:[{media:{url:'attachment://return-card.png'},description:`${message.author.username} returned`}]});
  }

  let returnMsgId=null;
  try{
    let sent;
    if(returnCardBuf){
      sent=await sendV2WithAvatar(message.channel.id,payload,avatarBuf,returnCardBuf,'return-card.png',message.id);
    } else if(avatarBuf){
      sent=await sendV2WithAvatar(message.channel.id,payload,avatarBuf,null,null,message.id);
    } else {
      sent=await sendV2(message.channel.id,payload,message.id);
    }
    returnMsgId=sent?.id??null;
  }catch(e){
    console.error('[Return send]',e.message);
  }

  const channelId=message.channel.id;

  // After 10 seconds, update message with title reveal card
  setTimeout(async()=>{
    const titlePayload=buildTitleRevealMsg(message.author,sd);
    if(returnMsgId){
      if(titleCardBuf){
        await editV2WithFile(channelId,returnMsgId,titlePayload,titleCardBuf,'title-reveal.png');
      } else {
        await editV2(channelId,returnMsgId,titlePayload);
      }
    } else {
      if(titleCardBuf){
        await sendV2File(channelId,titlePayload,titleCardBuf,'title-reveal.png').catch(()=>sendV2(channelId,titlePayload).catch(()=>{}));
      } else {
        await sendV2(channelId,titlePayload).catch(()=>{});
      }
    }
    await sendAfkEndDM(message.author,durationSec,lang,sd,titleCardBuf);
  }, 10_000);

  return true;
}

// ─── AI CHAT HANDLER ──────────────────────────────────────────────────────────
async function handleAiChat(message, botId) {
  let userMsg=message.content
    .replace(new RegExp(`<@!?${botId}>`,'g'),'')
    .replace(/^glacian[,!\s]*/i,'')
    .trim();
  if(!userMsg)userMsg='Hey!';
  message.channel.sendTyping().catch(()=>{});
  const response=await aiChatResponse(message.author.id,message.author.username,userMsg);
  if(!response)return;
  await message.reply({content:response,allowedMentions:{repliedUser:false}}).catch(()=>
    sendV2(message.channel.id,{content:response},message.id).catch(()=>{})
  );
}

// ─── DISCORD CLIENT ───────────────────────────────────────────────────────────
const client=new Client({
  intents:[
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials:[Partials.Message,Partials.Channel,Partials.Reaction],
});

client.once(Events.ClientReady,async c=>{
  console.log(`\n❄️  Glacian online as ${c.user.tag}`);
  console.log(`   Prefix: ${PREFIX}  |  Slash: /`);
  console.log(`   Commands: afk · snow · titles · lang · anti reaction\n`);

  await initDB();
  initAntiReaction(process.env.DISCORD_TOKEN, c.user.id);

  try{
    await rest.put(Routes.applicationCommands(c.user.id),{body:[...SLASH_COMMANDS, ANTI_SLASH]});
    console.log('✅  Slash commands registered globally (incl. /anti reaction).');
  }catch(e){console.error('❌  Slash register error:',e.message);}

  // Recover timed AFKs after restart
  const timed=await DB.getTimedAfks();
  let recovered=0;
  for(const row of timed){
    const remaining=row.expires_at-Date.now();
    if(remaining>0){
      setTimeout(()=>handleTimerExpiry(row.user_id),remaining);
      recovered++;
    } else {
      setImmediate(()=>handleTimerExpiry(row.user_id));
      recovered++;
    }
  }
  if(recovered>0)console.log(`⏱️   Recovered ${recovered} timed AFK timer(s).`);

  // Status loop
  const updateStatus=async()=>{
    const n=await DB.afkCount();
    const label=n===1?`1 person AFK ❄️`:`${n} people AFK ❄️`;
    c.user.setActivity(label,{type:ActivityType.Watching});
  };
  await updateStatus();
  setInterval(updateStatus,60_000);
});

// ─── MESSAGE HANDLER ──────────────────────────────────────────────────────────
client.on(Events.MessageCreate,async message=>{
  if(!message.guild||message.author.bot)return;

  const userId=message.author.id;
  const content=message.content;
  const lc=content.toLowerCase().trim();
  const botId=client.user?.id;

  const isReplyToBot=message.reference?.messageId&&(()=>{
    const ref=message.channel.messages?.cache?.get(message.reference.messageId);
    return ref?.author?.id===botId;
  })();

  // 1. Auto-remove AFK if user writes (not an AFK command)
  const selfAfk=await DB.afkGet(userId);
  if(selfAfk){
    const isAfkCmd=/^gn\s+afk(\s|$)/i.test(lc);
    if(!isAfkCmd){
      const returned=await handleReturn(message);
      if(returned)return;
    }
  }

  // 2. Mention detection — respects guild scope
  if(message.mentions.users.size>0){
    for(const [,mentioned] of message.mentions.users){
      if(mentioned.bot||mentioned.id===userId)continue;
      // Use afkGetForGuild — only fires if the AFK applies to this guild
      const afkData=await DB.afkGetForGuild(mentioned.id, message.guild.id);
      if(!afkData)continue;
      await DB.afkMention(mentioned.id);
      const updated=await DB.afkGet(mentioned.id);
      await DB.mentionLog(
        mentioned.id,userId,message.author.username,
        message.channel.id,message.channel.name||'unknown',
        message.guild.name||'Unknown',content.slice(0,200)
      );
      try{
        const member=await message.guild.members.fetch(mentioned.id).catch(()=>null);
        const dispUser=member?.user??mentioned;
        const lang=await DB.getLang(mentioned.id);
        const elapsed=Math.floor((Date.now()-afkData.started_at)/1000);
        const mentionCount=updated?.mentions??1;

        const [mentionCardBuf, avatarBuf]=await Promise.all([
          generateMentionCard(dispUser, afkData.reason, afkData.started_at, elapsed, mentionCount).catch(()=>null),
          fetchAvatarBuf(dispUser).catch(()=>null),
        ]);

        const mentionPayload=buildAfkMention(dispUser,afkData,mentionCount,lang);

        if(mentionCardBuf){
          mentionPayload.components[0].components.splice(1,0,{type:12,items:[{media:{url:'attachment://mention-card.png'},description:'AFK user'}]});
          if(avatarBuf){
            await sendV2WithAvatar(message.channel.id,mentionPayload,avatarBuf,mentionCardBuf,'mention-card.png',message.id);
          } else {
            await sendV2File(message.channel.id,mentionPayload,mentionCardBuf,'mention-card.png',message.id).catch(()=>{});
          }
        } else if(avatarBuf){
          await sendV2WithAvatar(message.channel.id,mentionPayload,avatarBuf,null,null,message.id);
        } else {
          mentionPayload.components[0].components[0].accessory.media.url=
            dispUser.displayAvatarURL({extension:'png',size:256,forceStatic:true});
          await sendV2(message.channel.id,mentionPayload,message.id);
        }
      }catch(e){console.error('[Mention]',e.message);}
    }
  }

  // 3. AI Chat
  const botMention=botId&&content.trimStart().match(new RegExp(`^<@!?${botId}>`));
  const glacianStart=/^glacian\b/i.test(lc);
  if((botMention||glacianStart||isReplyToBot)&&!/^gn\s+\S+/i.test(lc)){
    await handleAiChat(message,botId); return;
  }

  // 4. Prefix commands
  const prefixMatch=content.match(/^gn\s+(\S+)(.*)?$/i);
  if(!prefixMatch)return;
  const cmd=prefixMatch[1].toLowerCase();
  const args=(prefixMatch[2]??'').trim();

  const ctx={
    userId,guildId:message.guild.id,guildName:message.guild.name,
    user:message.author,channelId:message.channel.id,
    messageId:message.id,isSlash:false,interaction:null,
    isGlobal:false,
  };

  if(cmd==='afk'){
    const words=args.split(/\s+/);
    const lastWord=words[words.length-1];
    const ms=parseDuration(lastWord);
    if(ms&&words.length>1){ctx.reason=words.slice(0,-1).join(' ');ctx.durationMs=ms;}
    else if(ms&&words.length===1){ctx.reason='No reason given';ctx.durationMs=ms;}
    else{ctx.reason=args||'No reason given';ctx.durationMs=null;}
    await cmdAfk(ctx);
  } else if(cmd==='snow'){
    ctx.targetUser=message.mentions.users.first()??message.author;
    await cmdSnow(ctx);
  } else if(cmd==='titles'){
    await cmdTitles(ctx);
  } else if(cmd==='lang'){
    ctx.langArg=args.trim().toLowerCase();
    await cmdLang(ctx);
  }
});

// ─── INTERACTION HANDLER ──────────────────────────────────────────────────────
client.on(Events.InteractionCreate,async interaction=>{

  // ── Anti-Reaction buttons ──────────────────────────────────────────────────
  if(interaction.isButton()&&interaction.customId?.startsWith('ar::')){
    await handleAntiReactionInteraction(interaction,client);
    return;
  }

  // ── Anti-Reaction select menus (future-proofing) ──────────────────────────
  if(interaction.isStringSelectMenu()&&interaction.customId?.startsWith('ar::')){
    await handleAntiReactionInteraction(interaction,client);
    return;
  }

  if(interaction.isButton()){
    const [action,targetId]=interaction.customId.split('::');
    if(action==='snow'){
      let targetUser;
      try{targetUser=await client.users.fetch(targetId);}
      catch{await slashButtonReply(interaction,{content:'❌ User not found.',flags:EPHEMERAL});return;}
      const sd=await snowGet(targetUser.id);
      let buf; try{buf=await generateSnowCard(targetUser,sd);}catch{}
      const lang=await DB.getLang(interaction.user.id);
      const p=buildSnowMsg(targetUser,sd,lang); p.flags=IS_CV2|EPHEMERAL;
      if(buf) await slashButtonFile(interaction,p,buf,'snow-card.png').catch(()=>slashButtonReply(interaction,{content:'❌ Error.',flags:EPHEMERAL}).catch(()=>{}));
      else    await slashButtonReply(interaction,{content:'❌ Error.',flags:EPHEMERAL}).catch(()=>{});
    } else if(action==='titles'){
      const sd=await snowGet(targetId); sd.user_id=targetId;
      const lang=await DB.getLang(interaction.user.id);
      const p=buildTitlesMsg(sd,targetId,lang); p.flags=IS_CV2|EPHEMERAL;
      await slashButtonReply(interaction,p).catch(()=>{});
    }
    return;
  }

  if(!interaction.isChatInputCommand())return;
  const userId=interaction.user.id;
  const lang=await DB.getLang(userId);

  // ── Anti-Reaction slash command ────────────────────────────────────────────
  if(interaction.commandName==='anti'){
    await handleAntiReactionCommand(interaction,client);
    return;
  }

  const ctx={
    userId,guildId:interaction.guild?.id??'DM',guildName:interaction.guild?.name,
    user:interaction.user,channelId:interaction.channel?.id,
    messageId:null,isSlash:true,interaction,isGlobal:false,
  };

  if(interaction.commandName==='afk'){
    await slashDefer(interaction).catch(()=>{});
    ctx.reason=interaction.options.getString('reason')??'No reason given';
    const timeStr=interaction.options.getString('time');
    ctx.durationMs=timeStr?parseDuration(timeStr):null;
    ctx.isGlobal=interaction.options.getBoolean('global')??false;
    await cmdAfk(ctx);
  } else if(interaction.commandName==='snow'){
    await slashDefer(interaction).catch(()=>{});
    ctx.targetUser=interaction.options.getUser('user')??interaction.user;
    await cmdSnow(ctx);
  } else if(interaction.commandName==='titles'){
    await slashDefer(interaction).catch(()=>{});
    await cmdTitles(ctx);
  } else if(interaction.commandName==='lang'){
    ctx.langArg=interaction.options.getString('language');
    await cmdLang(ctx);
  }
});

// ─── REACTION ADD HANDLER ─────────────────────────────────────────────────────
client.on(Events.MessageReactionAdd,async(reaction,user)=>{
  await handleReactionAdd(reaction,user,client);
});

// ─── ERROR GUARDS ─────────────────────────────────────────────────────────────
process.on('unhandledRejection',err=>{
  if(err?.code===10062||err?.code===10008)return;
  console.error('[Unhandled]',err?.message??err);
});
process.on('uncaughtException',err=>console.error('[Exception]',err));


// ─── WEB SERVER (see web.js) ────────────────────────────────────────────────
// The landing page, terms, privacy and health endpoint live in web.js
startWebServer();

// ─── START ────────────────────────────────────────────────────────────────────
if (!process.env.DISCORD_TOKEN) {
  console.error('❌  DISCORD_TOKEN not set. Add it to your environment variables.');
  process.exit(1);
}

initEmojiFont().then(() => client.login(process.env.DISCORD_TOKEN));
