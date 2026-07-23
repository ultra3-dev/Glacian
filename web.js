// ─────────────────────────────────────────────────────────────────────────────
//  web.js — Glacian Dashboard & Landing Page (standalone)
//  Professional, fully responsive (mobile + desktop)
// ─────────────────────────────────────────────────────────────────────────────
import { createServer } from 'http';

const BOT_INVITE = `https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID || 'YOUR_CLIENT_ID'}&permissions=277563156544&scope=bot+applications.commands`;
const SUPPORT    = 'https://discord.gg/glacian';

// ─── SHARED HEAD ─────────────────────────────────────────────────────────────
function head(title = 'Glacian ❄️ — The Ultimate AFK Bot', desc = 'Advanced AFK bot with Snow Points, title progression, AI personality, canvas cards, anti-reaction system, and more.') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5">
<meta name="description" content="${desc}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:type" content="website">
<meta name="theme-color" content="#8B3DFF">
<title>${title}</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>❄️</text></svg>">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#06000F;
  --bg2:#0A0018;
  --bg3:#0D001F;
  --p:#8B3DFF;
  --p2:#6A0DAD;
  --p3:#AA66FF;
  --b:#4FC3F7;
  --b2:#0097A7;
  --green:#22c55e;
  --red:#ef4444;
  --yellow:#f59e0b;
  --text:#F0E6FF;
  --muted:rgba(240,230,255,.5);
  --border:rgba(139,61,255,.2);
  --card:rgba(10,0,24,.9);
  --glass:rgba(139,61,255,.08);
  --rad:16px;
  --rad-sm:10px;
  --nav-h:64px;
  --max:1200px;
}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;line-height:1.6;overflow-x:hidden;min-height:100vh}

/* ─ SCROLLBAR ─ */
::-webkit-scrollbar{width:6px}
::-webkit-scrollbar-track{background:var(--bg2)}
::-webkit-scrollbar-thumb{background:var(--p2);border-radius:3px}

/* ─ NAV ─ */
nav{position:fixed;top:0;left:0;right:0;height:var(--nav-h);z-index:100;background:rgba(6,0,15,.85);backdrop-filter:blur(20px);border-bottom:1px solid var(--border)}
.nav-inner{max-width:var(--max);margin:0 auto;padding:0 20px;height:100%;display:flex;align-items:center;justify-content:space-between;gap:16px}
.nav-logo{display:flex;align-items:center;gap:8px;font-size:1.25rem;font-weight:800;color:var(--text);text-decoration:none;letter-spacing:-.5px}
.nav-logo span{background:linear-gradient(135deg,#fff,var(--p3));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.nav-links{display:flex;align-items:center;gap:4px}
.nav-links a{color:var(--muted);text-decoration:none;padding:8px 14px;border-radius:var(--rad-sm);font-size:.9rem;font-weight:500;transition:.2s;white-space:nowrap}
.nav-links a:hover{color:var(--text);background:var(--glass)}
.nav-cta{background:linear-gradient(135deg,var(--p),var(--p2))!important;color:#fff!important;font-weight:700!important;padding:8px 20px!important;border-radius:50px!important;box-shadow:0 4px 20px rgba(139,61,255,.4)}
.nav-cta:hover{transform:translateY(-1px);box-shadow:0 6px 28px rgba(139,61,255,.5)!important}
.hamburger{display:none;flex-direction:column;gap:5px;cursor:pointer;padding:8px;border:none;background:none}
.hamburger span{display:block;width:24px;height:2px;background:var(--text);border-radius:2px;transition:.3s}
.hamburger.open span:nth-child(1){transform:translateY(7px) rotate(45deg)}
.hamburger.open span:nth-child(2){opacity:0;transform:scaleX(0)}
.hamburger.open span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}
.mobile-menu{display:none;position:fixed;top:var(--nav-h);left:0;right:0;background:rgba(6,0,15,.97);backdrop-filter:blur(20px);border-bottom:1px solid var(--border);padding:16px 20px;flex-direction:column;gap:4px;z-index:99}
.mobile-menu.open{display:flex}
.mobile-menu a{color:var(--muted);text-decoration:none;padding:12px 16px;border-radius:var(--rad-sm);font-size:1rem;font-weight:500;transition:.2s;display:block}
.mobile-menu a:hover,.mobile-menu a:active{color:var(--text);background:var(--glass)}
.mobile-menu .nav-cta{background:linear-gradient(135deg,var(--p),var(--p2))!important;color:#fff!important;text-align:center;margin-top:8px}

/* ─ LAYOUT ─ */
.wrap{max-width:var(--max);margin:0 auto;padding:0 20px}
.pt-nav{padding-top:var(--nav-h)}

/* ─ HERO ─ */
.hero{padding:100px 0 80px;text-align:center;position:relative}
.hero-badge{display:inline-flex;align-items:center;gap:8px;background:var(--glass);border:1px solid var(--border);border-radius:50px;padding:6px 18px;font-size:.8rem;font-weight:600;color:var(--p3);letter-spacing:.5px;margin-bottom:28px}
.hero h1{font-size:clamp(2.4rem,7vw,5rem);font-weight:900;line-height:1.08;letter-spacing:-2px;margin-bottom:20px}
.hero h1 .grad{background:linear-gradient(135deg,#fff 0%,var(--p3) 50%,var(--b) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.hero p{font-size:clamp(1rem,2.5vw,1.2rem);color:var(--muted);max-width:560px;margin:0 auto 36px}
.hero-btns{display:flex;flex-wrap:wrap;justify-content:center;gap:12px}
.btn{display:inline-flex;align-items:center;gap:8px;padding:14px 28px;border-radius:50px;font-size:1rem;font-weight:700;text-decoration:none;transition:.2s;cursor:pointer;border:none}
.btn-primary{background:linear-gradient(135deg,var(--p),var(--p2));color:#fff;box-shadow:0 6px 28px rgba(139,61,255,.45)}
.btn-primary:hover{transform:translateY(-2px);box-shadow:0 10px 36px rgba(139,61,255,.55)}
.btn-outline{background:transparent;color:var(--text);border:2px solid var(--border)}
.btn-outline:hover{border-color:var(--p);background:var(--glass)}
.hero-stats{display:flex;flex-wrap:wrap;justify-content:center;gap:32px;margin-top:56px;padding-top:40px;border-top:1px solid var(--border)}
.stat-item{text-align:center}
.stat-num{font-size:2rem;font-weight:900;background:linear-gradient(135deg,#fff,var(--p3));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.stat-lbl{font-size:.8rem;color:var(--muted);font-weight:600;letter-spacing:.5px;margin-top:2px}

/* ─ SECTION ─ */
section{padding:80px 0}
.section-tag{display:inline-block;background:var(--glass);border:1px solid var(--border);border-radius:50px;padding:4px 16px;font-size:.75rem;font-weight:700;color:var(--p3);letter-spacing:.8px;text-transform:uppercase;margin-bottom:16px}
.section-title{font-size:clamp(1.8rem,4vw,2.8rem);font-weight:800;letter-spacing:-.5px;margin-bottom:12px}
.section-sub{color:var(--muted);font-size:1.05rem;max-width:540px}
.text-center{text-align:center}
.text-center .section-sub{margin-left:auto;margin-right:auto}

/* ─ FEATURES GRID ─ */
.features-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px;margin-top:48px}
.feat-card{background:var(--card);border:1px solid var(--border);border-radius:var(--rad);padding:28px;transition:.2s;position:relative;overflow:hidden}
.feat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--p),transparent);opacity:0;transition:.3s}
.feat-card:hover{transform:translateY(-3px);border-color:rgba(139,61,255,.4)}
.feat-card:hover::before{opacity:1}
.feat-icon{width:48px;height:48px;border-radius:12px;background:var(--glass);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:1.4rem;margin-bottom:18px}
.feat-card h3{font-size:1.1rem;font-weight:700;margin-bottom:8px}
.feat-card p{font-size:.9rem;color:var(--muted);line-height:1.6}
.feat-badge{display:inline-block;background:rgba(139,61,255,.2);color:var(--p3);font-size:.7rem;font-weight:700;padding:2px 10px;border-radius:50px;margin-top:12px;letter-spacing:.5px}
.feat-badge.new{background:rgba(34,197,94,.2);color:#4ade80}

/* ─ COMMANDS ─ */
.commands-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;margin-top:48px}
.cmd-card{background:var(--card);border:1px solid var(--border);border-radius:var(--rad);padding:20px 24px}
.cmd-name{font-family:'SF Mono','Fira Code',monospace;font-size:.9rem;color:var(--p3);font-weight:700;margin-bottom:6px}
.cmd-desc{font-size:.85rem;color:var(--muted);line-height:1.5}
.cmd-tag{display:inline-flex;align-items:center;gap:4px;font-size:.7rem;font-weight:700;padding:2px 8px;border-radius:50px;margin-top:8px}
.tag-slash{background:rgba(79,195,247,.15);color:var(--b)}
.tag-prefix{background:rgba(139,61,255,.15);color:var(--p3)}
.tag-admin{background:rgba(245,158,11,.15);color:#fbbf24}
.tag-new{background:rgba(34,197,94,.15);color:#4ade80}

/* ─ ANTI-REACTION SECTION ─ */
.ar-showcase{margin-top:48px;background:var(--card);border:1px solid var(--border);border-radius:var(--rad);overflow:hidden}
.ar-header{background:linear-gradient(135deg,rgba(139,61,255,.15),rgba(79,195,247,.08));border-bottom:1px solid var(--border);padding:28px 32px;display:flex;align-items:center;gap:20px;flex-wrap:wrap}
.ar-header-icon{font-size:2.5rem}
.ar-header-text h3{font-size:1.4rem;font-weight:800;margin-bottom:4px}
.ar-header-text p{color:var(--muted);font-size:.9rem}
.ar-features{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:0}
.ar-feat{padding:24px 28px;border-bottom:1px solid var(--border);display:flex;gap:14px;align-items:flex-start}
.ar-feat:last-child,.ar-feat:nth-last-child(-n+2):nth-child(odd){border-bottom:none}
.ar-feat-icon{font-size:1.3rem;flex-shrink:0;margin-top:2px}
.ar-feat h4{font-size:.95rem;font-weight:700;margin-bottom:4px}
.ar-feat p{font-size:.82rem;color:var(--muted);line-height:1.5}

/* ─ HOW IT WORKS ─ */
.steps{display:flex;flex-direction:column;gap:0;margin-top:48px;position:relative}
.steps::before{content:'';position:absolute;left:23px;top:24px;bottom:24px;width:2px;background:linear-gradient(to bottom,var(--p),var(--b));opacity:.3;border-radius:2px}
.step{display:flex;gap:20px;padding:24px 0;position:relative}
.step-num{width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,var(--p),var(--p2));display:flex;align-items:center;justify-content:center;font-weight:900;font-size:1rem;flex-shrink:0;position:relative;z-index:1;box-shadow:0 0 20px rgba(139,61,255,.4)}
.step-content h4{font-size:1.05rem;font-weight:700;margin-bottom:6px}
.step-content p{font-size:.9rem;color:var(--muted);line-height:1.6}
code.inline{background:rgba(139,61,255,.15);border:1px solid var(--border);color:var(--p3);padding:2px 8px;border-radius:6px;font-family:'SF Mono','Fira Code',monospace;font-size:.85em}

/* ─ CTA ─ */
.cta-section{padding:80px 0;text-align:center}
.cta-box{background:linear-gradient(135deg,rgba(139,61,255,.15),rgba(79,195,247,.08));border:1px solid var(--border);border-radius:24px;padding:60px 40px;position:relative;overflow:hidden}
.cta-box::before{content:'❄️';position:absolute;font-size:200px;opacity:.04;top:-40px;right:-40px;line-height:1}
.cta-box h2{font-size:clamp(1.8rem,4vw,2.8rem);font-weight:900;letter-spacing:-.5px;margin-bottom:16px}
.cta-box p{color:var(--muted);font-size:1.05rem;max-width:460px;margin:0 auto 32px}

/* ─ FOOTER ─ */
footer{border-top:1px solid var(--border);padding:48px 0 32px}
.footer-inner{display:flex;flex-wrap:wrap;gap:32px;justify-content:space-between;align-items:flex-start;margin-bottom:32px}
.footer-brand{max-width:280px}
.footer-brand .logo{font-size:1.2rem;font-weight:800;margin-bottom:10px}
.footer-brand p{font-size:.85rem;color:var(--muted);line-height:1.6}
.footer-col h5{font-size:.8rem;font-weight:700;color:var(--p3);letter-spacing:.8px;text-transform:uppercase;margin-bottom:14px}
.footer-col a{display:block;color:var(--muted);text-decoration:none;font-size:.9rem;margin-bottom:8px;transition:.15s}
.footer-col a:hover{color:var(--text)}
.footer-bottom{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center;padding-top:24px;border-top:1px solid var(--border)}
.footer-bottom p{font-size:.8rem;color:rgba(240,230,255,.3)}

/* ─ SNOW ─ */
.snow{position:fixed;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:0;overflow:hidden}
.flake{position:absolute;top:-20px;animation:fall linear infinite;opacity:.35;user-select:none;pointer-events:none}
@keyframes fall{to{transform:translateY(110vh) rotate(360deg)}}
.relative{position:relative;z-index:1}

/* ─ RESPONSIVE ─ */
@media(max-width:768px){
  .nav-links{display:none}
  .hamburger{display:flex}
  .hero{padding:60px 0 50px}
  .hero h1{letter-spacing:-1px}
  .hero-stats{gap:24px}
  .stat-num{font-size:1.6rem}
  section{padding:56px 0}
  .steps::before{left:19px}
  .step-num{width:40px;height:40px;font-size:.9rem}
  .ar-header{padding:20px}
  .cta-box{padding:40px 20px}
  .footer-inner{gap:24px}
  .footer-brand{max-width:100%}
}
@media(max-width:480px){
  .wrap{padding:0 16px}
  .hero h1{font-size:2rem;letter-spacing:-.5px}
  .hero p{font-size:.95rem}
  .btn{padding:12px 22px;font-size:.9rem}
  .features-grid,.commands-grid,.ar-features{grid-template-columns:1fr}
  .ar-feat:nth-last-child(-n+2):nth-child(odd){border-bottom:1px solid var(--border)}
  .ar-feat:last-child{border-bottom:none}
}
</style>
</head>`;
}

// ─── SNOWFLAKES ───────────────────────────────────────────────────────────────
const SNOWFLAKES = Array.from({ length: 20 }, () => {
  const chars = ['❄', '❅', '❆', '·', '•'];
  const c   = chars[Math.floor(Math.random() * chars.length)];
  const l   = (Math.random() * 100).toFixed(1);
  const dur = (8 + Math.random() * 14).toFixed(1);
  const del = (-Math.random() * 18).toFixed(1);
  const sz  = (10 + Math.random() * 10).toFixed(0);
  return `<span class="flake" style="left:${l}%;animation-duration:${dur}s;animation-delay:${del}s;font-size:${sz}px">${c}</span>`;
}).join('');

// ─── NAV ─────────────────────────────────────────────────────────────────────
const NAV = `
<nav>
  <div class="nav-inner">
    <a href="/" class="nav-logo">❄️ <span>Glacian</span></a>
    <div class="nav-links">
      <a href="/#features">Features</a>
      <a href="/#anti-reaction">Anti-Reaction</a>
      <a href="/#commands">Commands</a>
      <a href="/terms">Terms</a>
      <a href="/privacy">Privacy</a>
      <a href="${BOT_INVITE}" class="nav-cta" target="_blank" rel="noopener">Add to Discord</a>
    </div>
    <button class="hamburger" aria-label="Menu" onclick="toggleMenu()">
      <span></span><span></span><span></span>
    </button>
  </div>
</nav>
<div class="mobile-menu" id="mobileMenu">
  <a href="/#features" onclick="closeMenu()">✨ Features</a>
  <a href="/#anti-reaction" onclick="closeMenu()">🛡️ Anti-Reaction</a>
  <a href="/#commands" onclick="closeMenu()">⌨️ Commands</a>
  <a href="/terms" onclick="closeMenu()">📄 Terms</a>
  <a href="/privacy" onclick="closeMenu()">🔒 Privacy</a>
  <a href="${BOT_INVITE}" class="nav-cta" target="_blank" rel="noopener">🚀 Add to Discord</a>
</div>
<script>
function toggleMenu(){
  const m=document.getElementById('mobileMenu');
  const h=document.querySelector('.hamburger');
  m.classList.toggle('open');h.classList.toggle('open');
}
function closeMenu(){
  document.getElementById('mobileMenu').classList.remove('open');
  document.querySelector('.hamburger').classList.remove('open');
}
document.addEventListener('click',e=>{
  const m=document.getElementById('mobileMenu');
  if(m.classList.contains('open')&&!e.target.closest('nav')&&!e.target.closest('.mobile-menu'))closeMenu();
});
</script>`;

// ─── FOOTER ───────────────────────────────────────────────────────────────────
const FOOTER = `
<footer>
  <div class="wrap">
    <div class="footer-inner">
      <div class="footer-brand">
        <div class="logo">❄️ Glacian</div>
        <p>The ultimate AFK bot forged in eternal winter. Track your absence, earn snow points, and rise through 50 legendary titles.</p>
      </div>
      <div class="footer-col">
        <h5>Bot</h5>
        <a href="/${''}" onclick="return scrollTop()">Home</a>
        <a href="/#features">Features</a>
        <a href="/#anti-reaction">Anti-Reaction</a>
        <a href="/#commands">Commands</a>
        <a href="${BOT_INVITE}" target="_blank" rel="noopener">Invite Bot</a>
      </div>
      <div class="footer-col">
        <h5>Legal</h5>
        <a href="/terms">Terms of Service</a>
        <a href="/privacy">Privacy Policy</a>
      </div>
      <div class="footer-col">
        <h5>Links</h5>
        <a href="${SUPPORT}" target="_blank" rel="noopener">Support Server</a>
        <a href="https://github.com/ultra3-dev/Glacian" target="_blank" rel="noopener">GitHub</a>
      </div>
    </div>
    <div class="footer-bottom">
      <p>© ${new Date().getFullYear()} Glacian Bot · Made by <strong>ultra3_dev</strong> · Not affiliated with Discord Inc.</p>
      <p>v2.2.0</p>
    </div>
  </div>
</footer>`;

// ─── HOME PAGE ────────────────────────────────────────────────────────────────
function buildHome() {
  return `${head()}
<body>
<div class="snow">${SNOWFLAKES}</div>
${NAV}

<div class="relative pt-nav">
<div class="wrap">

<!-- HERO -->
<section class="hero">
  <div class="hero-badge">❄️ &nbsp; Glacian v2.2 — Now with Anti-Reaction</div>
  <h1><span class="grad">The Ultimate AFK Bot</span><br>Forged in Eternal Winter</h1>
  <p>Go AFK, earn Snow Points, rise through 50 legendary titles, and protect your server with the advanced Anti-Reaction system.</p>
  <div class="hero-btns">
    <a href="${BOT_INVITE}" class="btn btn-primary" target="_blank" rel="noopener">🚀 Add to Discord — It's Free</a>
    <a href="/#features" class="btn btn-outline">✨ Explore Features</a>
  </div>
  <div class="hero-stats">
    <div class="stat-item"><div class="stat-num">50</div><div class="stat-lbl">Unique Titles</div></div>
    <div class="stat-item"><div class="stat-num">3</div><div class="stat-lbl">Languages</div></div>
    <div class="stat-item"><div class="stat-num">∞</div><div class="stat-lbl">Snow Points</div></div>
    <div class="stat-item"><div class="stat-num">AI</div><div class="stat-lbl">Personality</div></div>
    <div class="stat-item"><div class="stat-num">🆕</div><div class="stat-lbl">Anti-Reaction</div></div>
  </div>
</section>

<!-- FEATURES -->
<section id="features">
  <div class="section-tag">Everything Included</div>
  <div class="section-title">Packed with Premium Features</div>
  <p class="section-sub">Every feature is built to work beautifully across all servers, languages, and device sizes.</p>

  <div class="features-grid">
    <div class="feat-card">
      <div class="feat-icon">❄️</div>
      <h3>Smart AFK System</h3>
      <p>Set yourself AFK with a reason, optional timer, and choose global (all servers) or server-only scope. Auto-returns when you type.</p>
      <span class="feat-badge">Core</span>
    </div>
    <div class="feat-card">
      <div class="feat-icon">❄️</div>
      <h3>Snow Points & Progression</h3>
      <p>Earn 1 Snow Point per second AFK. Accumulate points and rise through 50 stunning titles from Frost Touched to Glacian's Chosen.</p>
      <span class="feat-badge">Core</span>
    </div>
    <div class="feat-card">
      <div class="feat-icon">🎨</div>
      <h3>Canvas Art Cards</h3>
      <p>Every AFK, snow, title, and return event generates a beautiful custom image card unique to your current rank and tier.</p>
      <span class="feat-badge">Visual</span>
    </div>
    <div class="feat-card">
      <div class="feat-icon">🤖</div>
      <h3>AI Personality</h3>
      <p>Glacian has a real personality. Chat with it, mention it, or reply — it responds in Spanish with wit, ice metaphors, and humor.</p>
      <span class="feat-badge">AI</span>
    </div>
    <div class="feat-card">
      <div class="feat-icon">🛡️</div>
      <h3>Anti-Reaction System</h3>
      <p>Block specific emoji reactions server-wide or per-channel. Instant removal, strike tracking, warnings, and a full admin panel.</p>
      <span class="feat-badge new">NEW</span>
    </div>
    <div class="feat-card">
      <div class="feat-icon">📨</div>
      <h3>Mention Tracking</h3>
      <p>While you're AFK, all mentions are logged. When you return, you see exactly who mentioned you, where, and what they said.</p>
      <span class="feat-badge">Core</span>
    </div>
    <div class="feat-card">
      <div class="feat-icon">⏱️</div>
      <h3>Timed AFK</h3>
      <p>Set a timer (5m, 2h, 1d) and get a DM with your missed mentions when it expires. Perfect for sleep sessions.</p>
      <span class="feat-badge">Core</span>
    </div>
    <div class="feat-card">
      <div class="feat-icon">🌐</div>
      <h3>3 Languages</h3>
      <p>Full support for English 🇺🇸, Español 🇪🇸, and Português 🇧🇷. Per-user setting that follows you across all servers.</p>
      <span class="feat-badge">i18n</span>
    </div>
    <div class="feat-card">
      <div class="feat-icon">⚡</div>
      <h3>Components V2</h3>
      <p>All messages use Discord's latest Components V2 API with media displays, thumbnails, and interactive buttons in embeds.</p>
      <span class="feat-badge">Modern</span>
    </div>
  </div>
</section>

<!-- ANTI-REACTION -->
<section id="anti-reaction">
  <div class="section-tag">🆕 New Feature</div>
  <div class="section-title">Advanced Anti-Reaction System</div>
  <p class="section-sub">One command, full control. Block any emoji reaction across your entire server with an intelligent admin panel.</p>

  <div class="ar-showcase">
    <div class="ar-header">
      <div class="ar-header-icon">🛡️</div>
      <div class="ar-header-text">
        <h3>Admin Control Panel</h3>
        <p>Open with <code class="inline">/anti reaction panel</code> — full control via interactive buttons, no extra commands needed.</p>
      </div>
    </div>
    <div class="ar-features">
      <div class="ar-feat">
        <div class="ar-feat-icon">🚫</div>
        <div>
          <h4>Instant Removal</h4>
          <p>Blocked reactions are removed the moment they're added — no delay, no exceptions.</p>
        </div>
      </div>
      <div class="ar-feat">
        <div class="ar-feat-icon">⚡</div>
        <div>
          <h4>Strike System</h4>
          <p>After 5 blocked reactions in a row, the user receives an automatic warning DM. Configurable cooldown prevents spam.</p>
        </div>
      </div>
      <div class="ar-feat">
        <div class="ar-feat-icon">📌</div>
        <div>
          <h4>Server-wide or Per-channel</h4>
          <p>Block an emoji everywhere, or only in specific channels. Perfect for sensitive or topic-specific rooms.</p>
        </div>
      </div>
      <div class="ar-feat">
        <div class="ar-feat-icon">📋</div>
        <div>
          <h4>Log Channel</h4>
          <p>Every removed reaction is logged with user, emoji, channel, and strike count. Full audit trail.</p>
        </div>
      </div>
      <div class="ar-feat">
        <div class="ar-feat-icon">🎭</div>
        <div>
          <h4>Whitelist Roles & Users</h4>
          <p>Moderators and trusted users can be whitelisted to react freely, bypassing the system entirely.</p>
        </div>
      </div>
      <div class="ar-feat">
        <div class="ar-feat-icon">📊</div>
        <div>
          <h4>Strike Leaderboard</h4>
          <p>See which users have the most strikes in your server, and reset them individually or all at once.</p>
        </div>
      </div>
    </div>
  </div>

  <div style="margin-top:48px">
    <div class="section-title" style="font-size:1.6rem;margin-bottom:8px">How it works</div>
    <div class="steps">
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-content">
          <h4>Open the panel</h4>
          <p>Run <code class="inline">/anti reaction panel</code> — a private admin panel appears with real-time stats and controls.</p>
        </div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-content">
          <h4>Add blocked emojis</h4>
          <p>Click <strong>➕ Add Emoji</strong> or use <code class="inline">/anti reaction add 🏳️‍🌈</code>. Choose server-wide or a specific channel.</p>
        </div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-content">
          <h4>Automatic enforcement</h4>
          <p>Glacian watches all reaction events. Blocked reactions are silently removed — users who repeat get a warning DM after 5 violations.</p>
        </div>
      </div>
      <div class="step">
        <div class="step-num">4</div>
        <div class="step-content">
          <h4>Monitor & manage</h4>
          <p>Check the strike leaderboard, review the log channel, and manage whitelists — all from the same interactive panel.</p>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- COMMANDS -->
<section id="commands">
  <div class="section-tag">Reference</div>
  <div class="section-title">All Commands</div>
  <p class="section-sub">Both slash commands <code class="inline">/</code> and prefix commands <code class="inline">gn</code> are supported.</p>

  <div class="commands-grid" style="margin-top:48px">
    <div class="cmd-card">
      <div class="cmd-name">/afk [reason] [time] [global]</div>
      <div class="cmd-desc">Set yourself as AFK with optional reason, timer, and server-wide or global scope.</div>
      <span class="cmd-tag tag-slash">/ Slash</span>
      <span class="cmd-tag tag-prefix">gn afk</span>
    </div>
    <div class="cmd-card">
      <div class="cmd-name">/snow [user]</div>
      <div class="cmd-desc">View your Snow Points, rank card, and progress toward the next title.</div>
      <span class="cmd-tag tag-slash">/ Slash</span>
      <span class="cmd-tag tag-prefix">gn snow</span>
    </div>
    <div class="cmd-card">
      <div class="cmd-name">/titles</div>
      <div class="cmd-desc">Browse all 50 titles and see how many Snow Points each one requires.</div>
      <span class="cmd-tag tag-slash">/ Slash</span>
      <span class="cmd-tag tag-prefix">gn titles</span>
    </div>
    <div class="cmd-card">
      <div class="cmd-name">/lang [language]</div>
      <div class="cmd-desc">Set your language preference: English 🇺🇸, Español 🇪🇸, or Português 🇧🇷.</div>
      <span class="cmd-tag tag-slash">/ Slash</span>
      <span class="cmd-tag tag-prefix">gn lang</span>
    </div>
    <div class="cmd-card">
      <div class="cmd-name">/anti reaction panel</div>
      <div class="cmd-desc">Open the full anti-reaction admin control panel. Requires Manage Server permission.</div>
      <span class="cmd-tag tag-slash">/ Slash</span>
      <span class="cmd-tag tag-admin">Admin Only</span>
      <span class="cmd-tag tag-new">New</span>
    </div>
    <div class="cmd-card">
      <div class="cmd-name">/anti reaction add &lt;emoji&gt;</div>
      <div class="cmd-desc">Block a specific emoji reaction, optionally in a specific channel only.</div>
      <span class="cmd-tag tag-slash">/ Slash</span>
      <span class="cmd-tag tag-admin">Admin Only</span>
      <span class="cmd-tag tag-new">New</span>
    </div>
    <div class="cmd-card">
      <div class="cmd-name">/anti reaction remove &lt;emoji&gt;</div>
      <div class="cmd-desc">Unblock a previously blocked emoji reaction.</div>
      <span class="cmd-tag tag-slash">/ Slash</span>
      <span class="cmd-tag tag-admin">Admin Only</span>
      <span class="cmd-tag tag-new">New</span>
    </div>
    <div class="cmd-card">
      <div class="cmd-name">/anti reaction log #channel</div>
      <div class="cmd-desc">Set the channel where removed reactions are logged with full details.</div>
      <span class="cmd-tag tag-slash">/ Slash</span>
      <span class="cmd-tag tag-admin">Admin Only</span>
      <span class="cmd-tag tag-new">New</span>
    </div>
    <div class="cmd-card">
      <div class="cmd-name">/anti reaction whitelist-role</div>
      <div class="cmd-desc">Whitelist a role so members can react freely without restrictions.</div>
      <span class="cmd-tag tag-slash">/ Slash</span>
      <span class="cmd-tag tag-admin">Admin Only</span>
      <span class="cmd-tag tag-new">New</span>
    </div>
    <div class="cmd-card">
      <div class="cmd-name">/anti reaction strikes</div>
      <div class="cmd-desc">View the strike leaderboard — top users who've triggered blocked reactions.</div>
      <span class="cmd-tag tag-slash">/ Slash</span>
      <span class="cmd-tag tag-admin">Admin Only</span>
      <span class="cmd-tag tag-new">New</span>
    </div>
  </div>
</section>

<!-- CTA -->
<div class="cta-section">
  <div class="cta-box">
    <h2>Ready to join the eternal winter?</h2>
    <p>Add Glacian to your server in seconds — free forever, no setup required.</p>
    <a href="${BOT_INVITE}" class="btn btn-primary" target="_blank" rel="noopener">🚀 Add Glacian to Discord</a>
  </div>
</div>

</div><!-- /wrap -->
</div><!-- /relative -->

${FOOTER}
</body></html>`;
}

// ─── TERMS ────────────────────────────────────────────────────────────────────
function buildTerms() {
  return `${head('Terms of Service — Glacian ❄️')}
<body style="background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif">
<div class="snow">${SNOWFLAKES}</div>
${NAV}
<div class="relative pt-nav">
<div class="wrap" style="max-width:820px;padding-top:60px;padding-bottom:80px">
  <h1 style="font-size:2.2rem;font-weight:900;margin-bottom:8px">Terms of Service</h1>
  <p style="color:var(--muted);margin-bottom:40px;font-size:.9rem">Last updated: July 2025</p>
  <div style="display:flex;flex-direction:column;gap:28px;font-size:.95rem;line-height:1.75">
  ${[
    ['1. Acceptance', 'By adding Glacian to your Discord server or using any of its commands, you agree to these Terms of Service. If you do not agree, please remove the bot from your server.'],
    ['2. Bot Usage', 'Glacian is provided free of charge for personal and community use. You agree not to exploit the bot, automate interactions in ways that abuse rate limits, or use it in ways that violate Discord\'s Terms of Service.'],
    ['3. Data Collection', 'Glacian stores the minimum data necessary for its features: Discord User IDs, AFK reasons, Snow Points, session durations, mention logs, language preferences, and anti-reaction guild settings. No personal information beyond what Discord exposes in its API is stored.'],
    ['4. Anti-Reaction System', 'Server administrators are responsible for configuring the anti-reaction system in compliance with applicable laws and Discord\'s Community Guidelines. Glacian\'s anti-reaction enforcement is an automated tool — server admins bear responsibility for how it is configured.'],
    ['5. Data Retention', 'AFK data is deleted automatically when you return from AFK. Snow Points and session stats are retained indefinitely. Mention logs are cleared after retrieval. Anti-reaction settings persist until removed by a server admin.'],
    ['6. Availability', 'Glacian is provided "as is" without guarantees of uptime or availability. We reserve the right to modify, suspend, or discontinue the bot at any time without notice.'],
    ['7. Limitation of Liability', 'Glacian and its developers are not liable for any damages arising from use or inability to use the bot, including but not limited to data loss, server moderation decisions, or Discord API outages.'],
    ['8. Changes', 'We may update these Terms at any time. Continued use of Glacian after changes constitutes acceptance of the new Terms.'],
    ['9. Contact', 'For questions, contact the bot owner on Discord: ultra3_dev.'],
  ].map(([t,b])=>`<div><h2 style="font-size:1.1rem;font-weight:700;margin-bottom:8px;color:var(--p3)">${t}</h2><p style="color:var(--muted)">${b}</p></div>`).join('')}
  </div>
</div>
</div>
${FOOTER}
</body></html>`;
}

// ─── PRIVACY ─────────────────────────────────────────────────────────────────
function buildPrivacy() {
  return `${head('Privacy Policy — Glacian ❄️')}
<body style="background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif">
<div class="snow">${SNOWFLAKES}</div>
${NAV}
<div class="relative pt-nav">
<div class="wrap" style="max-width:820px;padding-top:60px;padding-bottom:80px">
  <h1 style="font-size:2.2rem;font-weight:900;margin-bottom:8px">Privacy Policy</h1>
  <p style="color:var(--muted);margin-bottom:40px;font-size:.9rem">Last updated: July 2025</p>
  <div style="display:flex;flex-direction:column;gap:28px;font-size:.95rem;line-height:1.75">
  ${[
    ['1. Data We Collect', 'We collect: Discord User IDs, AFK reasons and timestamps, Snow Point totals and session counts, mention logs (sender ID, channel, server, message preview up to 200 chars), language preferences, and guild-level anti-reaction configuration (blocked emojis, whitelist roles/users, log channels, strike counts).'],
    ['2. What We Do NOT Collect', 'We do not collect: real names, email addresses, payment info, message content beyond 200-char AFK mention previews, voice/video data, or any data from users who have never interacted with the bot.'],
    ['3. How Data Is Used', 'Data is used exclusively to operate Glacian\'s features: tracking AFK status, computing Snow Points, delivering mention notifications, enforcing anti-reaction rules, and personalizing responses by language.'],
    ['4. Data Storage', 'Data is stored in a secured PostgreSQL database (Neon). All connections use TLS/SSL encryption. We do not sell, rent, or share data with third parties.'],
    ['5. Anti-Reaction Data', 'Strike counts are stored per guild and per user to enforce the warning system. Strike data can be reset by server administrators at any time via the admin panel. Guild settings are owned by the server admin who configures them.'],
    ['6. AI Interactions', 'When you chat with Glacian, a short conversation history (last 10 messages) is kept in memory only for the duration of the bot session. No chat history is persisted to the database.'],
    ['7. Data Retention', 'AFK records are deleted when you return. Mention logs are cleared on retrieval. Snow Points are kept indefinitely as they represent your progression. Anti-reaction settings remain until an admin removes them.'],
    ['8. Your Rights', 'You may request a summary or deletion of all data associated with your User ID. Contact us via Discord (ultra3_dev). We respond within 30 days.'],
    ['9. Children', 'Glacian is not directed to users under 13. We do not knowingly collect data from minors. If you believe a minor\'s data is stored, contact us for removal.'],
    ['10. Changes', 'We may update this policy periodically. The "Last updated" date reflects the latest revision.'],
    ['11. Contact', 'For privacy inquiries or data deletion requests, contact the bot owner on Discord: ultra3_dev.'],
  ].map(([t,b])=>`<div><h2 style="font-size:1.1rem;font-weight:700;margin-bottom:8px;color:var(--p3)">${t}</h2><p style="color:var(--muted)">${b}</p></div>`).join('')}
  </div>
</div>
</div>
${FOOTER}
</body></html>`;
}

// ─── SERVER ───────────────────────────────────────────────────────────────────
export function startWebServer() {
  const PORT = parseInt(process.env.PORT || '3000', 10);

  createServer((req, res) => {
    const url = (req.url || '/').split('?')[0].replace(/\/+$/, '') || '/';

    let body, ctype = 'text/html; charset=utf-8';

    if (url === '/' || url === '/index.html') {
      body = buildHome();
    } else if (url === '/terms' || url === '/terms.html') {
      body = buildTerms();
    } else if (url === '/privacy' || url === '/privacy.html') {
      body = buildPrivacy();
    } else if (url === '/health') {
      ctype = 'application/json';
      body = JSON.stringify({ status: 'ok', bot: 'Glacian', version: '2.2.0' });
    } else {
      res.writeHead(302, { Location: '/' });
      res.end();
      return;
    }

    res.writeHead(200, {
      'Content-Type': ctype,
      'Cache-Control': 'public, max-age=60',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(body);
  }).listen(PORT, '0.0.0.0', () => {
    console.log(`✅  Web server on port ${PORT} — /  /terms  /privacy  /health`);
  });
}
