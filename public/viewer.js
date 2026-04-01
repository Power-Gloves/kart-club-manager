/**
 * 卡丁车大赛 · 观众/车手实时看板
 * 只读，通过 Socket.io 接收实时状态
 */

let S = {};

// ── Socket.io ──
const socket = io({ transports: ['websocket', 'polling'] });

socket.on('connect', () => {
  console.log('[Viewer] 已连接');
  setLive(true);
});
socket.on('disconnect', () => {
  setLive(false);
});
socket.on('state_update', (newState) => {
  if (newState && Object.keys(newState).length > 0) {
    S = newState;
    render();
  }
});

// ── 初始化 ──
(async () => {
  try {
    const res = await fetch('/api/state');
    const { state } = await res.json();
    if (state && Object.keys(state).length > 0) S = state;
  } catch(e) {}
  render();
})();

// ── 直播状态指示 ──
function setLive(on) {
  const el = document.getElementById('_live');
  if (el) el.innerHTML = on
    ? `<span class="live-dot">实时直播</span>`
    : `<span style="font-size:12px;color:var(--text3)">⚠ 连接中...</span>`;
}

// ── 工具 ──
const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const getD = id => S.drivers?.find(d => d.id === id);
const pts = (pos, n) => Math.max(n - pos + 1, 1);

function calcGroupScore(groupIds, r1, r2, carAssign) {
  const n = groupIds.length;
  return groupIds.map(id => {
    const s1 = r1.includes(id) ? pts(r1.indexOf(id)+1, n) : 0;
    const s2 = r2.includes(id) ? pts(r2.indexOf(id)+1, n) : 0;
    return { id, s1, s2, total: s1+s2, car: carAssign?.[id], driver: getD(id) };
  }).sort((a,b) => b.total - a.total);
}

// ── 主渲染 ──
function render() {
  document.getElementById('app').innerHTML = buildViewer();
  setLive(socket.connected);
}

function buildViewer() {
  return `
    ${buildHeader()}
    <div class="vc fade-in">${buildContent()}</div>
  `;
}

function buildHeader() {
  const phaseLabel = getPhaseLabel();
  return `
    <div class="vh">
      <div class="vlogo">
        <span class="vlogo-icon">🏎️</span>
        <div>
          <div class="vlogo-text">SUPER MARIO KART</div>
          <div class="vlogo-sub">${esc(S.raceDate || '超级马力卡丁车俱乐部')}</div>
        </div>
      </div>
      <div id="_live"><span style="font-size:12px;color:var(--text3)">连接中...</span></div>
    </div>`;
}

// ── 赛事阶段判断 ──
function getPhase() {
  if (!S.drivers?.length && !S.carPool?.length) return 'waiting';
  if (!S.groupA?.length)  return 'registration';
  if (S.tab === 'setup' || S.tab === 'groupA' || S.tab === 'groupB') return 'prerace';
  if (S.tab === 'final') {
    if (S.finalResults?.length > 0) return 'finished';
    return 'final';
  }
  return 'prerace';
}

function getPhaseLabel() {
  const map = {
    waiting:      '等待开赛',
    registration: '报名进行中',
    prerace:      '预赛阶段',
    final:        '决赛进行中',
    finished:     '比赛结束',
  };
  return map[getPhase()] || '';
}

function buildContent() {
  const phase = getPhase();
  switch (phase) {
    case 'waiting':      return buildWaiting();
    case 'registration': return buildRegistration();
    case 'prerace':      return buildPrerace();
    case 'final':        return buildFinalLive();
    case 'finished':     return buildFinished();
    default: return buildWaiting();
  }
}

// ── 等待中 ──
function buildWaiting() {
  return `
    <div class="wait-screen">
      <div class="wait-logo">🏎️</div>
      <div class="wait-title">大赛即将开始</div>
      <div class="wait-sub">裁判正在准备赛事<br>请耐心等待...</div>
    </div>`;
}

// ── 报名阶段 ──
function buildRegistration() {
  const drivers = S.drivers || [];
  const chips = drivers.map(d => `
    <div class="dchip">
      <div class="dav">${esc(d.name?.charAt(0)||'?')}</div>
      <div class="dname">${esc(d.name)}</div>
    </div>`).join('');

  return `
    <div class="phase-banner">
      <div class="phase-emoji">📝</div>
      <div class="phase-title">报名进行中</div>
      <div class="phase-sub">已报名 <strong style="color:var(--gold)">${drivers.length}</strong> 人</div>
    </div>
    <div style="height:12px"></div>
    <div class="vcard">
      <div class="vcard-title">📋 已报名车手</div>
      ${drivers.length > 0
        ? `<div class="driver-grid">${chips}</div>`
        : '<div style="text-align:center;color:var(--text3);padding:12px">暂无车手报名</div>'
      }
    </div>`;
}

// ── 预赛阶段 ──
function buildPrerace() {
  const aIds = S.groupA || [];
  const bIds = S.groupB || [];
  const fcA = S.finalistCountA || Math.ceil(aIds.length / 2);
  const fcB = S.finalistCountB || Math.ceil(bIds.length / 2);
  const aScores = calcGroupScore(aIds, S.aRace1||[], S.aRace2||[], S.carAssignA);
  const bScores = calcGroupScore(bIds, S.bRace1||[], S.bRace2||[], S.carAssignB);

  const r1ADone = (S.aRace1||[]).length > 0;
  const r2ADone = (S.aRace2||[]).length > 0;
  const r1BDone = (S.bRace1||[]).length > 0;
  const r2BDone = (S.bRace2||[]).length > 0;

  const scoreTag = (r1, r2) => {
    if (!r1 && !r2) return '<span style="font-size:11px;color:var(--text3)">未开始</span>';
    if (r1 && !r2)  return '<span style="font-size:11px;color:var(--gold)">预赛1 进行中</span>';
    return '<span style="font-size:11px;color:var(--green)">✓ 预赛完成</span>';
  };

  const buildGroupCard = (label, scores, fc, r1Done, r2Done, tagCls) => {
    if (!scores.length) return '';
    const rows = scores.map((item, i) => {
      const qualified = i < fc;
      const posClass = i===0?'p1':i===1?'p2':i===2?'p3':'px';
      return `
        <div class="vrow">
          <div class="vpos ${posClass}">${i+1}</div>
          ${item.car ? `<div class="vcar">${esc(item.car)}</div>` : ''}
          <div class="vname">${esc(item.driver?.name||'?')}</div>
          <div style="text-align:right">
            <div class="vpts">${item.total}<span style="font-size:12px;color:var(--text3)">分</span></div>
            <div class="vpts-detail">${item.s1}+${item.s2}</div>
          </div>
          ${qualified ? '<div class="vq">进决赛</div>' : ''}
        </div>`;
    }).join('');

    return `
      <div class="vcard">
        <div class="vcard-title">
          <span class="vtag ${tagCls}">${label}组</span>
          ${scoreTag(r1Done, r2Done)}
        </div>
        ${rows}
        <div style="font-size:11px;color:var(--text2);margin-top:10px;text-align:center">
          积分规则：第1完成得${scores.length}分，依次递减，最低1分
        </div>
      </div>`;
  };

  return `
    <div class="phase-banner">
      <div class="phase-emoji">🏁</div>
      <div class="phase-title">预赛进行中</div>
      <div class="phase-sub">A/B两组各选前${fcA}名晋级决赛</div>
    </div>
    <div style="height:12px"></div>
    ${buildGroupCard('A', aScores, fcA, r1ADone, r2ADone, 'vtag-a')}
    ${buildGroupCard('B', bScores, fcB, r1BDone, r2BDone, 'vtag-b')}`;
}

// ── 决赛进行中 ──
function buildFinalLive() {
  const allFin = [...(S.finalOrder||[])];
  const finA   = (S.groupA||[]).filter((_, i) => i < (S.finalistCountA||3));
  const finB   = (S.groupB||[]).filter((_, i) => i < (S.finalistCountB||3));
  const finalists = allFin.length ? allFin : [...finA, ...finB];

  const rows = finalists.map((id, i) => {
    const d = getD(id);
    const grp = (S.groupA||[]).includes(id) ? 'A' : 'B';
    const car = grp==='A' ? S.carAssignA?.[id] : S.carAssignB?.[id];
    const posClass = i===0?'p1':i===1?'p2':i===2?'p3':'px';
    return `
      <div class="vrow">
        <div class="vpos ${posClass}">${i+1}</div>
        ${car ? `<div class="vcar">${esc(car)}</div>` : ''}
        <div class="vname">${esc(d?.name||'?')}</div>
        <div class="vtag vtag-${grp.toLowerCase()}">${grp}组</div>
      </div>`;
  }).join('');

  return `
    <div class="phase-banner" style="background:rgba(245,197,24,0.06);border-color:rgba(245,197,24,0.3)">
      <div class="phase-emoji">🏆</div>
      <div class="phase-title" style="font-size:26px">决赛 · 进行中</div>
      <div class="phase-sub">${finalists.length} 名选手争夺冠军</div>
    </div>
    <div style="height:12px"></div>
    <div class="vcard">
      <div class="vcard-title">🏁 发车阵容</div>
      ${rows || '<div style="color:var(--text3)">正在确认名单...</div>'}
    </div>`;
}

// ── 比赛结束 / 颁奖台 ──
function buildFinished() {
  const r = S.finalResults || [];
  if (!r.length) return buildFinalLive();

  const top3 = r.slice(0, 3);
  const rest = r.slice(3);

  // 颁奖台顺序：2nd, 1st, 3rd
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
  const podiumConf = [
    { cls:'p2', block:'p2', height:'', label:'2', medal:'🥈' },
    { cls:'p1', block:'p1', height:'', label:'1', medal:'🥇' },
    { cls:'p3', block:'p3', height:'', label:'3', medal:'🥉' },
  ];

  // 重新排：1st 在中间
  const podOrder = top3.length >= 2 ? [top3[1], top3[0], top3[2]].filter(Boolean) : [top3[0]];
  const podConf  = [podiumConf[1], podiumConf[0], podiumConf[2]];

  const podiumHtml = podOrder.map((id, i) => {
    const d = getD(id);
    const grp = (S.groupA||[]).includes(id) ? 'A' : 'B';
    const car = grp==='A' ? S.carAssignA?.[id] : S.carAssignB?.[id];
    const conf = podConf[i];
    return `
      <div class="podium-item">
        <div class="podium-medal">${conf.medal}</div>
        <div class="podium-name">${esc(d?.name||'?')}</div>
        ${car ? `<div class="podium-car">${esc(car)}</div>` : ''}
        <div class="podium-block ${conf.block}">${conf.label}</div>
      </div>`;
  }).join('');

  const restRows = rest.map((id, i) => {
    const d = getD(id);
    const grp = (S.groupA||[]).includes(id) ? 'A' : 'B';
    const car = grp==='A' ? S.carAssignA?.[id] : S.carAssignB?.[id];
    return `
      <div class="vrow">
        <div class="vpos px">${i+4}</div>
        ${car ? `<div class="vcar">${esc(car)}</div>` : ''}
        <div class="vname">${esc(d?.name||'?')}</div>
        <div class="vtag vtag-${grp.toLowerCase()}">${grp}组</div>
      </div>`;
  }).join('');

  return `
    <div class="phase-banner" style="background:rgba(245,197,24,0.06);border-color:rgba(245,197,24,0.3)">
      <div class="phase-emoji">🎉</div>
      <div class="phase-title">比赛结束！</div>
      <div class="phase-sub">${S.raceDate || ''} &nbsp;·&nbsp; ${S.drivers?.length||0}人参赛</div>
    </div>
    <div class="vcard" style="border-color:rgba(245,197,24,0.2)">
      <div class="vcard-title">🏆 冠亚季军</div>
      <div class="podium">${podiumHtml}</div>
    </div>
    ${rest.length ? `
    <div class="vcard">
      <div class="vcard-title">📋 完整名次</div>
      ${restRows}
    </div>` : ''}`;
}
