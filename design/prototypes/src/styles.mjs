// Shared stylesheet for every artboard. Values mirror src/index.css and spec §11.
export const FONT_LINK =
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&amp;display=swap">'

export const CSS = `
*{box-sizing:border-box}
body{margin:0;background:#f4f6fa}
a{color:#2449dc;text-decoration:none}a:hover{color:#1c39b3}
.gm{--canvas:#f4f6fa;--surface:#ffffff;--surface-2:#f7f8fb;--border:#e2e6ee;--border-strong:#cbd2de;
--text:#101828;--text-2:#475467;--muted:#667085;--faint:#98a2b3;
--brand:#2449dc;--brand-hover:#1c39b3;--brand-50:#eef3ff;--brand-100:#dce6ff;--brand-ring:rgba(36,73,220,.16);
--income:#0b6e36;--income-50:#ecfbf2;--income-100:#d2f5e0;--income-icon:#1fa35a;
--expense:#d42b35;--expense-50:#fff1f1;--expense-100:#ffe0e1;--expense-icon:#e5484f;
--pending:#9a5b06;--pending-50:#fff8eb;--pending-100:#feecc7;--pending-icon:#e29a0c;
--neutral-50:#eef1f6;--neutral-100:#e2e6ee;
--sidebar:#0b1533;--sidebar-2:#14204a;--sidebar-line:rgba(255,255,255,.08);--sidebar-text:#b4c0dc;--sidebar-muted:#7483a8;
--chart-income:#0b6e36;--chart-expense:#ee6368;--chart-net:#2449dc;--grid:#e2e6ee;
--m1:#2a78d6;--m2:#eb6834;--m3:#1baf7a;--m4:#eda100;--m5:#e87ba4;
--shadow-card:0 1px 2px rgba(16,24,40,.04);
--shadow-pop:0 12px 24px -6px rgba(16,24,40,.14),0 4px 8px -4px rgba(16,24,40,.06);
--shadow-dialog:0 24px 48px -12px rgba(16,24,40,.28);
font-family:"Plus Jakarta Sans","Segoe UI",system-ui,-apple-system,sans-serif;font-size:14px;line-height:20px;color:var(--text);
-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.gm.dark{--canvas:#0a1120;--surface:#111a2e;--surface-2:#16213a;--border:#22304d;--border-strong:#2e3d5f;
--text:#e8ecf4;--text-2:#b3bdd0;--muted:#8a95ab;--faint:#5d6a84;
--brand:#3d63f2;--brand-hover:#5f84fb;--brand-50:#17224a;--brand-100:#22336b;--brand-ring:rgba(95,132,251,.28);
--income:#3fcf86;--income-50:#0f2b20;--income-100:#14402c;--income-icon:#3fcf86;
--expense:#ff8a8f;--expense-50:#361a22;--expense-100:#4a1f2a;--expense-icon:#ff8a8f;
--pending:#f5b83d;--pending-50:#352812;--pending-100:#4a3714;--pending-icon:#f5b83d;
--neutral-50:#1a2540;--neutral-100:#22304d;
--sidebar:#060c1c;--sidebar-2:#101a36;
--chart-income:#23a863;--chart-expense:#b93a42;--chart-net:#5f84fb;--grid:#22304d;
--m1:#3987e5;--m2:#d95926;--m3:#199e70;--m4:#c98500;--m5:#d55181;
--shadow-card:0 1px 2px rgba(0,0,0,.3);--shadow-pop:0 12px 24px -6px rgba(0,0,0,.5);--shadow-dialog:0 24px 48px -12px rgba(0,0,0,.6)}
.num{font-variant-numeric:tabular-nums}
.row{display:flex;align-items:center}
.col{display:flex;flex-direction:column}
.grow{flex:1;min-width:0}
.muted{color:var(--muted)}.text-2{color:var(--text-2)}
.pos{color:var(--income)}.neg{color:var(--expense)}.warn{color:var(--pending)}
.xs{font-size:12px;line-height:16px}.sm{font-size:13px;line-height:18px}.md{font-size:14px;line-height:20px}
.w5{font-weight:500}.w6{font-weight:600}.w7{font-weight:700}
.nowrap{white-space:nowrap}
/* App shell */
.app{width:1440px;display:flex;background:var(--canvas);position:relative;overflow:hidden}
.sb{width:264px;flex:none;background:var(--sidebar);display:flex;flex-direction:column;padding:20px 14px 16px;gap:18px;color:var(--sidebar-text)}
.sb-brand{display:flex;align-items:center;gap:10px;padding:2px 8px}
.wordmark{font-weight:800;font-size:19px;letter-spacing:.02em;line-height:1}
.sb-biz{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border-radius:12px;background:var(--sidebar-2);border:1px solid var(--sidebar-line)}
.sb-group{display:flex;flex-direction:column;gap:2px}
.sb-label{font-size:11px;line-height:16px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--sidebar-muted);padding:0 12px 6px}
.nav{display:flex;align-items:center;gap:12px;height:38px;padding:0 12px;border-radius:10px;font-weight:500;color:var(--sidebar-text)}
.nav.on{background:#2449dc;color:#fff;font-weight:600;box-shadow:0 6px 16px -8px rgba(36,73,220,.9)}
.nav .count{margin-left:auto;font-size:11px;font-weight:700;background:rgba(255,255,255,.1);color:#dfe6f7;border-radius:99px;padding:1px 7px}
.sb-close{margin-top:auto;border-radius:14px;background:var(--sidebar-2);border:1px solid var(--sidebar-line);padding:14px;display:flex;flex-direction:column;gap:10px}
.sb-user{display:flex;align-items:center;gap:10px;padding:8px 8px 0;border-top:1px solid var(--sidebar-line);padding-top:14px}
.main{flex:1;min-width:0;display:flex;flex-direction:column}
.topbar{height:64px;flex:none;display:flex;align-items:center;gap:12px;padding:0 32px;background:var(--surface);border-bottom:1px solid var(--border)}
.content{padding:28px 32px 40px;display:flex;flex-direction:column;gap:20px}
.page-h{display:flex;align-items:flex-end;justify-content:space-between;gap:24px}
.h1{font-size:24px;line-height:32px;font-weight:700;letter-spacing:-.01em;margin:0}
.sub{color:var(--muted);margin-top:4px}
.crumbs{display:flex;align-items:center;gap:6px;color:var(--muted);font-size:13px}
/* Surfaces */
.card{background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow-card)}
.card-h{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 20px 0}
.card-t{font-size:16px;line-height:24px;font-weight:600;margin:0}
.card-b{padding:16px 20px 20px}
.divider{height:1px;background:var(--border)}
.grid{display:grid;gap:20px}
.g2{grid-template-columns:repeat(2,minmax(0,1fr))}.g3{grid-template-columns:repeat(3,minmax(0,1fr))}.g4{grid-template-columns:repeat(4,minmax(0,1fr))}
.g-main{grid-template-columns:minmax(0,2fr) minmax(0,1fr)}
/* Stat tiles */
.stat{padding:18px 20px;display:flex;flex-direction:column;gap:10px}
.stat-top{display:flex;align-items:center;justify-content:space-between}
.stat-l{font-size:13px;line-height:18px;font-weight:600;color:var(--text-2)}
.stat-v{font-size:28px;line-height:36px;font-weight:700;letter-spacing:-.02em}
.stat-v.sm{font-size:20px;line-height:28px}
.ico{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;flex:none}
.ico.in{background:var(--income-50);color:var(--income-icon)}.ico.out{background:var(--expense-50);color:var(--expense-icon)}
.ico.brand{background:var(--brand-50);color:var(--brand)}.ico.warn{background:var(--pending-50);color:var(--pending-icon)}.ico.neutral{background:var(--neutral-50);color:var(--text-2)}
.delta{display:inline-flex;align-items:center;gap:3px;font-size:12px;font-weight:600;border-radius:99px;padding:2px 7px}
.delta.good{background:var(--income-50);color:var(--income)}.delta.bad{background:var(--expense-50);color:var(--expense)}
/* Badges */
.badge{display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 9px;border-radius:99px;font-size:12px;line-height:16px;font-weight:600;white-space:nowrap}
.b-success{background:var(--income-50);color:var(--income)}.b-danger{background:var(--expense-50);color:var(--expense)}
.b-warning{background:var(--pending-50);color:var(--pending)}.b-info{background:var(--brand-50);color:var(--brand)}
.b-neutral{background:var(--neutral-50);color:var(--text-2)}
.b-outline{background:transparent;border:1px solid var(--border-strong);color:var(--text-2)}
.dot{width:8px;height:8px;border-radius:99px;display:inline-block;flex:none}
/* Buttons */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:40px;padding:0 16px;border-radius:10px;font-weight:600;font-size:14px;border:1px solid transparent;white-space:nowrap;font-family:inherit;cursor:pointer}
.btn-primary{background:var(--brand);color:#fff;box-shadow:0 1px 2px rgba(16,24,40,.1),inset 0 1px 0 rgba(255,255,255,.14)}
.btn-secondary{background:var(--surface);border-color:var(--border-strong);color:var(--text);box-shadow:0 1px 2px rgba(16,24,40,.05)}
.btn-ghost{background:transparent;color:var(--text-2)}
.btn-danger{background:var(--expense);color:#fff}
.btn-success{background:var(--income);color:#fff}
.btn-sm{height:32px;padding:0 12px;font-size:13px;border-radius:8px}
.btn-lg{height:48px;padding:0 20px;font-size:15px;border-radius:12px}
.btn[disabled]{opacity:.45;cursor:not-allowed}
.icon-btn{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;color:var(--text-2);border:1px solid var(--border);background:var(--surface)}
/* Forms */
.field{display:flex;flex-direction:column;gap:6px}
.label{font-size:13px;line-height:18px;font-weight:600;color:var(--text)}
.label .opt{font-weight:500;color:var(--muted)}
.input{height:42px;border:1px solid var(--border-strong);border-radius:10px;padding:0 12px;display:flex;align-items:center;gap:8px;background:var(--surface);color:var(--text)}
.input.focus{border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-ring)}
.input.err{border-color:var(--expense);box-shadow:0 0 0 3px rgba(212,43,53,.12)}
.input .ph{color:var(--muted)}
.input.lg{height:60px;font-size:28px;font-weight:700;letter-spacing:-.02em;border-radius:12px}
.textarea{min-height:84px;align-items:flex-start;padding:10px 12px}
.help{font-size:12px;line-height:16px;color:var(--muted)}.help.err{color:var(--expense);font-weight:500}
.chips{display:flex;gap:8px;flex-wrap:wrap}
.chip{height:36px;padding:0 12px;border-radius:10px;border:1px solid var(--border-strong);background:var(--surface);display:inline-flex;align-items:center;gap:8px;font-weight:500;color:var(--text-2)}
.chip.on{border-color:var(--brand);background:var(--brand-50);color:var(--brand);font-weight:600;box-shadow:0 0 0 1px var(--brand) inset}
.seg{display:inline-flex;padding:3px;background:var(--neutral-50);border-radius:10px;gap:2px}
.seg>span{height:30px;padding:0 12px;border-radius:8px;display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--muted)}
.seg>span.on{background:var(--surface);color:var(--text);box-shadow:0 1px 2px rgba(16,24,40,.1)}
.switch{width:36px;height:20px;border-radius:99px;background:var(--neutral-100);position:relative;flex:none}
.switch::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:99px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2)}
.switch.on{background:var(--brand)}.switch.on::after{left:18px}
.checkbox{width:18px;height:18px;border-radius:5px;border:1.5px solid var(--border-strong);display:grid;place-items:center;flex:none;background:var(--surface)}
.checkbox.on{background:var(--brand);border-color:var(--brand);color:#fff}
.checkbox.locked{background:var(--neutral-50);border-color:var(--border);color:var(--faint)}
/* Filter bar */
.filters{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.fbtn{height:36px;padding:0 12px;border-radius:10px;border:1px solid var(--border-strong);background:var(--surface);display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--text)}
.fbtn .v{color:var(--brand)}
.fchip{height:28px;padding:0 6px 0 10px;border-radius:99px;background:var(--brand-50);color:var(--brand);display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600}
.search{height:36px;min-width:260px;border-radius:10px;border:1px solid var(--border-strong);background:var(--surface);display:flex;align-items:center;gap:8px;padding:0 12px;color:var(--muted);font-size:13px}
/* Tables */
.tbl{width:100%;border-collapse:collapse}
.tbl th{height:40px;padding:0 16px;text-align:left;font-size:12px;line-height:16px;font-weight:600;color:var(--muted);background:var(--surface-2);border-bottom:1px solid var(--border);white-space:nowrap}
.tbl td{height:56px;padding:0 16px;border-bottom:1px solid var(--border);font-size:13.5px;color:var(--text-2);vertical-align:middle}
.tbl tr:last-child td{border-bottom:none}
.tbl .r{text-align:right}
.tbl td.amt{font-weight:600;font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}
.tbl td.pos{color:var(--income)}.tbl td.neg{color:var(--expense)}.tbl td.ink{color:var(--text)}
.kpi .stat{justify-content:space-between}
.tbl tr.voided td{color:var(--faint)}.tbl tr.voided td.amt{text-decoration:line-through}
.tbl tr.sel td{background:var(--brand-50)}
.t-main{color:var(--text);font-weight:600}
.ref{font-weight:600;color:var(--text-2);font-variant-numeric:tabular-nums;font-size:12.5px;white-space:nowrap}
.tbl.compact th,.tbl.compact td{padding:0 12px}
.pager{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-top:1px solid var(--border)}
/* Avatars */
.av{width:32px;height:32px;border-radius:99px;display:grid;place-items:center;font-size:12px;font-weight:700;color:#fff;flex:none;letter-spacing:.02em}
.av.s{width:24px;height:24px;font-size:10px}.av.l{width:56px;height:56px;font-size:18px}.av.xl{width:72px;height:72px;font-size:24px}
/* Misc */
.prog{height:6px;border-radius:99px;background:var(--brand-100);overflow:hidden}.prog>span{display:block;height:100%;border-radius:99px;background:var(--brand)}
.prog.ok>span{background:var(--income-icon)}
.kv{display:grid;grid-template-columns:160px minmax(0,1fr);row-gap:12px;column-gap:16px}
.kv>div:nth-child(odd){color:var(--muted)}
.callout{display:flex;gap:12px;padding:12px 14px;border-radius:12px;border:1px solid var(--border)}
.callout.info{background:var(--brand-50);border-color:var(--brand-100);color:var(--text)}
.callout.warn{background:var(--pending-50);border-color:var(--pending-100)}
.callout.danger{background:var(--expense-50);border-color:var(--expense-100)}
.callout.success{background:var(--income-50);border-color:var(--income-100)}
.kbd{font-size:11px;font-weight:600;border:1px solid var(--border-strong);border-bottom-width:2px;border-radius:6px;padding:1px 5px;color:var(--muted)}
/* Overlays */
.scrim{position:absolute;inset:0;background:rgba(10,17,32,.46)}
.drawer{position:absolute;top:0;right:0;bottom:0;width:460px;background:var(--surface);box-shadow:var(--shadow-dialog);display:flex;flex-direction:column}
.dialog{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:var(--surface);border-radius:18px;box-shadow:var(--shadow-dialog);display:flex;flex-direction:column;overflow:hidden}
.overlay-h{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:20px 24px;border-bottom:1px solid var(--border)}
.overlay-b{padding:20px 24px;display:flex;flex-direction:column;gap:18px}
.overlay-f{display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:16px 24px;border-top:1px solid var(--border);background:var(--surface-2)}
.toast{position:absolute;display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:12px;background:#101828;color:#fff;box-shadow:var(--shadow-pop);font-size:13px}
.tooltip{position:absolute;background:var(--surface);border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow-pop);padding:10px 12px;font-size:12px;line-height:16px}
/* Mobile */
.phone{width:390px;height:844px;background:var(--canvas);position:relative;display:flex;flex-direction:column;overflow:hidden}
.m-top{height:56px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 16px;background:var(--surface);border-bottom:1px solid var(--border)}
.m-body{flex:1;min-height:0;overflow:hidden;padding:16px;display:flex;flex-direction:column;gap:14px}
.m-nav{height:76px;flex:none;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));align-items:center;background:var(--surface);border-top:1px solid var(--border);padding:0 6px 10px}
.m-nav-i{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:11px;font-weight:600;color:var(--muted);height:48px;justify-content:center}
.m-nav-i.on{color:var(--brand)}
.m-fab{width:56px;height:56px;border-radius:18px;background:var(--brand);color:#fff;display:grid;place-items:center;margin:-22px auto 0;box-shadow:0 10px 20px -8px rgba(36,73,220,.8)}
.sheet{position:absolute;left:0;right:0;bottom:0;background:var(--surface);border-radius:22px 22px 0 0;box-shadow:var(--shadow-dialog);display:flex;flex-direction:column}
.grabber{width:40px;height:4px;border-radius:99px;background:var(--border-strong);margin:10px auto 4px}
`
