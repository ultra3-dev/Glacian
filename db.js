// ─────────────────────────────────────────────────────────────────────────────
//  db.js — Neon PostgreSQL layer for Glacian bot
//  Survives restarts: all data is persisted globally
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
        user_id        TEXT    PRIMARY KEY,
        reason         TEXT    NOT NULL DEFAULT 'No reason given',
        started_at     BIGINT  NOT NULL,
        expires_at     BIGINT,
        notify_channel TEXT,
        notify_guild   TEXT,
        mentions       INTEGER DEFAULT 0,
        guild_scope    TEXT    DEFAULT 'global'
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

      CREATE TABLE IF NOT EXISTS anti_reactions (
        id         SERIAL  PRIMARY KEY,
        guild_id   TEXT    NOT NULL,
        emoji      TEXT    NOT NULL,
        channel_id TEXT,
        added_by   TEXT,
        added_at   BIGINT  NOT NULL,
        UNIQUE(guild_id, emoji, channel_id)
      );

      CREATE TABLE IF NOT EXISTS reaction_strikes (
        guild_id   TEXT    NOT NULL,
        user_id    TEXT    NOT NULL,
        emoji      TEXT    NOT NULL,
        count      INTEGER DEFAULT 1,
        last_ts    BIGINT  NOT NULL,
        PRIMARY KEY(guild_id, user_id, emoji)
      );

      CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id              TEXT    PRIMARY KEY,
        anti_reaction_enabled BOOLEAN DEFAULT true,
        log_channel           TEXT,
        whitelist_roles       TEXT[]  DEFAULT ARRAY[]::TEXT[],
        whitelist_users       TEXT[]  DEFAULT ARRAY[]::TEXT[]
      );
    `);

    // Migrations for existing deployments
    await pool.query(`ALTER TABLE afk_store ADD COLUMN IF NOT EXISTS guild_scope TEXT DEFAULT 'global';`).catch(()=>{});

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

  async afkGetForGuild(userId, guildId) {
    try {
      const r = await pool.query(
        `SELECT * FROM afk_store WHERE user_id=$1 AND (guild_scope='global' OR guild_scope=$2)`,
        [userId, guildId],
      );
      return r.rows[0] ?? null;
    } catch { return null; }
  },

  async afkSet(userId, reason, startedAt, expiresAt = null, notifyChannel = null, notifyGuild = null, guildScope = 'global') {
    try {
      await pool.query(
        `INSERT INTO afk_store
           (user_id, reason, started_at, expires_at, notify_channel, notify_guild, mentions, guild_scope)
         VALUES ($1,$2,$3,$4,$5,$6,0,$7)
         ON CONFLICT (user_id) DO UPDATE
           SET reason=$2, started_at=$3, expires_at=$4,
               notify_channel=$5, notify_guild=$6, mentions=0, guild_scope=$7`,
        [userId, reason, startedAt, expiresAt, notifyChannel, notifyGuild, guildScope],
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

  // ── ANTI-REACTION ─────────────────────────────────────────────────────────

  /** Get all blocked emojis for a guild (optionally filter by channel) */
  async arList(guildId) {
    try {
      const r = await pool.query(
        'SELECT * FROM anti_reactions WHERE guild_id=$1 ORDER BY added_at DESC',
        [guildId],
      );
      return r.rows;
    } catch { return []; }
  },

  /** Check if an emoji is blocked in this guild/channel combo */
  async arIsBlocked(guildId, emoji, channelId) {
    try {
      const r = await pool.query(
        `SELECT 1 FROM anti_reactions
         WHERE guild_id=$1 AND emoji=$2
           AND (channel_id IS NULL OR channel_id=$3)
         LIMIT 1`,
        [guildId, emoji, channelId],
      );
      return r.rows.length > 0;
    } catch { return false; }
  },

  /** Add a blocked emoji. channel_id=null means server-wide. */
  async arAdd(guildId, emoji, channelId = null, addedBy = null) {
    try {
      await pool.query(
        `INSERT INTO anti_reactions (guild_id, emoji, channel_id, added_by, added_at)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (guild_id, emoji, channel_id) DO NOTHING`,
        [guildId, emoji, channelId, addedBy, Date.now()],
      );
      return true;
    } catch (e) { console.error('[DB] arAdd:', e.message); return false; }
  },

  /** Remove a blocked emoji */
  async arRemove(guildId, emoji, channelId = null) {
    try {
      if (channelId) {
        await pool.query(
          'DELETE FROM anti_reactions WHERE guild_id=$1 AND emoji=$2 AND channel_id=$3',
          [guildId, emoji, channelId],
        );
      } else {
        // Remove all entries for this emoji in this guild (any channel scope)
        await pool.query(
          'DELETE FROM anti_reactions WHERE guild_id=$1 AND emoji=$2',
          [guildId, emoji],
        );
      }
    } catch (e) { console.error('[DB] arRemove:', e.message); }
  },

  /** Clear all blocked emojis for a guild */
  async arClear(guildId) {
    try { await pool.query('DELETE FROM anti_reactions WHERE guild_id=$1', [guildId]); }
    catch (e) { console.error('[DB] arClear:', e.message); }
  },

  // ── STRIKE SYSTEM ─────────────────────────────────────────────────────────

  /** Increment strike count. Returns new total. */
  async strikeAdd(guildId, userId, emoji) {
    try {
      const r = await pool.query(
        `INSERT INTO reaction_strikes (guild_id, user_id, emoji, count, last_ts)
         VALUES ($1,$2,$3,1,$4)
         ON CONFLICT (guild_id, user_id, emoji) DO UPDATE
           SET count = reaction_strikes.count + 1, last_ts = $4
         RETURNING count`,
        [guildId, userId, emoji, Date.now()],
      );
      return r.rows[0]?.count ?? 1;
    } catch { return 1; }
  },

  /** Reset strikes for a user in a guild */
  async strikeReset(guildId, userId) {
    try { await pool.query('DELETE FROM reaction_strikes WHERE guild_id=$1 AND user_id=$2', [guildId, userId]); }
    catch {}
  },

  /** Get all strikes for a user in a guild */
  async strikeGet(guildId, userId) {
    try {
      const r = await pool.query(
        'SELECT * FROM reaction_strikes WHERE guild_id=$1 AND user_id=$2',
        [guildId, userId],
      );
      return r.rows;
    } catch { return []; }
  },

  /** Top 10 users by total strikes in a guild */
  async strikeLeaderboard(guildId) {
    try {
      const r = await pool.query(
        `SELECT user_id, SUM(count) as total
         FROM reaction_strikes WHERE guild_id=$1
         GROUP BY user_id ORDER BY total DESC LIMIT 10`,
        [guildId],
      );
      return r.rows;
    } catch { return []; }
  },

  /** Reset ALL strikes for all users in a guild */
  async strikeResetAll(guildId) {
    try { await pool.query('DELETE FROM reaction_strikes WHERE guild_id=$1', [guildId]); }
    catch {}
  },

  // ── GUILD SETTINGS ────────────────────────────────────────────────────────

  async gsGet(guildId) {
    try {
      const r = await pool.query('SELECT * FROM guild_settings WHERE guild_id=$1', [guildId]);
      return r.rows[0] ?? { guild_id: guildId, anti_reaction_enabled: true, log_channel: null, whitelist_roles: [], whitelist_users: [] };
    } catch { return { guild_id: guildId, anti_reaction_enabled: true, log_channel: null, whitelist_roles: [], whitelist_users: [] }; }
  },

  async gsEnsure(guildId) {
    try {
      await pool.query(
        `INSERT INTO guild_settings (guild_id) VALUES ($1) ON CONFLICT DO NOTHING`,
        [guildId],
      );
    } catch {}
  },

  async gsSetEnabled(guildId, enabled) {
    try {
      await pool.query(
        `INSERT INTO guild_settings (guild_id, anti_reaction_enabled) VALUES ($1,$2)
         ON CONFLICT (guild_id) DO UPDATE SET anti_reaction_enabled=$2`,
        [guildId, enabled],
      );
    } catch {}
  },

  async gsSetLogChannel(guildId, channelId) {
    try {
      await pool.query(
        `INSERT INTO guild_settings (guild_id, log_channel) VALUES ($1,$2)
         ON CONFLICT (guild_id) DO UPDATE SET log_channel=$2`,
        [guildId, channelId],
      );
    } catch {}
  },

  async gsAddWhitelistRole(guildId, roleId) {
    try {
      await pool.query(
        `INSERT INTO guild_settings (guild_id, whitelist_roles) VALUES ($1, ARRAY[$2]::TEXT[])
         ON CONFLICT (guild_id) DO UPDATE
           SET whitelist_roles = array_append(guild_settings.whitelist_roles, $2)
         WHERE NOT ($2 = ANY(guild_settings.whitelist_roles))`,
        [guildId, roleId],
      );
    } catch {}
  },

  async gsRemoveWhitelistRole(guildId, roleId) {
    try {
      await pool.query(
        `UPDATE guild_settings SET whitelist_roles = array_remove(whitelist_roles, $2) WHERE guild_id=$1`,
        [guildId, roleId],
      );
    } catch {}
  },

  async gsAddWhitelistUser(guildId, userId) {
    try {
      await pool.query(
        `INSERT INTO guild_settings (guild_id, whitelist_users) VALUES ($1, ARRAY[$2]::TEXT[])
         ON CONFLICT (guild_id) DO UPDATE
           SET whitelist_users = array_append(guild_settings.whitelist_users, $2)
         WHERE NOT ($2 = ANY(guild_settings.whitelist_users))`,
        [guildId, userId],
      );
    } catch {}
  },

  async gsRemoveWhitelistUser(guildId, userId) {
    try {
      await pool.query(
        `UPDATE guild_settings SET whitelist_users = array_remove(whitelist_users, $2) WHERE guild_id=$1`,
        [guildId, userId],
      );
    } catch {}
  },
};

/** Helper — returns a full snow record, never null */
export async function snowGet(userId) {
  return (await DB.snowGet(userId)) ?? { user_id: userId, points: 0, total_seconds: 0, sessions: 0 };
}
