// ── UI Helpers ──

const UI = {

  tickerItems: [],

  filterPols(filter, el) {
    document.querySelectorAll('.ptab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    this.renderPolGrid(filter);
  },

  renderPolGrid(filter = 'all') {
    const g = document.getElementById('pol-grid');
    g.innerHTML = '';
    const list = filter === 'all' ? State.pols : State.pols.filter(p => p.p === filter);
    list.forEach(p => this.appendPolCard(g, p, 'candidate'));
  },

  renderVPGrid() {
    const g = document.getElementById('vp-grid');
    g.innerHTML = '';
    State.pols.filter(p => p.id !== State.player?.id).forEach(p => {
      this.appendPolCard(g, p, 'vp');
    });
  },

  appendPolCard(grid, p, mode) {
    const d = document.createElement('div');
    d.className = 'pol-card';
    d.id = (mode === 'vp' ? 'vp-' : 'pc-') + p.id;
    const avCls = p.p === 'D' ? 'av-d' : p.p === 'R' ? 'av-r' : 'av-i';
    const partyCls = p.p === 'D' ? 'party-d' : p.p === 'R' ? 'party-r' : 'party-i';
    const partyLabel = p.p === 'D' ? 'Democrat' : p.p === 'R' ? 'Republican' : 'Independent';
    d.innerHTML = `
      ${p.custom ? '<div class="pol-custom-badge">CUSTOM</div>' : ''}
      <div class="pol-avatar ${avCls}">${p.i}</div>
      <div class="pol-name">${p.n}</div>
      <div class="pol-party ${partyCls}">${partyLabel}</div>
      <div class="pol-desc">${p.d}</div>`;
    d.onclick = () => {
      if (mode === 'vp') {
        document.querySelectorAll('.pol-card').forEach(c => c.classList.remove('sel-vp'));
        d.classList.add('sel-vp');
        State.vp = p;
      } else {
        document.querySelectorAll('.pol-card').forEach(c => c.classList.remove('sel-d', 'sel-r', 'sel-i'));
        const cls = p.p === 'D' ? 'sel-d' : p.p === 'R' ? 'sel-r' : 'sel-i';
        d.classList.add(cls);
        State.player = p;
      }
    };
    grid.appendChild(d);
  },

  renderStatBar(containerId, stats) {
    const el = document.getElementById(containerId);
    el.innerHTML = stats.map(s => `
      <div class="stat-box">
        <div class="stat-num" style="${s.color ? `color:${s.color}` : ''}">${s.val}</div>
        <div class="stat-lbl">${s.lbl}</div>
      </div>`).join('');
  },

  renderCongressBars() {
    const s = State;
    // Senate
    const senPct = (s.senateD / 100) * 100;
    document.getElementById('senate-bar').innerHTML = `
      <div class="congress-fill" style="width:${senPct}%">
        <span class="congress-fill-label">${s.senateD}D</span>
      </div>`;
    document.getElementById('senate-bar').title = `Senate: ${s.senateD} Dem / ${100 - s.senateD} Rep`;
    // House
    const houPct = (s.houseD / 435) * 100;
    document.getElementById('house-bar').innerHTML = `
      <div class="congress-fill" style="width:${houPct}%">
        <span class="congress-fill-label">${s.houseD}D</span>
      </div>`;
  },

  updateSelState() {
    const abbr = document.getElementById('state-sel').value;
    const s = State.stateData.find(x => x.abbr === abbr);
    if (!s) return;
    const lean = s.lean === 'swing' ? 'Tossup' : s.lean === 'D' ? 'Dem Lean' : 'Rep Lean';
    const leanColor = s.lean === 'D' ? '#93c5fd' : s.lean === 'R' ? '#fca5a5' : '#fcd34d';
    document.getElementById('state-meta').innerHTML =
      `Top issue: <strong>${s.issue}</strong> &nbsp;|&nbsp; <span style="color:${leanColor}">${lean}</span> &nbsp;|&nbsp; ${s.ev} electoral votes &nbsp;|&nbsp; Your favorability: <strong>${Math.round(s.playerFav)}%</strong>`;
  },

  renderStateList(region) {
    const states = region === 'All' ? State.stateData :
      State.stateData.filter(s => DATA.regions[region]?.includes(s.abbr));
    const list = document.getElementById('state-list');
    list.innerHTML = states.map(s => {
      const fav = Math.round(s.playerFav);
      const col = fav >= 52 ? '#3b82f6' : fav >= 48 ? '#f59e0b' : '#ef4444';
      const evCls = s.lean === 'D' ? 'ev-d' : s.lean === 'R' ? 'ev-r' : 'ev-s';
      return `<div class="state-row">
        <div class="state-abbr">${s.abbr}</div>
        <div class="state-ev ${evCls}">${s.ev}</div>
        <div class="state-issue">${s.issue}</div>
        <div class="state-pbar"><div class="pbar"><div class="pfill" style="width:${fav}%;background:${col}"></div></div></div>
        <div class="state-fav" style="color:${col}">${fav}%</div>
      </div>`;
    }).join('');
  },

  buildRegionTabs() {
    const t = document.getElementById('region-tabs');
    t.innerHTML = '';
    Object.keys(DATA.regions).forEach((r, i) => {
      const btn = document.createElement('button');
      btn.className = 'rtab' + (i === 0 ? ' active' : '');
      btn.textContent = r;
      btn.onclick = () => {
        document.querySelectorAll('.rtab').forEach(x => x.classList.remove('active'));
        btn.classList.add('active');
        UI.renderStateList(r);
      };
      t.appendChild(btn);
    });
  },

  buildStateSelect() {
    const sel = document.getElementById('state-sel');
    sel.innerHTML = State.stateData.map(s =>
      `<option value="${s.abbr}">${s.name} (${s.ev} EV) — ${s.issue}</option>`
    ).join('');
    this.updateSelState();
  },

  buildMilTargets() {
    const sel = document.getElementById('mil-target');
    sel.innerHTML = DATA.countries.map(c =>
      `<option value="${c.name}">${c.flag} ${c.name} — Rank #${c.rank}${c.nuclear ? ' ☢️' : ''} (Str: ${c.strength}/100)</option>`
    ).join('');
    WH.updateMilInfo();
    sel.onchange = () => WH.updateMilInfo();
  },

  addTicker(...items) {
    this.tickerItems.push(...items);
    this._renderTicker();
  },

  _renderTicker() {
    const wrap = document.getElementById('ticker-wrap');
    const inner = document.getElementById('ticker-inner');
    wrap.classList.remove('hidden');
    const doubled = [...this.tickerItems, ...this.tickerItems];
    inner.innerHTML = doubled.map(t => `<span class="ticker-item">◆ ${t}</span>`).join('');
  },

  showToast(msg, duration = 3000) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.add('hidden'), duration);
  },

  showModal(title, body, actions = []) {
    const overlay = document.getElementById('modal-overlay');
    const box = document.getElementById('modal-box');
    box.innerHTML = `
      <div class="modal-title">${title}</div>
      <div class="modal-body">${body}</div>
      <div class="modal-actions">${actions.map(a =>
        `<button class="${a.cls || 'btn-secondary'}" onclick="${a.fn}">${a.label}</button>`
      ).join('')}
      <button class="btn-secondary" onclick="UI.closeModal()">Close</button>
      </div>`;
    overlay.classList.remove('hidden');
  },

  closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
  },

  prependLogCard(containerId, { icon, title, badge, badgeCls, body, meta }) {
    const container = document.getElementById(containerId);
    const card = document.createElement('div');
    card.className = 'log-card';
    card.innerHTML = `
      <div class="log-card-header">
        <div class="log-card-title">${icon ? icon + ' ' : ''}${title}</div>
        ${badge ? `<span class="log-badge ${badgeCls || 'badge-neutral'}">${badge}</span>` : ''}
      </div>
      <div class="log-card-body">${body}</div>
      ${meta ? `<div class="log-card-meta">${meta}</div>` : ''}`;
    container.prepend(card);
  },

  show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    window.scrollTo(0, 0);
  },

  setLoading(id, on) {
    const el = document.getElementById(id);
    if (el) on ? el.classList.remove('hidden') : el.classList.add('hidden');
  },

  approvalColor(n) {
    if (n >= 60) return '#86efac';
    if (n >= 50) return '#fcd34d';
    if (n >= 40) return '#f97316';
    return '#fca5a5';
  }
};

// Global state
const State = {
  pols: [...DATA.politicians],
  player: null,
  vp: null,
  opponent: null,
  oppVP: null,
  stateData: [],
  speechesLeft: 8,
  campLog: [],
  campWeek: 1,
  approval: 52,
  presYear: 0,
  presTerm: 1,
  senateD: 51,
  houseD: 220,
  activeWars: [],
  worldEvents: [],
  policyHistory: [],
  milHistory: [],
  newsHeadlines: [],
  totalActions: 0,
  gdp: 28000,
  debt: 36000,
  unemploymentRate: 4.1,
  inflationRate: 3.2,
};

// Claude API call helper
async function claudeAPI(prompt, maxTokens = 800) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await resp.json();
  return data.content.map(c => c.text || '').join('');
}

async function claudeJSON(prompt, maxTokens = 800) {
  const text = await claudeAPI(prompt, maxTokens);
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}
