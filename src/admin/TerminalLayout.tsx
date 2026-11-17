import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../supabase/AuthContext';

/**
 * ZEJESH Terminal admin shell.
 *
 * Dense, tabular, monochrome operational chrome modelled on the NULLA
 * terminal reference. It mounts around the existing 19 admin views without
 * redesigning them: each view is rendered inside a terminal panel and keeps
 * its own components, tokens and layout. The shell adds:
 *
 *  - command bar with entity / function / related menu
 *  - live market-style ticker + red command bar
 *  - context-aware sub-navigation (FA / orders / customers / ...)
 *  - news panel, message centre, settings overlay, toast
 *  - keyboard shortcuts: letters focus the command field, Enter runs a code,
 *    Escape closes overlays, < / > navigate history
 *
 * The shell holds no business data itself; views underneath read from Supabase
 * / BOS exactly as before.
 */

interface TerminalLayoutProps {
  children: React.ReactNode;
  title?: string;
  navItems?: Array<{ id: string; label: string }>;
  currentView?: string;
  onNavigate?: (view: string) => void;
  onBackToStorefront: () => void;
}

const FUNCTIONS = [
  ['MON', 'Monitor · command overview'],
  ['FA', 'Financial Analysis'],
  ['DES', 'Description'],
  ['RSK', 'Fulfilment Risk'],
  ['ORD', 'Order Blotter'],
  ['PRD', 'Product Analysis'],
  ['INV', 'Inventory'],
  ['CUS', 'Customers'],
  ['MKT', 'Marketing'],
  ['RTL', 'Retail Stores'],
  ['RET', 'Returns and Support'],
  ['PRO', 'Production'],
];

const NEWS = [
  ['NL', 'WOOL OVERCOAT M/L SOLD OUT AT ROTTERDAM DC, 41 OPEN CARTS AFFECTED'],
  ['BN', 'MONOLITH FW26 DROP 2 SELL-THROUGH 38% IN 72 HOURS, PLAN 29%'],
  ['NL', 'KARACHI ATELIER KNITWEAR LOTS 2 DAYS BEHIND, 1,840 UNITS AFFECTED'],
  ['DJ', 'CARRIER DHL EXPRESS REPORTS CUSTOMS DELAYS AT DUBAI HUB'],
  ['NL', 'APPLE PAY FAILURES UP 1.4PP ON UK AND UAE ISSUERS'],
  ['NL', 'RETURN RATE 13.8% 30D, DOWN 1.1PP; FIT ISSUES LEAD REASONS'],
  ['BN', 'BLACK FRIDAY EARLY ACCESS LIST REACHES 41,200 SIGNUPS'],
  ['DJ', 'EU PARCEL DUTY RULES FOR LOW-VALUE IMPORTS TO TAKE EFFECT'],
];

const CURRENCIES = ['USD', 'EUR', 'GBP'];

/* Deterministic xorshift PRNG — motion without Math.random. */
let tSeed = 0x2e3a5f91 | 0;
function tRand(): number {
  tSeed ^= tSeed << 13;
  tSeed ^= tSeed >>> 7;
  tSeed ^= tSeed << 5;
  return (tSeed >>> 0) / 4294967296;
}

export const TerminalLayout: React.FC<TerminalLayoutProps> = ({
  children,
  title = 'Operations',
  navItems,
  currentView,
  onNavigate,
  onBackToStorefront,
}) => {
  const { adminProfile, signOut } = useAuth();
  const [entity, setEntity] = useState('NULLA CO/THE Equity');
  const [fn, setFn] = useState('MON');
  const [history, setHistory] = useState<string[]>(['MON']);
  const [hi, setHi] = useState(0);
  const [periods, setPeriods] = useState(10);
  const [kind, setKind] = useState<'Annuals' | 'Quarterly' | 'Monthly'>('Annuals');
  const [cur, setCur] = useState<'USD' | 'EUR' | 'GBP'>('USD');
  const [tab, setTab] = useState(6);
  const [sub, setSub] = useState(11);
  const [pct, setPct] = useState(true);
  const [star, setStar] = useState(false);
  const [compact, setCompact] = useState(false);
  const [newsBig, setNewsBig] = useState(false);
  const [ovl, setOvl] = useState<{ t: string; html: React.ReactNode } | null>(null);
  const [pop, setPop] = useState<{ t: string; html: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuItems, setMenuItems] = useState<Array<[string, () => void]>>([]);
  const [toastMsg, setToastMsg] = useState('');
  const [ticker, setTicker] = useState({ px: 258.46, chg: -1.91, o: 258.115, h: 264.5, l: 256.35, ord: 1284, gmv: 4.272e6 });
  const lastActRef = useRef(Date.now());
  const toastTimer = useRef<number | null>(null);

  const operatorInitials = (adminProfile?.name || adminProfile?.email || 'ZJ')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p: string) => p[0]?.toUpperCase())
    .join('') || 'ZJ';

  const go = (code: string, push = true) => {
    const c = code.toUpperCase();
    if (!FUNCTIONS.some(([f]) => f === c)) {
      toast('Invalid function. Try MON, FA, DES, RSK, ORD, PRD, INV, CUS, MKT, RTL, RET, PRO');
      return;
    }
    if (push && c !== fn) {
      setHistory((h) => h.slice(0, hi + 1).concat(c));
      setHi((h) => h + 1);
    }
    setFn(c);
    setMenuOpen(false);
    setOvl(null);
    setPop(null);
  };

  const back = () => {
    const i = hi - 1;
    if (i < 0) return;
    setHi(i);
    setFn(history[i]);
  };

  const forward = () => {
    const i = hi + 1;
    if (i >= history.length) return;
    setHi(i);
    setFn(history[i]);
  };

  const openMenu = (el: HTMLElement, items: Array<[string, () => void]>) => {
    const r = el.getBoundingClientRect();
    setMenuItems(items);
    setMenuOpen(true);
    const m = document.getElementById('t-mn');
    if (m) {
      m.style.left = Math.max(4, Math.min(r.left, window.innerWidth - 250)) + 'px';
      m.style.top = r.bottom + 2 + 'px';
    }
  };

  const closeMenus = () => setMenuOpen(false);
  const closeOvl = () => setOvl(null);
  const closePop = () => setPop(null);

  const toastMsgRef = useRef('');
  const toast = (msg: string) => {
    setToastMsg(msg);
    toastMsgRef.current = msg;
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => {
      setToastMsg('');
    }, 2600);
  };

  const navClick = (code: string) => go(code);

  const bar1 = (
    <div className="t-bar1">
      <button className="t-nav" data-nav="-1" onClick={back} aria-label="Back">&lt;</button>
      <button className="t-nav" data-nav="1" onClick={forward} aria-label="Forward">&gt;</button>
      <div className="t-fld sec">
        <span>{entity}</span>
        <button data-m="ent" onClick={(e) => openMenu(e.currentTarget, CURRENCIES.map((c) => [c, () => { setCur(c as any); toast('Scope set to ' + c); }]))} aria-label="Entity">▾</button>
      </div>
      <div className="t-fld fn">
        <input id="t-fn" value={fn} maxLength={6} autoComplete="off" spellCheck={false} readOnly />
        <button data-m="fn" onClick={(e) => openMenu(e.currentTarget, FUNCTIONS.map(([f, l]) => [f + '  ' + l, () => go(f)]))} aria-label="Functions">▾</button>
      </div>
      <div className="fld rel hide-m" style={{ fontFamily: 'inherit' }}>
        <span>Related Functions Menu</span>
        <button data-m="rel" onClick={(e) => openMenu(e.currentTarget, FUNCTIONS.map((f, i) => [(i + 1) + ') ' + f[0] + '  ' + f[1], () => go(f[0])]))} aria-label="Related">≫</button>
      </div>
      <div className="t-sp" />
      <button className="t-hb" data-ov="msg" onClick={() => { setOvl({ t: 'Message center', html: msgHtml }); }} title="Message center">
        <svg viewBox="0 0 24 24"><path d="M3 6h18v12H3zM3 7l9 7 9-7"/></svg>
        Message
      </button>
      <button className="t-hb" data-star onClick={() => { setStar(!star); toast(star ? 'Removed from favorites' : 'Added to favorites'); }} title="Favorite">
        <svg viewBox="0 0 24 24"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>
      </button>
      <button className="t-hb" data-toast="New window opened in the workspace" onClick={() => toast('New window opened in the workspace')} title="New window">
        <svg viewBox="0 0 24 24"><path d="M4 5h16v10H4zM9 19h6M12 15v4"/></svg>
      </button>
      <button className="t-hb" data-ov="set" onClick={() => setOvl({ t: 'Settings', html: settingsHtml })} title="Settings">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>
      </button>
      <button className="t-qb" data-ov="help" onClick={() => setOvl({ t: 'Help', html: helpHtml })} title="Help">?</button>
    </div>
  );

  const tickHtml = () => (
    <>
      <i className="t-cur" />
      <span className="t-tk">NL OPS</span>
      <span className="t-dim">$</span>
      <span className={ticker.chg >= 0 ? 't-up' : 't-dn'}>{ticker.chg >= 0 ? '↑' : '↓'}</span>
      <span className={ticker.chg >= 0 ? 't-up' : 't-dn'}>{Math.abs(ticker.px).toFixed(2)}</span>
      <span className={ticker.chg >= 0 ? 't-up' : 't-dn'}>{ticker.chg >= 0 ? '+' + ticker.chg.toFixed(2) : ticker.chg.toFixed(2)}</span>
      <span className="hide-s">{spark(150, 28, tickerHist(), '#ececec')}</span>
      <span className="ba hide-s">N{tickerHist()[0].toFixed(2)} / {tickerHist()[tickerHist().length - 1].toFixed(2)}N</span>
      <span className="qs hide-s">20×223</span>
    </>
  );

  const tickerHist = () => {
    const h = [];
    for (let i = 0; i < 40; i++) h.push(258 + Math.sin(i / 5) * 3 + (Math.sin(i) * 3));
    return h;
  };

  const spark = (w: number, h: number, d: number[], c = '#ececec') => {
    const mn = Math.min(...d), mx = Math.max(...d), x = (i: number) => 1 + i * (w - 2) / Math.max(d.length - 1, 1), y = (v: number) => h - 2 - (v - mn) / ((mx - mn) || 1) * (h - 4);
    return `<svg width="${w}" height="${h}"><path d="${d.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join('')}" fill="none" stroke="${c}" stroke-width="1.2"/>`;
  };

  const tick2Html = () => (
    <>
      <span className="t-gl">◔</span>
      <span>At {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} d</span>
      <span>Ord <b>{ticker.ord}</b></span>
      <span className="hide-s">Sess <b>30703</b></span>
      <span>O <span className="t-l">{ticker.o}D</span></span>
      <span>H <span className="t-l">{ticker.h}K</span></span>
      <span>L <span className="t-l">{ticker.l}K</span></span>
      <span>Val <b>{(ticker.gmv / 1e6).toFixed(3)}M</b></span>
    </>
  );

  const bar2 = (
    <div className="t-bar2">
      <span className="t-id">NL OPS</span>
      <button data-b="Actions" onClick={() => openMenu(document.getElementById('t-bar2') as HTMLElement, [['Save layout', () => toast('Layout saved')], ['Share screen', () => toast('Link copied')], ['Set alert', () => toast('Alert created')], ['Print', () => toast('Sent to printer')]])}>Actions<i>▼</i></button>
      <button data-b="Export" onClick={() => openMenu(document.getElementById('t-bar2') as HTMLElement, [['Export to Excel', () => toast('Excel export queued')], ['Export to CSV', () => toast('CSV export queued')], ['Export to PDF', () => toast('PDF export queued')]])}>Export<i>▼</i></button>
      <span className="t-ttl">{title}</span>
    </div>
  );

  const newsHtml = () => NEWS.slice(0, newsBig ? 16 : 4).map((n, i) => (
    <div key={i}>
      <span className="t-s">{n[0]}</span>
      <span className="t-m">{new Date(Date.now() - i * 37e3 * 3).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      <span className="t-x">{n[1]}</span>
    </div>
  ));

  const settingsHtml = (
    <>
      <div className="t-rw"><span>Density</span><select data-set="cp" onChange={(e) => setCompact(e.target.value === '1')}>
        <option value="0">Normal</option>
        <option value="1">Compact</option>
      </select></div>
      <div className="t-rw"><span>Show percent columns</span><select data-set="pct" onChange={(e) => setPct(e.target.value === '1')}>
        <option value="1">On</option>
        <option value="0">Off</option>
      </select></div>
      <div className="t-rw"><span>Currency</span><select data-set="cur" value={cur} onChange={(e) => setCur(e.target.value as any)}>
        {CURRENCIES.map((c) => <option key={c} value={c} >{c}</option>)}
      </select></div>
    </>
  );

  const helpHtml = (
    <>
      <div className="t-rw"><span className="t-am">Type a code, press Enter</span><span className="t-dim">Command field, top left</span></div>
      {FUNCTIONS.map((f) => <div className="t-rw" key={f[0]}><span className="t-am">{f[0]}</span><span>{f[1]}</span></div>)}
      <div className="t-rw"><span className="t-am">Esc</span><span>Close menus and panels</span></div>
      <div className="t-rw"><span className="t-am">&lt; &gt;</span><span>Back and forward through screens</span></div>
    </>
  );

  const msgHtml = NEWS.map((m) => <div className="t-rw"><span>{m[1]}</span><span className="t-dim">new</span></div>);

  const periodOpts = kind === 'Annuals' ? [4, 6, 8, 10] : kind === 'Quarterly' ? [4, 8, 12, 20] : [6, 12, 18, 24];

  const sr = (
    <div className="t-sr">
      <span className="t-dim">39)</span>
      <b className="t-adj">ADJ</b>
      <span className="t-cy">Nulla Co/The</span>
      <span>ASC 842 <span className="t-qm">?</span></span>
      <span className="t-am">Periods</span>
      <select className="t-ob" id="t-pn" value={periods} onChange={(e) => setPeriods(Number(e.target.value))}>
        {periodOpts.map((v) => <option key={v} value={v} >{v}</option>)}
      </select>
      <select className="t-ob w" id="t-pk" value={kind} onChange={(e) => { setKind(e.target.value as any); setPeriods(kind === 'Annuals' ? 10 : 12); }}>
        {['Annuals', 'Quarterly', 'Monthly'].map((k) => <option key={k} value={k} >{k}</option>)}
      </select>
      <span className="t-am">Cur</span>
      <select className="t-ob" id="t-pc" value={cur} onChange={(e) => setCur(e.target.value as any)}>
        {CURRENCIES.map((k) => <option key={k} value={k} >FRC ({k})</option>)}
      </select>
    </div>
  );

  const tabs = FUNCTIONS.map((f, i) => <button key={f[0]} className={i + 1 === tab ? 'on' : ''} data-ftab={i + 1} onClick={() => { setTab(i + 1); setSub(i + 1 === 6 ? 11 : sub); }}>{f[0]}</button>);

  const subTabs = tab === 6 ? (
    <div className="t-sub">
      {['11) By Measure', '12) By Geography', '13) By Segment'].map((t, i) => <button key={i} className={11 + i === sub ? 'on' : ''} data-fsub={11 + i} onClick={() => setSub(11 + i)}>{t}</button>)}
    </div>
  ) : <div className="t-sub" style={{ height: 6 }} />;

  const body = (
    <div className="t-body">
      {children}
    </div>
  );

  const handleKey = useCallback((e: KeyboardEvent) => {
    const f = document.getElementById('t-fn');
    if (e.key === 'Escape') { closeMenus(); closeOvl(); closePop(); return; }
    if (e.target === f && e.key === 'Enter') { go((f as HTMLInputElement).value); return; }
    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1 && /[a-zA-Z]/.test(e.key) && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || '')) {
      f?.focus();
      (f as HTMLInputElement).select();
    }
  }, [fn]);

  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  useEffect(() => {
    const f = document.getElementById('t-fa');
    if (f) f.scrollLeft = f.scrollWidth;
  }, [fn, tab, sub]);

  useEffect(() => {
    const iv = setInterval(() => {
      const d = (tRand() - 0.47) * 0.9;
      setTicker((t) => {
        const px = t.px + d;
        const hist = tickerHist();
        hist.push(px);
        hist.shift();
        return {
          px,
          chg: t.chg + d,
          o: Math.max(t.o, px),
          h: Math.max(t.h, px),
          l: Math.min(t.l, px),
          ord: t.ord + (tRand() < 0.6 ? Math.floor(1 + tRand() * 3) : 0),
          gmv: t.gmv + (tRand() < 0.6 ? Math.floor(80 + tRand() * 820) : 0),
        };
      });
    }, 1800);
    return () => clearInterval(iv);
  }, []);

  const news = (
    <div className={`t-news ${newsBig ? 't-big' : ''}`} id="t-news">
      <div className="t-hd">
        <button data-toast="Panel editor opens in the next release">300) Edit Panel</button>
        <button data-bigtoggle onClick={() => setNewsBig(!newsBig)}>{newsBig ? '301) Collapse' : '301) Expand'} Panel</button>
      </div>
      <div id="t-nl">{newsHtml()}</div>
    </div>
  );

  const menu = menuOpen ? (
    <div id="t-mn" className="t-mn on">
      {menuItems.map(([label, cb], i) => <button key={i} data-mi={i} onClick={(ev) => { ev.stopPropagation(); cb(); }}>{label}</button>)}
    </div>
  ) : null;

  const ovlBox = ovl ? (
    <div className="t-ovl on">
      <h3><span>{ovl.t}</span><button data-closeov onClick={closeOvl}>✕</button></h3>
      <div className="t-in">{ovl.html}</div>
    </div>
  ) : null;

  const popBox = pop ? (
    <div className="t-pop on">
      <h3><span>{pop.t}</span><button data-closepop onClick={closePop}>✕</button></h3>
      <div className="t-pb t-fx">{pop.html}</div>
    </div>
  ) : null;

  return (
    <>
    <div className="t-terminal">
      {bar1}
      <div className="t-tick1">{tickHtml()}</div>
      <div className="t-tick2">{tick2Html()}</div>
      {bar2}
      <div className="t-main">
        {sr}
        <div className="t-tabs">{tabs}</div>
        {subTabs}
        <div className="t-grid">
          {navItems ? (
            <>
              <aside className="t-nav">
                <div className="t-top">
                  <span className="t-dim" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.16em' }}>Menu</span>
                </div>
                <div className="t-ng">
                  <small>Views</small>
                  {navItems.map((item) => {
                    const active = currentView === item.id;
                    return (
                      <button key={item.id} className={`t-nav-item ${active ? 'on' : ''}`} onClick={() => onNavigate?.(item.id)}>
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </aside>
              {body}
            </>
          ) : body}
        </div>
      </div>
      {news}
    </div>
    {menu}
    {ovlBox}
    {popBox}
    <div className="t-tip" id="t-tip" />
    <div className="t-toast" id="t-toast">{toastMsg}</div>
    </>
  );
};

export default TerminalLayout;
