// ── Game Controller ──

const Game = {

  goto(screen) {
    if (screen === 's-pick') {
      UI.renderPolGrid('all');
    }
    UI.show(screen);
  },

  gotoVP() {
    if (!State.player) { UI.showToast('Select a candidate first!'); return; }
    document.getElementById('vp-sub').textContent =
      `Pick a running mate for ${State.player.n} (${State.player.p === 'D' ? 'Democrat' : 'Republican'})`;
    UI.renderVPGrid();
    UI.show('s-vp');
  },

  startCampaign() {
    if (!State.vp) { UI.showToast('Pick a VP first!'); return; }
    // Pick opponent
    const oppPool = State.pols.filter(x => x.p !== State.player.p && x.id !== State.player.id);
    State.opponent = oppPool[Math.floor(Math.random() * oppPool.length)];
    const oppVPPool = State.pols.filter(x => x.id !== State.player.id && x.id !== State.vp.id && x.id !== State.opponent.id);
    State.oppVP = oppVPPool[Math.floor(Math.random() * oppVPPool.length)];

    // Build state data
    State.stateData = DATA.states.map(s => {
      let base = s.base + (State.player.p === 'D' ? 1 : -1);
      if (State.player.sb?.[s.abbr]) base += State.player.sb[s.abbr];
      if (State.vp.sb?.[s.abbr]) base += Math.round((State.vp.sb[s.abbr] || 0) * 0.4);
      return { ...s, playerFav: Math.max(22, Math.min(82, base)), visits: 0 };
    });

    State.speechesLeft = 8;
    State.campLog = [];
    State.campWeek = 1;

    document.getElementById('camp-sub2') && (document.getElementById('camp-sub2').textContent = '');
    document.getElementById('camp-ticket-badge').innerHTML =
      `<div class="ticket-badge">${State.player.n.split(' ').pop()} / ${State.vp.n.split(' ').pop()}</div>`;

    const avg = State.stateData.reduce((a, s) => a + s.playerFav, 0) / State.stateData.length;
    UI.renderStatBar('camp-stats', [
      { val: Math.round(avg) + '%', lbl: 'NAT. AVG' },
      { val: State.speechesLeft, lbl: 'SPEECHES' },
      { val: 'Wk 1', lbl: 'WEEK' },
      { val: State.vp.n.split(' ').pop(), lbl: 'VP PICK' },
    ]);

    UI.buildRegionTabs();
    UI.renderStateList('All');
    UI.buildStateSelect();

    UI.addTicker(
      `${State.player.n} announces ${State.vp.n} as running mate`,
      `${State.opponent.n} picks ${State.oppVP?.n || 'a running mate'}`,
      `Campaign season underway — ${State.speechesLeft} speeches remain`,
      `Polls: ${State.player.n} / ${State.vp.n} ticket at ${Math.round(avg)}% nationally`
    );

    UI.show('s-camp');
  },

  saveCustom() {
    const name = document.getElementById('c-name').value.trim();
    if (!name) { UI.showToast('Enter a name!'); return; }
    const party = document.getElementById('c-party').value;
    const desc = document.getElementById('c-desc').value.trim() || 'Custom Politician';
    const state = document.getElementById('c-state').value.trim().toUpperCase() || 'CA';
    const issues = document.getElementById('c-issues').value.split(',').map(x => x.trim()).filter(Boolean);
    const base = Math.max(30, Math.min(70, parseInt(document.getElementById('c-base').value) || 47));
    const rawInitials = document.getElementById('c-initials').value.trim().toUpperCase();
    const initials = rawInitials || name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'CP';
    const bio = document.getElementById('c-bio').value.trim();
    const id = 'custom_' + Date.now();
    const sb = {};
    sb[state] = 8;
    State.pols.push({
      id, n: name, p: party, i: initials, d: desc, base,
      bio: bio || `Custom politician from ${state}.`,
      issues: issues.length ? issues : ['economy', 'healthcare'],
      sb, custom: true
    });
    ['c-name','c-desc','c-state','c-issues','c-base','c-initials','c-bio'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
    UI.showToast(`${name} added to roster!`);
    UI.show('s-pick');
    UI.renderPolGrid('all');
  },

  startPres() {
    State.approval = 52;
    State.presYear = 0;
    State.presTerm = 1;
    State.senateD = State.player.p === 'D' ? 51 : 47;
    State.houseD = State.player.p === 'D' ? 220 : 213;
    State.activeWars = [];
    State.worldEvents = [];
    State.policyHistory = [];
    State.milHistory = [];
    State.newsHeadlines = [];
    State.totalActions = 0;
    State.gdp = 28000;
    State.debt = 36000;
    State.unemploymentRate = 4.1;
    State.inflationRate = 3.2;

    document.getElementById('tab-reelect').style.display = 'none';
    document.getElementById('pol-log').innerHTML = '';
    document.getElementById('exec-log').innerHTML = '';
    document.getElementById('mil-log').innerHTML = '';
    document.getElementById('econ-log').innerHTML = '';
    document.getElementById('dom-log').innerHTML = '';
    document.getElementById('world-events').innerHTML = '';
    document.getElementById('press-log').innerHTML = '';
    document.getElementById('active-wars').innerHTML = '';

    UI.buildMilTargets();
    WH.tab('policy');
    WH.updateStats();
    UI.renderCongressBars();

    UI.addTicker(
      `President ${State.player.n} inaugurated — the 47th President of the United States`,
      `VP ${State.vp.n} sworn in`,
      `${State.player.p === 'D' ? 'Democrats' : 'Republicans'} hold Senate ${State.senateD}-${100 - State.senateD}`,
      `${State.player.p === 'D' ? 'Democrats' : 'Republicans'} hold House ${State.houseD}-${435 - State.houseD}`
    );

    UI.show('s-wh');
  },

  pickVPReelect() {
    document.getElementById('vp-sub').textContent = `Choose your VP for the re-election campaign, President ${State.player.n}.`;
    UI.renderVPGrid();
    UI.show('s-vp');
    // Override the startCampaign button to go to re-election flow
    document.querySelector('#s-vp .btn-primary').onclick = () => Game.startReelection();
  },

  startReelection() {
    if (!State.vp) { UI.showToast('Pick a VP!'); return; }
    State.presTerm = 2;
    State.presYear = 0;

    // Rebuild state data weighted by approval
    const approvalBoost = (State.approval - 52) * 0.4;
    State.stateData = DATA.states.map(s => {
      let base = s.base + (State.player.p === 'D' ? 1 : -1) + approvalBoost;
      if (State.player.sb?.[s.abbr]) base += State.player.sb[s.abbr];
      if (State.vp.sb?.[s.abbr]) base += Math.round((State.vp.sb[s.abbr] || 0) * 0.4);
      return { ...s, playerFav: Math.max(22, Math.min(82, base)), visits: 0 };
    });

    State.speechesLeft = 6;
    State.campLog = [];
    State.campWeek = 1;

    document.getElementById('camp-ticket-badge').innerHTML =
      `<div class="ticket-badge">RE-ELECTION: ${State.player.n.split(' ').pop()} / ${State.vp.n.split(' ').pop()}</div>`;
    document.getElementById('tab-reelect').style.display = 'none';

    const avg = State.stateData.reduce((a, s) => a + s.playerFav, 0) / State.stateData.length;
    UI.renderStatBar('camp-stats', [
      { val: Math.round(avg) + '%', lbl: 'NAT. AVG' },
      { val: State.speechesLeft, lbl: 'SPEECHES' },
      { val: 'Wk 1', lbl: 'WEEK' },
      { val: State.vp.n.split(' ').pop(), lbl: 'VP PICK' },
    ]);

    UI.buildRegionTabs();
    UI.renderStateList('All');
    UI.buildStateSelect();

    UI.addTicker(
      `RE-ELECTION: President ${State.player.n} launches re-election campaign`,
      `Running again with VP ${State.vp.n}`,
      `Approval heading into election: ${Math.round(State.approval)}%`
    );

    // Reset button
    document.querySelector('#s-vp .btn-primary').onclick = () => Game.startCampaign();
    UI.show('s-camp');
  },

  resetGame() {
    State.pols = [...DATA.politicians];
    State.player = null;
    State.vp = null;
    UI.tickerItems = [];
    document.getElementById('ticker-wrap').classList.add('hidden');
    document.getElementById('ticker-inner').innerHTML = '';
    document.querySelectorAll('#s-vp .btn-primary').forEach(b => b.onclick = () => Game.startCampaign());
    UI.show('s-splash');
  }
};

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  // Generate splash stars
  const stars = document.getElementById('splash-stars');
  if (stars) {
    for (let i = 0; i < 80; i++) {
      const s = document.createElement('div');
      s.className = 'star';
      s.style.cssText = `left:${Math.random()*100}%;top:${Math.random()*100}%;--d:${2+Math.random()*4}s;--o:${0.2+Math.random()*0.6};animation-delay:${Math.random()*4}s`;
      stars.appendChild(s);
    }
  }

  // Wire up campaign deliver button
  document.querySelector('#s-camp .btn-primary[onclick="Campaign.doSpeech()"]') &&
    console.log('Campaign ready');
});
