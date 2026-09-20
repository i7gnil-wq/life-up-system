// =============================================================
// progress.js — صفحة «التقدّم والإحصاء» (progress) + شاشات
// المهارات والمتلازمات والمشاريع (تُفتح من هذه الصفحة)
// يشارك النطاق العام (global scope) مع core.js — حمّله بعده مباشرة
// =============================================================
//
// [يعتمد على أشياء معرّفة في core.js]:
//   state, escapeHtml, saveState, render, applyMainPage, dashboardView,
//   showCelebration, ensureSkills, ensureSyndromes, ensureProjects,
//   ensureAchievements, SKILL_CATS, SKILL_STAGES, SYN_STAGES,
//   PROJECT_LEVELS, PROJECT_CHART_COLORS, expandedProjectSteps
// [يعتمد على أشياء معرّفة في profile.js]:
//   recordTask, removeTaskLogById, shieldMiniIcon
//
// [هذا الملف يوفّر للملفات الأخرى]:
//   renderProgressPage()  → مسجّلة على حدث 'app:render' (يُطلقه core.js)
//   skillCatName()        → قد تُستخدم من ملفات أخرى لعرض اسم تصنيف مهارة
//
// ⚠️ لا تُعِد تسمية أو تحذف أي دالة أعلاه بدون التأكد من الملف الآخر.
// =============================================================
  function renderProgressChart(){
    const chartEl = document.getElementById('progress-chart');
    const legendEl = document.getElementById('chart-legend');
    if(!chartEl || !state) return;

    const DAYS = 14;
    const DAY_MS = 86400000;
    const today = new Date(); today.setHours(0,0,0,0);
    const buckets = [];
    for(let i=DAYS-1;i>=0;i--){
      buckets.push({ date:new Date(today.getTime() - i*DAY_MS), xp:0 });
    }
    function dayIndex(ts){
      const d = new Date(ts); d.setHours(0,0,0,0);
      const diffDays = Math.round((today.getTime() - d.getTime())/DAY_MS);
      return DAYS - 1 - diffDays;
    }
    (state.tasks||[]).forEach(t => {
      const idx = dayIndex(t.ts);
      if(idx>=0 && idx<DAYS) buckets[idx].xp += t.xp;
    });
    (state.penalties||[]).forEach(p => {
      const idx = dayIndex(p.ts);
      if(idx>=0 && idx<DAYS) buckets[idx].xp -= p.amount;
    });

    const w=600, h=200, padL=6, padR=6, padT=14, padB=24;
    const values = buckets.map(b => b.xp);
    let maxVal = Math.max(10, ...values);
    let minVal = Math.min(0, ...values);
    if(maxVal === minVal) maxVal = minVal + 10;
    const xStep = (w - padL - padR) / (DAYS - 1);
    const yScale = v => (h - padB) - ((v - minVal)/(maxVal - minVal)) * (h - padT - padB);

    const points = buckets.map((b,i) => ({ x: padL + i*xStep, y: yScale(b.xp) }));
    const linePath = points.map((p,i) => (i===0?'M':'L') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ');
    const baseY = (h - padB).toFixed(1);
    const areaPath = `${linePath} L${points[points.length-1].x.toFixed(1)} ${baseY} L${points[0].x.toFixed(1)} ${baseY} Z`;

    let gridSvg = '';
    for(let g=0; g<=2; g++){
      const gy = padT + g*(h-padT-padB)/2;
      gridSvg += `<line x1="${padL}" y1="${gy.toFixed(1)}" x2="${w-padR}" y2="${gy.toFixed(1)}" stroke="rgba(127,216,211,0.14)" stroke-width="1"/>`;
    }

    const labelEvery = Math.ceil(DAYS/6);
    let labelsSvg = '';
    buckets.forEach((b,i) => {
      if(i % labelEvery === 0 || i === DAYS-1){
        const lbl = b.date.toLocaleDateString('ar', {day:'numeric', month:'short'});
        labelsSvg += `<text x="${points[i].x.toFixed(1)}" y="${h-8}" font-size="8" fill="#7fa0a3" text-anchor="middle">${lbl}</text>`;
      }
    });

    const pointsSvg = points.map((p,i) => {
      const isLast = i === points.length-1;
      return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${isLast?3.5:2}" fill="${isLast?'#7fd8d3':'#2f6b68'}"/>`;
    }).join('');

    chartEl.innerHTML = `
      <defs>
        <linearGradient id="chartFillGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(127,216,211,0.35)"/>
          <stop offset="100%" stop-color="rgba(127,216,211,0)"/>
        </linearGradient>
      </defs>
      ${gridSvg}
      <path d="${areaPath}" fill="url(#chartFillGrad)"/>
      <path d="${linePath}" fill="none" stroke="#7fd8d3" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      ${pointsSvg}
      ${labelsSvg}
    `;

    const weekTotal = buckets.slice(-7).reduce((s,b) => s+b.xp, 0);
    const todayTotal = buckets[buckets.length-1].xp;
    if(legendEl) legendEl.textContent = `اليوم: ${todayTotal} XP  ·  آخر 7 أيام: ${weekTotal} XP`;
  }

  function renderProgressPage(){
    if(!state) return;
    renderProgressChart();

    // skills list
    renderSkills();
    document.getElementById('qn-skills-count').textContent = `${state.skills.length} مهارة`;

    // syndromes
    renderSyndromes();
    document.getElementById('qn-syndromes-count').textContent = `${state.syndromes.length} متلازمة`;

    // projects
    renderProjects();
    renderProjectsChart();
    document.getElementById('qn-projects-count').textContent = `${state.projects.length} مشروع`;

  }

  // ---------- فتح/إغلاق شاشات المهارات والمتلازمات والمشاريع ----------
  const skillsView = document.getElementById('skills-view');
  const syndromesView = document.getElementById('syndromes-view');
  function openSkillsView(){
    dashboardView.style.display = 'none';
    skillsView.style.display = 'block';
    render();
  }
  function closeSkillsView(){
    skillsView.style.display = 'none';
    dashboardView.style.display = 'block';
    applyMainPage(currentMainPage, false, false);
    render();
  }
  function openSyndromesView(){
    dashboardView.style.display = 'none';
    syndromesView.style.display = 'block';
    render();
  }
  function closeSyndromesView(){
    syndromesView.style.display = 'none';
    dashboardView.style.display = 'block';
    applyMainPage(currentMainPage, false, false);
    render();
  }
  const projectsView = document.getElementById('projects-view');
  function openProjectsView(){
    dashboardView.style.display = 'none';
    projectsView.style.display = 'block';
    render();
  }
  function closeProjectsView(){
    projectsView.style.display = 'none';
    dashboardView.style.display = 'block';
    applyMainPage(currentMainPage, false, false);
    render();
  }

  document.getElementById('open-skills-view-btn').addEventListener('click', openSkillsView);
  document.getElementById('skills-back-btn').addEventListener('click', closeSkillsView);
  document.getElementById('open-syndromes-view-btn').addEventListener('click', openSyndromesView);
  document.getElementById('syndromes-back-btn').addEventListener('click', closeSyndromesView);
  document.getElementById('open-projects-view-btn').addEventListener('click', openProjectsView);
  document.getElementById('projects-back-btn').addEventListener('click', closeProjectsView);


  // ---------- skills ----------
  const SKILL_LEVEL_HOURS = 10; // every 10 hours of training = +1 level
  const SKILL_LEVEL_MAX = 100;  // caps at level 100 (1000 hours)
  function skillLevel(s){
    return Math.min(SKILL_LEVEL_MAX, Math.floor((s.hours || 0) / SKILL_LEVEL_HOURS));
  }
  function skillCardHtml(s){
    const catName = skillCatName(s.category);
    const level = skillLevel(s);
    const hoursIntoLevel = level >= SKILL_LEVEL_MAX ? SKILL_LEVEL_HOURS : ((s.hours || 0) % SKILL_LEVEL_HOURS);
    const levelPct = level >= SKILL_LEVEL_MAX ? 100 : Math.min(100, Math.round((hoursIntoLevel / SKILL_LEVEL_HOURS) * 100));
    const stagesHtml = SKILL_STAGES.map(th => {
      const reached = s.hours >= th;
      const lbl = th === 1000 ? 'الاحتراف' : `${th} س`;
      return `<div class="skill-stage ${reached?'reached':''}"><span class="s-dot"></span><span class="s-lbl">${lbl}</span></div>`;
    }).join('');
    return `
    <div class="skill-card" data-skill="${s.id}">
      <div class="skill-top">
        <div>
          <div class="skill-name">${escapeHtml(s.name)}</div>
          <div class="skill-cat">${catName}</div>
        </div>
        <div>
          <div class="skill-hours">${s.hours}<span> ساعة</span></div>
          <div class="skill-level-row">
            <div class="skill-level">Lv ${level}</div>
            <div class="skill-level-bar"><div class="skill-level-fill" style="width:${levelPct}%"></div></div>
          </div>
        </div>
        <button class="skill-del" type="button" data-skill-del="${s.id}" aria-label="حذف المهارة">×</button>
      </div>
      <div class="skill-stages">${stagesHtml}</div>
      <div class="skill-log-row">
        <button class="skill-step" type="button" data-step-dir="down" data-step-target="${s.id}">−</button>
        <input type="number" min="0.5" step="0.5" value="1" class="skill-hours-input" id="hrs-${s.id}">
        <button class="skill-step" type="button" data-step-dir="up" data-step-target="${s.id}">+</button>
        <button class="btn btn-complete" data-log-hours="${s.id}">تسجيل الساعات (250XP)</button>
      </div>
      <div class="skill-log-row">
        <button class="skill-step" type="button" data-step-dir="down" data-step-target="reduce-${s.id}">−</button>
        <input type="number" min="0.5" step="0.5" value="1" class="skill-hours-input" id="hrs-reduce-${s.id}">
        <button class="skill-step" type="button" data-step-dir="up" data-step-target="reduce-${s.id}">+</button>
        <button class="btn btn-reduce-hours" data-reduce-hours="${s.id}">إنقاص الساعات</button>
      </div>
    </div>`;
  }

  function renderSkills(){
    const el = document.getElementById('skills-list');
    if(!el || !state) return;
    ensureSkills();
    el.innerHTML = !state.skills.length
      ? '<div class="log-empty">لا توجد مهارات بعد — أضف مهارتك الأولى.</div>'
      : state.skills.map(skillCardHtml).join('');
  }

  
// ---------- skills ----------
  const skillOverlay = document.getElementById('skill-overlay');
  const skillCatGrid = document.getElementById('skill-cat-grid');
  let selectedSkillCat = null;

  function buildSkillCatGrid(){
    skillCatGrid.innerHTML = SKILL_CATS.map(c => `
      <div class="diff-opt" data-key="${c.key}">
        <div class="name">${c.name}</div>
      </div>`).join('');
    skillCatGrid.querySelectorAll('.diff-opt').forEach(el => {
      el.addEventListener('click', () => {
        skillCatGrid.querySelectorAll('.diff-opt').forEach(o => o.classList.remove('selected'));
        el.classList.add('selected');
        selectedSkillCat = el.dataset.key;
        document.getElementById('skill-cat-err').style.display='none';
      });
    });
  }
  buildSkillCatGrid();

  function openSkillModal(){
    document.getElementById('skill-name').value='';
    selectedSkillCat = null;
    skillCatGrid.querySelectorAll('.diff-opt').forEach(o => o.classList.remove('selected'));
    document.getElementById('skill-name-err').style.display='none';
    document.getElementById('skill-cat-err').style.display='none';
    skillOverlay.classList.add('show');
  }
  function closeSkillModal(){ skillOverlay.classList.remove('show'); }

  document.getElementById('open-skill-btn').addEventListener('click', openSkillModal);
  document.getElementById('cancel-skill-btn').addEventListener('click', closeSkillModal);
  skillOverlay.addEventListener('click', (e) => { if(e.target === skillOverlay) closeSkillModal(); });

  document.getElementById('confirm-skill-btn').addEventListener('click', () => {
    const name = document.getElementById('skill-name').value.trim();
    let ok = true;
    if(!name){ document.getElementById('skill-name-err').style.display='block'; ok=false; }
    if(!selectedSkillCat){ document.getElementById('skill-cat-err').style.display='block'; ok=false; }
    if(!ok) return;

    ensureSkills();
    state.skills.push({
      id: 'sk' + Date.now() + '_' + (taskCounter++),
      name, category: selectedSkillCat, hours: 0, createdTs: Date.now()
    });
    // update the UI immediately — don't make the modal wait on the network/storage save
    render();
    closeSkillModal();
    saveState();
  });

  document.getElementById('skills-list').addEventListener('click', (e) => {
    const delId = e.target.closest('[data-skill-del]');
    if(delId){
      state.skills = (state.skills || []).filter(s => s.id !== delId.dataset.skillDel);
      render();
      saveState();
      return;
    }

    // +/- stepper: just nudges the number input, doesn't touch the total yet
    const stepDir = e.target.dataset.stepDir;
    if(stepDir){
      const input = document.getElementById('hrs-' + e.target.dataset.stepTarget);
      if(!input) return;
      const step = parseFloat(input.step) || 0.5;
      const minVal = parseFloat(input.min) || 0.5;
      let val = parseFloat(input.value) || 0;
      val = stepDir === 'up' ? val + step : val - step;
      val = Math.max(minVal, Math.round(val * 100) / 100);
      input.value = val;
      return;
    }

    const id = e.target.dataset.logHours;
    if(!id) return;
    const input = document.getElementById('hrs-' + id);
    const n = input ? parseFloat(input.value) : NaN;
    if(!n || n <= 0) return;
    const skill = (state.skills || []).find(s => s.id === id);
    if(!skill) return;

    skill.hours = Math.round((skill.hours + n) * 100) / 100;
    if(skill.hours >= 100 && !skill.masteryAwarded){
      skill.masteryAwarded = true;
      ensureAchievements();
      state.achievements.push({
        id: 'ach' + Date.now() + '_' + (taskCounter++),
        type: 'skill',
        skillName: skill.name,
        category: skill.category,
        ts: Date.now()
      });
    }
    if(skill.hours >= 1000 && !skill.proAwarded){
      skill.proAwarded = true;
      ensureAchievements();
      state.achievements.push({
        id: 'ach' + Date.now() + '_' + (taskCounter++),
        type: 'skill-pro',
        skillName: skill.name,
        category: skill.category,
        ts: Date.now()
      });
    }
    const xpGain = Math.round(n * SKILL_HOUR_XP);
    state.xp += xpGain;
    recordTask({
      id: 't' + Date.now() + '_' + (taskCounter++),
      name: `تسجيل ساعات: ${skill.name}`,
      desc: `${n} ساعة · ${skillCatName(skill.category)}`,
      xp: xpGain, diffKey:'skill', diffName:'مهارة', createdTs:Date.now(), ts: Date.now()
    });
    // update the UI immediately — don't make the button wait on the network/storage save
    render();
    saveState();
    showCelebration('ساعات جديدة!', `سجّلت ${n} ساعة في "${skill.name}"`, xpGain);
  });

  document.getElementById('skills-list').addEventListener('click', (e) => {
    const id = e.target.dataset.reduceHours;
    if(!id) return;
    const input = document.getElementById('hrs-reduce-' + id);
    const n = input ? parseFloat(input.value) : NaN;
    if(!n || n <= 0) return;
    const skill = (state.skills || []).find(s => s.id === id);
    if(!skill || skill.hours <= 0) return;

    const removed = Math.min(n, skill.hours);
    skill.hours = Math.round((skill.hours - removed) * 100) / 100;
    // allow achievements to be re-earned if hours drop back below their thresholds
    if(skill.hours < 100) skill.masteryAwarded = false;
    if(skill.hours < 1000) skill.proAwarded = false;

    const xpLoss = Math.round(removed * SKILL_HOUR_XP);
    state.xp = Math.max(0, state.xp - xpLoss);
    recordTask({
      id: 't' + Date.now() + '_' + (taskCounter++),
      name: `إنقاص ساعات: ${skill.name}`,
      desc: `${removed} ساعة · ${skillCatName(skill.category)}`,
      xp: -xpLoss, diffKey:'skill', diffName:'مهارة', createdTs:Date.now(), ts: Date.now()
    });
    render();
    saveState();
  });


  // ---------- syndromes ----------
  function synTaskRowHtml(synId, t){
    return `
    <div class="syn-task-row ${t.done ? 'done' : ''}" data-syn-task="${t.id}">
      <button class="syn-check ${t.done ? 'checked' : ''}" type="button" data-syn-toggle="${t.id}" data-syn-id="${synId}" aria-label="تمّت المهمة"></button>
      <div class="syn-task-name">${escapeHtml(t.name)}</div>
      <button class="syn-del" type="button" data-syn-del="${t.id}" data-syn-id="${synId}" aria-label="حذف">×</button>
    </div>`;
  }

  function synChartSvg(s){
    const hist = s.history.slice(-14);
    if(hist.length < 2){
      return '<div class="log-empty" style="padding:10px 0; font-size:11px;">لسا ما فيه بيانات كافية للمخطط — تحتاج يومين على الأقل.</div>';
    }
    const W=280, H=92, padL=6, padR=6, padT=10, padB=18;
    const values = hist.map(h => h.tasks.filter(t => t.done).length);
    const maxVal = Math.max(1, ...values);
    const xStep = (W - padL - padR) / (hist.length - 1);
    const yScale = v => (H - padB) - (v/maxVal) * (H - padT - padB);
    const points = hist.map((h,i) => ({ x: padL + i*xStep, y: yScale(values[i]) }));
    const linePath = points.map((p,i) => (i===0?'M':'L') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ');
    const dotsSvg = points.map((p,i) => {
      const isLast = i === points.length - 1;
      return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${isLast?3:2}" fill="${isLast?'#7fd8d3':'#2f6b68'}"/>`;
    }).join('');
    return `
    <svg viewBox="0 0 ${W} ${H}" class="syn-chart-svg" preserveAspectRatio="none">
      <path d="${linePath}" fill="none" stroke="#7fd8d3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      ${dotsSvg}
    </svg>
    <div class="syn-chart-caption">آخر يوم: ${values[values.length-1]} مهمة منجزة</div>`;
  }

  function synDayTableHtml(h){
    if(!h.tasks.length) return '<div class="log-empty" style="padding:4px 0; font-size:11px;">لا توجد مهام مسجّلة لهذا اليوم.</div>';
    return h.tasks.map(t => {
      const ok = !!t.done;
      return `<div class="syn-hist-task-row"><span class="sht-name">${escapeHtml(t.name)}</span><span class="sht-tag ${ok?'ok':'fail'}">${ok?'نجاح':'فشل'}</span></div>`;
    }).join('');
  }

  function synHistoryHtml(s){
    const recent = s.history.slice(-6).reverse();
    const daysHtml = !recent.length
      ? '<div class="log-empty">لا يوجد سجل بعد.</div>'
      : recent.map(h => {
        const d = new Date(h.ts);
        const dateStr = d.toLocaleDateString('ar', {day:'numeric', month:'short'});
        const doneCount = h.tasks.filter(t => t.done).length;
        const right = h.relapse
          ? '<span class="relapse-tag">انتكاس</span>'
          : `<span>${doneCount}/${h.tasks.length} منجزة</span>`;
        return `
        <div class="syn-hist-day">
          <div class="syn-hist-row"><span>يوم ${h.day}</span><span>${dateStr}</span>${right}</div>
          <div class="syn-hist-tasks">${synDayTableHtml(h)}</div>
        </div>`;
      }).join('');
    return `
    <div class="syn-chart-wrap">
      <div class="syn-chart-title">إحصائية الإنجاز — عدد المهام المنجزة يوميًا</div>
      ${synChartSvg(s)}
    </div>
    <div class="syn-hist-days">${daysHtml}</div>`;
  }

  function syndromeCardHtml(s){
    const stagesHtml = SYN_STAGES.map(th => {
      const reached = s.day >= th;
      return `<div class="syndrome-stage ${reached?'reached':''}"><span class="s-dot"></span><span class="s-lbl">${th} ي</span></div>`;
    }).join('');
    const tasksHtml = !s.tasks.length
      ? '<div class="log-empty">لا توجد مهام يومية بعد — أضف أول مهمة.</div>'
      : s.tasks.map(t => synTaskRowHtml(s.id, t)).join('');
    const histHtml = s.history.length ? synHistoryHtml(s) : '<div class="log-empty">لا يوجد سجل بعد.</div>';
    const actionsHtml = s.completed
      ? `<div class="syndrome-conquered-tag">${shieldMiniIcon()} تغلَّبَ على ${escapeHtml(s.name)} — تحدي 90 يوم مكتمل</div>`
      : `
      <div class="syn-actions">
        <button class="btn add-task-btn btn-sm" type="button" data-syn-add-task="${s.id}">+ مهمة يومية</button>
        <button class="btn add-task-btn btn-sm" type="button" data-syn-renew="${s.id}" style="background:linear-gradient(90deg, #2f6b68, #16303a);">تجديد اليوم</button>
      </div>`;
    const bottomRowHtml = s.completed
      ? `<div class="syn-bottom-row"><button class="btn syn-log-btn btn-sm" type="button" data-syn-log-toggle="${s.id}">السجل</button></div>`
      : `
      <div class="syn-bottom-row">
        <button class="btn relapse-btn btn-sm" type="button" data-syn-relapse-open="${s.id}">انتكاس</button>
        <button class="btn syn-log-btn btn-sm" type="button" data-syn-log-toggle="${s.id}">السجل</button>
      </div>`;
    return `
    <div class="syndrome-card${s.completed ? ' completed' : ''}" data-syndrome="${s.id}">
      <div class="syndrome-top">
        <div>
          <div class="syndrome-name">${escapeHtml(s.name)}</div>
          <div class="syndrome-relapse-count">${s.relapses || 0} انتكاسة</div>
        </div>
        <div class="syndrome-day-badge">${s.day}<span> / ${SYN_GOAL_DAYS} يوم</span></div>
        <button class="syndrome-del" type="button" data-syndrome-del="${s.id}" aria-label="حذف المتلازمة">×</button>
      </div>

      <div class="syndrome-stages">${stagesHtml}</div>

      ${actionsHtml}

      <div class="syn-tasks-list">${tasksHtml}</div>

      ${bottomRowHtml}

      <div class="syn-history${openSynHistoryIds.has(s.id) ? ' show' : ''}" id="syn-history-${s.id}">${histHtml || '<div class="log-empty">لا يوجد سجل بعد.</div>'}</div>
    </div>`;
  }

  function renderSyndromes(){
    const el = document.getElementById('syndromes-list');
    if(!el || !state) return;
    ensureSyndromes();
    el.innerHTML = !state.syndromes.length
      ? '<div class="log-empty">لا توجد متلازمات بعد — أضف أول متلازمة.</div>'
      : state.syndromes.map(syndromeCardHtml).join('');
  }

  
// ---------- projects ----------
  function projectStepTaskHtml(projectId, stepId, task){
    return `
      <div class="project-step-task ${task.done ? 'done' : ''}">
        <button class="task-check" type="button" data-project-task-toggle="${task.id}" data-project-id="${projectId}" data-project-step-id="${stepId}" aria-label="إتمام المهمة"></button>
        <div class="task-name">${escapeHtml(task.name)}</div>
        <div class="task-xp">+${task.xp} XP</div>
        <button class="project-step-delete" type="button" data-project-task-del="${task.id}" data-project-id="${projectId}" data-project-step-id="${stepId}" aria-label="حذف المهمة">×</button>
      </div>`;
  }

  function projectStepRowHtml(projectId, step, index, steps){
    const prev = index > 0 ? steps[index - 1] : null;
    const unlocked = !prev || prev.done;
    const tasks = Array.isArray(step.tasks) ? step.tasks : [];
    const allTasksDone = tasks.length > 0 && tasks.every(t => t.done);
    const canComplete = tasks.length === 0 || allTasksDone;
    const taskHtml = tasks.length
      ? tasks.map(t => projectStepTaskHtml(projectId, step.id, t)).join('')
      : '<div class="log-empty" style="padding:8px 4px;font-size:11px;">لا توجد مهام لهذه الخطوة بعد.</div>';
    return `
      <div class="project-step ${step.done ? 'done' : ''} ${unlocked ? 'unlocked' : 'locked'} ${expandedProjectSteps.has(step.id) ? 'expanded' : ''}" data-project-step="${step.id}">
        <button class="project-step-xp" type="button" data-project-step-toggle="${step.id}" data-project-id="${projectId}" ${canComplete && unlocked ? '' : 'disabled'} aria-label="${step.done ? 'إلغاء إتمام المحطة' : 'إتمام المحطة'}">+${PROJECT_STEP_XP} XP</button>
        <div class="project-step-content" style="direction:rtl;">
          <div class="project-step-head">
            <div>
              <div class="project-step-name">${escapeHtml(step.text)}</div>
              <div class="project-step-meta">${step.done ? 'تم إتمام المحطة' : (unlocked ? 'المحطة الحالية' : 'مقفلة حتى إتمام المحطة السابقة')}</div>
            </div>
            <button class="project-step-expand-btn" type="button" data-project-step-expand="${step.id}" aria-label="فتح/إغلاق مهام الخطوة">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button class="project-step-delete" type="button" data-project-step-del="${step.id}" data-project-id="${projectId}" aria-label="حذف الخطوة">×</button>
          </div>
          <div class="project-step-tasks">${taskHtml}</div>
          ${!step.done && unlocked ? `<button class="btn btn-ghost project-step-add-task" type="button" data-project-add-task="${projectId}" data-project-step-id="${step.id}">+ إضافة مهمة لهذه الخطوة</button>` : ''}
          ${!unlocked ? '<div class="project-step-lock">ملاحظة: أكمل المحطة السابقة أولًا لإضافة مهام هذه الخطوة.</div>' : ''}
          ${!step.done && unlocked && tasks.length > 0 && !allTasksDone ? '<div class="project-step-lock">أكمل جميع مهام هذه الخطوة لتفعيل محطة الإتمام.</div>' : ''}
        </div>
        <div class="project-step-station" aria-hidden="true"></div>
      </div>`;
  }

  function projectCardHtml(p){
    const stepsHtml = !p.steps.length
      ? '<div class="log-empty">لا توجد خطوات بعد.</div>'
      : p.steps.map((st,i) => projectStepRowHtml(p.id, st, i, p.steps)).join('');
    return `
    <div class="project-card" data-project="${p.id}">
      <div class="project-top">
        <div><div class="project-name">${escapeHtml(p.name)}</div></div>
        <button class="project-del" type="button" data-project-del="${p.id}" aria-label="حذف المشروع">×</button>
      </div>
      ${p.goal ? `<div class="project-goal-box"><span class="g-lbl">الهدف</span>${escapeHtml(p.goal)}</div>` : ''}
      <div class="project-section-title">خط سير المشروع</div>
      <button class="project-add-mini" type="button" data-project-add-step="${p.id}">+ إضافة محطة جديدة</button>
      <div class="project-steps-list">${stepsHtml}</div>
      <button class="btn add-task-btn" type="button" data-project-complete="${p.id}" style="margin-top:14px; background:linear-gradient(90deg, #2f6b68, #16303a);">
        <svg class="icon-inline" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>
        إتمام المشروع
      </button>
    </div>`;
  }

  function renderProjects(){
    const el = document.getElementById('projects-list');
    if(!el || !state) return;
    ensureProjects();
    el.innerHTML = !state.projects.length
      ? '<div class="log-empty">لا توجد مشاريع بعد — أضف أول مشروع.</div>'
      : state.projects.map(projectCardHtml).join('');
  }

  function renderProjectsChart(){
    const chartEl = document.getElementById('projects-chart');
    const legendEl = document.getElementById('projects-chart-legend');
    if(!chartEl || !state) return;
    ensureProjects();

    const projects = state.projects;
    if(!projects.length){
      chartEl.innerHTML = '';
      legendEl.innerHTML = '<div class="log-empty">أضف مشروعًا وابدأ إتمام خطواته ومهامه ليظهر مخطط تقدّمه هنا.</div>';
      return;
    }

    const DAYS = 14;
    const DAY_MS = 86400000;
    const today = new Date(); today.setHours(0,0,0,0);
    function dayIndex(ts){
      const d = new Date(ts); d.setHours(0,0,0,0);
      const diffDays = Math.round((today.getTime() - d.getTime())/DAY_MS);
      return DAYS - 1 - diffDays;
    }

    // per-project: daily XP earned -> then turned into a running cumulative total across the window
    const series = projects.map((p, i) => {
      const daily = new Array(DAYS).fill(0);
      (state.tasks || []).forEach(t => {
        if(t.projectId !== p.id) return;
        const idx = dayIndex(t.ts);
        if(idx >= 0 && idx < DAYS) daily[idx] += t.xp;
      });
      let running = 0;
      const cumulative = daily.map(v => (running += v));
      return { project: p, color: PROJECT_CHART_COLORS[i % PROJECT_CHART_COLORS.length], values: cumulative };
    });

    const w=600, h=200, padL=6, padR=6, padT=14, padB=24;
    const allValues = series.flatMap(s => s.values);
    let maxVal = Math.max(10, ...allValues);
    const xStep = (w - padL - padR) / (DAYS - 1);
    const yScale = v => (h - padB) - (v/maxVal) * (h - padT - padB);

    let gridSvg = '';
    for(let g=0; g<=2; g++){
      const gy = padT + g*(h-padT-padB)/2;
      gridSvg += `<line x1="${padL}" y1="${gy.toFixed(1)}" x2="${w-padR}" y2="${gy.toFixed(1)}" stroke="rgba(127,216,211,0.14)" stroke-width="1"/>`;
    }

    const dateBuckets = [];
    for(let i=DAYS-1;i>=0;i--) dateBuckets.push(new Date(today.getTime() - i*DAY_MS));
    const labelEvery = Math.ceil(DAYS/6);
    let labelsSvg = '';
    dateBuckets.forEach((d,i) => {
      if(i % labelEvery === 0 || i === DAYS-1){
        const x = padL + i*xStep;
        const lbl = d.toLocaleDateString('ar', {day:'numeric', month:'short'});
        labelsSvg += `<text x="${x.toFixed(1)}" y="${h-8}" font-size="8" fill="#7fa0a3" text-anchor="middle">${lbl}</text>`;
      }
    });

    const linesSvg = series.map(s => {
      const points = s.values.map((v,i) => ({ x: padL + i*xStep, y: yScale(v) }));
      const linePath = points.map((p,i) => (i===0?'M':'L') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ');
      const lastPoint = points[points.length-1];
      return `<path d="${linePath}" fill="none" stroke="${s.color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<circle cx="${lastPoint.x.toFixed(1)}" cy="${lastPoint.y.toFixed(1)}" r="3.2" fill="${s.color}"/>`;
    }).join('');

    chartEl.innerHTML = `${gridSvg}${linesSvg}${labelsSvg}`;

    legendEl.innerHTML = series.map(s => `
      <div class="pcl-item">
        <span class="pcl-dot" style="background:${s.color};"></span>
        <span>${escapeHtml(s.project.name)} — ${s.values[s.values.length-1]} XP</span>
      </div>`).join('');
  }

  
// ---------- projects ----------
  const projectOverlay = document.getElementById('project-overlay');
  function openProjectModal(){
    document.getElementById('project-name').value = '';
    document.getElementById('project-goal').value = '';
    document.getElementById('project-name-err').style.display = 'none';
    document.getElementById('project-goal-err').style.display = 'none';
    projectOverlay.classList.add('show');
  }
  function closeProjectModal(){ projectOverlay.classList.remove('show'); }
  document.getElementById('open-project-btn').addEventListener('click', openProjectModal);
  document.getElementById('cancel-project-btn').addEventListener('click', closeProjectModal);
  projectOverlay.addEventListener('click', (e) => { if(e.target === projectOverlay) closeProjectModal(); });

  document.getElementById('confirm-project-btn').addEventListener('click', () => {
    const name = document.getElementById('project-name').value.trim();
    const goal = document.getElementById('project-goal').value.trim();
    let ok = true;
    if(!name){ document.getElementById('project-name-err').style.display = 'block'; ok = false; }
    if(!goal){ document.getElementById('project-goal-err').style.display = 'block'; ok = false; }
    if(!ok) return;

    ensureProjects();
    state.projects.push({
      id: 'pr' + Date.now() + '_' + (taskCounter++),
      name, goal, steps: [], createdTs: Date.now()
    });
    render();
    closeProjectModal();
    saveState();
  });

  // add step modal
  const projectStepOverlay = document.getElementById('project-step-overlay');
  let projectStepTargetId = null;
  function openProjectStepModal(projectId){
    const p = (state.projects || []).find(pp => pp.id === projectId);
    projectStepTargetId = projectId;
    document.getElementById('project-step-target-name').textContent = p ? ' — ' + p.name : '';
    document.getElementById('project-step-text').value = '';
    document.getElementById('project-step-text-err').style.display = 'none';
    projectStepOverlay.classList.add('show');
  }
  function closeProjectStepModal(){ projectStepOverlay.classList.remove('show'); }
  document.getElementById('cancel-project-step-btn').addEventListener('click', closeProjectStepModal);
  projectStepOverlay.addEventListener('click', (e) => { if(e.target === projectStepOverlay) closeProjectStepModal(); });

  document.getElementById('confirm-project-step-btn').addEventListener('click', () => {
    const text = document.getElementById('project-step-text').value.trim();
    if(!text){ document.getElementById('project-step-text-err').style.display = 'block'; return; }
    const p = (state.projects || []).find(pp => pp.id === projectStepTargetId);
    if(!p) return;
    p.steps.push({ id: 'prs' + Date.now() + '_' + (taskCounter++), text, done: false });
    render();
    closeProjectStepModal();
    saveState();
  });

  // add task to a specific project step
  const projectTaskOverlay = document.getElementById('project-task-overlay');
  const projectTaskLevelGrid = document.getElementById('project-task-level-grid');
  let projectTaskTargetId = null;
  let projectTaskTargetStepId = null;
  let selectedProjectLevel = null;

  function buildProjectTaskLevelGrid(){
    projectTaskLevelGrid.innerHTML = PROJECT_LEVELS.map(l => `
      <div class="diff-opt" data-key="${l.key}">
        <div class="name">${l.name}</div>
        <div class="xp">${l.xp} XP</div>
      </div>`).join('');
    projectTaskLevelGrid.querySelectorAll('.diff-opt').forEach(el => {
      el.addEventListener('click', () => {
        projectTaskLevelGrid.querySelectorAll('.diff-opt').forEach(o => o.classList.remove('selected'));
        el.classList.add('selected');
        selectedProjectLevel = el.dataset.key;
        document.getElementById('project-task-level-err').style.display = 'none';
      });
    });
  }
  buildProjectTaskLevelGrid();

  function openProjectTaskModal(projectId, stepId){
    const p = (state.projects || []).find(pp => pp.id === projectId);
    const stepIndex = p ? p.steps.findIndex(s => s.id === stepId) : -1;
    if(!p || stepIndex < 0) return;
    if(stepIndex > 0 && !p.steps[stepIndex - 1].done) return;
    const step = p.steps[stepIndex];
    if(step.done) return;
    projectTaskTargetId = projectId;
    projectTaskTargetStepId = stepId;
    selectedProjectLevel = null;
    projectTaskLevelGrid.querySelectorAll('.diff-opt').forEach(o => o.classList.remove('selected'));
    document.getElementById('project-task-target-name').textContent = ` — ${p.name} · ${step.text}`;
    document.getElementById('project-task-name').value = '';
    document.getElementById('project-task-name-err').style.display = 'none';
    document.getElementById('project-task-level-err').style.display = 'none';
    projectTaskOverlay.classList.add('show');
  }
  function closeProjectTaskModal(){ projectTaskOverlay.classList.remove('show'); projectTaskTargetId = null; projectTaskTargetStepId = null; }
  document.getElementById('cancel-project-task-btn').addEventListener('click', closeProjectTaskModal);
  projectTaskOverlay.addEventListener('click', (e) => { if(e.target === projectTaskOverlay) closeProjectTaskModal(); });

  document.getElementById('confirm-project-task-btn').addEventListener('click', () => {
    const name = document.getElementById('project-task-name').value.trim();
    let ok = true;
    if(!name){ document.getElementById('project-task-name-err').style.display = 'block'; ok = false; }
    if(!selectedProjectLevel){ document.getElementById('project-task-level-err').style.display = 'block'; ok = false; }
    if(!ok) return;
    const p = (state.projects || []).find(pp => pp.id === projectTaskTargetId);
    const step = p && p.steps.find(s => s.id === projectTaskTargetStepId);
    const stepIndex = p ? p.steps.findIndex(s => s.id === projectTaskTargetStepId) : -1;
    if(!p || !step || step.done || (stepIndex > 0 && !p.steps[stepIndex - 1].done)) return;
    const lvl = PROJECT_LEVELS.find(l => l.key === selectedProjectLevel);
    if(!Array.isArray(step.tasks)) step.tasks = [];
    step.tasks.push({ id:'prt' + Date.now() + '_' + (taskCounter++), name, xp:lvl.xp, levelName:lvl.name, level:lvl.key, done:false, createdTs:Date.now() });
    render();
    closeProjectTaskModal();
    saveState();
  });

  const projectCompleteOverlay = document.getElementById('project-complete-overlay');
  let projectCompleteTargetId = null;
  function closeProjectCompleteModal(){ projectCompleteOverlay.classList.remove('show'); projectCompleteTargetId = null; }
  document.getElementById('cancel-project-complete-btn').addEventListener('click', closeProjectCompleteModal);
  projectCompleteOverlay.addEventListener('click', (e) => { if(e.target === projectCompleteOverlay) closeProjectCompleteModal(); });
  document.getElementById('confirm-project-complete-btn').addEventListener('click', () => {
    if(!projectCompleteTargetId) return;
    const p = (state.projects || []).find(pp => pp.id === projectCompleteTargetId);
    if(!p) return;
    state.projects = state.projects.filter(pp => pp.id !== projectCompleteTargetId);
    ensureAchievements();
    state.achievements.push({
      id: 'ach' + Date.now(),
      type: 'project',
      projectName: p.name,
      ts: Date.now()
    });
    render();
    closeProjectCompleteModal();
    saveState();
  });

  document.getElementById('projects-list').addEventListener('click', (e) => {
    const delProjectBtn = e.target.closest('[data-project-del]');
    if(delProjectBtn){
      state.projects = (state.projects || []).filter(p => p.id !== delProjectBtn.dataset.projectDel);
      render();
      saveState();
      return;
    }

    const completeProjectBtn = e.target.closest('[data-project-complete]');
    if(completeProjectBtn){
      const p = (state.projects || []).find(pp => pp.id === completeProjectBtn.dataset.projectComplete);
      if(!p) return;
      projectCompleteTargetId = p.id;
      document.getElementById('project-complete-target-name').textContent = p.name;
      document.getElementById('project-complete-target-name-2').textContent = p.name;
      projectCompleteOverlay.classList.add('show');
      return;
    }

    const addStepBtn = e.target.closest('[data-project-add-step]');
    if(addStepBtn){
      openProjectStepModal(addStepBtn.dataset.projectAddStep);
      return;
    }

    const expandStepBtn = e.target.closest('[data-project-step-expand]');
    if(expandStepBtn){
      const stepId = expandStepBtn.dataset.projectStepExpand;
      if(expandedProjectSteps.has(stepId)) expandedProjectSteps.delete(stepId);
      else expandedProjectSteps.add(stepId);
      render();
      return;
    }

    const addTaskBtn = e.target.closest('[data-project-add-task]');
    if(addTaskBtn && !addTaskBtn.disabled){
      openProjectTaskModal(addTaskBtn.dataset.projectAddTask, addTaskBtn.dataset.projectStepId);
      return;
    }

    const toggleTaskBtn = e.target.closest('[data-project-task-toggle]');
    if(toggleTaskBtn){
      const p = (state.projects || []).find(pp => pp.id === toggleTaskBtn.dataset.projectId);
      const step = p && p.steps.find(s => s.id === toggleTaskBtn.dataset.projectStepId);
      const task = step && step.tasks.find(t => t.id === toggleTaskBtn.dataset.projectTaskToggle);
      if(!p || !step || !task || step.done) return;
      task.done = !task.done;
      if(task.done){
        state.xp += task.xp;
        recordTask({
          id:'t' + Date.now() + '_' + (taskCounter++), name:task.name,
          desc:`${task.levelName} · خطوة: ${step.text} · مشروع: ${p.name}`,
          xp:task.xp, diffKey:'project-task', diffName:'مهمة مشروع', projectId:p.id, projectStepId:step.id, createdTs:Date.now(), ts:Date.now()
        });
      } else {
        state.xp = Math.max(0, state.xp - task.xp);
        const logs = state.tasks || [];
        const log = [...logs].reverse().find(t => t.name === task.name && t.projectId === p.id && t.projectStepId === step.id && t.diffKey === 'project-task');
        if(log){ state.tasks = logs.filter(t => t !== log); removeTaskLogById(log.id); }
      }
      render();
      saveState();
      return;
    }

    const delTaskBtn = e.target.closest('[data-project-task-del]');
    if(delTaskBtn){
      const p = (state.projects || []).find(pp => pp.id === delTaskBtn.dataset.projectId);
      const step = p && p.steps.find(s => s.id === delTaskBtn.dataset.projectStepId);
      if(!p || !step) return;
      const task = step.tasks.find(t => t.id === delTaskBtn.dataset.projectTaskDel);
      if(task && task.done) state.xp = Math.max(0, state.xp - task.xp);
      step.tasks = step.tasks.filter(t => t.id !== delTaskBtn.dataset.projectTaskDel);
      render();
      saveState();
      return;
    }

    const toggleStepBtn = e.target.closest('[data-project-step-toggle]');
    if(toggleStepBtn){
      const p = (state.projects || []).find(pp => pp.id === toggleStepBtn.dataset.projectId);
      const idx = p ? p.steps.findIndex(s => s.id === toggleStepBtn.dataset.projectStepToggle) : -1;
      const st = idx >= 0 ? p.steps[idx] : null;
      if(!p || !st) return;
      if(idx > 0 && !p.steps[idx - 1].done) return;
      const tasks = Array.isArray(st.tasks) ? st.tasks : [];
      if(!st.done && tasks.length && !tasks.every(t => t.done)) return;
      st.done = !st.done;
      if(st.done){
        state.xp += PROJECT_STEP_XP;
        const logId = 'pst' + Date.now() + '_' + (taskCounter++);
        recordTask({id:logId,name:st.text,desc:`خطوة مشروع: ${p.name}`,xp:PROJECT_STEP_XP,diffKey:'project-step',diffName:'خطوة مشروع',projectId:p.id,projectStepId:st.id,createdTs:Date.now(),ts:Date.now()});
        st.logId = logId;
      } else if(st.logId){
        state.xp = Math.max(0, state.xp - PROJECT_STEP_XP);
        state.tasks = state.tasks.filter(t => t.id !== st.logId);
        removeTaskLogById(st.logId);
        delete st.logId;
      }
      render();
      saveState();
      return;
    }

    const delStepBtn = e.target.closest('[data-project-step-del]');
    if(delStepBtn){
      const p = (state.projects || []).find(pp => pp.id === delStepBtn.dataset.projectId);
      if(!p) return;
      const idx = p.steps.findIndex(s => s.id === delStepBtn.dataset.projectStepDel);
      if(idx === -1) return;
      const removed = p.steps[idx];
      if(removed.done){
        state.xp = Math.max(0, state.xp - PROJECT_STEP_XP);
        if(removed.logId){ state.tasks = state.tasks.filter(t => t.id !== removed.logId); removeTaskLogById(removed.logId); }
      }
      (removed.tasks || []).forEach(t => { if(t.done) state.xp = Math.max(0, state.xp - t.xp); });
      p.steps.splice(idx,1);
      render();
      saveState();
      return;
    }

  });

  
// ---------- syndromes ----------
  const syndromeOverlay = document.getElementById('syndrome-overlay');
  function openSyndromeModal(){
    document.getElementById('syndrome-name').value = '';
    document.getElementById('syndrome-name-err').style.display = 'none';
    syndromeOverlay.classList.add('show');
  }
  function closeSyndromeModal(){ syndromeOverlay.classList.remove('show'); }

  document.getElementById('open-syndrome-btn').addEventListener('click', openSyndromeModal);
  document.getElementById('cancel-syndrome-btn').addEventListener('click', closeSyndromeModal);
  syndromeOverlay.addEventListener('click', (e) => { if(e.target === syndromeOverlay) closeSyndromeModal(); });

  document.getElementById('confirm-syndrome-btn').addEventListener('click', () => {
    const name = document.getElementById('syndrome-name').value.trim();
    if(!name){ document.getElementById('syndrome-name-err').style.display = 'block'; return; }

    ensureSyndromes();
    state.syndromes.push({
      id: 'syn' + Date.now() + '_' + (taskCounter++),
      name, day: 0, tasks: [], history: [], relapses: 0
    });
    render();
    closeSyndromeModal();
    saveState();
  });

  const synTaskOverlay = document.getElementById('syn-task-overlay');
  let synTaskTargetId = null;
  function openSynTaskModal(synId){
    ensureSyndromes();
    const syn = state.syndromes.find(s => s.id === synId);
    synTaskTargetId = synId;
    document.getElementById('syn-task-target-name').textContent = syn ? ' — ' + syn.name : '';
    document.getElementById('syn-task-name').value = '';
    document.getElementById('syn-task-name-err').style.display = 'none';
    synTaskOverlay.classList.add('show');
  }
  function closeSynTaskModal(){ synTaskOverlay.classList.remove('show'); synTaskTargetId = null; }

  document.getElementById('cancel-syn-task-btn').addEventListener('click', closeSynTaskModal);
  synTaskOverlay.addEventListener('click', (e) => { if(e.target === synTaskOverlay) closeSynTaskModal(); });

  document.getElementById('confirm-syn-task-btn').addEventListener('click', () => {
    const name = document.getElementById('syn-task-name').value.trim();
    if(!name){ document.getElementById('syn-task-name-err').style.display = 'block'; return; }
    if(!synTaskTargetId) return;

    ensureSyndromes();
    const syn = state.syndromes.find(s => s.id === synTaskTargetId);
    if(!syn) return;
    syn.tasks.push({
      id: 'synt' + Date.now() + '_' + (taskCounter++),
      name, done: false
    });
    render();
    closeSynTaskModal();
    saveState();
  });

  const relapseOverlay = document.getElementById('relapse-overlay');
  const RELAPSE_PENALTY = 500;
  let relapseTargetId = null;
  const openSynHistoryIds = new Set();

  document.getElementById('cancel-relapse-btn').addEventListener('click', () => {
    relapseOverlay.classList.remove('show'); relapseTargetId = null;
  });
  relapseOverlay.addEventListener('click', (e) => {
    if(e.target === relapseOverlay){ relapseOverlay.classList.remove('show'); relapseTargetId = null; }
  });

  document.getElementById('confirm-relapse-btn').addEventListener('click', () => {
    if(!relapseTargetId) return;
    ensureSyndromes();
    const syn = state.syndromes.find(s => s.id === relapseTargetId);
    if(!syn) return;

    syn.history.push({
      day: syn.day,
      ts: Date.now(),
      tasks: syn.tasks.map(t => ({ name: t.name, done: t.done })),
      relapse: true
    });
    syn.day = 0;
    syn.relapses = (syn.relapses || 0) + 1;
    syn.tasks.forEach(t => { t.done = false; });

    if(!state.penalties) state.penalties = [];
    state.penalties.push({ name: 'انتكاس: ' + syn.name, amount: RELAPSE_PENALTY, reason: 'تصفير تحدي ' + syn.name, ts: Date.now() });
    state.xp = Math.max(0, state.xp - RELAPSE_PENALTY);

    render();
    relapseOverlay.classList.remove('show');
    relapseTargetId = null;
    saveState();
  });

  // delegated clicks across all syndrome cards (add-task / renew / relapse-open / delete syndrome / toggle+delete daily task)
  document.getElementById('syndromes-list').addEventListener('click', (e) => {
    ensureSyndromes();

    const addTaskBtn = e.target.closest('[data-syn-add-task]');
    if(addTaskBtn){ openSynTaskModal(addTaskBtn.dataset.synAddTask); return; }

    const renewBtn = e.target.closest('[data-syn-renew]');
    if(renewBtn){
      const syn = state.syndromes.find(s => s.id === renewBtn.dataset.synRenew);
      if(!syn || syn.completed) return;
      syn.history.push({
        day: syn.day,
        ts: Date.now(),
        tasks: syn.tasks.map(t => ({ name: t.name, done: t.done }))
      });
      syn.day += 1;
      syn.tasks.forEach(t => { t.done = false; }); // fresh checklist for the new day
      state.xp += SYN_DAY_XP; // every clean day survived earns XP
      if(syn.day >= SYN_GOAL_DAYS){
        syn.day = SYN_GOAL_DAYS;
        syn.completed = true;
        ensureAchievements();
        state.achievements.push({
          id: 'ach' + Date.now(),
          syndromeName: syn.name,
          ts: Date.now()
        });
      }
      render();
      saveState();
      return;
    }

    const relapseBtn = e.target.closest('[data-syn-relapse-open]');
    if(relapseBtn){
      const syn = state.syndromes.find(s => s.id === relapseBtn.dataset.synRelapseOpen);
      if(!syn || syn.completed) return;
      relapseTargetId = relapseBtn.dataset.synRelapseOpen;
      document.getElementById('relapse-target-name').textContent = syn ? syn.name : '';
      relapseOverlay.classList.add('show');
      return;
    }

    const delSynBtn = e.target.closest('[data-syndrome-del]');
    if(delSynBtn){
      state.syndromes = state.syndromes.filter(s => s.id !== delSynBtn.dataset.syndromeDel);
      render();
      saveState();
      return;
    }

    const logToggleBtn = e.target.closest('[data-syn-log-toggle]');
    if(logToggleBtn){
      const synId = logToggleBtn.dataset.synLogToggle;
      if(openSynHistoryIds.has(synId)) openSynHistoryIds.delete(synId);
      else openSynHistoryIds.add(synId);
      render();
      return;
    }

    const toggleId = e.target.dataset.synToggle;
    if(toggleId){
      const syn = state.syndromes.find(s => s.id === e.target.dataset.synId);
      const t = syn && syn.tasks.find(t => t.id === toggleId);
      if(!t) return;
      t.done = !t.done;
      render();
      saveState();
      return;
    }

    const delId = e.target.dataset.synDel;
    if(delId){
      const syn = state.syndromes.find(s => s.id === e.target.dataset.synId);
      if(!syn) return;
      syn.tasks = syn.tasks.filter(t => t.id !== delId);
      render();
      saveState();
      return;
    }
  });


  // ---------- ربط الأحداث القادمة من core.js (event bus بدل الاستدعاء المباشر) ----------
  document.addEventListener('app:render', renderProgressPage);
