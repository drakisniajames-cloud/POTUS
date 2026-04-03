// ── White House Module ──

const WH = {

  tab(name) {
    ['policy','executive','military','economy','domestic','world','press','reelect'].forEach(t => {
      const el = document.getElementById('wh-' + t);
      if (el) el.classList.toggle('hidden', t !== name);
    });
    document.querySelectorAll('.wh-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.wh-tab[onclick="WH.tab('${name}')"]`)?.classList.add('active');
  },

  updateStats() {
    const s = State;
    s.approval = Math.max(12, Math.min(96, s.approval));
    document.getElementById('wh-appr').textContent = Math.round(s.approval) + '%';
    document.getElementById('wh-appr').style.color = UI.approvalColor(s.approval);
    document.getElementById('wh-title').textContent = `The Oval Office — ${s.player.n}`;
    document.getElementById('wh-sub').textContent = `Term ${s.presTerm} · Year ${Math.ceil(s.presYear + 0.01)} · VP ${s.vp.n} · ${s.totalActions} actions taken`;
    UI.renderStatBar('wh-stats', [
      { val: Math.round(s.approval) + '%', lbl: 'APPROVAL', color: UI.approvalColor(s.approval) },
      { val: 'T' + s.presTerm + ' Y' + Math.ceil(s.presYear + 0.01), lbl: 'TERM/YEAR' },
      { val: s.totalActions, lbl: 'ACTIONS' },
      { val: '$' + s.gdp + 'T', lbl: 'GDP' },
    ]);
    UI.renderCongressBars();
    this._checkReelect();
  },

  _checkReelect() {
    if (State.presYear >= 3.5 && State.presTerm < 2) {
      document.getElementById('tab-reelect').style.display = 'block';
      this._renderReelectSummary();
    }
    if (State.presYear >= 3.5 && State.presTerm >= 2) {
      this.endPresidency(false);
    }
  },

  _advanceTime(amount = 0.25) {
    State.presYear = Math.min(4, State.presYear + amount);
    State.totalActions++;
    this.updateStats();
  },

  _renderReelectSummary() {
    const passed = State.policyHistory.filter(p => p.passes).length;
    const wars = State.milHistory.filter(m => m.type === 'war').length;
    document.getElementById('reelect-summary').innerHTML = `
      <div class="reelect-card">
        <div class="legacy-title">Your Term ${State.presTerm} Record</div>
        <div class="legacy-stat">Approval rating: <strong style="color:${UI.approvalColor(State.approval)}">${Math.round(State.approval)}%</strong></div>
        <div class="legacy-stat">Bills passed: <strong>${passed} / ${State.policyHistory.length}</strong></div>
        <div class="legacy-stat">Military conflicts: <strong>${wars}</strong></div>
        <div class="legacy-stat">Total presidential actions: <strong>${State.totalActions}</strong></div>
        <div class="legacy-stat" style="margin-top:10px;color:${State.approval >= 50 ? '#86efac' : '#fca5a5'}">
          ${State.approval >= 55 ? '✅ Strong position for re-election.' : State.approval >= 47 ? '⚠️ Competitive re-election battle ahead.' : '❌ Uphill battle — approval rating is low.'}
        </div>
      </div>`;
  },

  // ── POLICY ──
  async genPolicy() {
    UI.setLoading('pol-ld', true);
    const prompt = `Suggest one realistic presidential policy ${State.player.n} (${State.player.p === 'D' ? 'Democrat' : 'Republican'}) would champion, based on their real political views: ${State.player.issues.join(', ')}. Format: "Policy Name: One sentence description." Nothing else.`;
    try {
      document.getElementById('pol-in').value = (await claudeAPI(prompt)).trim();
    } catch (e) {}
    UI.setLoading('pol-ld', false);
  },

  async doPolicy() {
    const pol = document.getElementById('pol-in').value.trim();
    if (!pol) { UI.showToast('Enter a policy first!'); return; }
    UI.setLoading('pol-ld', true);
    const prompt = `Congressional analyst. President ${State.player.n} (${State.player.p === 'D' ? 'Democrat' : 'Republican'}) proposes: "${pol}"
Senate: ${State.senateD}D/${100 - State.senateD}R. House: ${State.houseD}D/${435 - State.houseD}R.
VP ${State.vp.n} (${State.vp.p}) breaks Senate ties.
JSON only: {"senateYes":<int>,"houseYes":<int>,"passes":<bool>,"analysis":"<2 realistic sentences on outcome>","approvalShift":<integer -8 to 8>}`;
    try {
      const r = await claudeJSON(prompt);
      State.approval += r.approvalShift || 0;
      State.policyHistory.push({ pol, passes: r.passes, shift: r.approvalShift });
      this._advanceTime(0.5);
      document.getElementById('pol-in').value = '';
      UI.addTicker(r.passes ? `CONGRESS PASSES: ${pol.split(':')[0]}` : `CONGRESS BLOCKS: ${pol.split(':')[0]}`);
      UI.prependLogCard('pol-log', {
        icon: r.passes ? '✅' : '❌',
        title: pol.split(':')[0],
        badge: r.passes ? 'PASSED' : 'FAILED',
        badgeCls: r.passes ? 'badge-pass' : 'badge-fail',
        body: r.analysis,
        meta: `Senate ${r.senateYes}/100 · House ${r.houseYes}/435 · Approval ${r.approvalShift >= 0 ? '+' : ''}${r.approvalShift}%`
      });
    } catch (e) { UI.showToast('Error sending bill to Congress.'); }
    UI.setLoading('pol-ld', false);
  },

  // ── EXECUTIVE ACTIONS ──
  async execAction(type) {
    const labels = {
      executive_order: 'Executive Order',
      pardon: 'Presidential Pardon',
      veto: 'Presidential Veto',
      state_of_union: 'State of the Union Address',
      national_emergency: 'National Emergency Declaration',
      appoint_justice: 'Supreme Court Appointment',
      cabinet_reshuffle: 'Cabinet Reshuffle',
      press_conference: 'Press Conference'
    };
    const prompts = {
      executive_order: `President ${State.player.n} is issuing an executive order. Generate a realistic executive order name and outcome consistent with a ${State.player.p === 'D' ? 'Democratic' : 'Republican'} president's agenda (issues: ${State.player.issues.join(', ')}). JSON: {"title":"<EO title>","description":"<2 sentences on what it does>","approvalShift":<-6 to 6>,"constitutionalRisk":"<low|medium|high>","analysis":"<1 sentence on political reaction>"}`,
      pardon: `President ${State.player.n} is issuing a presidential pardon. Generate a realistic pardon scenario. JSON: {"person":"<name and why famous>","crime":"<what they did>","justification":"<president's reason>","approvalShift":<-8 to 5>,"analysis":"<1 sentence on reaction>"}`,
      veto: `President ${State.player.n} vetoes a bill passed by Congress. Generate a realistic scenario where the ${State.player.p === 'D' ? 'Republican' : 'Democratic'} opposition forced through a bill the president opposes. JSON: {"billName":"<bill title>","reason":"<why vetoed>","overrideAttempt":<bool>,"succeeded":<bool>,"approvalShift":<-5 to 5>,"analysis":"<1 sentence>"}`,
      state_of_union: `President ${State.player.n} delivers the State of the Union address. Approval is ${Math.round(State.approval)}%. JSON: {"theme":"<speech theme>","highlights":["<point 1>","<point 2>","<point 3>"],"reception":"<excellent|good|mixed|poor>","approvalShift":<-4 to 8>,"memorableQuote":"<one memorable line>"}`,
      national_emergency: `President ${State.player.n} declares a national emergency. Generate a realistic crisis scenario. JSON: {"crisis":"<what the emergency is>","powersInvoked":"<what powers activated>","approvalShift":<-8 to 8>,"constitutionalDebate":"<yes|no>","analysis":"<2 sentences on political fallout>"}`,
      appoint_justice: `President ${State.player.n} nominates a Supreme Court justice. Senate is ${State.senateD}D/${100 - State.senateD}R. Generate a realistic nominee. JSON: {"nominee":"<full name>","background":"<1 sentence>","ideology":"<conservative|moderate|liberal>","confirmationVote":<int senate yes>,"confirmed":<bool>,"approvalShift":<-6 to 8>,"analysis":"<1 sentence>"}`,
      cabinet_reshuffle: `President ${State.player.n} reshuffles the cabinet after approval drops to ${Math.round(State.approval)}%. JSON: {"fired":"<who and why>","appointed":"<who replaces them>","reason":"<political reason>","approvalShift":<-3 to 5>,"analysis":"<1 sentence on media reaction>"}`,
      press_conference: `President ${State.player.n} holds a White House press conference. Approval is ${Math.round(State.approval)}%. Wars active: ${State.activeWars.length}. JSON: {"toughQuestion":"<hardest question asked>","response":"<president's answer>","gaffe":<bool>,"approvalShift":<-5 to 4>,"headline":"<resulting news headline>"}`
    };
    UI.setLoading('exec-ld', true);
    try {
      const r = await claudeJSON(prompts[type]);
      State.approval += r.approvalShift || 0;
      this._advanceTime(0.3);
      const label = labels[type];
      let body = '', meta = `Approval ${r.approvalShift >= 0 ? '+' : ''}${r.approvalShift}%`;

      if (type === 'executive_order') { body = `<strong>${r.title}</strong><br>${r.description} ${r.analysis}`; meta += ` · Constitutional risk: ${r.constitutionalRisk}`; }
      else if (type === 'pardon') { body = `Pardoned <strong>${r.person}</strong> for ${r.crime}. Justification: ${r.justification}<br>${r.analysis}`; }
      else if (type === 'veto') { body = `Vetoed <strong>${r.billName}</strong>. ${r.reason}<br>${r.analysis}${r.overrideAttempt ? ` Override attempt ${r.succeeded ? 'succeeded — veto overridden!' : 'failed.'}` : ''}`; }
      else if (type === 'state_of_union') { body = `Theme: <strong>${r.theme}</strong><br>Highlights: ${r.highlights?.join('; ')}<br>Reception: ${r.reception}<br><em>"${r.memorableQuote}"</em>`; }
      else if (type === 'national_emergency') { body = `Emergency: <strong>${r.crisis}</strong><br>Powers invoked: ${r.powersInvoked}<br>${r.analysis}${r.constitutionalDebate === 'yes' ? '<br>⚠️ Constitutional challenge filed.' : ''}`; }
      else if (type === 'appoint_justice') { body = `Nominee: <strong>${r.nominee}</strong> — ${r.background}<br>Ideology: ${r.ideology} · Senate vote: ${r.confirmationVote}/100 → ${r.confirmed ? '✅ Confirmed' : '❌ Rejected'}<br>${r.analysis}`; }
      else if (type === 'cabinet_reshuffle') { body = `Fired: ${r.fired}<br>New appointment: ${r.appointed}<br>${r.reason}<br>${r.analysis}`; }
      else if (type === 'press_conference') { body = `Tough Q: <em>"${r.toughQuestion}"</em><br>Response: ${r.response}${r.gaffe ? '<br>⚠️ A gaffe went viral immediately.' : ''}<br>Headline: <strong>${r.headline}</strong>`; }

      UI.addTicker(label + ': ' + (r.title || r.person || r.billName || r.theme || r.crisis || r.nominee || r.fired || r.headline || ''));
      UI.prependLogCard('exec-log', { icon: '📜', title: label, badge: r.approvalShift >= 0 ? '+' + r.approvalShift + '%' : r.approvalShift + '%', badgeCls: r.approvalShift >= 0 ? 'badge-info' : 'badge-warn', body, meta });
    } catch (e) { UI.showToast('Executive action failed.'); }
    UI.setLoading('exec-ld', false);
  },

  // ── MILITARY ──
  updateMilInfo() {
    const name = document.getElementById('mil-target').value;
    const c = DATA.countries.find(x => x.name === name);
    if (!c) return;
    const diff = 100 - c.strength;
    const outlook = diff > 65 ? 'Swift US victory likely' : diff > 40 ? 'Prolonged conflict expected' : diff > 15 ? 'High-casualty war — difficult' : '🚨 EXTREME RISK — near-peer adversary';
    document.getElementById('mil-info').innerHTML =
      `${c.nuclear ? '<strong style="color:#fca5a5">☢️ NUCLEAR STATE — Escalation could be catastrophic.</strong><br>' : ''}${c.desc}<br><strong>Allies:</strong> ${c.allies.join(', ') || 'None'} · <strong>GDP:</strong> $${c.gdp}B · <strong>Population:</strong> ${c.pop}M<br><strong>US Advantage:</strong> ${diff} pts · <strong>Outlook:</strong> ${outlook}`;
    document.getElementById('mil-strength').innerHTML = `
      <div class="str-bar-wrap"><div class="str-label">USA (Rank #1 · Str 100)</div><div class="pbar" style="height:10px"><div class="str-bar str-us" style="width:100%"></div></div></div>
      <div class="str-bar-wrap"><div class="str-label">${c.flag} ${c.name} (Rank #${c.rank} · Str ${c.strength})</div><div class="pbar" style="height:10px"><div class="str-bar str-enemy" style="width:${c.strength}%"></div></div></div>`;
  },

  async declareWar() {
    const name = document.getElementById('mil-target').value;
    const reason = document.getElementById('mil-reason').value.trim();
    if (!reason) { UI.showToast('State your military objective!'); return; }
    const c = DATA.countries.find(x => x.name === name);
    UI.setLoading('mil-ld', true);
    const prompt = `Pentagon war analyst. President ${State.player.n} declares war on ${c.name} (military strength ${c.strength}/100 globally, rank #${c.rank}, allies: ${c.allies.join(', ') || 'none'}).
${c.nuclear ? 'THIS IS A NUCLEAR STATE — factor nuclear escalation risk heavily.' : ''}
Objective: "${reason}"
US advantage: ${100 - c.strength} points. Model realistic outcomes based on actual military doctrine.
JSON: {"operationName":"<military operation name>","phase":"<opening phase name>","outcome":"<won|ongoing|stalemated|catastrophic|nuclear_standoff>","usCasualties":<int>,"enemyCasualties":<int>,"daysElapsed":<int>,"narrative":"<3 realistic sentences describing the conflict>","approvalShift":<integer -18 to 5>,"costBillions":<int>,"internationalReaction":"<1 sentence on world response>","nextPhase":"<what happens next>"}`;
    try {
      const w = await claudeJSON(prompt, 1000);
      State.approval += w.approvalShift || 0;
      const war = { country: name, flag: c.flag, op: w.operationName, phase: w.phase, outcome: w.outcome, casualties: w.usCasualties, cost: w.costBillions, nextPhase: w.nextPhase, strength: c.strength, nuclear: c.nuclear };
      State.activeWars.push(war);
      State.milHistory.push({ type: 'war', target: name, outcome: w.outcome, shift: w.approvalShift });
      this._advanceTime(0.4);
      this._renderActiveWars();
      UI.addTicker(`US DECLARES WAR — Operation ${w.operationName} begins against ${name}`, `${w.usCasualties.toLocaleString()} US casualties in opening phase`, `War cost estimate: $${w.costBillions}B`);
      UI.prependLogCard('mil-log', {
        icon: '⚔️', title: `War on ${name} — Op. ${w.operationName}`,
        badge: w.outcome.toUpperCase(), badgeCls: w.outcome === 'won' ? 'badge-pass' : w.outcome === 'catastrophic' || w.outcome === 'nuclear_standoff' ? 'badge-war' : 'badge-warn',
        body: `${w.narrative}<br><em>${w.internationalReaction}</em>`,
        meta: `US casualties: ${w.usCasualties.toLocaleString()} · Enemy: ${w.enemyCasualties?.toLocaleString() || '?'} · ${w.daysElapsed} days · $${w.costBillions}B · Approval ${w.approvalShift >= 0 ? '+' : ''}${w.approvalShift}% · Next: ${w.nextPhase}`
      });
      document.getElementById('mil-reason').value = '';
    } catch (e) { UI.showToast('Pentagon communications failure.'); }
    UI.setLoading('mil-ld', false);
  },

  async doAirstrike() {
    const name = document.getElementById('mil-target').value;
    const reason = document.getElementById('mil-reason').value || 'targeted airstrike';
    const c = DATA.countries.find(x => x.name === name);
    UI.setLoading('mil-ld', true);
    const prompt = `President ${State.player.n} orders a targeted airstrike on ${name} (strength ${c.strength}/100). Target: "${reason}". JSON: {"target":"<specific target struck>","success":<bool>,"usCasualties":<int 0-50>,"civilianCasualties":<int>,"approvalShift":<-10 to 4>,"internationalReaction":"<1 sentence>","analysis":"<2 sentences>"}`;
    try {
      const r = await claudeJSON(prompt);
      State.approval += r.approvalShift || 0;
      State.milHistory.push({ type: 'airstrike', target: name, shift: r.approvalShift });
      this._advanceTime(0.2);
      UI.addTicker(`US AIRSTRIKE on ${name} — ${r.success ? 'target destroyed' : 'mission incomplete'}`);
      UI.prependLogCard('mil-log', { icon: '💣', title: `Airstrike: ${name} — ${r.target}`, badge: r.success ? 'SUCCESS' : 'INCOMPLETE', badgeCls: r.success ? 'badge-pass' : 'badge-warn', body: `${r.analysis} ${r.internationalReaction}`, meta: `US casualties: ${r.usCasualties} · Civilian: ${r.civilianCasualties} · Approval ${r.approvalShift >= 0 ? '+' : ''}${r.approvalShift}%` });
      document.getElementById('mil-reason').value = '';
    } catch (e) {}
    UI.setLoading('mil-ld', false);
  },

  async doCovertOps() {
    const name = document.getElementById('mil-target').value;
    UI.setLoading('mil-ld', true);
    const prompt = `CIA covert operation authorized by President ${State.player.n} against ${name}. JSON: {"operation":"<covert op name>","type":"<assassination|sabotage|regime_change|intelligence>","result":"<success|partial|blown>","exposure":<bool>,"approvalShift":<-8 to 5>,"analysis":"<2 sentences>"}`;
    try {
      const r = await claudeJSON(prompt);
      State.approval += r.approvalShift || 0;
      this._advanceTime(0.2);
      UI.addTicker(`CIA operation in ${name}: ${r.result === 'success' ? 'SUCCESS' : r.result === 'blown' ? 'BLOWN — international incident' : 'partial results'}`);
      UI.prependLogCard('mil-log', { icon: '🕵️', title: `Covert Op: ${r.operation}`, badge: r.result.toUpperCase(), badgeCls: r.result === 'success' ? 'badge-pass' : r.result === 'blown' ? 'badge-war' : 'badge-warn', body: r.analysis + (r.exposure ? ' The operation has been exposed.' : ''), meta: `Approval ${r.approvalShift >= 0 ? '+' : ''}${r.approvalShift}%` });
    } catch (e) {}
    UI.setLoading('mil-ld', false);
  },

  async doSanctions() {
    const name = document.getElementById('mil-target').value;
    UI.setLoading('mil-ld', true);
    const prompt = `President ${State.player.n} imposes economic sanctions on ${name}. JSON: {"type":"<comprehensive|targeted|sectoral>","target":"<what sector/who targeted>","effect":"<2 sentences>","approvalShift":<-5 to 5>,"economicImpact":"<brief>","retaliation":"<1 sentence on their response>"}`;
    try {
      const r = await claudeJSON(prompt);
      State.approval += r.approvalShift || 0;
      this._advanceTime(0.2);
      UI.addTicker(`US sanctions on ${name}: ${r.type} package targeting ${r.target}`);
      UI.prependLogCard('mil-log', { icon: '🚫', title: `${r.type} Sanctions: ${name}`, badge: 'SANCTIONS', badgeCls: 'badge-warn', body: `${r.effect} ${r.retaliation}`, meta: `Impact: ${r.economicImpact} · Approval ${r.approvalShift >= 0 ? '+' : ''}${r.approvalShift}%` });
    } catch (e) {}
    UI.setLoading('mil-ld', false);
  },

  async doNegotiate() {
    const name = document.getElementById('mil-target').value;
    UI.setLoading('mil-ld', true);
    const prompt = `President ${State.player.n} sends diplomats to ${name}. JSON: {"leadDiplomat":"<name and role>","agenda":"<1 sentence>","result":"<breakthrough|progress|stalled|rejected>","deal":"<if breakthrough, what was agreed>","approvalShift":<-3 to 7>,"analysis":"<1 sentence>"}`;
    try {
      const r = await claudeJSON(prompt);
      State.approval += r.approvalShift || 0;
      this._advanceTime(0.2);
      UI.addTicker(`US diplomacy with ${name}: ${r.result}${r.deal ? ' — ' + r.deal : ''}`);
      UI.prependLogCard('mil-log', { icon: '🕊️', title: `Diplomacy: ${name}`, badge: r.result.toUpperCase(), badgeCls: r.result === 'breakthrough' ? 'badge-pass' : r.result === 'rejected' ? 'badge-fail' : 'badge-info', body: `${r.agenda}${r.deal ? '<br>Deal: ' + r.deal : ''}<br>${r.analysis}`, meta: `Lead: ${r.leadDiplomat} · Approval ${r.approvalShift >= 0 ? '+' : ''}${r.approvalShift}%` });
    } catch (e) {}
    UI.setLoading('mil-ld', false);
  },

  async doAidAllies() {
    const name = document.getElementById('mil-target').value;
    UI.setLoading('mil-ld', true);
    const prompt = `President ${State.player.n} sends military aid to ${name}. JSON: {"aidType":"<weapons|financial|troops|intelligence>","amount":"<scale of aid>","justification":"<1 sentence>","congressResponse":"<supported|blocked|debated>","approvalShift":<-5 to 6>,"analysis":"<2 sentences on outcome>"}`;
    try {
      const r = await claudeJSON(prompt);
      State.approval += r.approvalShift || 0;
      this._advanceTime(0.2);
      UI.addTicker(`US sends ${r.aidType} to ${name}`);
      UI.prependLogCard('mil-log', { icon: '🤝', title: `Military Aid: ${name}`, badge: r.congressResponse.toUpperCase(), badgeCls: r.congressResponse === 'supported' ? 'badge-pass' : 'badge-warn', body: `${r.justification}<br>${r.analysis}`, meta: `Aid: ${r.aidType} (${r.amount}) · Approval ${r.approvalShift >= 0 ? '+' : ''}${r.approvalShift}%` });
    } catch (e) {}
    UI.setLoading('mil-ld', false);
  },

  _renderActiveWars() {
    const el = document.getElementById('active-wars');
    if (!State.activeWars.length) { el.innerHTML = ''; return; }
    el.innerHTML = `<div class="active-wars-title">ACTIVE CONFLICTS (${State.activeWars.length})</div>` +
      State.activeWars.map(w => `<div class="war-chip">
        <div class="war-flag">${w.flag}</div>
        <div class="war-info">
          <div class="war-name">${w.country} — ${w.op}</div>
          <div class="war-status">${w.outcome.toUpperCase()} · ${w.nextPhase}${w.nuclear ? ' · ☢️ NUCLEAR' : ''}</div>
        </div>
      </div>`).join('');
  },

  // ── ECONOMY ──
  async econAction(type) {
    const labels = { tax_cut:'Tax Cut', tax_hike:'Tax Hike', stimulus:'Stimulus Package', tariffs:'Tariffs', infrastructure:'Infrastructure Bill', fed_pressure:'Fed Pressure', trade_deal:'Trade Deal', nationalize:'Nationalization' };
    UI.setLoading('econ-ld', true);
    const prompt = `President ${State.player.n} takes economic action: ${labels[type]}. Current: GDP $${State.gdp}T, unemployment ${State.unemploymentRate}%, inflation ${State.inflationRate}%. JSON: {"action":"<specific action taken>","immediate":"<2 sentences on immediate effects>","longTerm":"<1 sentence on long-term>","gdpChange":<float -0.5 to 0.8>,"unemploymentChange":<float -0.5 to 0.5>,"inflationChange":<float -0.5 to 0.8>,"approvalShift":<-7 to 8>,"analysis":"<1 sentence on political reaction>"}`;
    try {
      const r = await claudeJSON(prompt);
      State.approval += r.approvalShift || 0;
      State.gdp = Math.max(20000, Math.round((State.gdp + (r.gdpChange || 0) * 1000)));
      State.unemploymentRate = Math.max(2, Math.min(15, +(State.unemploymentRate + (r.unemploymentChange || 0)).toFixed(1)));
      State.inflationRate = Math.max(0.5, Math.min(20, +(State.inflationRate + (r.inflationChange || 0)).toFixed(1)));
      this._advanceTime(0.4);
      UI.addTicker(`${labels[type]}: ${r.action}`);
      UI.prependLogCard('econ-log', { icon: '💰', title: labels[type] + ': ' + r.action, badge: r.approvalShift >= 0 ? '+' + r.approvalShift + '%' : r.approvalShift + '%', badgeCls: r.approvalShift >= 0 ? 'badge-pass' : 'badge-fail', body: r.immediate + ' ' + r.longTerm + '<br>' + r.analysis, meta: `GDP: $${State.gdp}T · Unemployment: ${State.unemploymentRate}% · Inflation: ${State.inflationRate}%` });
    } catch (e) {}
    UI.setLoading('econ-ld', false);
  },

  // ── DOMESTIC ──
  async domesticAction(type) {
    const labels = { immigration:'Immigration Policy', gun_law:'Gun Legislation', climate:'Climate Action', healthcare:'Healthcare Reform', education:'Education Policy', drugs:'Drug Policy', disaster:'Disaster Response', police_reform:'Police Reform', abortion:'Abortion Policy', social_security:'Social Security', space:'Space Program', censorship:'Tech Regulation' };
    UI.setLoading('dom-ld', true);
    const prompt = `President ${State.player.n} (${State.player.p === 'D' ? 'Democrat' : 'Republican'}) takes action on: ${labels[type]}. Their known views: ${State.player.issues.join(', ')}.
JSON: {"action":"<specific policy action>","mechanism":"<executive order|legislation|regulation>","supports":"<who supports this>","opposes":"<who opposes this>","approvalShift":<-9 to 9>,"stateImpact":"<1 sentence on which states are affected>","analysis":"<2 sentences on political and social fallout>","headline":"<news headline>"}`;
    try {
      const r = await claudeJSON(prompt);
      State.approval += r.approvalShift || 0;
      this._advanceTime(0.35);
      UI.addTicker(r.headline);
      UI.prependLogCard('dom-log', { icon: '🏠', title: labels[type] + ': ' + r.action, badge: r.approvalShift >= 0 ? '+' + r.approvalShift + '%' : r.approvalShift + '%', badgeCls: r.approvalShift >= 0 ? 'badge-info' : 'badge-warn', body: `${r.analysis}<br>Supports: ${r.supports} · Opposes: ${r.opposes}`, meta: `Via ${r.mechanism} · ${r.stateImpact}` });
    } catch (e) {}
    UI.setLoading('dom-ld', false);
  },

  // ── WORLD EVENTS ──
  async genWorldEvent() {
    UI.setLoading('world-ld', true);
    const types = DATA.worldEventTypes;
    const type = types[Math.floor(Math.random() * types.length)];
    const prompt = `Generate a realistic world crisis for a US president to handle: "${type}". Make it geopolitically plausible for 2025-2026.
JSON: {"headline":"<urgent headline>","country":"<country or region>","description":"<2 sentences>","severity":"<low|medium|high|critical>","background":"<1 sentence of context>","options":[{"label":"<action 1>","cost":"<low|medium|high|extreme>","approvalShift":<int>,"outcome":"<2 sentences on what happens>"},{"label":"<action 2>","cost":"<low|medium|high|extreme>","approvalShift":<int>,"outcome":"<2 sentences>"},{"label":"<action 3>","cost":"<low|medium|high|extreme>","approvalShift":<int>,"outcome":"<2 sentences>"},{"label":"Stay out of it","cost":"low","approvalShift":<int>,"outcome":"<2 sentences>"}]}`;
    try {
      const ev = await claudeJSON(prompt, 1200);
      ev.id = Date.now();
      State.worldEvents.unshift(ev);
      State.totalActions++;
      this._renderWorldEvents();
      UI.addTicker(`BREAKING: ${ev.headline}`, `Situation in ${ev.country} — presidential response needed`);
    } catch (e) { UI.showToast('Unable to generate event.'); }
    UI.setLoading('world-ld', false);
  },

  _renderWorldEvents() {
    const el = document.getElementById('world-events');
    el.innerHTML = State.worldEvents.map(ev => {
      const sevCls = `sev-${ev.severity}`;
      return `<div class="event-card" id="ev-${ev.id}">
        <div class="event-headline">🌍 ${ev.headline} <span class="event-sev ${sevCls}">${ev.severity?.toUpperCase()}</span></div>
        <div class="event-country">${ev.country}</div>
        <div class="event-desc">${ev.description} ${ev.background || ''}</div>
        <div class="event-options" id="opts-${ev.id}">
          ${ev.options.map((o, i) => `<button class="event-opt" onclick="WH.chooseEvent(${ev.id},${i})">${o.label} <span style="font-size:9px;opacity:0.6">[${o.cost} cost]</span></button>`).join('')}
        </div>
        <div class="event-result hidden" id="evr-${ev.id}"></div>
      </div>`;
    }).join('');
  },

  chooseEvent(id, optIdx) {
    const ev = State.worldEvents.find(x => x.id === id);
    if (!ev) return;
    const opt = ev.options[optIdx];
    State.approval += opt.approvalShift || 0;
    this._advanceTime(0.25);
    document.getElementById(`opts-${id}`).innerHTML = `<span class="log-badge badge-neutral">${opt.label} — chosen</span>`;
    const r = document.getElementById(`evr-${id}`);
    r.classList.remove('hidden');
    r.innerHTML = `<strong>${opt.label}</strong><br>${opt.outcome}<br><small>Approval ${opt.approvalShift >= 0 ? '+' : ''}${opt.approvalShift}%</small>`;
    UI.addTicker(`${State.player.n} on ${ev.headline}: "${opt.label}"`);
  },

  // ── PRESS ──
  async genNewsStory() {
    UI.setLoading('press-ld', true);
    const passed = State.policyHistory.filter(p => p.passes).length;
    const prompt = `Write a realistic AP-style news story about President ${State.player.n}'s presidency. Context: approval ${Math.round(State.approval)}%, bills passed ${passed}/${State.policyHistory.length}, wars: ${State.activeWars.length}, term ${State.presTerm}, year ${Math.ceil(State.presYear + 0.01)}, VP ${State.vp.n}, GDP $${State.gdp}T.
Write as a genuine AP news report: headline, byline (AP), dateline, and 4-5 sentences of news copy. Make it feel real.`;
    try {
      const text = (await claudeAPI(prompt)).trim();
      const lines = text.split('\n').filter(Boolean);
      const headline = lines[0].replace(/^#+\s*/, '').replace(/\*\*/g, '');
      const body = lines.slice(1).join(' ');
      State.newsHeadlines.push(headline);
      const card = document.createElement('div');
      card.className = 'press-card';
      card.innerHTML = `<div class="press-headline">${headline}</div><div class="press-byline">Associated Press · The White House</div><div class="press-body">${body}</div>`;
      document.getElementById('press-log').prepend(card);
      UI.addTicker(headline.replace(/\*/g, '').trim());
    } catch (e) {}
    UI.setLoading('press-ld', false);
  },

  async genOpEd() {
    UI.setLoading('press-ld', true);
    const isSupporter = Math.random() > 0.5;
    const prompt = `Write a New York Times op-ed ${isSupporter ? 'defending' : 'criticizing'} President ${State.player.n}'s presidency. Approval: ${Math.round(State.approval)}%. Policies: ${State.policyHistory.slice(0, 3).map(p => p.pol).join(', ')}. 
Write as a genuine NYT op-ed: headline, author name and credential, and 4-5 paragraph excerpts. Make it feel like real political journalism.`;
    try {
      const text = (await claudeAPI(prompt)).trim();
      const lines = text.split('\n').filter(Boolean);
      const headline = lines[0].replace(/^#+\s*/, '').replace(/\*\*/g, '');
      const body = lines.slice(1).join(' ');
      const card = document.createElement('div');
      card.className = 'press-card';
      card.style.borderLeft = `3px solid ${isSupporter ? '#3b82f6' : '#ef4444'}`;
      card.innerHTML = `<div class="press-headline">${headline}</div><div class="press-byline">Opinion · The New York Times</div><div class="press-body">${body}</div>`;
      document.getElementById('press-log').prepend(card);
    } catch (e) {}
    UI.setLoading('press-ld', false);
  },

  async genPoll() {
    UI.setLoading('press-ld', true);
    const prompt = `Generate a realistic Gallup/CNN polling report on President ${State.player.n}'s presidency. Approval: ${Math.round(State.approval)}%, term ${State.presTerm}, active wars: ${State.activeWars.length}. Include: approval breakdown by party, key issues polling, re-election matchup numbers. Format as a realistic poll summary with specific percentages. 3-4 sentences.`;
    try {
      const text = (await claudeAPI(prompt)).trim();
      const card = document.createElement('div');
      card.className = 'press-card';
      card.innerHTML = `<div class="press-headline">📊 New Poll: ${State.player.n} at ${Math.round(State.approval)}% Approval</div><div class="press-byline">Gallup / CNN · National Survey</div><div class="press-body">${text}</div>`;
      document.getElementById('press-log').prepend(card);
    } catch (e) {}
    UI.setLoading('press-ld', false);
  },

  endPresidency(retired = false) {
    const passed = State.policyHistory.filter(p => p.passes).length;
    const wars = State.milHistory.filter(m => m.type === 'war').length;
    const appr = Math.round(State.approval);
    const legacy = appr >= 70 ? 'One of the greatest presidents in modern American history' :
      appr >= 58 ? 'A respected leader remembered for steady governance' :
      appr >= 46 ? 'A mixed legacy — accomplishments overshadowed by controversy' :
      appr >= 36 ? 'A troubled presidency that deeply divided the nation' :
      'A failed presidency — among the least popular in American history';
    const rating = appr >= 70 ? '⭐⭐⭐⭐⭐' : appr >= 58 ? '⭐⭐⭐⭐' : appr >= 46 ? '⭐⭐⭐' : appr >= 36 ? '⭐⭐' : '⭐';

    document.getElementById('over-title').textContent = retired ? 'A Dignified Retirement' : 'End of Your Presidency';
    document.getElementById('over-sub').textContent = `President ${State.player.n} · VP ${State.vp.n} · ${State.presTerm} term${State.presTerm > 1 ? 's' : ''} served`;
    document.getElementById('over-legacy').innerHTML = `
      <div class="legacy-title">Presidential Legacy ${rating}</div>
      <div class="legacy-stat">Final approval rating: <strong style="color:${UI.approvalColor(appr)}">${appr}%</strong></div>
      <div class="legacy-stat">Bills signed into law: <strong>${passed} / ${State.policyHistory.length}</strong></div>
      <div class="legacy-stat">Military conflicts: <strong>${wars}</strong></div>
      <div class="legacy-stat">Total presidential actions: <strong>${State.totalActions}</strong></div>
      <div class="legacy-stat">GDP at end of term: <strong>$${State.gdp}T</strong></div>
      <div class="legacy-quote">"${legacy}"</div>`;
    document.getElementById('over-headlines').innerHTML = State.newsHeadlines.slice(0, 4).map(h =>
      `<div class="over-headline-item">📰 ${h.replace(/\*/g, '').trim()}</div>`
    ).join('');
    UI.show('s-over');
  }
};
