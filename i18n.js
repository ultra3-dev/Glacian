// ─────────────────────────────────────────────────────────────────────────────
//  i18n.js — 3-language support: English (original), Spanish, Portuguese
// ─────────────────────────────────────────────────────────────────────────────

const STRINGS = {
  en: {
    afk: {
      already:         '❄️ You are already AFK since <t:{ts}:R>. Send any message to return.',
      activated:       'AFK Activated',
      timer_set:       '⏱️ Timer: **{time}** — I\'ll DM you when it expires!',
      reason_label:    'REASON',
      from_label:      'SINCE',
      snow_label:      'SNOW POINTS',
      session_label:   'SESSION',
      ret_headline:    '🌟 {username} has returned!',
      ret_headline_owner: '◈ The Monarch of Shadows returns...',
      ret_time:        '⏱️ AFK Time',
      ret_mentions:    '📨 Missed Mentions',
      ret_gained:      '❄️ Snow Points Gained',
      ret_total:       '💎 Total',
      ret_title_lbl:   '🏆 Title',
      ret_next:        '⬆️ Next',
      ret_max:         '👑 MAX RANK — Glacian\'s Chosen!',
      ret_footer:      'AFK deactivated ✅ · Title card updating...',
      mention_notify:  '🌨️ **{name}** is AFK',
      mention_footer:  'Glacian will notify when **{name}** returns ❄️',
    },
    dm: {
      timer_title:     '⏱️ Your AFK Timer Has Expired!',
      timer_body:      'You were AFK for **{duration}**.',
      timer_channel:   'Set in: **{guild}** • #{channel}',
      mentions_title:  '📬 Mentions While You Were AFK',
      mentions_none:   'No one mentioned you while you were away. 🌨️',
      mention_entry:   '**{n}.** `{guild}` • **#{channel}**\n↳ **{mentioner}** — *{preview}*',
      title_card_note: '🏆 Your current title — keep grinding! ❄️',
    },
    snow: {
      header:     '❄️ Snow Card — **{username}**',
      max_rank:   '👑 MAX RANK — Glacian\'s Chosen!',
      owner_rank: '◈ Monarch of Shadows — Above All Ranks',
      next:       '⬆️ Next: **{name}** — {pts} pts away',
      sessions:   'Sessions',
      total_time: 'Total AFK Time',
    },
    titles: {
      header:       '🏆 50-Title System — Glacian',
      pts_label:    '❄️ Snow Points',
      current:      '🎖️ Current Title',
      owner_lbl:    '👑 Title',
      footer:       '1 Snow Point = 1 second AFK · Max rank requires 5 years',
      unlocked:     'UNLOCKED',
      locked:       'LOCKED',
    },
    lang: {
      set:     '✅ Language set to **English**! 🇺🇸',
      invalid: '❌ Invalid language. Use `en`, `es` or `pt`.',
    },
    err: {
      no_user: '❌ User not found.',
      generic: '❌ Something went wrong.',
    },
    status_many: 'Watching {n} people AFK',
    status_one:  'Watching 1 person AFK',
    status_none: 'No one AFK right now ❄️',
  },

  es: {
    afk: {
      already:         '❄️ Ya estás en modo AFK desde <t:{ts}:R>. Escribe algo para volver.',
      activated:       'AFK Activado',
      timer_set:       '⏱️ Temporizador: **{time}** — ¡Te aviso por DM cuando expire!',
      reason_label:    'RAZÓN',
      from_label:      'DESDE',
      snow_label:      'SNOW POINTS',
      session_label:   'SESIÓN',
      ret_headline:    '🌟 ¡{username} ha regresado!',
      ret_headline_owner: '◈ El Monarca de las Sombras regresa...',
      ret_time:        '⏱️ Tiempo AFK',
      ret_mentions:    '📨 Menciones perdidas',
      ret_gained:      '❄️ Snow Points ganados',
      ret_total:       '💎 Total acumulado',
      ret_title_lbl:   '🏆 Título',
      ret_next:        '⬆️ Próximo',
      ret_max:         '👑 RANGO MÁXIMO — ¡Glacian\'s Chosen!',
      ret_footer:      'AFK desactivado ✅ · Actualizando tarjeta de título...',
      mention_notify:  '🌨️ **{name}** está en AFK',
      mention_footer:  'Glacian avisará cuando **{name}** regrese ❄️',
    },
    dm: {
      timer_title:     '⏱️ ¡Tu temporizador AFK expiró!',
      timer_body:      'Estuviste AFK durante **{duration}**.',
      timer_channel:   'Lo pusiste en: **{guild}** • #{channel}',
      mentions_title:  '📬 Menciones mientras estabas AFK',
      mentions_none:   'Nadie te mencionó mientras estabas ausente. 🌨️',
      mention_entry:   '**{n}.** `{guild}` • **#{channel}**\n↳ **{mentioner}** — *{preview}*',
      title_card_note: '🏆 Tu título actual — ¡sigue acumulando! ❄️',
    },
    snow: {
      header:     '❄️ Snow Card — **{username}**',
      max_rank:   '👑 RANGO MÁXIMO — ¡Glacian\'s Chosen!',
      owner_rank: '◈ Monarca de las Sombras — Por encima de todos',
      next:       '⬆️ Próximo: **{name}** — faltan {pts} pts',
      sessions:   'Sesiones',
      total_time: 'Tiempo total AFK',
    },
    titles: {
      header:       '🏆 Sistema de 50 Títulos — Glacian',
      pts_label:    '❄️ Snow Points',
      current:      '🎖️ Título actual',
      owner_lbl:    '👑 Título',
      footer:       '1 Snow Point = 1 segundo AFK · El rango máximo requiere 5 años',
      unlocked:     'DESBLOQUEADO',
      locked:       'BLOQUEADO',
    },
    lang: {
      set:     '✅ ¡Idioma cambiado a **Español**! 🇪🇸',
      invalid: '❌ Idioma inválido. Usa `en`, `es` o `pt`.',
    },
    err: {
      no_user: '❌ Usuario no encontrado.',
      generic: '❌ Algo salió mal.',
    },
    status_many: 'Watching {n} people AFK',
    status_one:  'Watching 1 person AFK',
    status_none: 'No one AFK right now ❄️',
  },

  pt: {
    afk: {
      already:         '❄️ Você já está AFK desde <t:{ts}:R>. Envie uma mensagem para voltar.',
      activated:       'AFK Ativado',
      timer_set:       '⏱️ Temporizador: **{time}** — Vou te avisar no DM quando expirar!',
      reason_label:    'MOTIVO',
      from_label:      'DESDE',
      snow_label:      'SNOW POINTS',
      session_label:   'SESSÃO',
      ret_headline:    '🌟 {username} voltou!',
      ret_headline_owner: '◈ O Monarca das Sombras retorna...',
      ret_time:        '⏱️ Tempo AFK',
      ret_mentions:    '📨 Menções perdidas',
      ret_gained:      '❄️ Snow Points ganhos',
      ret_total:       '💎 Total acumulado',
      ret_title_lbl:   '🏆 Título',
      ret_next:        '⬆️ Próximo',
      ret_max:         '👑 RANK MÁXIMO — Glacian\'s Chosen!',
      ret_footer:      'AFK desativado ✅ · Atualizando cartão de título...',
      mention_notify:  '🌨️ **{name}** está AFK',
      mention_footer:  'Glacian avisará quando **{name}** voltar ❄️',
    },
    dm: {
      timer_title:     '⏱️ Seu temporizador AFK expirou!',
      timer_body:      'Você ficou AFK por **{duration}**.',
      timer_channel:   'Definido em: **{guild}** • #{channel}',
      mentions_title:  '📬 Menções enquanto você estava AFK',
      mentions_none:   'Ninguém te mencionou enquanto você estava ausente. 🌨️',
      mention_entry:   '**{n}.** `{guild}` • **#{channel}**\n↳ **{mentioner}** — *{preview}*',
      title_card_note: '🏆 Seu título atual — continue acumulando! ❄️',
    },
    snow: {
      header:     '❄️ Snow Card — **{username}**',
      max_rank:   '👑 RANK MÁXIMO — Glacian\'s Chosen!',
      owner_rank: '◈ Monarca das Sombras — Acima de todos',
      next:       '⬆️ Próximo: **{name}** — faltam {pts} pts',
      sessions:   'Sessões',
      total_time: 'Tempo total AFK',
    },
    titles: {
      header:       '🏆 Sistema de 50 Títulos — Glacian',
      pts_label:    '❄️ Snow Points',
      current:      '🎖️ Título atual',
      owner_lbl:    '👑 Título',
      footer:       '1 Snow Point = 1 segundo AFK · Rank máximo requer 5 anos',
      unlocked:     'DESBLOQUEADO',
      locked:       'BLOQUEADO',
    },
    lang: {
      set:     '✅ Idioma definido para **Português**! 🇧🇷',
      invalid: '❌ Idioma inválido. Use `en`, `es` ou `pt`.',
    },
    err: {
      no_user: '❌ Usuário não encontrado.',
      generic: '❌ Algo deu errado.',
    },
    status_many: 'Watching {n} people AFK',
    status_one:  'Watching 1 person AFK',
    status_none: 'No one AFK right now ❄️',
  },
};

/**
 * Translate a dot-path key with optional variable interpolation.
 * Falls back to English if the key is missing for the requested language.
 * @param {string} lang - 'en' | 'es' | 'pt'
 * @param {string} key  - dot-separated path e.g. 'afk.activated'
 * @param {object} vars - variables to interpolate e.g. { username: 'Alice' }
 */
export function t(lang, key, vars = {}) {
  const resolve = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);
  let str = resolve(STRINGS[lang] ?? STRINGS.en, key) ?? resolve(STRINGS.en, key) ?? key;
  if (typeof str !== 'string') return key;
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
}

export const VALID_LANGS = ['en', 'es', 'pt'];
