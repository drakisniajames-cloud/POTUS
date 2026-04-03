// ── Campaign Module ──

const Campaign = {

  async genSpeech() {
    const abbr = document.getElementById('state-sel').value;
    const s = State.stateData.find(x => x.abbr === abbr);
    UI.setLoading('sp-ld', true);
    document.getElementById('speech-in').value = '';
    const prompt = `Write a punchy 3-sentence campaign speech by ${State.player.n} (running with VP ${State.vp.n}) to voters in ${s.name}. Top voter issue: ${s.issue}. Match ${State.player.n}'s real political style. Be direct, passionate, and concise. Only output the speech itself.`;
    try {
      const text = await claudeAPI(prompt);
      document.getElementById('speech-in').value = text.trim();
    } catch (e) {
      document.getElementById('speech-in').value = 'Error generating speech. Write your own!';
    }
    UI.setLoading('sp-ld', false);
  },

  async doSpeech() {
    const speech = document.getElementById('speech-in').value.trim();
    if (!speech) { UI.showToast('Write or generate a speech first!'); return; }
    if (State.speechesLeft <= 0) { UI.showToast('No speeches left! Hold the election.'); return; }
    const abbr = document.getElementById('state-sel').value;
    const s = State.stateData.find(x => x.abbr === abbr);
    UI.setLoading('sp-ld', true);
    const prompt = `Political analyst. Rate this campaign speech by ${State.player.n} for ${s.name} voters whose top issue is "${s.issue}".
Speech: "${speech}"
JSON only, no extra text: {"score":<integer 1-10>,"reason":"<one sentence why>"}`;
    let score = 5, reason = 'Mixed reception from the crowd.';
    try {
      const res = await claudeJSON(prompt);
      score = res.score; reason = res.reason;
    } catch (e) {}
    const boost = (score - 5) * 2.2;
    s.playerFav = Math.max(20, Math.min(84, s.playerFav + boost));
    s.visits = (s.visits || 0) + 1;
    State.speechesLeft--;
    State.campWeek++;
    const icon = score >= 7 ? '📈' : score <= 4 ? '📉' : '➡️';
    const line = `${icon} ${s.name} (Score ${score}/10): ${reason} (${boost >= 0 ? '+' : ''}${boost.toFixed(1)}%)`;
    State.campLog.unshift(line);
    document.getElementById('speech-in').value = '';
    UI.setLoading('sp-ld', false);
    UI.addTicker(`${State.player.n} rallies in ${s.name} — ${score >= 7 ? 'crowd erupts' : score <= 4 ? 'hostile reception' : 'mixed reaction'}`);

    const avg = State.stateData.reduce((a, s) => a + s.playerFav, 0) / State.stateData.length;
    UI.renderStatBar('camp-stats', [
      { val: Math.round(avg) + '%', lbl: 'NAT. AVG' },
      { val: State.speechesLeft, lbl: 'SPEECHES' },
      { val: 'Wk ' + State.campWeek, lbl: 'WEEK' },
      { val: State.vp.n.split(' ').pop(), lbl: 'VP PICK' },
    ]);
    const region = document.querySelector('.rtab.active')?.textContent || 'All';
    UI.renderStateList(region);

    const log = document.getElementById('camp-log');
    log.classList.remove('hidden');
    log.innerHTML = State.campLog.map(l => `<p>${l}</p>`).join('');
  },

  gotoElection() {
    this._runElection();
    UI.show('s-elect');
  },

  _runElection() {
    let pEV = 0, oEV = 0;
    const map = document.getElementById('ec-map');
    map.innerHTML = '';
    const lg = document.getElementById('elect-log');
    lg.innerHTML = '';
    const pIsD = State.player.p === 'D';

    document.getElementById('d-nm').textContent = (pIsD ? State.player : State.opponent).n.split(' ').pop();
    document.getElementById('r-nm').textContent = (pIsD ? State.opponent : State.player).n.split(' ').pop();

    const swingNews = [];
    State.stateData.forEach(s => {
      const noise = (Math.random() - 0.5) * 8;
      const f = s.playerFav + noise;
      const pWins = f >= 50;
      if (pWins) pEV += s.ev; else oEV += s.ev;
      const cls = pWins ? (pIsD ? 'ec-d' : 'ec-r') : (pIsD ? 'ec-r' : 'ec-d');
      const box = document.createElement('div');
      box.className = 'ec-box ' + cls;
      box.title = `${s.name}: ${(pWins ? State.player : State.opponent).n} wins (${s.ev} EV)`;
      box.textContent = s.abbr;
      map.appendChild(box);
      const p2 = document.createElement('p');
      p2.innerHTML = `${pWins ? '✓' : '✗'} <strong>${s.name}</strong> (${s.ev} EV) — ${(pWins ? State.player : State.opponent).n.split(' ').pop()}`;
      p2.style.color = pWins ? '#93c5fd' : '#fca5a5';
      lg.appendChild(p2);
      if (s.lean === 'swing') swingNews.push(`${s.name} → ${(pWins ? State.player : State.opponent).n.split(' ').pop()}`);
    });

    const dEV = pIsD ? pEV : oEV;
    const rEV = pIsD ? oEV : pEV;
    document.getElementById('d-ev').textContent = dEV;
    document.getElementById('r-ev').textContent = rEV;
    UI.addTicker(...swingNews);

    const res = document.getElementById('elect-result');
    if (pEV >= 270) {
      res.innerHTML = `<div class="win-card">
        <h3>🎉 ${State.player.n}/${State.vp.n} Win!</h3>
        <p>${pEV} electoral votes — Victory!</p>
        <button class="btn-hero" onclick="Game.startPres()">Enter the Oval Office →</button>
      </div>`;
      UI.addTicker(`ELECTION CALLED: ${State.player.n} wins the presidency with ${pEV} electoral votes`, `${State.vp.n} elected Vice President of the United States`);
    } else {
      res.innerHTML = `<div class="lose-card">
        <h3>❌ Defeat. ${State.opponent.n} wins.</h3>
        <p>${oEV} to ${pEV} electoral votes. A crushing loss.</p>
        <button class="btn-primary" onclick="Game.resetGame()">Try Again →</button>
      </div>`;
      UI.addTicker(`ELECTION CALLED: ${State.opponent.n} defeats ${State.player.n}`, `${State.player.n} concedes — ${oEV} to ${pEV}`);
    }
  }
};
