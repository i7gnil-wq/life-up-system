// =============================================================
// profile.js — صفحة «الملف الشخصي» (التبويب السفلي: profile)
// يشارك النطاق العام (global scope) مع core.js — حمّله بعده مباشرة
// =============================================================
//
// [يعتمد على أشياء معرّفة في core.js]:
//   state, escapeHtml, RANK_TIERS, TRACKS, insigniaSvg, formatXp,
//   getLevelData, tierXpRange, getTrackXP, computeStreak,
//   ensureStreakDays, markStreakToday
// [يعتمد على أشياء معرّفة في progress.js]:
//   SKILL_CATS (تُستخدم في أيقونة الإنجاز)
//
// [هذا الملف يوفّر للملفات الأخرى]:
//   renderProfilePage()      → مسجّلة على حدث 'app:render' (يُطلقه core.js)
//   recordTask(task)         → مسجّلة على حدث 'app:record-task' من core.js،
//                              وتُستدعى مباشرة أيضًا من tasks.js وprogress.js
//   removeTaskLogById(id)    → تستدعيها tasks.js وprogress.js عند حذف مهمة
//   shieldMiniIcon()         → تستخدمها progress.js في بطاقة "تغلّب على متلازمة"
//
// ⚠️ لا تُعِد تسمية أو تحذف أي دالة أعلاه بدون التأكد من الملف الآخر.
// =============================================================

  // ---------- سجل المهام (Task Log) — مرتبط مباشرة بالرادار ----------
  // كل ما يتغيّر سجل المهام، الرادار يعتمد على نفس البيانات (state.tasks)
  // لذلك الاثنان موجودان هنا سوا في نفس الملف
  function ensureTaskLog(){
    if(!Array.isArray(state.taskLog)) state.taskLog = [];
    // Migrate existing completed-task records once, while keeping state.tasks intact
    // so XP, statistics, tracks, and other totals are never lost.
    if(!state.taskLogInitialized){
      state.taskLog = (state.tasks || []).slice(-50).map(t => ({...t}));
      state.taskLogInitialized = true;
    }
    if(state.taskLog.length > 50) state.taskLog = state.taskLog.slice(-50);
  }
  function recordTask(task){
    if(!state.tasks) state.tasks = [];
    if(!Array.isArray(state.taskLog)) state.taskLog = [];
    state.tasks.push(task);
    state.taskLog.push({...task});
    if(state.taskLog.length > 50) state.taskLog = state.taskLog.slice(-50);
    markStreakToday();
  }
  function removeTaskLogById(id){
    if(!Array.isArray(state.taskLog)) return;
    state.taskLog = state.taskLog.filter(t => t.id !== id);
  }

  function renderLifeRadar(){
    const svg=document.getElementById('life-radar-svg');
    const wrap=document.getElementById('life-radar');
    const tooltip=document.getElementById('radar-tooltip');
    const detail=document.getElementById('radar-detail');
    if(!svg || !state) return;

    const W=520,H=430,cx=260,cy=205,R=135,N=TRACKS.length;
    const counts=TRACKS.map(t=>state.tasks.filter(x=>x.trackKey===t.key).length);
    // Percentages are ALWAYS calculated from the same underlying task totals.
    // Changing the radar maximum must never alter, clamp, or otherwise modify them.
    const totalCount=counts.reduce((sum,c)=>sum+c,0);
    const scores=counts.map(c=>totalCount ? Math.round((c/totalCount)*100) : 0);
    // شبكة الرسم العنكبية تكبر وتصغر تلقائيًا حسب أعلى نسبة مئوية حالية.
    const radarMax=Math.max(...scores, 1);
    const angle=i=>(-Math.PI/2)+(i*2*Math.PI/N);
    const pt=(i,r)=>({x:cx+Math.cos(angle(i))*r,y:cy+Math.sin(angle(i))*r});
    const poly=(r)=>TRACKS.map((_,i)=>{const p=pt(i,r);return `${p.x},${p.y}`}).join(' ');
    const dataPoly=TRACKS.map((_,i)=>{const p=pt(i,R*(scores[i]/radarMax));return `${p.x},${p.y}`}).join(' ');

    let html='';
    for(let level=1;level<=5;level++) html+=`<polygon class="radar-grid" points="${poly(R*level/5)}"/>`;
    TRACKS.forEach((t,i)=>{
      const p=pt(i,R), box=pt(i,R+58);
      const boxW=124, boxH=50;
      html+=`<line class="radar-axis" x1="${cx}" y1="${cy}" x2="${p.x}" y2="${p.y}"/>`;
      // Connector visually ties every stat box to its exact radar vertex.
      html+=`<line class="radar-label-connector" x1="${p.x}" y1="${p.y}" x2="${box.x}" y2="${box.y}"/>`;
      html+=`<g class="radar-label-group" data-radar-index="${i}" tabindex="0" role="button" aria-label="${t.name} ${scores[i]}%">`;
      html+=`<rect class="radar-label-box" x="${box.x-boxW/2}" y="${box.y-boxH/2}" width="${boxW}" height="${boxH}" rx="9"/>`;
      html+=`<text class="radar-label" data-radar-index="${i}" x="${box.x}" y="${box.y}" text-anchor="middle" dominant-baseline="middle">${t.name} <tspan class="radar-value">${scores[i]}%</tspan></text>`;
      html+=`</g>`;
    });
    html+=`<polygon class="radar-fill" points="${dataPoly}"/>`;
    TRACKS.forEach((t,i)=>{const p=pt(i,R*(scores[i]/radarMax)); html+=`<circle class="radar-point" data-radar-index="${i}" cx="${p.x}" cy="${p.y}" r="5"/>`;});
    html+=`<circle cx="${cx}" cy="${cy}" r="4" fill="#7fd8d3" stroke="#0d1b21" stroke-width="2"/>`;
    svg.innerHTML=html;

    const show=(i,e)=>{
      const t=TRACKS[i], c=counts[i], sc=scores[i];
      detail && (detail.innerHTML=`<strong style="color:#8fe6df">${t.name}</strong> — ${c} مهمة منجزة · ${sc}% من إجمالي المهام`);
      tooltip.innerHTML=`<strong>${t.name}</strong><br>${c} مهمة · ${sc}%`;
      const rect=wrap.getBoundingClientRect();
      const x=(e?.clientX||rect.left+rect.width/2)-rect.left;
      const y=(e?.clientY||rect.top+rect.height/2)-rect.top;
      tooltip.style.left=Math.max(4,Math.min(rect.width-135,x+10))+'px';
      tooltip.style.top=Math.max(4,Math.min(rect.height-62,y-20))+'px';
      tooltip.classList.add('show');
      svg.querySelectorAll('.radar-point').forEach(p=>p.classList.toggle('active',p.dataset.radarIndex==i));
      svg.querySelectorAll('.radar-label-box').forEach(b=>b.style.stroke=b.parentElement.dataset.radarIndex==i?'#8fe6df':'');
    };
    const hide=()=>{
      tooltip.classList.remove('show');
      svg.querySelectorAll('.radar-point').forEach(p=>p.classList.remove('active'));
      svg.querySelectorAll('.radar-label-box').forEach(b=>b.style.stroke='');
    };
    svg.querySelectorAll('[data-radar-index]').forEach(el=>{
      const i=Number(el.dataset.radarIndex);
      el.addEventListener('mouseenter',e=>show(i,e));
      el.addEventListener('mousemove',e=>show(i,e));
      el.addEventListener('mouseleave',hide);
      el.addEventListener('click',e=>show(i,e));
      el.addEventListener('focus',e=>show(i,e));
      el.addEventListener('blur',hide);
    });
  }

  function renderProfilePage(){
    if(!state) return;
    const xp = state.xp;
    const lv = getLevelData(xp);
    const rank = lv.rank;
    const initial = state.name.trim().charAt(0).toUpperCase() || '؟';

    document.getElementById('chip-name').textContent = state.name;
    document.getElementById('chip-code').textContent = state.code;
    ['chip-avatar','status-avatar','settings-avatar-preview'].forEach(id => {
      const el = document.getElementById(id);
      if(!el) return;
      if(state.avatarImage){
        el.style.backgroundImage = `url(${state.avatarImage})`;
        el.textContent = '';
      }else{
        el.style.backgroundImage = '';
        el.textContent = initial;
      }
    });
    document.getElementById('status-name').textContent = state.name;
    document.getElementById('status-rank').textContent = `${rank.name} · المستوى ${lv.level}`;
    document.getElementById('stat-xp').textContent = formatXp(xp);
    ensureStreakDays();
    const streakVal = computeStreak(state.streakDays);
    document.getElementById('stat-streak').textContent = streakVal;
    const streakCellEl = document.getElementById('stat-streak-cell');
    if(streakCellEl) streakCellEl.classList.toggle('active', streakVal > 0);
    document.getElementById('stat-tasks').textContent = state.tasks.length;
    document.getElementById('badge-rank').textContent = `${rank.name} — Lv.${lv.level}`;
    document.getElementById('badge-stars').innerHTML = insigniaSvg(rank, '#7fd8d3');

    // ring — نسبة التقدّم داخل المستوى الحالي (وليس داخل الرتبة الكاملة)
    const pct = lv.pct;
    const caption = `${formatXp(lv.into)} / ${formatXp(lv.span)} XP حتى المستوى ${lv.level + 1}`;
    const circumference = 352;
    const offset = circumference - (circumference * pct/100);
    document.getElementById('ring-progress').style.strokeDashoffset = offset;
    document.getElementById('ring-pct').textContent = pct + '%';
    document.getElementById('ring-caption').textContent = caption;

    // rank rail — 10 رتب أساسية (100 مستوى)، وبعدها رُتب "أسطورة" تتجدّد للأبد
    const rail = document.getElementById('rank-rail');
    const baseRows = RANK_TIERS.map((t, i) => {
      const range = tierXpRange(i);
      let cls = '';
      if(rank.tierIndex > i) cls = 'done';
      else if(rank.tierIndex === i) cls = 'active';
      let fillPct = 0;
      if(rank.tierIndex > i) fillPct = 100;
      else if(rank.tierIndex === i) fillPct = Math.min(100, Math.round(((xp - range.minXp)/(range.maxXp - range.minXp))*100));
      return `
        <div class="rank-node ${cls}">
          <div class="node-dot"></div>
          <div class="ins-row">
            <div class="ins-name">${t.name}</div>
            <div class="stars">${insigniaSvg({stars:i+1}, rank.tierIndex>=i ? '#7fd8d3' : 'rgba(130,195,195,0.35)')}</div>
          </div>
          <div class="range">مستوى ${range.startLevel}–${range.endLevel} · ${formatXp(range.minXp)} – ${formatXp(range.maxXp)} XP</div>
          <div class="mini-bar"><div class="mini-fill" style="width:${fillPct}%"></div></div>
        </div>`;
    }).join('');
    let legendaryRow = '';
    if(rank.legendary){
      const range = tierXpRange(rank.tierIndex);
      const fillPct = Math.min(100, Math.round(((xp - range.minXp)/(range.maxXp - range.minXp))*100));
      legendaryRow = `
        <div class="rank-node active legendary">
          <div class="node-dot"></div>
          <div class="ins-row">
            <div class="ins-name">${rank.name}</div>
            <div class="stars">${insigniaSvg({stars:10}, '#7fd8d3')}</div>
          </div>
          <div class="range">مستوى ${range.startLevel}–${range.endLevel} · ${formatXp(range.minXp)} – ${formatXp(range.maxXp)} XP</div>
          <div class="mini-bar"><div class="mini-fill" style="width:${fillPct}%"></div></div>
        </div>`;
    }
    rail.innerHTML = baseRows + legendaryRow;

    // caption under figure
    const figCaptionEl = document.getElementById('figure-caption');
    if(figCaptionEl) figCaptionEl.textContent =
      state.tasks.length ? `آخر مهمة: ${state.tasks[state.tasks.length-1].name}` : 'جاهز لاستلام المهمة القادمة';

    const tracksGrid = document.getElementById('tracks-grid');
    if(tracksGrid){
      const trackData = TRACKS.map(t => ({
        track:t,
        count:state.tasks.filter(tk => tk.trackKey === t.key).length,
        xp:getTrackXP(t.key)
      }));
      const maxTrackXP = Math.max(1, ...trackData.map(x => x.xp));
      tracksGrid.innerHTML = trackData.map(({track:t,count,xp}) => {
        const trackPoints = Number((xp / 1000).toFixed(2));
        return `
        <div class="track-card">
          <div class="t-icon">${t.icon}</div>
          <div class="track-info">
            <div class="t-name">${t.name}</div>
            <div class="track-stats">
              <div class="track-stat"><span class="track-stat-label">المهمات المنجزة</span><span class="track-stat-num">${count}</span></div>
              <div class="track-stat"><span class="track-stat-label">نقاط المسار</span><span class="track-stat-num">${trackPoints}</span></div>
            </div>
          </div>
        </div>`;
      }).join('');
    }

    renderLifeRadar();

    // achievements
    ensureAchievements();
    document.getElementById('ach-count-pill').textContent = state.achievements.length;
    renderAchievements();

    // log — show at most 10 recent entries; the separate history keeps the latest 50 tasks
    ensureTaskLog();
    const logEl = document.getElementById('log-list');
    const penalties = state.penalties || [];
    const combined = [
      ...state.taskLog.map(t => ({ type:'task', ts:t.ts, name:t.name, sub:(t.trackName ? t.trackName + ' · ' : '') + (t.desc || t.diffName), amount:t.xp, special: t.diffKey === 'pivot' })),
      ...penalties.map(p => ({ type:'penalty', ts:p.ts, name:p.name, sub:(p.restored ? 'تم استرجاع الخصم' : (p.reason || 'عقوبة')), amount:(p.deductedAmount ?? p.amount), special:false, restored:!!p.restored })),
    ].sort((a,b) => b.ts - a.ts).slice(0,10);

    if(!combined.length){
      logEl.innerHTML = '<div class="log-empty">لا توجد حركات بعد — ابدأ بإضافة أول مهمة لك.</div>';
    } else {
      logEl.innerHTML = combined.map(item => {
        const d = new Date(item.ts);
        const timeStr = d.toLocaleDateString('ar', {day:'numeric', month:'short'}) + ' · ' + d.toLocaleTimeString('ar', {hour:'2-digit', minute:'2-digit'});
        const isPenalty = item.type === 'penalty';
        const chip = isPenalty ? (item.restored ? '✓' : '−'+item.amount) : (item.special ? ICON_BOLT : '+'+item.amount);
        const chipColor = isPenalty ? (item.restored ? '#7fd8d3' : '#d97757') : (item.special ? '#bdf0ea' : '#7fd8d3');
        const chipBorder = isPenalty ? (item.restored ? 'rgba(127,216,211,0.4)' : 'rgba(226,96,79,0.4)') : (item.special ? 'rgba(189,240,234,0.4)' : 'rgba(127,216,211,0.3)');
        return `
        <div class="log-item">
          <div class="left">
            <div class="diff-chip" style="color:${chipColor}; border:1px solid ${chipBorder};">${chip}</div>
            <div class="info">
              <div class="t">${escapeHtml(item.name)}</div>
              <div class="d">${escapeHtml(item.sub)}</div>
            </div>
          </div>
          <div class="meta">
            <div class="xp" style="${isPenalty ? (item.restored ? 'color:#7fd8d3' : 'color:#d97757') : ''}">${isPenalty ? (item.restored ? '+' : '−') : '+'}${item.amount} XP${isPenalty && item.restored ? ' مسترجع' : ''}</div>
            <div class="time">${timeStr}</div>
          </div>
        </div>`;
      }).join('');
    }
  }

  // ---------- achievements ----------
  function shieldMiniIcon(){
    return '<svg viewBox="0 0 24 24" fill="#bdf0ea"><path d="M12 2 4 5v6c0 5.2 3.4 9.4 8 11 4.6-1.6 8-5.8 8-11V5l-8-3Z"/></svg>';
  }
  function achievementShieldSvg(){
    return `
    <svg viewBox="0 0 100 76">
      <defs>
        <linearGradient id="achGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#d3f3ef"/>
          <stop offset="55%" stop-color="#bdf0ea"/>
          <stop offset="100%" stop-color="#7fa0a3"/>
        </linearGradient>
      </defs>
      <path d="M15.8 8 Q15.8 3 20.8 3 H79.2 Q84.2 3 84.2 8 V33 C84.2 52 68.3 64 50 71 C31.7 64 15.8 52 15.8 33 Z"
            fill="url(#achGrad)" stroke="#1f3d3a" stroke-width="2"/>
      <path d="M22.5 12 Q22.5 9 25.8 9 H74.2 Q77.5 9 77.5 12 V33 C77.5 47 64.2 57 50 63 C35.8 57 22.5 47 22.5 33 Z"
            fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.2"/>
    </svg>`;
  }
  function achievementIconSvg(a){
    if((a.type === 'skill' || a.type === 'skill-pro') && a.category){
      const cat = SKILL_CATS.find(c => c.key === a.category);
      if(cat) return cat.icon;
    }
    return '<svg viewBox="0 0 24 24" fill="none" stroke="#0b1f1e" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>';
  }
  function achievementBadgeHtml(a){
    const d = new Date(a.ts);
    const dateStr = d.toLocaleDateString('ar', {day:'numeric', month:'short', year:'numeric'});
    return `
    <div class="ach-badge">
      <div class="ach-shield-wrap">
        ${achievementShieldSvg()}
        <div class="ach-shield-icon">${achievementIconSvg(a)}</div>
      </div>
      <div class="ach-badge-name">${a.type === 'skill-pro' ? `احتراف "${escapeHtml(a.skillName)}"` : a.type === 'skill' ? `أتقن "${escapeHtml(a.skillName)}"` : a.type === 'project' ? `إتمام "${escapeHtml(a.projectName)}"` : `تغلَّبَ على ${escapeHtml(a.syndromeName)}`}</div>
      <div class="ach-badge-date">${dateStr}</div>
    </div>`;
  }
  function renderAchievements(){
    const el = document.getElementById('achievements-grid');
    if(!el || !state) return;
    ensureAchievements();
    if(!state.achievements.length){
      el.innerHTML = '<div class="ach-empty">لا توجد إنجازات بعد — أكمل تحدي 90 يوم في متلازمة عشان تفتح أول درع.</div>';
      return;
    }
    const sorted = [...state.achievements].sort((a,b) => b.ts - a.ts);
    el.innerHTML = `<div class="ach-grid">${sorted.map(achievementBadgeHtml).join('')}</div>`;
  }

  const achievementsOverlay = document.getElementById('achievements-overlay');
  document.getElementById('open-achievements-btn').addEventListener('click', () => {
    renderAchievements();
    achievementsOverlay.classList.add('show');
  });
  document.getElementById('close-achievements-btn').addEventListener('click', () => {
    achievementsOverlay.classList.remove('show');
  });
  achievementsOverlay.addEventListener('click', (e) => {
    if(e.target === achievementsOverlay) achievementsOverlay.classList.remove('show');
  });

  // ---------- completed-task history ----------
  const taskHistoryOverlay = document.getElementById('task-history-overlay');
  const taskHistoryList = document.getElementById('task-history-list');
  function renderTaskHistory(){
    ensureTaskLog();
    const items = [...state.taskLog].sort((a,b) => b.ts - a.ts);
    if(!items.length){
      taskHistoryList.innerHTML = '<div class="log-empty">لا توجد مهام منجزة بعد.</div>';
      return;
    }
    taskHistoryList.innerHTML = `<div class="history-count">${items.length} / 50 مهمة محفوظة في السجل</div>` + items.map(item => {
      const d = new Date(item.ts);
      const timeStr = d.toLocaleDateString('ar', {day:'numeric', month:'short'}) + ' · ' + d.toLocaleTimeString('ar', {hour:'2-digit', minute:'2-digit'});
      const special = item.diffKey === 'pivot';
      const chip = special ? ICON_BOLT : (item.xp >= 0 ? '+'+item.xp : '−'+Math.abs(item.xp));
      const chipColor = special ? '#bdf0ea' : (item.xp >= 0 ? '#7fd8d3' : '#d97757');
      const chipBorder = special ? 'rgba(189,240,234,0.4)' : (item.xp >= 0 ? 'rgba(127,216,211,0.3)' : 'rgba(226,96,79,0.4)');
      return `<div class="log-item">
        <div class="left">
          <div class="diff-chip" style="color:${chipColor}; border:1px solid ${chipBorder};">${chip}</div>
          <div class="info"><div class="t">${escapeHtml(item.name)}</div><div class="d">${escapeHtml((item.trackName ? item.trackName + ' · ' : '') + (item.desc || item.diffName || ''))}</div></div>
        </div>
        <div class="meta"><div class="xp" style="${item.xp < 0 ? 'color:#d97757' : ''}">${item.xp >= 0 ? '+' : '−'}${Math.abs(item.xp)} XP</div><div class="time">${timeStr}</div></div>
      </div>`;
    }).join('');
  }
  document.getElementById('open-task-history-btn').addEventListener('click', () => {
    renderTaskHistory();
    taskHistoryOverlay.classList.add('show');
  });
  document.getElementById('close-task-history-btn').addEventListener('click', () => taskHistoryOverlay.classList.remove('show'));
  taskHistoryOverlay.addEventListener('click', (e) => { if(e.target === taskHistoryOverlay) taskHistoryOverlay.classList.remove('show'); });


  // ---------- ربط الأحداث القادمة من core.js (event bus بدل الاستدعاء المباشر) ----------
  document.addEventListener('app:render', renderProfilePage);
  document.addEventListener('app:record-task', (e) => recordTask(e.detail));
