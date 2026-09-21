// =============================================================
// core.js — المحرّك المشترك (الحالة، الحفظ، الدخول، التنقّل،
// لوحة التحكّم الرئيسية) + الدوال العامة التي تستخدمها بقية الملفات
// حمّله أولًا في index.html، قبل الملفين الآخرين
// =============================================================
//
// [core.js لا يستدعي أي دالة من ملفات الصفحات بالاسم إطلاقًا —]
// [يتواصل معها فقط عبر أحداث (CustomEvent) على document]:
//   'app:render'       → يُطلق بعد أي تغيير بالحالة، كل صفحة تستمع له وترندر نفسها
//   'app:record-task'  → يُطلق عند إنجاز مهمة رئيسية، profile.js يستمع له
//   'app:open-habits'  → يُطلق عند طلب فتح شاشة العادات، tasks.js يستمع له
// ✅ هذا يعني: core.js ملف مستقل بالكامل — عدّل عليه لحاله بدون قلق.
// [هذا الملف يوفّر لكل الملفات الأخرى]:
//   state, escapeHtml, saveState, render, applyMainPage, dashboardView,
//   showCelebration, mainDayKey, fillTaskModal, resetTaskModal,
//   RANK_TIERS, TRACKS, SKILL_CATS, SKILL_STAGES, SYN_STAGES,
//   PROJECT_LEVELS, PROJECT_CHART_COLORS, insigniaSvg, formatXp,
//   getLevelData, tierXpRange, getTrackXP, computeStreak,
//   ensureStreakDays, markStreakToday, ensureMainTasks, ensureTaskListMode,
//   cleanupCompletedPending, dailyTaskMax, ensureHabits, ensureSkills,
//   ensureSyndromes, ensureProjects, ensureAchievements
//
// ⚠️ هذا الملف هو الأساس اللي تعتمد عليه الملفات الثلاثة الأخرى، لكنه هو
// نفسه لا يعتمد على أي منها. عدّل عليه براحتك دون فتح ملفات ثانية —
// فقط لا تغيّر أسماء الأحداث الثلاثة أعلاه أو شكل state بدون مراجعة الصفحات.
// =============================================================
  // =========================================================
  // نظام الاكسبي والمستويات — منحنى تصاعدي حقيقي (RPG curve)
  // كل مستوى يحتاج XP أكبر من الي قبله بالمعادلة:
  //   XP للانتقال من مستوى n إلى n+1  =  35 × n × √n   (مقرّب)
  // يعني كل ما ترتفع، الفرق يكبر بشكل غير خطي — النص الأول من
  // السلّم (المستويات 1–50) يمشي بسرعة نسبية، لكن من 50 لين 100
  // يتطلب مجهود أضعاف مضاعفة، وبعد المستوى 100 يدخل اللاعب
  // مرحلة "أسطورة" اللي ما إلها سقف نهائي.
  // =========================================================
  const XP_BASE = 35;
  const XP_GROWTH = 1.5;
  const RANK_TIERS = [
    { key:'sld', name:'مجنّد'  },
    { key:'lt',  name:'ملازم'  },
    { key:'cpt', name:'نقيب'   },
    { key:'maj', name:'رائد'   },
    { key:'ltc', name:'مقدَّم'  },
    { key:'col', name:'عقيد'   },
    { key:'brg', name:'عميد'   },
    { key:'mgn', name:'لواء'   },
    { key:'ltg', name:'فريق'   },
    { key:'min', name:'وزير'   },
  ];
  const LEVELS_PER_TIER = 10;                                  // كل رتبة = 10 مستويات
  const MAX_TIER_LEVEL = RANK_TIERS.length * LEVELS_PER_TIER;  // = 100 (نهاية "وزير")

  // عتبات XP التراكمية — تُبنى تدريجيًا وتُمدَّد تلقائيًا كل ما احتجنا مستوى أعلى.
  // LEVEL_THRESHOLDS[n] = مجموع XP اللازم لبلوغ المستوى (n+1) بدءًا من صفر.
  const LEVEL_THRESHOLDS = [0];
  function xpToClimb(n){ return Math.round(XP_BASE * Math.pow(n, XP_GROWTH)); }
  function ensureLevelThresholds(targetIndex){
    while(LEVEL_THRESHOLDS.length <= targetIndex){
      const n = LEVEL_THRESHOLDS.length;
      LEVEL_THRESHOLDS.push(LEVEL_THRESHOLDS[n-1] + xpToClimb(n));
    }
  }
  function levelFromXp(xp){
    let n = 0;
    ensureLevelThresholds(n+1);
    while(LEVEL_THRESHOLDS[n+1] <= xp){
      n++;
      ensureLevelThresholds(n+1);
    }
    return n+1;
  }
  function rankForLevel(level){
    if(level <= MAX_TIER_LEVEL){
      const idx = Math.min(RANK_TIERS.length-1, Math.floor((level-1)/LEVELS_PER_TIER));
      return { name:RANK_TIERS[idx].name, stars:idx+1, legendary:false, tierIndex:idx };
    }
    const legendTier = Math.floor((level - MAX_TIER_LEVEL - 1)/LEVELS_PER_TIER) + 1;
    return { name:`أسطورة #${legendTier}`, stars:10, legendary:true, tierIndex:RANK_TIERS.length - 1 + legendTier };
  }
  // يرجّع كل المعلومات المطلوبة للواجهة دفعة وحدة: المستوى، الرتبة، ونسبة التقدم
  function getLevelData(xp){
    const level = levelFromXp(xp);
    ensureLevelThresholds(level);
    const floorXp = level === 1 ? 0 : LEVEL_THRESHOLDS[level-1];
    const nextXp = LEVEL_THRESHOLDS[level];
    const rank = rankForLevel(level);
    const into = xp - floorXp;
    const span = nextXp - floorXp;
    const pct = Math.max(0, Math.min(100, Math.round((into/span)*100)));
    return { level, rank, floorXp, nextXp, into, span, pct };
  }
  // حدود XP لبداية ونهاية رتبة معيّنة (تُستخدم في سلّم الرُتب)
  function tierXpRange(tierIndex){
    const startLevel = tierIndex*LEVELS_PER_TIER + 1;
    const endLevel = startLevel + LEVELS_PER_TIER - 1;
    ensureLevelThresholds(endLevel);
    return {
      startLevel, endLevel,
      minXp: startLevel === 1 ? 0 : LEVEL_THRESHOLDS[startLevel-1],
      maxXp: LEVEL_THRESHOLDS[endLevel]
    };
  }
  const DIFFS = [
    { key:'lvl1', name:'المستوى الأول',   xp:100  },
    { key:'lvl2', name:'المستوى الثاني',  xp:250  },
    { key:'lvl3', name:'المستوى الثالث',  xp:500  },
    { key:'lvl4', name:'المستوى الرابع',  xp:1000 },
    { key:'lvl5', name:'المستوى الخامس',  xp:2500 },
  ];
  const SPECIAL = { key:'pivot', name:'مِحوَر تغيُّر!', xp:7500 };
  const PENALTIES = [
    { key:'p5',   name:'مخالفة بسيطة',  amount:100  },
    { key:'p10',  name:'تقصير',          amount:250  },
    { key:'p25',  name:'إخلال بمهمة',    amount:500  },
    { key:'p50',  name:'إخلال جسيم',     amount:1000 },
    { key:'p100', name:'انتكاسة كبرى',   amount:2500 },
  ];

  const MAX_QUEUE = 3;
  let state = null; // {name, code, xp, tasks:[], pending:[]}
  let selectedDiff = null;
  let selectedTrack = null;
  const expandedProjectSteps = new Set();
  let selectedPenalty = null;
  let taskModalMode = 'daily';
  let editingTaskId = null;
  let editingHabitId = null;
  let taskCounter = 1;
  let selectedMainSlot = null;
  const MAIN_TASKS = {
    progress:{label:'مهمة تقدُّم',track:'mind',required:true},
    sport:{label:'رياضة',track:'body',required:true},
    skill:{label:'تطوير مهارة',track:'sci',required:true},
    'daily-cost':{label:'التكاليف اليومية',track:'food',required:false}
  };
  const MAIN_XP = 750;

  const ICON_BOLT = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/></svg>';

  const TRACKS = [
    { key:'body',  name:'بدني',   sub:'اللياقة والجسد',
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="9" width="3" height="6" rx="1"/><rect x="17.5" y="9" width="3" height="6" rx="1"/><path d="M6.5 12h11"/><path d="M2 11v2M22 11v2"/></svg>' },
    { key:'food',  name:'غذائي',  sub:'التغذية والطعام',
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9c-.9-1.5-2.6-2-3.8-1.2C6.8 8.6 6 10.3 6 12.2 6 15.6 8.5 19 11 19c.6 0 .9-.3 1.5-.3s.9.3 1.5.3c2.5 0 5-3.4 5-6.8 0-1.9-.8-3.6-2.2-4.4-1.2-.8-2.9-.3-3.8 1.2Z"/><path d="M12 9V6.6c0-1 .8-1.9 1.8-1.9"/></svg>' },
    { key:'mind',  name:'عقلي',   sub:'التفكير والتعلّم',
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4a3 3 0 00-3 3 3 3 0 00-1 5.8A3 3 0 007 18h1a2 2 0 002-2V6a2 2 0 00-1-2Z"/><path d="M15 4a3 3 0 013 3 3 3 0 011 5.8A3 3 0 0117 18h-1a2 2 0 01-2-2V6a2 2 0 011-2Z"/></svg>' },
    { key:'psych', name:'نفسي',   sub:'التوازن الشعوري',
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.4-9.3-9C1.4 8 2.6 5 5.7 5c1.9 0 3.3 1.1 4 2.3.7-1.2 2.1-2.3 4-2.3 3.1 0 4.3 3 3 6-2.3 4.6-9.3 9-9.3 9Z"/><path d="M4.2 12h3l1.5-2.8L11 15l1.3-4 1 1h4.5"/></svg>' },
    { key:'sci',   name:'علمي',   sub:'المعرفة والبحث',
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M10 3v5.5L5.3 17a2 2 0 001.7 3h10a2 2 0 001.7-3L14 8.5V3"/><path d="M8 15h8"/></svg>' },
    { key:'faith', name:'إيماني', sub:'العبادات والتطوع',
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.6"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>' },
    { key:'media',  name:'إعلامي', sub:'المتابعة والمحتوى',
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="13" rx="2"/><path d="M8 3.5 12 6l4-2.5"/><path d="M7 11.5h4v4H7z"/><path d="M14 11.5h3M14 14.5h3"/></svg>' },
    { key:'social', name:'اجتماعي', sub:'العلاقات والتواصل',
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8.5" cy="8" r="3"/><path d="M2.5 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><circle cx="17" cy="8.5" r="2.4"/><path d="M15.7 13.6c2.6.3 4.8 2.3 4.8 5.1"/></svg>' },
  ];

  const SKILL_CATS = [
    { key:'digital', name:'رقمي',
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="#0b1f1e" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="1.6"/><path d="M8 20h8M12 16v4"/></svg>' },
    { key:'health',  name:'صحّي',
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="#0b1f1e" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.4-9.3-9C1.4 8 2.6 5 5.7 5c1.9 0 3.3 1.1 4 2.3.7-1.2 2.1-2.3 4-2.3 3.1 0 4.3 3 3 6-2.3 4.6-9.3 9-9.3 9Z"/></svg>' },
    { key:'growth',  name:'تنموي',
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="#0b1f1e" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 6h6v6"/></svg>' },
    { key:'lit',     name:'أدبي',
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="#0b1f1e" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6.5c-1.6-1.3-4-2-6.5-2v12c2.5 0 4.9.7 6.5 2 1.6-1.3 4-2 6.5-2v-12c-2.5 0-4.9.7-6.5 2Z"/><path d="M12 6.5v12"/></svg>' },
    { key:'fin',     name:'مالي',
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="#0b1f1e" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M9.3 15c0 1.1 1.2 2 2.7 2s2.7-.7 2.7-1.8c0-2.7-5.4-1.3-5.4-4 0-1.1 1.2-1.8 2.7-1.8s2.7.7 2.7 1.6"/></svg>' },
    { key:'edu',     name:'تعليمي',
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="#0b1f1e" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8.5 12 4l10 4.5-10 4.5-10-4.5Z"/><path d="M6 10.7V16c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-5.3"/><path d="M20.5 9v6"/></svg>' },
  ];
  const SKILL_STAGES = [24, 72, 100, 1000];
  const SKILL_HOUR_XP = 250;

  function ensureSkills(){
    if(!state.skills) state.skills = [];
  }

  const SYN_GOAL_DAYS = 90;
  const SYN_DAY_XP = 250; // XP reward for each clean day survived (renewed) in a syndrome
  const SYN_STAGES = [30, 60, 90];
  const PROJECT_LEVELS = [
    { key:'p50',  name:'مستوى 1', xp:50  },
    { key:'p100', name:'مستوى 2', xp:100 },
    { key:'p250', name:'مستوى 3', xp:250 },
  ];
  const PROJECT_MAX_TASKS = 3;
  const PROJECT_STEP_XP = 500; // XP reward for completing each project step
  const PROJECT_CHART_COLORS = ['#7fd8d3', '#bdf0ea', '#3f9c94', '#d97757', '#2f6b68', '#6fdccf', '#4a9d95', '#3f9c94'];
  function ensureAchievements(){
    if(!state.achievements) state.achievements = [];
  }
  function ensureHabits(){
    if(!Array.isArray(state.habits)) state.habits = [];
    state.habits.forEach(h => { if(!Array.isArray(h.subtasks)) h.subtasks=[]; });
  }
  // ---------- streak days (kept independent from tasks so a full account reset never breaks the streak) ----------
  function ensureStreakDays(){
    if(!Array.isArray(state.streakDays)){
      // migrate once from existing task history so nobody's current streak is lost
      state.streakDays = [...new Set((state.tasks || []).map(t => {
        const d = new Date(t.ts); d.setHours(0,0,0,0); return d.getTime();
      }))];
    }
  }
  function markStreakToday(){
    ensureStreakDays();
    const d = new Date(); d.setHours(0,0,0,0);
    const t = d.getTime();
    if(!state.streakDays.includes(t)) state.streakDays.push(t);
  }

  function ensureProjects(){
    if(!state.projects) state.projects = [];
    state.projects.forEach(p => {
      if(!p.steps) p.steps = [];
      if(!p.goal) p.goal = '';
      p.steps.forEach(st => {
        if(!Array.isArray(st.tasks)) st.tasks = [];
        if(typeof st.done !== 'boolean') st.done = false;
      });
      // Migrate old project-level daily tasks into the first step so no saved work is lost.
      if(Array.isArray(p.tasks) && p.tasks.length){
        if(p.steps.length){
          p.steps[0].tasks = [...p.tasks, ...p.steps[0].tasks];
        }
        delete p.tasks;
      }
    });
  }
  function ensureSyndromes(){
    if(!state.syndromes) state.syndromes = [];
    // migrate legacy single-syndrome shape into the new list
    if(state.syndrome){
      const legacy = state.syndrome;
      const hadData = (legacy.tasks && legacy.tasks.length) || (legacy.history && legacy.history.length) || legacy.day;
      if(hadData){
        state.syndromes.push({
          id: 'syn' + Date.now() + '_legacy',
          name: 'متلازمة',
          day: legacy.day || 0,
          tasks: legacy.tasks || [],
          history: legacy.history || [],
          relapses: (legacy.history || []).filter(h => h.relapse).length
        });
      }
      delete state.syndrome;
    }
    state.syndromes.forEach(s => {
      if(!s.tasks) s.tasks = [];
      if(!s.history) s.history = [];
      if(typeof s.day !== 'number') s.day = 0;
      if(typeof s.relapses !== 'number') s.relapses = (s.history || []).filter(h => h.relapse).length;
    });
  }

  function skillCatName(key){
    const c = SKILL_CATS.find(c => c.key === key);
    return c ? c.name : key;
  }

  function starsSvg(count, filledColor){
    let out = '';
    for(let i=0;i<count;i++){
      out += `<svg viewBox="0 0 24 24" fill="${filledColor}"><path d="M12 1l3.09 6.26L22 8.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 13.14 2 8.27l6.91-1.01L12 1z"/></svg>`;
    }
    return out;
  }

  // renders 1-10 stars; beyond 5, wraps onto a second row so it reads as
  // "five over five" instead of one long strip.
  function insigniaSvg(rank, color){
    const count = rank.stars;
    if(count <= 5) return starsSvg(count, color);
    return `<div style="display:flex;flex-direction:column;gap:2px;align-items:flex-end">
      <div style="display:flex;gap:2px">${starsSvg(5, color)}</div>
      <div style="display:flex;gap:2px">${starsSvg(count - 5, color)}</div>
    </div>`;
  }

  // فواصل الآلاف — عشان الأرقام الكبيرة (بعد آلاف الـXP) تنقرأ بسهولة
  function formatXp(n){ return Math.round(n).toLocaleString('en-US'); }

  function code(){
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const seg = () => Array.from({length:4}, ()=>chars[Math.floor(Math.random()*chars.length)]).join('');
    return `OPS-${seg()}-${seg()}`;
  }

  // Storage adapter: stores everything in the browser's localStorage,
  // so all data stays on this device regardless of where the file is opened.
  const storageAdapter = {
    async get(key, shared){
      const raw = localStorage.getItem(key);
      if(raw === null) throw new Error('not found');
      return { key, value: raw, shared };
    },
    async set(key, value, shared){
      localStorage.setItem(key, value);
      return { key, value, shared };
    },
    async delete(key, shared){
      localStorage.removeItem(key);
      return { key, deleted:true, shared };
    }
  };

  function mainDayKey(){
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function ensureMainTasks(){
    if(!Array.isArray(state.mainTasks)) state.mainTasks=[];
    const today=mainDayKey();
    if(state.mainTasksDay!==today){
      state.mainTasks=[];
      state.mainTasksDay=today;
    }
    state.mainTasks=state.mainTasks.filter(t=>MAIN_TASKS[t.slotKey]);
  }
  function requiredMainTasksDone(){
    ensureMainTasks();
    return ['progress','sport','skill'].every(k=>{
      const t=state.mainTasks.find(x=>x.slotKey===k);
      return !!t && !!t.done;
    });
  }
  function ensureTaskListMode(){
    if(!state) return;
    if(state.taskListMode !== 'unlimited') state.taskListMode = 'main';
  }
  function dailyTaskMax(){
    return Infinity;
  }
  // في وضع "بلا حدود" تبقى المهمة المُنجزة ظاهرة (بعلامة صح) داخل القائمة
  // ولا تُحذف تلقائيًا إلا بعد تغيّر اليوم (بعد الساعة 12 ليلًا)
  function cleanupCompletedPending(){
    if(!state || !Array.isArray(state.pending)) return;
    const today = mainDayKey();
    const before = state.pending.length;
    state.pending = state.pending.filter(t => !(t.done && t.doneDayKey && t.doneDayKey !== today));
    return state.pending.length !== before;
  }

  async function saveState(){
    try{
      // safety net: never let a slow/hanging storage call freeze the UI —
      // give up after 4s so callers waiting on this promise always resolve.
      await Promise.race([
        storageAdapter.set('profile:'+state.code, JSON.stringify(state), true),
        new Promise((_, reject) => setTimeout(() => reject(new Error('save timed out')), 4000))
      ]);
    }catch(e){ console.error('save failed', e); }
  }

  // ---------- celebration screen ----------
  const CELEBRATE_COLORS = ['#7fd8d3','#8fe6df','#d3f3ef','#bdf0ea','#2f6b68','#eaf4f3'];
  function spawnConfetti(){
    const wrap = document.getElementById('celebrate-confetti');
    if(!wrap) return;
    wrap.innerHTML = '';
    const count = 46;
    for(let i=0;i<count;i++){
      const s = document.createElement('span');
      const left = Math.random()*100;
      const delay = Math.random()*0.35;
      const duration = 2.2 + Math.random()*1.6;
      const color = CELEBRATE_COLORS[Math.floor(Math.random()*CELEBRATE_COLORS.length)];
      const size = 6 + Math.random()*6;
      s.style.left = left+'%';
      s.style.width = size+'px';
      s.style.height = (size*1.6)+'px';
      s.style.background = color;
      s.style.animationDuration = duration+'s';
      s.style.animationDelay = delay+'s';
      s.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      wrap.appendChild(s);
    }
  }
  function showCelebration(title, sub, xpGain){
    const overlay = document.getElementById('celebrate-overlay');
    if(!overlay) return;
    document.getElementById('celebrate-title').textContent = title || 'إنجاز جديد';
    document.getElementById('celebrate-sub').textContent = sub || '';
    const xpEl = document.getElementById('celebrate-xp');
    if(xpGain){ xpEl.style.display='block'; xpEl.textContent = 'XP ' + xpGain + '+'; }
    else { xpEl.style.display='none'; }
    spawnConfetti();
    overlay.classList.add('show');
  }
  function closeCelebration(){
    const overlay = document.getElementById('celebrate-overlay');
    if(!overlay) return;
    overlay.classList.remove('show');
    const wrap = document.getElementById('celebrate-confetti');
    if(wrap) wrap.innerHTML = '';
  }
  document.getElementById('celebrate-close-btn').addEventListener('click', closeCelebration);
  document.getElementById('celebrate-overlay').addEventListener('click', (e)=>{ if(e.target.id==='celebrate-overlay') closeCelebration(); });

  function computeStreak(dayTimestamps){
    if(!dayTimestamps || !dayTimestamps.length) return 0;
    const days = [...new Set(dayTimestamps)].sort((a,b)=>b-a);
    let streak = 1;
    const DAY = 86400000;
    let today = new Date(); today.setHours(0,0,0,0);
    if(days[0] !== today.getTime() && days[0] !== today.getTime()-DAY) {
      // most recent activity not today or yesterday -> streak broken but show length of most recent run
    }
    for(let i=0;i<days.length-1;i++){
      if(days[i] - days[i+1] === DAY) streak++; else break;
    }
    // if latest day isn't today or yesterday, streak is effectively 0 (broken)
    if(days[0] < today.getTime() - DAY) return 0;
    return streak;
  }

  function getTrackXP(trackKey){
    if(!state) return 0;
    const earned = (state.tasks || []).reduce((sum, task) => {
      return sum + (task.trackKey === trackKey ? (Number(task.xp) || 0) : 0);
    }, 0);
    const deducted = (state.penalties || []).reduce((sum, penalty) => {
      if(penalty.restored || penalty.trackKey !== trackKey) return sum;
      return sum + (Number(penalty.trackDeductedAmount) || 0);
    }, 0);
    return Math.max(0, earned - deducted);
  }

  function render(){
    if(!state) return;
    // كل صفحة تسجّل نفسها على حدث 'app:render' (شوف أسفل كل ملف صفحة) —
    // core.js ما يستدعي أي دالة من ملفات الصفحات مباشرة بالاسم
    document.dispatchEvent(new CustomEvent('app:render'));
  }

  function escapeHtml(s){
    return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // ---------- login flow ----------
  const loginScreen = document.getElementById('login-screen');
  const app = document.getElementById('app');
  const newForm = document.getElementById('new-form');
  const resumeForm = document.getElementById('resume-form');

  document.getElementById('show-resume').addEventListener('click', () => {
    newForm.style.display='none'; resumeForm.style.display='block';
    document.getElementById('login-title').textContent = 'الرجوع لملفك';
    document.getElementById('login-sub').textContent = 'أدخل الرمز الخاص الذي حصلت عليه عند أول تسجيل.';
  });
  document.getElementById('show-new').addEventListener('click', () => {
    resumeForm.style.display='none'; newForm.style.display='block';
    document.getElementById('login-title').textContent = 'تسجيل الدخول';
    document.getElementById('login-sub').textContent = 'اكتب اسمك فقط. النظام يمنحك رمزًا خاصًا تلقائيًا تقدر ترجع فيه لملفك لاحقًا.';
  });

  document.getElementById('start-btn').addEventListener('click', async () => {
    const nameInput = document.getElementById('name-input');
    const name = nameInput.value.trim();
    const err = document.getElementById('name-err');
    if(!name){ err.style.display='block'; return; }
    err.style.display='none';

    const newCode = code();
    state = { name, code:newCode, xp:0, tasks:[], pending:[], mainTasks:[], mainTasksDay:mainDayKey(), taskListMode:'main', penalties:[], skills:[], syndromes:[], achievements:[], habits:[] };
    ensureSkills();
    ensureSyndromes();
    await saveState();

    document.getElementById('code-display').textContent = newCode;
    document.getElementById('code-reveal').classList.add('show');
    document.getElementById('start-btn').textContent = 'الدخول إلى الغرفة';
    document.getElementById('start-btn').onclick = () => enterApp();
  });

  function legacyCopy(text){
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    let ok = false;
    try{ ok = document.execCommand('copy'); }catch(e){ ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function selectCodeTextForManualCopy(){
    const codeEl = document.getElementById('code-display');
    if(window.getSelection && document.createRange){
      const range = document.createRange();
      range.selectNodeContents(codeEl);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  const COPY_ICON_SVG = '<rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" stroke-width="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" stroke="currentColor" stroke-width="2"/>';
  const CHECK_ICON_SVG = '<path d="M4 12.5L9.5 18L20 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>';

  document.getElementById('copy-code-btn').addEventListener('click', async () => {
    const codeText = document.getElementById('code-display').textContent.trim();
    if(!codeText || codeText === '—') return;
    const btn = document.getElementById('copy-code-btn');
    const icon = document.getElementById('copy-code-icon');

    let copied = false;

    if(navigator.clipboard && navigator.clipboard.writeText){
      try{
        await navigator.clipboard.writeText(codeText);
        copied = true;
      }catch(e){ copied = false; }
    }

    if(!copied){
      try{ copied = legacyCopy(codeText); }catch(e){ copied = false; }
    }

    if(copied){
      btn.classList.add('copied');
      btn.title = 'تم النسخ';
      icon.innerHTML = CHECK_ICON_SVG;
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.title = 'نسخ الرمز';
        icon.innerHTML = COPY_ICON_SVG;
      }, 1600);
    }else{
      // آخر حل: نحدد النص تلقائيًا حتى يقدر المستخدم ينسخه بنفسه (اضغط مطولًا واختر نسخ)
      selectCodeTextForManualCopy();
      btn.title = 'حدده وانسخه يدويًا';
      setTimeout(() => { btn.title = 'نسخ الرمز'; }, 2200);
    }
  });

  document.getElementById('resume-btn').addEventListener('click', async () => {
    const codeInput = document.getElementById('code-input');
    const val = codeInput.value.trim().toUpperCase();
    const err = document.getElementById('code-err');
    if(!val){ err.style.display='block'; return; }
    try{
      const res = await storageAdapter.get('profile:'+val, true);
      if(!res || !res.value){ err.style.display='block'; return; }
      state = JSON.parse(res.value);
      if(!state.pending) state.pending = [];
      if(!state.tasks) state.tasks = [];
      if(!state.penalties) state.penalties = [];
      ensureMainTasks();
      state.penalties.forEach(p => {
        if(typeof p.restored !== 'boolean') p.restored = false;
        if(typeof p.deductedAmount !== 'number') p.deductedAmount = p.amount;
        if(typeof p.trackDeductedAmount !== 'number') p.trackDeductedAmount = p.trackKey ? Math.min(p.deductedAmount, getTrackXP(p.trackKey)) : 0;
      });
      ensureSkills();
      ensureSyndromes();
      ensureHabits();
      ensureStreakDays();
      err.style.display='none';
      enterApp();
    }catch(e){
      err.style.display='block';
    }
  });

  function enterApp(){
    loginScreen.style.display='none';
    app.style.display='block';
    document.body.classList.add('app-active');
    render();
  }

  document.getElementById('logout-btn').addEventListener('click', () => {
    location.reload();
  });

  // ---------- settings modal ----------
  const settingsOverlay = document.getElementById('settings-overlay');
  const settingsNameInput = document.getElementById('settings-name-input');
  const settingsSavedTag = document.getElementById('settings-saved-tag');

  function openSettingsModal(){
    settingsNameInput.value = state.name;
    settingsSavedTag.classList.remove('show');
    settingsOverlay.classList.add('show');
  }
  function closeSettingsModal(){ settingsOverlay.classList.remove('show'); }

  document.getElementById('open-settings-btn').addEventListener('click', openSettingsModal);
  document.getElementById('close-settings-btn').addEventListener('click', closeSettingsModal);
  settingsOverlay.addEventListener('click', (e) => { if(e.target === settingsOverlay) closeSettingsModal(); });

  // close the settings sheet whenever one of its actions opens another confirm modal / logs out
  ['logout-btn','reset-account-btn','delete-account-btn'].forEach(id => {
    document.getElementById(id).addEventListener('click', closeSettingsModal);
  });

  document.getElementById('save-settings-name-btn').addEventListener('click', async () => {
    const val = settingsNameInput.value.trim();
    if(!val) return;
    state.name = val;
    render();
    await saveState();
    settingsSavedTag.classList.add('show');
    setTimeout(() => {
      settingsSavedTag.classList.remove('show');
      closeSettingsModal();
      // الرجوع للشاشة الرئيسية بعد الحفظ
      ['habits-view','skills-view','syndromes-view','projects-view'].forEach(id => {
        const v = document.getElementById(id);
        if(v) v.style.display = 'none';
      });
      applyMainPage('profile', true, true);
    }, 700);
  });

  // ---------- avatar photo ----------
  const avatarFileInput = document.getElementById('avatar-file-input');
  document.getElementById('remove-avatar-btn').addEventListener('click', async () => {
    delete state.avatarImage;
    render();
    await saveState();
  });

  // ---------- avatar adjust modal (crop/zoom preview before insert) ----------
  const avatarAdjustOverlay = document.getElementById('avatar-adjust-overlay');
  const avatarCropStage = document.getElementById('avatar-crop-stage');
  const avatarCropImg = document.getElementById('avatar-crop-img');
  const avatarZoomRange = document.getElementById('avatar-zoom-range');
  const avatarRotateRange = document.getElementById('avatar-rotate-range');
  const AVATAR_STAGE_SIZE = 220; // px — matches .avatar-crop-stage width/height, and the output canvas size

  let avatarNatW = 0, avatarNatH = 0, avatarBaseScale = 1, avatarZoom = 1, avatarRotation = 0;
  let avatarOffX = 0, avatarOffY = 0;
  let avatarDragging = false, avatarDragStartX = 0, avatarDragStartY = 0, avatarDragOffX = 0, avatarDragOffY = 0;

  function avatarDisplayDims(){
    const scale = avatarBaseScale * avatarZoom;
    return { w: avatarNatW * scale, h: avatarNatH * scale };
  }
  function clampAvatarOffsets(w, h){
    avatarOffX = Math.min(0, Math.max(AVATAR_STAGE_SIZE - w, avatarOffX));
    avatarOffY = Math.min(0, Math.max(AVATAR_STAGE_SIZE - h, avatarOffY));
  }
  function applyAvatarTransform(){
    const { w, h } = avatarDisplayDims();
    clampAvatarOffsets(w, h);
    avatarCropImg.style.width = w + 'px';
    avatarCropImg.style.height = h + 'px';
    avatarCropImg.style.transform = `translate(${avatarOffX}px, ${avatarOffY}px) rotate(${avatarRotation}deg)`;
  }

  function openAvatarAdjustModal(dataUrl){
    avatarCropImg.src = dataUrl;
    avatarCropImg.onload = () => {
      avatarNatW = avatarCropImg.naturalWidth;
      avatarNatH = avatarCropImg.naturalHeight;
      avatarBaseScale = Math.max(AVATAR_STAGE_SIZE / avatarNatW, AVATAR_STAGE_SIZE / avatarNatH);
      avatarZoom = 1;
      avatarRotation = 0;
      avatarZoomRange.value = 1;
      avatarRotateRange.value = 0;
      const { w, h } = avatarDisplayDims();
      avatarOffX = (AVATAR_STAGE_SIZE - w) / 2;
      avatarOffY = (AVATAR_STAGE_SIZE - h) / 2;
      applyAvatarTransform();
      avatarAdjustOverlay.classList.add('show');
    };
  }
  function closeAvatarAdjustModal(){
    avatarAdjustOverlay.classList.remove('show');
    avatarCropImg.removeAttribute('src');
  }

  avatarFileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => openAvatarAdjustModal(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  avatarCropStage.addEventListener('pointerdown', (e) => {
    avatarDragging = true;
    avatarCropStage.classList.add('dragging');
    avatarDragStartX = e.clientX; avatarDragStartY = e.clientY;
    avatarDragOffX = avatarOffX; avatarDragOffY = avatarOffY;
    avatarCropStage.setPointerCapture(e.pointerId);
  });
  avatarCropStage.addEventListener('pointermove', (e) => {
    if(!avatarDragging) return;
    avatarOffX = avatarDragOffX + (e.clientX - avatarDragStartX);
    avatarOffY = avatarDragOffY + (e.clientY - avatarDragStartY);
    applyAvatarTransform();
  });
  function endAvatarDrag(){ avatarDragging = false; avatarCropStage.classList.remove('dragging'); }
  avatarCropStage.addEventListener('pointerup', endAvatarDrag);
  avatarCropStage.addEventListener('pointercancel', endAvatarDrag);
  avatarCropStage.addEventListener('pointerleave', () => { if(avatarDragging) endAvatarDrag(); });

  avatarZoomRange.addEventListener('input', () => {
    const before = avatarDisplayDims();
    const cx = (AVATAR_STAGE_SIZE / 2 - avatarOffX) / before.w;
    const cy = (AVATAR_STAGE_SIZE / 2 - avatarOffY) / before.h;
    avatarZoom = parseFloat(avatarZoomRange.value);
    const after = avatarDisplayDims();
    avatarOffX = AVATAR_STAGE_SIZE / 2 - cx * after.w;
    avatarOffY = AVATAR_STAGE_SIZE / 2 - cy * after.h;
    applyAvatarTransform();
  });

  avatarRotateRange.addEventListener('input', () => {
    avatarRotation = parseFloat(avatarRotateRange.value);
    applyAvatarTransform();
  });

  document.getElementById('cancel-avatar-adjust-btn').addEventListener('click', closeAvatarAdjustModal);
  avatarAdjustOverlay.addEventListener('click', (e) => { if(e.target === avatarAdjustOverlay) closeAvatarAdjustModal(); });

  document.getElementById('confirm-avatar-adjust-btn').addEventListener('click', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_STAGE_SIZE; canvas.height = AVATAR_STAGE_SIZE;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0a161c';
    ctx.fillRect(0, 0, AVATAR_STAGE_SIZE, AVATAR_STAGE_SIZE);
    const { w, h } = avatarDisplayDims();
    // نفس ترتيب تحويل المعاينة: يدور حول مركز الصورة المعروضة حاليًا ثم لا حاجة لإزاحة إضافية
    ctx.save();
    ctx.translate(avatarOffX + w / 2, avatarOffY + h / 2);
    ctx.rotate(avatarRotation * Math.PI / 180);
    ctx.drawImage(avatarCropImg, -w / 2, -h / 2, w, h);
    ctx.restore();
    state.avatarImage = canvas.toDataURL('image/jpeg', 0.85);
    closeAvatarAdjustModal();
    render();
    await saveState();
  });

  // ---------- modal ----------
  const overlay = document.getElementById('modal-overlay');
  const diffGrid = document.getElementById('diff-grid');
  function buildDiffGrid(){
    diffGrid.innerHTML = DIFFS.map(d => `
      <div class="diff-opt" data-key="${d.key}">
        <div class="name">${d.name}</div>
        <div class="xp">+${d.xp} XP</div>
      </div>`).join('') + `
      <div class="diff-opt special" data-key="${SPECIAL.key}">
        <div class="name" style="display:flex; align-items:center; justify-content:center; gap:5px;">${ICON_BOLT} ${SPECIAL.name}</div>
        <div class="xp">+${SPECIAL.xp} XP</div>
      </div>`;
    diffGrid.querySelectorAll('.diff-opt').forEach(el => {
      el.addEventListener('click', () => {
        diffGrid.querySelectorAll('.diff-opt').forEach(o => o.classList.remove('selected'));
        el.classList.add('selected');
        selectedDiff = el.dataset.key;
        document.getElementById('diff-err').style.display='none';
      });
    });
  }
  buildDiffGrid();

  const trackSelectGrid = document.getElementById('track-select-grid');
  function buildTrackSelectGrid(){
    trackSelectGrid.innerHTML = TRACKS.map(t => `
      <div class="diff-opt" data-key="${t.key}">
        <div class="name">${t.name}</div>
      </div>`).join('');
    trackSelectGrid.querySelectorAll('.diff-opt').forEach(el => {
      el.addEventListener('click', () => {
        trackSelectGrid.querySelectorAll('.diff-opt').forEach(o => o.classList.remove('selected'));
        el.classList.add('selected');
        selectedTrack = el.dataset.key;
        document.getElementById('track-select-err').style.display='none';
      });
    });
  }
  buildTrackSelectGrid();

  function resetTaskModal(){
    document.getElementById('task-name').value='';
    document.getElementById('task-desc').value='';
    ['subtask-1','subtask-2','subtask-3'].forEach(id => document.getElementById(id).value='');
    document.getElementById('subtask-extra-fields').style.display='none';
    document.getElementById('subtask-3').style.display='block';
    document.getElementById('add-subtask-btn').style.display='block';
    document.getElementById('add-subtask-btn').textContent='+ إضافة مهمة فرعية';
    document.getElementById('subtasks-count-label').textContent='0 / 3';
    document.getElementById('subtasks-field-wrap').classList.remove('open');
    selectedDiff=null; selectedTrack=null; selectedMainSlot=null;
    diffGrid.querySelectorAll('.diff-opt').forEach(o=>o.classList.remove('selected'));
    trackSelectGrid.querySelectorAll('.diff-opt').forEach(o=>o.classList.remove('selected'));
    const diffField=diffGrid.closest('.field');
    const trackField=trackSelectGrid.closest('.field');
    if(diffField) diffField.style.display='';
    if(trackField) trackField.style.display='';
    ['task-name-err','diff-err','track-select-err'].forEach(id=>document.getElementById(id).style.display='none');
  }
  function fillTaskModal(task, mode){
    resetTaskModal();
    taskModalMode=mode;
    document.getElementById('task-name').value=task.name||'';
    document.getElementById('task-desc').value=task.desc||'';
    (task.subtasks||[]).slice(0,3).forEach((st,i)=>{document.getElementById('subtask-'+(i+1)).value=st.text||'';});
    if((task.subtasks||[]).length>1){document.getElementById('subtask-extra-fields').style.display='block';}
    if((task.subtasks||[]).length>2){document.getElementById('subtask-3').style.display='block';document.getElementById('add-subtask-btn').style.display='none';}
    if((task.subtasks||[]).length>0){document.getElementById('subtasks-field-wrap').classList.add('open');}
    selectedDiff=task.diffKey||null; selectedTrack=task.trackKey||null;
    if(selectedDiff) diffGrid.querySelector(`[data-key="${selectedDiff}"]`)?.classList.add('selected');
    if(selectedTrack) trackSelectGrid.querySelector(`[data-key="${selectedTrack}"]`)?.classList.add('selected');
    document.querySelector('#modal-overlay h2').textContent = mode==='habit' ? 'إضافة عادة جديدة' : (mode==='editHabit' ? 'تعديل العادة' : (mode==='editTask' ? 'تعديل المهمة' : 'إدراج مهمة جديدة'));
    document.getElementById('confirm-task-btn').textContent = mode==='habit' || mode==='editHabit' ? 'حفظ العادة' : (mode==='editTask' ? 'حفظ التعديل' : 'إضافة إلى القائمة');
    document.getElementById('modal-overlay').classList.add('show');
  }
  function openModal(){ resetTaskModal(); taskModalMode='daily'; editingTaskId=null; editingHabitId=null; document.querySelector('#modal-overlay h2').textContent='إدراج مهمة جديدة'; document.getElementById('confirm-task-btn').textContent='إضافة إلى القائمة'; document.getElementById('modal-overlay').classList.add('show'); }
  function openMainTaskModal(slotKey){
    ensureMainTasks();
    const info=MAIN_TASKS[slotKey];
    if(!info) return;
    if(state.mainTasks.some(t=>t.slotKey===slotKey)) return;
    resetTaskModal();
    taskModalMode='mainTemplate';
    selectedMainSlot=slotKey;
    selectedDiff='lvl3';
    selectedTrack=info.track;
    diffGrid.querySelectorAll('.diff-opt').forEach(o=>o.classList.remove('selected'));
    trackSelectGrid.querySelectorAll('.diff-opt').forEach(o=>o.classList.remove('selected'));
    document.querySelector('#modal-overlay h2').textContent='إدراج مهمة رئيسية — '+info.label;
    document.getElementById('confirm-task-btn').textContent='إضافة المهمة الرئيسية';
    const diffField=diffGrid.closest('.field');
    const trackField=trackSelectGrid.closest('.field');
    if(diffField) diffField.style.display='none';
    if(trackField) trackField.style.display='none';
    document.getElementById('modal-overlay').classList.add('show');
  }
  function openMainTaskEdit(taskId){
    ensureMainTasks();
    const task=state.mainTasks.find(t=>t.id===taskId);
    if(!task || task.done) return;
    resetTaskModal();
    taskModalMode='editMainTask';
    editingTaskId=taskId;
    selectedMainSlot=task.slotKey;
    document.getElementById('task-name').value=task.name||'';
    document.getElementById('task-desc').value=task.desc||'';
    const subs=Array.isArray(task.subtasks)?task.subtasks:[];
    subs.slice(0,3).forEach((st,i)=>{document.getElementById('subtask-'+(i+1)).value=st.text||'';});
    if(subs.length>1) document.getElementById('subtask-extra-fields').style.display='block';
    if(subs.length>2){document.getElementById('subtask-3').style.display='block';document.getElementById('add-subtask-btn').style.display='none';}
    if(subs.length>0){document.getElementById('subtasks-field-wrap').classList.add('open');}
    document.querySelector('#modal-overlay h2').textContent='تعديل المهمة الرئيسية — '+(MAIN_TASKS[task.slotKey]?.label||'');
    document.getElementById('confirm-task-btn').textContent='حفظ التعديل';
    const diffField=diffGrid.closest('.field');
    const trackField=trackSelectGrid.closest('.field');
    if(diffField) diffField.style.display='none';
    if(trackField) trackField.style.display='none';
    document.getElementById('modal-overlay').classList.add('show');
  }
  function closeModal(){ document.getElementById('modal-overlay').classList.remove('show'); }

  document.getElementById('subtasks-toggle-btn').addEventListener('click', () => {
    document.getElementById('subtasks-field-wrap').classList.toggle('open');
  });

  document.getElementById('add-subtask-btn').addEventListener('click', () => {
    const extra=document.getElementById('subtask-extra-fields'), s2=document.getElementById('subtask-2'), s3=document.getElementById('subtask-3');
    if(extra.style.display==='none'){ extra.style.display='block'; s3.style.display='none'; document.getElementById('add-subtask-btn').textContent='+ إضافة المهمة الفرعية الثالثة'; document.getElementById('subtasks-count-label').textContent='1–2 / 3'; s2.focus(); }
    else if(s3.style.display==='none'){ s3.style.display='block'; document.getElementById('add-subtask-btn').style.display='none'; document.getElementById('subtasks-count-label').textContent='حتى 3'; s3.focus(); }
  });

  const openModalBtnEl=document.getElementById('open-modal-btn');
  if(openModalBtnEl) openModalBtnEl.addEventListener('click',()=>openModal());
  document.getElementById('main-task-slots').addEventListener('click', async (e)=>{
    const edit=e.target.closest('[data-main-edit]');
    if(edit){
      e.preventDefault(); e.stopPropagation();
      openMainTaskEdit(edit.dataset.mainEdit);
      return;
    }
    const sub=e.target.closest('[data-main-subtask]');
    if(sub){
      e.preventDefault(); e.stopPropagation();
      ensureMainTasks();
      const task=state.mainTasks.find(t=>t.id===sub.dataset.mainSubtask);
      const i=Number(sub.dataset.mainSubindex);
      if(!task || task.done || !task.subtasks?.[i]) return;
      task.subtasks[i].done=sub.checked;
      await saveState(); render();
      return;
    }
    const complete=e.target.closest('[data-main-complete]');
    if(complete){
      e.preventDefault(); e.stopPropagation();
      ensureMainTasks();
      const task=state.mainTasks.find(t=>t.id===complete.dataset.mainComplete);
      if(!task || task.done) return;
      const hasSub=Array.isArray(task.subtasks) && task.subtasks.length;
      if(hasSub && !task.subtasks.every(st=>st.done)) return;
      task.done=true; task.ts=Date.now();
      // recordTask() نفسها معرّفة في profile.js — نرسل حدث بدل استدعائها بالاسم
      document.dispatchEvent(new CustomEvent('app:record-task', {detail:task}));
      state.xp += MAIN_XP;
      await saveState(); render();
      showCelebration('أنجزت المهمة!', task.name || task.slotLabel || '', MAIN_XP);
      return;
    }
    const slot=e.target.closest('[data-main-slot]');
    if(!slot || !slot.matches('button')) return;
    const key=slot.dataset.mainSlot;
    ensureMainTasks();
    if(state.mainTasks.some(t=>t.slotKey===key)) return;
    openMainTaskModal(key);
  });
  const openHabitsFromTaskBtn=document.getElementById('open-habits-from-task-btn');
  if(openHabitsFromTaskBtn) openHabitsFromTaskBtn.addEventListener('click',()=>{ closeModal(); document.dispatchEvent(new CustomEvent('app:open-habits')); });
  document.getElementById('cancel-modal-btn').addEventListener('click',closeModal);
  document.getElementById('modal-overlay').addEventListener('click',e=>{if(e.target===document.getElementById('modal-overlay')) closeModal();});

  document.getElementById('confirm-task-btn').addEventListener('click', async () => {
    const name=document.getElementById('task-name').value.trim();
    const desc=document.getElementById('task-desc').value.trim();
    const subtasks=['subtask-1','subtask-2','subtask-3'].map(id=>document.getElementById(id).value.trim()).filter(Boolean).map(text=>({id:'st'+Date.now()+'_'+(taskCounter++),text,done:false}));
    let ok=true;
    if(!name){document.getElementById('task-name-err').style.display='block';ok=false;}
    if(taskModalMode!=='mainTemplate' && taskModalMode!=='editMainTask'){
      if(!selectedTrack){document.getElementById('track-select-err').style.display='block';ok=false;}
      if(!selectedDiff){document.getElementById('diff-err').style.display='block';ok=false;}
    }
    if(!ok) return;
    if(taskModalMode==='mainTemplate'){
      ensureMainTasks();
      const info=MAIN_TASKS[selectedMainSlot];
      if(!info || state.mainTasks.some(t=>t.slotKey===selectedMainSlot)) return;
      const now=Date.now();
      state.mainTasks.push({
        id:'mt'+now+'_'+(taskCounter++), slotKey:selectedMainSlot, slotLabel:info.label,
        name, desc, xp:MAIN_XP, diffKey:'main', diffName:'مهمة رئيسية',
        trackKey:info.track, trackName:TRACKS.find(t=>t.key===info.track)?.name||'',
        mainTask:true, dayKey:state.mainTasksDay, createdTs:now, done:false,
        subtasks
      });
      await saveState(); render(); closeModal(); return;
    }
    if(taskModalMode==='editMainTask'){
      ensureMainTasks();
      const task=state.mainTasks.find(t=>t.id===editingTaskId);
      if(!task || task.done) return;
      const oldSubs=Array.isArray(task.subtasks)?task.subtasks:[];
      const newTexts=[...document.querySelectorAll('#subtask-1,#subtask-2,#subtask-3')].map(el=>el.value.trim()).filter(Boolean);
      task.name=name;
      task.desc=desc;
      task.subtasks=newTexts.map((text,i)=>{
        const old=oldSubs[i];
        return {id:old?.id||('st'+Date.now()+'_'+(taskCounter++)),text,done:!!old?.done};
      });
      await saveState(); render(); closeModal(); return;
    }
    const diffObj=selectedDiff===SPECIAL.key?SPECIAL:DIFFS.find(d=>d.key===selectedDiff);
    const trackObj=TRACKS.find(t=>t.key===selectedTrack);
    if(taskModalMode==='daily'){
      if((state.pending||[]).length>=dailyTaskMax()) return;
      const now=Date.now();
      state.pending.push({id:'t'+now+'_'+(taskCounter++),name,desc,xp:diffObj.xp,diffKey:diffObj.key,diffName:diffObj.name,trackKey:trackObj.key,trackName:trackObj.name,createdTs:now,startedTs:now,subtasks});
    } else if(taskModalMode==='habit'){
      ensureHabits();
      state.habits.push({id:'h'+Date.now()+'_'+(taskCounter++),name,desc,xp:diffObj.xp,diffKey:diffObj.key,diffName:diffObj.name,trackKey:trackObj.key,trackName:trackObj.name,subtasks,createdTs:Date.now()});
    } else if(taskModalMode==='editHabit'){
      const h=state.habits.find(x=>x.id===editingHabitId);
      if(h){Object.assign(h,{name,desc,xp:diffObj.xp,diffKey:diffObj.key,diffName:diffObj.name,trackKey:trackObj.key,trackName:trackObj.name,subtasks});}
    } else if(taskModalMode==='editTask'){
      const t=state.pending.find(x=>x.id===editingTaskId);
      if(t){Object.assign(t,{name,desc,xp:diffObj.xp,diffKey:diffObj.key,diffName:diffObj.name,trackKey:trackObj.key,trackName:trackObj.name,subtasks});}
    }
    await saveState(); render(); closeModal();
  });

  // ---------- skills view / syndromes view (dedicated screens, own back button) ----------
  const dashboardView = document.getElementById('dashboard-view');
  // ---------- main page navigation ----------
  // Navigation changes visibility of the original dashboard sections only.
  // It does not remove or replace any of the existing site functionality.
  let currentMainPage = 'profile';
  const mainNavItems = document.querySelectorAll('.app-nav-item[data-main-page]');
  const mainPageSections = {
    profile: ['profile-section','task-history-panel','tracks-panel'],
    tasks: ['task-list-panel'],
    progress: ['daily-progress-panel','progress-sections-panel'],
    tools: ['tools-panel']
  };
  const allMainSectionIds = [...new Set(Object.values(mainPageSections).flat())];

  function applyMainPage(page, scroll = true, showDashboard = true){
    if(!mainPageSections[page]) page = 'profile';
    currentMainPage = page;

    if(showDashboard) dashboardView.style.display = 'block';

    allMainSectionIds.forEach(id => {
      const el = document.getElementById(id);
      if(el) el.style.display = 'none';
    });
    mainPageSections[page].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.style.display = '';
    });
    // في وضع "بلا حدود" لا تظهر لوحة المهمات الرئيسية حتى لو كنا في صفحة المهام
    if(page === 'tasks' && state && state.taskListMode === 'unlimited'){
      const mtp = document.getElementById('main-tasks-panel');
      if(mtp) mtp.style.display = 'none';
    }
    mainNavItems.forEach(btn => btn.classList.toggle('active', btn.dataset.mainPage === page));
    if(scroll && showDashboard) window.scrollTo({top:0, behavior:'smooth'});
  }

  mainNavItems.forEach(btn => {
    btn.addEventListener('click', () => {
      // If a sub-view is open, close it before switching the main tab.
      [habitsView, skillsView, syndromesView, projectsView].forEach(v => { if(v) v.style.display='none'; });
      applyMainPage(btn.dataset.mainPage, true, true);
    });
  });

  // تبديل وضع قائمة المهام: المهمات الرئيسية (الافتراضي) أو بلا حدود — يفتح شاشة تأكيد أولًا
  const taskModeConfirmOverlay = document.getElementById('task-mode-confirm-overlay');
  const taskModeConfirmTitle = document.getElementById('task-mode-confirm-title');
  const taskModeConfirmText = document.getElementById('task-mode-confirm-text');
  const taskModeConfirmWarn = document.getElementById('task-mode-confirm-warn');
  let pendingTaskMode = null;
  const TASK_MODE_CONFIRM_COPY = {
    main: {
      title: 'الانتقال إلى المهمات الرئيسية؟',
      text: 'راح تظهر لوحة المهمات الرئيسية الثلاث من جديد، ويرجع حد قائمة المهام كما كان (1 ثم 3 بعد إنجازها).',
      warn: 'تنبيه: كل المهام الموجودة حاليًا في القائمة راح تُحذف نهائيًا ولا يمكن استرجاعها.'
    },
    unlimited: {
      title: 'الانتقال إلى وضع بلا حدود؟',
      text: 'راح تختفي لوحة المهمات الرئيسية، ويصير بإمكانك إضافة أي عدد من المهام بدون أي حد.',
      warn: 'تنبيه: كل المهام الموجودة حاليًا في القائمة راح تُحذف نهائيًا ولا يمكن استرجاعها.'
    }
  };

  function openTaskModeConfirm(mode){
    pendingTaskMode = mode;
    const copy = TASK_MODE_CONFIRM_COPY[mode];
    taskModeConfirmTitle.textContent = copy.title;
    taskModeConfirmText.textContent = copy.text;
    if(taskModeConfirmWarn) taskModeConfirmWarn.textContent = copy.warn || '';
    taskModeConfirmOverlay.classList.add('show');
  }
  function closeTaskModeConfirm(){
    pendingTaskMode = null;
    taskModeConfirmOverlay.classList.remove('show');
  }

  document.getElementById('task-mode-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-task-mode]');
    if(!btn || !state) return;
    const mode = btn.dataset.taskMode === 'unlimited' ? 'unlimited' : 'main';
    if(state.taskListMode === mode) return;
    openTaskModeConfirm(mode);
  });

  document.getElementById('cancel-task-mode-btn').addEventListener('click', closeTaskModeConfirm);
  taskModeConfirmOverlay.addEventListener('click', (e) => { if(e.target === taskModeConfirmOverlay) closeTaskModeConfirm(); });

  document.getElementById('confirm-task-mode-btn').addEventListener('click', async () => {
    if(!pendingTaskMode || !state){ closeTaskModeConfirm(); return; }
    // الانتقال بين صفحات المهام (الرئيسية / بلا حدود) يحذف كل مهام الصفحة الحالية
    state.pending = [];
    state.taskListMode = pendingTaskMode;
    closeTaskModeConfirm();
    render();
    applyMainPage('tasks', false, false);
    await saveState();
  });

  applyMainPage('profile', false, true);

  // ---------- penalty ----------
  const penaltyOverlay = document.getElementById('penalty-overlay');
  const penaltyGrid = document.getElementById('penalty-grid');
  const penaltyTrackGrid = document.getElementById('penalty-track-grid');
  let selectedPenaltyTrack = null;

  function buildPenaltyTrackGrid(){
    penaltyTrackGrid.innerHTML = TRACKS.map(t => `
      <div class="diff-opt" data-key="${t.key}"><div class="name">${t.name}</div></div>`).join('');
    penaltyTrackGrid.querySelectorAll('.diff-opt').forEach(el => {
      el.addEventListener('click', () => {
        penaltyTrackGrid.querySelectorAll('.diff-opt').forEach(o => o.classList.remove('selected'));
        el.classList.add('selected');
        selectedPenaltyTrack = el.dataset.key || null;
        document.getElementById('penalty-track-err').style.display='none';
      });
    });
  }
  buildPenaltyTrackGrid();
  function buildPenaltyGrid(){
    penaltyGrid.innerHTML = PENALTIES.map(p => `
      <div class="diff-opt" data-key="${p.key}">
        <div class="name">${p.name}</div>
        <div class="xp">−${p.amount}</div>
      </div>`).join('');
    penaltyGrid.querySelectorAll('.diff-opt').forEach(el => {
      el.addEventListener('click', () => {
        penaltyGrid.querySelectorAll('.diff-opt').forEach(o => o.classList.remove('selected'));
        el.classList.add('selected');
        selectedPenalty = el.dataset.key;
        document.getElementById('penalty-err').style.display='none';
      });
    });
  }
  buildPenaltyGrid();

  function openPenaltyModal(){
    document.getElementById('penalty-reason').value='';
    document.getElementById('penalty-task-input').value='';
    document.getElementById('penalty-task-enabled').checked=false;
    document.getElementById('penalty-task-input').style.display='none';
    document.getElementById('penalty-reason-err').style.display='none';
    document.getElementById('penalty-task-err').style.display='none';
    selectedPenalty = null;
    selectedPenaltyTrack = null;
    penaltyGrid.querySelectorAll('.diff-opt').forEach(o => o.classList.remove('selected'));
    penaltyTrackGrid.querySelectorAll('.diff-opt').forEach(o => o.classList.remove('selected'));
    document.getElementById('penalty-track-err').style.display='none';
    document.getElementById('penalty-err').style.display='none';
    penaltyOverlay.classList.add('show');
  }
  function closePenaltyModal(){ penaltyOverlay.classList.remove('show'); }

  document.getElementById('penalty-task-enabled').addEventListener('change', (e) => {
    const input = document.getElementById('penalty-task-input');
    input.style.display = e.target.checked ? 'block' : 'none';
    document.getElementById('penalty-task-err').style.display='none';
    if(e.target.checked) input.focus();
  });

  document.getElementById('open-penalty-btn').addEventListener('click', openPenaltyModal);
  document.getElementById('cancel-penalty-btn').addEventListener('click', closePenaltyModal);
  penaltyOverlay.addEventListener('click', (e) => { if(e.target === penaltyOverlay) closePenaltyModal(); });


  document.getElementById('confirm-penalty-btn').addEventListener('click', async () => {
    let selectionOk = true;
    if(!selectedPenaltyTrack){ document.getElementById('penalty-track-err').style.display='block'; selectionOk=false; }
    if(!selectedPenalty){ document.getElementById('penalty-err').style.display='block'; selectionOk=false; }
    if(!selectionOk) return;
    const penaltyTaskEnabled = document.getElementById('penalty-task-enabled').checked;
    const penaltyTaskName = document.getElementById('penalty-task-input').value.trim();
    const reason = document.getElementById('penalty-reason').value.trim();
    let ok = true;
    if(!reason){ document.getElementById('penalty-reason-err').style.display='block'; ok=false; }
    if(penaltyTaskEnabled && !penaltyTaskName){ document.getElementById('penalty-task-err').style.display='block'; ok=false; }
    if(penaltyTaskEnabled && (state.pending || []).length >= dailyTaskMax()){
      document.getElementById('penalty-task-err').textContent='قائمة المهام ممتلئة. احذف أو أنجز مهمة أولًا.';
      document.getElementById('penalty-task-err').style.display='block';
      ok=false;
    }
    if(!ok) return;
    const pObj = PENALTIES.find(p => p.key === selectedPenalty);
    const deductedAmount = Math.min(state.xp, pObj.amount);
    const trackDeductedAmount = selectedPenaltyTrack ? Math.min(getTrackXP(selectedPenaltyTrack), deductedAmount) : 0;
    const penaltyId = 'pen' + Date.now() + '_' + (taskCounter++);
    if(!state.penalties) state.penalties = [];
    const penalty = { id:penaltyId, name:pObj.name, amount:pObj.amount, deductedAmount, trackKey:selectedPenaltyTrack || '', trackName:TRACKS.find(t=>t.key===selectedPenaltyTrack)?.name || '', trackDeductedAmount, reason, ts:Date.now(), restored:false };
    state.penalties.push(penalty);
    state.xp = Math.max(0, state.xp - deductedAmount);

    if(penaltyTaskEnabled){
      if(!state.pending) state.pending = [];
      state.pending.push({
        id:'t' + Date.now() + '_' + (taskCounter++),
        name:penaltyTaskName, desc:'مهمة عقاب مرتبطة بعقوبة: ' + pObj.name,
        xp:0, diffKey:'penalty', diffName:'مهمة عقاب', trackKey:selectedPenaltyTrack || '', trackName:TRACKS.find(t=>t.key===selectedPenaltyTrack)?.name || '',
        createdTs:Date.now(), subtasks:[], penaltyTask:true, penaltyId:penaltyId
      });
    }
    await saveState();
    render();
    closePenaltyModal();
  });

  // ---------- restore xp ----------
  const restoreXpOverlay = document.getElementById('restore-xp-overlay');
  const restoreXpValueEl = document.getElementById('restore-xp-value');
  const RESTORE_XP_STEP = 100;
  let restoreXpAmount = 0;

  function renderRestoreXpValue(){
    restoreXpValueEl.textContent = restoreXpAmount;
  }

  function openRestoreXpModal(){
    restoreXpAmount = 0;
    renderRestoreXpValue();
    restoreXpOverlay.classList.add('show');
  }
  function closeRestoreXpModal(){ restoreXpOverlay.classList.remove('show'); }

  document.getElementById('open-restore-xp-btn').addEventListener('click', openRestoreXpModal);
  document.getElementById('cancel-restore-xp-btn').addEventListener('click', closeRestoreXpModal);
  restoreXpOverlay.addEventListener('click', (e) => { if(e.target === restoreXpOverlay) closeRestoreXpModal(); });

  document.getElementById('restore-xp-plus').addEventListener('click', () => {
    restoreXpAmount += RESTORE_XP_STEP;
    renderRestoreXpValue();
  });
  document.getElementById('restore-xp-minus').addEventListener('click', () => {
    restoreXpAmount = Math.max(0, restoreXpAmount - RESTORE_XP_STEP);
    renderRestoreXpValue();
  });
  const RESTORE_XP_STEP_BIG = 1000;
  document.getElementById('restore-xp-plus1000').addEventListener('click', () => {
    restoreXpAmount += RESTORE_XP_STEP_BIG;
    renderRestoreXpValue();
  });
  document.getElementById('restore-xp-minus1000').addEventListener('click', () => {
    restoreXpAmount = Math.max(0, restoreXpAmount - RESTORE_XP_STEP_BIG);
    renderRestoreXpValue();
  });

  document.getElementById('confirm-restore-xp-btn').addEventListener('click', async () => {
    if(restoreXpAmount > 0){
      state.xp += restoreXpAmount; // يضاف مباشرة للاكسبي الحالي
      render();
      saveState();
    }
    closeRestoreXpModal();
  });

  // ---------- delete account ----------
  const deleteOverlay = document.getElementById('delete-overlay');
  document.getElementById('delete-account-btn').addEventListener('click', () => {
    deleteOverlay.classList.add('show');
  });
  document.getElementById('cancel-delete-btn').addEventListener('click', () => {
    deleteOverlay.classList.remove('show');
  });
  deleteOverlay.addEventListener('click', (e) => { if(e.target === deleteOverlay) deleteOverlay.classList.remove('show'); });
  document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
    try{
      await storageAdapter.delete('profile:'+state.code, true);
    }catch(e){ console.error('delete failed', e); }
    location.reload();
  });

  // ---------- reset account (keeps the same code + day streak, wipes everything else) ----------
  const resetOverlay = document.getElementById('reset-overlay');
  document.getElementById('reset-account-btn').addEventListener('click', () => {
    resetOverlay.classList.add('show');
  });
  document.getElementById('cancel-reset-btn').addEventListener('click', () => {
    resetOverlay.classList.remove('show');
  });
  resetOverlay.addEventListener('click', (e) => { if(e.target === resetOverlay) resetOverlay.classList.remove('show'); });
  document.getElementById('confirm-reset-btn').addEventListener('click', async () => {
    ensureStreakDays(); // make sure the streak days are captured before wiping the rest
    const keepName = state.name;
    const keepCode = state.code;
    const keepStreakDays = state.streakDays;
    const keepSkills = state.skills || [];
    const keepAchievements = state.achievements || [];
    state = {
      name: keepName,
      code: keepCode,
      xp: 0,
      tasks: [],
      taskLog: [],
      taskLogInitialized: true,
      pending: [],
      mainTasks: [],
      mainTasksDay: mainDayKey(),
      taskListMode: 'main',
      penalties: [],
      skills: keepSkills, // skills are preserved across the reset
      syndromes: [],
      achievements: keepAchievements, // achievements are preserved across the reset
      habits: [],
      projects: [],
      streakDays: keepStreakDays // day streak is preserved across the reset
    };
    resetOverlay.classList.remove('show');
    render();
    await saveState();
  });

