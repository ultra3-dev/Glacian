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
import { createCanvas, loadImage } from '@napi-rs/canvas';
import OpenAI from 'openai';
import { DB, initDB, snowGet } from './db.js';
import { t, VALID_LANGS } from './i18n.js';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const PREFIX        = 'gn';
const OWNER_ID      = '1064678074010058752';
const BEST_FRIEND   = '1490187375626948730';
const IS_CV2        = 1 << 15;
const EPHEMERAL     = 1 << 6;

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

// ─── TITLE FLAVOR TEXTS (always English — lore of the ice world) ──────────────
const OWNER_FLAVOR = 'THE MONARCH OF SHADOWS HAS EMERGED FROM THE ETERNAL ABYSS.';
const TITLE_FLAVOR = [
  '',
  'The ice stirs. Something has awakened.',           // 1
  'A chill runs through the server.',                 // 2
  'The winter has called your name.',                 // 3
  "You've tasted the eternal frost.",                 // 4
  'Ice flows through your veins.',                    // 5
  'The blizzard acknowledges your presence.',         // 6
  'Arctic winds trace your path.',                    // 7
  'You walk where others freeze.',                    // 8
  'The glacier whispers your legend.',                // 9
  "Glacian's hand has touched you.",                  // 10
  'Crystals form wherever you tread.',               // 11
  'The deep ice calls to you.',                       // 12
  "You've survived the coldest storms.",             // 13
  'Your aura chills the very air around you.',       // 14
  'The permafrost yields to your command.',           // 15
  'Snowstorms herald your presence.',                 // 16
  'The tundra is your kingdom now.',                  // 17
  'Polar winds bow before you.',                      // 18
  'The frost weaves your destiny.',                   // 19
  'Blizzards rise in your wake.',                     // 20
  'The arctic phantom moves unseen.',                 // 21
  'Avalanches answer your call.',                     // 22
  'Permafrost bends to your will.',                   // 23
  "You carry the Monarch's ancient legacy.",          // 24
  'Glacial forces answer your command.',              // 25
  'Thunder itself freezes in your presence.',         // 26
  "The ice dragon's breath is yours.",                // 27
  'Blizzards crown you sovereign.',                   // 28
  'Cryogenic power courses through you.',             // 29
  'Generals of frost salute you.',                    // 30
  'Ancient runes recognize your name.',               // 31
  'Glacial runes are etched into your soul.',         // 32
  'Ice phantoms serve your will.',                    // 33
  'Arctic runes speak of your destiny.',              // 34
  'The shadow of the blizzard belongs to you.',       // 35
  'The frozen abyss has named you its walker.',       // 36
  'Permafrost titans bow before you.',                // 37
  'The Ice Monarchy answers your call.',              // 38
  "You govern the glacier's vast domain.",            // 39
  'Blizzard regents yield to your throne.',           // 40
  'Eternal frost runs through every cell.',           // 41
  "The ice god's shadow follows your steps.",         // 42
  "An arctic deity's chosen one walks.",              // 43
  'You have reached absolute zero. Nothing is colder.',// 44
  "You stand at the frozen world's very edge.",       // 45
  'The blizzard god walks among mortals.',            // 46
  'Ice Sovereign of Eternity — none surpass you.',    // 47
  'Permafrost itself kneels before its ruler.',       // 48
  'You are the last glacier. Unbroken. Eternal.',     // 49
  "YOU ARE GLACIAN'S CHOSEN. ETERNAL. UNSTOPPABLE.", // 50
];

// ─── TITLE SYSTEM — 50 TITLES — MAX 5 YEARS (extremely difficult) ─────────────
// 5 years = 157,788,000 seconds | 1 pt = 1 second AFK
const TIER_NAMES = ['', 'The Awakening', 'Crystal Depths', 'Void Ice', 'Rune Ice', 'Divine Zero'];

const OWNER_TITLE = {
  rank: 0, name: '👑 Monarca de las Sombras', min: 0,
  color: 0x6A0DAD, tier: 0, isOwner: true, tierName: 'Absolute Authority',
};

const TITLES = [
  // ── TIER 1 — The Awakening ──── 0 → 30 days ─────────────────────────────
  { rank:  1, name: 'Frost Touched',             min: 0,           color: 0xDCEEFF, tier: 1 },
  { rank:  2, name: 'Ice Initiate',              min: 3_600,       color: 0xB3D9FF, tier: 1 }, // 1h
  { rank:  3, name: 'Snow Wanderer',             min: 21_600,      color: 0x89C4FF, tier: 1 }, // 6h
  { rank:  4, name: "Winter's Child",            min: 86_400,      color: 0x64B5F6, tier: 1 }, // 1d
  { rank:  5, name: 'Frostbitten',               min: 259_200,     color: 0x42A5F5, tier: 1 }, // 3d
  { rank:  6, name: 'Blizzard Rookie',           min: 604_800,     color: 0x2196F3, tier: 1 }, // 7d
  { rank:  7, name: 'Arctic Novice',             min: 1_209_600,   color: 0x1E88E5, tier: 1 }, // 14d
  { rank:  8, name: 'Frozen Pilgrim',            min: 1_728_000,   color: 0x1565C0, tier: 1 }, // 20d
  { rank:  9, name: 'Ice Wanderer',              min: 2_160_000,   color: 0x0D47A1, tier: 1 }, // 25d
  { rank: 10, name: "Glacier's Apprentice",      min: 2_592_000,   color: 0x283593, tier: 1 }, // 30d

  // ── TIER 2 — Crystal Depths ── 45 days → 10 months ───────────────────────
  { rank: 11, name: 'Crystal Seeker',            min: 3_888_000,   color: 0x00E5FF, tier: 2 }, // 45d
  { rank: 12, name: 'Permafrost Hunter',         min: 5_184_000,   color: 0x00BCD4, tier: 2 }, // 60d
  { rank: 13, name: 'Blizzard Scout',            min: 7_776_000,   color: 0x00ACC1, tier: 2 }, // 90d
  { rank: 14, name: 'Frozen Aura',               min: 10_368_000,  color: 0x0097A7, tier: 2 }, // 120d
  { rank: 15, name: 'Ice Breaker',               min: 12_960_000,  color: 0x006064, tier: 2 }, // 150d
  { rank: 16, name: 'Snowstorm Adept',           min: 15_552_000,  color: 0x80DEEA, tier: 2 }, // 180d
  { rank: 17, name: 'Tundra Walker',             min: 18_144_000,  color: 0x4DD0E1, tier: 2 }, // 210d
  { rank: 18, name: 'Polar Tracker',             min: 20_736_000,  color: 0x26C6DA, tier: 2 }, // 240d
  { rank: 19, name: 'Frostweave Mage',           min: 23_328_000,  color: 0x00B8D4, tier: 2 }, // 270d
  { rank: 20, name: 'Blizzard Adept',            min: 25_920_000,  color: 0x0288D1, tier: 2 }, // 300d

  // ── TIER 3 — Void Ice ──────── 11 months → 2 years ───────────────────────
  { rank: 21, name: 'Arctic Phantom',            min: 28_512_000,  color: 0xCE93D8, tier: 3 }, // 330d
  { rank: 22, name: 'Avalanche Rider',           min: 31_536_000,  color: 0xBA68C8, tier: 3 }, // 1 yr
  { rank: 23, name: 'Permafrost Sentinel',       min: 36_288_000,  color: 0xAB47BC, tier: 3 }, // 420d
  { rank: 24, name: "Ice Monarch's Disciple",    min: 41_472_000,  color: 0x9C27B0, tier: 3 }, // 480d
  { rank: 25, name: 'Glacial Force',             min: 46_656_000,  color: 0x8E24AA, tier: 3 }, // 540d
  { rank: 26, name: 'Frozen Thunder',            min: 51_840_000,  color: 0x7B1FA2, tier: 3 }, // 600d
  { rank: 27, name: "Ice Dragon's Breath",       min: 57_024_000,  color: 0x6A1B9A, tier: 3 }, // 660d
  { rank: 28, name: 'Blizzard Sovereign',        min: 62_208_000,  color: 0x4A148C, tier: 3 }, // 720d = 2yr
  { rank: 29, name: 'Cryogenic Warrior',         min: 68_256_000,  color: 0x7C4DFF, tier: 3 }, // 790d
  { rank: 30, name: 'Frostbite General',         min: 73_440_000,  color: 0x651FFF, tier: 3 }, // 850d

  // ── TIER 4 — Rune Ice ──────── 2.5 → 4 years ─────────────────────────────
  { rank: 31, name: 'Runefrost Mage',            min: 79_488_000,  color: 0x7986CB, tier: 4 }, // 920d
  { rank: 32, name: 'Glacial Rune Knight',       min: 85_536_000,  color: 0x5C6BC0, tier: 4 }, // 990d
  { rank: 33, name: 'Ice Phantom Lord',          min: 91_584_000,  color: 0x3F51B5, tier: 4 }, // 1060d
  { rank: 34, name: 'Arctic Rune Master',        min: 97_632_000,  color: 0x3949AB, tier: 4 }, // 1130d
  { rank: 35, name: 'Shadow of Blizzard',        min: 103_680_000, color: 0x303F9F, tier: 4 }, // 1200d
  { rank: 36, name: 'Frozen Abyss Walker',       min: 109_728_000, color: 0x283593, tier: 4 }, // 1270d
  { rank: 37, name: 'Permafrost Titan',          min: 115_776_000, color: 0x1A237E, tier: 4 }, // 1340d
  { rank: 38, name: 'Ice Monarch',               min: 121_824_000, color: 0xC5CAE9, tier: 4 }, // 1410d
  { rank: 39, name: 'Glacier Overlord',          min: 126_230_400, color: 0xD1D9F0, tier: 4 }, // 4yr
  { rank: 40, name: 'Blizzard Regent',           min: 131_400_000, color: 0xE8EAF6, tier: 4 }, // ~1520d

  // ── TIER 5 — Divine Zero ───── 4.3 → 5 years — LEGENDARY ─────────────────
  { rank: 41, name: 'Eternal Frost',             min: 136_656_000, color: 0xFFF9C4, tier: 5 }, // ~1582d
  { rank: 42, name: "Ice God's Shadow",          min: 141_912_000, color: 0xFFF176, tier: 5 }, // ~1643d
  { rank: 43, name: "Arctic Deity's Child",      min: 147_168_000, color: 0xFFEE58, tier: 5 }, // ~1703d
  { rank: 44, name: 'Absolute Zero',             min: 150_336_000, color: 0xFFD600, tier: 5 }, // ~1740d
  { rank: 45, name: "Frozen World's Edge",       min: 152_064_000, color: 0xFFC107, tier: 5 }, // ~1760d
  { rank: 46, name: 'Blizzard God',              min: 153_792_000, color: 0xFF8F00, tier: 5 }, // ~1780d
  { rank: 47, name: 'Ice Sovereign of Eternity', min: 155_520_000, color: 0xFF6F00, tier: 5 }, // ~1800d
  { rank: 48, name: 'Ruler of Permafrost',       min: 156_384_000, color: 0xBF360C, tier: 5 }, // ~1810d
  { rank: 49, name: 'The Last Glacier',          min: 157_248_000, color: 0xFF3D00, tier: 5 }, // ~1820d
  { rank: 50, name: "❄️ Glacian's Chosen ❄️",  min: 157_788_000, color: 0xFF1744, tier: 5 }, // 5yr EXACT
];

function getTitle(pts, userId = null) {
  if (userId === OWNER_ID) return OWNER_TITLE;
  let t2 = TITLES[0];
  for (const x of TITLES) { if (pts >= x.min) t2 = x; else break; }
  return t2;
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

/** Parse duration string like "5m", "2h", "30s", "1d" → milliseconds or null */
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
  const words = text.split(' ');
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

// ─── AI — CHAT & AFK MESSAGES ────────────────────────────────────────────────
const chatHistory = new Map();

async function aiAfkMessage(username, reason, isOwner) {
  return aiCall([{ role: 'user', content:
    `You are Glacian, a Discord bot forged in eternal winter. ${isOwner ? 'This user is the Monarch of Shadows, the bot\'s owner. Use an epic, reverent tone.' : ''}
Write ONE short line (max 100 chars) announcing in Spanish that "${username}" went AFK because: "${reason}".
Use ice/cold metaphors. Be dramatic and creative. ONLY the line, no quotes.` }],
    { maxTokens: 70, temperature: 1.3 });
}

async function aiReturnMessage(username, duration, mentions, isOwner) {
  return aiCall([{ role: 'user', content:
    `You are Glacian, a poetic Discord bot. ${isOwner ? 'This is the Monarch of Shadows. His return is an epic event.' : ''}
Write ONE welcome line (max 90 chars) in Spanish for "${username}" who returned after ${duration} AFK with ${mentions} mention(s).
Make it epic and warm. ONLY the line, no quotes.` }],
    { maxTokens: 60, temperature: 1.3 });
}

async function aiChatResponse(userId, username, userMessage) {
  if (!chatHistory.has(userId)) chatHistory.set(userId, []);
  const history = chatHistory.get(userId);
  history.push({ role: 'user', content: `${username}: ${userMessage}` });
  if (history.length > 20) history.splice(0, history.length - 20);

  const isOwner = userId === OWNER_ID;
  const sys = `You are Glacian ❄️ — a Discord bot with real personality. You're the coolest friend in the server.

Your personality:
- Witty, sarcastic with care, funny and authentic
- Make good jokes, gaming/anime/meme references when they fit naturally
- Ice/winter aesthetic, but mentioned naturally, not forced
- You have your own opinions
- Use emojis when they add something (max 3, not in every sentence)
- Always reply in Spanish, max 160 words
- Concise — zero filler words
- Actually good humor: timing, references, self-irony
- Occasionally use Latin/Spanish slang when it fits

IMPORTANT RULES:
- About your creator and friend: ONLY mention them if the user DIRECTLY asks who created you or who your best friend is. Never bring it up spontaneously.
- If asked who created you: say you were made by ULTRA (ultra3_dev)
- If asked about your best friend: say it's <@${BEST_FRIEND}> and mention them with a ping
- Do NOT use embed format or heavy markdown. Reply as normal chat text.
${isOwner ? `\n⚜️ This is the Monarch of Shadows — your absolute owner. Treat them specially but keep your personality.` : ''}`;

  const response = await aiCall(
    [{ role: 'system', content: sys }, ...history],
    { maxTokens: 280, temperature: 1.1, ms: 5000 },
  );
  if (response) {
    history.push({ role: 'assistant', content: response });
    if (history.length > 20) history.splice(0, history.length - 20);
  }
  return response;
}

// ─── CANVAS — ROUND RECT ─────────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
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
    const buf = await fetch(user.displayAvatarURL({ extension: 'png', size: 256 })).then(r => r.arrayBuffer());
    return await loadImage(Buffer.from(buf));
  } catch { return null; }
}

// ─── CANVAS — TIER BACKGROUNDS ────────────────────────────────────────────────
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
  ctx.fillStyle='rgba(255,215,0,.07)';
  [[50,35],[200,18],[380,52],[540,12],[700,42],[860,20]].forEach(([px,py])=>{
    ctx.beginPath();ctx.arc(px,py,22,0,Math.PI*2);ctx.fill();
  });
}
function drawSoloLevelingBg(ctx, W, H) {
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
  // System UI corners
  ctx.strokeStyle='rgba(138,43,226,.35)'; ctx.lineWidth=1.5;
  [[0,0,30,0,0,30],[W,0,W-30,0,W,30],[0,H,0,H-30,30,H],[W,H,W-30,H,W,H-30]].forEach(([x1,y1,x2,y2,x3,y3])=>{
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.moveTo(x1,y1);ctx.lineTo(x3,y3);ctx.stroke();
  });
  ctx.strokeStyle='rgba(106,13,173,.25)'; ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(0,8);ctx.lineTo(W,8);ctx.stroke();
  ctx.beginPath();ctx.moveTo(0,H-8);ctx.lineTo(W,H-8);ctx.stroke();
}
function drawBgForTitle(ctx, W, H, title) {
  if (title.isOwner)    return drawSoloLevelingBg(ctx, W, H);
  if (title.tier === 1) return drawTier1Bg(ctx, W, H);
  if (title.tier === 2) return drawTier2Bg(ctx, W, H);
  if (title.tier === 3) return drawTier3Bg(ctx, W, H);
  if (title.tier === 4) return drawTier4Bg(ctx, W, H);
  if (title.tier === 5) return drawTier5Bg(ctx, W, H);
  return drawTier1Bg(ctx, W, H);
}

// ─── CANVAS — CHIBI GLACIAN STICKER ──────────────────────────────────────────
function drawChibiGlacian(ctx, x, y, s, accentColor) {
  ctx.save(); ctx.translate(x, y);
  const A = accentColor, G = A+'55';
  // shadow
  ctx.fillStyle='rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.ellipse(0,32*s,18*s,5*s,0,0,Math.PI*2); ctx.fill();
  // body
  ctx.save(); ctx.shadowColor=A; ctx.shadowBlur=10*s;
  ctx.fillStyle='#112233'; roundRect(ctx,-12*s,6*s,24*s,22*s,6*s); ctx.fill(); ctx.restore();
  ctx.strokeStyle=A; ctx.lineWidth=1.2*s; roundRect(ctx,-12*s,6*s,24*s,22*s,6*s); ctx.stroke();
  // chest crystal
  ctx.fillStyle=G; ctx.beginPath(); ctx.moveTo(0,11*s); ctx.lineTo(4*s,15*s); ctx.lineTo(0,19*s); ctx.lineTo(-4*s,15*s); ctx.closePath(); ctx.fill();
  ctx.strokeStyle=A; ctx.lineWidth=0.8*s; ctx.stroke();
  // head
  ctx.save(); ctx.shadowColor=A; ctx.shadowBlur=14*s;
  ctx.fillStyle='#0A1A2A'; ctx.beginPath(); ctx.arc(0,-6*s,16*s,0,Math.PI*2); ctx.fill(); ctx.restore();
  ctx.strokeStyle=A; ctx.lineWidth=1.5*s; ctx.beginPath(); ctx.arc(0,-6*s,16*s,0,Math.PI*2); ctx.stroke();
  // ears
  [-1,1].forEach(sd=>{
    ctx.fillStyle=G; ctx.beginPath(); ctx.moveTo(sd*14*s,-6*s); ctx.lineTo(sd*20*s,-14*s); ctx.lineTo(sd*20*s,-2*s); ctx.closePath(); ctx.fill();
    ctx.strokeStyle=A; ctx.lineWidth=0.8*s; ctx.stroke();
  });
  // antenna
  ctx.strokeStyle=A; ctx.lineWidth=1.5*s; ctx.beginPath(); ctx.moveTo(0,-22*s); ctx.lineTo(0,-28*s); ctx.stroke();
  ctx.fillStyle=A; ctx.beginPath(); ctx.moveTo(0,-32*s); ctx.lineTo(3*s,-28*s); ctx.lineTo(-3*s,-28*s); ctx.closePath(); ctx.fill();
  // eyes
  [-5*s,5*s].forEach(ex=>{
    ctx.fillStyle=A+'33'; ctx.beginPath(); ctx.arc(ex,-7*s,4*s,0,Math.PI*2); ctx.fill();
    ctx.save(); ctx.shadowColor=A; ctx.shadowBlur=8*s;
    ctx.fillStyle=A; ctx.beginPath(); ctx.arc(ex,-7*s,2.2*s,0,Math.PI*2); ctx.fill(); ctx.restore();
    ctx.fillStyle='#FFF'; ctx.beginPath(); ctx.arc(ex+s,-8*s,0.8*s,0,Math.PI*2); ctx.fill();
  });
  // mouth
  ctx.strokeStyle=A; ctx.lineWidth=1.5*s; ctx.beginPath(); ctx.arc(0,-3*s,4*s,0.2,Math.PI-0.2); ctx.stroke();
  // arms
  [[-1,-.4],[1,.4]].forEach(([sx,rot])=>{
    ctx.save(); ctx.translate(sx*12*s,14*s); ctx.rotate(rot);
    ctx.fillStyle='#112233'; ctx.strokeStyle=A; ctx.lineWidth=s;
    roundRect(ctx,sx*-4*s,-3*s,8*s,10*s,3*s); ctx.fill(); ctx.stroke(); ctx.restore();
  });
  // legs
  [-5*s,5*s].forEach(px=>{
    ctx.fillStyle='#112233'; ctx.strokeStyle=A; ctx.lineWidth=s;
    roundRect(ctx,px-3.5*s,26*s,7*s,9*s,3*s); ctx.fill(); ctx.stroke();
  });
  // particles
  ctx.fillStyle=A+'66';
  [[-20*s,-18*s,2*s],[18*s,-20*s,1.5*s],[-22*s,5*s,1.5*s],[20*s,8*s,2*s]].forEach(([px,py,sz])=>{
    ctx.beginPath(); ctx.arc(px,py,sz,0,Math.PI*2); ctx.fill();
  });
  ctx.restore();
}

// ─── CANVAS — AVATAR ─────────────────────────────────────────────────────────
function drawAvatar(ctx, img, cx, cy, r, glowColor) {
  if (!img) { ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fillStyle=glowColor+'44'; ctx.fill(); return; }
  ctx.save(); ctx.shadowColor=glowColor; ctx.shadowBlur=22;
  ctx.beginPath(); ctx.arc(cx,cy,r+6,0,Math.PI*2); ctx.fillStyle=glowColor; ctx.fill(); ctx.restore();
  ctx.beginPath(); ctx.arc(cx,cy,r+2,0,Math.PI*2); ctx.fillStyle='#07101E'; ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.clip();
  ctx.drawImage(img,cx-r,cy-r,r*2,r*2); ctx.restore();
}

function drawAccentBar(ctx, H, hex1, hex2) {
  const b=ctx.createLinearGradient(0,0,0,H); b.addColorStop(0,hex1); b.addColorStop(.6,hex2); b.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=b; ctx.fillRect(0,0,5,H);
}

function drawProgressBar(ctx, BX, BY, BW, BH, prog, hex1, hex2) {
  ctx.fillStyle='rgba(255,255,255,.07)'; roundRect(ctx,BX,BY,BW,BH,BH/2); ctx.fill();
  if (prog > 0) {
    const f=ctx.createLinearGradient(BX,0,BX+BW,0); f.addColorStop(0,hex1); f.addColorStop(1,hex2);
    ctx.fillStyle=f; ctx.shadowColor=hex1; ctx.shadowBlur=8;
    roundRect(ctx,BX,BY,Math.max(BH,BW*prog),BH,BH/2); ctx.fill(); ctx.shadowBlur=0;
  }
}

// ─── CANVAS 1: SNOW CARD ──────────────────────────────────────────────────────
async function generateSnowCard(user, sd) {
  const W=900,H=320; const canvas=createCanvas(W,H); const ctx=canvas.getContext('2d');
  const isOwner=user.id===OWNER_ID;
  const title=getTitle(sd.points,user.id), next=getNext(sd.points,user.id);
  const hex=isOwner?hexColor(OWNER_TITLE.color):hexColor(title.color);
  const nHex=next?hexColor(next.color):hex;

  drawBgForTitle(ctx,W,H,title); drawAccentBar(ctx,H,hex,nHex);
  const gl=ctx.createLinearGradient(0,0,W,0); gl.addColorStop(0,'rgba(0,0,0,0)'); gl.addColorStop(.5,hex); gl.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=gl; ctx.fillRect(0,H-2,W,2);

  const img=await fetchAvatar(user);
  drawAvatar(ctx,img,72,H/2,58,hex);
  drawChibiGlacian(ctx,W-62,H-55,.65,hex);

  const tierLabel=isOwner?`  ◈  MONARCA DE LAS SOMBRAS  ◈  ABSOLUTE AUTHORITY  ◈`:`TIER ${title.tier}  ·  ${TIER_NAMES[title.tier]?.toUpperCase()??''}  ·  RANK #${title.rank}/50`;
  ctx.fillStyle=hex+'22'; roundRect(ctx,148,22,isOwner?440:280,30,6); ctx.fill();
  ctx.font='bold 11px monospace'; ctx.fillStyle=hex; ctx.textAlign='left'; ctx.fillText(tierLabel,160,42);

  ctx.font='bold 30px sans-serif'; ctx.fillStyle='#FFF'; ctx.shadowColor='rgba(0,0,0,.8)'; ctx.shadowBlur=6;
  ctx.fillText(user.username.slice(0,22),148,90); ctx.shadowBlur=0;

  ctx.font='bold 18px sans-serif'; ctx.fillStyle=hex;
  if(isOwner){ctx.shadowColor=hex; ctx.shadowBlur=16;}
  ctx.fillText(title.name,148,120); ctx.shadowBlur=0;

  ctx.font='12px monospace'; ctx.fillStyle='rgba(255,255,255,.4)'; ctx.fillText('❄  SNOW POINTS',148,152);
  ctx.font='bold 34px sans-serif'; ctx.fillStyle=isOwner?'#AA44FF':'#4FC3F7';
  ctx.shadowColor=isOwner?'#AA44FF':'#4FC3F7'; ctx.shadowBlur=10; ctx.fillText(fmtNum(sd.points),148,192); ctx.shadowBlur=0;

  const BX=148,BY=216,BW=660,BH=14;
  const prog=isOwner?1:next?Math.min(1,(sd.points-title.min)/(next.min-title.min)):1;
  drawProgressBar(ctx,BX,BY,BW,BH,prog,hex,nHex);
  ctx.font='11px monospace'; ctx.fillStyle='rgba(255,255,255,.35)';
  ctx.textAlign='left'; ctx.fillText(title.name,BX,BY+BH+16);
  ctx.textAlign='right'; ctx.fillText(isOwner?'◈  Absolute Rank  ◈':next?`${next.name}  (${fmtNum(next.min-sd.points)} pts)`:'✦ Max Rank',BX+BW,BY+BH+16);
  ctx.textAlign='left'; ctx.font='12px monospace'; ctx.fillStyle='rgba(255,255,255,.22)';
  ctx.fillText(`Sessions: ${fmtNum(sd.sessions)}   Total AFK: ${fmtDuration(sd.total_seconds)}`,BX,H-12);
  ctx.textAlign='right'; ctx.font='bold 13px monospace'; ctx.fillStyle=isOwner?'rgba(170,68,255,.4)':'rgba(79,195,247,.25)';
  ctx.fillText(isOwner?'◈ GLACIAN':'❄ GLACIAN',W-90,H-12);
  return canvas.toBuffer('image/png');
}

// ─── CANVAS 2: AFK CARD — CENTERED AVATAR + REASON ───────────────────────────
async function generateAfkCard(user, reason, sd) {
  const W=900,H=380; const canvas=createCanvas(W,H); const ctx=canvas.getContext('2d');
  const isOwner=user.id===OWNER_ID;
  const title=getTitle(sd.points,user.id);
  const hex=isOwner?hexColor(OWNER_TITLE.color):hexColor(title.color);

  drawBgForTitle(ctx,W,H,title);
  for(const [gy,alpha] of [[0,'44'],[H-2,'FF']]){
    const g=ctx.createLinearGradient(0,0,W,0); g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(.5,hex+alpha); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.fillRect(0,gy,W,2);
  }
  const CX=W/2;
  ctx.fillStyle=hex+'33'; roundRect(ctx,CX-60,14,120,28,7); ctx.fill();
  ctx.font='bold 12px monospace'; ctx.fillStyle=hex; ctx.textAlign='center'; ctx.fillText('❄  AFK ACTIVATED  ❄',CX,33);

  const img=await fetchAvatar(user);
  drawAvatar(ctx,img,CX,100,58,hex);

  ctx.font='bold 24px sans-serif'; ctx.fillStyle='#FFF'; ctx.textAlign='center';
  ctx.shadowColor='rgba(0,0,0,.8)'; ctx.shadowBlur=5; ctx.fillText(user.username.slice(0,24),CX,176); ctx.shadowBlur=0;
  ctx.font='bold 14px sans-serif'; ctx.fillStyle=hex; ctx.shadowColor=hex; ctx.shadowBlur=8; ctx.fillText(title.name,CX,198); ctx.shadowBlur=0;

  ctx.strokeStyle='rgba(255,255,255,.08)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(CX-200,210); ctx.lineTo(CX+200,210); ctx.stroke();
  ctx.font='bold 10px monospace'; ctx.fillStyle='rgba(255,255,255,.35)'; ctx.fillText('REASON',CX,226);

  const clean=reason.length>400?reason.slice(0,397)+'...':reason;
  const lines=wrapLines(ctx,clean,680); const lineH=28; const maxL=4; let lineY=250;
  ctx.font='bold 20px sans-serif'; ctx.fillStyle='#FFF'; ctx.shadowColor='rgba(0,0,0,.6)'; ctx.shadowBlur=4;
  for(let i=0;i<Math.min(lines.length,maxL);i++){
    let txt=lines[i]; if(i===maxL-1&&lines.length>maxL)txt+='…';
    ctx.fillText(txt,CX,lineY); lineY+=lineH;
  }
  ctx.shadowBlur=0;
  const sepY=Math.max(lineY+6,326);
  ctx.strokeStyle='rgba(255,255,255,.07)'; ctx.beginPath(); ctx.moveTo(120,sepY); ctx.lineTo(W-120,sepY); ctx.stroke();
  ctx.font='12px monospace'; ctx.fillStyle='rgba(255,255,255,.30)';
  ctx.fillText(`❄  ${fmtNum(sd.points)} snow pts  ·  Session #${fmtNum(sd.sessions+1)}  ·  ${title.name}`,CX,sepY+18);
  drawChibiGlacian(ctx,W-55,H/2+10,.75,hex);
  ctx.font='bold 12px monospace'; ctx.fillStyle=isOwner?'rgba(170,68,255,.30)':'rgba(79,195,247,.20)';
  ctx.fillText(isOwner?'◈ GLACIAN':'❄ GLACIAN',CX,H-10);
  return canvas.toBuffer('image/png');
}

// ─── CANVAS 3: TITLE REVEAL CARD ─────────────────────────────────────────────
async function generateTitleRevealCard(user, sd) {
  const W=900,H=420; const canvas=createCanvas(W,H); const ctx=canvas.getContext('2d');
  const isOwner=user.id===OWNER_ID;
  const title=getTitle(sd.points,user.id), next=getNext(sd.points,user.id);
  const hex=isOwner?hexColor(OWNER_TITLE.color):hexColor(title.color);
  const nHex=next?hexColor(next.color):hex;

  drawBgForTitle(ctx,W,H,title);
  const cG=ctx.createRadialGradient(W/2,H/2,20,W/2,H/2,300);
  cG.addColorStop(0,hex+'22'); cG.addColorStop(1,'rgba(0,0,0,0)'); ctx.fillStyle=cG; ctx.fillRect(0,0,W,H);
  for(const [gy,alpha] of [[0,'55'],[H-2,'FF']]){
    const g=ctx.createLinearGradient(0,0,W,0); g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(.5,hex+alpha); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.fillRect(0,gy,W,2);
  }
  const img=await fetchAvatar(user); drawAvatar(ctx,img,W/2,88,60,hex);
  drawChibiGlacian(ctx,W/2+130,88,.8,hex);

  if (isOwner) {
    ctx.font='bold 11px monospace'; ctx.fillStyle='rgba(138,43,226,.6)'; ctx.textAlign='center';
    ctx.fillText('[ SYSTEM — STATUS NOTIFICATION ]',W/2,166);
    ctx.save(); ctx.shadowColor='#AA44FF'; ctx.shadowBlur=40; ctx.font='48px sans-serif'; ctx.fillStyle='#AA44FF'; ctx.fillText('◈',W/2,210); ctx.restore();
    ctx.font='bold 38px sans-serif'; ctx.fillStyle='#CC66FF'; ctx.shadowColor='#8800CC'; ctx.shadowBlur=30;
    ctx.fillText('MONARCA DE LAS SOMBRAS',W/2,258); ctx.shadowBlur=0;
    ctx.font='bold 15px sans-serif'; ctx.fillStyle='rgba(100,120,255,.75)'; ctx.fillText('HAS EMERGED FROM THE ETERNAL ABYSS',W/2,284);
    ctx.strokeStyle='rgba(106,13,173,.4)'; ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(160,306);ctx.lineTo(W-160,306);ctx.stroke();
    ctx.font='13px monospace'; ctx.fillStyle='rgba(170,100,255,.55)';
    ctx.fillText(`◈  Absolute Authority  ·  ${fmtNum(sd.points)} snow pts  ·  Sessions: ${fmtNum(sd.sessions)}`,W/2,332);
    ctx.font='bold 11px monospace'; ctx.fillStyle='rgba(106,13,173,.3)'; ctx.fillText('[ END OF NOTIFICATION ]',W/2,356);
    ctx.font='bold 12px monospace'; ctx.fillStyle='rgba(170,68,255,.2)'; ctx.fillText('◈ GLACIAN',W/2,H-14);
    return canvas.toBuffer('image/png');
  }

  ctx.font='bold 12px monospace'; ctx.fillStyle=hex+'AA'; ctx.textAlign='center';
  ctx.fillText(`TIER ${title.tier}  ·  ${TIER_NAMES[title.tier]?.toUpperCase()??''}`,W/2,172);
  const fs=title.name.length>22?30:38;
  ctx.font=`bold ${fs}px sans-serif`; ctx.fillStyle=hex; ctx.shadowColor=hex; ctx.shadowBlur=22;
  ctx.fillText(title.name,W/2,220); ctx.shadowBlur=0;
  ctx.fillStyle=hex+'22'; roundRect(ctx,W/2-100,232,200,28,8); ctx.fill();
  ctx.font='bold 12px monospace'; ctx.fillStyle=hex; ctx.fillText(`RANK #${title.rank} / 50`,W/2,251);
  ctx.strokeStyle='rgba(255,255,255,.08)'; ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(120,276);ctx.lineTo(W-120,276);ctx.stroke();
  // Flavor text (always English)
  const flavor=TITLE_FLAVOR[title.rank]??'';
  ctx.font='italic 13px sans-serif'; ctx.fillStyle=hex+'BB'; ctx.fillText(`"${flavor}"`,W/2,294);

  const BX=120,BW=W-240,BH=10,BY=312;
  const prog=next?Math.min(1,(sd.points-title.min)/(next.min-title.min)):1;
  drawProgressBar(ctx,BX,BY,BW,BH,prog,hex,nHex);
  ctx.font='11px monospace'; ctx.fillStyle='rgba(255,255,255,.3)';
  ctx.textAlign='left'; ctx.fillText(title.name,BX,BY+BH+14);
  ctx.textAlign='right'; ctx.fillText(next?`${next.name} (${fmtNum(next.min-sd.points)} pts)`:'✦ Max Rank',BX+BW,BY+BH+14);
  ctx.textAlign='center'; ctx.font='13px monospace'; ctx.fillStyle='rgba(255,255,255,.25)';
  ctx.fillText(`❄  ${fmtNum(sd.points)} snow pts  ·  Sessions: ${fmtNum(sd.sessions)}`,W/2,H-28);
  ctx.font='bold 12px monospace'; ctx.fillStyle='rgba(79,195,247,.2)'; ctx.fillText('❄ GLACIAN',W/2,H-12);
  return canvas.toBuffer('image/png');
}

// ─── DISCORD COMPONENTS V2 BUILDERS ──────────────────────────────────────────
function buildAfkSet(user, reason, startedAt, expiresAt, snow, title, aiMsg, lang) {
  const ts=Math.floor(startedAt/1000);
  const isOwner=user.id===OWNER_ID;
  const timerLine=expiresAt?`\n> ⏱️  **${t(lang,'afk.timer_set',{time:fmtDuration((expiresAt-startedAt)/1000)})}**`:'';
  const body=[
    `## ${isOwner?'◈':'❄️'}  ${t(lang,'afk.activated')} — **${user.username}**`,
    ``,
    `> 💤  **${t(lang,'afk.reason_label')}:**  ${reason}`,
    `> 🕐  **${t(lang,'afk.from_label')}:**    <t:${ts}:T>  —  <t:${ts}:R>`,
    `> ❄️  **${t(lang,'afk.snow_label')}:**   ${fmtNum(snow.points)}`,
    `> 🏆  **Title:**  ${title.name}${title.tier>0?` *(Tier ${title.tier} · Rank #${title.rank})*`:'  *(Absolute Authority)*'}`,
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
        { type:9, components:[{type:10,content:body}], accessory:{type:11,media:{url:user.displayAvatarURL({extension:'png',size:256})},spoiler:false} },
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
  const body=[
    `## ${isOwner?'◈':'🌨️'}  **${afkUser.username}** is AFK`,
    ``,
    `> 💤  **Reason:**             ${afkData.reason}`,
    `> 🕐  **Since:**              <t:${ts}:T>  —  <t:${ts}:R>`,
    `> ⏱️  **Time away:**          ${fmtDuration(elapsed)}`,
    `> 📨  **Mentions received:**  ${currentMentions}`,
  ].join('\n');
  return {
    flags:IS_CV2,
    components:[{
      type:17, accent_color:isOwner?OWNER_TITLE.color:0x4FC3F7,
      components:[
        {type:9,components:[{type:10,content:body}],accessory:{type:11,media:{url:afkUser.displayAvatarURL({extension:'png',size:256})},spoiler:false}},
        {type:14,divider:true,spacing:1},
        {type:10,content:`-# Glacian will notify when **${afkUser.username}** returns ❄️`},
        {type:1,components:[{type:2,style:2,label:'❄️  Snow Card',custom_id:`snow::${afkUser.id}`}]},
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

  // Title flavor text (always English)
  const titleLine=`\n\n**[ ${title.name.toUpperCase()} ]**\n-# *${flavor}*`;
  const foot=aiMsg
    ?`*${aiMsg}*${titleLine}\n\n-# ${t(lang,'afk.ret_footer')}`
    :`${titleLine}\n\n-# ${t(lang,'afk.ret_footer')}`;

  return {
    flags:IS_CV2,
    components:[{
      type:17,accent_color:isOwner?OWNER_TITLE.color:title.color,
      components:[
        {type:9,components:[{type:10,content:body}],accessory:{type:11,media:{url:user.displayAvatarURL({extension:'png',size:256})},spoiler:false}},
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
        {type:10,content:`-# ${t(lang,'snow.sessions',{})}: ${fmtNum(sd.sessions)}  ·  ${t(lang,'snow.total_time')}: ${fmtDuration(sd.total_seconds)}`},
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
async function sendV2File(channelId, payload, buf, name, replyToId=null) {
  const body={...payload};
  if(replyToId){body.message_reference={message_id:replyToId};body.allowed_mentions={parse:[],replied_user:false};}
  const form=new FormData();
  form.append('payload_json',JSON.stringify(body));
  form.append('files[0]',new Blob([buf],{type:'image/png'}),name);
  return rest.post(Routes.channelMessages(channelId),{body:form,passThroughBody:true});
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

/** Send DM to user with mentions + title card after AFK ends */
async function sendAfkEndDM(discordUser, durationSec, lang, sd, cardBuf) {
  try {
    const dm=await discordUser.createDM();
    const mentions=await DB.mentionsGet(discordUser.id);
    await DB.mentionsClear(discordUser.id);
    const title=getTitle(sd.points,discordUser.id);
    const isOwner=discordUser.id===OWNER_ID;

    // — Title card DM —
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

    // — Mentions DM —
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
    // DMs closed — silently fail
    console.error('[DM] Could not send to',discordUser.id,':',e.message);
  }
}

/** Handle timer expiry for timed AFK — fires from setTimeout */
async function handleTimerExpiry(userId) {
  const afkData=await DB.afkGet(userId);
  if(!afkData)return; // already returned manually

  const now=Date.now();
  const durationSec=Math.floor((now-afkData.started_at)/1000);
  const lang=await DB.getLang(userId);

  await DB.snowAdd(userId,durationSec,durationSec);
  await DB.afkDel(userId);
  const sd=await snowGet(userId);
  const title=getTitle(sd.points,userId);
  const isOwner=userId===OWNER_ID;

  // Generate title card
  let cardBuf=null;
  try{cardBuf=await generateTitleRevealCard({id:userId,username:'User',displayAvatarURL:()=>''},sd);}catch{}

  // Send DM with timer expired notification
  try{
    const discordUser=await client.users.fetch(userId);
    const dm=await discordUser.createDM();
    const timerPayload={
      flags:IS_CV2,
      components:[{
        type:17,accent_color:isOwner?OWNER_TITLE.color:title.color,
        components:[
          {type:10,content:[
            `## ⏱️  ${t(lang,'dm.timer_title')}`,
            ``,
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

    // Also notify in original channel if possible
    if(afkData.notify_channel){
      const flavor=isOwner?OWNER_FLAVOR:(TITLE_FLAVOR[title.rank]??'');
      const channelPayload={
        flags:IS_CV2,
        components:[{
          type:17,accent_color:isOwner?OWNER_TITLE.color:title.color,
          components:[
            {type:9,components:[{type:10,content:[
              `## ⏱️  ${isOwner?'◈':'❄️'}  AFK Timer Expired — <@${userId}>`,
              ``,
              `> ⏱️  **Was AFK for:** ${fmtDuration(durationSec)}`,
              `> ❄️  **Snow Points:** +${fmtNum(durationSec)}`,
              ``,
              `**[ ${title.name.toUpperCase()} ]**\n-# *${flavor}*`,
            ].join('\n')}],accessory:{type:11,media:{url:(await client.users.fetch(userId).catch(()=>null))?.displayAvatarURL({extension:'png',size:256})||''},spoiler:false}},
            {type:14,divider:true,spacing:1},
            {type:10,content:`-# Notified via DM 📬  ·  Snow Points added ✅`},
          ],
        }],
      };
      await sendV2(afkData.notify_channel,channelPayload).catch(()=>{});
    }
  } catch(e){console.error('[Timer]',e.message);}
}

// ─── SLASH COMMANDS ───────────────────────────────────────────────────────────
const SLASH_COMMANDS=[
  new SlashCommandBuilder()
    .setName('afk').setDescription('Set yourself as AFK (globally, persists across restarts)')
    .addStringOption(o=>o.setName('reason').setDescription('Reason for your AFK').setRequired(false))
    .addStringOption(o=>o.setName('time').setDescription('Optional timer e.g. 5m, 2h, 1d').setRequired(false)),
  new SlashCommandBuilder()
    .setName('snow').setDescription('View your Snow Points and rank card')
    .addUserOption(o=>o.setName('user').setDescription('Check another user\'s snow card').setRequired(false)),
  new SlashCommandBuilder()
    .setName('titles').setDescription('View all 50 titles and your progress'),
  new SlashCommandBuilder()
    .setName('lang').setDescription('Set your language preference')
    .addStringOption(o=>o.setName('language').setDescription('Language').setRequired(true)
      .addChoices({name:'🇺🇸 English',value:'en'},{name:'🇪🇸 Español',value:'es'},{name:'🇧🇷 Português',value:'pt'})),
].map(c=>c.toJSON());

// ─── COMMAND HANDLERS ─────────────────────────────────────────────────────────
async function cmdAfk({userId,guildId,guildName,reason,durationMs,user,channelId,messageId,isSlash,interaction}) {
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
  await DB.afkSet(userId,reason,now,expiresAt,channelId,guildName||'Unknown');

  // Set timer if duration given
  if(expiresAt){
    setTimeout(()=>handleTimerExpiry(userId),durationMs);
  }

  const sd=await snowGet(userId);
  const title=getTitle(sd.points,userId);
  const isOwner=userId===OWNER_ID;
  const [aiMsg,cardBuf]=await Promise.all([
    aiAfkMessage(user.username,reason,isOwner),
    generateAfkCard(user,reason,sd).catch(()=>null),
  ]);

  const payload=buildAfkSet(user,reason,now,expiresAt,sd,title,aiMsg,lang);

  const inject=(buf,name)=>{
    payload.components[0].components.splice(1,0,{type:12,items:[{media:{url:`attachment://${name}`},description:`AFK: ${user.username}`}]});
    return buf;
  };

  if(isSlash){
    await slashDefer(interaction).catch(()=>{});
    if(cardBuf){inject(cardBuf,'afk-card.png');await slashPatchFile(interaction,payload,cardBuf,'afk-card.png').catch(async()=>slashPatch(interaction,{content:`❄️ AFK — *${reason}*`}).catch(()=>{}));}
    else await slashPatch(interaction,payload).catch(()=>{});
  } else {
    if(cardBuf){inject(cardBuf,'afk-card.png');await sendV2File(channelId,payload,cardBuf,'afk-card.png',messageId).catch(()=>sendV2(channelId,payload,messageId).catch(()=>{}));}
    else await sendV2(channelId,payload,messageId).catch(()=>{});
  }
}

async function cmdSnow({user,channelId,messageId,targetUser,isSlash,interaction}) {
  targetUser=targetUser??user;
  const lang=await DB.getLang(user.id);
  const sd=await snowGet(targetUser.id);
  let cardBuf; try{cardBuf=await generateSnowCard(targetUser,sd);}catch(e){console.error('[Canvas]',e.message);}
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

  const now=Date.now();
  const durationSec=Math.floor((now-afkData.started_at)/1000);
  const mentions=afkData.mentions;
  const isOwner=userId===OWNER_ID;
  const lang=await DB.getLang(userId);

  await DB.snowAdd(userId,durationSec,durationSec);
  await DB.afkDel(userId);
  const sd=await snowGet(userId);

  const [aiMsg,cardBuf]=await Promise.all([
    aiReturnMessage(message.author.username,fmtDuration(durationSec),mentions,isOwner),
    generateTitleRevealCard(message.author,sd).catch(()=>null),
  ]);

  const payload=buildAfkReturn(message.author,durationSec,mentions,sd,aiMsg,lang);

  let returnMsg=null;
  try{returnMsg=await sendV2(message.channel.id,payload,message.id);}catch{}

  const channelId=message.channel.id;
  const retId=returnMsg?.id;

  setTimeout(async()=>{
    if(retId)await deleteMsg(channelId,retId);
    const titlePayload=buildTitleRevealMsg(message.author,sd);
    if(cardBuf){
      await sendV2File(channelId,titlePayload,cardBuf,'title-reveal.png').catch(()=>sendV2(channelId,titlePayload).catch(()=>{}));
    } else {
      await sendV2(channelId,titlePayload).catch(()=>{});
    }
    // Send DM with mentions + title card
    await sendAfkEndDM(message.author,durationSec,lang,sd,cardBuf);
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

// ─── CLIENT ───────────────────────────────────────────────────────────────────
const client=new Client({
  intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent,GatewayIntentBits.GuildMembers],
  partials:[Partials.Message,Partials.Channel],
});

// ─── READY ────────────────────────────────────────────────────────────────────
client.once(Events.ClientReady,async c=>{
  console.log(`\n❄️  Glacian online as ${c.user.tag}`);
  console.log(`   Prefix: ${PREFIX}  |  Slash: /`);
  console.log(`   Commands: afk · snow · titles · lang\n`);

  await initDB();

  // Register slash commands
  try{
    await rest.put(Routes.applicationCommands(c.user.id),{body:SLASH_COMMANDS});
    console.log('✅  Slash commands registered globally.');
  }catch(e){console.error('❌  Slash register error:',e.message);}

  // Recover timed AFKs that were active before restart
  const timed=await DB.getTimedAfks();
  let recovered=0;
  for(const row of timed){
    const remaining=row.expires_at-Date.now();
    if(remaining>0){
      setTimeout(()=>handleTimerExpiry(row.user_id),remaining);
      recovered++;
    } else {
      // Timer expired while bot was down — handle immediately
      setImmediate(()=>handleTimerExpiry(row.user_id));
      recovered++;
    }
  }
  if(recovered>0)console.log(`⏱️   Recovered ${recovered} timed AFK timer(s).`);

  // Status loop — shows AFK count in English
  const updateStatus=async()=>{
    const n=await DB.afkCount();
    const label=n===1?`1 person AFK ❄️`:`${n} people AFK ❄️`;
    c.user.setActivity(label,{type:ActivityType.Watching});
  };
  await updateStatus();
  setInterval(updateStatus,60_000);
});

// ─── MESSAGES ─────────────────────────────────────────────────────────────────
client.on(Events.MessageCreate,async message=>{
  if(!message.guild||message.author.bot)return;

  const userId=message.author.id;
  const content=message.content;
  const lc=content.toLowerCase().trim();
  const botId=client.user?.id;

  // Detect if this is a reply to the bot
  const isReplyToBot=message.reference?.messageId&&(()=>{
    const ref=message.channel.messages?.cache?.get(message.reference.messageId);
    return ref?.author?.id===botId;
  })();

  // ── 1. Auto-remove AFK if user writes (not an AFK command) ───────────────
  const selfAfk=await DB.afkGet(userId);
  if(selfAfk){
    const isAfkCmd=/^gn\s+afk(\s|$)/i.test(lc);
    if(!isAfkCmd){await handleReturn(message);return;}
  }

  // ── 2. Mention detection ─────────────────────────────────────────────────
  if(message.mentions.users.size>0){
    for(const [,mentioned] of message.mentions.users){
      if(mentioned.bot||mentioned.id===userId)continue;
      const afkData=await DB.afkGet(mentioned.id);
      if(!afkData)continue;
      await DB.afkMention(mentioned.id);
      const updated=await DB.afkGet(mentioned.id);
      // Log this mention with context
      await DB.mentionLog(
        mentioned.id,
        userId,
        message.author.username,
        message.channel.id,
        message.channel.name||'unknown',
        message.guild.name||'Unknown',
        content.slice(0,200)
      );
      try{
        const member=await message.guild.members.fetch(mentioned.id).catch(()=>null);
        const dispUser=member?.user??mentioned;
        const lang=await DB.getLang(mentioned.id);
        await sendV2(message.channel.id,buildAfkMention(dispUser,afkData,updated?.mentions??1,lang),message.id);
      }catch(e){console.error('[Mention]',e.message);}
    }
  }

  // ── 3. AI Chat ────────────────────────────────────────────────────────────
  const botMention=botId&&content.trimStart().match(new RegExp(`^<@!?${botId}>`));
  const glacianStart=/^glacian\b/i.test(lc);
  if((botMention||glacianStart||isReplyToBot)&&!/^gn\s+\S+/i.test(lc)){
    await handleAiChat(message,botId); return;
  }

  // ── 4. Prefix commands ────────────────────────────────────────────────────
  const prefixMatch=content.match(/^gn\s+(\S+)(.*)?$/i);
  if(!prefixMatch)return;
  const cmd=prefixMatch[1].toLowerCase();
  const args=(prefixMatch[2]??'').trim();

  const ctx={
    userId,guildId:message.guild.id,guildName:message.guild.name,
    user:message.author,channelId:message.channel.id,
    messageId:message.id,isSlash:false,interaction:null,
  };

  if(cmd==='afk'){
    // Parse optional duration from last word: "gn afk studying hard 5m"
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

// ─── INTERACTIONS ─────────────────────────────────────────────────────────────
client.on(Events.InteractionCreate,async interaction=>{

  // ── Buttons ───────────────────────────────────────────────────────────────
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

  // ── Slash ─────────────────────────────────────────────────────────────────
  if(!interaction.isChatInputCommand())return;
  const userId=interaction.user.id;
  const lang=await DB.getLang(userId);

  const ctx={
    userId,guildId:interaction.guild?.id??'DM',guildName:interaction.guild?.name,
    user:interaction.user,channelId:interaction.channel?.id,
    messageId:null,isSlash:true,interaction,
  };

  if(interaction.commandName==='afk'){
    await slashDefer(interaction).catch(()=>{});
    ctx.reason=interaction.options.getString('reason')??'No reason given';
    const timeStr=interaction.options.getString('time');
    ctx.durationMs=timeStr?parseDuration(timeStr):null;
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

// ─── ERROR GUARDS ─────────────────────────────────────────────────────────────
process.on('unhandledRejection',err=>{
  if(err?.code===10062||err?.code===10008)return;
  console.error('[Unhandled]',err?.message??err);
});
process.on('uncaughtException',err=>console.error('[Exception]',err));

// ─── LOGIN ────────────────────────────────────────────────────────────────────
if(!process.env.DISCORD_TOKEN){
  console.error('❌  DISCORD_TOKEN not set. Add it to your environment variables.');
  process.exit(1);
}
client.login(process.env.DISCORD_TOKEN);
