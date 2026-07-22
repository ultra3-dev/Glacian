// ─────────────────────────────────────────────────────────────────────────────
//  db.js — Neon PostgreSQL layer for Glacian bot
//  Survives restarts: all AFK data is persisted globally
// ─────────────────────────────────────────────────────────────────────────────
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => console.error('[DB] Unexpected pool error:', err.message));

export async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS afk_store (
        user_id       TEXT    PRIMARY KEY,
        reason        TEXT    NOT NULL DEFAULT 'No reason given',
        started_at    BIGINT  NOT NULL,
        expires_at    BIGINT,
        notify_channel TEXT,
        notify_guild   TEXT,
        mentions      INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS snow_store (
        user_id        TEXT   PRIMARY KEY,
        points         BIGINT DEFAULT 0,
        total_seconds  BIGINT DEFAULT 0,
        sessions       INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS afk_mentions (
        id             SERIAL  PRIMARY KEY,
        afk_user_id    TEXT    NOT NULL,
        mentioner_id   TEXT,
        mentioner_name TEXT,
        channel_id     TEXT,
        channel_name   TEXT,
        guild_name     TEXT,
        msg_preview    TEXT,
        ts             BIGINT
      );

      CREATE TABLE IF NOT EXISTS user_settings (
        user_id TEXT PRIMARY KEY,
        lang    TEXT DEFAULT 'en'
      );
    `);
    console.log('✅  Neon DB — tables ready.');
  } catch (e) {
    console.error('❌  DB init error:', e.message);
    throw e;
  }
}

export const DB = {
  // ── AFK ───────────────────────────────────────────────────────────────────
  async afkGet(userId) {
    try {
      const r = await pool.query('SELECT * FROM afk_store WHERE user_id=$1', [userId]);
      return r.rows[0] ?? null;
    } catch { return null; }
  },

  async afkSet(userId, reason, startedAt, expiresAt = null, notifyChannel = null, notifyGuild = null) {
    try {
      await pool.query(
        `INSERT INTO afk_store
           (user_id, reason, started_at, expires_at, notify_channel, notify_guild, mentions)
         VALUES ($1,$2,$3,$4,$5,$6,0)
         ON CONFLICT (user_id) DO UPDATE
           SET reason=$2, started_at=$3, expires_at=$4,
               notify_channel=$5, notify_guild=$6, mentions=0`,
        [userId, reason, startedAt, expiresAt, notifyChannel, notifyGuild],
      );
    } catch (e) { console.error('[DB] afkSet:', e.message); }
  },

  async afkDel(userId) {
    try { await pool.query('DELETE FROM afk_store WHERE user_id=$1', [userId]); }
    catch (e) { console.error('[DB] afkDel:', e.message); }
  },

  async afkMention(userId) {
    try { await pool.query('UPDATE afk_store SET mentions=mentions+1 WHERE user_id=$1', [userId]); }
    catch {}
  },

  /** Returns all rows that have a timer set (for restart recovery) */
  async getTimedAfks() {
    try {
      const r = await pool.query('SELECT * FROM afk_store WHERE expires_at IS NOT NULL');
      return r.rows;
    } catch { return []; }
  },

  async afkCount() {
    try {
      const r = await pool.query('SELECT COUNT(*) FROM afk_store');
      return parseInt(r.rows[0].count, 10) || 0;
    } catch { return 0; }
  },

  // ── SNOW ──────────────────────────────────────────────────────────────────
  async snowGet(userId) {
    try {
      const r = await pool.query('SELECT * FROM snow_store WHERE user_id=$1', [userId]);
      return r.rows[0] ?? null;
    } catch { return null; }
  },

  async snowAdd(userId, pts, secs) {
    try {
      await pool.query(
        `INSERT INTO snow_store (user_id, points, total_seconds, sessions)
         VALUES ($1,$2,$3,1)
         ON CONFLICT (user_id) DO UPDATE
           SET points        = snow_store.points + $2,
               total_seconds = snow_store.total_seconds + $3,
               sessions      = snow_store.sessions + 1`,
        [userId, pts, secs],
      );
    } catch (e) { console.error('[DB] snowAdd:', e.message); }
  },

  // ── MENTIONS LOG ──────────────────────────────────────────────────────────
  async mentionLog(afkUserId, mentionerId, mentionerName, channelId, channelName, guildName, msgPreview) {
    try {
      await pool.query(
        `INSERT INTO afk_mentions
           (afk_user_id, mentioner_id, mentioner_name, channel_id, channel_name, guild_name, msg_preview, ts)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [afkUserId, mentionerId, mentionerName, channelId, channelName, guildName, msgPreview, Date.now()],
      );
    } catch {}
  },

  async mentionsGet(userId) {
    try {
      const r = await pool.query(
        'SELECT * FROM afk_mentions WHERE afk_user_id=$1 ORDER BY ts ASC LIMIT 25',
        [userId],
      );
      return r.rows;
    } catch { return []; }
  },

  async mentionsClear(userId) {
    try { await pool.query('DELETE FROM afk_mentions WHERE afk_user_id=$1', [userId]); }
    catch {}
  },

  // ── USER SETTINGS ─────────────────────────────────────────────────────────
  async getLang(userId) {
    try {
      const r = await pool.query('SELECT lang FROM user_settings WHERE user_id=$1', [userId]);
      return r.rows[0]?.lang ?? 'en';
    } catch { return 'en'; }
  },

  async setLang(userId, lang) {
    try {
      await pool.query(
        `INSERT INTO user_settings (user_id, lang) VALUES ($1,$2)
         ON CONFLICT (user_id) DO UPDATE SET lang=$2`,
        [userId, lang],
      );
    } catch {}
  },
};

/** Helper — returns a full snow record, never null */
export async function snowGet(userId) {
  return (await DB.snowGet(userId)) ?? { user_id: userId, points: 0, total_seconds: 0, sessions: 0 };
}
