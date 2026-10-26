// @ts-nocheck
"use client";
/* Token-Metal Onboarding Quest — React wrapper around the vanilla-JS engine. */

import { useEffect, useRef } from "react";

export type QuestResult = {
  key: "guardian" | "explorer" | "adventurer" | "berserker";
  risk: "low" | "medium" | "high";
  total: number;
  stats: number[];
  inconsistent: boolean;
};

type Props = {
  open: boolean;
  lang?: "en" | "es";
  skin?: "metal" | "glass" | "plush" | "grid" | "cryptodays";
  onComplete: (result: QuestResult | null) => void;
};

const QUEST_CSS = `
.tmq{--glass:rgba(14,20,24,.88);--edge:rgba(255,255,255,.08);--slate:#0f1a1f;--slate-deep:#0a1316;--slate-ink:#06090c;
 --on-slate:#f5f7fa;--on-slate-dim:#9ba7b0;--ink:#f5f7fa;--ink-dim:#9ba7b0;--line:rgba(255,255,255,.08);
 --mint:#84f3be;--mint-deep:#4ec49a;--mint-soft:rgba(132,243,190,.14);--mint-ring:rgba(132,243,190,.3);
 --blue:#ff6f2e;--blue-deep:#d0531a;--gold:#84f3be;--gold-deep:#4ec49a;--good:#4ade80;--bad:#fb7185;--sparkle:#ff6f2e;
 --f-display:var(--font-inter),"Inter","SF Pro Text",system-ui,-apple-system,"Segoe UI",sans-serif;
 --f-body:var(--font-inter),"Inter","SF Pro Text",system-ui,-apple-system,"Segoe UI",sans-serif;
 --f-pixel:var(--font-jetbrains),"JetBrains Mono","IBM Plex Mono","SFMono-Regular",Menlo,monospace;
 position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;
 background:radial-gradient(ellipse at 20% 10%,rgba(132,243,190,.14),transparent 55%),radial-gradient(ellipse at 85% 90%,rgba(255,111,46,.1),transparent 55%),rgba(5,8,11,.72);
 backdrop-filter:blur(18px) saturate(140%);-webkit-backdrop-filter:blur(18px) saturate(140%);font-family:var(--f-body);color:var(--ink);
 padding:max(16px,env(safe-area-inset-top,0px)) max(16px,env(safe-area-inset-right,0px)) max(16px,env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px))}
.tmq *{box-sizing:border-box}
.tmq button{font:inherit;cursor:pointer}
.tmq button:focus-visible{outline:2px solid var(--mint);outline-offset:3px}
.tmq .modal{width:100%;max-width:540px;max-height:100%;overflow:auto;background:var(--glass);border:1px solid var(--edge);border-radius:24px;padding:26px;
 box-shadow:0 30px 70px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.03),inset 0 1px 0 rgba(255,255,255,.06),0 0 60px rgba(132,243,190,.08);
 display:flex;flex-direction:column;gap:18px;animation:tmqpop .45s cubic-bezier(.34,1.56,.64,1)}
@keyframes tmqpop{from{transform:translateY(24px) scale(.96);opacity:0}to{transform:none;opacity:1}}
@keyframes tmqpulse{0%,100%{box-shadow:0 6px 18px rgba(132,243,190,.3),inset 0 1px 0 rgba(255,255,255,.5)}50%{box-shadow:0 10px 28px rgba(132,243,190,.45),0 0 0 4px rgba(132,243,190,.14),inset 0 1px 0 rgba(255,255,255,.55)}}
@keyframes tmqcoinpop{0%{transform:scale(.6) rotate(-10deg)}60%{transform:scale(1.15) rotate(4deg)}100%{transform:scale(1) rotate(0)}}
.tmq .top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.tmq .stepinfo{display:flex;flex-direction:column;gap:6px;min-width:0}
.tmq .steplabel{font-family:var(--f-pixel);font-weight:600;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-dim)}
.tmq .steplabel b{color:var(--ink);font-weight:700}
.tmq .prog{display:flex;gap:5px}
.tmq .prog span{width:34px;height:4px;border-radius:2px;background:rgba(255,255,255,.08)}
.tmq .prog span.done{background:var(--mint)}.tmq .prog span.now{background:linear-gradient(90deg,var(--mint) 50%,rgba(255,255,255,.08) 50%)}
.tmq .right{display:flex;gap:8px;align-items:center}
.tmq .close{width:32px;height:32px;border:1px solid var(--edge);border-radius:999px;background:rgba(255,255,255,.03);color:var(--ink-dim);font-size:18px;line-height:1;font-weight:500;cursor:pointer;display:grid;place-items:center;transition:background .15s,color .15s,transform .12s;padding:0;flex-shrink:0}
.tmq .close:hover{background:rgba(255,255,255,.08);color:var(--ink);transform:scale(1.06)}
.tmq .close:active{transform:scale(.94)}
.tmq .purse{display:flex;align-items:center;gap:7px;background:rgba(255,255,255,.04);border:1px solid var(--edge);color:var(--mint);border-radius:999px;padding:5px 12px 5px 8px;font-family:var(--f-pixel);font-size:11px;letter-spacing:.04em}
.tmq .purse i{width:10px;height:10px;border-radius:50%;background:var(--mint);box-shadow:0 0 10px var(--mint-ring);display:block}
.tmq .lang{display:flex;background:rgba(255,255,255,.04);border:1px solid var(--edge);border-radius:999px;padding:3px}
.tmq .lang button{border:0;background:none;border-radius:999px;padding:4px 11px;font-family:var(--f-pixel);font-weight:600;font-size:11px;letter-spacing:.08em;color:var(--ink-dim)}
.tmq .lang button.on{background:var(--mint);color:#0a1512;box-shadow:0 2px 8px rgba(132,243,190,.25)}
.tmq .guide{display:flex;gap:12px;align-items:flex-start}
.tmq .guide canvas{width:56px;height:56px;image-rendering:pixelated;border-radius:50%;background:linear-gradient(160deg,var(--slate),var(--slate-deep));flex:none;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 4px 10px rgba(0,0,0,.4),0 0 0 2px var(--mint-ring)}
.tmq .bubble{position:relative;background:rgba(255,255,255,.03);border:1px solid var(--edge);border-radius:14px;padding:12px 16px;line-height:1.5;font-size:14.5px;color:var(--ink);min-width:0;flex:1}
.tmq .bubble::before{content:"";position:absolute;left:-7px;top:16px;width:12px;height:12px;background:rgba(255,255,255,.03);border-left:1px solid var(--edge);border-bottom:1px solid var(--edge);transform:rotate(45deg)}
.tmq .bubble b.name{display:block;font-family:var(--f-pixel);font-weight:600;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--blue);margin-bottom:4px}
.tmq .safe-note{background:rgba(132,243,190,.06);border:1px solid rgba(132,243,190,.18);border-radius:12px;padding:11px 14px;font-size:13.5px;line-height:1.45;color:var(--ink-dim);display:flex;gap:10px;align-items:center}
.tmq .safe-note::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--mint);box-shadow:0 0 10px var(--mint-ring);flex-shrink:0}
.tmq .slab{background:linear-gradient(160deg,rgba(255,255,255,.04) 0%,rgba(255,255,255,.015) 100%);border:1px solid var(--edge);color:var(--on-slate);border-radius:18px;padding:20px;
 box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 8px 24px rgba(0,0,0,.25)}
.tmq .intro-slab{background:linear-gradient(160deg,rgba(132,243,190,.08) 0%,rgba(255,111,46,.04) 100%);border-color:rgba(132,243,190,.14)}
.tmq .kicker2{font-family:var(--f-pixel);font-weight:600;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--mint);margin:0 0 10px}
.tmq h2{font-family:var(--f-display);font-weight:700;font-size:22px;line-height:1.2;letter-spacing:-.01em;margin:0;text-wrap:balance;color:var(--ink)}
.tmq .slab p{margin:6px 0 0;color:var(--on-slate-dim);line-height:1.5;font-size:14.5px}
.tmq .mapwrap{position:relative;margin-top:14px;border-radius:12px;overflow:hidden;border:1px solid var(--edge)}
.tmq .mapwrap canvas{width:100%;display:block;image-rendering:pixelated}
.tmq .pin{position:absolute;transform:translateX(-50%);font-family:var(--f-pixel);font-weight:600;font-size:11px;letter-spacing:.04em;background:rgba(5,8,11,.9);color:var(--on-slate);padding:2px 8px;border-radius:999px;border:1px solid var(--edge);white-space:nowrap;pointer-events:none}
.tmq .pin.hl{background:var(--mint);color:#06090c;border-color:var(--mint)}
.tmq .scene{width:100%;display:block;image-rendering:pixelated;border-radius:12px;margin-top:14px;border:1px solid var(--edge)}
.tmq .alert{margin-top:12px;background:rgba(255,111,46,.08);border:1px solid rgba(255,111,46,.22);border-radius:10px;padding:10px 12px;color:var(--on-slate);line-height:1.45;font-size:14px}
.tmq .alert b{color:var(--blue);font-weight:700}
.tmq .opts{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.tmq .opt{border:1px solid var(--edge);border-radius:14px;padding:12px;text-align:left;background:rgba(255,255,255,.02);color:var(--ink);display:flex;gap:10px;align-items:flex-start;transition:border-color .15s,background .15s,transform .12s}
.tmq .opt canvas{width:34px;height:34px;image-rendering:pixelated;border-radius:8px;background:var(--slate-deep);border:1px solid var(--edge);flex:none}
.tmq .opt .tx{min-width:0}
.tmq .opt b{display:block;font-family:var(--f-display);font-weight:600;font-size:15px;color:var(--ink);letter-spacing:-.005em}
.tmq .opt small{display:block;color:var(--ink-dim);font-size:13px;line-height:1.4;margin-top:3px}
.tmq .opt .risk{display:inline-block;margin-top:7px;font-family:var(--f-pixel);font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,.04);border:1px solid var(--edge);color:var(--ink-dim)}
.tmq .opt:hover{border-color:var(--mint-ring);background:rgba(132,243,190,.04);transform:translateY(-1px)}
.tmq .hint{margin:0;text-align:center;font-size:12px;font-family:var(--f-pixel);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-dim)}
.tmq .outcome{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.tmq .outcome .lbl{font-family:var(--f-pixel);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--on-slate-dim)}
.tmq .outcome h2{margin-top:4px}
.tmq .delta{font-family:var(--f-pixel);font-size:12px;font-weight:600;padding:7px 11px;border-radius:8px;background:rgba(255,255,255,.03);border:1px solid var(--edge);white-space:nowrap;letter-spacing:.02em}
.tmq .delta.up{color:var(--good);border-color:rgba(74,222,128,.25);background:rgba(74,222,128,.08)}
.tmq .delta.down{color:var(--bad);border-color:rgba(251,113,133,.25);background:rgba(251,113,133,.08)}
.tmq .delta.zero{color:var(--on-slate-dim)}
.tmq .learn{display:grid;gap:8px}
.tmq .learn div{background:rgba(255,255,255,.03);border:1px solid var(--edge);border-radius:12px;padding:11px 13px;line-height:1.5;font-size:14px;color:var(--ink)}
.tmq .learn b{display:block;font-family:var(--f-pixel);font-weight:600;font-size:10px;letter-spacing:.14em;text-transform:uppercase;margin-bottom:4px}
.tmq .learn .you b{color:var(--mint)}.tmq .learn .real b{color:var(--blue)}
.tmq .how{list-style:none;margin:4px 0 0;padding:0;display:grid;gap:10px;counter-reset:s}
.tmq .how li{display:flex;gap:14px;align-items:center;counter-increment:s;color:var(--on-slate);font-size:14.5px;line-height:1.45;font-weight:400}
.tmq .how li::before{content:counter(s);width:28px;height:28px;border-radius:50%;background:var(--mint-soft);color:var(--mint);border:1px solid var(--mint-ring);font-family:var(--f-pixel);font-weight:700;font-size:13px;display:grid;place-items:center;flex:none}
.tmq .how li.end::before{content:"★";background:rgba(255,111,46,.12);color:var(--blue);border-color:rgba(255,111,46,.3);font-size:14px;box-shadow:0 0 16px rgba(255,111,46,.25)}
.tmq .btn{border:0;border-radius:14px;padding:14px 22px;font-family:var(--f-display);font-weight:600;font-size:15.5px;letter-spacing:-.005em;width:100%;transition:transform .12s,box-shadow .2s,background .2s}
.tmq .btn-blue{background:linear-gradient(165deg,rgba(190,255,230,.95) 0%,rgba(132,243,190,.95) 55%,rgba(78,196,154,.95) 100%);color:#0a1512;box-shadow:0 8px 20px rgba(132,243,190,.3),inset 0 1px 0 rgba(255,255,255,.55),inset 0 -1px 0 rgba(0,0,0,.1);display:flex;align-items:center;justify-content:center;gap:9px}
.tmq .btn-blue:hover{transform:translateY(-1px);box-shadow:0 12px 28px rgba(132,243,190,.4),inset 0 1px 0 rgba(255,255,255,.6),inset 0 -1px 0 rgba(0,0,0,.1)}
.tmq .btn-blue:active{transform:translateY(1px)}
.tmq .btn-blue.pulse{animation:tmqpulse 2.6s ease-in-out infinite}
.tmq .btn-icon{font-size:12px;opacity:.85}
.tmq .btn-ghost{background:rgba(255,255,255,.04);border:1px solid var(--edge);color:var(--ink)}
.tmq .btn-ghost:hover{background:rgba(255,255,255,.08);transform:translateY(-1px)}
.tmq .btn-ghost:active{transform:translateY(1px)}
.tmq .row{display:flex;gap:10px;flex-wrap:wrap}.tmq .row .btn{flex:1 1 180px}
.tmq .link{background:none;border:0;color:var(--ink-dim);font-size:13px;text-decoration:underline;text-underline-offset:3px;padding:0;align-self:center;transition:color .15s}
.tmq .link:hover{color:var(--ink)}
.tmq .hero{display:flex;gap:14px;align-items:center}
.tmq .hero canvas{width:80px;height:80px;image-rendering:pixelated;border-radius:14px;background:var(--slate-ink);border:1px solid var(--edge);flex:none}
.tmq .kicker{font-family:var(--f-pixel);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--mint)}
.tmq .stats{display:grid;gap:8px;margin-top:14px}
.tmq .stat{display:grid;grid-template-columns:140px 1fr;gap:10px;align-items:center;font-size:13px;color:var(--on-slate-dim)}
.tmq .bar{height:6px;border-radius:3px;background:rgba(255,255,255,.06);overflow:hidden}
.tmq .bar i{display:block;height:100%;background:linear-gradient(90deg,var(--mint-deep),var(--mint));box-shadow:0 0 8px var(--mint-ring)}
.tmq .profile{background:rgba(255,255,255,.03);border:1px solid var(--edge);border-radius:14px;padding:14px}
.tmq .profile .k{font-family:var(--f-pixel);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-dim);margin:0}
.tmq .pills{display:flex;gap:8px;margin:10px 0}
.tmq .pill{border-radius:999px;padding:6px 16px;font-family:var(--f-display);font-weight:500;font-size:13.5px;background:rgba(255,255,255,.04);border:1px solid var(--edge);color:var(--ink-dim)}
.tmq .pill.on{background:var(--mint);border-color:var(--mint);color:#0a1512;box-shadow:0 2px 10px rgba(132,243,190,.25)}
.tmq .profile p{margin:4px 0 0;line-height:1.5;font-size:14px;color:var(--ink)}
.tmq .fine{font-size:12px;color:var(--ink-dim);margin:0;line-height:1.5;text-align:center}
@media (max-width:460px){.tmq .opts{grid-template-columns:1fr}.tmq .stat{grid-template-columns:118px 1fr}.tmq h2{font-size:20px}}
@media (prefers-reduced-motion:reduce){.tmq .modal{animation:none}.tmq .btn-blue.pulse{animation:none}}

/* ---------- Per-skin overrides so the quest matches the active skin ---------- */

/* PLUSH — pink velvet */
.tmq[data-skin="plush"]{--glass:rgba(255,247,251,.97);--edge:rgba(233,137,181,.5);
 --slate:#a82d68;--slate-deep:#781e4b;--slate-ink:#4a1b37;
 --on-slate:#fff7fb;--on-slate-dim:#f7c6dc;--ink:#4a1b37;--ink-dim:#8c4568;
 --line:rgba(168,45,104,.15);--blue:#a82d68;--blue-deep:#781e4b;--gold:#e989b5;--gold-deep:#a82d68;
 --mint:#a82d68;--mint-deep:#781e4b;--mint-soft:rgba(168,45,104,.08);--mint-ring:rgba(168,45,104,.3);
 --good:#2e8b57;--bad:#c9324a;
 background:radial-gradient(ellipse at 25% 15%,rgba(255,180,210,.6),transparent 55%),rgba(74,27,55,.55)}
.tmq[data-skin="plush"] .modal{box-shadow:0 30px 70px rgba(120,30,72,.45),0 0 0 2px rgba(255,200,220,.5),0 0 60px rgba(233,137,181,.3),inset 0 2px 0 #fff}
.tmq[data-skin="plush"] .slab{background:linear-gradient(160deg,#a82d68 0%,#781e4b 100%);border-color:rgba(255,180,210,.2);color:var(--on-slate)}
.tmq[data-skin="plush"] .intro-slab{background:linear-gradient(160deg,#b73878 0%,#781e4b 100%)}
.tmq[data-skin="plush"] .slab p{color:var(--on-slate-dim)}
.tmq[data-skin="plush"] .slab h2,.tmq[data-skin="plush"] .outcome .lbl{color:var(--on-slate)}
.tmq[data-skin="plush"] .outcome .lbl{color:var(--on-slate-dim)}
.tmq[data-skin="plush"] .kicker2{color:#ffd6ea}
.tmq[data-skin="plush"] .kicker{color:#ffd6ea}
.tmq[data-skin="plush"] .how li{color:var(--on-slate)}
.tmq[data-skin="plush"] .how li::before{background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.3);color:#fff}
.tmq[data-skin="plush"] .how li.end::before{background:#ffcc3d;border-color:#ffcc3d;color:#4a1b37;box-shadow:0 0 16px rgba(255,204,61,.4)}
.tmq[data-skin="plush"] .bubble{background:#fff;color:var(--ink)}
.tmq[data-skin="plush"] .bubble::before{background:#fff;border-color:var(--line)}
.tmq[data-skin="plush"] .safe-note{background:rgba(168,45,104,.06);border-color:var(--line);color:var(--ink-dim)}
.tmq[data-skin="plush"] .opt{background:#fff;border-color:var(--line);color:var(--ink)}
.tmq[data-skin="plush"] .opt b{color:var(--ink)}
.tmq[data-skin="plush"] .opt small{color:var(--ink-dim)}
.tmq[data-skin="plush"] .opt .risk{background:rgba(168,45,104,.06);border-color:var(--line);color:var(--ink-dim)}
.tmq[data-skin="plush"] .opt:hover{border-color:var(--mint);background:rgba(168,45,104,.04)}
.tmq[data-skin="plush"] .learn div{background:#fff;border-color:var(--line);color:var(--ink)}
.tmq[data-skin="plush"] .profile{background:#fff;border-color:var(--line);color:var(--ink)}
.tmq[data-skin="plush"] .profile p{color:var(--ink)}
.tmq[data-skin="plush"] .steplabel{color:var(--ink-dim)}.tmq[data-skin="plush"] .steplabel b{color:var(--ink)}
.tmq[data-skin="plush"] .prog span{background:rgba(168,45,104,.14)}
.tmq[data-skin="plush"] .prog span.done{background:var(--mint)}
.tmq[data-skin="plush"] .prog span.now{background:linear-gradient(90deg,var(--mint) 50%,rgba(168,45,104,.14) 50%)}
.tmq[data-skin="plush"] .close{background:rgba(168,45,104,.08);color:var(--ink);border-color:var(--line)}
.tmq[data-skin="plush"] .lang{background:rgba(168,45,104,.08);border-color:var(--line)}
.tmq[data-skin="plush"] .lang button.on{background:var(--mint);color:#fff}
.tmq[data-skin="plush"] .purse{background:rgba(168,45,104,.08);border-color:var(--line);color:var(--mint)}
.tmq[data-skin="plush"] .purse i{background:var(--mint);box-shadow:0 0 10px var(--mint-ring)}
.tmq[data-skin="plush"] .btn-blue{background:linear-gradient(180deg,#c6447f 0%,#a82d68 55%,#781e4b 100%);color:#fff;box-shadow:0 8px 20px rgba(168,45,104,.35),inset 0 1px 0 rgba(255,255,255,.3)}
.tmq[data-skin="plush"] .btn-blue:hover{box-shadow:0 12px 28px rgba(168,45,104,.45),inset 0 1px 0 rgba(255,255,255,.35)}
.tmq[data-skin="plush"] .btn-ghost{background:#fff;border-color:var(--line);color:var(--ink)}
.tmq[data-skin="plush"] .pill{background:rgba(168,45,104,.06);border-color:var(--line);color:var(--ink-dim)}
.tmq[data-skin="plush"] .pill.on{background:var(--mint);border-color:var(--mint);color:#fff}
.tmq[data-skin="plush"] .bar{background:rgba(168,45,104,.1)}
.tmq[data-skin="plush"] .bar i{background:linear-gradient(90deg,var(--mint-deep),var(--mint))}
.tmq[data-skin="plush"] .pin{background:rgba(74,27,55,.9);color:#fff;border-color:transparent}
.tmq[data-skin="plush"] .pin.hl{background:var(--mint);color:#fff}
.tmq[data-skin="plush"] .alert{background:rgba(168,45,104,.1);border-color:rgba(168,45,104,.2);color:var(--on-slate)}
.tmq[data-skin="plush"] .alert b{color:#ffd6ea}
.tmq[data-skin="plush"] .guide canvas{box-shadow:inset 0 1px 0 rgba(255,255,255,.2),0 4px 10px rgba(74,27,55,.3),0 0 0 3px rgba(255,220,230,.5)}

/* GLASS — translucent champagne, cobalt accent */
.tmq[data-skin="glass"]{--glass:rgba(255,250,240,.92);--edge:rgba(36,88,214,.3);
 --slate:#2458d6;--slate-deep:#1a46b8;--slate-ink:#0a2f9f;
 --on-slate:#ffffff;--on-slate-dim:#c8d4f0;--ink:#1a1d20;--ink-dim:#4a5560;
 --line:rgba(36,88,214,.14);--blue:#2458d6;--blue-deep:#0a2f9f;--gold:#f2b01e;--gold-deep:#b77f12;
 --mint:#2458d6;--mint-deep:#0a2f9f;--mint-soft:rgba(36,88,214,.06);--mint-ring:rgba(36,88,214,.3);
 --good:#2e8b57;--bad:#c9324a;
 background:radial-gradient(ellipse at 25% 15%,rgba(255,230,200,.55),transparent 55%),radial-gradient(ellipse at 80% 85%,rgba(180,210,255,.5),transparent 55%),rgba(60,50,40,.5)}
.tmq[data-skin="glass"] .modal{backdrop-filter:blur(24px) saturate(140%);-webkit-backdrop-filter:blur(24px) saturate(140%);background:linear-gradient(180deg,rgba(255,250,240,.78),rgba(240,230,215,.6));border:1px solid rgba(255,255,255,.9);
 box-shadow:0 30px 70px rgba(60,50,40,.35),inset 0 2px 3px rgba(255,255,255,.9),-3px 0 10px rgba(255,120,200,.2),3px 0 10px rgba(120,200,255,.22)}
.tmq[data-skin="glass"] .slab{background:linear-gradient(160deg,#2458d6 0%,#0a2f9f 100%);border-color:rgba(255,255,255,.14);color:var(--on-slate)}
.tmq[data-skin="glass"] .intro-slab{background:linear-gradient(160deg,#3466e2 0%,#0a2f9f 100%)}
.tmq[data-skin="glass"] .slab p{color:var(--on-slate-dim)}
.tmq[data-skin="glass"] .slab h2,.tmq[data-skin="glass"] .outcome h2{color:var(--on-slate)}
.tmq[data-skin="glass"] .outcome .lbl{color:var(--on-slate-dim)}
.tmq[data-skin="glass"] .kicker2{color:#f2b01e}
.tmq[data-skin="glass"] .kicker{color:#f2b01e}
.tmq[data-skin="glass"] .how li{color:var(--on-slate)}
.tmq[data-skin="glass"] .how li::before{background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.3);color:#fff}
.tmq[data-skin="glass"] .how li.end::before{background:#f2b01e;border-color:#f2b01e;color:#1a1d20}
.tmq[data-skin="glass"] .bubble{background:#fff;color:var(--ink)}
.tmq[data-skin="glass"] .bubble::before{background:#fff;border-color:var(--line)}
.tmq[data-skin="glass"] .safe-note{background:rgba(36,88,214,.06);border-color:var(--line);color:var(--ink-dim)}
.tmq[data-skin="glass"] .opt{background:#fff;border-color:var(--line);color:var(--ink)}
.tmq[data-skin="glass"] .opt b{color:var(--ink)}
.tmq[data-skin="glass"] .opt small{color:var(--ink-dim)}
.tmq[data-skin="glass"] .opt .risk{background:rgba(36,88,214,.06);border-color:var(--line);color:var(--ink-dim)}
.tmq[data-skin="glass"] .opt:hover{border-color:var(--mint);background:rgba(36,88,214,.04)}
.tmq[data-skin="glass"] .learn div{background:#fff;border-color:var(--line);color:var(--ink)}
.tmq[data-skin="glass"] .profile{background:#fff;border-color:var(--line);color:var(--ink)}
.tmq[data-skin="glass"] .profile p{color:var(--ink)}
.tmq[data-skin="glass"] .steplabel{color:var(--ink-dim)}.tmq[data-skin="glass"] .steplabel b{color:var(--ink)}
.tmq[data-skin="glass"] .prog span{background:rgba(36,88,214,.14)}
.tmq[data-skin="glass"] .prog span.done{background:var(--mint)}
.tmq[data-skin="glass"] .prog span.now{background:linear-gradient(90deg,var(--mint) 50%,rgba(36,88,214,.14) 50%)}
.tmq[data-skin="glass"] .close{background:rgba(36,88,214,.08);color:var(--ink);border-color:var(--line)}
.tmq[data-skin="glass"] .lang{background:rgba(36,88,214,.08);border-color:var(--line)}
.tmq[data-skin="glass"] .lang button.on{background:var(--mint);color:#fff}
.tmq[data-skin="glass"] .purse{background:rgba(36,88,214,.08);border-color:var(--line);color:var(--mint)}
.tmq[data-skin="glass"] .purse i{background:var(--mint);box-shadow:0 0 10px var(--mint-ring)}
.tmq[data-skin="glass"] .btn-blue{background:linear-gradient(180deg,#3b6fe8 0%,#2458d6 55%,#0a2f9f 100%);color:#fff;box-shadow:0 8px 20px rgba(36,88,214,.35),inset 0 1px 0 rgba(255,255,255,.3)}
.tmq[data-skin="glass"] .btn-blue:hover{box-shadow:0 12px 28px rgba(36,88,214,.45),inset 0 1px 0 rgba(255,255,255,.35)}
.tmq[data-skin="glass"] .btn-ghost{background:#fff;border-color:var(--line);color:var(--ink)}
.tmq[data-skin="glass"] .pill{background:rgba(36,88,214,.06);border-color:var(--line);color:var(--ink-dim)}
.tmq[data-skin="glass"] .pill.on{background:var(--mint);border-color:var(--mint);color:#fff}
.tmq[data-skin="glass"] .bar{background:rgba(36,88,214,.1)}
.tmq[data-skin="glass"] .bar i{background:linear-gradient(90deg,var(--mint-deep),var(--mint))}
.tmq[data-skin="glass"] .pin{background:rgba(10,47,159,.9);color:#fff;border-color:transparent}
.tmq[data-skin="glass"] .pin.hl{background:#f2b01e;color:#1a1d20}
.tmq[data-skin="glass"] .alert{background:rgba(36,88,214,.1);border-color:rgba(36,88,214,.2);color:var(--on-slate)}
.tmq[data-skin="glass"] .alert b{color:#ffd99a}
.tmq[data-skin="glass"] .guide canvas{box-shadow:inset 0 1px 0 rgba(255,255,255,.2),0 4px 10px rgba(10,47,159,.3),0 0 0 3px rgba(255,230,180,.5)}

/* GRID — industrial monochrome */
.tmq[data-skin="grid"]{--glass:#191D20;--edge:rgba(237,240,236,.5);
 --slate:#0f1214;--slate-deep:#080a0b;--slate-ink:#000;
 --on-slate:#edf0ec;--on-slate-dim:#929c99;--ink:#edf0ec;--ink-dim:#929c99;
 --line:rgba(237,240,236,.14);--blue:#edf0ec;--blue-deep:#c9ccc8;--gold:#edf0ec;--gold-deep:#929c99;
 --f-display:"JetBrains Mono","IBM Plex Mono","Menlo",monospace;
 background:repeating-linear-gradient(0deg,rgba(237,240,236,.04) 0 1px,transparent 1px 24px),repeating-linear-gradient(90deg,rgba(237,240,236,.04) 0 1px,transparent 1px 24px),rgba(10,12,14,.78)}
.tmq[data-skin="grid"] .modal{border-radius:0;border:1px solid var(--edge);background:var(--glass);color:var(--on-slate);
 box-shadow:0 20px 50px rgba(0,0,0,.7),inset 0 0 0 1px rgba(237,240,236,.1)}
.tmq[data-skin="grid"] .btn,.tmq[data-skin="grid"] .opt,.tmq[data-skin="grid"] .pill,.tmq[data-skin="grid"] .purse,.tmq[data-skin="grid"] .modal .slab{border-radius:0}
.tmq[data-skin="grid"] .btn-blue{background:#edf0ec;color:#080a0b;text-transform:uppercase;letter-spacing:.1em}
.tmq[data-skin="grid"] .btn-ghost{background:transparent;color:var(--on-slate);border:1px solid var(--on-slate);box-shadow:none}
.tmq[data-skin="grid"] .opt{background:transparent;border:1px solid var(--line);color:var(--on-slate);box-shadow:none}
.tmq[data-skin="grid"] .opt b,.tmq[data-skin="grid"] .opt small{color:var(--on-slate)}
.tmq[data-skin="grid"] .opt .risk{background:transparent;border:1px solid var(--line);color:var(--on-slate-dim)}
.tmq[data-skin="grid"] .close{background:transparent;border:1px solid var(--edge);color:var(--on-slate);border-radius:0}
.tmq[data-skin="grid"] .lang{background:transparent;border:1px solid var(--edge)}
.tmq[data-skin="grid"] .lang button{color:var(--on-slate-dim)}
.tmq[data-skin="grid"] .lang button.on{background:var(--on-slate);color:#080a0b}
.tmq[data-skin="grid"] .bubble{background:#0f1214;color:var(--on-slate);border:1px solid var(--line);border-radius:0}
.tmq[data-skin="grid"] .learn div{background:#0f1214;color:var(--on-slate);border:1px solid var(--line);border-radius:0}
.tmq[data-skin="grid"] .profile{background:#0f1214;border:1px solid var(--line);border-radius:0;color:var(--on-slate)}
`;

const QUEST_TEXT = {
 en:{guide:'Stella · your guide',steps:'Step',of:'of',rounds:['The path','The storm','The merchant'],
  introT:'Find your investor character',
  introG:"Hi, I'm Stella! Before you invest real money, let's play a short game. Your choices show how you feel about risk.",
  introP:'It takes about 30 seconds.',
  how:['Pick a path to a treasure chest','Decide what to do when a storm hits','Answer a tempting offer from a merchant','See your character and suggested risk profile'],
  safe:'You play with practice coins. No real money, no wrong answers.',
  start:'Start the game',skip:'Skip and choose my profile myself',
  tap:'Tap one answer to continue',
  q:[
   {g:'Pick the path you would really take. Paths further away hide bigger chests, but you can lose coins on the way.',
    t:'Which path do you take?',p:'You start with 100 practice coins.',
    o:[['The village','Safe road. You always get 10 coins.','No risk'],['The forest','Usually works: 8 times out of 10 you win 30 coins.','Low risk'],
       ['The mountains','A coin flip: win 80 coins or lose 20.','High risk'],['The cave','A long shot: 2 times out of 10 you win 200. Otherwise you lose 50.','Very high risk']],
    r:[['A quiet trip. The chest had 10 coins.'],['The chest was full!','Wolves! You ran back with nothing.'],['You reached the summit!','An avalanche on the way down.'],['LEGENDARY CHEST!','It was a trap.']],
    you:['You value safety over big wins.','You like rewards, with a safety net.','You accept losses for a chance at bigger gains.','You chase the jackpot, even with low odds.'],
    real:'This is like choosing between stable crypto assets that move a little and volatile ones that can jump or crash.',next:'Next: the storm'},
   {g:'This happens in real markets too: prices can drop suddenly. There is no right answer, just pick what feels natural.',
    t:'What do you do after the storm?',pre:(n,c)=>`<b>A storm hits!</b> You lost 30% of your coins (−${n}). You now have ${c}.`,
    o:[['Go home','Stop here and keep what is left.','Sell'],['Take shelter','Wait calmly until it passes.','Hold'],
       ['Keep walking','Continue as planned.','Hold'],['Search the mud','Look for coins others dropped. Risky!','Buy the dip']],
    r:[['You are safe at home.'],['The storm passed. You found some coins.','The rain never stopped.'],['You pushed through.','You slipped in the mud.'],['Coins in the mud!','The mud was hiding holes.']],
    you:['You protect what is left after a loss.','You stay calm and wait.','A loss does not change your plan.','You see a drop as an opportunity.'],
    real:'This is a market drop. Some people sell, some hold and wait, others buy more while prices are low.',next:'Next: the merchant'},
   {g:'Someone promises easy profits and everyone around you is buying. How much do you trust it?',
    t:'A merchant offers you a "magic" sword',p:'"It will be worth 10 times more tomorrow. Everyone in the tavern bought one!"',
    o:[['Nothing',"I don't buy rumors.",'No risk'],['Ask first','I check before deciding.','Low risk'],['A little','Just a few coins, in case.','Medium risk'],['Everything',"I don't want to miss out!",'Very high risk']],
    r:{no:'The merchant vanished. It was smoke.',ask:'Nobody knew that sword. You avoided a trap.',win:'It was true! Your coins grew x10.',lose:'The sword was painted wood.'},
    you:["You don't follow the hype.",'You research before you act.','You are curious, but you set limits.','The fear of missing out drives your choice.'],
    real:'In crypto this is hype: a token everyone talks about that promises fast gains. That feeling is called FOMO, the fear of missing out.',next:'See my character'}],
  result:'Result',youPicked:'You chose',coinsW:'coins',aboutYou:'What this says about you',realLife:'In real investing',
  revealG:'Here is your investor character! It shows how you react to risk, and it suggests a risk profile for your account.',
  youAre:'Your character',stats:['Risk appetite','Calm in a drop','Resists hype'],
  inco:'Careful on the map, but the merchant tempted you. Watch out for hype.',coh:'Your choices were consistent.',
  sugg:'Suggested risk profile',risk:{low:'Low',medium:'Medium',high:'High'},
  riskD:{low:'Mostly stable assets. Small, steadier moves.',medium:'A mix of stable and growth assets. Some ups and downs.',high:'More volatile assets. Bigger swings, up and down.'},
  use:'Use this profile',manual:'Choose manually',again:'Play again',
  fine:'Educational game, not investment advice. You can change your risk profile at any time.',
  ch:[['The Guardian','You protect your treasure before chasing far-off chests.'],['The Explorer','You take risks, but always with a map.'],['The Adventurer','You accept storms when the chest is worth it.'],['The Berserker','All or nothing. The cave is calling you. Set yourself limits.']]},
 es:{guide:'Stella · tu guía',steps:'Paso',of:'de',rounds:['El camino','La tormenta','El mercader'],
  introT:'Descubre tu personaje inversor',
  introG:'¡Hola, soy Stella! Antes de invertir dinero real, juguemos un momento. Tus decisiones muestran cómo vives el riesgo.',
  introP:'Dura unos 30 segundos.',
  how:['Elige un camino hacia un cofre del tesoro','Decide qué hacer cuando llega una tormenta','Responde a la oferta tentadora de un mercader','Descubre tu personaje y tu perfil de riesgo sugerido'],
  safe:'Juegas con monedas de práctica. Sin dinero real y sin respuestas incorrectas.',
  start:'Empezar el juego',skip:'Saltar y elegir mi perfil yo',
  tap:'Toca una respuesta para continuar',
  q:[
   {g:'Elige el camino que tomarías de verdad. Los caminos más lejanos esconden cofres más grandes, pero puedes perder monedas.',
    t:'¿Qué camino tomas?',p:'Empiezas con 100 monedas de práctica.',
    o:[['El pueblo','Camino seguro. Siempre ganas 10 monedas.','Sin riesgo'],['El bosque','Suele salir bien: 8 de cada 10 veces ganas 30.','Riesgo bajo'],
       ['Las montañas','Como lanzar una moneda: ganas 80 o pierdes 20.','Riesgo alto'],['La cueva','Muy difícil: 2 de cada 10 veces ganas 200. Si no, pierdes 50.','Riesgo muy alto']],
    r:[['Un viaje tranquilo. El cofre tenía 10 monedas.'],['¡El cofre estaba lleno!','¡Lobos! Volviste sin nada.'],['¡Llegaste a la cima!','Una avalancha al bajar.'],['¡COFRE LEGENDARIO!','Era una trampa.']],
    you:['Valoras la seguridad más que las grandes ganancias.','Te gustan las recompensas, con red de seguridad.','Aceptas pérdidas por una ganancia mayor.','Vas a por el premio gordo, aunque sea difícil.'],
    real:'Es como elegir entre criptoactivos estables que se mueven poco y otros volátiles que pueden subir o caer mucho.',next:'Siguiente: la tormenta'},
   {g:'Esto también pasa en los mercados: los precios pueden caer de golpe. No hay respuesta correcta, elige lo que te salga natural.',
    t:'¿Qué haces después de la tormenta?',pre:(n,c)=>`<b>¡Llega una tormenta!</b> Pierdes el 30% de tus monedas (−${n}). Ahora tienes ${c}.`,
    o:[['Volver a casa','Paro aquí y guardo lo que queda.','Vender'],['Refugiarme','Espero tranquilo a que pase.','Mantener'],
       ['Seguir caminando','Continúo con mi plan.','Mantener'],['Buscar en el barro','Busco monedas que otros perdieron. ¡Arriesgado!','Comprar en la caída']],
    r:[['Estás a salvo en casa.'],['Pasó la tormenta. Encontraste monedas.','La lluvia no paró.'],['Seguiste adelante.','Te resbalaste en el barro.'],['¡Monedas en el barro!','El barro escondía agujeros.']],
    you:['Proteges lo que queda tras una pérdida.','Mantienes la calma y esperas.','Una pérdida no cambia tu plan.','Ves una caída como una oportunidad.'],
    real:'Es una caída del mercado. Hay quien vende, quien mantiene y espera, y quien compra más mientras el precio está bajo.',next:'Siguiente: el mercader'},
   {g:'Alguien promete ganancias fáciles y todos a tu alrededor compran. ¿Cuánto te fías?',
    t:'Un mercader te ofrece una espada "mágica"',p:'"Mañana valdrá 10 veces más. ¡Toda la taberna ya compró una!"',
    o:[['Nada','No compro rumores.','Sin riesgo'],['Pregunto antes','Lo compruebo antes de decidir.','Riesgo bajo'],['Un poquito','Solo unas monedas, por si acaso.','Riesgo medio'],['Todo','¡No quiero quedarme fuera!','Riesgo muy alto']],
    r:{no:'El mercader desapareció. Era humo.',ask:'Nadie conocía esa espada. Evitaste una trampa.',win:'¡Era verdad! Tus monedas se multiplicaron x10.',lose:'La espada era de madera pintada.'},
    you:['No te dejas llevar por la euforia.','Investigas antes de actuar.','Eres curioso, pero te pones límites.','El miedo a quedarte fuera decide por ti.'],
    real:'En cripto esto es el "hype": un token del que todos hablan y que promete ganancias rápidas. Esa sensación se llama FOMO, el miedo a quedarse fuera.',next:'Ver mi personaje'}],
  result:'Resultado',youPicked:'Elegiste',coinsW:'monedas',aboutYou:'Lo que dice de ti',realLife:'En la inversión real',
  revealG:'¡Este es tu personaje inversor! Muestra cómo reaccionas ante el riesgo y sugiere un perfil de riesgo para tu cuenta.',
  youAre:'Tu personaje',stats:['Apetito de riesgo','Calma en una caída','Resiste al hype'],
  inco:'Prudente en el mapa, pero el mercader te tentó. Cuidado con el hype.',coh:'Tus decisiones fueron coherentes.',
  sugg:'Perfil de riesgo sugerido',risk:{low:'Bajo',medium:'Medio',high:'Alto'},
  riskD:{low:'Sobre todo activos estables. Movimientos pequeños y más tranquilos.',medium:'Mezcla de activos estables y de crecimiento. Algunas subidas y bajadas.',high:'Activos más volátiles. Subidas y bajadas más grandes.'},
  use:'Usar este perfil',manual:'Elegir manualmente',again:'Jugar otra vez',
  fine:'Juego educativo, no es asesoramiento de inversión. Puedes cambiar tu perfil de riesgo cuando quieras.',
  ch:[['El Guardián','Proteges tu tesoro antes que perseguir cofres lejanos.'],['El Explorador','Arriesgas, pero siempre con mapa.'],['El Aventurero','Aceptas tormentas si el cofre lo merece.'],['El Berserker','Todo o nada. La cueva te llama. Ponte límites.']]}};

function mountQuest(root, opts) {
  const KEYS = ['guardian','explorer','adventurer','berserker'], RISK = ['low','medium','high','high'];
  const rnd = p => Math.random() < p;
  const G = { lang: opts.lang || 'en', step: -1, coins: 100, scores: [], pick: null, res: null, storm: 0, hover: null };
  const L = () => QUEST_TEXT[G.lang];

  const style = document.createElement('style'); style.textContent = QUEST_CSS;
  const wrap = document.createElement('div'); wrap.className = 'tmq'; wrap.setAttribute('role','dialog'); wrap.setAttribute('aria-modal','true');
  if (opts.skin) wrap.dataset.skin = opts.skin;
  const modal = document.createElement('div'); modal.className = 'modal'; wrap.appendChild(modal);
  root.appendChild(style); root.appendChild(wrap);

  function outcome(round, i, coins) {
    if (round === 0) return [() => [10,0], () => rnd(.8)?[30,0]:[0,1], () => rnd(.5)?[80,0]:[-20,1], () => rnd(.2)?[200,0]:[-50,1]][i]();
    if (round === 1) return [() => [0,0], () => rnd(.7)?[15,0]:[0,1], () => rnd(.6)?[25,0]:[-10,1], () => rnd(.5)?[60,0]:[-30,1]][i]();
    const real = rnd(.15); return [[0,'no'],[0,'ask'], real?[30,'win']:[-10,'lose'], real?[Math.round(coins*3),'win']:[-Math.round(coins*.8),'lose']][i];
  }
  function profileFrom(s) { const total = s.reduce((a,b)=>a+b,0); const idx = total<=4?0:total<=7?1:total<=10?2:3; const pct = v => Math.round((v-1)/3*100);
    return { key: KEYS[idx], idx, risk: RISK[idx], total, stats: [pct(s[0]), pct(s[1]), 100-pct(s[2])], inconsistent: s[2]-s[0] >= 2 }; }

  const C = ['#2f3237','#4b4e54','#7d8188','#c9ccd1','#e3a82c','#1c1e22','#f4f3f0','#8fb5ff'];
  const PATHS = [{x:30,y:20},{x:72,y:60},{x:118,y:20},{x:144,y:56}];
  const PIN = [{dy:-21},{dy:9},{dy:-21},{dy:-24}];
  function px(x,c,a,b,w,h){w=w||1;h=h||1;x.fillStyle=C[c];x.fillRect(a,b,w,h)}
  const LM = [
    (x,a,b)=>{px(x,0,a-6,b-2,12,8);for(let k=0;k<7;k++)px(x,3,a-7+k,b-3-k,14-2*k,1);px(x,4,a-1,b+2,3,4)},
    (x,a,b)=>{[[-6,0],[0,-3],[6,0]].forEach(([dx,dy])=>{for(let k=0;k<6;k++)px(x,0,a+dx-k,b+dy-6+k,2*k+1,1);px(x,5,a+dx,b+dy,1,3)})},
    (x,a,b)=>{for(let k=0;k<10;k++)px(x,0,a-k,b-6+k,2*k+1,1);for(let k=0;k<3;k++)px(x,3,a-k,b-6+k,2*k+1,1)},
    (x,a,b)=>{for(let k=0;k<8;k++)px(x,0,a-8+k/2,b-8+k,16-k,1);px(x,5,a-3,b-4,6,8)}];
  function drawMap(cv, hl) {
    const x = cv.getContext('2d'); cv.width = 160; cv.height = 80; px(x,1,0,0,160,80);
    for (let i=0;i<160;i+=6) for (let j=(i/6%2)*3;j<80;j+=6) px(x,2,i,j);
    const sx=8, sy=42;
    PATHS.forEach((p,i)=>{const s=Math.max(Math.abs(p.x-sx),Math.abs(p.y-sy));for(let t=0;t<=s;t+=hl===i?2:4)px(x,hl===i?4:2,Math.round(sx+(p.x-sx)*t/s),Math.round(sy+(p.y-sy)*t/s),2,2)});
    px(x,3,sx-2,sy-10,1,12); px(x,4,sx-1,sy-10,5,4);
    PATHS.forEach((p,i)=>{LM[i](x,p.x,p.y); px(x,hl===i?4:3,p.x+6,p.y+3,6,5); px(x,0,p.x+8,p.y+5,2,1)});
  }
  function drawIcon(cv, i) { const x=cv.getContext('2d'); cv.width=20; cv.height=20; px(x,1,0,0,20,20); LM[i](x,10,12); }
  function drawStorm(cv) { const x=cv.getContext('2d'); cv.width=160; cv.height=56; px(x,0,0,0,160,56);
    for (let i=0;i<6;i++){const cx=14+i*27,cy=8+(i%2)*4; px(x,2,cx-10,cy,24,7); px(x,2,cx-6,cy-4,16,5); px(x,1,cx-10,cy+6,24,2)}
    for (let i=0;i<70;i++){const a=(i*37)%160,b=20+(i*13)%36; px(x,7,a,b,1,3)}
    [[78,12],[74,22],[80,22],[76,32],[82,32],[78,42]].forEach(([a,b],k)=>px(x,4,a,b,k%2?2:5,8));
    px(x,1,0,50,160,6); px(x,3,120,40,8,10); px(x,4,123,44,2,2); }
  function drawMerchant(cv) { const x=cv.getContext('2d'); cv.width=160; cv.height=56; px(x,1,0,0,160,56);
    px(x,0,0,44,160,12); px(x,2,40,26,80,4); px(x,0,44,30,4,14); px(x,0,112,30,4,14);
    px(x,0,66,6,14,4); px(x,0,63,10,20,2); px(x,3,67,12,12,8); px(x,5,70,15,2,2); px(x,5,74,15,2,2); px(x,0,64,20,18,6);
    px(x,6,92,6,3,18); px(x,4,88,22,11,2); px(x,4,92,24,3,4); [[98,6],[86,10],[100,14]].forEach(([a,b])=>{px(x,4,a,b,1,3);px(x,4,a-1,b+1,3,1)});
    [[52,20],[56,20],[54,17],[104,22],[108,22],[106,19]].forEach(([a,b])=>px(x,4,a,b,4,3)); }
  const SPR = {
    guide:["....4444....","...444444...","..44333344..","...333333...","...353353...","...333333...","....3333....","..77777777..",".7777777777.",".3.777777.3.","...77..77...","...55..55..."],
    guardian:["....1111....","...100001...","...103301...","...133331...","....1331....","..11111111..","..12222221..",".0124334210.",".0124334210.","..12222221..","..11....11..","..00....00.."],
    explorer:["....4444....","...411114...","...133331...","...133331...","....1331....","..11211211..",".1112222111.",".1.122221.1.","...122221...","...11..11...","...11..11...","...00..00..."],
    adventurer:["..........3.","....4444.33.","...411114.3.","...133331.3.","....1331..3.","..1121121.3.",".111222211..",".1.12222144.","...122221...","...11..11...","...11..11...","...00..00..."],
    berserker:[".4..4..4..4.","..4.4004.4..","...011110...","...130031...","...133331...","..10011001..",".1112222111.",".1.122221.1.","...122221...","...11..11...","..11....11..","..00....00.."]};
  const SPC = { '0':'#1c1e22','1':'#7d8188','2':'#c9ccd1','3':'#f1d7b8','4':'#e3a82c','5':'#2a2c31','7':'#2f55d6' };
  const SPC2 = { '0':'#1c1e22','1':'#7d8188','2':'#c9ccd1','3':'#f4f3f0','4':'#e3a82c' };
  function drawSprite(cv, k) { const x=cv.getContext('2d'); cv.width=14; cv.height=14; x.fillStyle='#3b3e44'; x.fillRect(0,0,14,14);
    const pal = k==='guide'?SPC:SPC2; SPR[k].forEach((r,j)=>[...r].forEach((c,i)=>{ if(c!=='.'){ x.fillStyle=pal[c]; x.fillRect(i+1,j+1,1,1);} })); }

  function top() {
    const n = G.step; const inRound = n>=0 && n<3;
    const prog = [0,1,2].map(i=>`<span class="${i<n||(i===n&&G.res)||n===3?'done':i===n?'now':''}"></span>`).join('');
    const label = n<0 ? `<b>${L().introT}</b>` : n<3 ? `${L().steps} <b>${n+1}</b> ${L().of} 3 · <b>${L().rounds[n]}</b>` : `<b>${L().youAre}</b>`;
    return `<div class="top"><div class="stepinfo"><span class="steplabel">${label}</span>${n>=0?`<div class="prog">${prog}</div>`:''}</div>
      <div class="right">${inRound||n===3?`<span class="purse" aria-label="coins"><i></i>${Math.round(G.coins)}</span>`:''}
      <div class="lang">${['en','es'].map(l=>`<button data-lang="${l}" class="${G.lang===l?'on':''}" aria-label="${l==='en'?'English':'Español'}">${l.toUpperCase()}</button>`).join('')}</div>
      <button class="close" data-act="skip" aria-label="Close quest" title="Close">×</button></div></div>`;
  }
  const guide = txt => `<div class="guide"><canvas data-sprite="guide" aria-hidden="true"></canvas><div class="bubble"><b class="name">${L().guide}</b>${txt}</div></div>`;
  function render() {
    const l = L(); let h = top();
    if (G.step === -1) {
      h += guide(l.introG) + `<div class="slab intro-slab"><p class="kicker2">${l.introP}</p>
        <ol class="how">${l.how.map((s,i)=>`<li class="${i===3?'end':''}">${s}</li>`).join('')}</ol></div>
        <div class="safe-note">${l.safe}</div>
        <button class="btn btn-blue pulse" data-act="go"><span class="btn-icon">▶</span> ${l.start}</button>
        <button class="link" data-act="skip">${l.skip}</button>`;
    } else if (G.step < 3) {
      const q = l.q[G.step];
      if (!G.res) {
        h += guide(q.g) + `<div class="slab"><h2>${q.t}</h2>${q.pre?`<div class="alert">${q.pre(G.storm,Math.round(G.coins))}</div>`:`<p>${q.p}</p>`}
          ${G.step===0?`<div class="mapwrap"><canvas data-map></canvas>${PATHS.map((p,i)=>`<span class="pin ${G.hover===i?'hl':''}" style="left:${p.x/160*100}%;top:${(p.y+PIN[i].dy)/80*100}%">${q.o[i][0]}</span>`).join('')}</div>`:''}
          ${G.step===1?'<canvas class="scene" data-scene="storm" aria-hidden="true"></canvas>':''}
          ${G.step===2?'<canvas class="scene" data-scene="merchant" aria-hidden="true"></canvas>':''}</div>
          <div class="opts">${q.o.map((o,i)=>`<button class="opt" data-opt="${i}">${G.step===0?`<canvas data-icon="${i}" aria-hidden="true"></canvas>`:''}<span class="tx"><b>${o[0]}</b><small>${o[1]}</small><span class="risk">${o[2]}</span></span></button>`).join('')}</div>
          <p class="hint">${l.tap}</p>`;
      } else {
        const [d,k] = G.res; const txt = G.step===2 ? q.r[k] : q.r[G.pick][k];
        const dcls = d>0?'up':d<0?'down':'zero';
        h += `<div class="slab"><div class="outcome"><div><span class="lbl">${l.youPicked}: ${q.o[G.pick][0]}</span><h2>${txt}</h2></div>
          <span class="delta ${dcls}">${d>0?'+':d<0?'−':'±'}${Math.abs(d)} ${l.coinsW}</span></div>
          ${G.step===0?`<div class="mapwrap"><canvas data-map></canvas></div>`:''}</div>
          <div class="learn"><div class="you"><b>${l.aboutYou}</b>${q.you[G.pick]}</div><div class="real"><b>${l.realLife}</b>${q.real}</div></div>
          <button class="btn btn-blue" data-act="next">${q.next} →</button>`;
      }
    } else {
      const r = profileFrom(G.scores), c = l.ch[r.idx];
      h += guide(l.revealG) + `<div class="slab"><div class="hero"><canvas data-sprite="${r.key}" aria-hidden="true"></canvas><div><span class="kicker">${l.youAre}</span><h2>${c[0]}</h2><p>${c[1]}</p></div></div>
        <div class="stats">${l.stats.map((s,i)=>`<div class="stat"><span>${s}</span><span class="bar"><i style="width:${r.stats[i]}%"></i></span></div>`).join('')}</div>
        <p>${r.inconsistent?l.inco:l.coh}</p></div>
        <div class="profile"><p class="k">${l.sugg}</p><div class="pills">${['low','medium','high'].map(k=>`<span class="pill ${k===r.risk?'on':''}">${l.risk[k]}</span>`).join('')}</div><p>${l.riskD[r.risk]}</p></div>
        <div class="row"><button class="btn btn-blue" data-act="use">${l.use}</button><button class="btn btn-ghost" data-act="skip">${l.manual}</button></div>
        <button class="link" data-act="again">${l.again}</button><p class="fine">${l.fine}</p>`;
    }
    modal.innerHTML = h;
    modal.querySelectorAll('[data-sprite]').forEach(cv=>drawSprite(cv,cv.dataset.sprite));
    modal.querySelectorAll('[data-map]').forEach(cv=>drawMap(cv,G.res?G.pick:G.hover));
    modal.querySelectorAll('[data-icon]').forEach(cv=>drawIcon(cv,+cv.dataset.icon));
    modal.querySelectorAll('[data-scene]').forEach(cv=>cv.dataset.scene==='storm'?drawStorm(cv):drawMerchant(cv));
  }
  function hover(i){ if(G.step!==0||G.res||G.hover===i)return; G.hover=i; const cv=modal.querySelector('[data-map]'); if(cv)drawMap(cv,i);
    modal.querySelectorAll('.pin').forEach((p,k)=>p.classList.toggle('hl',k===i)); }
  modal.addEventListener('pointerover', e=>{ const b=e.target.closest('[data-opt]'); if(b) hover(+b.dataset.opt); });
  modal.addEventListener('focusin', e=>{ const b=e.target.closest('[data-opt]'); if(b) hover(+b.dataset.opt); });
  modal.addEventListener('click', e=>{
    const b = e.target.closest('button'); if(!b) return;
    if (b.dataset.lang) { G.lang=b.dataset.lang; return render(); }
    if (b.dataset.opt!==undefined) { const i=+b.dataset.opt; G.pick=i; G.scores[G.step]=i+1; G.res=outcome(G.step,i,G.coins); G.coins=Math.max(0,G.coins+G.res[0]); render(); modal.scrollTop=0; return; }
    const a=b.dataset.act;
    if (a==='go') { G.step=0; return render(); }
    if (a==='next') { G.step++; G.pick=null; G.res=null; G.hover=null; if(G.step===1){G.storm=Math.round(G.coins*.3);G.coins-=G.storm} render(); modal.scrollTop=0; return; }
    if (a==='again') { Object.assign(G,{step:0,coins:100,scores:[],pick:null,res:null,hover:null}); return render(); }
    if (a==='use') return done(profileFrom(G.scores));
    if (a==='skip') return done(null);
  });
  function onKey(e){ if(e.key==='Escape') done(null); }
  document.addEventListener('keydown', onKey);
  function unmount(){ document.removeEventListener('keydown', onKey); style.remove(); wrap.remove(); }
  function done(r){ unmount(); opts.onComplete && opts.onComplete(r); }
  render();
  return unmount;
}

export default function OnboardingQuest({ open, lang = "en", skin = "metal", onComplete }: Props) {
  const unmountRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!open) return;
    const unmount = mountQuest(document.body, {
      lang,
      skin,
      onComplete: (r: QuestResult | null) => {
        unmountRef.current = null;
        onComplete(r);
      }
    });
    unmountRef.current = unmount;
    return () => {
      if (unmountRef.current) {
        unmountRef.current();
        unmountRef.current = null;
      }
    };
  }, [open, lang, skin, onComplete]);

  return null;
}
