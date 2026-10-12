import json
# ---- Brand: change BRAND_NAME to rename everywhere (placeholder until George confirms) ----
BRAND_NAME='FAS Evidence'
ORG_NAME='Family Advocacy Services'
_w=BRAND_NAME.split(' ',1)
WM=f'<div class="wordmark" aria-label="{BRAND_NAME}"><span class="wm-fas">{_w[0]}</span>'+(f'<span class="wm-rule"></span><span class="wm-grants">{_w[1]}</span>' if len(_w)>1 else '')+'</div>'
HEAD='<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{t} · {brand}</title><link rel="stylesheet" href="ds.css"><style>{css}</style></head><body><a class="skip" href="#main">Skip to content</a>{body}</body></html>'
NAV={
'staff':[('Workspace',[('Home','home'),('Team dashboard','dash'),('County need map','map'),('Data freshness','fresh')]),
         ('FAS data',[('Upload data','upload'),('Cases','cases'),('Aggregate totals','agg')]),
         ('Grants',[('Matches','grants','12'),('Pipeline','pipe','7'),('Strategy drafts','drafts','2')]),
         ('Share',[('Packets','packets'),('Methodology','method')])],
'admin':None,
'board':[('Board',[('Board dashboard','bhome'),('Board packets','bpack'),('County need map','map'),('Methodology','method')])],
}
def sidebar(role,active):
    groups=NAV[role]
    h='<nav class="sidebar" aria-label="Primary"><div class="brand">'+WM+'<button class="closebtn" aria-label="Close navigation">✕</button></div>'
    h+=f'<div class="orgline">{ORG_NAME}</div>'
    for g,items in groups:
        h+=f'<div class="navgroup">{g}</div>'
        for it in items:
            lab,key=it[0],it[1]; c=f'<span class="count">{it[2]}</span>' if len(it)>2 else ''
            a=' active" aria-current="page' if key==active else ''
            h+=f'<a class="nav{a}" href="#"><span class="ic"></span>{lab}{c}</a>'
    note='Read-only access · aggregates only' if role=='board' else 'Synthetic data · preview'
    h+=f'<div class="sidefoot">{note}</div></nav>'
    return h
def topbar(crumbs,user,role,fresh=True):
    f='<span class="badge b-ok"><span class="dot"></span>Public data updated 2 days ago</span>' if fresh else ''
    rb={'staff':'Staff','board':'Board · read-only','admin':'Admin'}[role]
    return f'<header class="topbar"><div class="crumbs">{crumbs}</div><div class="sp"></div>{f}<span class="envbadge">Synthetic data</span><div class="user"><div class="avatar">{user[0]}</div><div><div style="font-weight:500">{user[1]}</div><div class="muted" style="font-size:11px">{rb}</div></div></div></header>'
def page(name,title,body,css=''):
    open(name+'.html','w').write(HEAD.format(t=title,css=css,body=body.replace('__WM__',WM).replace('__ORG__',ORG_NAME).replace('__BRAND__',BRAND_NAME),brand=BRAND_NAME))
def shell(role,active,crumbs,user,content,fresh=True):
    return f'<div class="shell">{sidebar(role,active)}<div class="scrim"></div><div class="main"><div class="mbar"><button class="menubtn" aria-label="Open navigation" aria-expanded="false"><span></span><span></span><span></span></button>'+WM+f'<div class="avatar">{user[0]}</div></div>{topbar(crumbs,user,role,fresh)}<main id="main" class="content">{content}</main></div></div>'
SF=lambda s:f'<div class="srcfoot">{s}</div>'
STAFF=('JR','Jordan R. (synthetic)')
BOARD=('MT','Board member (synthetic)')

# ---------- P0 login
page('p0-login','Sign in','''
<div class="login-split" style="display:grid;grid-template-columns:1fr 1fr;min-height:100vh">
<main id="main" style="display:grid;place-items:center;padding:48px">
 <div class="login-card" style="width:400px">
  <div class="brand" style="padding:0 0 30px;flex-direction:column;align-items:flex-start;gap:6px"><div style="transform:scale(1.3);transform-origin:left">__WM__</div><small class="muted" style="font-size:12px;margin-top:6px">__ORG__</small></div>
  <h1 class="login-h1" style="font-size:2.2rem">Sign in to __BRAND__</h1>
  <p class="muted" style="margin:8px 0 28px;font-size:15px">Use the email your administrator invited.</p>
  <div class="alert" style="background:var(--destructive-soft);color:var(--destructive);border-color:oklch(0.86 0.05 25);margin-bottom:18px" role="alert"><b>!</b><div><b>Email or password is incorrect.</b> Check both and try again. After 5 attempts, sign-in pauses for 15 minutes.</div></div>
  <div class="field"><label for="e">Email</label><div class="input">director@example.org</div></div>
  <div class="field"><div style="display:flex;justify-content:space-between"><label for="p">Password</label><a href="#" style="font-size:13px;color:var(--primary);font-weight:500">Forgot password?</a></div><div class="input focus"><span>••••••••••••</span><span class="sm" style="color:var(--primary);font-weight:500">Show</span></div></div>
  <button class="btn primary lg" style="margin-top:8px">Sign in</button>
  <p class="muted sm" style="margin-top:22px">New board member? Use the link in your invitation email to set a password.</p>
 </div>
</main>
<aside style="background:var(--sidebar);border-left:1px solid var(--border);display:flex;flex-direction:column;justify-content:space-between;padding:56px 64px" aria-label="About">
 <span class="envbadge" style="align-self:flex-start">Synthetic data · preview</span>
 <div>
  <p class="xs muted" style="margin-bottom:16px">Public data to proof</p>
  <p class="serif" style="font-size:2.5rem;line-height:1.15;font-weight:600;letter-spacing:-.015em;max-width:520px">Public data shows where families struggle. Your records show what happens next.</p>
  <div class="card pad" style="margin-top:36px;max-width:420px">
   <div class="kpi"><div class="label">Days from court order to first session <span class="badge b-mute">Example</span></div><div class="val">23<small>days median</small></div></div>
   <div class="srcfoot">FAS records · Q3 2026 · n = 64 · synthetic</div>
  </div>
 </div>
 <p class="sm muted" style="display:flex;gap:8px;align-items:center"><span class="lock"></span> Protected data. County-level only; counts under 11 are hidden. Every sign-in is logged.</p>
</aside></div>''')

# ---------- P0 staff home in shell
kpis=[('Court order → first session','23','days median','FAS records · Q3 2026 · n = 64','↓ 4 days vs Q2','b-ok'),
      ('Application → decision','9','days median','FAS records · Q3 2026 · n = 118','↑ 1 day vs Q2','b-warn'),
      ('Completion rate','71%','','FAS records · Q3 2026 · n = 92 closed','↑ 3 pts','b-ok')]
def kpicard(l,v,u,src,d,cls):
    return f'<div class="card pad kpi"><div class="label">{l}<span class="badge {cls}">{d}</span></div><div class="val">{v}<small>{u}</small></div>{SF(src+" · as of Sep 30, 2026")}</div>'
home=f'''<div class="pagehead"><div><p class="xs muted">Saturday, October 10</p><h1>Good afternoon, Jordan</h1><p class="muted">Here is what needs you this week.</p></div><div class="sp" style="flex:1"></div><button class="btn outline">Enter a case</button><button class="btn primary">Upload data</button></div>
<div class="grid" style="grid-template-columns:repeat(3,1fr)">{''.join(kpicard(*k) for k in kpis)}</div>
<div class="grid" style="grid-template-columns:1.4fr 1fr;margin-top:16px">
 <section class="card"><div class="pad" style="display:flex;justify-content:space-between;align-items:center;padding-bottom:12px"><h3>To do</h3><span class="muted sm">4 items</span></div>
 <table class="stack"><tbody>
 <tr><td><span class="badge b-bad">! Blocker</span></td><td><b>12 rows failed validation</b><div class="muted sm">Upload “Q3 cases.xlsx” · county code missing</div></td><td class="r"><button class="btn outline sm">Fix rows</button></td></tr>
 <tr><td><span class="badge b-warn">◷ Due in 9 days</span></td><td><b>Sample Family Wellness Fund (synthetic) — submitted?</b><div class="muted sm">Pipeline · pursuing · owner: you</div></td><td class="r"><button class="btn outline sm">Update status</button></td></tr>
 <tr><td><span class="badge b-info">✎ Draft</span></td><td><b>Strategy draft ready for review</b><div class="muted sm">Rural Behavioral Health Access (synthetic)</div></td><td class="r"><button class="btn outline sm">Review</button></td></tr>
 <tr><td><span class="badge b-mute">○ Missing</span></td><td><b>8 cases missing non-start reason</b><div class="muted sm">Needed for M3 · Families who never start</div></td><td class="r"><button class="btn outline sm">Add reasons</button></td></tr>
 </tbody></table></section>
 <section class="card pad"><h3>Data freshness</h3><p class="muted sm" style="margin:4px 0 14px">Public sources used in your numbers</p>
 {''.join(f'<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--border)"><div><b class="sm">{n}</b><div class="muted" style="font-size:12px">{v}</div></div><span class="badge {c}">{s}</span></div>' for n,v,c,s in [("Census SAHIE","2024 estimates · run Oct 8","b-ok","✓ Current"),("HRSA mental health HPSA","daily · run Oct 10","b-ok","✓ Current"),("CDC PLACES","2025 release · run Oct 1","b-ok","✓ Current"),("Utah Courts filings","FY2025 · run Sep 2","b-warn","◷ Stale · 38 days"),("VA VetPop","FY2023 base · failed Oct 9","b-bad","✕ Last run failed")])}
 <a href="#" class="sm" style="display:inline-block;margin-top:12px;color:var(--primary);font-weight:500">Open data freshness →</a></section>
</div>'''
page('p0-staff-home','Staff home',shell('staff','home','<b>Home</b>',STAFF,home))

# ---------- P0 403
f403='''<div style="display:grid;place-items:center;min-height:calc(100vh - 140px)"><div class="card card-403" style="width:560px;padding:40px;text-align:center">
<div style="width:48px;height:48px;border-radius:12px;background:var(--muted);display:grid;place-items:center;margin:0 auto 18px;font-size:22px" aria-hidden="true">🔒</div>
<p class="xs muted">Error 403 · No permission</p>
<h1 style="font-size:1.75rem;margin:8px 0 10px">You don’t have access to Staff tools</h1>
<p class="muted" style="font-size:15px;max-width:420px;margin:0 auto">You’re signed in as <b style="color:var(--foreground)">Board member</b> with read-only access. Staff tools include case-level records, which board accounts can’t see.</p>
<div class="actions" style="display:flex;gap:10px;justify-content:center;margin-top:26px"><button class="btn primary">Go to Board dashboard</button><button class="btn outline">Ask an admin for access</button></div>
<p class="muted sm" style="margin-top:22px">Requested: <span class="mono">/staff/cases</span> · This attempt was logged.</p></div></div>'''
page('p0-403','403',shell('board','none','Staff tools · <b>No permission</b>',BOARD,f403,fresh=False))

# ---------- P0 board home
bh=f'''<div class="pagehead"><div><p class="xs muted">Board · read-only</p><h1>Welcome to the FAS board view</h1><p class="muted">Plain-language results for the next board meeting. All numbers are county-level totals; anything under 11 is hidden.</p></div></div>
<div class="grid" style="grid-template-columns:1.3fr 1fr">
<section class="card pad hero" style="display:flex;gap:24px;align-items:center"><div class="thumb" style="width:120px;height:150px;border:1px solid var(--border);border-radius:6px;background:var(--background);padding:12px;box-shadow:var(--shadow-sm);flex:none"><div class="serif" style="font-size:12px;font-weight:600">Board packet</div><div class="muted" style="font-size:10px">Q3 2026</div><div style="margin-top:12px;display:grid;gap:5px">{"".join('<div style="height:5px;background:var(--muted);border-radius:3px"></div>' for _ in range(7))}</div></div>
<div style="flex:1"><span class="badge b-ok">✓ Ready · generated Oct 6</span><h2 style="margin:10px 0 6px">Q3 2026 board packet</h2><p class="muted">Need by county, FAS results, outcomes, sister-clinic spending and sources. 6 pages, letter size.</p><div class="actions" style="display:flex;gap:10px;margin-top:16px"><button class="btn primary">Download PDF</button><button class="btn outline">Open dashboard</button></div></div></section>
<section class="card pad"><h3>Next board meeting</h3><p class="serif" style="font-size:1.6rem;font-weight:600;margin:8px 0 2px">Thursday, Oct 22</p><p class="muted sm">Packet is current as of Sep 30, 2026.</p>
<div class="alert info" style="margin-top:16px"><b>i</b><div>Earlier packets: Q2 2026 (Jul 14) · Q1 2026 (Apr 9). <a href="#" style="color:inherit;font-weight:600">See all packets</a></div></div></section>
</div>
<h2 style="margin:32px 0 14px">This quarter at a glance</h2>
<div class="grid" style="grid-template-columns:repeat(3,1fr)">
<div class="card pad kpi"><div class="label">Families who started therapy</div><div class="val">86</div><p class="muted sm">Up from 74 last quarter</p>{SF("FAS records · Jul–Sep 2026 · as of Sep 30, 2026")}</div>
<div class="card pad kpi"><div class="label">Typical wait after a court order</div><div class="val">23<small>days</small></div><p class="muted sm">4 days faster than Q2</p>{SF("FAS records · Jul–Sep 2026 · n = 64 · as of Sep 30")}</div>
<div class="card pad kpi"><div class="label">Share of therapy dollars to sister clinic</div><div class="val">38%</div><p class="muted sm">Avg rate $96/hr vs $104/hr at other providers</p>{SF("FAS payments · Jul–Sep 2026 · related party: Connections Counseling")}</div>
</div>'''
page('p0-board-home','Board home',shell('board','bhome','<b>Board home</b>',BOARD,bh))
json.dump({},open('/dev/null','w'))

# ---------- P1 team dashboard
def mk(id_,label,val,unit,detail,src,delta=None,cls='b-mute',extra=''):
    d=f'<span class="badge {cls}">{delta}</span>' if delta else ''
    return f'<div class="card pad kpi"><div class="label"><span><span class="mono" style="color:var(--primary)">{id_}</span> · {label}</span>{d}</div><div class="val">{val}<small>{unit}</small></div><p class="muted sm">{detail}</p>{extra}{SF(src)}</div>'
spark='<svg width="100%" viewBox="0 0 600 64" preserveAspectRatio="none" style="height:130px;display:block" role="img" aria-label="Trend: median days by month, Jan to Sep 2026, falling from 34 to 23"><polyline vector-effect="non-scaling-stroke" fill="none" stroke="oklch(0.38 0.06 160)" stroke-width="2.5" points="0,10 75,14 150,12 225,22 300,26 375,30 450,36 525,40 600,46"/></svg><div style="display:flex;justify-content:space-between;font-size:11px" class="muted"><span>Jan · 34 days</span><span>May · 28</span><span>Sep · 23 days</span></div>'
dash=f'''<div class="pagehead"><div><h1>Team dashboard</h1><p class="muted">FAS results · Jul 1 – Sep 30, 2026 · all counties · all referral sources</p></div><div style="flex:1"></div><span class="badge b-ok" title="Last FAS upload Oct 7; public data Oct 8"><span class="dot"></span>Fresh · FAS data Oct 7 · public data Oct 8</span><button class="btn outline">Export packet</button></div>
<div style="display:flex;gap:8px;margin-bottom:18px;align-items:center"><span class="filter">Date <b>Q3 2026</b> ⌄</span><span class="filter">County <b>All 29</b> ⌄</span><span class="filter">Referral source <b>All</b> ⌄</span><span class="filter">Compare <b>Q2 2026</b> ⌄</span><div style="flex:1"></div><span class="muted sm">Counts under 11 are hidden <span class="supp-chip">— n&lt;11</span></span></div>
<section class="card" style="padding:24px 28px;display:grid;grid-template-columns:1fr 1.25fr;gap:32px;margin-bottom:16px">
 <div><p class="xs" style="color:var(--primary)">Headline · M1</p><h2 style="margin:6px 0 2px">Days from court order to first session</h2><div class="kpi"><div class="val" style="font-size:3.4rem">23<small>days median</small></div></div>
 <div style="display:flex;gap:24px;margin-top:6px" class="sm"><div><div class="muted">25th–75th pct</div><b class="num">14 – 37 days</b></div><div><div class="muted">Still waiting</div><b class="num">9% (6 of 70)</b></div><div><div class="muted">vs Q2</div><b class="num">↓ 4 days (faster)</b></div></div></div>
 <div><p class="muted sm" style="margin-bottom:4px">Median days, by month of court order</p>{spark}</div>
 <div style="grid-column:1/-1">{SF('Source: FAS records · court-involved cases with both dates · n = 64 · as of Sep 30, 2026 · <a href="#" style="color:var(--primary)">Definition</a>')}</div>
</section>
<div class="grid" style="grid-template-columns:repeat(3,1fr)">
{mk('M2','Application → funding decision','9','days median','IQR 5 – 14 days · 118 decided','FAS records · n = 118 · as of Sep 30, 2026','↑ 1 day','b-warn')}
{mk('M3','Approved but never started','12%','within 60 days','Top reason: transportation (5 of 14)','FAS records · n = 116 approved · as of Sep 30, 2026','↓ 2 pts','b-ok')}
{mk('M5','Cost per completed episode','$1,840','','Program total ÷ completed: $2,310','FAS payments · n = 65 completed · as of Sep 30, 2026','↑ $60','b-warn')}
</div>
<div class="grid" style="grid-template-columns:1.25fr 1fr;margin-top:16px">
<section class="card"><div class="pad" style="padding-bottom:12px"><h3><span class="mono" style="color:var(--primary)">M4</span> · Completion rate by income band</h3><p class="muted sm">Completed ÷ closed episodes</p></div>
<table><thead><tr><th>Income band</th><th class="r">Closed</th><th class="r">Completed</th><th>Rate</th></tr></thead><tbody>
<tr><td>Under 100% FPL</td><td class="r">38</td><td class="r">25</td><td><div style="display:flex;gap:10px;align-items:center"><div class="bar" style="flex:1"><i style="width:66%"></i></div><b class="num">66%</b></div></td></tr>
<tr><td>100–199% FPL</td><td class="r">31</td><td class="r">23</td><td><div style="display:flex;gap:10px;align-items:center"><div class="bar" style="flex:1"><i style="width:74%"></i></div><b class="num">74%</b></div></td></tr>
<tr><td>200–299% FPL</td><td class="r supp" title="Hidden so the suppressed band cannot be worked out from the total">—</td><td class="r supp">—</td><td><span class="supp-chip"><span class="lock"></span> Hidden · protects the band below</span></td></tr><tr><td>300%+ FPL</td><td class="r supp" title="Suppressed (n &lt; 11) to protect privacy">— n&lt;11</td><td class="r supp">—</td><td><span class="supp-chip"><span class="lock"></span> Suppressed · fewer than 11 families</span></td></tr>
<tr><td><b>All bands</b></td><td class="r"><b>92</b></td><td class="r"><b>65</b></td><td><b class="num">71%</b> <span class="muted" style="font-size:11px">(includes hidden bands)</span></td></tr>
</tbody></table><div style="padding:0 24px 16px">{SF('FAS records · Jul–Sep 2026 · as of Sep 30, 2026 · complementary suppression applied')}</div></section>
<section class="card pad"><h3><span class="mono" style="color:var(--primary)">M6</span> · Dollars to affiliated vs. other providers</h3><p class="muted sm">Related party: sister clinic (Connections Counseling)</p>
<div style="display:flex;height:34px;border-radius:6px;overflow:hidden;margin:16px 0 8px;border:1px solid var(--border)"><div style="width:38%;background:var(--chart-1);color:white;display:flex;align-items:center;padding-left:10px;font-weight:600">38% sister clinic</div><div style="flex:1;background:repeating-linear-gradient(135deg,oklch(0.85 0.05 245) 0 6px,oklch(0.9 0.04 245) 6px 12px);display:flex;align-items:center;padding-left:10px;font-weight:600;color:oklch(0.3 0.06 245)">62% other providers</div></div>
<table><thead><tr><th></th><th class="r">Dollars</th><th class="r">Avg rate / hr</th></tr></thead><tbody><tr><td>Sister clinic</td><td class="r">$45,980</td><td class="r">$96</td></tr><tr><td>Other providers (11)</td><td class="r">$75,020</td><td class="r">$104</td></tr></tbody></table>
{SF('FAS payments · Jul–Sep 2026 · as of Sep 30, 2026 · always shown with rates')}</section>
</div>'''
page('p1-team-dashboard','Team dashboard',shell('staff','dash','Workspace · <b>Team dashboard</b>',STAFF,dash))

# ---------- P1 board dashboard (print)
bcss='body{background:oklch(0.9 0.01 80)} .sheet{width:816px;margin:32px auto;background:white;box-shadow:var(--shadow-lg);padding:56px 64px;min-height:1056px} .sheet h1{font-size:2rem} .row{display:grid;grid-template-columns:repeat(3,1fr);gap:0;border-top:2px solid var(--foreground);border-bottom:1px solid var(--border)} .row>div{padding:16px 14px;border-right:1px solid var(--border)} .row>div:last-child{border:0} .big{font-family:Inter;font-size:2.1rem;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-.02em} .note{font-size:11px;color:var(--muted-foreground)} .toolbar{width:816px;margin:24px auto 0;display:flex;gap:10px;align-items:center} @media print{.toolbar{display:none}.sheet{box-shadow:none;margin:0}}'
bd=f'''<div class="toolbar"><span class="badge b-info">Print preview · Letter 8.5×11</span><div style="flex:1"></div><button class="btn outline sm">Back to board view</button><button class="btn primary sm">Print / Save PDF</button></div>
<main id="main" class="sheet">
<div style="display:flex;justify-content:space-between;align-items:flex-start"><div><p class="xs muted">Family Advocacy Services · Board summary</p><h1 style="margin-top:6px">How families fared, July–September 2026</h1></div><div style="text-align:right" class="note">Data as of<br><b style="color:var(--foreground);font-size:13px">September 30, 2026</b></div></div>
<p style="margin:14px 0 22px;font-size:14.5px;max-width:620px" class="serif">This quarter FAS helped <b>86 families</b> start therapy. Families with a court order waited a typical <b>23 days</b> for a first session, 4 days faster than last quarter.</p>
<div class="row"><div><p class="note">Families who started therapy</p><div class="big">86</div><p class="note">Q2: 74</p></div><div><p class="note">Typical wait after a court order</p><div class="big">23 days</div><p class="note">Q2: 27 days · n = 64</p></div><div><p class="note">Families who finished therapy</p><div class="big">71%</div><p class="note">65 of 92 who closed</p></div></div>
<h3 style="margin:26px 0 8px" class="serif">Did families improve?</h3>
<table><thead><tr><th>Check-in survey</th><th class="r">Families</th><th class="r">Improved</th><th class="r">Avg change</th></tr></thead><tbody>
<tr><td>Adult survey</td><td class="r">41</td><td class="r">68%</td><td class="r">−9.4 pts (better)</td></tr>
<tr><td>Youth survey</td><td class="r">23</td><td class="r">61%</td><td class="r">−7.1 pts (better)</td></tr>
<tr><td>Other measure</td><td class="r supp">— fewer than 11</td><td class="r supp">—</td><td class="r supp">—</td></tr></tbody></table>
<p class="note" style="margin-top:6px">“—” means fewer than 11 families. We hide small numbers so no family can be identified.</p>
<h3 style="margin:26px 0 8px" class="serif">Where our therapy dollars went</h3>
<table><thead><tr><th>Provider</th><th class="r">Share of dollars</th><th class="r">Average rate per hour</th></tr></thead><tbody><tr><td>Connections Counseling (FAS sister clinic, related party)</td><td class="r">38%</td><td class="r">$96</td></tr><tr><td>Other providers (11)</td><td class="r">62%</td><td class="r">$104</td></tr></tbody></table>
<h3 style="margin:26px 0 8px" class="serif">Need in the counties we serve</h3>
<table><thead><tr><th>County</th><th class="r">Need rank (of 29)</th><th class="r">Uninsured</th><th class="r">Families served</th></tr></thead><tbody><tr><td>County A</td><td class="r">3</td><td class="r">13.1%</td><td class="r">28</td></tr><tr><td>County B</td><td class="r">7</td><td class="r">10.4%</td><td class="r">19</td></tr><tr><td>County C</td><td class="r">12</td><td class="r">9.2%</td><td class="r supp">—</td></tr></tbody></table>
<div style="margin-top:28px;padding-top:10px;border-top:1px solid var(--border)" class="note"><b>Sources.</b> FAS records (synthetic), Jul–Sep 2026, as of Sep 30, 2026 · Census SAHIE 2024 estimates (uninsured) · Need rank: __BRAND__ need score v1, methodology on page 6. Dates shown by quarter. County-level only. Counts under 11 hidden, including totals that could reveal them. Page 1 of 6. · Prepared in __BRAND__.</div>
</main>'''
page('p1-board-dashboard','Board dashboard',bd,bcss)

# ---------- P1 upload mapping
rows=[('Case ID','case_id','A0412, A0413, A0414','ok','Matched'),('Referral date','referral_date','2026-07-02, 2026-07-09','ok','Matched'),
('Court order date','court_order_date','2026-06-20, —, 2026-07-01','ok','Matched · 31 blank (allowed)'),('County','county_fips','Weber, Davis, Slc','warn','3 values need review'),
('Household','household_size','4, 3, 6','ok','Matched'),('Income','income_band','<100%, 100-199%','ok','Matched · 4 values recoded'),
('Notes','— Don’t import —','“family moved…”','skip','Skipped · free text not allowed'),('Referred by','referral_source','Court, School, Self','ok','Matched'),('Provider','—  Choose a field  —','(required)','bad','Required field not mapped')]
st={'ok':('b-ok','✓'),'warn':('b-warn','!'),'skip':('b-mute','—'),'bad':('b-bad','✕')}
steps=['Upload file','Map columns','Validate','Preview','Commit']
stp=''.join(f'<div style="display:flex;align-items:center;gap:10px;flex:1"><div style="width:28px;height:28px;border-radius:99px;display:grid;place-items:center;font-weight:600;font-size:13px;{"background:var(--primary);color:white" if i==1 else ("background:var(--success-soft);color:var(--success);border:1px solid oklch(0.86 0.05 155)" if i==0 else "border:1px solid var(--input);color:var(--muted-foreground)")}">{"✓" if i==0 else i+1}</div><div><div class="sm" style="font-weight:{600 if i==1 else 500}">{s}</div><div class="muted" style="font-size:11px">{["Done","Current step","","",""][i] or "Not started"}</div></div>{"<div style=\'flex:1;height:1px;background:var(--border);margin:0 12px\'></div>" if i<4 else ""}</div>' for i,s in enumerate(steps))
tr=''.join(f'<tr><td><b>{a}</b></td><td class="muted mono">{c}</td><td style="font-size:18px;color:var(--muted-foreground)">→</td><td><div class="input" style="height:34px;{"border-color:var(--destructive)" if s=="bad" else ""}"><span class="{"mono" if not b.startswith("—") else "muted"}">{b}</span><span class="muted">⌄</span></div></td><td><span class="badge {st[s][0]}">{st[s][1]} {m}</span></td></tr>' for a,b,c,s,m in rows)
up=f'''<div class="pagehead"><div><p class="xs muted">Upload data · Q3 cases (synthetic).xlsx · 214 rows</p><h1>Match your columns to __BRAND__ fields</h1><p class="muted">We matched 7 of 9 columns automatically from your last upload. Check the highlighted rows.</p></div></div>
<div class="card pad" style="display:flex;margin-bottom:16px">{stp}</div>
<div class="grid" style="grid-template-columns:1fr 320px">
<section class="card"><table><thead><tr><th>Your column</th><th>Sample values</th><th></th><th style="width:240px">__BRAND__ field</th><th>Status</th></tr></thead><tbody>{tr}</tbody></table></section>
<aside class="grid" style="align-content:start">
<div class="card pad"><h3>Summary</h3><div style="display:grid;gap:8px;margin-top:12px" class="sm"><div style="display:flex;justify-content:space-between"><span>✓ Matched</span><b>6</b></div><div style="display:flex;justify-content:space-between"><span>! Needs review</span><b>1</b></div><div style="display:flex;justify-content:space-between"><span>✕ Required, not mapped</span><b>1</b></div><div style="display:flex;justify-content:space-between"><span>— Skipped</span><b>1</b></div></div></div>
<div class="alert warn" role="alert"><b>!</b><div><b>“Provider” is required.</b> Choose the __BRAND__ field, or download the template to see the expected format.</div></div>
<div class="alert info"><b>i</b><div>Free-text notes are never imported. __BRAND__ does not store clinical notes, diagnoses or substance-use details.</div></div>
<div class="card pad sm"><b>Save this mapping</b><p class="muted" style="margin:4px 0 10px">Reuse it next quarter so uploads take under a minute.</p><label style="display:flex;gap:8px;align-items:center"><span style="width:16px;height:16px;border-radius:4px;background:var(--primary);color:white;display:grid;place-items:center;font-size:11px">✓</span> Remember as “Quarterly case export”</label></div>
</aside></div>
<div style="display:flex;justify-content:space-between;margin-top:20px"><button class="btn outline">← Back</button><div style="display:flex;gap:10px;align-items:center"><span class="muted sm">Map the required field to continue</span><button class="btn primary" aria-disabled="true" style="opacity:.5">Validate 214 rows →</button></div></div>'''
page('p1-upload-mapping','Upload mapping',shell('staff','upload','FAS data · Upload data · <b>Map columns</b>',STAFF,up))

# ---------- P1 county map (tile cartogram)
import random
random.seed(7)
layout=[["","Box Elder","Cache","Rich","",""],["","Weber","Morgan","Summit","Daggett",""],["Tooele","Davis","Salt Lake","Wasatch","Duchesne","Uintah"],
["Millard","Juab","Utah","Carbon","Emery","Grand"],["","Beaver","Sanpete","Sevier","Wayne","San Juan"],["Washington","Iron","Piute","Garfield","Kane",""]]
NP={"Daggett","Piute","Rich"}
names=[n for r in layout for n in r if n and n not in NP]
scores={n:round(random.uniform(-1.6,2.1),2) for n in names}
scores['San Juan']=2.31;scores['Carbon']=1.74;scores['Emery']=1.52
rank={n:i+1 for i,n in enumerate(sorted(scores,key=lambda k:-scores[k]))}
bins=[(-9,-0.5,'oklch(0.94 0.02 160)','#1c1915','Lower'),(-0.5,0.3,'oklch(0.82 0.05 160)','#1c1915','Below avg'),(0.3,1.0,'oklch(0.62 0.07 160)','white','Above avg'),(1.0,9,'oklch(0.38 0.06 160)','white','Highest')]
def col(s):
    for lo,hi,c,t,l in bins:
        if lo<=s<hi: return c,t
tiles=''
for r,row in enumerate(layout):
    for c,n in enumerate(row):
        if not n: continue
        sel=n=='Carbon'
        if n in NP:
            tiles+=f'<div class="tile np" style="grid-row:{r+1};grid-column:{c+1}"><b>{n}</b><span>Not published</span></div>'
        else:
            bg,fg=col(scores[n]); tiles+=f'<div class="tile{" sel" if sel else ""}" style="grid-row:{r+1};grid-column:{c+1};background:{bg};color:{fg}"><b>{n}</b><span>#{rank[n]} · {scores[n]:+.2f}</span></div>'
mcss='.tiles{display:grid;grid-template-columns:repeat(6,1fr);grid-auto-rows:78px;gap:6px}.tile{border-radius:6px;padding:8px 10px;display:flex;flex-direction:column;justify-content:space-between;font-size:12.5px;border:1px solid oklch(0 0 0/.06)}.tile span{font-size:11.5px;font-variant-numeric:tabular-nums;opacity:.9}.tile.np{background:repeating-linear-gradient(135deg,var(--suppressed) 0 6px,white 6px 12px);color:var(--muted-foreground);border:1px dashed var(--input)}.tile.sel{outline:3px solid oklch(0.65 0.11 75);outline-offset:2px}'
legend=''.join(f'<div style="display:flex;gap:8px;align-items:center" class="sm"><span style="width:22px;height:14px;border-radius:3px;background:{c};border:1px solid oklch(0 0 0/.08)"></span>{l} <span class="muted num">({"" if lo<-8 else f"{lo:+.1f}"}{" to " if lo>-8 and hi<8 else ""}{"" if hi>8 else f"{hi:+.1f}"}{" and below" if lo<-8 else ""}{" and above" if hi>8 else ""})</span></div>' for lo,hi,c,t,l in bins)+'<div style="display:flex;gap:8px;align-items:center" class="sm"><span style="width:22px;height:14px;border-radius:3px;background:repeating-linear-gradient(135deg,var(--suppressed) 0 4px,white 4px 8px);border:1px dashed var(--input)"></span>Not published</div>'
ind=[('Uninsured rate','12.8%','Census SAHIE · 2024 est. · MOE ±1.9'),('Mental health shortage (HPSA score)','18 of 25','HRSA · designations as of Oct 10, 2026'),('Adults with frequent mental distress','17.9%','CDC PLACES · 2025 release (2023 data)'),('Court filings per 1,000 residents','41.2','Utah Courts FY2025 + ACS 2020–24 · <span style="color:var(--warning);font-weight:600">◷ stale 38 days</span>'),('Child poverty (optional layer)','19.6%','Census SAIPE · 2024')]
mp=f'''<div class="pagehead"><div><h1>County need map</h1><p class="muted">Relative need across Utah’s 29 counties. Scores rank counties against each other; they are not absolute measures of need.</p></div><div style="flex:1"></div><div class="seg" role="tablist"><span class="on">Map</span><span>Table</span></div><button class="btn outline">Methodology</button></div>
<div class="grid" style="grid-template-columns:1fr 400px">
<section class="card pad"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><div style="display:flex;gap:8px"><span class="filter">Layer <b>Need score v1</b> ⌄</span><span class="filter">Vintage <b>Latest</b> ⌄</span></div><span class="muted sm">Schematic tile map · each tile shows rank and score</span></div>
<div class="tiles">{tiles}</div>
<div style="display:flex;gap:18px;flex-wrap:wrap;margin-top:18px">{legend}</div>
{SF('Need score v1 · weights approved Oct 2026 · inputs SAHIE 2024, HRSA HPSA (Oct 10, 2026), CDC PLACES 2025, Utah Courts FY2025 · 26 of 29 counties scored; 3 not published (an input is missing for small populations)')}</section>
<aside class="card pad"><p class="xs muted">Selected county</p><div style="display:flex;justify-content:space-between;align-items:baseline"><h2 style="margin:4px 0">Carbon County</h2><span class="mono muted">FIPS 49007</span></div>
<div style="display:flex;gap:10px;align-items:center;margin:6px 0 16px"><span class="badge b-info">Rank #{rank["Carbon"]} of 26 scored</span><span class="badge b-mute">Score +1.74 · Highest band</span></div>
{''.join(f'<div style="padding:11px 0;border-top:1px solid var(--border)"><div style="display:flex;justify-content:space-between"><span class="sm">{a}</span><b class="num">{b}</b></div><div class="muted" style="font-size:11.5px;margin-top:2px">{c}</div></div>' for a,b,c in ind)}
<div style="padding:11px 0;border-top:1px solid var(--border)"><div style="display:flex;justify-content:space-between"><span class="sm">Veterans per 1,000</span><span class="badge b-mute">Not published</span></div><div class="muted" style="font-size:11.5px;margin-top:2px">VA VetPop · last run failed Oct 9 · showing nothing rather than old data</div></div>
<div style="display:flex;gap:8px;margin-top:14px"><button class="btn primary sm">Add to grant packet</button><button class="btn outline sm">County profile</button></div></aside></div>'''
page('p1-county-map','County need map',shell('staff','map','Workspace · <b>County need map</b>',STAFF,mp),mcss)

# ---------- P2 grant matches
ops=[('Rural Behavioral Health Access Program (synthetic)','Federal · HHS sample agency',88,'Nov 20','$150k–$400k',[('b-ok','✓ Nonprofit eligible'),('b-warn','! UEI needed')]),
('Family Reunification Therapy Fund (synthetic)','Utah foundation · manual entry',86,'Dec 1','$25k–$60k',[('b-ok','✓ Utah only'),('b-ok','✓ No match')]),
('Court-Involved Youth Services Grant (synthetic)','Federal · DOJ sample office',72,'Oct 30','$250k–$750k',[('b-warn','! 20% match'),('b-bad','✕ Audit required')]),
('Veterans Family Support Initiative (synthetic)','National foundation · CSV import',64,'Jan 15','$10k–$50k',[('b-ok','✓ Eligible'),('b-mute','? Geography unclear')]),
('Community Mental Health Mini-Grants (synthetic)','Utah county fund · manual',58,'Oct 24','$5k–$15k',[('b-warn','◷ 14 days left')])]
lst=''.join(f'<div style="display:grid;grid-template-columns:56px 1fr auto;gap:14px;padding:14px 18px;border-bottom:1px solid var(--border);{"background:var(--accent);border-left:3px solid var(--primary)" if i==0 else ""}"><div style="text-align:center"><div class="num" style="font-size:22px;font-weight:600">{s}</div><div class="muted" style="font-size:10px">FIT /100</div></div><div><b>{t}</b><div class="muted sm">{f} · closes {d} · {a}</div><div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">{"".join(f"<span class=\'badge {c}\'>{x}</span>" for c,x in fl)}</div></div><div><span class="badge b-mute">{["New","Reviewing","New","New","Passed"][i]}</span></div></div>' for i,(t,f,s,d,a,fl) in enumerate(ops))
comp=[('Mission fit',30,27,'Matched “court-involved families”, “therapy access”, “rural Utah” in Purpose §1.2'),('Eligibility certainty',20,15,'6 of 8 checks pass; UEI registration needed'),('Evidence readiness',15,14,'Have M1, O1, cost per episode; missing 12-month follow-up'),('Award size fit',15,12,'Ceiling $400k is 0.9× FAS annual budget'),('Geography',10,10,'Rural counties in Utah named explicitly'),('Effort vs. time',10,13-0,'41 days to deadline vs ~30 days typical prep')]
comp[5]=('Effort vs. time',10,13,'')
comp[5]=('Effort vs. time',10,10,'41 days to deadline vs ~30 days typical prep')
cp=''.join(f'<div style="padding:10px 0;border-top:1px solid var(--border)"><div style="display:flex;justify-content:space-between" class="sm"><b>{n}</b><span class="num"><b>{g}</b> / {w}</span></div><div class="bar" style="margin:6px 0"><i style="width:{g/w*100:.0f}%"></i></div><div class="muted" style="font-size:12px">{r} <a href="#" style="color:var(--primary)">[source]</a></div></div>' for n,w,g,r in comp)
gm=f'''<div class="pagehead"><div><h1>Grant matches</h1><p class="muted">23 open opportunities checked this week · 12 above the digest threshold (60)</p></div><div style="flex:1"></div><button class="btn outline">Add foundation opportunity</button></div>
<div style="display:flex;gap:8px;margin-bottom:16px"><span class="filter">Source <b>All</b> ⌄</span><span class="filter">Status <b>Open</b> ⌄</span><span class="filter">Closes <b>Next 90 days</b> ⌄</span><span class="filter">Sort <b>Fit score</b> ⌄</span></div>
<div class="grid" style="grid-template-columns:1fr 460px;align-items:start">
<section class="card">{lst}<div class="pad muted sm">Grants.gov refreshed Oct 10, 6:00 AM · API key used 0 days ago · foundation list updated Oct 3</div></section>
<aside class="card pad"><p class="xs muted">How we matched</p><h3 style="font-size:1.15rem;margin:4px 0">Rural Behavioral Health Access Program (synthetic)</h3>
<div style="display:flex;align-items:baseline;gap:8px;margin:10px 0 4px"><span class="num" style="font-size:2.4rem;font-weight:600">88</span><span class="muted">/ 100 fit · scoring v0 (weights v2026-10)</span></div>
{cp}
<div style="margin-top:14px"><p class="sm" style="font-weight:600;margin-bottom:6px">Eligibility checks</p><div style="display:grid;gap:5px" class="sm">
<div>✓ 501(c)(3) eligible</div><div>✓ Utah included</div><div>✓ 41 days to deadline</div><div style="color:var(--warning)">! SAM.gov UEI required · <a href="#" style="color:inherit;font-weight:600">add UEI in Org settings</a></div><div>✓ No audit required</div><div>✓ No cost share</div></div></div>
<div class="alert info" style="margin-top:14px"><b>i</b><div>Past winners: 14 awards in UT and peer states, median $210k (USAspending FY2021–25). Full winning applications are not public.</div></div>
<div style="display:flex;gap:8px;margin-top:16px"><button class="btn primary sm">Move to Pursuing</button><button class="btn outline sm">Request strategy draft</button><button class="btn ghost sm">Pass</button></div></aside></div>'''
page('p2-grant-matches','Grant matches',shell('staff','grants','Grants · <b>Matches</b>',STAFF,gm))

# mobile nav-open variant
import re as _re
h=open('p0-staff-home.html').read().replace('<body>','<body class="nav-open">',1).replace('aria-expanded="false"','aria-expanded="true"')
open('p0-staff-home-nav.html','w').write(h)
