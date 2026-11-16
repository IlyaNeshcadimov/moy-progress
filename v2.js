'use strict';
/* Мой прогресс 2.0 — расширение без изменения ключа данных v1. */
(() => {
 const baseRender=render, baseAction=handleAction, baseSettings=showSettings;
 const realSessionDate=sessionDate;
 const baseShowMeal=showMealForm;
 const V2PHOTO='moy-progress-photos';
 const isoMonth=(s)=>String(s).slice(0,7);
 const sortedDays=()=>Object.keys(db.daily).filter(x=>/^\d{4}-\d\d-\d\d$/.test(x)).sort();
 const tr=(name,alt='')=>h(name??alt);
 const r2=n=>Math.round(n*10)/10;
 const isFilled=st=>st&&st.reps!==null&&st.reps!==undefined&&Number(st.reps)>0;
  const ui={month:isoMonth(view.date),chart:'strength',timerBase:90,photoLeft:null,photoRight:null};
 db.favorites=Array.isArray(db.favorites)?db.favorites:[];
 db.photos=Array.isArray(db.photos)?db.photos:[];
 db.ui=db.ui&&typeof db.ui==='object'?db.ui:{};
 if(!db.migratedV2){
  for(const ses of Object.values(db.workouts))for(const ex of Object.values(ses?.exercises||{}))for(const st of ex?.sets||[])if(st&&st.done===undefined&&isFilled(st))st.done=true;
  db.migratedV2=true;db.version=2;save();
 }
 sessionDate=function(w,key){const override=getSession(w,key).scheduledDate;return /^\d{4}-\d\d-\d\d$/.test(override||'')?override:realSessionDate(w,key);};
 // Учитываем только реально отмеченные подходы, а не перенесённые как подсказку веса.
 calcSession=function(week,key){const ses=getSession(week,key);let done=0,sets=0,volume=0;
  for(const ex of getExercises(week,key)){
   const rows=(ses.exercises?.[ex.id]?.sets||[]).filter(st=>st.done===true&&Number(st.reps)>0);
   if(rows.length){done++;sets+=rows.length;volume+=volOf(rows);}
  }return {done,total:getExercises(week,key).length,sets,volume,finished:!!ses.finished};
 };
 strengthProgress=function(name){const arr=[];for(const ses of listSessions()){
   const ex=getExercises(ses.week,ses.key).find(x=>x.name===name);if(!ex)continue;
   const valid=(getSession(ses.week,ses.key).exercises?.[ex.id]?.sets||[]).filter(x=>x.done===true&&x.kg!=null&&Number(x.reps)>0);
   if(valid.length)arr.push({date:ses.date,week:ses.week,max:Math.max(...valid.map(x=>Number(x.kg)))});
  }return arr;
 };
 pastHint=function(name,w,key){const sets=recentSession(w,key,name);if(!sets.length)return null;const best=sets.reduce((a,b)=>Number(b.kg)>Number(a.kg)?b:a);return `${fmt(best.kg,1)} кг × ${best.reps}`;};
 const parseDate=s=>{const d=atNoon(s);return Number.isNaN(d.getTime())?null:d;};
 const dateIso=x=>toISO(x);
 const recentSession=(w,key,name)=>{
   const all=listSessions(),curIndex=all.findIndex(x=>x.week===w&&x.key===key);
   for(let i=curIndex-1;i>=0;i--){const ses=all[i],ex=getExercises(ses.week,ses.key).find(e=>e.name===name);if(!ex)continue;
    const prev=getSession(ses.week,ses.key).exercises?.[ex.id]?.sets||[];
    if(prev.some(st=>isFilled(st)&&st.done===true))return prev.filter(st=>isFilled(st)&&st.done===true);
   }return [];
 };
 const setFinished=(st)=>st.done===true;
 const sessionPR=()=>{
  const best=new Map();
  for(const ses of listSessions())for(const ex of getExercises(ses.week,ses.key)){
   if(ex.name==='Планка'||ex.name==='Скручивания')continue;
   for(const st of getSession(ses.week,ses.key).exercises?.[ex.id]?.sets||[]){
    const n=nonneg(st.kg,2000);if(n!==null&&n>0&&isFilled(st)&&st.done===true){
     const old=best.get(ex.name);if(!old||n>old.kg)best.set(ex.name,{name:ex.name,kg:n,reps:+st.reps,date:ses.date});
    }
   }
  }return [...best.values()].sort((a,b)=>a.name.localeCompare(b.name,'ru'));
 };
 function chart(points,unit='кг',name='Динамика'){
  if(points.length<2)return '<div class="empty">Нужны минимум две записи, чтобы построить график.</div>';
  const last=points.slice(-28),vals=last.map(x=>Number(x.value));let lo=Math.min(...vals),hi=Math.max(...vals),delta=Math.max(1,(hi-lo)*1.3);lo-=(delta-(hi-lo))/2;hi=lo+delta;
  const pad=27,plotW=314,plotH=122,xy=last.map((x,i)=>[pad+i*(plotW/Math.max(1,last.length-1)),18+(hi-x.value)/(hi-lo)*plotH]);
  const path=xy.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return `<svg class="graph-v2" viewBox="0 0 370 180" role="img" aria-label="${h(name)}"><path d="M27 18V140H341 M27 79H341" stroke="#314b49" stroke-dasharray="3 6" fill="none"/><path d="${path}" stroke="#bcf18e" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>${xy.map(([x,y])=>`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.4" fill="#c8f89d"/>`).join('')}<text x="28" y="11">${h(fmt(Math.max(...vals),1))} ${h(unit)}</text><text x="28" y="157">${h(fmt(Math.min(...vals),1))} ${h(unit)}</text><text x="26" y="174">${h(fmtDateShort(last[0].date))}</text><text x="340" y="174" text-anchor="end">${h(fmtDateShort(last.at(-1).date))}</text></svg>`;
 }
 const seriesMetric=key=>sortedDays().flatMap(date=>{const value=nonneg(db.daily[date]?.[key],500);return value===null||value===0?[]:[{date,value}];});
 const sleepSeries=()=>sortedDays().flatMap(date=>{const v=sleepHours(db.daily[date]);return v===null?[]:[{date,value:v}];});
 function statPills(){
  const list=listSessions(),finished=list.filter(x=>getSession(x.week,x.key).finished).length;
  const records=sessionPR();const waterDays=sortedDays().filter(d=>dayWater(d)>=db.settings.waterGoal).length;
  const sleeps=sortedDays().filter(d=>{const s=sleepHours(db.daily[d]);return s!==null&&s>=7;}).length;
  const distinctWeeks=new Set(list.filter(x=>getSession(x.week,x.key).finished).map(x=>x.week)).size;
  return [
   ['Первая тренировка','Ты завершил первое занятие',finished>=1,'🏁'],
   ['Пять тренировок','Регулярность приносит результат',finished>=5,'🔥'],
   ['Десять тренировок','Продолжаешь идти вперёд',finished>=10,'🏆'],
   ['Полная неделя','Четыре завершённые тренировки за неделю',Array.from({length:8},(_,i)=>list.filter(x=>x.week===i+1).every(x=>getSession(x.week,x.key).finished)).some(Boolean),'⭐'],
   ['Силовая база','Есть рабочие веса в 5 разных упражнениях',records.length>=5,'💪'],
   ['Гидратация','Пять дней достигнута личная цель по воде',waterDays>=5,'💧'],
   ['Качественный сон','Три записи сна от 7 часов',sleeps>=3,'🌙'],
   ['Тело под контролем','Есть три замера талии',seriesMetric('waist').length>=3,'📏']
  ].map(([title,desc,earned,emoji])=>({title,desc,earned,emoji}));
 }
 const allSessionForDate=d=>listSessions().filter(x=>x.date===d);
 function renderCalendar(){
  const [year,month]=ui.month.split('-').map(Number),first=new Date(year,month-1,1,12),offset=(first.getDay()+6)%7,last=new Date(year,month,0).getDate(),cells=Math.ceil((offset+last)/7)*7;
  const selected=allSessionForDate(view.date),today=todayISO(),dates=Array.from({length:cells},(_,i)=>dateIso(new Date(year,month-1,i-offset+1,12)));
  const monthName=first.toLocaleDateString('ru-RU',{month:'long',year:'numeric'});
  const achievements=statPills(),unlocked=achievements.filter(x=>x.earned).length;
  return `<div class="section-header"><div><span class="eyebrow">КАЛЕНДАРЬ И НАГРАДЫ</span><h2>Твой путь</h2><p class="sub mt-10">Всё, что ты уже сделал</p></div><span class="pill">${unlocked}/${achievements.length} наград</span></div>
  <section class="card calendar-card"><div class="cal-head"><button class="date-btn" data-action="cal-prev" aria-label="Предыдущий месяц">‹</button><h3>${h(monthName)}</h3><button class="date-btn" data-action="cal-next" aria-label="Следующий месяц">›</button></div>
  <div class="cal-grid">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(x=>`<span class="cal-wday">${x}</span>`).join('')}
  ${dates.map(date=>{const ss=allSessionForDate(date),trained=ss.some(x=>getSession(x.week,x.key).finished),started=ss.some(x=>calcSession(x.week,x.key).done>0),hasLogs=!!Object.keys(getDay(date)).length,active=isoMonth(date)===ui.month;
   return `<button class="cal-day ${active?'':'outside'} ${date===today?'is-today':''} ${date===view.date?'is-selected':''}" data-action="cal-day" data-date="${date}" aria-label="${h(fmtDate(date))}${ss.length?', тренировочный день':''}"><span>${parseDate(date).getDate()}</span><span class="cal-dot ${trained?'success':started?'ongoing':ss.length?'planned':hasLogs?'logged':''}"></span></button>`;}).join('')}</div>
  <div class="cal-legend"><span><i class="cal-dot success"></i> Завершено</span><span><i class="cal-dot ongoing"></i> В процессе</span><span><i class="cal-dot planned"></i> По плану</span></div></section>
  <section class="card"><div class="card-row"><div><div class="card-title">${h(fmtDate(view.date))}</div><strong>${selected.length?selected.map(x=>SESS_NAMES[x.key]).join(', '):'День восстановления'}</strong><span class="sub">${getDay(view.date).meals?.length||0} приёмов пищи · ${fmt(dayWater(view.date))} мл воды</span></div><button class="btn primary" data-action="cal-open-day">Открыть день</button></div>${selected.map(x=>`<div class="list-row"><div><strong>${h(SESS_NAMES[x.key])} · неделя ${x.week}</strong><span class="sub">${getSession(x.week,x.key).finished?'Завершено':calcSession(x.week,x.key).done?'Есть выполненные подходы':'Запланировано'}</span></div><button class="btn slim" data-action="go-workout" data-session="${x.id}">К залу</button></div>`).join('')}</section>
  <section class="card"><div class="card-row"><h3>Достижения</h3><span class="chip">${unlocked} открыто</span></div><div class="awards">${achievements.map(x=>`<div class="award ${x.earned?'earned':'locked'}"><span class="award-emoji">${x.emoji}</span><div><strong>${h(x.title)}</strong><span class="sub">${h(x.desc)}</span></div><span class="award-status">${x.earned?'✓':'🔒'}</span></div>`).join('')}</div></section>`;
 }
 function enhanceWorkout(){
  const root=document.getElementById('main'),{week,key}=initSession(),s=getSession(week,key),exercises=getExercises(week,key),date=sessionDate(week,key);
  const head=root.querySelector('.section-header');
  if(head)head.insertAdjacentHTML('afterend',`<div class="smart-head card"><div class="card-row"><div><strong>⚡ Умная тренировка</strong><span class="sub">Отмечай подходы — таймер включится сам</span></div><span class="chip">Версия 2.0</span></div>
  <div id="rest-timer" class="rest-timer" aria-live="off"></div><div class="timer-options">${[60,90,120,180].map(t=>`<button class="timer-choice ${ui.timerBase===t?'chosen':''}" data-action="timer-duration" data-sec="${t}">${t>=60?t/60+' мин':'60 сек'}</button>`).join('')}<button class="timer-choice" data-action="timer-stop">Стоп</button></div>
  <div class="date-override"><label for="session-date">Дата тренировки</label><input id="session-date" type="date" data-session-date data-week="${week}" data-key="${key}" value="${h(date)}"><button class="btn slim outline" data-action="date-reset" data-week="${week}" data-key="${key}">Сброс</button></div></div>`);
  const cards=root.querySelectorAll('.exercise-card');
  cards.forEach((card,ei)=>{const e=exercises[ei],sets=s.exercises?.[e.id]?.sets||[],previous=recentSession(week,key,e.name);
   const rows=card.querySelectorAll('.set-row');
   rows.forEach((row,i)=>{
    const st=sets[i]||{},done=setFinished(st);
    row.classList.add('smart-row');if(done)row.classList.add('row-done');
    row.insertAdjacentHTML('beforeend',`<button class="set-complete ${done?'completed':''}" data-action="toggle-set" data-week="${week}" data-key="${key}" data-ex="${e.id}" data-index="${i}" aria-label="${done?'Отменить выполнение':'Отметить выполнение'} подхода ${i+1}">${done?'✓':'○'}</button>`);
   });
   card.querySelector('.set-head')?.classList.add('smart-row');
   card.querySelector('.set-head')?.insertAdjacentHTML('beforeend','<span>Готово</span>');
   const hint=previous.length?`${previous.slice(0,3).map(p=>`${fmt(p.kg??0,1)} × ${fmt(p.reps)}`).join(' · ')}`:'';
   const controls=`<div class="smart-ex-actions">${previous.length?`<button class="btn slim outline" data-action="copy-prev-sets" data-week="${week}" data-key="${key}" data-ex="${e.id}">↙ Перенести прошлые веса</button>`:''}${hint?`<span class="helper">Прошлые подходы: ${h(hint)}</span>`:''}</div>`;
   card.querySelector('.rir-wrap')?.insertAdjacentHTML('beforebegin',controls);
  });
  updateRestTimer();
 }
 function updateRestTimer(){const t=document.getElementById('rest-timer');if(!t)return;const ms=(Number(db.ui.restUntil)||0)-Date.now();if(ms<=0){t.innerHTML=`<div class="timer-empty">⏱️ Отдых между подходами <span>${ui.timerBase} сек</span></div>`;return;}
   const sec=Math.ceil(ms/1000);const minutes=String(Math.floor(sec/60)).padStart(2,'0'),seconds=String(sec%60).padStart(2,'0');
   t.innerHTML=`<div class="timer-now"><span class="timer-pulse">●</span><span>Отдых</span><strong>${minutes}:${seconds}</strong><button class="btn slim" data-action="timer-stop">Готов</button></div>`;
 }
 function recordAchievements(){const x=statPills();return x.filter(k=>k.earned).length;}
 function enhanceToday(){const root=document.getElementById('main');root.insertAdjacentHTML('beforeend',`<section class="card compact-cta"><div class="card-row"><div><div class="card-title">📅 План и достижения</div><strong>${recordAchievements()} наград открыто</strong><span class="sub">Календарь, привычки, история</span></div><button class="btn primary" data-action="open-calendar">Смотреть</button></div></section>`);}
 function enhanceFood(){const root=document.getElementById('main');const existing=dayMeals();const fav=db.favorites;
  const fragment=`<section class="card"><div class="card-row"><div><h3>Быстро добавить</h3><span class="sub">Любимые блюда без повторного ввода</span></div><span class="pill">${fav.length} избранных</span></div><div class="favorite-grid">${fav.length?fav.map((m,i)=>`<button class="favorite" data-action="add-favorite" data-index="${i}"><span>＋</span><strong>${h(m.name)}</strong><small>${m.cal==null?'Без ккал':fmt(m.cal)+' ккал'}</small></button>`).join(''):'<p class="helper">Сохрани блюдо из дневника ⭐ — оно появится здесь.</p>'}</div><div class="actions mt-16"><button class="btn outline" data-action="copy-yesterday-food">↷ Повторить вчерашнее меню</button></div></section>`;
  root.querySelector('.grid2')?.insertAdjacentHTML('beforebegin',fragment);
  const listCard=root.querySelectorAll('.card');const mealCard=listCard[listCard.length-1];
  if(mealCard){const rows=mealCard.querySelectorAll('.list-row');rows.forEach((row,i)=>{
   const m=existing[i];if(!m)return;const isFav=fav.some(x=>x.name===m.name&&x.type===m.type&&x.cal===m.cal&&x.protein===m.protein);
   const del=row.querySelector('[data-action="delete-meal"]');
   if(del)del.insertAdjacentHTML('beforebegin',`<button class="btn slim outline favorite-toggle" data-action="toggle-favorite" data-index="${i}" aria-label="${isFav?'Убрать из избранного':'Сохранить в избранное'}">${isFav?'★':'☆'}</button><button class="btn slim outline" data-action="edit-meal" data-index="${i}">✎</button>`);
  });}
  const food=dayFood(),counted=existing.filter(x=>x.cal!=null).length;
  const first=Array.from(root.querySelectorAll('.card')).find(x=>x.textContent.includes('Калории за день'));
  if(first)first.insertAdjacentHTML('beforeend',`<div class="macro-grid">${[['Белки','protein',150],['Жиры','fat',70],['Углеводы','carbs',250]].map(([lab,key,goal])=>`<div><span>${lab}</span><strong>${fmt(food[key])} г</strong>${bar(food[key],key==='protein'?db.settings.proteinGoal:goal)}</div>`).join('')}</div><p class="helper">${counted<existing.length?'Не у всех блюд указаны калории и БЖУ. Итоги неполные.':'Все блюда за день имеют введённые калории.'} Приложение не определяет БЖУ по названию автоматически.</p>`);
 }
 function enhanceHealth(){const root=document.getElementById('main'),dates=sortedDays(),end=dates.slice(-7),sleep= end.map(x=>sleepHours(db.daily[x])).filter(x=>x!=null),water=end.filter(d=>db.daily[d].water?.length).map(d=>dayWater(d));
  root.insertAdjacentHTML('beforeend',`<section class="card"><div class="card-title">📈 Восстановление — записи за 7 дней</div><div class="grid2">${metric(sleep.length?fmt(avg(sleep),1):'—','ч','Средний сон')}${metric(water.length?fmt(avg(water)):'—','мл','Средняя вода')}</div>${chart(sleepSeries(),'ч','Сон по датам')}<p class="helper">Средние значения считаются только по заполненным дням. Приложение не назначает препараты и дозировки.</p><button class="btn outline mt-16" data-action="copy-yesterday-meds">↷ Повторить вчерашний список препаратов</button></section>`);
 }
 function enhanceProgress(){const root=document.getElementById('main'),recs=sessionPR(),weights=seriesMetric('weight'),waist=seriesMetric('waist'),sleep=sleepSeries(),str=strengthProgress(view.exercise).map(x=>({date:x.date,value:x.max}));
  const chartData={strength:str,weight:weights,waist,sleep}[ui.chart];const chartUnit=ui.chart==='sleep'?'ч':ui.chart==='waist'?'см':'кг';
  const heading=`<section class="card"><div class="card-row"><div><h3>Твои графики</h3><p class="sub">Сравнивай показатели по датам</p></div><span class="chip">${chartData.length} точек</span></div>
  <div class="switchers mt-16">${[['strength','Сила'],['weight','Вес'],['waist','Талия'],['sleep','Сон']].map(([x,t])=>`<button class="switch-btn ${ui.chart===x?'selected':''}" data-action="chart-mode" data-chart="${x}">${t}</button>`).join('')}</div>${chart(chartData,chartUnit,'График '+ui.chart)}<p class="helper">Только введённые данные, без прогнозов и автоматических оценок здоровья.</p></section>`;
  root.querySelector('.grid2')?.insertAdjacentHTML('afterend',heading);
  root.insertAdjacentHTML('beforeend',`<section class="card"><div class="card-row"><div><h3>🏅 Личные рекорды</h3><span class="sub">Самый большой записанный рабочий вес</span></div><span class="pill">${recs.length}</span></div>
  ${recs.length?recs.map(r=>`<div class="list-row"><div><strong>${h(r.name)}</strong><span class="sub">${h(fmtDateShort(r.date))} · ${r.reps} повторений</span></div><strong class="accent">${fmt(r.kg,1)} кг</strong></div>`).join(''):'<div class="empty">Запиши первые рабочие подходы, чтобы увидеть рекорды.</div>'}</section>
  <section class="card" id="photo-section"><div class="card-row"><div><h3>📸 Фото формы</h3><span class="sub">Только на твоём устройстве</span></div><button class="btn primary" data-action="new-photo">+ Фото</button></div>
  <p class="helper mt-10">Фотографии сохраняются отдельно в браузере. В полную резервную копию JSON включаются изображения — держи её в закрытом месте.</p>
  <div class="photo-grid">${db.photos.length?db.photos.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(p=>`<div class="photo-card"><div class="photo-thumb" data-photo="${h(p.id)}"><span>Фото загружается…</span></div><div class="photo-caption"><strong>${h(fmtDateShort(p.date))}</strong><span>${h(p.pose||'Фото')}</span></div><button class="photo-delete" data-action="delete-photo" data-id="${h(p.id)}" aria-label="Удалить фото">×</button></div>`).join(''):'<div class="empty">Добавь первое фото для сравнения формы через несколько недель.</div>'}</div>
  <div class="mini-divider"></div><h3>Замеры тела</h3><p class="helper">Записывай вес и талию в разделе «Здоровье», здесь они отобразятся автоматически.</p><div class="grid2 mt-16">${metric(weights.length?fmt(weights.at(-1).value,1):'—','кг','Последний вес')}${metric(waist.length?fmt(waist.at(-1).value,1):'—','см','Последняя талия')}</div>${chart(waist,'см','Талия по датам')}</section>`);
  if(db.photos.length>=2){
   const photos=db.photos.slice().sort((a,b)=>a.date.localeCompare(b.date));
   if(!photos.some(p=>p.id===ui.photoLeft))ui.photoLeft=photos[0].id;
   if(!photos.some(p=>p.id===ui.photoRight))ui.photoRight=photos.at(-1).id;
   const picks=(side,current)=>`<select data-compare-side="${side}" aria-label="Фото ${side==='left'?'до':'после'}">${photos.map(p=>`<option value="${h(p.id)}" ${p.id===current?'selected':''}>${h(fmtDateShort(p.date))} · ${h(p.pose)}</option>`).join('')}</select>`;
   root.querySelector('#photo-section .photo-grid').insertAdjacentHTML('beforebegin',`<div class="photo-compare"><h3>Сравнение формы</h3><p class="helper">Выбери два снимка и сравни изменения визуально.</p><div class="compare-grid"><div><label class="label">До</label>${picks('left',ui.photoLeft)}<div class="compare-image" data-photo="${h(ui.photoLeft)}">Фото загружается…</div></div><div><label class="label">После</label>${picks('right',ui.photoRight)}<div class="compare-image" data-photo="${h(ui.photoRight)}">Фото загружается…</div></div></div></div>`);
  }
  loadPhotoThumbs();
 }
 render=function(){
  // Наследуем исходные экраны; их модель данных и действия не меняются.
  if(view.tab==='calendar'){
   document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab==='calendar'));
   document.getElementById('main').innerHTML=renderCalendar();return;
  }
  baseRender();
  if(view.tab==='workout')enhanceWorkout();
  if(view.tab==='today')enhanceToday();
  if(view.tab==='food')enhanceFood();
  if(view.tab==='health')enhanceHealth();
  if(view.tab==='progress')enhanceProgress();
 };
 function startRestTimer(){db.ui.restUntil=Date.now()+ui.timerBase*1000;save();updateRestTimer();}
 function showPhotoForm(){modal(`${modalTitle('Фото прогресса')}<form id="photo-form" class="form-grid"><label class="span2"><span class="label">Выбери фото *</span><input type="file" name="photo" accept="image/*" required></label><label><span class="label">Дата</span><input type="date" name="date" value="${h(view.date)}" required></label><label><span class="label">Ракурс</span><select name="pose"><option>Спереди</option><option>Сбоку</option><option>Сзади</option><option>Другое</option></select></label><label class="span2"><span class="label">Заметка (необязательно)</span><input name="note" maxlength="120" placeholder="После тренировки, утром…"></label><p class="helper span2">Фото уменьшится до 1000 пикселей по длинной стороне. Оно не отправляется на сервер.</p><button class="btn primary full span2" type="submit">Сохранить фото</button></form>`);}
 function showEditMeal(index){const m=dayMeals()[index];if(!m)return;modal(`${modalTitle('Изменить блюдо')}<form id="edit-meal-form" data-index="${index}" class="form-grid"><label class="span2"><span class="label">Название</span><input name="name" value="${h(m.name)}" required maxlength="120"></label><label><span class="label">Калории</span><input name="cal" type="number" min="0" max="10000" value="${h(m.cal??'')}"></label><label><span class="label">Белок, г</span><input name="protein" type="number" min="0" step="0.1" value="${h(m.protein??'')}"></label><label><span class="label">Жиры, г</span><input name="fat" type="number" min="0" step="0.1" value="${h(m.fat??'')}"></label><label><span class="label">Углеводы, г</span><input name="carbs" type="number" min="0" step="0.1" value="${h(m.carbs??'')}"></label><button class="btn primary full span2" type="submit">Сохранить изменения</button></form>`);}
 handleAction=function(el){const action=el.dataset.action;
  if(action==='open-calendar'){view.tab='calendar';ui.month=isoMonth(view.date);render();return;}
  if(action==='cal-prev'||action==='cal-next'){const [y,m]=ui.month.split('-').map(Number),d=new Date(y,m-1+(action==='cal-prev'?-1:1),1,12);ui.month=dateIso(d).slice(0,7);render();return;}
  if(action==='cal-day'){view.date=el.dataset.date;render();return;}
  if(action==='cal-open-day'){view.tab='today';render();return;}
  if(action==='timer-duration'){ui.timerBase=Number(el.dataset.sec)||90;render();return;}
  if(action==='timer-stop'){db.ui.restUntil=0;save();updateRestTimer();return;}
  if(action==='date-reset'){const {week,key}=el.dataset;delete ensureSession(+week,key).scheduledDate;save();render();return;}
  if(action==='copy-prev-sets'){const {week,key,ex}=el.dataset,exercise=getExercises(+week,key).find(x=>x.id===ex);if(!exercise)return;const old=recentSession(+week,key,exercise.name),entry=ensureSession(+week,key).exercises[ex]??(ensureSession(+week,key).exercises[ex]={sets:[]});
   for(let i=0;i<Math.min(old.length,exercise.sets);i++){entry.sets[i]??={};if(entry.sets[i].done)continue;if(entry.sets[i].kg==null)entry.sets[i].kg=old[i].kg;if(entry.sets[i].reps==null)entry.sets[i].reps=old[i].reps;entry.sets[i].done=false;}
   save();render();toast('Предыдущие веса подставлены — проверь и выполни подходы');return;
  }
  if(action==='toggle-set'){
   const {week,key,ex,index}=el.dataset,s=ensureSession(+week,key),entry=s.exercises[ex]??(s.exercises[ex]={sets:[]});while(entry.sets.length<=Number(index))entry.sets.push({});const st=entry.sets[Number(index)];
   if(!st.done&&!isFilled(st)){toast('Сначала введи повторения или секунды');return;}
   st.done=!st.done;save();render();if(st.done)startRestTimer();return;
  }
  if(action==='chart-mode'){ui.chart=el.dataset.chart;render();return;}
  if(action==='new-photo'){showPhotoForm();return;}
  if(action==='delete-photo'){if(!confirm('Удалить это фото без возможности восстановления?'))return;deletePhoto(el.dataset.id);return;}
  if(action==='toggle-favorite'){
   const m=dayMeals()[+el.dataset.index];if(!m)return;const id=db.favorites.findIndex(x=>x.name===m.name&&x.type===m.type&&x.cal===m.cal&&x.protein===m.protein);
   if(id>=0)db.favorites.splice(id,1);else db.favorites.push({...m});save();render();toast(id>=0?'Убрано из избранного':'Добавлено в избранное');return;
  }
  if(action==='add-favorite'){const m=db.favorites[+el.dataset.index];if(!m)return;const d=ensureDay();d.meals??=[];d.meals.push({...m});save();render();toast('Любимое блюдо добавлено');return;}
  if(action==='edit-meal'){showEditMeal(+el.dataset.index);return;}
  if(action==='copy-yesterday-food'){const prev=dayMeals(shiftDay(view.date,-1));if(!prev.length){toast('За вчера нет записей еды');return;}if(!confirm(`Добавить ${prev.length} вчерашних записей к сегодняшним?`))return;const d=ensureDay();d.meals??=[];d.meals.push(...prev.map(x=>({...x})));save();render();toast('Вчерашние блюда добавлены');return;}
  if(action==='copy-yesterday-meds'){const prev=getDay(shiftDay(view.date,-1)).meds||[];if(!prev.length){toast('За вчера нет записей препаратов');return;}if(!confirm(`Скопировать ${prev.length} позиций в список на сегодня? Отметки приёма будут сняты. Принимай препараты только по назначенной схеме.`))return;
    const d=ensureDay();d.meds??=[];d.meds.push(...prev.map(x=>({...x,taken:false})));save();render();toast('Список скопирован без отметок приёма');return;}
  return baseAction(el);
 };
 showSettings=function(){baseSettings();const modalBox=document.querySelector('.modal-box');if(!modalBox)return;
  const note=modalBox.querySelector('.sub:last-of-type');if(note&&note.textContent.includes('Версия 1.0'))note.textContent='Версия 2.0 · Локальный дневник без аккаунта и без облачной синхронизации.';
  modalBox.insertAdjacentHTML('beforeend',`<div class="mini-divider"></div><div class="card-title">🛡️ Фото и резервное копирование</div><p class="helper">Полный экспорт содержит фото, упражнения, приёмы пищи, препараты и замеры. Этот JSON не публикуй на GitHub и не отправляй посторонним.</p><p class="helper">Во время обновления сайта не очищай историю Safari и не удаляй иконку приложения. Сначала сделай резервную копию.</p>`);
 };
 // IndexedDB: личные фотографии хранятся отдельно от ограниченного localStorage.
 function photoDB(){return new Promise((resolve,reject)=>{if(!('indexedDB'in window)){reject(Error('Браузер не поддерживает хранилище фото'));return;}
   const req=indexedDB.open(V2PHOTO,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('pictures'))req.result.createObjectStore('pictures',{keyPath:'id'});};req.onerror=()=>reject(req.error);req.onsuccess=()=>resolve(req.result);
 });}
 async function photoWrite(id,dataUrl){const idb=await photoDB();return new Promise((resolve,reject)=>{const tx=idb.transaction('pictures','readwrite');tx.objectStore('pictures').put({id,dataUrl});tx.oncomplete=()=>{idb.close();resolve();};tx.onerror=()=>{idb.close();reject(tx.error);};});}
 async function photoRead(id){const idb=await photoDB();return new Promise((resolve,reject)=>{const tx=idb.transaction('pictures','readonly'),req=tx.objectStore('pictures').get(id);req.onsuccess=()=>{idb.close();resolve(req.result?.dataUrl||null);};req.onerror=()=>{idb.close();reject(req.error);};});}
 async function photoRemove(id){const idb=await photoDB();return new Promise((resolve,reject)=>{const tx=idb.transaction('pictures','readwrite');tx.objectStore('pictures').delete(id);tx.oncomplete=()=>{idb.close();resolve();};tx.onerror=()=>{idb.close();reject(tx.error);};});}
 async function loadPhotoThumbs(){for(const el of document.querySelectorAll('[data-photo]')){const id=el.dataset.photo;try{const url=await photoRead(id);if(!url||!el.isConnected)continue;const image=document.createElement('img');image.loading='lazy';image.alt='Фото прогресса, личная запись';image.src=url;el.replaceChildren(image);}catch(e){el.textContent='Нет доступа к фото';}}}
 function processImage(file){return new Promise((resolve,reject)=>{if(file.size>15*1024*1024){reject(Error('Выбери изображение меньше 15 МБ'));return;}
    const url=URL.createObjectURL(file),im=new Image();im.onload=()=>{URL.revokeObjectURL(url);try{const scale=Math.min(1,1000/Math.max(im.width,im.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(im.width*scale));canvas.height=Math.max(1,Math.round(im.height*scale));canvas.getContext('2d').drawImage(im,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',.72));}catch(e){reject(e);}};im.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Не удалось прочитать фото. Попробуй JPEG или PNG.'));};im.src=url;
  });}
 async function savePhoto(file,date,pose,note){const url=await processImage(file);const id=`p${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`;await photoWrite(id,url);db.photos.push({id,date,pose,note});save();closeModal();render();toast('Фото сохранено на устройстве');}
 async function deletePhoto(id){try{await photoRemove(id);db.photos=db.photos.filter(x=>x.id!==id);save();render();toast('Фото удалено');}catch(e){alert('Не удалось удалить фото: '+e.message);}}
 // Полная резервная копия v2 включает фотографии; старые JSON v1 также импортируются.
 downloadBackup=async function(){try{
  const photosData=[];for(const p of db.photos){const image=await photoRead(p.id);if(!image)throw Error('Не удалось получить фото '+p.id+'. Резервная копия не создана.');photosData.push({id:p.id,dataUrl:image});}
  const raw=JSON.stringify({...db,version:2,photosData,exportedAt:new Date().toISOString()}),a=document.createElement('a'),url=URL.createObjectURL(new Blob([raw],{type:'application/json;charset=utf-8'}));
  a.href=url;a.download=`moy-progress-full-${todayISO()}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);toast('Полная резервная копия готова');
  }catch(e){alert('Не удалось сохранить резервную копию: '+e.message);}
 };
 importData=async function(data){if(!data||typeof data!=='object'||!data.workouts||!data.daily||Array.isArray(data.daily)||Array.isArray(data.workouts)||typeof data.workouts!=='object'||typeof data.daily!=='object')throw Error('Неподдерживаемый файл дневника');
  const partial=data.kind==='fittrack-import';if(!partial&&!confirm('Восстановить резервную копию? Текущие тренировки, питание и замеры будут заменены. Рекомендуем сначала экспортировать текущую копию.'))return false;
  const next=partial?{...db,workouts:{...db.workouts,...data.workouts},daily:{...db.daily}}:{...structuredClone(DEFAULTS),...data,settings:{...DEFAULTS.settings,...(data.settings||{})},favorites:Array.isArray(data.favorites)?data.favorites:[],photos:Array.isArray(data.photos)?data.photos:db.photos};
  if(partial)for(const [date,entry] of Object.entries(data.daily))next.daily[date]={...(next.daily[date]||{}),...entry};
  if(!partial&&Array.isArray(data.photosData)){
    for(const p of data.photosData){if(typeof p.id!=='string'||typeof p.dataUrl!=='string'||!p.dataUrl.startsWith('data:image/'))throw Error('Повреждённые данные фотографии');await photoWrite(p.id,p.dataUrl);}
  }
  // Старый JSON не содержит фотографий: не удаляем имеющиеся фото и их хранилище.
  next.photos=Array.isArray(next.photos)?next.photos:[];
  next.version=2;next.migratedV2=true;next.ui=next.ui||{};
  for(const ses of Object.values(next.workouts))for(const ex of Object.values(ses?.exercises||{}))for(const st of ex?.sets||[])if(st&&st.done===undefined&&isFilled(st))st.done=true;
  db=next;save();closeModal();render();toast('Данные успешно импортированы');return true;
 };
 // Сохраняем ввод без перерисовки: на iPhone это не закрывает клавиатуру между подходами.
 function persistInline(el){
  if(el.matches('[data-set-field]')){
    const {week,key,ex,set:idx,setField}=el.dataset,session=ensureSession(+week,key),entry=session.exercises[ex]??(session.exercises[ex]={sets:[]});
    while(entry.sets.length<=+idx)entry.sets.push({});
    entry.sets[+idx][setField]=nonneg(el.value,setField==='kg'?2000:500);
    if(entry.sets[+idx].done===true)entry.sets[+idx].done=false; // Изменённый подход перепроверяем перед учётом
    save();return true;
  }
  if(el.matches('[data-dayfield]')){
    const key=el.dataset.dayfield;if(key==='note')return false;
    const d=ensureDay();if(['sleepStart','sleepEnd'].includes(key))d[key]=el.value;
    else if(['mood','sleepQuality','steps','weight','waist'].includes(key))d[key]=nonneg(el.value,key==='steps'?100000:500);
    save();return true;
  }
  return false;
 }
 document.addEventListener('change',e=>{if(persistInline(e.target))e.stopImmediatePropagation();},true);
 document.addEventListener('input',e=>{if(e.target.matches('[data-set-field], input[data-dayfield]'))persistInline(e.target);},true);
 // События для новых форм и полей; старые события app.js продолжают работать.
 document.addEventListener('change',e=>{const el=e.target;
   if(el.matches('[data-compare-side]')){ui[el.dataset.compareSide==='left'?'photoLeft':'photoRight']=el.value;render();return;}
   if(el.matches('[data-session-date]')){if(!parseDate(el.value)||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(el.value)){toast('Укажи дату');return;}ensureSession(+el.dataset.week,el.dataset.key).scheduledDate=el.value;save();render();toast('Тренировка перенесена');}
 });
 document.addEventListener('submit',async e=>{const form=e.target;if(form.id==='photo-form'){
   e.preventDefault();const f=new FormData(form),file=f.get('photo');if(!(file instanceof File)||!file.size){toast('Выбери фото');return;}const btn=form.querySelector('[type="submit"]');btn.disabled=true;btn.textContent='Сохранение…';
   try{await savePhoto(file,String(f.get('date')),String(f.get('pose')),String(f.get('note')||'').slice(0,120));}catch(err){alert('Фото не сохранено: '+err.message);btn.disabled=false;btn.textContent='Сохранить фото';}
  }else if(form.id==='edit-meal-form'){
   e.preventDefault();const f=new FormData(form),idx=+form.dataset.index,d=ensureDay();if(!d.meals?.[idx])return;const name=String(f.get('name')||'').trim();if(!name){toast('Укажи блюдо');return;}
   Object.assign(d.meals[idx],{name,cal:nonneg(f.get('cal'),10000),protein:nonneg(f.get('protein'),1000),fat:nonneg(f.get('fat'),1000),carbs:nonneg(f.get('carbs'),1000)});
   save();closeModal();render();toast('Блюдо изменено');
  }
 });
 // Тикающий таймер обновляет только время, не перерисовывает введённые значения.
 setInterval(()=>{if(view.tab==='workout')updateRestTimer();},1000);
 render();
})();
