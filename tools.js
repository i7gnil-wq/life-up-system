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
    // لازم نهيّئ العدادات ونقيس الإطار بعد ما تصير الواجهة ظاهرة فعليًا
    initPickers();
    layoutFrame();
  }
  function closeFocusView() {
    focusView.style.display = 'none';
    applyMainPage('tools', false, true);
  }

  openBtn.addEventListener('click', openFocusView);
  backBtn.addEventListener('click', closeFocusView);

  document.querySelectorAll('.app-nav-item[data-main-page]').forEach(btn => {
    btn.addEventListener('click', () => { focusView.style.display = 'none'; });
  });

  // ---------- المؤقت: عدادات دوّارة (زي مؤقت المنبهات) ----------
  const display = document.getElementById('focus-timer-display');
  const minCol = document.getElementById('focus-picker-min');
  const secCol = document.getElementById('focus-picker-sec');
  const startBtn = document.getElementById('focus-timer-start-btn');
  const resetBtn = document.getElementById('focus-timer-reset-btn');

  // القيم المتاحة: الدقائق 1 ثم بالخمسة، الثواني بالخمسة فقط
  const MIN_VALUES = [1];
  for (let m = 5; m <= 180; m += 5) MIN_VALUES.push(m);
  const SEC_VALUES = [];
  for (let s = 0; s <= 55; s += 5) SEC_VALUES.push(s);

  // ---------- إطار مستطيل مجوّف حول رقم المؤقّت فقط ----------
  const frameWrap = document.getElementById('focus-timer-display-wrap');
  const frameSvg = document.getElementById('focus-frame-svg');
  const frameBg = frameSvg.querySelector('.frame-bg');
  const frameFg = document.getElementById('focus-frame-fg');
  const frameClipRect = document.getElementById('focus-frame-clip-rect');
  let frameLen = 0;

  function layoutFrame() {
    const w = frameWrap.clientWidth, h = frameWrap.clientHeight;
    if (!w || !h) return; // لسا مخفي، ما نقدر نقيس
    frameSvg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    const sw = 2.5, inset = sw / 2, r = 14;
    [frameBg, frameFg].forEach(rect => {
      rect.setAttribute('x', inset);
      rect.setAttribute('y', inset);
      rect.setAttribute('width', Math.max(0, w - sw));
      rect.setAttribute('height', Math.max(0, h - sw));
      rect.setAttribute('rx', r);
      rect.setAttribute('ry', r);
    });
    // نفس حدود الإطار بالضبط (بدون توسعة) — أي جزء من الشريط المضيء
    // (خصوصًا طرف الخط الدائري stroke-linecap) يتجاوز الزاوية الدائرية
    // ينحجب هنا بدل ما يبرز خارج المستطيل بشكل غير متناسق
    frameClipRect.setAttribute('x', inset);
    frameClipRect.setAttribute('y', inset);
    frameClipRect.setAttribute('width', Math.max(0, w - sw));
    frameClipRect.setAttribute('height', Math.max(0, h - sw));
    frameClipRect.setAttribute('rx', r);
    frameClipRect.setAttribute('ry', r);
    frameLen = frameFg.getTotalLength();
    frameFg.style.strokeDasharray = frameLen;
    renderProgress();
  }
  window.addEventListener('resize', () => { if (focusView.style.display !== 'none') layoutFrame(); });

  const ITEM_H = 40; // يطابق ارتفاع .p-item بالـCSS (وارتفاع خانة المؤشّر بالمنتصف)
  let picksBuilt = false;
  let suppressScroll = false;

  function buildPickerItems(col, values) {
    col.innerHTML = values.map(v =>
      '<div class="p-item" data-val="' + v + '">' + v.toString().padStart(2, '0') + '</div>'
    ).join('');
  }
  function selectedIndex(col, values) {
    return Math.min(values.length - 1, Math.max(0, Math.round(col.scrollTop / ITEM_H)));
  }
  function highlightSelected(col, values) {
    const idx = selectedIndex(col, values);
    col.querySelectorAll('.p-item').forEach((el, i) => el.classList.toggle('sel', i === idx));
  }
  function setPickerToValue(col, values, val) {
    let idx = values.indexOf(val);
    if (idx < 0) idx = 0;
    col.scrollTop = idx * ITEM_H;
    highlightSelected(col, values);
  }

  let minVal = 25, secVal = 0;
  let totalSeconds = minVal * 60 + secVal;
  let remaining = totalSeconds;
  let intervalId = null;

  function initPickers() {
    if (!picksBuilt) {
      buildPickerItems(minCol, MIN_VALUES);
      buildPickerItems(secCol, SEC_VALUES);
      picksBuilt = true;
    }
    if (intervalId) return; // ما نغيّر القيمة أثناء التشغيل
    suppressScroll = true;
    setPickerToValue(minCol, MIN_VALUES, minVal);
    setPickerToValue(secCol, SEC_VALUES, secVal);
    setTimeout(() => { suppressScroll = false; }, 150);
  }

  const scrollTimers = new WeakMap();
  [[minCol, MIN_VALUES, 'min'], [secCol, SEC_VALUES, 'sec']].forEach(([col, values, kind]) => {
    col.addEventListener('scroll', () => {
      if (intervalId || suppressScroll) return;
      highlightSelected(col, values);
      clearTimeout(scrollTimers.get(col));
      scrollTimers.set(col, setTimeout(() => {
        const idx = selectedIndex(col, values);
        col.scrollTo({ top: idx * ITEM_H, behavior: 'smooth' });
        highlightSelected(col, values);
        const val = values[idx];
        if (kind === 'min') minVal = val; else secVal = val;
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

  frameFg.style.strokeDashoffset = 0;
  renderTimer();
})();
