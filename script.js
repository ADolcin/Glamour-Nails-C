/* ---------------- UI FEEDBACK: TOAST / ALERT / CONFIRM ---------------- */
function showToast(msg, type){
  type = type || 'success';
  const icons = {success:'✓', error:'✕', info:'i'};
  const stack = document.getElementById('toastStack');
  const el = document.createElement('div');
  el.className = 'toast toast-'+type;
  el.innerHTML = `<span class="t-ic">${icons[type]||'✓'}</span><span>${msg}</span>`;
  stack.appendChild(el);
  requestAnimationFrame(()=>el.classList.add('show'));
  setTimeout(()=>{ el.classList.remove('show'); setTimeout(()=>el.remove(), 300); }, 3200);
}
function showAlert(msg){
  document.getElementById('alertModalMsg').textContent = msg;
  document.getElementById('alertModalOverlay').classList.add('open');
}
function closeAlertModal(){ document.getElementById('alertModalOverlay').classList.remove('open'); }
let _confirmCallback = null;
function showConfirm(msg, cb){
  document.getElementById('confirmModalMsg').textContent = msg;
  _confirmCallback = cb;
  document.getElementById('confirmModalOverlay').classList.add('open');
}
function confirmYes(){
  document.getElementById('confirmModalOverlay').classList.remove('open');
  const cb = _confirmCallback; _confirmCallback = null;
  if(cb) cb();
}
function confirmNo(){
  document.getElementById('confirmModalOverlay').classList.remove('open');
  _confirmCallback = null;
}

/* ---------------- DATA LAYER ---------------- */
const STORAGE_KEY = 'gnc_appointments_v3';
const CLIENTS_KEY = 'gnc_clients_v3';

function pad(n){return n.toString().padStart(2,'0');}
function todayISO(){const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;}
function loadAppts(){
  let raw = localStorage.getItem(STORAGE_KEY);
  if(!raw){
    const seed = seedData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }
  return JSON.parse(raw);
}
function saveAppts(list){ localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); scheduleCloudPush(); }
function loadClients(){
  let raw = localStorage.getItem(CLIENTS_KEY);
  if(!raw){
    const seed = [];
    localStorage.setItem(CLIENTS_KEY, JSON.stringify(seed));
    return seed;
  }
  return JSON.parse(raw);
}
function saveClients(){ localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients)); scheduleCloudPush(); }

function offsetDate(days){
  const d = new Date(); d.setDate(d.getDate()+days);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

const COLORS = {
  'Confirmada': '#DFF3E3',
  'Pendiente': '#FDECC8',
  'Completada': '#E9D8FD',
  'Cancelada': '#FBDADA'
};

function seedData(){
  return [];
}

let appts = loadAppts();
let clients = loadClients();

/* ---------------- NAV ---------------- */
const SIDEBAR_STATE_KEY = 'gnc_sidebar_collapsed_v1';
const titles = {inicio:'Panel de control', citas:'Agenda de citas', clientes:'Clientes', servicios:'Servicios', finanzas:'Finanzas', inventario:'Inventario', reportes:'Reportes', ajustes:'Ajustes'};
function applySidebarState(){
  const collapsed = localStorage.getItem(SIDEBAR_STATE_KEY)==='true';
  document.body.classList.toggle('sidebar-collapsed', collapsed);
  const btn = document.getElementById('sidebarToggle');
  const icon = document.getElementById('sidebarToggleIcon');
  if(btn) btn.setAttribute('aria-label', collapsed ? 'Mostrar menú' : 'Esconder menú');
  if(icon){
    icon.innerHTML = collapsed
      ? '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>'
      : '<path d="M4 6h16M4 12h16M4 18h16"/>';
  }
}
function toggleSidebar(){
  const collapsed = !document.body.classList.contains('sidebar-collapsed');
  localStorage.setItem(SIDEBAR_STATE_KEY, String(collapsed));
  applySidebarState();
}
function goTo(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+page).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.querySelector(`.nav-item[data-page="${page}"]`).classList.add('active');
  document.getElementById('topbarTitle').textContent = '';
  if(page==='inicio') renderInicio();
  if(page==='citas') renderWeek();
  if(page==='clientes') renderClientesPage();
  if(page==='servicios') renderServiciosPage();
  if(page==='finanzas') renderFinanzasPage();
  if(page==='inventario') renderInventarioPage();
  if(page==='reportes') renderReportesPage();
  if(page==='ajustes') renderAjustesPage();
}

/* ---------------- INICIO RENDER ---------------- */
function renderInicio(){
  const today = todayISO();
  const todays = appts.filter(a=>a.date===today);
  document.getElementById('statCitasHoy').textContent = todays.length;
  const ingresoBase = {'Manicure Clásica':650,'Manicure Spa':650,'Pedicura Spa':750,'Uñas Acrílicas':1200,'Uñas en Gel':1200,'Manicure Acrílica':1200,'Manicure + Gel':900,'Gel Polish':600,'Diseño de Uñas':800,'Retiro de Acrílicas':500};
  const ingresosHoy = todays.filter(a=>a.status!=='Cancelada').reduce((s,a)=>s+(ingresoBase[a.service]||700),0);
  document.getElementById('statIngresosHoy').textContent = 'RD$ '+ingresosHoy.toLocaleString();
  document.getElementById('statClientes').textContent = clients.length;
  document.getElementById('statServicios').textContent = appts.filter(a=>a.status!=='Cancelada').length;

  // proximas citas: today + future, sorted
  const upcoming = appts.filter(a=>a.date>=today).sort((a,b)=> (a.date+a.time).localeCompare(b.date+b.time)).slice(0,4);
  const box = document.getElementById('proximasCitas');
  box.innerHTML = upcoming.length ? upcoming.map(a=>apptRowHTML(a)).join('') : `<div class="empty-state"><b>Agenda libre</b>No hay citas próximas registradas. Crea la primera cita del día para empezar a mover tu agenda.<br><button onclick="openModal()">Crear cita</button></div>`;

  // mini calendar
  renderMiniCal();

  // bar chart - last 7 days income
  const days = [];
  for(let i=6;i>=0;i--) days.push(offsetDate(-i));
  const dayLabels = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  let max = 1;
  const totals = days.map(d=>{
    const t = appts.filter(a=>a.date===d && a.status!=='Cancelada').reduce((s,a)=>s+(ingresoBase[a.service]||700),0);
    if(t>max) max=t;
    return t;
  });
  const barBox = document.getElementById('barChart');
  barBox.innerHTML = totals.map((t,i)=>{
    const h = Math.max(6, Math.round((t/max)*130));
    const dow = new Date(days[i]+'T00:00:00').getDay();
    const isToday = days[i]===today;
    return `<div class="bar-col ${isToday?'peak':''}"><div class="bar" style="height:${h}px;"></div><div class="bar-lbl">${dayLabels[dow]}</div></div>`;
  }).join('');
  const weekTotal = totals.reduce((a,b)=>a+b,0);
  document.getElementById('ingresosSemana').textContent = 'RD$ '+weekTotal.toLocaleString();
  document.getElementById('tendenciaSemana').textContent = weekTotal>0 ? '+ ingresos esta semana' : 'Sin ingresos aún esta semana';

  // servicios populares
  const counts = {};
  appts.forEach(a=>{ if(a.status!=='Cancelada') counts[a.service]=(counts[a.service]||0)+1; });
  const top = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,3);
  const svgIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.5 12.5 12 21l-8.5-8.5A5.5 5.5 0 0 1 11 4.9l1 1 1-1a5.5 5.5 0 0 1 7.5 7.6Z"/></svg>`;
  const popBox = document.getElementById('serviciosPopulares');
  popBox.innerHTML = top.length ? top.map(([name,count])=>`
    <div class="service-card">
      <div class="service-thumb">${svgIcon}</div>
      <div class="service-name">${name}</div>
      <div class="service-count">${count}</div>
      <div class="service-count-lbl">Servicios</div>
    </div>`).join('') : `<div class="empty-state" style="grid-column:1/-1;"><b>Aún no hay favoritos</b>Cuando completes citas, aquí verás qué servicios se venden más.</div>`;

  // recordatorios (editable) + recordatorio dinámico de citas pendientes
  const pendCount = appts.filter(a=>a.status==='Pendiente').length;
  let remindersHTML = '';
  if(pendCount>0){
    remindersHTML += `<div class="reminder-row">
      <div class="reminder-icon">📌</div>
      <div style="flex:1;">${pendCount} cita${pendCount===1?'':'s'} pendiente${pendCount===1?'':'s'} por confirmar</div>
    </div>`;
  }
  remindersHTML += reminders.map(r=>`
    <div class="reminder-row">
      <div class="reminder-icon">${r.icon}</div>
      <div style="flex:1;">${r.text}</div>
      <div class="reminder-del" onclick="deleteReminder(${r.id})">✕</div>
    </div>`).join('');
  document.getElementById('recordatoriosList').innerHTML = remindersHTML || `<div class="empty-state"><b>Todo tranquilo</b>No tienes recordatorios pendientes.</div>`;
  refreshPrivateHealth();
  renderNotifications();
}
function addReminder(){
  const input = document.getElementById('newReminderInput');
  const val = input.value.trim();
  if(!val) return;
  reminders.push({id:Date.now(), icon:'📌', text:val});
  persist(REMINDERS_KEY, reminders);
  input.value='';
  renderInicio();
  showToast('Recordatorio agregado');
}
function deleteReminder(id){
  reminders = reminders.filter(r=>r.id!==id);
  persist(REMINDERS_KEY, reminders);
  renderInicio();
  renderNotifications();
}

function apptRowHTML(a){
  const badgeClass = a.status==='Confirmada'?'badge-confirmed':a.status==='Pendiente'?'badge-pending':a.status==='Completada'?'badge-completed':'badge-cancelled';
  const dLabel = a.date===todayISO() ? 'Hoy' : new Date(a.date+'T00:00:00').toLocaleDateString('es-DO',{day:'numeric',month:'short'});
  return `<div class="appt-row">
    <div class="appt-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4.5" width="18" height="16" rx="2"/></svg></div>
    <div class="appt-time">${a.time}<br><span style="font-weight:400;">${dLabel}</span></div>
    <div class="appt-info"><div class="appt-name">${a.client}</div><div class="appt-service">${a.service}</div>${apptQuickActionsHTML(a)}</div>
    <span class="badge ${badgeClass}">${a.status}</span>
  </div>`;
}
function apptQuickActionsHTML(a, compact){
  const paidAction = a.paid ? '' : `<button class="mini-action green" onclick="event.stopPropagation(); markApptPaid(${a.id})">Cobrar</button>`;
  const completeAction = a.status==='Completada' ? '' : `<button class="mini-action" onclick="event.stopPropagation(); updateApptStatus(${a.id}, 'Completada')">Completar</button>`;
  const cancelAction = a.status==='Cancelada' ? '' : `<button class="mini-action dark" onclick="event.stopPropagation(); updateApptStatus(${a.id}, 'Cancelada')">Cancelar</button>`;
  return `<div class="${compact?'appt-quick-actions compact':'appt-quick-actions'}">
    <button class="mini-action" onclick="event.stopPropagation(); openModal(null,null,${a.id})">Editar</button>
    <button class="mini-action" onclick="event.stopPropagation(); remindApptWhatsApp(${a.id})">WhatsApp</button>
    ${completeAction}
    ${paidAction}
    ${cancelAction}
  </div>`;
}

/* mini calendar */
let miniCalDate = new Date();
function renderMiniCal(){
  const y = miniCalDate.getFullYear(), m = miniCalDate.getMonth();
  document.getElementById('miniCalLabel').textContent = miniCalDate.toLocaleDateString('es-DO',{month:'long',year:'numeric'});
  const first = new Date(y,m,1);
  const startDow = first.getDay();
  const daysInMonth = new Date(y,m+1,0).getDate();
  const daysInPrev = new Date(y,m,0).getDate();
  let html = ['Do','Lu','Ma','Mi','Ju','Vi','Sá'].map(d=>`<div class="dow">${d}</div>`).join('');
  for(let i=startDow-1;i>=0;i--) html += `<div class="cal-day muted">${daysInPrev-i}</div>`;
  const todayD = new Date();
  const markedDays = new Set([...appts.map(a=>a.date), ...events.map(e=>e.date)]);
  for(let d=1; d<=daysInMonth; d++){
    const isToday = d===todayD.getDate() && m===todayD.getMonth() && y===todayD.getFullYear();
    const iso = `${y}-${pad(m+1)}-${pad(d)}`;
    const hasEvent = markedDays.has(iso);
    html += `<div class="cal-day ${isToday?'today':''} ${hasEvent?'has-event':''}">${d}</div>`;
  }
  const remain = (7 - (html.match(/cal-day/g)||[]).length % 7) % 7;
  for(let i=1;i<=remain;i++) html += `<div class="cal-day muted">${i}</div>`;
  document.getElementById('miniCalGrid').innerHTML = html;
}
function miniCalNav(dir){ miniCalDate.setMonth(miniCalDate.getMonth()+dir); renderMiniCal(); }

/* ---------------- CITAS / WEEK VIEW ---------------- */
let weekStart = startOfWeek(new Date());
function startOfWeek(d){
  const nd = new Date(d);
  const day = nd.getDay();
  nd.setDate(nd.getDate()-day);
  nd.setHours(0,0,0,0);
  return nd;
}
function weekNav(dir){ weekStart.setDate(weekStart.getDate()+7*dir); renderWeek(); }
function goToday(){ weekStart = startOfWeek(new Date()); renderWeek(); }

function fmtISO(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function isValidPhone(value){
  if(!value) return true;
  return value.replace(/\D/g,'').length >= 10;
}
function setCalendarView(mode){
  ensureSettingsDefaults();
  settings.appearance.calendar = mode;
  persist(SETTINGS_KEY, settings);
  renderWeek();
}
function currentCalendarMode(){
  ensureSettingsDefaults();
  return settings.appearance.calendar || 'Semanal';
}

function renderWeek(){
  // populate technician filter once
  const techSel = document.getElementById('techFilter');
  const currentTechSel = techSel.value || 'todas';
  const allTechNames = [...new Set([...(typeof techs!=='undefined'?techs:[]), ...appts.map(a=>a.tech)])];
  techSel.innerHTML = '<option value="todas">Todas las técnicas</option>' + allTechNames.map(t=>`<option value="${t}">${t}</option>`).join('');
  techSel.value = [...techSel.options].some(o=>o.value===currentTechSel) ? currentTechSel : 'todas';
  const selectedTech = techSel.value;
  const mode = currentCalendarMode();
  document.getElementById('viewWeekBtn')?.classList.toggle('active', mode==='Semanal');
  document.getElementById('viewMonthBtn')?.classList.toggle('active', mode==='Mensual');
  document.getElementById('weekWrap').style.display = mode==='Semanal' ? 'block' : 'none';
  document.getElementById('monthWrap').style.display = mode==='Mensual' ? 'block' : 'none';
  if(mode === 'Mensual'){
    renderMonthCalendar(selectedTech);
    renderCitasSideSummary();
    return;
  }

  const days = [];
  for(let i=0;i<7;i++){ const d=new Date(weekStart); d.setDate(d.getDate()+i); days.push(d); }
  const dowNames = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const monthNames = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  document.getElementById('weekRangeLabel').textContent =
    `${days[0].getDate()} ${monthNames[days[0].getMonth()]} – ${days[6].getDate()} ${monthNames[days[6].getMonth()]}, ${days[6].getFullYear()}`;

  const startHour = 9, endHour = 20;
  let grid = `<div class="corner"></div>`;
  const todayStr = todayISO();
  days.forEach(d=>{
    const iso = fmtISO(d);
    grid += `<div class="day-head ${iso===todayStr?'today':''}">${dowNames[d.getDay()]} ${d.getDate()}</div>`;
  });

  for(let h=startHour; h<endHour; h++){
    grid += `<div class="time-cell">${pad(h)}:00</div>`;
    days.forEach(d=>{
      const iso = fmtISO(d);
      grid += `<div class="day-cell" data-date="${iso}" data-hour="${h}" ondragover="calendarDragOver(event)" ondragleave="calendarDragLeave(event)" ondrop="calendarDrop(event)" onclick="openModal('${iso}','${pad(h)}:00')"></div>`;
    });
  }
  document.getElementById('weekGrid').innerHTML = grid;

  // place appointments
  const visible = appts.filter(a=>{
    if(selectedTech!=='todas' && a.tech!==selectedTech) return false;
    const aDate = new Date(a.date+'T00:00:00');
    return aDate>=days[0] && aDate<=days[6];
  });
  visible.forEach(a=>{
    const [hh,mm] = a.time.split(':').map(Number);
    if(hh<startHour || hh>=endHour) return;
    const cell = document.querySelector(`.day-cell[data-date="${a.date}"][data-hour="${hh}"]`);
    if(!cell) return;
    const block = document.createElement('div');
    block.className='appt-block';
    block.draggable = true;
    block.dataset.id = a.id;
    block.style.background = COLORS[a.status] || '#EEE';
    block.style.top = (mm/60*56)+'px';
    block.style.height = Math.min(48, Math.max(30, a.dur/60*56 - 4))+'px';
    block.innerHTML = `<div class="t">${a.time}</div><div class="n">${a.client}</div>${apptQuickActionsHTML(a, true)}`;
    block.title = `${a.service} · ${a.tech} · ${a.status}`;
    block.ondragstart = calendarDragStart;
    block.ondragend = calendarDragEnd;
    block.onclick = (event)=>{ event.stopPropagation(); openModal(null, null, a.id); };
    cell.style.position='relative';
    cell.style.zIndex='3';
    cell.appendChild(block);
  });

  renderCitasSideSummary();
}
function renderMonthCalendar(selectedTech){
  const monthGrid = document.getElementById('monthGrid');
  const ref = new Date(weekStart);
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const first = new Date(y,m,1);
  const startDow = first.getDay();
  const daysInMonth = new Date(y,m+1,0).getDate();
  const today = todayISO();
  const dowNames = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  document.getElementById('weekRangeLabel').textContent = ref.toLocaleDateString('es-DO',{month:'long', year:'numeric'});
  let html = dowNames.map(d=>`<div class="month-dow">${d}</div>`).join('');
  const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;
  for(let i=0;i<totalCells;i++){
    const dayNum = i - startDow + 1;
    const dateObj = new Date(y,m,dayNum);
    const iso = fmtISO(dateObj);
    const muted = dateObj.getMonth() !== m;
    const items = appts
      .filter(a=>a.date===iso && a.status!=='Cancelada' && (selectedTech==='todas' || a.tech===selectedTech))
      .sort((a,b)=>a.time.localeCompare(b.time));
    html += `<div class="month-day ${muted?'muted':''} ${iso===today?'today':''}" onclick="openModal('${iso}','10:00')">
      <div class="month-day-head"><span>${dateObj.getDate()}</span>${items.length?`<span class="month-count">${items.length}</span>`:''}</div>
      ${items.slice(0,3).map(a=>`<button type="button" class="month-appt" onclick="event.stopPropagation(); openModal(null,null,${a.id})">${a.time} ${a.client}<span>${a.service}</span></button>`).join('')}
      ${items.length>3?`<div class="month-more">+${items.length-3} más</div>`:''}
    </div>`;
  }
  monthGrid.innerHTML = html;
}
let draggedApptId = null;
function calendarDragStart(event){
  draggedApptId = Number(event.currentTarget.dataset.id);
  event.currentTarget.classList.add('dragging');
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', String(draggedApptId));
}
function calendarDragEnd(event){
  event.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.day-cell.drop-target').forEach(cell=>cell.classList.remove('drop-target'));
  draggedApptId = null;
}
function calendarDragOver(event){
  if(!draggedApptId) return;
  event.preventDefault();
  event.currentTarget.classList.add('drop-target');
}
function calendarDragLeave(event){
  event.currentTarget.classList.remove('drop-target');
}
function calendarDrop(event){
  event.preventDefault();
  event.stopPropagation();
  const cell = event.currentTarget;
  cell.classList.remove('drop-target');
  const id = Number(event.dataTransfer.getData('text/plain') || draggedApptId);
  const appt = appts.find(a=>a.id===id);
  if(!appt) return;
  const newDate = cell.dataset.date;
  const newTime = `${pad(Number(cell.dataset.hour))}:00`;
  const conflict = appts.some(a=>a.id!==id && a.date===newDate && a.time===newTime && a.tech===appt.tech && a.status!=='Cancelada');
  if(conflict){
    showAlert('Esa técnica ya tiene una cita en ese horario. Prueba otro bloque.');
    return;
  }
  appt.date = newDate;
  appt.time = newTime;
  saveAppts(appts);
  renderWeek();
  renderInicio();
  showToast('Cita movida en el calendario');
}
function renderCitasSideSummary(){
  // side summary for today
  const today = new Date();
  const todayStr = todayISO();
  document.getElementById('sideDateBig').textContent = today.toLocaleDateString('es-DO',{weekday:'long', day:'numeric', month:'long'});
  const todayAppts = appts.filter(a=>a.date===todayStr);
  document.getElementById('sideTotal').textContent = todayAppts.length;
  document.getElementById('sideConfirmed').textContent = todayAppts.filter(a=>a.status==='Confirmada').length;
  document.getElementById('sidePending').textContent = todayAppts.filter(a=>a.status==='Pendiente').length;
  document.getElementById('sideCompleted').textContent = todayAppts.filter(a=>a.status==='Completada').length;
  document.getElementById('sideCancelled').textContent = todayAppts.filter(a=>a.status==='Cancelada').length;

  const pending = appts.filter(a=>a.status==='Pendiente').sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).slice(0,5);
  document.getElementById('pendingList').innerHTML = pending.length ? pending.map(a=>`
    <div class="reminder-row">
      <div class="reminder-icon">!</div>
      <div style="flex:1;">
        <div style="font-weight:600;">${a.client}</div>
        <div style="color:var(--muted);font-size:11.5px;">${a.date} · ${a.time} · ${a.service}</div>
        <div class="appt-quick-actions">
          <button class="mini-action" onclick="updateApptStatus(${a.id}, 'Confirmada')">Confirmar</button>
          <button class="mini-action" onclick="remindApptWhatsApp(${a.id})">WhatsApp</button>
          <button class="mini-action dark" onclick="openModal(null,null,${a.id})">Editar</button>
        </div>
      </div>
    </div>`).join('') : `<div class="empty-state actionable"><b>Sin pendientes</b><p>No hay citas esperando confirmación. Puedes crear una cita nueva o revisar el calendario completo.</p><button onclick="openModal()">Nueva cita</button></div>`;
}

/* ---------------- MODAL ---------------- */
function apptAmount(appt){
  const svc = services.find(s=>s.name===appt.service);
  return svc ? svc.price : 700;
}
function fillServiceSelect(selectId){
  const sel = document.getElementById(selectId);
  if(!sel) return;
  const current = sel.value;
  if(!services.length){
    sel.innerHTML = '<option value="">Agrega servicios primero</option>';
    return;
  }
  sel.innerHTML = services.map(s=>`<option value="${s.name}">${s.name} · RD$ ${s.price.toLocaleString()}</option>`).join('');
  if([...sel.options].some(o=>o.value===current)) sel.value = current;
}
let apptCalDate = new Date();
function formatPrivateDate(value){
  if(!value) return 'Seleccionar fecha';
  return new Date(value+'T00:00:00').toLocaleDateString('es-DO', {weekday:'short', day:'numeric', month:'long', year:'numeric'});
}
function syncApptDateLabel(){
  const value = document.getElementById('fFecha').value;
  const label = document.getElementById('apptDateLabel');
  if(label) label.textContent = formatPrivateDate(value);
}
function renderApptDatePicker(){
  const grid = document.getElementById('apptCalGrid');
  const label = document.getElementById('apptCalLabel');
  if(!grid || !label) return;
  const selected = document.getElementById('fFecha').value;
  const y = apptCalDate.getFullYear();
  const m = apptCalDate.getMonth();
  label.textContent = apptCalDate.toLocaleDateString('es-DO', {month:'long', year:'numeric'});
  const first = new Date(y,m,1);
  const startDow = first.getDay();
  const daysInMonth = new Date(y,m+1,0).getDate();
  const daysInPrev = new Date(y,m,0).getDate();
  let html = ['Do','Lu','Ma','Mi','Ju','Vi','Sá'].map(d=>`<div class="dow">${d}</div>`).join('');
  for(let i=startDow-1;i>=0;i--){
    html += `<button type="button" class="cal-day muted" onclick="selectApptDate('${fmtISO(new Date(y,m-1,daysInPrev-i))}')">${daysInPrev-i}</button>`;
  }
  const today = todayISO();
  for(let d=1; d<=daysInMonth; d++){
    const iso = `${y}-${pad(m+1)}-${pad(d)}`;
    html += `<button type="button" class="cal-day ${iso===today?'today':''} ${iso===selected?'selected':''}" onclick="selectApptDate('${iso}')">${d}</button>`;
  }
  const dayCount = startDow + daysInMonth;
  const remain = (7 - dayCount % 7) % 7;
  for(let d=1; d<=remain; d++){
    html += `<button type="button" class="cal-day muted" onclick="selectApptDate('${fmtISO(new Date(y,m+1,d))}')">${d}</button>`;
  }
  grid.innerHTML = html;
}
function toggleApptDatePicker(){
  const popover = document.getElementById('apptDatePopover');
  const trigger = document.getElementById('apptDateTrigger');
  if(!popover || !trigger) return;
  const open = !popover.classList.contains('open');
  popover.classList.toggle('open', open);
  trigger.classList.toggle('open', open);
  if(open) renderApptDatePicker();
}
function closeApptDatePicker(){
  document.getElementById('apptDatePopover')?.classList.remove('open');
  document.getElementById('apptDateTrigger')?.classList.remove('open');
}
document.addEventListener('click', (event)=>{
  const field = document.querySelector('.date-field');
  if(field && !field.contains(event.target)) closeApptDatePicker();
});
function selectApptDate(value){
  document.getElementById('fFecha').value = value;
  apptCalDate = new Date(value+'T00:00:00');
  syncApptDateLabel();
  renderApptDatePicker();
  closeApptDatePicker();
}
function apptCalNav(dir){
  apptCalDate.setMonth(apptCalDate.getMonth()+dir);
  renderApptDatePicker();
}
function fillTimeSelect(){
  const sel = document.getElementById('fHora');
  const chipGrid = document.getElementById('timeChipGrid');
  if(!sel) return;
  const current = sel.value || '10:00';
  const options = [];
  const chips = [];
  for(let h=8; h<=20; h++){
    for(const m of ['00','30']){
      if(h===20 && m==='30') continue;
      const value = `${pad(h)}:${m}`;
      const hour12 = h % 12 || 12;
      const label = `${hour12}:${m} ${h>=12?'PM':'AM'}`;
      options.push(`<option value="${value}">${label}</option>`);
      chips.push(`<button type="button" class="time-chip" data-time="${value}" onclick="selectTime('${value}')">${label}</button>`);
    }
  }
  sel.innerHTML = options.join('');
  sel.value = [...sel.options].some(o=>o.value===current) ? current : '10:00';
  if(chipGrid) chipGrid.innerHTML = chips.join('');
  syncTimeChips();
}
function syncTimeChips(){
  const value = document.getElementById('fHora')?.value;
  document.querySelectorAll('.time-chip').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.time===value);
  });
}
function selectTime(value){
  const sel = document.getElementById('fHora');
  if(!sel) return;
  sel.value = value;
  syncTimeChips();
}
function openModal(date, time, apptId){
  fillServiceSelect('fServicio');
  syncTechSelects();
  fillTimeSelect();
  const appt = apptId ? appts.find(a=>a.id===apptId) : null;
  document.getElementById('fApptId').value = appt ? appt.id : '';
  document.getElementById('apptModalTitle').textContent = appt ? 'Editar cita' : 'Nueva cita';
  document.getElementById('apptSaveBtn').textContent = appt ? 'Guardar cambios' : 'Guardar cita';
  document.getElementById('apptModalActions').style.display = appt ? 'flex' : 'none';
  document.getElementById('fCliente').value = appt ? appt.client : '';
  document.getElementById('fTelefono').value = appt ? (appt.phone || clientPhone(appt.client)) : '';
  document.getElementById('fServicio').value = appt ? appt.service : (services[0] ? services[0].name : '');
  document.getElementById('fFecha').value = appt ? appt.date : (date || todayISO());
  document.getElementById('fHora').value = appt ? appt.time : (time || '10:00');
  syncTimeChips();
  apptCalDate = new Date(document.getElementById('fFecha').value+'T00:00:00');
  syncApptDateLabel();
  renderApptDatePicker();
  closeApptDatePicker();
  document.getElementById('fTecnica').value = appt ? appt.tech : (techs[0] || '');
  document.getElementById('fEstado').value = appt ? appt.status : 'Confirmada';
  document.getElementById('fPago').value = appt && appt.paid ? 'Pagada' : 'Pendiente';
  document.getElementById('modalOverlay').classList.add('open');
}
function closeModal(){ document.getElementById('modalOverlay').classList.remove('open'); }
function saveAppt(){
  const id = Number(document.getElementById('fApptId').value);
  const client = document.getElementById('fCliente').value.trim();
  if(!client){ showAlert('Escribe el nombre del cliente.'); return; }
  const phone = document.getElementById('fTelefono').value.trim();
  if(!isValidPhone(phone)){ showAlert('Revisa el teléfono. Debe tener al menos 10 dígitos.'); return; }
  const date = document.getElementById('fFecha').value || todayISO();
  const time = document.getElementById('fHora').value || '10:00';
  const service = document.getElementById('fServicio').value;
  if(!service){ showAlert('Agrega al menos un servicio antes de crear una cita.'); return; }
  const tech = document.getElementById('fTecnica').value;
  const serviceInfo = typeof services !== 'undefined' ? services.find(s=>s.name===service) : null;
  const duration = serviceInfo ? serviceInfo.duration : 60;
  const hasConflict = appts.some(a=>a.id!==id && a.date===date && a.time===time && a.tech===tech && a.status!=='Cancelada');
  if(hasConflict){
    showAlert('Esa técnica ya tiene una cita en ese horario. Elige otra hora o cambia la técnica.');
    return;
  }
  const newA = {
    id: id || Date.now(),
    date,
    time,
    dur: duration,
    client: client,
    phone,
    service,
    tech: tech || 'Sin asignar',
    status: document.getElementById('fEstado').value,
    paid: document.getElementById('fPago').value === 'Pagada'
  };
  const oldAppt = id ? appts.find(a=>a.id===id) : null;
  if(id){
    appts = appts.map(a=>a.id===id ? {...a, ...newA} : a);
  }else{
    appts.push(newA);
  }
  saveAppts(appts);
  if(newA.paid && (!oldAppt || !oldAppt.paid)){
    addPaymentTxn(newA);
  }
  const existingClient = clients.find(c=>c.name.toLowerCase()===client.toLowerCase());
  if(existingClient){
    if(phone) existingClient.phone = phone;
    existingClient.favService = existingClient.favService || newA.service;
    saveClients();
  }else{
    clients.push({id:Date.now(), name:client, phone, favService:newA.service, loyalty:'Nuevo', notes:''});
    saveClients();
  }
  document.getElementById('fCliente').value='';
  document.getElementById('fTelefono').value='';
  closeModal();
  renderWeek();
  renderInicio();
  renderFinanzasPage();
  showToast(id ? 'Cita actualizada' : 'Cita agendada con éxito');
}

/* ================================================================
   NEW DATA STORES
================================================================ */
const AUTH_KEY='gnc_auth_v1';
const SERVICES_KEY='gnc_services_v3', TXN_KEY='gnc_transactions_v3', PRODUCTS_KEY='gnc_products_v3',
      TASKS_KEY='gnc_tasks_v3', NOTES_KEY='gnc_notes_v3', SETTINGS_KEY='gnc_settings_v3', TECHS_KEY='gnc_techs_v3',
      REMINDERS_KEY='gnc_reminders_v3', EVENTS_KEY='gnc_events_v3';

/* ================================================================
   SINCRONIZACIÓN EN LA NUBE (Firebase / Firestore)
   Guarda una copia de todos los datos del negocio ligada a la cuenta
   de Google que inició sesión, para que se vea igual en cualquier
   dispositivo.
================================================================ */
const firebaseConfig = {
  apiKey: "AIzaSyCAr5xCyjKuZys0Uy1N2yAHS7hdSIgzn-g",
  authDomain: "glamour-nails-center-aabd3.firebaseapp.com",
  projectId: "glamour-nails-center-aabd3",
  storageBucket: "glamour-nails-center-aabd3.firebasestorage.app",
  messagingSenderId: "779471725711",
  appId: "1:779471725711:web:3e0c1d846216387107fcfa"
};
const CLOUD_SYNC_KEYS = [STORAGE_KEY, CLIENTS_KEY, SERVICES_KEY, TXN_KEY, PRODUCTS_KEY, TASKS_KEY, NOTES_KEY, SETTINGS_KEY, TECHS_KEY, REMINDERS_KEY, EVENTS_KEY];
let fbApp=null, fbAuth=null, fbDb=null, cloudSyncReady=false, cloudPushTimer=null, cloudUserEmail=null, cloudSyncPaused=false;
function initFirebase(){
  try{
    if(!window.firebase){ setTimeout(initFirebase, 500); return; }
    if(!fbApp) fbApp = firebase.initializeApp(firebaseConfig);
    fbAuth = firebase.auth();
    fbDb = firebase.firestore();
    cloudSyncReady = true;
    fbAuth.onAuthStateChanged(user=>{
      if(user && user.email){
        cloudUserEmail = user.email;
        if(!sessionStorage.getItem('gnc_cloud_pulled_v1')){
          sessionStorage.setItem('gnc_cloud_pulled_v1', '1');
          pullFromCloud(user.email).then(had=>{ if(had) window.location.reload(); });
        }
      }
    });
  }catch(err){ console.error('No se pudo iniciar Firebase', err); }
}
function docIdFromEmail(email){ return (email||'').trim().toLowerCase(); }
/* Sube todos los datos actuales del navegador a la nube (con espera para no saturar) */
function scheduleCloudPush(){
  if(!cloudSyncReady || !cloudUserEmail || cloudSyncPaused) return;
  clearTimeout(cloudPushTimer);
  cloudPushTimer = setTimeout(pushToCloudNow, 1500);
}
function pushToCloudNow(){
  if(!cloudSyncReady || !cloudUserEmail) return;
  const payload = {};
  CLOUD_SYNC_KEYS.forEach(k=>{ const raw = localStorage.getItem(k); if(raw!==null) payload[k] = raw; });
  payload._updatedAt = new Date().toISOString();
  fbDb.collection('negocios').doc(docIdFromEmail(cloudUserEmail)).set(payload, {merge:true})
    .catch(err=>console.error('Error subiendo datos a la nube', err));
}
/* Baja los datos guardados en la nube y los coloca en este navegador */
function pullFromCloud(email){
  if(!cloudSyncReady) return Promise.resolve(false);
  return fbDb.collection('negocios').doc(docIdFromEmail(email)).get().then(doc=>{
    if(doc.exists){
      const data = doc.data();
      CLOUD_SYNC_KEYS.forEach(k=>{ if(data[k]!==undefined) localStorage.setItem(k, data[k]); });
      return true;
    }
    return false;
  }).catch(err=>{ console.error('Error bajando datos de la nube', err); return false; });
}
/* Conecta la sesión de Google al inicio de sesión seguro de Firebase, y sincroniza */
function connectCloudSync(email, googleIdToken){
  cloudUserEmail = email;
  sessionStorage.setItem('gnc_cloud_pulled_v1', '1');
  if(!cloudSyncReady){ setTimeout(()=>connectCloudSync(email, googleIdToken), 500); return; }
  const finishSync = ()=>{
    cloudSyncPaused = true;
    pullFromCloud(email).then(hadCloudData=>{
      cloudSyncPaused = false;
      if(hadCloudData){
        showToast('Datos sincronizados desde la nube', 'success');
        setTimeout(()=>window.location.reload(), 600);
      } else {
        pushToCloudNow();
      }
    });
  };
  if(googleIdToken && firebase.auth && firebase.auth.GoogleAuthProvider){
    const credential = firebase.auth.GoogleAuthProvider.credential(googleIdToken);
    fbAuth.signInWithCredential(credential).then(finishSync).catch(err=>{
      console.error('No se pudo validar la sesión segura en la nube', err);
      finishSync();
    });
  } else {
    finishSync();
  }
}

function loadOrSeed(key, seedFn){
  let raw = localStorage.getItem(key);
  if(!raw){ const seed = seedFn(); localStorage.setItem(key, JSON.stringify(seed)); return seed; }
  return JSON.parse(raw);
}
function persist(key, val){ localStorage.setItem(key, JSON.stringify(val)); scheduleCloudPush(); }
function downloadFile(filename, content, type){
  const blob = new Blob([content], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
function backupPayload(){
  return {
    version:'4.0',
    exportedAt:new Date().toISOString(),
    app:'Glamour Nails Center',
    data:{appts, clients, services, transactions, products, tasks, notes, settings, techs, reminders, events}
  };
}
function exportBackup(){
  const payload = backupPayload();
  localStorage.setItem('gnc_last_backup_at', payload.exportedAt);
  downloadFile(`glamour-nails-respaldo-${todayISO()}.json`, JSON.stringify(payload, null, 2), 'application/json');
  refreshPrivateHealth();
  showToast('Respaldo exportado');
}
function importBackupFile(event){
  const file = event.target.files && event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const payload = JSON.parse(reader.result);
      const data = payload.data || payload;
      showConfirm('Esto reemplazará los datos actuales por el respaldo importado. ¿Continuar?', ()=>{
        if(Array.isArray(data.appts)) { appts = data.appts; saveAppts(appts); }
        if(Array.isArray(data.clients)) { clients = data.clients; saveClients(); }
        if(Array.isArray(data.services)) { services = data.services; persist(SERVICES_KEY, services); }
        if(Array.isArray(data.transactions)) { transactions = data.transactions; persist(TXN_KEY, transactions); }
        if(Array.isArray(data.products)) { products = data.products; persist(PRODUCTS_KEY, products); }
        if(Array.isArray(data.tasks)) { tasks = data.tasks; persist(TASKS_KEY, tasks); }
        if(Array.isArray(data.notes)) { notes = data.notes; persist(NOTES_KEY, notes); }
        if(data.settings) { settings = {...settings, ...data.settings}; persist(SETTINGS_KEY, settings); }
        if(Array.isArray(data.techs)) { techs = data.techs; persist(TECHS_KEY, techs); }
        if(Array.isArray(data.reminders)) { reminders = data.reminders; persist(REMINDERS_KEY, reminders); }
        if(Array.isArray(data.events)) { events = data.events; persist(EVENTS_KEY, events); }
        renderInicio();
        renderWeek();
        renderReportEmailPreview();
        refreshPrivateHealth();
        showToast('Respaldo importado');
      });
    }catch(err){
      showAlert('No se pudo leer el respaldo. Verifica que sea un archivo JSON válido.');
    }finally{
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}
function csvEscape(value){
  const str = String(value ?? '');
  return `"${str.replace(/"/g, '""')}"`;
}
function exportCSV(kind){
  const rows = kind === 'clients'
    ? [['Nombre','Teléfono','Servicio favorito','Lealtad','Notas'], ...clients.map(c=>[c.name,c.phone,c.favService,c.loyalty,c.notes])]
    : [['Fecha','Tipo','Descripción','Monto','Método','Categoría'], ...transactions.map(t=>[t.date,t.type,t.desc,t.amount,t.method,t.category])];
  const csv = rows.map(row=>row.map(csvEscape).join(',')).join('\n');
  downloadFile(`${kind === 'clients' ? 'clientes' : 'finanzas'}-${todayISO()}.csv`, csv, 'text/csv;charset=utf-8');
  showToast('CSV exportado');
}
function refreshPrivateHealth(){
  const auth = loadAuth();
  const lastBackup = localStorage.getItem('gnc_last_backup_at');
  const backupLabel = lastBackup ? new Date(lastBackup).toLocaleString('es-DO', {dateStyle:'medium', timeStyle:'short'}) : 'Pendiente';
  const lowStock = products.filter(p=>p.stock<=p.minStock).length;
  const pendingPay = appts.filter(a=>!a.paid && a.status!=='Cancelada').length;
  const sessionEl = document.getElementById('healthSession');
  const backupEl = document.getElementById('healthBackup');
  const stockEl = document.getElementById('healthStock');
  const pendingEl = document.getElementById('healthPendingPay');
  const backupStatus = document.getElementById('backupStatus');
  if(sessionEl) sessionEl.textContent = auth && auth.loggedIn && auth.provider==='google' ? 'Activa' : 'Bloqueada';
  if(backupEl) backupEl.textContent = backupLabel;
  if(stockEl) stockEl.textContent = lowStock;
  if(pendingEl) pendingEl.textContent = pendingPay;
  if(backupStatus) backupStatus.textContent = lastBackup ? `Último respaldo: ${backupLabel}` : 'Sin respaldo todavía';
}

function loadAuth(){ return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); }
function showLoginIfNeeded(){
  const auth = loadAuth();
  const googleLoggedIn = auth && auth.loggedIn && auth.provider === 'google';
  document.getElementById('loginScreen').style.display = googleLoggedIn ? 'none' : 'flex';
  const input = document.getElementById('loginGoogleClientId');
  if(input) input.value = settings.googleClientId || '';
  refreshGoogleLoginLabels();
}
function refreshGoogleLoginLabels(){
  const label = document.getElementById('allowedGoogleEmailLabel');
  if(label) label.textContent = settings.allowedGoogleEmail || 'sin asignar';
}
function saveGoogleClientIdFromLogin(){
  ensureSettingsDefaults();
  const value = document.getElementById('loginGoogleClientId')?.value.trim() || '';
  if(!value){ showAlert('Pega tu Google Client ID para activar el acceso.'); return; }
  settings.googleClientId = value;
  persist(SETTINGS_KEY, settings);
  initGoogleSignIn();
  showToast('Google Client ID guardado');
}
function decodeJwtPayload(token){
  const payload = token.split('.')[1];
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const json = decodeURIComponent(atob(normalized).split('').map(c=>`%${('00'+c.charCodeAt(0).toString(16)).slice(-2)}`).join(''));
  return JSON.parse(json);
}
function loginWithGoogleProfile(profile, idToken){
  const email = profile.email || '';
  if(!email){ showAlert('Google no devolvió un correo válido.'); return; }
  ensureSettingsDefaults();
  const allowed = (settings.allowedGoogleEmail || '').trim().toLowerCase();
  if(allowed && email.toLowerCase() !== allowed){
    showAlert('Este correo de Google no está autorizado para abrir este panel privado.');
    return;
  }
  if(!allowed) settings.allowedGoogleEmail = email;
  localStorage.setItem(AUTH_KEY, JSON.stringify({
    email,
    name:profile.name || email,
    picture:profile.picture || '',
    loggedIn:true,
    provider:'google'
  }));
  if(!settings.correo) settings.correo = email;
  if(!settings.reportEmail) settings.reportEmail = email;
  persist(SETTINGS_KEY, settings);
  document.getElementById('loginScreen').style.display = 'none';
  renderAjustesPage();
  renderReportEmailPreview();
  showToast(`Sesión iniciada con Google: ${email}`, 'success');
  startAutomaticNotifications();
  connectCloudSync(email, idToken);
}
function handleGoogleCredentialResponse(response){
  try{
    loginWithGoogleProfile(decodeJwtPayload(response.credential), response.credential);
  }catch(err){
    showAlert('No se pudo validar la respuesta de Google. Revisa tu Client ID.');
  }
}
function initGoogleSignIn(){
  const slot = document.getElementById('googleSignInButton');
  const help = document.getElementById('googleLoginHelp');
  const clientIdGroup = document.getElementById('loginGoogleClientIdGroup');
  const saveBtn = document.getElementById('saveGoogleClientIdBtn');
  if(!slot) return;
  const clientId = (settings && settings.googleClientId || '').trim();
  slot.innerHTML = '';
  refreshGoogleLoginLabels();
  if(!clientId){
    if(clientIdGroup) clientIdGroup.style.display = '';
    if(saveBtn) saveBtn.style.display = '';
    if(help) help.style.display = 'block';
    if(help) help.textContent = 'Pega tu Google Client ID para activar el botón de acceso.';
    return;
  }
  /* Ya hay un Client ID guardado: ocultamos el campo y dejamos solo el botón de Google */
  if(clientIdGroup) clientIdGroup.style.display = 'none';
  if(saveBtn) saveBtn.style.display = 'none';
  if(!(window.google && google.accounts && google.accounts.id)){
    if(help) help.textContent = 'Cargando Google... si no aparece, revisa tu conexión a internet.';
    setTimeout(initGoogleSignIn, 800);
    return;
  }
  if(help) help.textContent = 'Acceso privado solo con Google. La primera cuenta autorizada queda guardada en este navegador.';
  google.accounts.id.initialize({client_id:clientId, callback:handleGoogleCredentialResponse, use_fedcm_for_prompt:true});
  google.accounts.id.renderButton(slot, {theme:'outline', size:'large', text:'signin_with', shape:'pill', width:330});
}
function openGoogleSetup(){
  ensureSettingsDefaults();
  const auth = loadAuth();
  if(auth && auth.loggedIn){
    goTo('ajustes');
    const input = document.getElementById('setGoogleClientId');
    if(input) input.focus();
  }else{
    showAlert('Configura tu Google Client ID en la pantalla de acceso y entra con Google.');
  }
}
function logoutUser(){
  const auth = loadAuth();
  if(auth) localStorage.setItem(AUTH_KEY, JSON.stringify({...auth, loggedIn:false}));
  showLoginIfNeeded();
}
let autoLockTimer = null;
function resetAutoLockTimer(){
  clearTimeout(autoLockTimer);
  autoLockTimer = setTimeout(()=>{
    const auth = loadAuth();
    if(auth && auth.loggedIn){
      localStorage.setItem(AUTH_KEY, JSON.stringify({...auth, loggedIn:false}));
      showLoginIfNeeded();
      showToast('Panel bloqueado por inactividad', 'info');
    }
  }, 30 * 60 * 1000);
}
['click','keydown','touchstart'].forEach(evt=>document.addEventListener(evt, resetAutoLockTimer, {passive:true}));
function requestNotificationPermission(){
  if(!('Notification' in window)){ showAlert('Este navegador no soporta notificaciones.'); return; }
  Notification.requestPermission().then(permission=>{
    showToast(permission==='granted' ? 'Notificaciones activadas' : 'Notificaciones no autorizadas', permission==='granted'?'success':'info');
    renderNotifications();
    if(permission==='granted') startAutomaticNotifications();
  });
}
function sendBrowserNotification(title, body){
  if('Notification' in window && Notification.permission==='granted'){
    new Notification(title, {body});
  }else{
    showToast(`${title}: ${body}`, 'info');
  }
}
function sendTestNotification(){
  if('Notification' in window && Notification.permission==='default'){
    requestNotificationPermission();
    return;
  }
  sendBrowserNotification('Glamour Nails Center', 'Tus notificaciones están listas.');
}
let automaticNotificationTimer = null;
function notificationKeyFor(item){
  return `${todayISO()}|${item.title}|${item.detail}`;
}
function checkAutomaticNotifications(){
  ensureSettingsDefaults();
  checkDailyReportSchedule();
  const items = buildNotifications();
  renderNotifications();
  if(!items.length) return;
  const item = items[0];
  const key = notificationKeyFor(item);
  if(settings.lastAutoNotificationKey === key) return;
  settings.lastAutoNotificationKey = key;
  persist(SETTINGS_KEY, settings);
  if(!('Notification' in window) || Notification.permission!=='granted') return;
  sendBrowserNotification(item.title, item.detail);
}
function startAutomaticNotifications(){
  if(automaticNotificationTimer) clearInterval(automaticNotificationTimer);
  checkAutomaticNotifications();
  automaticNotificationTimer = setInterval(checkAutomaticNotifications, 60000);
}

function buildNotifications(){
  ensureSettingsDefaults();
  const items = [];
  const pending = appts.filter(a=>a.status==='Pendiente');
  const todayAppts = appts.filter(a=>a.date===todayISO() && a.status!=='Cancelada');
  const lowStock = products.filter(p=>p.stock<=p.minStock);
  const activeReminders = reminders.slice(0,4);
  const todayEvents = events.filter(e=>e.date===todayISO());
  if(settings.toggles.toggle1 && pending.length){
    items.push({icon:'!', title:`${pending.length} cita${pending.length===1?'':'s'} pendiente${pending.length===1?'':'s'}`, detail:'Revisa la agenda para confirmar o cobrar.'});
  }
  if(settings.toggles.toggle1 && todayAppts.length){
    items.push({icon:'•', title:`${todayAppts.length} cita${todayAppts.length===1?'':'s'} para hoy`, detail:'Tienes movimientos en la agenda de hoy.'});
  }
  if(settings.toggles.toggle1) activeReminders.forEach(r=>items.push({icon:'•', title:r.text, detail:'Recordatorio guardado en Inicio.'}));
  if(settings.toggles.toggle2 && lowStock.length){
    items.push({icon:'!', title:`${lowStock.length} producto${lowStock.length===1?'':'s'} con stock bajo`, detail:'Revisa Inventario para reponer.'});
  }
  if(settings.toggles.toggle1) todayEvents.forEach(e=>items.push({icon:'•', title:e.text, detail:'Evento programado para hoy.'}));
  return items;
}
function renderNotifications(){
  const bell = document.getElementById('notificationBell');
  const count = document.getElementById('notificationCount');
  const status = document.getElementById('notificationStatus');
  const list = document.getElementById('notificationList');
  if(!bell || !count || !status || !list) return;
  const items = buildNotifications();
  bell.classList.toggle('has-items', items.length>0);
  count.textContent = items.length>9 ? '9+' : String(items.length);
  status.textContent = items.length ? `${items.length} pendiente${items.length===1?'':'s'}` : 'Sin pendientes';
  list.innerHTML = items.length ? items.map(n=>`
    <div class="notification-item">
      <div class="notification-icon">${n.icon}</div>
      <div><b>${n.title}</b><small>${n.detail}</small></div>
    </div>`).join('') : `<div class="notification-empty">No tienes notificaciones por ahora. Cuando agregues recordatorios, citas pendientes, eventos o productos con stock bajo, aparecerán aquí.</div>`;
}
function toggleNotifications(){
  renderNotifications();
  document.getElementById('notificationsPanel').classList.toggle('open');
}
document.addEventListener('click', (event)=>{
  const panel = document.getElementById('notificationsPanel');
  const bell = document.getElementById('notificationBell');
  if(!panel || !bell) return;
  if(!panel.contains(event.target) && !bell.contains(event.target)) panel.classList.remove('open');
});

let services = loadOrSeed(SERVICES_KEY, ()=>[]);
let transactions = loadOrSeed(TXN_KEY, ()=>[]);
let products = loadOrSeed(PRODUCTS_KEY, ()=>[]);
let tasks = loadOrSeed(TASKS_KEY, ()=>[]);
let notes = loadOrSeed(NOTES_KEY, ()=>[]);
let settings = loadOrSeed(SETTINGS_KEY, ()=>({
  nombre:'Glamour Nails Center',
  telefono:'',
  correo:'',
  direccion:'',
  website:'www.glamournails.com',
  description:'Centro especializado en cuidado y diseño de uñas. Calidad, estilo y belleza en cada detalle.',
  reportEmail:'',
  reportTime:'20:00',
  lastReportDate:'',
  googleClientId:'925190993339-cpeq1hfu76gmrr5ag1q7id06l5f9ntbs.apps.googleusercontent.com',
  allowedGoogleEmail:'',
  lastAutoNotificationKey:'',
  toggles:{toggle1:true,toggle2:true,toggle3:false,toggleConfirmations:true,togglePromos:true,toggleWeeklyReports:false,toggle2fa:true},
  schedule:{'Lunes':{on:true,start:'09:00',end:'19:00'},'Martes':{on:true,start:'09:00',end:'19:00'},'Miércoles':{on:true,start:'09:00',end:'19:00'},'Jueves':{on:true,start:'09:00',end:'19:00'},'Viernes':{on:true,start:'09:00',end:'20:00'},'Sábado':{on:true,start:'09:00',end:'18:00'},'Domingo':{on:false,start:'Cerrado',end:'Cerrado'}},
  rules:{advance:'1 hora', reminder:'24 horas antes', tolerance:'15 minutos', cancellation:'Cancelar con 24h de anticipación'},
  payments:{methods:['Efectivo','Tarjeta','Transferencia','Otros'], deposit:'RD$ 300', currency:'Peso dominicano (DOP)', tax:'0%'},
  cashClosures:[],
  appearance:{theme:'#EC1876', mode:'Claro', calendar:'Semanal'},
  integrations:{'Google Calendar':true,'WhatsApp Business':true}
}));
let techs = loadOrSeed(TECHS_KEY, ()=>[]);
let reminders = loadOrSeed(REMINDERS_KEY, ()=>[]);
let events = loadOrSeed(EVENTS_KEY, ()=>[]);

const SERVICE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.5 12.5 12 21l-8.5-8.5A5.5 5.5 0 0 1 11 4.9l1 1 1-1a5.5 5.5 0 0 1 7.5 7.6Z"/></svg>`;
function categoryOf(serviceName){
  const s = (serviceName||'').toLowerCase();
  if(s.includes('manicure')) return 'Manicura';
  if(s.includes('pedicur')) return 'Pedicura';
  if(s.includes('acríl') || s.includes('acril')) return 'Uñas Acrílicas';
  if(s.includes('diseñ')) return 'Diseños';
  return 'Otros';
}
function digitsOnly(value){ return (value || '').replace(/\D/g, ''); }
function clientPhone(name){
  const c = clients.find(x=>x.name.toLowerCase()===(name||'').toLowerCase());
  return c ? (c.phone || '') : '';
}
function openWhatsApp(phone, message){
  const target = digitsOnly(phone || settings.telefono || '');
  if(!target){ showAlert('Agrega un teléfono en Ajustes o al cliente para abrir WhatsApp.'); return; }
  const text = encodeURIComponent(message || `Hola, quiero información de ${settings.nombre || 'Glamour Nails Center'}.`);
  window.open(`https://wa.me/${target}?text=${text}`, '_blank');
}
function addPaymentTxn(appt){
  if(transactions.some(t=>t.apptId===appt.id)) return;
  transactions.push({id:Date.now(), type:'income', desc:`Pago cita: ${appt.client} · ${appt.service}`, amount:apptAmount(appt), method:'Efectivo', date:todayISO(), category:categoryOf(appt.service), apptId:appt.id});
  persist(TXN_KEY, transactions);
}
function currentAppt(){
  const id = Number(document.getElementById('fApptId').value);
  return appts.find(a=>a.id===id);
}
function markCurrentApptPaid(){
  const appt = currentAppt();
  if(!appt) return;
  markApptPaid(appt.id, false);
  document.getElementById('fPago').value = 'Pagada';
  document.getElementById('fEstado').value = appt.status;
}
function statusCurrentAppt(status){
  const appt = currentAppt();
  if(!appt) return;
  updateApptStatus(appt.id, status, false);
  document.getElementById('fEstado').value = status === 'No asistió' ? 'Cancelada' : status;
}
function updateApptStatus(id, status, closeAfter){
  const appt = appts.find(a=>a.id===id);
  if(!appt) return;
  appt.status = status === 'No asistió' ? 'Cancelada' : status;
  appt.noShow = status === 'No asistió';
  saveAppts(appts);
  renderWeek();
  renderInicio();
  renderFinanzasPage();
  renderClientesPage();
  if(closeAfter) closeModal();
  showToast(status === 'No asistió' ? 'Cita marcada como no asistió' : `Cita ${status.toLowerCase()}`);
}
function markApptPaid(id, closeAfter){
  const appt = appts.find(a=>a.id===id);
  if(!appt) return;
  appt.paid = true;
  appt.status = appt.status==='Cancelada' ? 'Confirmada' : appt.status;
  addPaymentTxn(appt);
  saveAppts(appts);
  renderWeek(); renderInicio(); renderFinanzasPage();
  if(closeAfter) closeModal();
  showToast('Pago registrado y conectado a Finanzas');
}
function whatsAppCurrentAppt(){
  const appt = currentAppt();
  if(!appt) return;
  remindApptWhatsApp(appt.id);
}
function apptReminderMessage(appt){
  const dateLabel = new Date(appt.date+'T00:00:00').toLocaleDateString('es-DO',{weekday:'long', day:'numeric', month:'long'});
  return `Hola ${appt.client}, te recordamos tu cita de ${appt.service} para el ${dateLabel} a las ${appt.time} en ${settings.nombre || 'Glamour Nails Center'}. Si necesitas cambiarla, por favor avísanos.`;
}
function remindApptWhatsApp(id){
  const appt = appts.find(a=>a.id===id);
  if(!appt) return;
  openWhatsApp(appt.phone || clientPhone(appt.client), apptReminderMessage(appt));
}
function receiptCurrentAppt(){
  const appt = currentAppt();
  if(appt) showReceipt(appt);
}
function deleteCurrentAppt(){
  const appt = currentAppt();
  if(!appt) return;
  showConfirm(`¿Eliminar la cita de ${appt.client}?`, ()=>{
    appts = appts.filter(a=>a.id!==appt.id);
    saveAppts(appts);
    closeModal();
    renderWeek(); renderInicio(); renderFinanzasPage();
    showToast('Cita eliminada');
  });
}
function showReceipt(appt){
  document.getElementById('receiptBox').innerHTML = `
    <div style="text-align:center;margin-bottom:12px;"><b>${settings.nombre || 'Glamour Nails Center'}</b><br><span style="color:var(--muted);font-size:12px;">${settings.telefono || ''}</span></div>
    <div class="receipt-row"><span>Cliente</span><b>${appt.client}</b></div>
    <div class="receipt-row"><span>Servicio</span><b>${appt.service}</b></div>
    <div class="receipt-row"><span>Fecha</span><b>${appt.date} · ${appt.time}</b></div>
    <div class="receipt-row"><span>Técnica</span><b>${appt.tech}</b></div>
    <div class="receipt-row"><span>Estado</span><b>${appt.paid ? 'Pagada' : 'Pendiente'}</b></div>
    <div class="receipt-row"><span>Total</span><b>RD$ ${apptAmount(appt).toLocaleString()}</b></div>
  `;
  document.getElementById('receiptModalOverlay').classList.add('open');
}
function printReceipt(){
  const html = document.getElementById('receiptBox').innerHTML;
  const win = window.open('', '_blank');
  win.document.write(`<html><head><title>Recibo</title><style>body{font-family:Arial;padding:24px}.receipt-row{display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding:8px 0}</style></head><body>${html}</body></html>`);
  win.document.close();
  win.print();
}
function dailyReportData(){
  const today = todayISO();
  const todayAppts = appts.filter(a=>a.date===today);
  const completed = todayAppts.filter(a=>a.status==='Completada').length;
  const pending = todayAppts.filter(a=>a.status==='Pendiente').length;
  const cancelled = todayAppts.filter(a=>a.status==='Cancelada').length;
  const income = transactions.filter(t=>t.type==='income' && t.date===today).reduce((s,t)=>s+t.amount,0)
    + todayAppts.filter(a=>a.paid).reduce((s,a)=>s+apptAmount(a),0);
  const expenses = transactions.filter(t=>t.type==='expense' && t.date===today).reduce((s,t)=>s+t.amount,0);
  const lowStock = products.filter(p=>p.stock<=p.minStock);
  return {today, todayAppts, completed, pending, cancelled, income, expenses, net:income-expenses, lowStock};
}
function reportEmailHtml(){
  const d = dailyReportData();
  return `
    <div class="email-head">
      <h2>${settings.nombre || 'Glamour Nails Center'}</h2>
      <div>Reporte diario · ${new Date(d.today+'T00:00:00').toLocaleDateString('es-DO',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
    </div>
    <div class="email-body">
      <p style="color:var(--muted);font-size:13px;">Hola, aquí tienes el resumen automático de tu salón.</p>
      <div class="email-metrics">
        <div class="email-metric"><b>${d.todayAppts.length}</b><span>Citas del día</span></div>
        <div class="email-metric"><b>RD$ ${d.income.toLocaleString()}</b><span>Ingresos</span></div>
        <div class="email-metric"><b>RD$ ${d.expenses.toLocaleString()}</b><span>Gastos</span></div>
        <div class="email-metric"><b>RD$ ${d.net.toLocaleString()}</b><span>Balance neto</span></div>
      </div>
      <p style="font-size:13px;"><b>Citas:</b> ${d.completed} completadas, ${d.pending} pendientes, ${d.cancelled} canceladas.</p>
      <p style="font-size:13px;"><b>Inventario bajo:</b> ${d.lowStock.length ? d.lowStock.map(p=>p.name).join(', ') : 'sin alertas'}.</p>
    </div>
  `;
}
function reportFileHtml(){
  const d = dailyReportData();
  return `
    <div class="report-title">
      <div><h3>Reporte diario</h3><div style="color:var(--muted);font-size:12px;">${settings.nombre || 'Glamour Nails Center'} · ${d.today}</div></div>
      <div style="font-weight:700;">RD$ ${d.net.toLocaleString()}</div>
    </div>
    <table class="report-table">
      <tr><th>Métrica</th><th>Valor</th></tr>
      <tr><td>Citas del día</td><td>${d.todayAppts.length}</td></tr>
      <tr><td>Citas completadas</td><td>${d.completed}</td></tr>
      <tr><td>Citas pendientes</td><td>${d.pending}</td></tr>
      <tr><td>Ingresos</td><td>RD$ ${d.income.toLocaleString()}</td></tr>
      <tr><td>Gastos</td><td>RD$ ${d.expenses.toLocaleString()}</td></tr>
      <tr><td>Balance neto</td><td>RD$ ${d.net.toLocaleString()}</td></tr>
      <tr><td>Productos bajo stock</td><td>${d.lowStock.length}</td></tr>
    </table>
    <div style="margin-top:14px;font-size:12.5px;color:var(--muted);">Generado automáticamente por tu panel local.</div>
  `;
}
function renderReportEmailPreview(){
  const emailBox = document.getElementById('emailPreview');
  const reportBox = document.getElementById('reportFilePreview');
  if(emailBox) emailBox.innerHTML = reportEmailHtml();
  if(reportBox) reportBox.innerHTML = reportFileHtml();
}
function downloadDailyReport(){
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Reporte diario privado</title><style>
    :root{color-scheme:light;--ink:#201D25;--muted:#706A78;--line:#E4E0E8;--accent:#D41468;}
    *{box-sizing:border-box} body{font-family:"Segoe UI",Arial,sans-serif;margin:0;background:#F6F5F8;color:var(--ink);padding:34px;}
    .sheet{max-width:820px;margin:0 auto;background:white;border:1px solid var(--line);border-radius:18px;overflow:hidden;box-shadow:0 22px 70px rgba(32,29,37,.12)}
    .head{background:#201D25;color:#fff;padding:28px}.head h1{margin:0;font-size:28px}.head p{margin:8px 0 0;color:rgba(255,255,255,.72)}
    .body{padding:26px}.report-title{display:flex;justify-content:space-between;gap:18px;border-bottom:1px solid var(--line);padding-bottom:16px;margin-bottom:18px}
    .report-title h3{margin:0;font-size:20px}.report-table{width:100%;border-collapse:collapse;font-size:14px}.report-table th{text-align:left;color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.08em}.report-table th,.report-table td{border-bottom:1px solid var(--line);padding:12px 8px}
    .foot{padding:18px 26px;color:var(--muted);font-size:12px;border-top:1px solid var(--line)} @media print{body{background:#fff;padding:0}.sheet{box-shadow:none;border-radius:0}}
  </style></head><body><main class="sheet"><section class="head"><h1>${settings.nombre || 'Glamour Nails Center'}</h1><p>Reporte privado de operaciones</p></section><section class="body">${reportFileHtml()}</section><section class="foot">Generado desde tu panel privado local. Guarda este archivo junto con tus respaldos.</section></main></body></html>`;
  downloadFile(`reporte-diario-${todayISO()}.html`, html, 'text/html');
}
function sendReportEmailDraft(){
  const email = settings.reportEmail || settings.correo;
  if(!email){ showAlert('Agrega un correo en Ajustes para preparar el reporte.'); return; }
  const d = dailyReportData();
  const subject = encodeURIComponent(`Reporte diario - ${settings.nombre || 'Glamour Nails Center'} - ${d.today}`);
  const body = encodeURIComponent(`Reporte diario\\n\\nCitas: ${d.todayAppts.length}\\nIngresos: RD$ ${d.income.toLocaleString()}\\nGastos: RD$ ${d.expenses.toLocaleString()}\\nBalance: RD$ ${d.net.toLocaleString()}\\nInventario bajo: ${d.lowStock.length}\\n\\nNota: el diseño completo está visible en la sección Reportes y se puede descargar como archivo HTML.`);
  window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
}
function checkDailyReportSchedule(){
  if(!settings.toggles || !settings.toggles.toggle3) return;
  const email = settings.reportEmail || settings.correo;
  if(!email) return;
  const now = new Date();
  const today = todayISO();
  const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  if(currentTime >= (settings.reportTime || '20:00') && settings.lastReportDate !== today){
    settings.lastReportDate = today;
    persist(SETTINGS_KEY, settings);
    sendBrowserNotification('Reporte diario listo', `Tu reporte de ${settings.nombre || 'Glamour Nails Center'} está listo para revisar.`);
    renderReportEmailPreview();
  }
}
let currentHistoryClient = '';
function showClientHistory(name){
  currentHistoryClient = name;
  const c = clients.find(x=>x.name===name);
  const rows = clientAppointments(name).sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time));
  const next = clientAppointments(name).filter(a=>a.date>=todayISO() && a.status!=='Cancelada').sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time))[0];
  const pending = clientPendingAmount(name);
  const apptIds = new Set(rows.map(a=>a.id));
  const movementRows = transactions
    .filter(t=>apptIds.has(t.apptId) || (t.desc || '').toLowerCase().includes(name.toLowerCase()))
    .sort((a,b)=>(b.date || '').localeCompare(a.date || '') || b.id-a.id);
  document.getElementById('clientHistoryTitle').textContent = `Historial de ${name}`;
  document.getElementById('clientHistoryBody').innerHTML = `
    <div class="receipt-box">
      <div class="receipt-row"><span>Teléfono</span><b>${c && c.phone ? c.phone : 'Sin teléfono'}</b></div>
      <div class="receipt-row"><span>Visitas</span><b>${visitCountOf(name)}</b></div>
      <div class="receipt-row"><span>Servicio favorito</span><b>${c ? c.favService : '-'}</b></div>
      <div class="receipt-row"><span>Total pagado</span><b>RD$ ${clientSpent(name).toLocaleString()}</b></div>
      <div class="receipt-row"><span>Pendiente por cobrar</span><b>RD$ ${pending.toLocaleString()}</b></div>
    </div>
    <div class="client-health-grid">
      <div class="client-health-card"><span>Próxima cita</span><b>${next ? `${next.date} · ${next.time}` : 'Sin cita próxima'}</b></div>
      <div class="client-health-card"><span>Última visita</span><b>${lastVisitOf(name)}</b></div>
      <div class="client-health-card"><span>Lealtad</span><b>${c && c.loyalty ? c.loyalty : 'Nuevo'}</b></div>
      <div class="client-health-card"><span>Notas</span><b>${c && c.notes ? c.notes : 'Sin notas'}</b></div>
    </div>
    <div class="client-quick-actions">
      <button class="mini-action" onclick="openModal(null,null,null); document.getElementById('fCliente').value='${name.replace(/'/g,"\\'")}'; document.getElementById('fTelefono').value='${((c && c.phone) || '').replace(/'/g,"\\'")}'; closeGenericModal('clientHistoryOverlay')">Agendar cita</button>
      <button class="mini-action" onclick="whatsAppHistoryClient()">WhatsApp</button>
    </div>
    <div style="margin-top:14px;">
      <h4 style="font-size:13px;margin:0 0 8px;">Pagos y movimientos</h4>
      ${movementRows.map(t=>`
        <div class="txn-row">
          <span>${t.desc}<br><span style="font-size:11px;color:var(--muted);">${t.date || todayISO()} · ${t.method || 'Sin método'}</span></span>
          <span class="${t.type==='income'?'txn-amt-pos':'txn-amt-neg'}">${t.type==='income'?'+':'-'}RD$ ${Number(t.amount||0).toLocaleString()}</span>
        </div>`).join('') || '<div class="empty-state actionable"><b>Sin pagos registrados</b><p>Cuando cobres una cita o registres una transacción para este cliente, aparecerá aquí.</p><button onclick="openTxnModal()">Registrar pago</button></div>'}
    </div>
    <div style="margin-top:14px;">${rows.map(a=>apptRowHTML(a)).join('') || '<div class="empty-state actionable"><b>Sin citas registradas</b><p>Este cliente todavía no tiene historial. Puedes agendar su primera cita desde aquí.</p><button onclick="openModal()">Agendar cita</button></div>'}</div>
  `;
  document.getElementById('clientHistoryOverlay').classList.add('open');
}
function whatsAppHistoryClient(){
  const c = clients.find(x=>x.name===currentHistoryClient);
  if(c) openWhatsApp(c.phone, `Hola ${c.name}, te escribimos de ${settings.nombre || 'Glamour Nails Center'}.`);
}

/* ================================================================
   CLIENTES PAGE
================================================================ */
let clientPage = 1;
const CLIENTS_PER_PAGE = 5;
function clientAppointments(name){
  return appts.filter(a=>a.client.toLowerCase()===(name||'').toLowerCase());
}
function lastVisitOf(name){
  const own = clientAppointments(name).filter(a=>a.status!=='Cancelada').sort((a,b)=> (b.date+b.time).localeCompare(a.date+a.time));
  return own.length ? new Date(own[0].date+'T00:00:00').toLocaleDateString('es-DO',{day:'numeric',month:'short',year:'numeric'}) : 'Sin dato';
}
function nextVisitOf(name){
  const today = todayISO();
  const next = clientAppointments(name).filter(a=>a.date>=today && a.status!=='Cancelada').sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time))[0];
  return next ? `${new Date(next.date+'T00:00:00').toLocaleDateString('es-DO',{day:'numeric',month:'short'})} · ${next.time}` : 'Sin cita próxima';
}
function visitCountOf(name){ return clientAppointments(name).filter(a=>a.status!=='Cancelada').length; }
function clientSpent(name){
  return clientAppointments(name).filter(a=>a.status!=='Cancelada' && a.paid).reduce((s,a)=>s+apptAmount(a),0);
}
function clientPendingAmount(name){
  return clientAppointments(name).filter(a=>a.status!=='Cancelada' && !a.paid).reduce((s,a)=>s+apptAmount(a),0);
}
function initials(name){ return name.split(' ').filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join(''); }
function loyaltyClass(l){ return l==='VIP'?'loyalty-vip':l==='Frecuente'?'loyalty-frecuente':'loyalty-nuevo'; }

function renderClientesPage(){ renderClientTable(); renderClientesFrecuentes(); renderServiciosMasReservados(); renderClientFooterStats(); }

function renderClientTable(){
  const q = (document.getElementById('clientSearch').value||'').toLowerCase();
  let filtered = clients.filter(c=> c.name.toLowerCase().includes(q) || (c.phone||'').includes(q));
  const totalPages = Math.max(1, Math.ceil(filtered.length/CLIENTS_PER_PAGE));
  if(clientPage>totalPages) clientPage = totalPages;
  const pageItems = filtered.slice((clientPage-1)*CLIENTS_PER_PAGE, clientPage*CLIENTS_PER_PAGE);
  document.getElementById('clientTableBody').innerHTML = pageItems.map(c=>`
    <tr>
      <td><span class="mobile-card-meta">Cliente</span><div class="cell-client"><div class="mini-avatar">${initials(c.name)}</div><div><div style="font-weight:600;">${c.name}</div><div style="font-size:11px;color:var(--muted);">${c.notes?c.notes.slice(0,30):''}</div><div style="font-size:11px;color:var(--muted);">Próxima: ${nextVisitOf(c.name)}</div></div></div></td>
      <td><span class="mobile-card-meta">Teléfono</span>${c.phone||'Sin dato'}</td>
      <td><span class="mobile-card-meta">Última cita</span>${lastVisitOf(c.name)}</td>
      <td><span class="mobile-card-meta">Servicio y gasto</span>${c.favService||'Sin dato'}<br><span style="font-size:11px;color:var(--muted);">RD$ ${clientSpent(c.name).toLocaleString()} gastado</span></td>
      <td><span class="mobile-card-meta">Lealtad</span><span class="badge ${loyaltyClass(c.loyalty)}">${c.loyalty||'Nuevo'}</span></td>
      <td><div class="row-actions">
        <div class="icon-btn" onclick="showClientHistory('${c.name.replace(/'/g,"\\'")}')" title="Ver historial"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7M3 4v6h6M12 7v5l3 2"/></svg></div>
        <div class="icon-btn" onclick="openWhatsApp('${(c.phone||'').replace(/'/g,"\\'")}', 'Hola ${c.name.replace(/'/g,"\\'")}, te escribimos de Glamour Nails Center.')" title="WhatsApp"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L4 20l1.2-4.1A8.5 8.5 0 1 1 21 11.5Z"/><path d="M9 9.5c.4 2 2 3.6 4 4l1.3-1.3 2 .5"/></svg></div>
        <div class="icon-btn danger" onclick="deleteClient(${c.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></div>
      </div></td>
    </tr>`).join('') || `<tr><td colspan="6"><div class="empty-state actionable"><b>No se encontraron clientes</b><p>Registra un cliente nuevo o limpia la búsqueda para volver a ver tu lista.</p><button onclick="openClientModal()">Nuevo cliente</button></div></td></tr>`;
  document.getElementById('clientPageInfo').textContent = `Mostrando ${pageItems.length ? (clientPage-1)*CLIENTS_PER_PAGE+1 : 0}–${(clientPage-1)*CLIENTS_PER_PAGE+pageItems.length} de ${filtered.length} clientes`;
}
function clientPageNav(dir){ clientPage = Math.max(1, clientPage+dir); renderClientTable(); }

function renderClientesFrecuentes(){
  const ranked = clients.map(c=>({...c, visits: visitCountOf(c.name)})).sort((a,b)=>b.visits-a.visits).slice(0,5);
  const medals = ['🏆','🥈','🥉'];
  document.getElementById('clientesFrecuentes').innerHTML = ranked.map((c,i)=>`
    <div class="list-row">
      <div style="display:flex;align-items:center;gap:10px;"><span>${medals[i]||(i+1)}</span><div class="mini-avatar" style="width:26px;height:26px;font-size:10px;">${initials(c.name)}</div>${c.name}</div>
      <span class="badge loyalty-frecuente">${c.visits} citas</span>
    </div>`).join('') || `<p style="color:var(--muted);font-size:13px;">Sin datos aún.</p>`;
}
function renderServiciosMasReservados(){
  const counts = {};
  appts.forEach(a=>{ if(a.status!=='Cancelada') counts[a.service]=(counts[a.service]||0)+1; });
  const top = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,5);
  document.getElementById('serviciosMasReservados').innerHTML = top.map(([name,count],i)=>`
    <div class="list-row"><span>${i+1}. ${name}</span><b>${count}</b></div>`).join('') || `<p style="color:var(--muted);font-size:13px;">Sin datos aún.</p>`;
}
function renderClientFooterStats(){
  const citasWeek = appts.filter(a=>{ const d=new Date(a.date+'T00:00:00'); return d>=startOfWeek(new Date()) && d < new Date(startOfWeek(new Date()).getTime()+7*86400000); }).length;
  const vip = clients.filter(c=>c.loyalty==='VIP').length;
  document.getElementById('clientFooterStats').innerHTML = `
    <div class="footer-stat"><div class="stat-icon icon-purple" style="margin:0 auto 8px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.6 2.9-6.3 6.5-6.3S15.5 16.4 15.5 20"/></svg></div><div class="fs-val">${clients.length}</div><div class="fs-lbl">Clientes registrados</div></div>
    <div class="footer-stat"><div class="stat-icon icon-green" style="margin:0 auto 8px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4.5" width="18" height="16" rx="2"/></svg></div><div class="fs-val">${citasWeek}</div><div class="fs-lbl">Citas esta semana</div></div>
    <div class="footer-stat"><div class="stat-icon icon-pink" style="margin:0 auto 8px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 17.3 6.2 21l1.6-6.6L2.5 9.8l6.8-.6L12 3l2.7 6.2 6.8.6-5.3 4.6 1.6 6.6Z"/></svg></div><div class="fs-val">98%</div><div class="fs-lbl">Clientes satisfechos</div></div>
    <div class="footer-stat"><div class="stat-icon icon-orange" style="margin:0 auto 8px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 12v9H4v-9M2 7h20v5H2zM12 7v14M12 7C9 7 7 5.5 7 4a2.5 2.5 0 0 1 5 0M12 7c3 0 5-1.5 5-3a2.5 2.5 0 0 0-5 0"/></svg></div><div class="fs-val">${vip}</div><div class="fs-lbl">Clientes VIP</div></div>
  `;
}
function openClientModal(){ document.getElementById('clientModalOverlay').classList.add('open'); }
function closeGenericModal(id){ document.getElementById(id).classList.remove('open'); }
function saveClient(){
  const name = document.getElementById('cName').value.trim();
  if(!name){ showAlert('Escribe el nombre del cliente.'); return; }
  const phone = document.getElementById('cPhone').value.trim();
  if(!isValidPhone(phone)){ showAlert('Revisa el teléfono del cliente.'); return; }
  const duplicate = clients.some(c=>c.name.toLowerCase()===name.toLowerCase() || (phone && c.phone===phone));
  if(duplicate){ showAlert('Este cliente ya parece estar registrado. Revisa la lista antes de duplicarlo.'); return; }
  clients.push({id:Date.now(), name, phone, favService:document.getElementById('cFav').value.trim(), loyalty:document.getElementById('cLoyalty').value, notes:document.getElementById('cNotes').value.trim()});
  saveClients();
  ['cName','cPhone','cFav','cNotes'].forEach(id=>document.getElementById(id).value='');
  closeGenericModal('clientModalOverlay');
  renderClientesPage();
  showToast('Cliente agregado');
}
function deleteClient(id){
  showConfirm('¿Eliminar este cliente?', ()=>{
    clients = clients.filter(c=>c.id!==id);
    saveClients();
    renderClientesPage();
    showToast('Cliente eliminado');
  });
}

/* ================================================================
   SERVICIOS PAGE
================================================================ */
function renderServiciosPage(){
  document.getElementById('serviciosCatalogo').innerHTML = services.map(s=>`
    <div class="service-card" style="position:relative;">
      <div class="service-thumb">${SERVICE_ICON}</div>
      <div class="service-name">${s.name}</div>
      <div style="font-size:11.5px;color:var(--muted);margin:4px 0 8px;">${s.desc||''}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <b style="color:var(--pink-dark);">RD$ ${s.price}</b>
        <span style="font-size:11px;color:var(--muted);">${s.duration} min</span>
      </div>
      <div class="icon-btn danger" style="position:absolute;top:10px;right:10px;" onclick="deleteService(${s.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></div>
    </div>`).join('');
}
function openServiceModal(){ document.getElementById('serviceModalOverlay').classList.add('open'); }
function saveService(){
  const name = document.getElementById('sName').value.trim();
  if(!name){ showAlert('Escribe el nombre del servicio.'); return; }
  const price = Number(document.getElementById('sPrice').value);
  const duration = Number(document.getElementById('sDuration').value);
  if(!price || price <= 0){ showAlert('El precio del servicio debe ser mayor que cero.'); return; }
  if(!duration || duration < 10){ showAlert('La duración debe ser de al menos 10 minutos.'); return; }
  services.push({id:Date.now(), name, desc:document.getElementById('sDesc').value.trim(), price, duration});
  persist(SERVICES_KEY, services);
  ['sName','sDesc','sPrice','sDuration'].forEach(id=>document.getElementById(id).value='');
  closeGenericModal('serviceModalOverlay');
  renderServiciosPage();
  showToast('Servicio agregado');
}
function deleteService(id){
  showConfirm('¿Eliminar este servicio?', ()=>{
    services = services.filter(s=>s.id!==id);
    persist(SERVICES_KEY, services);
    renderServiciosPage();
    showToast('Servicio eliminado');
  });
}

/* ================================================================
   FINANZAS PAGE
================================================================ */
const DONUT_COLORS = {'Manicura':'#EC1876','Pedicura':'#7C3AED','Uñas Acrílicas':'#D97706','Diseños':'#16A34A','Otros':'#60A5FA'};
function moneyRD(value){ return 'RD$ '+Math.round(value || 0).toLocaleString(); }
function cashCloseData(date){
  const day = date || todayISO();
  const ingresoBase = {}; services.forEach(s=>ingresoBase[s.name]=s.price);
  const apptIncome = a => ingresoBase[a.service] || 700;
  const paidAppts = appts.filter(a=>a.date===day && a.paid && a.status!=='Cancelada');
  const dayIncomeTxns = transactions.filter(t=>t.type==='income' && t.date===day && !t.apptId);
  const dayExpenses = transactions.filter(t=>t.type==='expense' && t.date===day);
  const methods = {Efectivo:0, Tarjeta:0, Transferencia:0, Otros:0};
  paidAppts.forEach(a=>{ methods.Efectivo += apptIncome(a); });
  dayIncomeTxns.forEach(t=>{ methods[t.method || 'Otros'] = (methods[t.method || 'Otros'] || 0) + t.amount; });
  const income = Object.values(methods).reduce((s,v)=>s+v,0);
  const expenses = dayExpenses.reduce((s,t)=>s+t.amount,0);
  const pending = appts.filter(a=>a.date===day && !a.paid && a.status!=='Cancelada').reduce((s,a)=>s+apptIncome(a),0);
  return {date:day, methods, income, expenses, pending, net:income-expenses, txnCount:dayIncomeTxns.length + dayExpenses.length, apptCount:paidAppts.length};
}
function renderCashClose(){
  const data = cashCloseData();
  const grid = document.getElementById('cashCloseGrid');
  if(!grid) return;
  grid.innerHTML = `
    <div class="cash-mini"><span>Efectivo</span><b>${moneyRD(data.methods.Efectivo)}</b></div>
    <div class="cash-mini"><span>Tarjeta</span><b>${moneyRD(data.methods.Tarjeta)}</b></div>
    <div class="cash-mini"><span>Transferencia</span><b>${moneyRD(data.methods.Transferencia)}</b></div>
    <div class="cash-mini"><span>Otros</span><b>${moneyRD(data.methods.Otros)}</b></div>
    <div class="cash-mini"><span>Ingresos</span><b>${moneyRD(data.income)}</b></div>
    <div class="cash-mini"><span>Gastos</span><b>${moneyRD(data.expenses)}</b></div>
    <div class="cash-mini"><span>Neto</span><b>${moneyRD(data.net)}</b></div>
    <div class="cash-mini"><span>Pendiente</span><b>${moneyRD(data.pending)}</b></div>`;
  const last = settings.cashClosures && settings.cashClosures[settings.cashClosures.length-1];
  const status = document.getElementById('cashCloseStatus');
  const summary = document.getElementById('lastCashCloseSummary');
  const box = document.getElementById('lastCashCloseBox');
  if(status) status.textContent = last && last.date===data.date ? 'Cerrado hoy' : 'Sin cerrar';
  if(summary) summary.textContent = last ? `Último cierre: ${last.date} a las ${last.time}. Neto ${moneyRD(last.net)}.` : 'Todavía no has cerrado caja en este navegador.';
  if(box) box.innerHTML = last ? `
    <div class="receipt-box">
      <div class="receipt-row"><span>Ingresos</span><b>${moneyRD(last.income)}</b></div>
      <div class="receipt-row"><span>Gastos</span><b>${moneyRD(last.expenses)}</b></div>
      <div class="receipt-row"><span>Pendientes</span><b>${moneyRD(last.pending)}</b></div>
      <div class="receipt-row"><span>Neto</span><b>${moneyRD(last.net)}</b></div>
    </div>` : `<div class="empty-state"><b>Sin cierre guardado</b>Cuando cierres el día, el resumen aparecerá aquí.</div>`;
}
function closeCashDay(){
  ensureSettingsDefaults();
  const data = cashCloseData();
  const now = new Date();
  const record = {...data, id:Date.now(), time:`${pad(now.getHours())}:${pad(now.getMinutes())}`};
  settings.cashClosures = [...(settings.cashClosures || []).filter(c=>c.date!==data.date), record];
  persist(SETTINGS_KEY, settings);
  renderCashClose();
  showToast('Cierre de caja guardado');
}
function downloadCashClose(){
  const data = cashCloseData();
  const lines = [
    `Cierre de caja ${data.date}`,
    `Efectivo,${data.methods.Efectivo}`,
    `Tarjeta,${data.methods.Tarjeta}`,
    `Transferencia,${data.methods.Transferencia}`,
    `Otros,${data.methods.Otros}`,
    `Ingresos,${data.income}`,
    `Gastos,${data.expenses}`,
    `Pendiente,${data.pending}`,
    `Neto,${data.net}`
  ];
  downloadFile(`cierre-caja-${data.date}.csv`, lines.join('\n'), 'text/csv;charset=utf-8');
}
function renderFinanzasPage(){
  const today = todayISO();
  const ingresoBase = {}; services.forEach(s=>ingresoBase[s.name]=s.price);
  const apptIncome = a => ingresoBase[a.service] || 700;

  const ingresosHoy = appts.filter(a=>a.date===today && a.status!=='Cancelada').reduce((s,a)=>s+apptIncome(a),0)
    + transactions.filter(t=>t.type==='income' && t.date===today).reduce((s,t)=>s+t.amount,0);
  document.getElementById('finIngresosDia').textContent = 'RD$ '+ingresosHoy.toLocaleString();

  const thisMonth = today.slice(0,7);
  const ingresosMesAppts = appts.filter(a=>a.date.startsWith(thisMonth) && a.status!=='Cancelada').reduce((s,a)=>s+apptIncome(a),0);
  const ingresosMesTxn = transactions.filter(t=>t.type==='income' && t.date.startsWith(thisMonth)).reduce((s,t)=>s+t.amount,0);
  const ingresosMes = ingresosMesAppts + ingresosMesTxn;
  document.getElementById('finIngresosMes').textContent = 'RD$ '+ingresosMes.toLocaleString();

  const gastosMes = transactions.filter(t=>t.type==='expense' && t.date.startsWith(thisMonth)).reduce((s,t)=>s+t.amount,0);
  document.getElementById('finGastosMes').textContent = 'RD$ '+gastosMes.toLocaleString();
  document.getElementById('finGananciaNeta').textContent = 'RD$ '+(ingresosMes-gastosMes).toLocaleString();
  const serviciosMes = appts.filter(a=>a.date.startsWith(thisMonth) && a.status!=='Cancelada').length + transactions.filter(t=>t.type==='income' && t.date.startsWith(thisMonth)).length;
  const pendingValue = appts.filter(a=>!a.paid && a.status!=='Cancelada').reduce((s,a)=>s+apptIncome(a),0);
  document.getElementById('finTicketPromedio').textContent = 'RD$ '+(serviciosMes ? Math.round(ingresosMes/serviciosMes).toLocaleString() : '0');
  document.getElementById('finMargenNeto').textContent = ingresosMes ? `${Math.round(((ingresosMes-gastosMes)/ingresosMes)*100)}%` : '0%';
  document.getElementById('finCobrosPendientes').textContent = 'RD$ '+pendingValue.toLocaleString();

  // 7-day bar chart
  const days = []; for(let i=6;i>=0;i--) days.push(offsetDate(-i));
  const dayLabels = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const totals = days.map(d=> appts.filter(a=>a.date===d && a.status!=='Cancelada').reduce((s,a)=>s+apptIncome(a),0) + transactions.filter(t=>t.type==='income' && t.date===d).reduce((s,t)=>s+t.amount,0));
  const max = Math.max(1,...totals);
  document.getElementById('finBarChart').innerHTML = totals.map((t,i)=>{
    const h = Math.max(6, Math.round((t/max)*130));
    const dow = new Date(days[i]+'T00:00:00').getDay();
    return `<div class="bar-col ${days[i]===today?'peak':''}"><div class="bar" style="height:${h}px;"></div><div class="bar-lbl">${dayLabels[dow]}</div></div>`;
  }).join('');

  // category donut
  const catTotals = {};
  appts.filter(a=>a.status!=='Cancelada').forEach(a=>{ const c=categoryOf(a.service); catTotals[c]=(catTotals[c]||0)+apptIncome(a); });
  transactions.filter(t=>t.type==='income').forEach(t=>{ const c=t.category||'Otros'; catTotals[c]=(catTotals[c]||0)+t.amount; });
  const catTotalRaw = Object.values(catTotals).reduce((a,b)=>a+b,0);
  const catTotal = catTotalRaw || 1;
  let acc = 0;
  const gradientParts = Object.entries(catTotals).map(([cat,val])=>{
    const start = acc/catTotal*360; acc+=val; const end = acc/catTotal*360;
    return `${DONUT_COLORS[cat]||'#CBD5E1'} ${start}deg ${end}deg`;
  });
  document.getElementById('finDonut').style.background = gradientParts.length ? `conic-gradient(${gradientParts.join(',')})` : '#EEE';
  document.getElementById('finDonutTotal').textContent = 'RD$ '+catTotalRaw.toLocaleString();
  document.getElementById('finLegend').innerHTML = Object.entries(catTotals).sort((a,b)=>b[1]-a[1]).map(([cat,val])=>`
    <div class="legend-row"><span><span class="legend-dot" style="background:${DONUT_COLORS[cat]||'#CBD5E1'};"></span>${cat}</span><b>${Math.round(val/catTotal*100)}%</b></div>`).join('') || `<div class="empty-state"><b>Sin ingresos por categoría</b>Los ingresos aparecerán aquí cuando registres citas cobradas o transacciones.</div>`;

  // gastos control
  const expByCat = {};
  transactions.filter(t=>t.type==='expense').forEach(t=>{ expByCat[t.category||'Otros gastos'] = (expByCat[t.category||'Otros gastos']||0)+t.amount; });
  const expMax = Math.max(1,...Object.values(expByCat));
  document.getElementById('finGastosList').innerHTML = Object.entries(expByCat).sort((a,b)=>b[1]-a[1]).map(([cat,val])=>`
    <div style="margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;font-size:12.5px;"><span>${cat}</span><b>RD$ ${val.toLocaleString()}</b></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${Math.round(val/expMax*100)}%;"></div></div>
    </div>`).join('') || `<div class="empty-state"><b>Sin gastos registrados</b>Registra gastos de productos, renta o insumos para ver tu control mensual.<br><button onclick="openTxnModal()">Registrar gasto</button></div>`;

  // recent transactions
  const recent = [...transactions].sort((a,b)=>b.id-a.id).slice(0,6);
  document.getElementById('txnList').innerHTML = recent.map(t=>`
    <div class="txn-row">
      <span>${t.desc}<br><span style="font-size:11px;color:var(--muted);">${t.date} · ${t.method || 'Sin método'}</span></span>
      <span class="${t.type==='income'?'txn-amt-pos':'txn-amt-neg'}">${t.type==='income'?'+':'-'}RD$ ${t.amount.toLocaleString()}</span>
      <div class="row-actions">
        <button class="mini-action" onclick="openTxnModal(${t.id})">Editar</button>
        <button class="mini-action dark" onclick="deleteTxn(${t.id})">Eliminar</button>
      </div>
    </div>`).join('') || `<div class="empty-state"><b>Sin movimientos</b>Registra tu primer ingreso o gasto para empezar tu caja.<br><button onclick="openTxnModal()">Nueva transacción</button></div>`;

  // pending payments (from pending appointments)
  const pending = appts.filter(a=>!a.paid && a.status!=='Cancelada').slice(0,5);
  document.getElementById('pagosPendientesList').innerHTML = pending.map(a=>`
    <div class="txn-row"><span>${a.client}<br><span style="font-size:11px;color:var(--muted);">${a.service}</span></span><span style="color:var(--yellow-badge-text);font-weight:700;">RD$ ${apptIncome(a).toLocaleString()}</span><button class="mini-action green" onclick="markApptPaid(${a.id})">Cobrar</button></div>`).join('') || `<div class="empty-state"><b>Caja al día</b>No tienes pagos pendientes por cobrar.</div>`;

  // payment methods
  const methods = {};
  transactions.filter(t=>t.type==='income').forEach(t=>{ methods[t.method] = (methods[t.method]||0)+t.amount; });
  document.getElementById('methodGrid').innerHTML = Object.entries(methods).map(([m,v])=>`
    <div class="method-chip"><div class="mc-val">RD$ ${v.toLocaleString()}</div><div class="mc-lbl">${m}</div></div>`).join('') || `<div class="empty-state"><b>Sin métodos aún</b>Cuando registres pagos, verás qué método usa más tu clientela.</div>`;
  renderCashClose();
  refreshPrivateHealth();
}
function syncTxnMethodChips(){
  const value = document.getElementById('tMethod')?.value || 'Efectivo';
  document.querySelectorAll('#txnMethodGrid .payment-method-option').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.method === value);
  });
}
function selectTxnMethod(method){
  const sel = document.getElementById('tMethod');
  if(!sel) return;
  sel.value = method;
  syncTxnMethodChips();
}
function openTxnModal(txnId){
  const txn = txnId ? transactions.find(t=>t.id===txnId) : null;
  document.getElementById('tTxnId').value = txn ? txn.id : '';
  document.getElementById('txnModalTitle').textContent = txn ? 'Editar transacción' : 'Nueva transacción';
  document.getElementById('txnSaveBtn').textContent = txn ? 'Guardar cambios' : 'Guardar transacción';
  document.getElementById('tType').value = txn ? txn.type : 'income';
  document.getElementById('tDesc').value = txn ? txn.desc : '';
  document.getElementById('tAmount').value = txn ? txn.amount : '';
  if(document.getElementById('tMethod')) document.getElementById('tMethod').value = txn ? (txn.method || 'Efectivo') : 'Efectivo';
  syncTxnMethodChips();
  document.getElementById('txnModalOverlay').classList.add('open');
}
function saveTxn(){
  const id = Number(document.getElementById('tTxnId').value);
  const desc = document.getElementById('tDesc').value.trim();
  const amount = Number(document.getElementById('tAmount').value);
  if(!desc || !amount || amount <= 0){ showAlert('Completa la descripción y un monto mayor que cero.'); return; }
  const type = document.getElementById('tType').value;
  const method = document.getElementById('tMethod').value;
  const payload = {id:id || Date.now(), type, desc, amount, method, date: id ? (transactions.find(t=>t.id===id)?.date || todayISO()) : todayISO(), category: type==='expense' ? desc : categoryOf(desc)};
  transactions = id ? transactions.map(t=>t.id===id ? {...t, ...payload} : t) : [...transactions, payload];
  persist(TXN_KEY, transactions);
  document.getElementById('tTxnId').value='';
  ['tDesc','tAmount'].forEach(id=>document.getElementById(id).value='');
  closeGenericModal('txnModalOverlay');
  renderFinanzasPage();
  renderInicio();
  showToast(id ? 'Transacción actualizada' : `${type==='income'?'Ingreso':'Gasto'} registrado - ${method}: RD$ ${amount.toLocaleString()}`, 'success');
}
function deleteTxn(id){
  const txn = transactions.find(t=>t.id===id);
  if(!txn) return;
  showConfirm(`¿Eliminar la transacción "${txn.desc}"?`, ()=>{
    transactions = transactions.filter(t=>t.id!==id);
    persist(TXN_KEY, transactions);
    renderFinanzasPage();
    renderInicio();
    showToast('Transacción eliminada');
  });
}

/* ================================================================
   INVENTARIO PAGE
================================================================ */
function renderInventarioPage(){
  const low = products.filter(p=>p.stock<=p.minStock);
  document.getElementById('invStats').innerHTML = `
    <div class="footer-stat"><div class="fs-val">${products.length}</div><div class="fs-lbl">Productos totales</div></div>
    <div class="footer-stat"><div class="fs-val">${low.length}</div><div class="fs-lbl">Bajo stock</div></div>
    <div class="footer-stat"><div class="fs-val">${products.reduce((s,p)=>s+p.stock,0)}</div><div class="fs-lbl">Unidades en inventario</div></div>
    <div class="footer-stat"><div class="fs-val">${[...new Set(products.map(p=>p.category))].length}</div><div class="fs-lbl">Categorías</div></div>
  `;
  document.getElementById('productTableBody').innerHTML = products.map(p=>{
    const isLow = p.stock<=p.minStock;
    return `<tr>
      <td style="font-weight:600;">${p.name}</td>
      <td>${p.category}</td>
      <td>${p.stock} uds.</td>
      <td><span class="stock-badge ${isLow?'stock-low':'stock-ok'}">${isLow?'Bajo stock':'OK'}</span></td>
      <td><div class="row-actions">
        <div class="icon-btn" onclick="restockProduct(${p.id})" title="Sumar 10 unidades"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></div>
        <div class="icon-btn danger" onclick="deleteProduct(${p.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></div>
      </div></td>
    </tr>`;
  }).join('');
  document.getElementById('lowStockList').innerHTML = low.map(p=>`
    <div class="reminder-row"><div class="reminder-icon">⚠️</div><div style="flex:1;"><div style="font-weight:600;">${p.name}</div><div style="font-size:11.5px;color:var(--muted);">Stock: ${p.stock} uds.</div></div>
      <button class="btn-outline" style="font-size:11px;padding:6px 10px;" onclick="restockProduct(${p.id})">Reordenar</button>
    </div>`).join('') || `<p style="color:var(--muted);font-size:13px;">Todo el inventario está en buen nivel.</p>`;
}
function openProductModal(){ document.getElementById('productModalOverlay').classList.add('open'); }
function saveProduct(){
  const name = document.getElementById('pName').value.trim();
  if(!name){ showAlert('Escribe el nombre del producto.'); return; }
  const stock = Number(document.getElementById('pStock').value);
  const minStock = Number(document.getElementById('pMinStock').value);
  if(stock < 0 || minStock < 0){ showAlert('El stock no puede ser negativo.'); return; }
  products.push({id:Date.now(), name, category:document.getElementById('pCategory').value.trim()||'General', stock:stock||0, minStock:minStock||5});
  persist(PRODUCTS_KEY, products);
  ['pName','pCategory','pStock','pMinStock'].forEach(id=>document.getElementById(id).value='');
  closeGenericModal('productModalOverlay');
  renderInventarioPage();
  renderReportesPage();
  renderNotifications();
  showToast('Producto agregado al inventario');
}
function restockProduct(id){
  const p = products.find(x=>x.id===id); if(!p) return;
  p.stock += 10;
  persist(PRODUCTS_KEY, products);
  renderInventarioPage();
  renderNotifications();
  showToast(`${p.name}: +10 unidades`);
}
function deleteProduct(id){
  const p = products.find(x=>x.id===id);
  showConfirm(`¿Eliminar "${p?p.name:'este producto'}" del inventario?`, ()=>{
    products = products.filter(x=>x.id!==id);
    persist(PRODUCTS_KEY, products);
    renderInventarioPage();
    renderNotifications();
    showToast('Producto eliminado');
  });
}

/* ================================================================
   REPORTES PAGE
================================================================ */
let repCalDate = new Date();
function renderReportesPage(){
  const today = todayISO();
  const todayAppts = appts.filter(a=>a.date===today && a.status!=='Cancelada');
  const ingresoBase = {}; services.forEach(s=>ingresoBase[s.name]=s.price);
  const weekIngresos = (()=>{ const days=[]; for(let i=6;i>=0;i--) days.push(offsetDate(-i)); return appts.filter(a=>days.includes(a.date)&&a.status!=='Cancelada').reduce((s,a)=>s+(ingresoBase[a.service]||700),0); })();
  const low = products.filter(p=>p.stock<=p.minStock);
  document.getElementById('reportStats').innerHTML = `
    <div class="footer-stat"><div class="fs-val">${todayAppts.length}</div><div class="fs-lbl">Citas completadas hoy</div></div>
    <div class="footer-stat"><div class="fs-val">RD$ ${weekIngresos.toLocaleString()}</div><div class="fs-lbl">Ingresos esta semana</div></div>
    <div class="footer-stat"><div class="fs-val">${low.length}</div><div class="fs-lbl">Productos bajos</div></div>
    <div class="footer-stat"><div class="fs-val">98%</div><div class="fs-lbl">Satisfacción de clientes</div></div>
  `;
  renderTaskList();
  renderNotesList();
  renderRepCal();
  renderStaffActivity();
  renderUpcomingEvents();
  renderReportEmailPreview();
  document.getElementById('repLowStock').innerHTML = low.map(p=>`
    <div class="reminder-row"><div class="reminder-icon">!</div><div style="flex:1;">${p.name} - ${p.stock} uds.</div></div>`).join('') || `<p style="color:var(--muted);font-size:13px;">Sin alertas.</p>`;

  const days = []; for(let i=6;i>=0;i--) days.push(offsetDate(-i));
  const dayLabels = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const totals = days.map(d=> appts.filter(a=>a.date===d && a.status!=='Cancelada').reduce((s,a)=>s+(ingresoBase[a.service]||700),0));
  const max = Math.max(1,...totals);
  document.getElementById('perfBarChart').innerHTML = totals.map((t,i)=>{
    const h = Math.max(6, Math.round((t/max)*130));
    const dow = new Date(days[i]+'T00:00:00').getDay();
    return `<div class="bar-col ${days[i]===today?'peak':''}"><div class="bar" style="height:${h}px;"></div><div class="bar-lbl">${dayLabels[dow]}</div></div>`;
  }).join('');
}
function renderTaskList(){
  document.getElementById('taskList').innerHTML = tasks.map(t=>`
    <div class="task-row ${t.done?'done':''}">
      <input type="checkbox" ${t.done?'checked':''} onchange="toggleTask(${t.id})">
      <span class="t-text">${t.text}</span>
      ${t.tech?`<span class="task-tech">${t.tech}</span>`:''}
      <span class="task-time">${t.time}</span>
      <div class="reminder-del" onclick="deleteTask(${t.id})">✕</div>
    </div>`).join('') || `<p style="color:var(--muted);font-size:13px;">Sin tareas.</p>`;
}
function toggleTask(id){ const t=tasks.find(x=>x.id===id); t.done=!t.done; persist(TASKS_KEY,tasks); renderTaskList(); }
function deleteTask(id){ tasks = tasks.filter(t=>t.id!==id); persist(TASKS_KEY,tasks); renderTaskList(); }
function addTask(){
  const input = document.getElementById('newTaskInput');
  const val = input.value.trim();
  if(!val) return;
  const techSel = document.getElementById('newTaskTech');
  const now = new Date();
  tasks.push({id:Date.now(), text:val, time: now.toLocaleTimeString('es-DO',{hour:'numeric',minute:'2-digit'}), done:false, tech: techSel ? techSel.value : ''});
  persist(TASKS_KEY,tasks);
  input.value='';
  renderTaskList();
  showToast('Tarea agregada');
}
function renderNotesList(){
  document.getElementById('notesList').innerHTML = notes.map(n=>`
    <div class="note-box">${n.text}<span class="note-del" onclick="deleteNote(${n.id})">✕</span></div>`).join('') || `<p style="color:var(--muted);font-size:13px;">Sin notas.</p>`;
}
function addNote(){
  const val = document.getElementById('newNoteInput').value.trim();
  if(!val) return;
  notes.push({id:Date.now(), text:val});
  persist(NOTES_KEY,notes);
  document.getElementById('newNoteInput').value='';
  renderNotesList();
}
function deleteNote(id){ notes = notes.filter(n=>n.id!==id); persist(NOTES_KEY,notes); renderNotesList(); }
function renderRepCal(){
  const y = repCalDate.getFullYear(), m = repCalDate.getMonth();
  document.getElementById('repCalLabel').textContent = repCalDate.toLocaleDateString('es-DO',{month:'long',year:'numeric'});
  const first = new Date(y,m,1); const startDow = first.getDay();
  const daysInMonth = new Date(y,m+1,0).getDate(); const daysInPrev = new Date(y,m,0).getDate();
  let html = ['Do','Lu','Ma','Mi','Ju','Vi','Sá'].map(d=>`<div class="dow">${d}</div>`).join('');
  for(let i=startDow-1;i>=0;i--) html += `<div class="cal-day muted">${daysInPrev-i}</div>`;
  const todayD = new Date();
  const markedDays = new Set([...appts.map(a=>a.date), ...events.map(e=>e.date)]);
  for(let d=1; d<=daysInMonth; d++){
    const isToday = d===todayD.getDate() && m===todayD.getMonth() && y===todayD.getFullYear();
    const iso = `${y}-${pad(m+1)}-${pad(d)}`;
    const hasEvent = markedDays.has(iso);
    html += `<div class="cal-day ${isToday?'today':''} ${hasEvent?'has-event':''}">${d}</div>`;
  }
  const remain = (7 - (html.match(/cal-day/g)||[]).length % 7) % 7;
  for(let i=1;i<=remain;i++) html += `<div class="cal-day muted">${i}</div>`;
  document.getElementById('repCalGrid').innerHTML = html;
}
function repCalNav(dir){ repCalDate.setMonth(repCalDate.getMonth()+dir); renderRepCal(); }
function renderStaffActivity(){
  const today = todayISO();
  const byTech = {};
  appts.filter(a=>a.date===today).forEach(a=>{ byTech[a.tech]=(byTech[a.tech]||0)+1; });
  const rows = techs.map(t=>({name:t, count: byTech[t]||0}));
  document.getElementById('staffActivity').innerHTML = rows.map(r=>`
    <div class="staff-row"><div class="mini-avatar">${initials(r.name)}</div>
      <div><div style="font-weight:600;">${r.name}</div><div class="staff-role">Técnica de uñas</div></div>
      <div class="staff-time">${r.count} citas hoy</div>
    </div>`).join('') || `<p style="color:var(--muted);font-size:13px;">Sin actividad.</p>`;
}
function renderUpcomingEvents(){
  const pendCount = appts.filter(a=>a.status==='Pendiente').length;
  const sorted = [...events].sort((a,b)=>a.date.localeCompare(b.date));
  let html = '';
  if(pendCount>0){
    html += `<div class="event-row"><span style="flex:1;">Confirmar ${pendCount} cita${pendCount===1?'':'s'} pendiente${pendCount===1?'':'s'}</span><span class="event-date">${new Date(todayISO()+'T00:00:00').toLocaleDateString('es-DO',{day:'numeric',month:'short'})}</span></div>`;
  }
  html += sorted.map(e=>`
    <div class="event-row"><span style="flex:1;">${e.text}</span><span class="event-date">${new Date(e.date+'T00:00:00').toLocaleDateString('es-DO',{day:'numeric',month:'short'})}</span><div class="reminder-del" onclick="deleteEvent(${e.id})">✕</div></div>`).join('');
  document.getElementById('upcomingEvents').innerHTML = html || `<p style="color:var(--muted);font-size:13px;">Sin eventos próximos.</p>`;
}
function addEvent(){
  const textInput = document.getElementById('newEventText');
  const dateInput = document.getElementById('newEventDate');
  const text = textInput.value.trim();
  const date = dateInput.value || todayISO();
  if(!text){ showAlert('Escribe el nombre del evento.'); return; }
  events.push({id:Date.now(), text, date});
  persist(EVENTS_KEY, events);
  textInput.value=''; dateInput.value='';
  renderUpcomingEvents();
  renderRepCal();
  renderNotifications();
  showToast('Evento agregado al calendario');
}
function deleteEvent(id){
  events = events.filter(e=>e.id!==id);
  persist(EVENTS_KEY, events);
  renderUpcomingEvents();
  renderRepCal();
  renderNotifications();
}

/* ================================================================
   AJUSTES PAGE
================================================================ */
renderAjustesPage = function(){
  document.getElementById('setNombre').value = settings.nombre||'';
  document.getElementById('setTelefono').value = settings.telefono||'';
  document.getElementById('setCorreo').value = settings.correo||'';
  document.getElementById('setDireccion').value = settings.direccion||'';
  document.getElementById('setReportEmail').value = settings.reportEmail||settings.correo||'';
  document.getElementById('setReportTime').value = settings.reportTime||'20:00';
  Object.keys(settings.toggles).forEach(k=>{
    document.getElementById(k).classList.toggle('on', !!settings.toggles[k]);
  });
  renderTechChips();
}
saveSettings = function(){
  settings.nombre = document.getElementById('setNombre').value.trim();
  settings.telefono = document.getElementById('setTelefono').value.trim();
  settings.correo = document.getElementById('setCorreo').value.trim();
  settings.direccion = document.getElementById('setDireccion').value.trim();
  settings.reportEmail = document.getElementById('setReportEmail').value.trim();
  settings.reportTime = document.getElementById('setReportTime').value || '20:00';
  persist(SETTINGS_KEY, settings);
  renderReportEmailPreview();
  showToast('Cambios guardados con éxito');
}
toggleSetting = function(id){
  settings.toggles[id] = !settings.toggles[id];
  document.getElementById(id).classList.toggle('on', settings.toggles[id]);
  persist(SETTINGS_KEY, settings);
}
function renderTechChips(){
  document.getElementById('techChipsList').innerHTML = techs.map(t=>`
    <span class="tech-chip">${t}<span class="rm" onclick="removeTech('${t.replace(/'/g,"\\'")}')">✕</span></span>`).join('');
  syncTechSelects();
}
function addTech(){
  const val = document.getElementById('newTechInput').value.trim();
  if(!val) return;
  if(!techs.includes(val)) techs.push(val);
  persist(TECHS_KEY, techs);
  document.getElementById('newTechInput').value='';
  renderTechChips();
}
function removeTech(name){
  techs = techs.filter(t=>t!==name);
  persist(TECHS_KEY, techs);
  renderTechChips();
}
function syncTechSelects(){
  [document.getElementById('fTecnica'), document.getElementById('newTaskTech')].forEach(sel=>{
    if(!sel) return;
    const current = sel.value;
    sel.innerHTML = techs.map(t=>`<option>${t}</option>`).join('');
    if(techs.includes(current)) sel.value = current;
  });
}
function resetAllData(){
  showConfirm('Esto borrará todos los datos guardados en este navegador. ¿Continuar?', ()=>{
    [AUTH_KEY, STORAGE_KEY, CLIENTS_KEY, SERVICES_KEY, TXN_KEY, PRODUCTS_KEY, TASKS_KEY, NOTES_KEY, SETTINGS_KEY, TECHS_KEY, REMINDERS_KEY, EVENTS_KEY].forEach(k=>localStorage.removeItem(k));
    location.reload();
  });
}

const SETTINGS_DEFAULTS = {
  website:'www.glamournails.com',
  description:'Centro especializado en cuidado y diseño de uñas. Calidad, estilo y belleza en cada detalle.',
  googleClientId:'925190993339-cpeq1hfu76gmrr5ag1q7id06l5f9ntbs.apps.googleusercontent.com',
  allowedGoogleEmail:'',
  lastAutoNotificationKey:'',
  schedule:{'Lunes':{on:true,start:'09:00',end:'19:00'},'Martes':{on:true,start:'09:00',end:'19:00'},'Miércoles':{on:true,start:'09:00',end:'19:00'},'Jueves':{on:true,start:'09:00',end:'19:00'},'Viernes':{on:true,start:'09:00',end:'20:00'},'Sábado':{on:true,start:'09:00',end:'18:00'},'Domingo':{on:false,start:'Cerrado',end:'Cerrado'}},
  rules:{advance:'1 hora', reminder:'24 horas antes', tolerance:'15 minutos', cancellation:'Cancelar con 24h de anticipación'},
  payments:{methods:['Efectivo','Tarjeta','Transferencia','Otros'], deposit:'RD$ 300', currency:'Peso dominicano (DOP)', tax:'0%'},
  cashClosures:[],
  appearance:{theme:'#EC1876', mode:'Claro', calendar:'Semanal'},
  integrations:{'Google Calendar':true,'WhatsApp Business':true}
};
function ensureSettingsDefaults(){
  settings.toggles = {...{toggle1:true,toggle2:true,toggle3:false,toggleConfirmations:true,togglePromos:true,toggleWeeklyReports:false,toggle2fa:true}, ...(settings.toggles||{})};
  settings.schedule = {...SETTINGS_DEFAULTS.schedule, ...(settings.schedule||{})};
  settings.rules = {...SETTINGS_DEFAULTS.rules, ...(settings.rules||{})};
  settings.payments = {...SETTINGS_DEFAULTS.payments, ...(settings.payments||{})};
  settings.cashClosures = Array.isArray(settings.cashClosures) ? settings.cashClosures : [];
  settings.appearance = {...SETTINGS_DEFAULTS.appearance, ...(settings.appearance||{})};
  settings.integrations = {...SETTINGS_DEFAULTS.integrations, ...(settings.integrations||{})};
  if(settings.website===undefined) settings.website = SETTINGS_DEFAULTS.website;
  if(settings.description===undefined) settings.description = SETTINGS_DEFAULTS.description;
  if(!settings.googleClientId) settings.googleClientId = SETTINGS_DEFAULTS.googleClientId;
  if(settings.allowedGoogleEmail===undefined) settings.allowedGoogleEmail = SETTINGS_DEFAULTS.allowedGoogleEmail;
  if(settings.lastAutoNotificationKey===undefined) settings.lastAutoNotificationKey = SETTINGS_DEFAULTS.lastAutoNotificationKey;
}
function setIfExists(id, value){ const el=document.getElementById(id); if(el) el.value=value??''; }
function formatTimeLabel(value){ if(value==='Cerrado') return 'Cerrado'; const [h,m]=value.split(':').map(Number); const hour=h%12||12; return `${hour}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`; }
function renderScheduleRows(){
  const wrap = document.getElementById('scheduleRows');
  if(!wrap) return;
  const days = Object.keys(SETTINGS_DEFAULTS.schedule);
  const timeOptions = ['Cerrado','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'];
  wrap.innerHTML = days.map(day=>{
    const row = settings.schedule[day] || SETTINGS_DEFAULTS.schedule[day];
    const opts = timeOptions.map(t=>`<option value="${t}">${formatTimeLabel(t)}</option>`).join('');
    return `<div class="schedule-row"><span>${day}</span><div class="toggle ${row.on?'on':''}" id="day-${day}" onclick="toggleScheduleDay('${day}')"><div class="knob"></div></div><select id="start-${day}" ${row.on?'':'disabled'}>${opts}</select><span>-</span><select id="end-${day}" ${row.on?'':'disabled'}>${opts}</select></div>`;
  }).join('');
  days.forEach(day=>{ const row=settings.schedule[day]||SETTINGS_DEFAULTS.schedule[day]; setIfExists(`start-${day}`, row.start); setIfExists(`end-${day}`, row.end); });
}
renderAjustesPage = function(){
  ensureSettingsDefaults();
  applyAppearanceSettings();
  refreshPrivateHealth();
  setIfExists('setNombre', settings.nombre||'');
  setIfExists('setTelefono', settings.telefono||'');
  setIfExists('setCorreo', settings.correo||'');
  setIfExists('setDireccion', settings.direccion||'');
  setIfExists('setWebsite', settings.website||'');
  setIfExists('setDescription', settings.description||'');
  setIfExists('setReportEmail', settings.reportEmail||settings.correo||'');
  setIfExists('setReportTime', settings.reportTime||'20:00');
  setIfExists('setGoogleClientId', settings.googleClientId||'');
  setIfExists('setAllowedGoogleEmail', settings.allowedGoogleEmail||'');
  setIfExists('ruleAdvance', settings.rules.advance);
  setIfExists('ruleReminder', settings.rules.reminder);
  setIfExists('ruleTolerance', settings.rules.tolerance);
  setIfExists('ruleCancellation', settings.rules.cancellation);
  setIfExists('payDeposit', settings.payments.deposit);
  setIfExists('payCurrency', settings.payments.currency);
  setIfExists('payTax', settings.payments.tax);
  Object.keys(settings.toggles).forEach(k=>{ const el=document.getElementById(k); if(el) el.classList.toggle('on', !!settings.toggles[k]); });
  document.querySelectorAll('.pay-chip').forEach(btn=>btn.classList.toggle('active', settings.payments.methods.includes(btn.dataset.pay)));
  document.querySelectorAll('.swatch').forEach(btn=>btn.classList.toggle('active', btn.dataset.theme===settings.appearance.theme));
  document.querySelectorAll('.segment-btn[data-mode]').forEach(btn=>btn.classList.toggle('active', btn.dataset.mode===settings.appearance.mode));
  document.querySelectorAll('.segment-btn[data-calendar]').forEach(btn=>btn.classList.toggle('active', btn.dataset.calendar===settings.appearance.calendar));
  document.querySelectorAll('.status-pill[data-int]').forEach(btn=>{ const connected=!!settings.integrations[btn.dataset.int]; btn.textContent=connected?'Conectado':'Conectar'; btn.classList.toggle('connect', !connected); });
  renderScheduleRows();
  renderTechChips();
}
saveSettings = function(){
  ensureSettingsDefaults();
  settings.nombre = document.getElementById('setNombre')?.value.trim() || '';
  settings.telefono = document.getElementById('setTelefono')?.value.trim() || '';
  settings.correo = document.getElementById('setCorreo')?.value.trim() || '';
  settings.direccion = document.getElementById('setDireccion')?.value.trim() || '';
  settings.website = document.getElementById('setWebsite')?.value.trim() || '';
  settings.description = document.getElementById('setDescription')?.value.trim() || '';
  settings.reportEmail = document.getElementById('setReportEmail')?.value.trim() || '';
  settings.reportTime = document.getElementById('setReportTime')?.value || '20:00';
  settings.googleClientId = document.getElementById('setGoogleClientId')?.value.trim() || '';
  settings.allowedGoogleEmail = document.getElementById('setAllowedGoogleEmail')?.value.trim() || '';
  persist(SETTINGS_KEY, settings);
  initGoogleSignIn();
  renderReportEmailPreview();
  showToast('Cambios guardados con éxito');
}
toggleSetting = function(id){
  ensureSettingsDefaults();
  settings.toggles[id] = !settings.toggles[id];
  const el = document.getElementById(id);
  if(el) el.classList.toggle('on', settings.toggles[id]);
  persist(SETTINGS_KEY, settings);
  startAutomaticNotifications();
}
function toggleScheduleDay(day){
  ensureSettingsDefaults();
  settings.schedule[day].on = !settings.schedule[day].on;
  if(!settings.schedule[day].on){ settings.schedule[day].start='Cerrado'; settings.schedule[day].end='Cerrado'; }
  else {
    settings.schedule[day].start = settings.schedule[day].start==='Cerrado' ? SETTINGS_DEFAULTS.schedule[day].start : settings.schedule[day].start;
    settings.schedule[day].end = settings.schedule[day].end==='Cerrado' ? SETTINGS_DEFAULTS.schedule[day].end : settings.schedule[day].end;
  }
  persist(SETTINGS_KEY, settings);
  renderScheduleRows();
}
function saveScheduleSettings(){
  ensureSettingsDefaults();
  Object.keys(settings.schedule).forEach(day=>{
    const on = document.getElementById(`day-${day}`)?.classList.contains('on');
    settings.schedule[day] = {on, start:document.getElementById(`start-${day}`)?.value || 'Cerrado', end:document.getElementById(`end-${day}`)?.value || 'Cerrado'};
  });
  persist(SETTINGS_KEY, settings);
  showToast('Horario guardado');
}
function saveRulesSettings(){
  ensureSettingsDefaults();
  settings.rules = {advance:document.getElementById('ruleAdvance')?.value || SETTINGS_DEFAULTS.rules.advance, reminder:document.getElementById('ruleReminder')?.value || SETTINGS_DEFAULTS.rules.reminder, tolerance:document.getElementById('ruleTolerance')?.value || SETTINGS_DEFAULTS.rules.tolerance, cancellation:document.getElementById('ruleCancellation')?.value || SETTINGS_DEFAULTS.rules.cancellation};
  persist(SETTINGS_KEY, settings);
  showToast('Reglas guardadas');
}
function savePaymentsSettings(){
  ensureSettingsDefaults();
  settings.payments.deposit = document.getElementById('payDeposit')?.value.trim() || SETTINGS_DEFAULTS.payments.deposit;
  settings.payments.currency = document.getElementById('payCurrency')?.value || SETTINGS_DEFAULTS.payments.currency;
  settings.payments.tax = document.getElementById('payTax')?.value.trim() || SETTINGS_DEFAULTS.payments.tax;
  persist(SETTINGS_KEY, settings);
  showToast('Configuración de caja guardada');
}
function togglePaymentMethod(btn){
  ensureSettingsDefaults();
  const method = btn.dataset.pay;
  settings.payments.methods = settings.payments.methods.includes(method) ? settings.payments.methods.filter(m=>m!==method) : [...settings.payments.methods, method];
  persist(SETTINGS_KEY, settings);
  btn.classList.toggle('active');
}
function hexToRgb(hex){
  const clean = hex.replace('#','');
  const value = parseInt(clean.length===3 ? clean.split('').map(c=>c+c).join('') : clean, 16);
  return {r:(value>>16)&255, g:(value>>8)&255, b:value&255};
}
function applyAppearanceSettings(){
  ensureSettingsDefaults();
  const color = settings.appearance.theme || '#EC1876';
  const rgb = hexToRgb(color);
  const root = document.documentElement;
  root.style.setProperty('--pink', color);
  root.style.setProperty('--pink-dark', `rgb(${Math.max(rgb.r-38,0)}, ${Math.max(rgb.g-24,0)}, ${Math.max(rgb.b-26,0)})`);
  root.style.setProperty('--pink-light', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, .16)`);
  root.style.setProperty('--pink-pale', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, .08)`);
  document.body.classList.toggle('dark-mode', settings.appearance.mode==='Oscuro');
}
function chooseThemeColor(btn){
  ensureSettingsDefaults();
  settings.appearance.theme=btn.dataset.theme;
  document.querySelectorAll('.swatch').forEach(x=>x.classList.remove('active'));
  btn.classList.add('active');
  applyAppearanceSettings();
  persist(SETTINGS_KEY, settings);
}
function chooseVisualMode(btn){
  ensureSettingsDefaults();
  settings.appearance.mode=btn.dataset.mode;
  document.querySelectorAll('.segment-btn[data-mode]').forEach(x=>x.classList.remove('active'));
  btn.classList.add('active');
  applyAppearanceSettings();
  persist(SETTINGS_KEY, settings);
}
function chooseCalendarView(btn){ ensureSettingsDefaults(); settings.appearance.calendar=btn.dataset.calendar; document.querySelectorAll('.segment-btn[data-calendar]').forEach(x=>x.classList.remove('active')); btn.classList.add('active'); persist(SETTINGS_KEY, settings); }
function saveAppearanceSettings(){ applyAppearanceSettings(); persist(SETTINGS_KEY, settings); showToast('Apariencia guardada'); }
function toggleIntegration(btn){
  ensureSettingsDefaults();
  const name = btn.dataset.int;
  settings.integrations[name] = !settings.integrations[name];
  persist(SETTINGS_KEY, settings);
  renderAjustesPage();
  showToast(`${name}: ${settings.integrations[name] ? 'conectado' : 'desconectado'}`);
}

/* ---------------- INIT ---------------- */
applySidebarState();
ensureSettingsDefaults();
applyAppearanceSettings();
initFirebase();
showLoginIfNeeded();
resetAutoLockTimer();
initGoogleSignIn();
syncTechSelects();
renderInicio();
renderWeek();
renderReportEmailPreview();
startAutomaticNotifications();
