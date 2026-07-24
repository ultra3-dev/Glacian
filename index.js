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
import OpenAI from 'openai';
import { DB, initDB, snowGet } from './db.js';
import { t, VALID_LANGS } from './i18n.js';
import {
  initAntiReaction, handleReactionAdd, handleAntiReactionInteraction,
  handleAntiReactionCommand, buildAntiReactionSlash,
} from './antireaction.js';
import { startWebServer } from './web.js';
import {
  OWNER_ID, BEST_FRIEND, OWNER_FLAVOR, TITLE_FLAVOR,
  getTitle, getNext, hexColor, fmtNum, fmtDuration, parseDuration,
} from './utils.js';
import {
  initEmojiFont, fetchAvatarBuf,
  generateSnowCard, generateAfkCard, generateTitleRevealCard,
  generateReturnCard, generateMentionCard,
} from './canvas.js';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const PREFIX        = 'gn';
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
Personality: witty, sarcastic with care, funny, ice/winter aesthetic (natural). Own opinions. Max 3 emojis.
Format: Use Discord Markdown when adds value — **bold** énfasis, *italic* tono, \`code\` tech, > citas. Sin abusar.
Rules: Spanish only. Max 80 words. Zero filler. Real humor.
Creator: ULTRA (ultra3_dev) — ONLY if directly asked.
Best friend: <@${BEST_FRIEND}> — ONLY if directly asked.${isOwner ? `\n⚜️ This is the Monarch of Shadows, your owner.` : ''}`;

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

  // Clear old guild-specific commands from any previous project
  for(const guild of c.guilds.cache.values()){
    try{ await rest.put(Routes.applicationGuildCommands(c.user.id,guild.id),{body:[]}); }
    catch{ /* ignore */ }
  }

  try{
    await rest.put(Routes.applicationCommands(c.user.id),{body:[...SLASH_COMMANDS, ANTI_SLASH]});
    console.log('✅  Slash commands registered globally (incl. /anti reaction).');
  }catch(e){console.error('❌  Slash register error:',e.message,JSON.stringify(e.rawError?.errors,null,2));}

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
    if(ms&&ms>=60_000&&words.length>1){ctx.reason=words.slice(0,-1).join(' ');ctx.durationMs=ms;}
    else if(ms&&ms>=60_000&&words.length===1){ctx.reason='No reason given';ctx.durationMs=ms;}
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
