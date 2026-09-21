// =============================================================
// tools.js — صفحة "الأدوات" (الصفحة الرابعة) + أداة "غابة التركيز"
// حمّله بعد core.js في index.html
// =============================================================

document.addEventListener('app:render', function () {
  // TODO: عرض أي محتوى إضافي لصفحة الأدوات هنا باستخدام state من core.js
});

// ---------- غابة التركيز: فتح/إغلاق الواجهة ----------
(function () {
  const focusView = document.getElementById('focus-view');
  const openBtn = document.getElementById('open-focus-forest-btn');
  const backBtn = document.getElementById('focus-back-btn');

  function openFocusView() {
    dashboardView.style.display = 'none';
    focusView.style.display = 'block';
    // العناصر كانت display:none قبل هذا السطر، فحجمها = صفر —
    // لازم نهيّئ العدادات والإطار بعد ما تصير الواجهة ظاهرة فعليًا
    initPickers();
    layoutFrame();
  }
  function closeFocusView() {
    focusView.style.display = 'none';
    applyMainPage('tools', false, true);
  }

  openBtn.addEventListener('click', openFocusView);
  backBtn.addEventListener('click', closeFocusView);

  // إغلاق الواجهة تلقائيًا عند التنقل لصفحة رئيسية أخرى من القائمة السفلية
  document.querySelectorAll('.app-nav-item[data-main-page]').forEach(btn => {
    btn.addEventListener('click', () => { focusView.style.display = 'none'; });
  });

  // ---------- المؤقت: عدادات دوّارة (زي مؤقت المنبهات) ----------
  const display = document.getElementById('focus-timer-display');
  const minCol = document.getElementById('focus-picker-min');
  const secCol = document.getElementById('focus-picker-sec');
  const startBtn = document.getElementById('focus-timer-start-btn');
  const resetBtn = document.getElementById('focus-timer-reset-btn');

  // ---------- إطار مستطيل مجوّف حول بطاقة المؤقت ----------
  const frameCard = document.getElementById('focus-timer-card');
  const frameSvg = document.getElementById('focus-frame-svg');
  const frameBg = frameSvg.querySelector('.frame-bg');
  const frameFg = document.getElementById('focus-frame-fg');
  let frameLen = 0;

  function layoutFrame() {
    const w = frameCard.clientWidth, h = frameCard.clientHeight;
    if (!w || !h) return; // لسا مخفي، ما نقدر نقيس
    frameSvg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    const sw = 2, inset = sw / 2, r = 15;
    [frameBg, frameFg].forEach(rect => {
      rect.setAttribute('x', inset);
      rect.setAttribute('y', inset);
      rect.setAttribute('width', Math.max(0, w - sw));
      rect.setAttribute('height', Math.max(0, h - sw));
      rect.setAttribute('rx', r);
      rect.setAttribute('ry', r);
    });
    frameLen = frameFg.getTotalLength();
    frameFg.style.strokeDasharray = frameLen;
    renderProgress();
  }
  window.addEventListener('resize', () => { if (focusView.style.display !== 'none') layoutFrame(); });

  const ITEM_H = 40; // يطابق ارتفاع .p-item بالـCSS
  const MAX_MIN = 180;
  const MAX_SEC = 59;
  let picksBuilt = false;
  let suppressScroll = false;

  function buildPickerItems(col, max) {
    let html = '';
    for (let i = 0; i <= max; i++) {
      html += '<div class="p-item" data-val="' + i + '">' + i.toString().padStart(2, '0') + '</div>';
    }
    col.innerHTML = html;
  }
  function selectedIndex(col) {
    return Math.round(col.scrollTop / ITEM_H);
  }
  function highlightSelected(col) {
    const idx = selectedIndex(col);
    col.querySelectorAll('.p-item').forEach((el, i) => el.classList.toggle('sel', i === idx));
  }
  function setPicker(col, val) {
    col.scrollTop = val * ITEM_H;
    highlightSelected(col);
  }

  let minVal = 25, secVal = 0;
  let totalSeconds = minVal * 60 + secVal;
  let remaining = totalSeconds;
  let intervalId = null;

  function initPickers() {
    if (!picksBuilt) {
      buildPickerItems(minCol, MAX_MIN);
      buildPickerItems(secCol, MAX_SEC);
      picksBuilt = true;
    }
    if (intervalId) return; // ما نغيّر القيمة أثناء التشغيل
    suppressScroll = true;
    setPicker(minCol, minVal);
    setPicker(secCol, secVal);
    setTimeout(() => { suppressScroll = false; }, 150);
  }

  const scrollTimers = new WeakMap();
  [[minCol, 'min'], [secCol, 'sec']].forEach(([col, kind]) => {
    col.addEventListener('scroll', () => {
      if (intervalId || suppressScroll) return;
      highlightSelected(col);
      clearTimeout(scrollTimers.get(col));
      scrollTimers.set(col, setTimeout(() => {
        const idx = selectedIndex(col);
        col.scrollTo({ top: idx * ITEM_H, behavior: 'smooth' });
        highlightSelected(col);
        if (kind === 'min') minVal = idx; else secVal = idx;
        totalSeconds = Math.max(1, minVal * 60 + secVal);
        remaining = totalSeconds;
        renderTimer();
        renderProgress();
      }, 120));
    });
  });

  function formatTime(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return m + ':' + s;
  }
  function renderTimer() {
    display.textContent = formatTime(remaining);
  }
  function renderProgress() {
    if (!frameLen) return;
    const pct = totalSeconds > 0 ? (totalSeconds - remaining) / totalSeconds : 0;
    frameFg.style.strokeDashoffset = frameLen * (1 - pct);
  }
  function stopTimer() {
    clearInterval(intervalId);
    intervalId = null;
    startBtn.textContent = 'ابدأ';
  }
  function tick() {
    remaining--;
    renderTimer();
    renderProgress();
    if (remaining <= 0) stopTimer();
  }

  startBtn.addEventListener('click', () => {
    if (intervalId) {
      stopTimer();
      return;
    }
    if (remaining <= 0) {
      totalSeconds = Math.max(1, minVal * 60 + secVal);
      remaining = totalSeconds;
    }
    intervalId = setInterval(tick, 1000);
    startBtn.textContent = 'إيقاف';
  });

  resetBtn.addEventListener('click', () => {
    stopTimer();
    totalSeconds = Math.max(1, minVal * 60 + secVal);
    remaining = totalSeconds;
    renderTimer();
    renderProgress();
  });

  // قيم أولية للعرض قبل أول فتح للواجهة (بدون قياس أبعاد، لأنها مخفية بعد)
  frameFg.style.strokeDashoffset = 0;
  renderTimer();
})();
