// ─── utils.js — Shared constants, title system & formatting utilities ─────────
// Imported by both index.js and canvas.js to avoid circular dependencies.

export const OWNER_ID    = '1064678074010058752';
export const BEST_FRIEND = '1490187375626948730';

// ─── TITLE FLAVOR TEXT ───────────────────────────────────────────────────────
export const OWNER_FLAVOR = 'THE MONARCH OF SHADOWS HAS EMERGED FROM THE ETERNAL ABYSS.';
export const TITLE_FLAVOR = [
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

// ─── TIER NAMES ───────────────────────────────────────────────────────────────
export const TIER_NAMES = ['', 'The Awakening', 'Crystal Depths', 'Void Ice', 'Rune Ice', 'Divine Zero'];

// ─── OWNER TITLE ─────────────────────────────────────────────────────────────
export const OWNER_TITLE = {
  rank: 0, name: '\u{1F451} Monarch of Shadows', min: 0,
  color: 0x6A0DAD, tier: 0, isOwner: true, tierName: 'Absolute Authority',
};

// ─── 50 TITLES ────────────────────────────────────────────────────────────────
export const TITLES = [
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

// ─── TITLE HELPERS ────────────────────────────────────────────────────────────
export function getTitle(pts, userId = null) {
  if (userId === OWNER_ID) return OWNER_TITLE;
  let out = TITLES[0];
  for (const x of TITLES) { if (pts >= x.min) out = x; else break; }
  return out;
}

export function getNext(pts, userId = null) {
  if (userId === OWNER_ID) return null;
  for (const x of TITLES) { if (pts < x.min) return x; }
  return null;
}

// ─── FORMAT UTILITIES ─────────────────────────────────────────────────────────
export function hexColor(c) { return `#${Math.round(c).toString(16).padStart(6, '0')}`; }
export function fmtNum(n)    { return Number(n).toLocaleString('en-US'); }

export function fmtDuration(secs) {
  const s = Math.floor(secs);
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s/60)}m ${s%60}s`;
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60);
  if (h < 24)   return `${h}h ${m}m`;
  const d = Math.floor(h/24);
  return `${d}d ${h%24}h`;
}

export function parseDuration(str) {
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
