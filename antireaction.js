// ─────────────────────────────────────────────────────────────────────────────
//  antireaction.js — Advanced Anti-Reaction System for Glacian ❄️
//  Panel-based admin control with Components V2, strike system & logging
// ─────────────────────────────────────────────────────────────────────────────

import { REST, Routes } from 'discord.js';
import { DB } from './db.js';

const IS_CV2      = 1 << 15;
const EPHEMERAL   = 1 << 6;

// Strike threshold before warning DM
const STRIKE_WARN = 5;
// Cooldown between warnings per user (ms)
const WARN_COOLDOWN_MS = 10 * 60 * 1000; // 10 min
const warnCooldowns = new Map(); // `${guildId}:${userId}` → timestamp

let _rest = null;
let _clientId = null;

export function initAntiReaction(token, clientId) {
  _rest = new REST({ version: '10' }).setToken(token);
  _clientId = clientId;
}

// ─── EMOJI NORMALIZATION ──────────────────────────────────────────────────────
// Discord gives us "emoji.name" for unicode, "<:name:id>" for custom
export function normalizeEmoji(emoji) {
  if (!emoji) return null;
  if (emoji.id) return `<:${emoji.name}:${emoji.id}>`; // custom
  return emoji.name ?? null; // unicode
}

// Format for display (show unicode raw, custom as mention)
export function displayEmoji(emojiStr) {
  return emojiStr;
}

// ─── PERMISSION CHECK ─────────────────────────────────────────────────────────
export function isAdmin(member) {
  if (!member) return false;
  return member.permissions.has('ManageGuild') ||
         member.permissions.has('Administrator');
}

// ─── BUILD ADMIN PANEL ────────────────────────────────────────────────────────
export async function buildAntiReactionPanel(guildId, guildName, page = 'main') {
  const [gs, reactions] = await Promise.all([
    DB.gsGet(guildId),
    DB.arList(guildId),
  ]);

  const enabled = gs.anti_reaction_enabled !== false;
  const logCh   = gs.log_channel ? `<#${gs.log_channel}>` : '`Not set`';
  const wlRoles = (gs.whitelist_roles ?? []).map(r => `<@&${r}>`).join(', ') || '`None`';
  const wlUsers = (gs.whitelist_users ?? []).map(u => `<@${u}>`).join(', ') || '`None`';

  const statusIcon  = enabled ? '🟢' : '🔴';
  const statusLabel = enabled ? 'ACTIVE' : 'PAUSED';

  // Group reactions by scope
  const global = reactions.filter(r => !r.channel_id);
  const byChannel = reactions.filter(r => r.channel_id);

  const listGlobal  = global.map((r, i) => `\`${i+1}.\` ${r.emoji}`).join('\n') || '*No blocked emojis*';
  const listChannel = byChannel.map(r => `${r.emoji} — <#${r.channel_id}>`).join('\n') || '*None*';

  const components = [
    // Container
    {
      type: 17, // Container
      accent_color: enabled ? 0x5865F2 : 0x57534e,
      components: [
        // Header section
        {
          type: 9, // Section
          components: [
            {
              type: 10, // Text Display
              content: [
                `# 🛡️ Anti-Reaction Panel`,
                `**${guildName}** — ${statusIcon} Status: \`${statusLabel}\``,
                '',
                `> Control which emoji reactions are forbidden in this server.`,
                `> Blocked reactions are **removed instantly**. Users who spam them get **warned via DM**.`,
              ].join('\n'),
            },
          ],
          accessory: {
            type: 11, // Thumbnail
            media: { url: 'https://cdn.discordapp.com/emojis/1064700000000000000.png' },
            fallback_alt_text: 'shield',
          },
        },

        // Separator
        { type: 14, divider: true, spacing: 1 },

        // Stats row
        {
          type: 10,
          content: [
            `## 📊 Overview`,
            `**Blocked emojis:** \`${reactions.length}\` total (\`${global.length}\` global · \`${byChannel.length}\` channel-specific)`,
            `**Log channel:** ${logCh}`,
            `**Whitelisted roles:** ${wlRoles}`,
            `**Whitelisted users:** ${wlUsers}`,
          ].join('\n'),
        },

        { type: 14, divider: true, spacing: 1 },

        // Blocked list
        {
          type: 10,
          content: [
            `## 🚫 Blocked Emojis`,
            '',
            `**Server-wide** (${global.length}/20):`,
            listGlobal,
            byChannel.length ? `\n**Channel-specific:**\n${listChannel}` : '',
          ].filter(Boolean).join('\n'),
        },

        { type: 14, divider: true, spacing: 1 },

        // Action buttons row 1
        {
          type: 10,
          content: '## ⚙️ Actions',
        },
        {
          type: 1, // Action Row
          components: [
            {
              type: 2, // Button
              style: enabled ? 4 : 3, // Red if enabled (to pause), Green if paused (to enable)
              label: enabled ? '⏸ Pause System' : '▶ Enable System',
              custom_id: 'ar::toggle',
            },
            {
              type: 2,
              style: 1, // Blurple
              label: '➕ Add Emoji',
              custom_id: 'ar::add_prompt',
            },
            {
              type: 2,
              style: 4, // Red
              label: '➖ Remove Emoji',
              custom_id: 'ar::remove_prompt',
              disabled: reactions.length === 0,
            },
            {
              type: 2,
              style: 2, // Gray
              label: '🗑 Clear All',
              custom_id: 'ar::clear_confirm',
              disabled: reactions.length === 0,
            },
          ],
        },

        // Action buttons row 2
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 1,
              label: '📋 Set Log Channel',
              custom_id: 'ar::log_prompt',
            },
            {
              type: 2,
              style: 1,
              label: '🎭 Whitelist Role',
              custom_id: 'ar::wl_role_prompt',
            },
            {
              type: 2,
              style: 1,
              label: '👤 Whitelist User',
              custom_id: 'ar::wl_user_prompt',
            },
            {
              type: 2,
              style: 2,
              label: '🔄 Refresh',
              custom_id: 'ar::refresh',
            },
          ],
        },

        // Row 3 - advanced
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 2,
              label: '📊 Strike Stats',
              custom_id: 'ar::strikes',
            },
            {
              type: 2,
              style: 4,
              label: '🧹 Reset All Strikes',
              custom_id: 'ar::reset_strikes',
            },
            {
              type: 2,
              style: 2,
              label: '❌ Remove WL Role',
              custom_id: 'ar::rm_wl_role',
              disabled: (gs.whitelist_roles ?? []).length === 0,
            },
            {
              type: 2,
              style: 2,
              label: '❌ Remove WL User',
              custom_id: 'ar::rm_wl_user',
              disabled: (gs.whitelist_users ?? []).length === 0,
            },
          ],
        },

        { type: 14, divider: true, spacing: 1 },

        // Footer
        {
          type: 10,
          content: `-# ❄️ Glacian Anti-Reaction · ${STRIKE_WARN} reactions in a row triggers a warning DM · Panel visible only to admins`,
        },
      ],
    },
  ];

  return {
    flags: IS_CV2 | EPHEMERAL,
    components,
  };
}

// ─── INLINE ADD MODAL (text input sub-panel) ─────────────────────────────────
export function buildAddPrompt(emoji = null, channelId = null) {
  const components = [
    {
      type: 17,
      accent_color: 0x5865F2,
      components: [
        {
          type: 10,
          content: [
            `## ➕ Add Blocked Emoji`,
            '',
            emoji
              ? `**Emoji detected:** ${emoji}\nClick **Confirm** to block it server-wide, or choose a channel scope first.`
              : `**Usage:**\n> Use \`/anti reaction add <emoji>\` to add an emoji, or click a reaction on any message and the bot will intercept it.`,
            '',
            channelId ? `**Channel scope:** <#${channelId}>` : '**Scope:** 🌐 Server-wide',
          ].join('\n'),
        },
        {
          type: 1,
          components: emoji ? [
            {
              type: 2,
              style: 3,
              label: '✅ Block Server-wide',
              custom_id: `ar::confirm_add::${emoji}::global`,
            },
            {
              type: 2,
              style: 1,
              label: '📌 Block This Channel Only',
              custom_id: `ar::confirm_add::${emoji}::channel`,
            },
            {
              type: 2,
              style: 2,
              label: '← Back',
              custom_id: 'ar::refresh',
            },
          ] : [
            {
              type: 2,
              style: 2,
              label: '← Back',
              custom_id: 'ar::refresh',
            },
          ],
        },
      ],
    },
  ];

  return { flags: IS_CV2 | EPHEMERAL, components };
}

// ─── REMOVE EMOJI PANEL ───────────────────────────────────────────────────────
export async function buildRemovePanel(guildId) {
  const reactions = await DB.arList(guildId);
  if (reactions.length === 0) {
    return {
      flags: IS_CV2 | EPHEMERAL,
      components: [{
        type: 17,
        accent_color: 0xef4444,
        components: [{
          type: 10,
          content: '## ➖ Remove Blocked Emoji\n\n*No blocked emojis to remove.*',
        }, {
          type: 1,
          components: [{ type: 2, style: 2, label: '← Back', custom_id: 'ar::refresh' }],
        }],
      }],
    };
  }

  const listText = reactions.map((r, i) =>
    `\`${i+1}.\` ${r.emoji}${r.channel_id ? ` — <#${r.channel_id}>` : ' — 🌐 global'}`,
  ).join('\n');

  // Build remove buttons (max 5 per row)
  const btnRows = [];
  for (let i = 0; i < Math.min(reactions.length, 15); i += 5) {
    btnRows.push({
      type: 1,
      components: reactions.slice(i, i+5).map(r => ({
        type: 2,
        style: 4,
        label: `${r.emoji}${r.channel_id ? ' (ch)' : ''}`,
        custom_id: `ar::do_remove::${r.emoji}::${r.channel_id || 'global'}`,
      })),
    });
  }

  return {
    flags: IS_CV2 | EPHEMERAL,
    components: [{
      type: 17,
      accent_color: 0xef4444,
      components: [
        {
          type: 10,
          content: `## ➖ Remove Blocked Emoji\n\nClick a button to remove that emoji:\n\n${listText}`,
        },
        ...btnRows,
        {
          type: 1,
          components: [{ type: 2, style: 2, label: '← Back', custom_id: 'ar::refresh' }],
        },
      ],
    }],
  };
}

// ─── CLEAR CONFIRM PANEL ──────────────────────────────────────────────────────
export function buildClearConfirm(count) {
  return {
    flags: IS_CV2 | EPHEMERAL,
    components: [{
      type: 17,
      accent_color: 0xef4444,
      components: [
        {
          type: 10,
          content: `## ⚠️ Confirm Clear All\n\nThis will remove **all ${count} blocked emojis** from this server.\n**This action cannot be undone.**`,
        },
        {
          type: 1,
          components: [
            { type: 2, style: 4, label: '🗑 Yes, Clear All', custom_id: 'ar::do_clear' },
            { type: 2, style: 2, label: '← Cancel', custom_id: 'ar::refresh' },
          ],
        },
      ],
    }],
  };
}

// ─── STRIKE STATS PANEL ───────────────────────────────────────────────────────
export async function buildStrikesPanel(guildId, guild) {
  let rows;
  try {
    rows = await DB.strikeLeaderboard(guildId);
  } catch { rows = []; }

  const list = rows.length
    ? rows.map((row, i) => `\`${i+1}.\` <@${row.user_id}> — **${row.total}** total strikes`).join('\n')
    : '*No strike data yet.*';

  return {
    flags: IS_CV2 | EPHEMERAL,
    components: [{
      type: 17,
      accent_color: 0xf59e0b,
      components: [
        {
          type: 10,
          content: `## 📊 Strike Leaderboard\n*Top offenders in this server*\n\n${list}`,
        },
        {
          type: 1,
          components: [{ type: 2, style: 2, label: '← Back', custom_id: 'ar::refresh' }],
        },
      ],
    }],
  };
}

// ─── SUCCESS / ERROR PANELS ───────────────────────────────────────────────────
export function buildSuccess(msg, backId = 'ar::refresh') {
  return {
    flags: IS_CV2 | EPHEMERAL,
    components: [{
      type: 17,
      accent_color: 0x22c55e,
      components: [
        { type: 10, content: `## ✅ Done\n\n${msg}` },
        { type: 1, components: [{ type: 2, style: 3, label: '← Back to Panel', custom_id: backId }] },
      ],
    }],
  };
}

export function buildError(msg) {
  return {
    flags: IS_CV2 | EPHEMERAL,
    components: [{
      type: 17,
      accent_color: 0xef4444,
      components: [
        { type: 10, content: `## ❌ Error\n\n${msg}` },
        { type: 1, components: [{ type: 2, style: 2, label: '← Back', custom_id: 'ar::refresh' }] },
      ],
    }],
  };
}

// ─── REACTION EVENT HANDLER ───────────────────────────────────────────────────
export async function handleReactionAdd(reaction, user, client) {
  try {
    // Ignore bots and DMs
    if (user.bot) return;
    if (!reaction.message.guild) return;

    const guild   = reaction.message.guild;
    const guildId = guild.id;

    // Fetch partial reactions/messages
    if (reaction.partial) await reaction.fetch().catch(() => null);
    if (reaction.message.partial) await reaction.message.fetch().catch(() => null);

    // Check if system is enabled
    const gs = await DB.gsGet(guildId);
    if (!gs.anti_reaction_enabled) return;

    // Check whitelist
    if ((gs.whitelist_users ?? []).includes(user.id)) return;

    // Check whitelist roles
    if ((gs.whitelist_roles ?? []).length > 0) {
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (member) {
        const hasWlRole = gs.whitelist_roles.some(rid => member.roles.cache.has(rid));
        if (hasWlRole) return;
      }
    }

    // Normalize emoji
    const emoji = normalizeEmoji(reaction.emoji);
    if (!emoji) return;

    const channelId = reaction.message.channel.id;
    const isBlocked = await DB.arIsBlocked(guildId, emoji, channelId);
    if (!isBlocked) return;

    // Remove the reaction
    await reaction.users.remove(user.id).catch(() => null);

    // Strike system
    const strikes = await DB.strikeAdd(guildId, user.id, emoji);

    // Log to guild log channel
    if (gs.log_channel) {
      const logCh = await guild.channels.fetch(gs.log_channel).catch(() => null);
      if (logCh?.isTextBased()) {
        const logPayload = {
          flags: IS_CV2,
          components: [{
            type: 17,
            accent_color: 0xf59e0b,
            components: [{
              type: 10,
              content: [
                `## 🚫 Blocked Reaction Removed`,
                `**User:** <@${user.id}> (\`${user.tag || user.username}\`)`,
                `**Emoji:** ${emoji}`,
                `**Channel:** <#${channelId}>`,
                `**Message:** [Jump](${reaction.message.url})`,
                `**Strikes (this emoji):** \`${strikes}\` / \`${STRIKE_WARN}\``,
                `-# ${new Date().toUTCString()}`,
              ].join('\n'),
            }],
          }],
        };
        await _rest.post(Routes.channelMessages(gs.log_channel), { body: logPayload }).catch(() => null);
      }
    }

    // Warning DM at threshold
    if (strikes >= STRIKE_WARN) {
      const coolKey = `${guildId}:${user.id}`;
      const lastWarn = warnCooldowns.get(coolKey) ?? 0;
      if (Date.now() - lastWarn >= WARN_COOLDOWN_MS) {
        warnCooldowns.set(coolKey, Date.now());

        const dmPayload = {
          flags: IS_CV2,
          components: [{
            type: 17,
            accent_color: 0xef4444,
            components: [{
              type: 10,
              content: [
                `## ⚠️ Anti-Reaction Warning`,
                `You've been warned in **${guild.name}**!`,
                '',
                `> You added the blocked emoji **${emoji}** **${strikes} times** in a row.`,
                `> Continuing to bypass this rule may result in moderation action.`,
                '',
                `Please stop reacting with forbidden emojis in **${guild.name}**.`,
                `-# Glacian Anti-Reaction System · This is an automated warning`,
              ].join('\n'),
            }],
          }],
        };

        try {
          const dmChannel = await user.createDM();
          await _rest.post(Routes.channelMessages(dmChannel.id), { body: dmPayload });
        } catch { /* DMs disabled */ }
      }
    }
  } catch (e) {
    console.error('[AntiReaction]', e.message);
  }
}

// ─── INTERACTION HANDLER ──────────────────────────────────────────────────────
export async function handleAntiReactionInteraction(interaction, client) {
  const guildId = interaction.guild?.id;
  if (!guildId) return false;

  const id = interaction.customId;
  if (!id?.startsWith('ar::')) return false;

  // Admin check
  const member = interaction.member;
  if (!isAdmin(member)) {
    await interaction.reply({
      content: '❌ You need **Manage Server** permission to use this panel.',
      flags: EPHEMERAL,
    }).catch(() => {});
    return true;
  }

  const parts = id.split('::');
  const action = parts[1];

  try {
    switch (action) {
      case 'refresh': {
        const panel = await buildAntiReactionPanel(guildId, interaction.guild.name);
        await interaction.update(panel).catch(() => interaction.reply(panel).catch(() => {}));
        break;
      }

      case 'toggle': {
        const gs = await DB.gsGet(guildId);
        const newState = !(gs.anti_reaction_enabled !== false);
        await DB.gsSetEnabled(guildId, newState);
        const panel = await buildAntiReactionPanel(guildId, interaction.guild.name);
        await interaction.update(panel).catch(() => {});
        break;
      }

      case 'add_prompt': {
        const p = buildAddPrompt();
        await interaction.update(p).catch(() => interaction.reply(p).catch(() => {}));
        break;
      }

      case 'confirm_add': {
        // ar::confirm_add::<emoji>::<global|channel>
        const emoji = parts[2];
        const scope = parts[3];
        if (!emoji) {
          await interaction.update(buildError('No emoji specified.')).catch(() => {});
          break;
        }
        const channelId = scope === 'channel' ? interaction.channel?.id : null;
        const list = await DB.arList(guildId);
        if (list.length >= 20) {
          await interaction.update(buildError('Maximum 20 blocked emojis per server.')).catch(() => {});
          break;
        }
        await DB.arAdd(guildId, emoji, channelId, interaction.user.id);
        const msg = channelId
          ? `**${emoji}** is now blocked in <#${channelId}>.`
          : `**${emoji}** is now blocked server-wide.`;
        await interaction.update(buildSuccess(msg)).catch(() => {});
        break;
      }

      case 'remove_prompt': {
        const p = await buildRemovePanel(guildId);
        await interaction.update(p).catch(() => interaction.reply(p).catch(() => {}));
        break;
      }

      case 'do_remove': {
        // ar::do_remove::<emoji>::<global|channelId>
        const emoji   = parts[2];
        const chScope = parts[3] === 'global' ? null : parts[3];
        await DB.arRemove(guildId, emoji, chScope);
        const msg = chScope
          ? `**${emoji}** unblocked in <#${chScope}>.`
          : `**${emoji}** unblocked server-wide.`;
        await interaction.update(buildSuccess(msg)).catch(() => {});
        break;
      }

      case 'clear_confirm': {
        const list = await DB.arList(guildId);
        const p = buildClearConfirm(list.length);
        await interaction.update(p).catch(() => interaction.reply(p).catch(() => {}));
        break;
      }

      case 'do_clear': {
        await DB.arClear(guildId);
        await interaction.update(buildSuccess('All blocked emojis have been cleared.')).catch(() => {});
        break;
      }

      case 'log_prompt': {
        const p = {
          flags: IS_CV2 | EPHEMERAL,
          components: [{
            type: 17,
            accent_color: 0x5865F2,
            components: [
              {
                type: 10,
                content: [
                  `## 📋 Set Log Channel`,
                  '',
                  `To set the log channel, use the slash command:`,
                  `\`\`\``,
                  `/anti reaction log #channel`,
                  `\`\`\``,
                  'Or mention a channel in the command:',
                  '`/anti reaction log channel:#general-logs`',
                ].join('\n'),
              },
              {
                type: 1,
                components: [{ type: 2, style: 2, label: '← Back', custom_id: 'ar::refresh' }],
              },
            ],
          }],
        };
        await interaction.update(p).catch(() => {});
        break;
      }

      case 'wl_role_prompt': {
        const p = {
          flags: IS_CV2 | EPHEMERAL,
          components: [{
            type: 17,
            accent_color: 0x5865F2,
            components: [
              {
                type: 10,
                content: [
                  `## 🎭 Whitelist a Role`,
                  '',
                  `Members with a whitelisted role can add any reaction freely.`,
                  `Use the slash command:`,
                  '```',
                  '/anti reaction whitelist-role role:@Moderators',
                  '```',
                ].join('\n'),
              },
              {
                type: 1,
                components: [{ type: 2, style: 2, label: '← Back', custom_id: 'ar::refresh' }],
              },
            ],
          }],
        };
        await interaction.update(p).catch(() => {});
        break;
      }

      case 'wl_user_prompt': {
        const p = {
          flags: IS_CV2 | EPHEMERAL,
          components: [{
            type: 17,
            accent_color: 0x5865F2,
            components: [
              {
                type: 10,
                content: [
                  `## 👤 Whitelist a User`,
                  '',
                  `A whitelisted user can add any reaction freely.`,
                  `Use the slash command:`,
                  '```',
                  '/anti reaction whitelist-user user:@Username',
                  '```',
                ].join('\n'),
              },
              {
                type: 1,
                components: [{ type: 2, style: 2, label: '← Back', custom_id: 'ar::refresh' }],
              },
            ],
          }],
        };
        await interaction.update(p).catch(() => {});
        break;
      }

      case 'rm_wl_role': {
        const gs = await DB.gsGet(guildId);
        const roles = gs.whitelist_roles ?? [];
        if (roles.length === 0) {
          await interaction.update(buildError('No whitelisted roles to remove.')).catch(() => {});
          break;
        }
        const btns = roles.slice(0, 5).map(r => ({
          type: 2, style: 4, label: `<@&${r}>`.slice(0, 80),
          custom_id: `ar::do_rm_wl_role::${r}`,
        }));
        const p = {
          flags: IS_CV2 | EPHEMERAL,
          components: [{
            type: 17,
            accent_color: 0xef4444,
            components: [
              {
                type: 10,
                content: `## ❌ Remove Whitelisted Role\n\n${roles.map(r => `<@&${r}>`).join(', ')}\n\nClick to remove:`,
              },
              { type: 1, components: btns },
              { type: 1, components: [{ type: 2, style: 2, label: '← Back', custom_id: 'ar::refresh' }] },
            ],
          }],
        };
        await interaction.update(p).catch(() => {});
        break;
      }

      case 'do_rm_wl_role': {
        const roleId = parts[2];
        await DB.gsRemoveWhitelistRole(guildId, roleId);
        await interaction.update(buildSuccess(`<@&${roleId}> removed from whitelist.`)).catch(() => {});
        break;
      }

      case 'rm_wl_user': {
        const gs = await DB.gsGet(guildId);
        const users = gs.whitelist_users ?? [];
        if (users.length === 0) {
          await interaction.update(buildError('No whitelisted users to remove.')).catch(() => {});
          break;
        }
        const btns = users.slice(0, 5).map(u => ({
          type: 2, style: 4, label: `User ${u}`.slice(0, 80),
          custom_id: `ar::do_rm_wl_user::${u}`,
        }));
        const p = {
          flags: IS_CV2 | EPHEMERAL,
          components: [{
            type: 17,
            accent_color: 0xef4444,
            components: [
              {
                type: 10,
                content: `## ❌ Remove Whitelisted User\n\n${users.map(u => `<@${u}>`).join(', ')}\n\nClick to remove:`,
              },
              { type: 1, components: btns },
              { type: 1, components: [{ type: 2, style: 2, label: '← Back', custom_id: 'ar::refresh' }] },
            ],
          }],
        };
        await interaction.update(p).catch(() => {});
        break;
      }

      case 'do_rm_wl_user': {
        const uid = parts[2];
        await DB.gsRemoveWhitelistUser(guildId, uid);
        await interaction.update(buildSuccess(`<@${uid}> removed from whitelist.`)).catch(() => {});
        break;
      }

      case 'strikes': {
        const p = await buildStrikesPanel(guildId, interaction.guild);
        await interaction.update(p).catch(() => interaction.reply(p).catch(() => {}));
        break;
      }

      case 'reset_strikes': {
        await DB.strikeResetAll(guildId);
        await interaction.update(buildSuccess('All strikes reset for this server.')).catch(() => {});
        break;
      }

      default:
        return false;
    }
  } catch (e) {
    console.error('[AR Interaction]', e.message);
    try {
      await interaction.reply({ content: '❌ An error occurred.', flags: EPHEMERAL });
    } catch {}
  }

  return true;
}

// ─── SLASH COMMAND HANDLER ────────────────────────────────────────────────────
export async function handleAntiReactionCommand(interaction, client) {
  const guildId = interaction.guild?.id;
  if (!guildId) {
    await interaction.reply({ content: '❌ This command only works in servers.', flags: EPHEMERAL });
    return;
  }

  const member = interaction.member;
  if (!isAdmin(member)) {
    await interaction.reply({
      content: '❌ You need **Manage Server** permission to use this command.',
      flags: EPHEMERAL,
    });
    return;
  }

  const sub = interaction.options.getSubcommand(false);

  await DB.gsEnsure(guildId);

  switch (sub) {
    case 'panel':
    case null:
    default: {
      const panel = await buildAntiReactionPanel(guildId, interaction.guild.name);
      await interaction.reply(panel);
      break;
    }

    case 'add': {
      const emojiInput = interaction.options.getString('emoji', true);
      const channelOpt = interaction.options.getChannel('channel');
      const channelId  = channelOpt?.id ?? null;

      const list = await DB.arList(guildId);
      if (list.length >= 20) {
        await interaction.reply(buildError('Maximum 20 blocked emojis per server.'));
        break;
      }

      // Parse emoji — could be unicode or <:name:id> or <a:name:id>
      const customMatch = emojiInput.match(/^<a?:([^:]+):(\d+)>$/);
      let emoji;
      if (customMatch) {
        emoji = `<:${customMatch[1]}:${customMatch[2]}>`;
      } else {
        emoji = emojiInput.trim();
      }

      const ok = await DB.arAdd(guildId, emoji, channelId, interaction.user.id);
      if (!ok) {
        await interaction.reply(buildError('That emoji is already blocked (or an error occurred).'));
        break;
      }
      const msg = channelId
        ? `**${emoji}** is now blocked in <#${channelId}>.`
        : `**${emoji}** is now blocked server-wide.`;
      await interaction.reply(buildSuccess(msg));
      break;
    }

    case 'remove': {
      const emojiInput = interaction.options.getString('emoji', true);
      const channelOpt = interaction.options.getChannel('channel');
      const channelId  = channelOpt?.id ?? null;

      const customMatch = emojiInput.match(/^<a?:([^:]+):(\d+)>$/);
      const emoji = customMatch ? `<:${customMatch[1]}:${customMatch[2]}>` : emojiInput.trim();

      await DB.arRemove(guildId, emoji, channelId);
      const msg = channelId
        ? `**${emoji}** unblocked in <#${channelId}>.`
        : `**${emoji}** unblocked (all scopes).`;
      await interaction.reply(buildSuccess(msg));
      break;
    }

    case 'list': {
      const panel = await buildAntiReactionPanel(guildId, interaction.guild.name);
      await interaction.reply(panel);
      break;
    }

    case 'toggle': {
      const gs = await DB.gsGet(guildId);
      const newState = !(gs.anti_reaction_enabled !== false);
      await DB.gsSetEnabled(guildId, newState);
      const msg = newState
        ? '✅ Anti-reaction system **enabled**.'
        : '⏸ Anti-reaction system **paused**. No reactions will be removed.';
      await interaction.reply(buildSuccess(msg));
      break;
    }

    case 'log': {
      const channel = interaction.options.getChannel('channel', true);
      await DB.gsSetLogChannel(guildId, channel.id);
      await interaction.reply(buildSuccess(`Log channel set to <#${channel.id}>.`));
      break;
    }

    case 'whitelist-role': {
      const role = interaction.options.getRole('role', true);
      await DB.gsAddWhitelistRole(guildId, role.id);
      await interaction.reply(buildSuccess(`<@&${role.id}> added to whitelist. Members with this role can react freely.`));
      break;
    }

    case 'whitelist-user': {
      const user = interaction.options.getUser('user', true);
      await DB.gsAddWhitelistUser(guildId, user.id);
      await interaction.reply(buildSuccess(`<@${user.id}> added to whitelist.`));
      break;
    }

    case 'strikes': {
      const p = await buildStrikesPanel(guildId, interaction.guild);
      await interaction.reply(p);
      break;
    }

    case 'reset-strikes': {
      const target = interaction.options.getUser('user');
      if (target) {
        await DB.strikeReset(guildId, target.id);
        await interaction.reply(buildSuccess(`Strikes reset for <@${target.id}>.`));
      } else {
        await DB.strikeResetAll(guildId);
        await interaction.reply(buildSuccess('All strikes reset for this server.'));
      }
      break;
    }
  }
}

// ─── SLASH COMMAND DEFINITION ─────────────────────────────────────────────────
export function buildAntiReactionSlash() {
  return {
    name: 'anti',
    description: '🛡️ Anti-Reaction system — block forbidden emoji reactions',
    options: [
      {
        type: 1, // SUB_COMMAND_GROUP
        name: 'reaction',
        description: 'Manage the anti-reaction system',
        options: [
          {
            type: 1, // SUB_COMMAND
            name: 'panel',
            description: '🎛️ Open the full admin control panel',
          },
          {
            type: 1,
            name: 'add',
            description: '➕ Block an emoji reaction',
            options: [
              { type: 3, name: 'emoji', description: 'Emoji to block', required: true },
              { type: 7, name: 'channel', description: 'Block only in this channel (optional, default = server-wide)', required: false, channel_types: [0, 5] },
            ],
          },
          {
            type: 1,
            name: 'remove',
            description: '➖ Unblock an emoji reaction',
            options: [
              { type: 3, name: 'emoji', description: 'Emoji to unblock', required: true },
              { type: 7, name: 'channel', description: 'Remove only for this channel scope (optional)', required: false, channel_types: [0, 5] },
            ],
          },
          {
            type: 1,
            name: 'list',
            description: '📋 List all blocked emojis',
          },
          {
            type: 1,
            name: 'toggle',
            description: '⏸ Enable or pause the system',
          },
          {
            type: 1,
            name: 'log',
            description: '📋 Set the log channel for removed reactions',
            options: [
              { type: 7, name: 'channel', description: 'Channel to log to', required: true, channel_types: [0] },
            ],
          },
          {
            type: 1,
            name: 'whitelist-role',
            description: '🎭 Whitelist a role (members can react freely)',
            options: [
              { type: 8, name: 'role', description: 'Role to whitelist', required: true },
            ],
          },
          {
            type: 1,
            name: 'whitelist-user',
            description: '👤 Whitelist a specific user',
            options: [
              { type: 6, name: 'user', description: 'User to whitelist', required: true },
            ],
          },
          {
            type: 1,
            name: 'strikes',
            description: '📊 View strike leaderboard for this server',
          },
          {
            type: 1,
            name: 'reset-strikes',
            description: '🧹 Reset strikes (all or for a specific user)',
            options: [
              { type: 6, name: 'user', description: 'User to reset (leave empty = reset everyone)', required: false },
            ],
          },
        ],
      },
    ],
  };
}
