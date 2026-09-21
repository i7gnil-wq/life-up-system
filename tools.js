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

  // ---------- المؤقت ----------
  const display = document.getElementById('focus-timer-display');
  const minutesInput = document.getElementById('focus-timer-minutes');
  const startBtn = document.getElementById('focus-timer-start-btn');
  const resetBtn = document.getElementById('focus-timer-reset-btn');

  let totalSeconds = 25 * 60;
  let remaining = totalSeconds;
  let intervalId = null;

  function formatTime(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return m + ':' + s;
  }
  function renderTimer() {
    display.textContent = formatTime(remaining);
  }
  function stopTimer() {
    clearInterval(intervalId);
    intervalId = null;
    startBtn.textContent = 'ابدأ';
  }
  function tick() {
    remaining--;
    renderTimer();
    if (remaining <= 0) stopTimer();
  }

  startBtn.addEventListener('click', () => {
    if (intervalId) {
      stopTimer();
      return;
    }
    if (remaining <= 0) {
      totalSeconds = Math.max(1, parseInt(minutesInput.value, 10) || 25) * 60;
      remaining = totalSeconds;
    }
    intervalId = setInterval(tick, 1000);
    startBtn.textContent = 'إيقاف';
  });

  resetBtn.addEventListener('click', () => {
    stopTimer();
    totalSeconds = Math.max(1, parseInt(minutesInput.value, 10) || 25) * 60;
    remaining = totalSeconds;
    renderTimer();
  });

  minutesInput.addEventListener('change', () => {
    if (intervalId) return;
    totalSeconds = Math.max(1, parseInt(minutesInput.value, 10) || 25) * 60;
    remaining = totalSeconds;
    renderTimer();
  });
})();
