// ===============================================
// 超级马力卡丁车 v2.0
// 双组赛制 · 手机端 · LocalStorage 持久化
// ===============================================

function freshState() {
  return {
    tab: 'setup',           // setup | groupA | groupB | final
    setupStep: 'carPool',   // carPool | reg | grouping
    subA: 'qualify',        // qualify | race1 | race2 | scores
    subB: 'qualify',
    carPool: [],
    drivers: [],            // [{id,name}]
    groupA: [], groupB: [],
    carAssignA: {}, carAssignB: {},
    // qualifying: {id: 'mm:ss.xxx'} + ordered results
    aQualTimes: {}, aQualOrder: [],   // order: [id,...] fastest→slowest
    bQualTimes: {}, bQualOrder: [],
    // race results: [id,...] 1st→last finishing order
    aRace1: [], aRace2: [],
    bRace1: [], bRace2: [],
    // final
    finalistCountA: 5, finalistCountB: 4,
    finalOrder: [],   // decided order for final start
    finalResults: [], // actual finishing order
    raceDate: dateStr(),
    onboardingDone: false  // 是否已跳过引导页
  };
}

let S = freshState();

function dateStr() {
  return new Date().toLocaleDateString('zh-CN', {year:'numeric',month:'2-digit',day:'2-digit'});
}

// ── Persist ──
function load() {
  try { const d = localStorage.getItem('kart_v2'); if (d) S = JSON.parse(d); } catch(e) {}
}
function save() { localStorage.setItem('kart_v2', JSON.stringify(S)); }

// ── Helpers ──
function uid() { return 'p'+Date.now()+Math.random().toString(36).slice(2,5); }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function getD(id) { return S.drivers.find(d => d.id === id); }
function grpIds(g) { return g === 'A' ? S.groupA : S.groupB; }
function carAssign(g) { return g === 'A' ? S.carAssignA : S.carAssignB; }
function qualOrder(g) { return g === 'A' ? S.aQualOrder : S.bQualOrder; }
function qualTimes(g) { return g === 'A' ? S.aQualTimes : S.bQualTimes; }
function race1(g) { return g === 'A' ? S.aRace1 : S.bRace1; }
function race2(g) { return g === 'A' ? S.aRace2 : S.bRace2; }

// ── Scoring ──
function pts(pos, n) { return Math.max(n - pos + 1, 1); }

function grpScores(g) {
  const ids = grpIds(g), r1 = race1(g), r2 = race2(g), n = ids.length;
  const s = {};
  ids.forEach(id => s[id] = 0);
  r1.forEach((id,i) => { if (id in s) s[id] += pts(i+1,n); });
  r2.forEach((id,i) => { if (id in s) s[id] += pts(i+1,n); });
  return s;
}

// Race2 car swap: driver at pos i in Race1 gets car of driver at pos (n-1-i) 
function race2Cars(g) {
  const r1 = race1(g), ca = carAssign(g), n = r1.length;
  if (!n) return {};
  const m = {};
  r1.forEach((id, i) => { m[id] = ca[r1[n-1-i]]; });
  return m;
}

// Race2 starting order = reverse of Race1 finishing order
function race2StartOrder(g) { return [...race1(g)].reverse(); }

// ── Navigation ──
function goTab(tab) { S.tab = tab; save(); render(); }
function goSetup(step) { S.setupStep = step; save(); render(); }
function goSub(g, sub) { if (g==='A') S.subA=sub; else S.subB=sub; save(); render(); }

// ── Random group & cars ──
function doGroup() {
  const shuffled = [...S.drivers].sort(() => Math.random()-0.5);
  const half = Math.ceil(shuffled.length / 2);
  S.groupA = shuffled.slice(0, half).map(d => d.id);
  S.groupB = shuffled.slice(half).map(d => d.id);
  S.carAssignA = assignCars(S.groupA);
  S.carAssignB = assignCars(S.groupB);
  S.aQualTimes={}; S.aQualOrder=[];
  S.bQualTimes={}; S.bQualOrder=[];
  S.aRace1=[]; S.aRace2=[];
  S.bRace1=[]; S.bRace2=[];
  S.finalOrder=[]; S.finalResults=[];
}

function assignCars(ids) {
  const cars = [...S.carPool].sort(() => Math.random()-0.5);
  const m = {};
  ids.forEach((id,i) => { m[id] = cars[i % cars.length]; });
  return m;
}

// ── Render ──
function render() {
  document.getElementById('app').innerHTML = buildApp();
  bindEvents();
}

function buildApp() {
  const pages = {
    setup:  buildSetupPage(),
    groupA: buildGroupPage('A'),
    groupB: buildGroupPage('B'),
    final:  buildFinalPage()
  };
  const content = pages[S.tab] || pages.setup;
  return `
    ${buildHeader()}
    <div class="main fade-in">${content}</div>
    ${buildBottomNav()}
  `;
}

// ── Header ──
function buildHeader() {
  const titles = { setup:'赛事准备', groupA:'A 组赛程', groupB:'B 组赛程', final:'决赛' };
  return `
    <div class="header">
      <div class="header-row">
        <div class="logo">
          <span class="logo-icon">🏎️</span>
          <div>
            <div class="logo-text">SUPER MARIO KART</div>
            <div class="logo-sub">${titles[S.tab]||''}</div>
          </div>
        </div>
        <button class="btn btn-ghost" onclick="newRace()">＋ 新赛事</button>
      </div>
    </div>`;
}

// ── Bottom Nav ──
function buildBottomNav() {
  const items = [
    {tab:'setup',  icon:'⚙️', label:'准备'},
    {tab:'groupA', icon:'🏁', label:'A组'},
    {tab:'groupB', icon:'🏁', label:'B组'},
    {tab:'final',  icon:'🏆', label:'决赛'},
  ];
  return `
    <nav class="bottom-nav">
      ${items.map(x => `
        <button class="nav-btn ${S.tab===x.tab?'active':''}" onclick="goTab('${x.tab}')">
          <span class="ni">${x.icon}</span>${x.label}
        </button>`).join('')}
    </nav>`;
}

// ── SETUP PAGE ──
function buildSetupPage() {
  // 首次进入 · 无任何数据且未跳过引导时展示引导页
  if (S.carPool.length === 0 && S.drivers.length === 0 && !S.onboardingDone) {
    return buildOnboarding();
  }

  const steps = [
    {key:'carPool',  label:'车号池'},
    {key:'reg',      label:'报名'},
    {key:'grouping', label:'分组'},
  ];
  const stepBar = `
    <div class="setup-steps">
      ${steps.map(s => `
        <div class="setup-step ${S.setupStep===s.key?'active':''}" onclick="goSetup('${s.key}')">${s.label}</div>`
      ).join('')}
    </div>`;

  let content = '';
  if (S.setupStep === 'carPool')  content = buildCarPool();
  if (S.setupStep === 'reg')      content = buildRegistration();
  if (S.setupStep === 'grouping') content = buildGrouping();
  return stepBar + `<div class="main fade-in">${content}</div>`;
}

// 引导欢迎页
function buildOnboarding() {
  const steps = [
    {icon:'🚗', title:'建立车号池', desc:'录入本场可用车辆编号'},
    {icon:'📝', title:'车手报名',   desc:'填写姓名，系统随机分组抽车'},
    {icon:'🎲', title:'随机分组',   desc:'自动均分 A/B 组 + 随机抽车'},
    {icon:'⏱', title:'排位赛',     desc:'最快圈决定预赛发车顺序（不计分）'},
    {icon:'🏁', title:'预赛 × 2轮', desc:'A组/B组各跑两轮，首尾换车保公平'},
    {icon:'🏆', title:'决赛',       desc:'各组取 3-5 人，共 6-10 人冲刺决赛'},
  ];
  return `
    <div style="padding:16px 4px 0">
      <div style="text-align:center;padding:20px 0 16px">
        <div style="font-size:52px;margin-bottom:10px">🏎️</div>
        <div style="font-family:'Rajdhani',sans-serif;font-weight:700;font-size:22px;color:var(--gold);letter-spacing:1px">KART CLUB MANAGER</div>
        <div style="font-size:13px;color:var(--text2);margin-top:4px">卡丁车俱乐部 · 赛事计分系统</div>
      </div>

      <div class="card" style="margin-bottom:12px">
        <div class="card-title" style="font-size:14px;margin-bottom:12px">📋 比赛流程</div>
        ${steps.map((s,i) => `
          <div style="display:flex;align-items:flex-start;gap:12px;padding:9px 0;${i<steps.length-1?'border-bottom:1px solid var(--border)':''}">
            <div style="width:32px;height:32px;border-radius:50%;background:var(--bg3);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">${s.icon}</div>
            <div>
              <div style="font-size:14px;font-weight:600">${s.title}</div>
              <div style="font-size:12px;color:var(--text2);margin-top:2px">${s.desc}</div>
            </div>
          </div>`).join('')}
      </div>

      <div class="info-box teal" style="margin-bottom:12px">
        💡 <strong>建议先用演示数据体验一遍</strong>，了解完整流程后再正式开赛
      </div>

      <button class="btn btn-primary btn-full" onclick="loadDemoData()" style="margin-bottom:10px;font-size:16px;padding:16px">
        🎮 加载演示数据，立刻体验
      </button>
      <button class="btn btn-secondary btn-full" onclick="skipOnboarding()" style="font-size:14px">
        ✏️ 手动录入，开始新赛事
      </button>
    </div>`;
}


// Car Pool
function buildCarPool() {
  const chips = S.carPool.map(c => `
    <div class="car-chip">
      <span>${esc(c)}</span>
      <button class="chip-del" onclick="rmCar('${esc(c)}')">✕</button>
    </div>`).join('');
  return `
    <div class="card">
      <div class="card-title">🚗 车号池</div>
      <div class="info-box">录入本场所有可用车辆编号</div>
      <div class="form-row">
        <input class="input sm" id="inCar" placeholder="车号" maxlength="4" type="text">
        <button class="btn btn-primary" onclick="addCar()">添加</button>
      </div>
      <div class="pool-chips">${chips || '<span style="color:var(--text3);font-size:13px">暂未添加</span>'}</div>
      <div style="margin-top:10px;font-size:13px;color:var(--text2)">
        共 <span style="color:var(--gold);font-weight:700">${S.carPool.length}</span> 辆车
      </div>
    </div>
    ${S.carPool.length >= 2
      ? `<button class="btn btn-primary btn-full" onclick="goSetup('reg')">✓ 车号池完成，前往报名 →</button>`
      : `<div class="info-box">至少需要 2 辆车</div>`}`;
}

// Registration
function buildRegistration() {
  const list = S.drivers.map(d => `
    <div class="p-item">
      <div class="driver-av">${esc(d.name.slice(0,1))}</div>
      <div class="p-name">${esc(d.name)}</div>
      <button class="p-rm" onclick="rmDriver('${d.id}')">✕</button>
    </div>`).join('') || `<div class="empty-state"><div class="empty-icon">👤</div>暂无车手</div>`;
  return `
    <div class="card">
      <div class="card-title">📝 车手报名</div>
      <div class="info-box">只填姓名，车号在分组后随机抽取</div>
      <div class="form-row">
        <input class="input" id="inName" placeholder="车手姓名" type="text" autocomplete="off">
        <button class="btn btn-primary" onclick="addDriver()">添加</button>
      </div>
      <div class="count-badge">已报名 <span class="count-num">${S.drivers.length}</span> 人</div>
      ${list}
    </div>
    ${S.drivers.length >= 2
      ? `<button class="btn btn-primary btn-full" onclick="goSetup('grouping')">✓ 报名结束，前往分组 →</button>`
      : `<div class="info-box">至少需要 2 名车手</div>`}`;
}

// Grouping
function buildGrouping() {
  const hasGroups = S.groupA.length > 0;
  const grpCard = (g, ids, ca) => `
    <div class="grp-card ${g.toLowerCase()}">
      <div class="grp-hdr">
        <div class="grp-tag ${g==='B'?'b':''}">${g}组</div>
        <span style="font-size:12px;color:var(--text2)">${ids.length}人</span>
      </div>
      ${ids.map(id => {
        const d = getD(id);
        return `<div class="grp-item"><div class="cn sm">${esc(ca[id])}</div><span style="font-size:13px">${esc(d?.name)}</span></div>`;
      }).join('')}
    </div>`;
  return `
    <div class="card">
      <div class="card-title">🎲 随机分组 & 抽车</div>
      <div class="info-box">随机均分车手到A/B两组，并随机分配车号</div>
      ${hasGroups ? `<div class="two-col">${grpCard('A',S.groupA,S.carAssignA)}${grpCard('B',S.groupB,S.carAssignB)}</div>` : ''}
    </div>
    <button class="btn btn-secondary btn-full" onclick="reGroup()" style="margin-bottom:10px">🔀 重新随机分组</button>
    ${hasGroups
      ? `<button class="btn btn-primary btn-full" onclick="goTab('groupA')">✓ 确认分组，开始比赛 →</button>`
      : `<button class="btn btn-primary btn-full" onclick="reGroup()">🎲 开始随机分组</button>`}`;
}

// ── GROUP PAGE (A or B) ──
function buildGroupPage(g) {
  const sub = g === 'A' ? S.subA : S.subB;
  const r1Done = race1(g).length === grpIds(g).length && race1(g).length > 0;
  const r2Done = race2(g).length === grpIds(g).length && race2(g).length > 0;

  const subTabs = `
    <div class="sub-tabs">
      ${[['qualify','排位'],['race1','预赛1'],['race2','预赛2'],['scores','积分']].map(([k,label]) => {
        let cls = sub===k ? 'active' : '';
        if ((k==='race1'&&r1Done)||(k==='race2'&&r2Done)||(k==='qualify'&&qualOrder(g).length>0)) cls += ' done';
        return `<div class="sub-tab ${cls}" onclick="goSub('${g}','${k}')">${label}</div>`;
      }).join('')}
    </div>`;

  let body = '';
  if (sub === 'qualify') body = buildQualify(g);
  if (sub === 'race1')   body = buildRaceEntry(g, 1);
  if (sub === 'race2')   body = buildRace2(g);
  if (sub === 'scores')  body = buildScores(g);

  return subTabs + `<div class="main fade-in">${body}</div>`;
}

// Qualify
function buildQualify(g) {
  const ids = grpIds(g), ca = carAssign(g), qt = qualTimes(g), qo = qualOrder(g);
  const n = ids.length;
  if (!n) return `<div class="info-box red">请先完成分组</div>`;

  const unassigned = ids.filter(id => !qo.includes(id));

  const slots = Array.from({length:n}, (_,i) => {
    const id = qo[i];
    const d = id ? getD(id) : null;
    const c = id ? ca[id] : null;
    const posClass = i===0?'gold':i===1?'silver':i===2?'bronze':'';
    return `
      <div class="rank-slot ${d?'filled':''}">
        <div class="rn ${posClass}">${i+1}</div>
        ${d ? `
          <div class="cn sm">${esc(c)}</div>
          <div class="rank-name">${esc(d.name)}</div>
          <div style="font-size:12px;color:var(--text3)">${qt[id]||''}</div>
          <button class="rank-rm" onclick="unsetQ('${g}',${i})">✕</button>
        ` : `<div class="rank-placeholder">点击车手录入排名…</div>`}
      </div>`;
  }).join('');

  const chips = unassigned.map(id => {
    const d = getD(id);
    return `
      <button class="driver-chip" onclick="setQ('${g}','${id}')">
        <div class="cn xs">${esc(ca[id])}</div>${esc(d?.name)}
      </button>`;
  }).join('');

  // Optional time entry for already placed drivers
  const timeEntry = qo.length > 0 ? `
    <div style="margin-top:10px">
      <div class="section-label">可选：输入最快圈时间（自动排序）</div>
      ${qo.map(id => {
        const d = getD(id);
        return `
          <div class="qual-item">
            <div class="cn xs">${esc(ca[id])}</div>
            <div style="flex:1;font-size:14px">${esc(d?.name)}</div>
            <input class="qual-time-input" type="text" placeholder="1:23.456"
              value="${esc(qt[id]||'')}"
              onchange="setQTime('${g}','${id}',this.value)"
              onblur="autoSortByTime('${g}')">
          </div>`;
      }).join('')}
    </div>` : '';

  return `
    <div class="card">
      <div class="card-title">⏱ ${g}组 排位赛</div>
      <div class="info-box">按最快圈时间排名（不计分）。点击车手按排位顺序录入，或填写圈时自动排序。</div>
      <div class="section-label">排名顺序（1=最快）</div>
      <div class="rank-slots">${slots}</div>
      ${unassigned.length>0?`<div class="section-label">点击录入</div><div class="driver-chips">${chips}</div>`:''}
      ${timeEntry}
      ${qo.length>0?`<button class="btn btn-secondary btn-full" onclick="clearQ('${g}')" style="margin-top:4px">🔄 重新录入</button>`:''}
      ${qo.length===n?`<button class="btn btn-success btn-full" onclick="goSub('${g}','race1')" style="margin-top:8px">✓ 排位完成 → 前往预赛1</button>`:''}
    </div>`;
}

// Race 1 entry
function buildRaceEntry(g, round) {
  const ids = grpIds(g), n = ids.length;
  const ca = round===1 ? carAssign(g) : race2Cars(g);
  const results = round===1 ? race1(g) : race2(g);
  const startOrder = round===1 ? qualOrder(g) : race2StartOrder(g);
  const setFn = round===1 ? `setR1` : `setR2`;
  const unsetFn = round===1 ? `unsetR1` : `unsetR2`;
  const clearFn = round===1 ? `clearR1` : `clearR2`;

  if (!n) return `<div class="info-box red">请先完成分组</div>`;

  const startInfo = startOrder.length === n ? `
    <div class="info-box teal">
      发车顺序：${startOrder.map((id,i) => `${i+1}.${getD(id)?.name||id}`).join(' → ')}
    </div>` : '';

  const unassigned = ids.filter(id => !results.includes(id));
  const slots = Array.from({length:n}, (_,i) => {
    const id = results[i];
    const d = id ? getD(id) : null;
    const c = id ? ca[id] : null;
    const posClass = i===0?'gold':i===1?'silver':i===2?'bronze':'';
    return `
      <div class="rank-slot ${d?'filled':''}">
        <div class="rn ${posClass}">${i+1}</div>
        ${d ? `
          <div class="cn sm">${esc(c)}</div>
          <div class="rank-name">${esc(d.name)}</div>
          <div class="rank-pts">+${pts(i+1,n)}</div>
          <button class="rank-rm" onclick="${unsetFn}('${g}',${i})">✕</button>
        ` : `<div class="rank-placeholder">点击录入完赛顺序…</div>`}
      </div>`;
  }).join('');

  const chips = unassigned.map(id => {
    const d = getD(id);
    return `
      <button class="driver-chip" onclick="${setFn}('${g}','${id}')">
        <div class="cn xs">${esc(ca[id])}</div>${esc(d?.name)}
      </button>`;
  }).join('');

  const doneAction = round===1
    ? `<button class="btn btn-success btn-full" onclick="goSub('${g}','race2')">✓ 预赛1完成 → 查看换车方案</button>`
    : `<button class="btn btn-success btn-full" onclick="goSub('${g}','scores')">✓ 预赛2完成 → 查看积分榜</button>`;

  // 实时积分预览（基于已录入的本轮+历史轮次）
  const miniScores = (() => {
    const r1cur = race1(g), r2cur = race2(g);
    const sorted = [...ids].sort((a,b) => {
      const sa = (r1cur.includes(a)?pts(r1cur.indexOf(a)+1,n):0) + (r2cur.includes(a)?pts(r2cur.indexOf(a)+1,n):0);
      const sb = (r1cur.includes(b)?pts(r1cur.indexOf(b)+1,n):0) + (r2cur.includes(b)?pts(r2cur.indexOf(b)+1,n):0);
      return sb - sa;
    });
    return sorted.map((id,i) => {
      const d = getD(id);
      const s1 = r1cur.includes(id) ? pts(r1cur.indexOf(id)+1,n) : (round===1?'…':'-');
      const s2 = r2cur.includes(id) ? pts(r2cur.indexOf(id)+1,n) : (round===2?'…':'-');
      const total = (r1cur.includes(id)?pts(r1cur.indexOf(id)+1,n):0)+(r2cur.includes(id)?pts(r2cur.indexOf(id)+1,n):0);
      const posClass = i===0?'gold':i===1?'silver':i===2?'bronze':'';
      return `
        <div class="score-row">
          <div class="rn ${posClass}">${i+1}</div>
          <div class="cn xs">${esc(ca[id])}</div>
          <div style="flex:1;font-size:13px;font-weight:500">${esc(d?.name)}</div>
          <div class="score-breakdown" style="text-align:right">
            <span style="color:var(--text3)">${s1}+${s2}</span>
          </div>
          <div class="score-pts" style="font-size:18px;margin-left:8px">${total||'-'}</div>
        </div>`;
    }).join('');
  })();

  return `
    <div class="card">
      <div class="card-title">🏁 ${g}组 预赛${round}
        <span style="font-size:13px;color:var(--text2);font-family:'Noto Sans SC',sans-serif;font-weight:400">按完赛顺序点击</span>
      </div>
      ${startInfo}
      <div class="rank-slots">${slots}</div>
      ${unassigned.length>0?`<div class="driver-chips">${chips}</div>`:''}
      ${results.length>0?`<button class="btn btn-secondary btn-full" onclick="${clearFn}('${g}')" style="margin-bottom:8px">🔄 重新录入</button>`:''}
      ${results.length===n?doneAction:''}
    </div>
    ${results.length>0?`
    <div class="card" style="border-color:rgba(245,197,24,0.15)">
      <div class="card-title" style="font-size:14px;margin-bottom:10px;color:var(--text2)">
        📊 实时积分（预赛1+预赛2）
      </div>
      ${miniScores}
    </div>`:''}`;

}

// Race 2 = swap info + race entry
function buildRace2(g) {
  const r1 = race1(g), ca = carAssign(g);
  const n = r1.length;
  const swapCars = race2Cars(g);
  const startOrd = race2StartOrder(g);

  const swapSection = r1.length === grpIds(g).length ? `
    <div class="card">
      <div class="card-title" style="font-size:15px">🔄 换车方案 &amp; 发车顺序</div>
      <div class="info-box">末位发车最前，首尾对调车辆</div>
      ${startOrd.map((id, i) => {
        const d = getD(id);
        const origCar = ca[id];
        const newCar = swapCars[id];
        const isSame = origCar === newCar;
        return `
          <div class="swap-row">
            <div class="swap-rank">${i+1}</div>
            <div class="swap-info">
              <div class="swap-name">${esc(d?.name)}</div>
              <div class="swap-detail">原车 ${esc(origCar)}</div>
            </div>
            <div class="swap-arr">${isSame?'≡':'→'}</div>
            ${isSame
              ? `<div class="keep-car">保持 ${esc(origCar)}</div>`
              : `<div class="new-car">${esc(newCar)} 号车</div>`}
          </div>`;
      }).join('')}
    </div>` : `<div class="info-box red">请先完成预赛1</div>`;

  return swapSection + buildRaceEntry(g, 2);
}

// Scores
function buildScores(g) {
  const ids = grpIds(g), ca = carAssign(g);
  const sc = grpScores(g);
  const r1 = race1(g), r2 = race2(g), n = ids.length;
  const sorted = [...ids].sort((a,b) => (sc[b]||0)-(sc[a]||0));

  const rows = sorted.map((id,i) => {
    const d = getD(id);
    const posClass = i===0?'gold':i===1?'silver':i===2?'bronze':'';
    const s1 = r1.includes(id) ? pts(r1.indexOf(id)+1,n) : '-';
    const s2 = r2.includes(id) ? pts(r2.indexOf(id)+1,n) : '-';
    return `
      <div class="score-row">
        <div class="rn ${posClass}">${i+1}</div>
        <div class="cn sm">${esc(ca[id])}</div>
        <div style="flex:1">
          <div style="font-size:14px;font-weight:500">${esc(d?.name)}</div>
          <div class="score-breakdown">预赛1: ${s1} &nbsp;预赛2: ${s2}</div>
        </div>
        <div class="score-pts">${sc[id]||0}</div>
      </div>`;
  }).join('');

  const otherG = g==='A'?'B':'A';
  const otherDone = race1(otherG).length>0 && race2(otherG).length>0 && race1(otherG).length===grpIds(otherG).length && race2(otherG).length===grpIds(otherG).length;
  const thisDone = r1.length===n && r2.length===n && n>0;

  return `
    <div class="card">
      <div class="card-title">📊 ${g}组 积分榜</div>
      ${rows || `<div class="empty-state"><div>📊</div>暂无成绩</div>`}
    </div>
    ${thisDone && otherDone
      ? `<button class="btn btn-primary btn-full" onclick="goTab('final')">🏆 两组均已完赛 → 前往决赛</button>`
      : thisDone
        ? `<div class="info-box teal">✓ ${g}组已完赛，等待${otherG}组完赛</div><button class="btn btn-secondary btn-full" onclick="goTab('group${otherG}')">→ 切换到 ${otherG} 组</button>`
        : ''}`;
}

// ── FINAL PAGE ──
function buildFinalPage() {
  const scA = grpScores('A'), scB = grpScores('B');
  const sortA = [...S.groupA].sort((a,b)=>(scA[b]||0)-(scA[a]||0));
  const sortB = [...S.groupB].sort((a,b)=>(scB[b]||0)-(scB[a]||0));

  // Decide finalists (每组独立取人)
  const nA = Math.min(S.finalistCountA, sortA.length);
  const nB = Math.min(S.finalistCountB, sortB.length);
  const finA = sortA.slice(0, nA), finB = sortB.slice(0, nB);
  const allFin = S.finalOrder.length ? S.finalOrder : [...finA,...finB].sort((a,b)=>{
    const sa = finA.includes(a)?scA[a]:scB[a], sb = finA.includes(b)?scA[b]:scB[b];
    return sb-sa;
  });

  if (!S.finalOrder.length) { S.finalOrder = allFin; save(); }

  const getCarFin = id => finA.includes(id)?S.carAssignA[id]:S.carAssignB[id];
  const getGrp    = id => finA.includes(id)?'A':'B';
  const getScFin  = id => finA.includes(id)?(scA[id]||0):(scB[id]||0);

  const results = S.finalResults;
  const assigned = new Set(results);
  const unassigned = allFin.filter(id => !assigned.has(id));
  const allDone = results.length === allFin.length && allFin.length > 0;

  if (allDone) return buildResults(allFin, getCarFin, getGrp, getScFin);

  // Finalist count selector（每组独立）
  const countSel = `
    <div class="card">
      <div class="card-title">🏆 决赛晋级设置</div>
      <div class="info-box">每组独立设置晋级人数，共 <strong style="color:var(--gold)">${S.finalistCountA+S.finalistCountB}</strong> 人进入决赛</div>
      <div style="margin-bottom:10px">
        <div style="font-size:12px;color:var(--text2);margin-bottom:6px">A 组晋级人数</div>
        <div style="display:flex;gap:8px">
          ${[3,4,5].map(n=>`
            <button class="btn ${S.finalistCountA===n?'btn-primary':'btn-secondary'}"
              onclick="setFCA(${n})">${n}人</button>`).join('')}
        </div>
      </div>
      <div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:6px">B 组晋级人数</div>
        <div style="display:flex;gap:8px">
          ${[3,4,5].map(n=>`
            <button class="btn ${S.finalistCountB===n?'btn-primary':'btn-secondary'}"
              onclick="setFCB(${n})">${n}人</button>`).join('')}
        </div>
      </div>
      <div style="font-size:13px;color:var(--text2);margin-top:12px;padding-top:10px;border-top:1px solid var(--border)">
        A组前 ${S.finalistCountA} 名 + B组前 ${S.finalistCountB} 名 = 共 <strong style="color:var(--gold)">${S.finalistCountA+S.finalistCountB}</strong> 人决赛
      </div>
    </div>`;

  // Starting grid
  const grid = allFin.map((id,i) => {
    const posClass = i===0?'gold':i===1?'silver':i===2?'bronze':'';
    const d = getD(id);
    return `
      <div class="grid-item p${Math.min(i+1,5)}">
        <div class="grid-pos ${posClass}">${i+1}</div>
        <div class="grid-info">
          <div class="grid-name">${esc(d?.name)}</div>
          <div class="grid-sub"><span class="tag tag-${getGrp(id).toLowerCase()}">${getGrp(id)}组</span> 积分${getScFin(id)}</div>
        </div>
        <div class="cn sm">${esc(getCarFin(id))}</div>
      </div>`;
  }).join('');

  // Final result entry
  const slots = allFin.map((_,i) => {
    const id = results[i]; const d = id?getD(id):null;
    const posClass = i===0?'gold':i===1?'silver':i===2?'bronze':'';
    return `
      <div class="rank-slot ${d?'filled':''}">
        <div class="rn ${posClass}">${i+1}</div>
        ${d ? `
          <div class="cn sm">${esc(getCarFin(d.id))}</div>
          <div class="rank-name">${esc(d.name)}</div>
          <button class="rank-rm" onclick="unsetFin(${i})">✕</button>
        ` : '<div class="rank-placeholder">点击车手录入…</div>'}
      </div>`;
  }).join('');

  const chips = unassigned.map(id => {
    const d = getD(id);
    return `
      <button class="driver-chip" onclick="setFin('${id}')">
        <div class="cn xs">${esc(getCarFin(id))}</div>
        ${esc(d?.name)}<span class="tag tag-${getGrp(id).toLowerCase()}" style="margin-left:4px">${getGrp(id)}</span>
      </button>`;
  }).join('');

  return `
    ${countSel}
    <div class="card"><div class="card-title">🏁 发车阵容（18圈）</div>${grid}</div>
    <div class="card">
      <div class="card-title">录入完赛顺序</div>
      <div class="rank-slots">${slots}</div>
      ${unassigned.length?`<div class="driver-chips">${chips}</div>`:''}
      ${results.length?`<button class="btn btn-secondary btn-full" onclick="clearFin()">🔄 重新录入</button>`:''}
    </div>`;
}

// ── RESULTS ──
function buildResults(allFin, getCarFin, getGrp, getScFin) {
  const r = S.finalResults;
  const prizes = [
    {medal:'🥇',cls:'gd',award:'储值卡 888元 + 纪念奖杯 🏆'},
    {medal:'🥈',cls:'sv',award:'储值卡 666元 + 纪念奖杯 🏆'},
    {medal:'🥉',cls:'br',award:'储值卡 568元 + 纪念奖杯 🏆'},
  ];
  saveHistory(r[0]);
  const podium = r.slice(0,3).map((id,i) => {
    const d=getD(id), p=prizes[i];
    return `
      <div class="prize-item ${p.cls}">
        <div class="prize-medal">${p.medal}</div>
        <div>
          <div class="prize-name">${esc(d?.name)}</div>
          <div class="prize-award">${p.award}</div>
        </div>
      </div>`;
  }).join('');
  const full = r.map((id,i) => {
    const d=getD(id);
    const posClass=i===0?'gold':i===1?'silver':i===2?'bronze':'';
    return `
      <div class="score-row">
        <div class="rn ${posClass}">${i+1}</div>
        <div class="cn sm">${esc(getCarFin(id))}</div>
        <div style="flex:1;font-size:14px">${esc(d?.name)}</div>
        <span class="tag tag-${getGrp(id).toLowerCase()}">${getGrp(id)}组</span>
      </div>`;
  }).join('');
  return `
    <div class="card" style="border-color:rgba(245,197,24,0.3)">
      <div class="card-title" style="justify-content:center;font-size:20px">🏆 决赛结果</div>
      <div style="text-align:center;color:var(--text2);font-size:13px;margin-bottom:14px">${S.raceDate}</div>
      ${podium}
    </div>
    <div class="card"><div class="card-title" style="font-size:15px;margin-bottom:10px">完整顺序</div>${full}</div>
    <button class="btn btn-secondary btn-full" onclick="newRace()">＋ 开始新一场比赛</button>`;
}

// ── ACTIONS ──
function addCar() {
  const el=document.getElementById('inCar'); const v=el?.value.trim();
  if (!v) { toast('请输入车号','error'); return; }
  if (S.carPool.includes(v)) { toast(`车号${v}已存在`,'error'); return; }
  S.carPool.push(v); el.value=''; save(); render();
  document.getElementById('inCar')?.focus();
  toast(`✓ ${v}号车已加入`,'success');
}
function rmCar(c) { S.carPool=S.carPool.filter(x=>x!==c); save(); render(); }

function addDriver() {
  const el=document.getElementById('inName'); const name=el?.value.trim();
  if (!name) { toast('请输入姓名','error'); return; }
  if (S.drivers.some(d=>d.name===name)) { toast(`${name}已报名`,'error'); return; }
  S.drivers.push({id:uid(),name}); el.value=''; save(); render();
  document.getElementById('inName')?.focus();
  toast(`✓ ${name}报名成功`,'success');
}
function rmDriver(id) { S.drivers=S.drivers.filter(d=>d.id!==id); save(); render(); }

function reGroup() { doGroup(); save(); render(); toast('已重新随机分组','info'); }

// Qualify
function setQ(g,id) {
  const arr = g==='A'?S.aQualOrder:S.bQualOrder;
  if (!arr.includes(id)) arr.push(id);
  save(); render();
}
function unsetQ(g,i) {
  if (g==='A') S.aQualOrder.splice(i,1); else S.bQualOrder.splice(i,1);
  save(); render();
}
function clearQ(g) { if(g==='A'){S.aQualOrder=[];S.aQualTimes={};}else{S.bQualOrder=[];S.bQualTimes={};} save(); render(); }
function setQTime(g,id,val) { if(g==='A') S.aQualTimes[id]=val; else S.bQualTimes[id]=val; save(); }
function autoSortByTime(g) {
  const times = g==='A'?S.aQualTimes:S.bQualTimes;
  const ids = g==='A'?S.groupA:S.groupB;
  const withTime = ids.filter(id=>times[id]);
  if (withTime.length < 2) return;
  withTime.sort((a,b)=>times[a].localeCompare(times[b]));
  const without = ids.filter(id=>!times[id]);
  if(g==='A') S.aQualOrder=[...withTime,...without];
  else S.bQualOrder=[...withTime,...without];
  save(); render(); toast('已按圈时排序','info');
}

// Race 1
function setR1(g,id) { const arr=g==='A'?S.aRace1:S.bRace1; if(!arr.includes(id))arr.push(id); save(); render(); }
function unsetR1(g,i) { if(g==='A')S.aRace1.splice(i,1);else S.bRace1.splice(i,1); save(); render(); }
function clearR1(g) { if(g==='A')S.aRace1=[];else S.bRace1=[]; save(); render(); }

// Race 2
function setR2(g,id) { const arr=g==='A'?S.aRace2:S.bRace2; if(!arr.includes(id))arr.push(id); save(); render(); }
function unsetR2(g,i) { if(g==='A')S.aRace2.splice(i,1);else S.bRace2.splice(i,1); save(); render(); }
function clearR2(g) { if(g==='A')S.aRace2=[];else S.bRace2=[]; save(); render(); }

// Final
function setFCA(n) { S.finalistCountA=n; S.finalOrder=[]; S.finalResults=[]; save(); render(); }
function setFCB(n) { S.finalistCountB=n; S.finalOrder=[]; S.finalResults=[]; save(); render(); }
function setFin(id) {
  if(!S.finalResults.includes(id)) S.finalResults.push(id);
  save();
  if(S.finalResults.length===S.finalOrder.length) { save(); render(); }
  else render();
}
function unsetFin(i) { S.finalResults.splice(i,1); save(); render(); }
function clearFin() { S.finalResults=[]; save(); render(); }

function newRace() {
  if(!confirm('开始新的一场比赛？当前数据将清空（历史已保存）。')) return;
  S=freshState(); save(); render();
}

function skipOnboarding() {
  S.onboardingDone = true;
  save(); goSetup('carPool');
}

function loadDemoData() {
  if(!confirm('加载3月28日报名数据（18人）？当前数据将被覆盖。')) return;
  S = freshState();
  S.carPool = ['60','61','62','63','64','65','66','67','68','69'];
  S.raceDate = '2026/03/28';
  const names = [
    '老马',
    'Max Verstappen Tao',
    '赵晨宇',
    '常圃开',
    '龘靐齉爩',
    '山僧',
    'Ecstasy',
    '贰拾捌',
    '徐弘智',
    'NENGER蒲宇昊',
    '饭冰冰',
    'Quentin',
    '大雨治谁',
    'T',
    '·  ·',
    '老马朋友1',
    '老马朋友2',
    '郑州手气王',
  ];
  S.drivers = names.map(name => ({id: uid(), name}));
  S.setupStep = 'grouping';
  save(); render();
  toast('✓ 已加载18名车手 · 车号60-69', 'success');
}

// History
function saveHistory(winnerId) {
  try {
    const h=JSON.parse(localStorage.getItem('kart_hist')||'[]');
    const w=getD(winnerId);
    if(!h.find(x=>x.date===S.raceDate&&x.winner===w?.name)) {
      h.push({date:S.raceDate,count:S.drivers.length,winner:w?.name||'?'});
      if(h.length>20) h.shift();
      localStorage.setItem('kart_hist',JSON.stringify(h));
    }
  } catch(e){}
}

// ── EVENT BINDING ──
function bindEvents() {
  document.getElementById('inName')?.addEventListener('keydown',e=>{if(e.key==='Enter')addDriver();});
  document.getElementById('inCar')?.addEventListener('keydown',e=>{if(e.key==='Enter')addCar();});
}

// ── TOAST ──
let _tt;
function toast(msg,type='info') {
  const el=document.getElementById('toast');
  el.textContent=msg; el.className=`toast ${type} show`;
  clearTimeout(_tt); _tt=setTimeout(()=>el.classList.remove('show'),2400);
}

// ── INIT ──
load();
render();

// 禁用右键菜单
document.addEventListener('contextmenu', e => e.preventDefault());

// 禁用双击缩放
(function() {
  let lastTap = 0;
  document.addEventListener('touchend', e => {
    const now = Date.now();
    if (now - lastTap < 300) e.preventDefault();
    lastTap = now;
  }, { passive: false });
})();

// 禁用多指手势缩放
document.addEventListener('touchmove', e => {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });

// 让输入框正常可选中文字
document.addEventListener('focusin', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    e.target.style.userSelect = 'text';
    e.target.style.webkitUserSelect = 'text';
  }
});
