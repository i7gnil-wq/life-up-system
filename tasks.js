// =============================================================
// tasks.js — صفحة «المهام» (التبويب السفلي: tasks) + شاشة العادات
// يشارك النطاق العام (global scope) مع core.js — حمّله بعده مباشرة
// =============================================================
//
// [يعتمد على أشياء معرّفة في core.js]:
//   state, escapeHtml, saveState, render, mainDayKey, fillTaskModal,
//   resetTaskModal, showCelebration, dashboardView, applyMainPage,
//   ensureMainTasks, ensureTaskListMode, cleanupCompletedPending,
//   dailyTaskMax, ensureHabits
// [يعتمد على أشياء معرّفة في profile.js]:
//   recordTask, removeTaskLogById
//
// [هذا الملف يوفّر للملفات الأخرى]:
//   renderTasksPage()  → مسجّلة على حدث 'app:render' (يُطلقه core.js)
//   openHabitsView()   → مسجّلة على حدث 'app:open-habits' (يُطلقه core.js)
//   (لا حاجة لتعديل core.js إذا غيّرت اسم أي دالة هنا — فقط حدّث اسم
//    الحدث بالسطرين بآخر هذا الملف لو غيّرت الأسماء)
//
// ⚠️ لا تُعِد تسمية أو تحذف أي دالة أعلاه بدون التأكد من الملف الآخر.
// =============================================================
  function renderMainTasks(){
    const wrap=document.getElementById('main-task-slots');
    if(!wrap || !state) return;
    ensureMainTasks();
    const keys=['progress','sport','skill','daily-cost'];
    wrap.innerHTML=keys.map(key=>{
      const info=MAIN_TASKS[key];
      const task=state.mainTasks.find(t=>t.slotKey===key);
      if(!task){
        return `<button type="button" class="main-task-slot${info.required?'':' optional'}" data-main-slot="${key}">
          <strong>${info.label}</strong><span class="main-slot-xp">${info.required?'750 XP':'اختيارية · 750 XP'}</span>
        </button>`;
      }
      const subs=Array.isArray(task.subtasks)?task.subtasks:[];
      const doneCount=subs.filter(st=>st.done).length;
      const completeDisabled=subs.length>0 && doneCount<subs.length;
      const subHtml=subs.length ? `<div class="main-slot-progress">${doneCount}/${subs.length} مهام فرعية</div><div class="main-slot-subtasks">${subs.map((st,i)=>`
        <label class="main-slot-subtask ${st.done?'done':''}"><input type="checkbox" data-main-subtask="${task.id}" data-main-subindex="${i}" ${st.done?'checked':''} ${task.done?'disabled':''}><span>${escapeHtml(st.text)}</span></label>`).join('')}</div>` : '';
      const editButton=`<button type="button" class="btn main-slot-edit" data-main-edit="${task.id}" ${task.done?'disabled title="المهمة مكتملة ومغلقة حتى اليوم التالي"':''}>تعديل</button>`;
      const action=task.done
        ? `<div class="main-slot-locked">✓ مكتملة — مغلقة حتى اليوم التالي</div>`
        : `${editButton}<button type="button" class="btn btn-complete main-slot-complete" data-main-complete="${task.id}" ${completeDisabled?'disabled title="أكمل المهام الفرعية أولًا"':''}>إنجاز</button>`;
      return `<div class="main-task-slot filled ${task.done?'completed':''}" data-main-slot="${key}">
        <div class="main-slot-head"><div class="main-slot-name">${escapeHtml(task.name)}</div><div class="main-slot-xp">750 XP</div></div>
        ${task.desc?`<div class="main-slot-desc">${escapeHtml(task.desc)}</div>`:''}
        ${subHtml}<div class="main-slot-actions">${action}</div>
      </div>`;
    }).join('');
  }

  function renderTasksPage(){
    if(!state) return;
    ensureMainTasks();
    renderMainTasks();

    // task list mode (main vs unlimited)
    ensureTaskListMode();
    if(cleanupCompletedPending()) saveState();
    const isUnlimitedMode = state.taskListMode === 'unlimited';
    document.querySelectorAll('.task-mode-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.taskMode === state.taskListMode);
    });
    const mainTasksPanelEl = document.getElementById('main-tasks-panel');
    if(mainTasksPanelEl) mainTasksPanelEl.style.display = 'none';
    const taskListDescEl = document.getElementById('task-list-desc');
    if(taskListDescEl) taskListDescEl.style.display = 'none';

    // queue state / cap (queue UI removed — kept as a no-op guard for older saved state)
    const pending = state.pending || [];
    const capValue = dailyTaskMax();
    const capLabel = Number.isFinite(capValue) ? capValue : '∞';
    const queueHintEl = document.getElementById('queue-hint');
    if(queueHintEl) queueHintEl.textContent = `${pending.length} / ${capLabel} مهام في القائمة`;
    const queueCapEl = document.getElementById('queue-cap-label');
    if(queueCapEl) queueCapEl.textContent = `(${pending.length}/${capLabel})`;
    const openBtn = document.getElementById('open-modal-btn');
    if(openBtn) openBtn.disabled = pending.length >= capValue;

    // queue list
    const queueEl = document.getElementById('queue-list');
    if(queueEl){
      if(!pending.length){
        queueEl.innerHTML = '<div class="log-empty">القائمة فاضية.</div>';
      } else {
        queueEl.innerHTML = pending.map(t => {
          return `
          ${(() => {
            const sts = Array.isArray(t.subtasks) ? t.subtasks : [];
            const doneCount = sts.filter(st => st.done).length;
            const hasSubtasks = sts.length > 0;
            const isDone = !!t.done;
            const canComplete = !isDone && !(hasSubtasks && doneCount < sts.length);
            return `
          <div class="queue-item ${hasSubtasks ? 'has-subtasks' : ''} ${isDone ? 'done' : ''}">
            <div class="left">
              <label class="task-check-box ${isDone ? 'checked' : ''}" title="${isDone ? 'اضغط للتراجع عن الإنجاز' : (canComplete ? 'إنجاز' : 'أكمل المهام الفرعية أولًا')}">
                <input type="checkbox" data-complete="${t.id}" ${isDone ? 'checked' : ''}>
              </label>
              <div class="info">
                <div class="t" style="${isDone ? 'text-decoration:line-through; opacity:.6;' : ''}">${escapeHtml(t.name)}${t.penaltyTask ? ' <span style="color:var(--silver-accent);font-size:10px;font-family:Cairo;">· مهمة عقاب</span>' : ''}</div>
                <div class="d">${t.penaltyTask ? 'إتمامها يسترجع خصم العقوبة' : (t.trackName ? escapeHtml(t.trackName) + ' · ' : '') + escapeHtml(t.desc || t.diffName)}</div>
                ${hasSubtasks ? `<div class="queue-progress">${doneCount}/${sts.length} مهام فرعية</div><div class="queue-subtasks">${sts.map((st,i) => `<label class="queue-subtask ${st.done ? 'done' : ''}"><input type="checkbox" data-subtask="${t.id}" data-subindex="${i}" ${st.done ? 'checked' : ''} ${isDone ? 'disabled' : ''}><span>${escapeHtml(st.text)}</span></label>`).join('')}</div>` : ''}
              </div>
            </div>
            <div class="actions">
              ${(!t.penaltyTask && !isDone) ? `<button type="button" class="icon-btn icon-edit" data-edit-task="${t.id}" title="تعديل"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>` : ''}
              <button type="button" class="icon-btn icon-del" data-cancel="${t.id}" title="حذف"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
            </div>
          </div>`;
          })()}`;
        }).join('');
      }
    }

    // habits
    ensureHabits();
    renderHabits();
  }

// ---------- habits view ----------
  const habitsView=document.getElementById('habits-view');
  const habitsList=document.getElementById('habits-list');
  function habitHtml(h){
    const subs=(h.subtasks||[]).length ? ` · ${(h.subtasks||[]).length} مهام فرعية` : '';
    return `<div class="habit-item">
      <div class="info"><div class="name">${escapeHtml(h.name)}</div><div class="meta">${escapeHtml(h.trackName||'')} · ${escapeHtml(h.diffName||'')} · +${h.xp} XP${subs}</div>${h.desc?`<div class="meta">${escapeHtml(h.desc)}</div>`:''}</div>
      <div class="habit-actions"><button class="btn btn-renew" data-renew-habit="${h.id}">تجديد</button><button class="btn btn-edit" data-edit-habit="${h.id}">تعديل</button><button class="btn btn-delete" data-delete-habit="${h.id}">حذف</button></div>
    </div>`;
  }
  function renderHabits(){
    if(!habitsList || !state) return;
    ensureHabits();
    habitsList.innerHTML=state.habits.length ? state.habits.map(habitHtml).join('') : '<div class="log-empty">لا توجد عادات بعد — أضف أول عادة.</div>';
  }
  function openHabitsView(){ dashboardView.style.display='none'; habitsView.style.display='block'; render(); }
  function closeHabitsView(){ habitsView.style.display='none'; dashboardView.style.display='block'; render(); }
  document.getElementById('habits-back-btn').addEventListener('click',closeHabitsView);
  document.getElementById('open-habit-btn').addEventListener('click',()=>{taskModalMode='habit'; editingHabitId=null; resetTaskModal(); document.querySelector('#modal-overlay h2').textContent='إضافة عادة جديدة'; document.getElementById('confirm-task-btn').textContent='حفظ العادة'; document.getElementById('modal-overlay').classList.add('show');});
  habitsList.addEventListener('click',async e=>{
    const renew=e.target.closest('[data-renew-habit]');
    const edit=e.target.closest('[data-edit-habit]');
    const del=e.target.closest('[data-delete-habit]');
    if(renew){
      if((state.pending||[]).length>=dailyTaskMax()) return;
      const h=state.habits.find(x=>x.id===renew.dataset.renewHabit);
      if(h){
        const now=Date.now();
        state.pending.push({...JSON.parse(JSON.stringify(h)), id:'t'+now+'_'+(taskCounter++), createdTs:now, startedTs:now, subtasks:(h.subtasks||[]).map(st=>({...st,id:'st'+now+'_'+(taskCounter++),done:false}))});
        await saveState();
        closeHabitsView();
        applyMainPage('tasks', true, true);
      }
    } else if(edit){
      const h=state.habits.find(x=>x.id===edit.dataset.editHabit);
      if(h){ editingHabitId=h.id; fillTaskModal(h,'editHabit'); }
    } else if(del){
      state.habits=state.habits.filter(x=>x.id!==del.dataset.deleteHabit); await saveState(); render();
    }
  });

  
  // ---------- queue: complete / cancel (event delegation) ----------
  // المهمة تبقى في القائمة بعد إنجازها (بعلامة صح) في كل الأوضاع حتى الساعة 12 ليلًا
  async function finishPendingTask(taskId){
    const idx = state.pending.findIndex(t => t.id === taskId);
    if(idx === -1) return;
    const task = state.pending[idx];
    if(task.done) return;
    task.done = true;
    task.doneDayKey = mainDayKey();
    await completePendingTask(task);
  }
  async function completePendingTask(task){
    if(task.penaltyTask && task.penaltyId){
      const penalty = (state.penalties || []).find(p => p.id === task.penaltyId);
      if(penalty && !penalty.restored){
        const restoreAmount = penalty.deductedAmount ?? penalty.amount;
        state.xp += restoreAmount;
        // Track XP is derived from completed tasks minus active track penalties,
        // so marking the penalty restored automatically returns its track points.
        penalty.trackDeductedAmount = Number(penalty.trackDeductedAmount) || 0;
        penalty.restored = true;
        penalty.restoredTs = Date.now();
      }
      task.ts = Date.now();
      task.restoredPenalty = true;
      recordTask(task);
      return;
    }
    task.ts = Date.now();
    recordTask(task);
    state.xp += task.xp;
    showCelebration('أنجزت المهمة!', task.name || '', task.xp);
  }
  // التراجع عن مهمة تم إنجازها: يحذف الاكسبي المضاف ويعيد المهمة لحالة الانتظار
  async function undoPendingTask(taskId){
    const task = state.pending.find(t => t.id === taskId);
    if(!task || !task.done) return;
    if(task.penaltyTask && task.penaltyId){
      const penalty = (state.penalties || []).find(p => p.id === task.penaltyId);
      if(penalty && penalty.restored){
        const restoreAmount = penalty.deductedAmount ?? penalty.amount;
        state.xp = Math.max(0, state.xp - restoreAmount);
        penalty.restored = false;
        penalty.restoredTs = null;
      }
      task.restoredPenalty = false;
    } else {
      state.xp = Math.max(0, state.xp - task.xp);
    }
    state.tasks = (state.tasks || []).filter(t => t !== task);
    removeTaskLogById(task.id);
    task.done = false;
    task.doneDayKey = null;
    task.ts = null;
    if(Array.isArray(task.subtasks)){
      task.subtasks.forEach(st => { st.done = false; });
    }
  }

  const queueListEl = document.getElementById('queue-list');
  if(queueListEl) queueListEl.addEventListener('click', async (e) => {
    const subtaskInput = e.target.closest('[data-subtask]');
    if(subtaskInput){
      const taskId = subtaskInput.dataset.subtask;
      const subIndex = Number(subtaskInput.dataset.subindex);
      const task = state.pending.find(t => t.id === taskId);
      if(!task || !Array.isArray(task.subtasks) || !task.subtasks[subIndex]) return;
      task.subtasks[subIndex].done = subtaskInput.checked;
      const allDone = task.subtasks.length > 0 && task.subtasks.every(st => st.done);
      if(allDone && !task.done){
        await finishPendingTask(taskId);
      }
      await saveState();
      render();
      return;
    }

    const completeBtn = e.target.closest('[data-complete]');
    const cancelBtn = e.target.closest('[data-cancel]');
    const editBtn = e.target.closest('[data-edit-task]');
    const completeId = completeBtn ? completeBtn.dataset.complete : null;
    const cancelId = cancelBtn ? cancelBtn.dataset.cancel : null;
    const editId = editBtn ? editBtn.dataset.editTask : null;
    if(editId){
      const task=state.pending.find(t=>t.id===editId);
      if(task){ editingTaskId=editId; fillTaskModal(task,'editTask'); }
      return;
    }
    if(completeId){
      const task = state.pending.find(t => t.id === completeId);
      if(task && task.done){
        await undoPendingTask(completeId);
      } else {
        if(task && Array.isArray(task.subtasks) && task.subtasks.length){
          task.subtasks.forEach(st => { st.done = true; });
        }
        await finishPendingTask(completeId);
      }
      await saveState();
      render();
    } else if(cancelId){
      state.pending = state.pending.filter(t => t.id !== cancelId);
      await saveState();
      render();
    }
  });


  // ---------- ربط الأحداث القادمة من core.js (event bus بدل الاستدعاء المباشر) ----------
  document.addEventListener('app:render', renderTasksPage);
  document.addEventListener('app:open-habits', openHabitsView);
