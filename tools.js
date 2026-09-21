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
  }
  function closeFocusView() {
    focusView.style.display = 'none';
    applyMainPage('tools', false, true);
  }

  openBtn.addEventListener('click', openFocusView);
  backBtn.addEventListener('click', closeFocusView);

  // إغلاق الواجهة تلقائيًا عند التنقل لصفحة رئيسية أخرى من القائمة السفلية
  // (بدون فرض صفحة "الأدوات" — الصفحة المطلوبة أصلًا تُحدَّدها معالج
  // الضغط في core.js، هذا فقط يُخفي واجهة المؤقّت إن كانت مفتوحة)
  document.querySelectorAll('.app-nav-item[data-main-page]').forEach(btn => {
    btn.addEventListener('click', () => { focusView.style.display = 'none'; });
  });

  // ---------- المؤقت: عدادات دوّارة (زي مؤقت المنبهات) + شريط تقدّم ----------
  const display = document.getElementById('focus-timer-display');
  const minCol = document.getElementById('focus-picker-min');
  const secCol = document.getElementById('focus-picker-sec');
  const progressFill = document.getElementById('focus-timer-progress-fill');
  const startBtn = document.getElementById('focus-timer-start-btn');
  const resetBtn = document.getElementById('focus-timer-reset-btn');

  const ITEM_H = 40;   // يطابق ارتفاع .p-item بالـCSS
  const MAX_MIN = 180;
  const MAX_SEC = 59;

  function buildPickerItems(col, max) {
    let html = '';
    for (let i = 0; i <= max; i++) {
      html += '<div class="p-item" data-val="' + i + '">' + i.toString().padStart(2, '0') + '</div>';
    }
    col.innerHTML = html;
  }
  buildPickerItems(minCol, MAX_MIN);
  buildPickerItems(secCol, MAX_SEC);

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

  setPicker(minCol, minVal);
  setPicker(secCol, secVal);

  const scrollTimers = new WeakMap();
  [[minCol, 'min'], [secCol, 'sec']].forEach(([col, kind]) => {
    col.addEventListener('scroll', () => {
      if (intervalId) return; // ما تتغيّر القيمة أثناء تشغيل المؤقت
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
    const pct = totalSeconds > 0 ? ((totalSeconds - remaining) / totalSeconds) * 100 : 0;
    progressFill.style.width = pct + '%';
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

  renderTimer();
  renderProgress();
})();
