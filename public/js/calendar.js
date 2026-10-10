/* =====================================================
   calendar.js — Smart Booking System
   Handles: Venue selection, mini-calendar, time slot grid,
            booking summary, total calculation
   ===================================================== */

'use strict';

// ---- Data ----
const VENUES = [
  { id: 'san-cau-long', name: 'Cầu lông', icon: '🏸', unit: 'sân', price: 80000, color: '#22C55E' },
  { id: 'san-bong-da', name: 'Bóng đá', icon: '⚽', unit: 'sân', price: 200000, color: '#F59E0B' },
  { id: 'san-bong-ro', name: 'Bóng rổ', icon: '🏀', unit: 'sân', price: 120000, color: '#EF4444' },
  { id: 'phong-hop',   name: 'Phòng họp', icon: '💼', unit: 'phòng', price: 150000, color: '#38BDF8' }
];

const TIME_SLOTS_CONFIG = [
  { start: '06:00', end: '07:00' }, { start: '07:00', end: '08:00' },
  { start: '08:00', end: '09:00' }, { start: '09:00', end: '10:00' },
  { start: '10:00', end: '11:00' }, { start: '11:00', end: '12:00' },
  { start: '13:00', end: '14:00' }, { start: '14:00', end: '15:00' },
  { start: '15:00', end: '16:00' }, { start: '16:00', end: '17:00' },
  { start: '17:00', end: '18:00' }, { start: '18:00', end: '19:00' },
  { start: '19:00', end: '20:00' }, { start: '20:00', end: '21:00' },
  { start: '21:00', end: '22:00' }
];

// Simulate booked / maintenance slots (in real app, fetch from API)
const MOCK_STATUS = {
  booked: ['08:00', '09:00', '14:00', '17:00'],
  maintenance: ['12:00', '21:00']
};

// ---- State ----
let state = {
  selectedVenue: VENUES[0],
  selectedDate: new Date(),
  selectedSlots: [],     // array of {start, end, price}
  calViewDate: new Date()  // month being viewed
};

// ---- Utility ----
function formatMoney(n) {
  return n.toLocaleString('vi-VN');
}
function formatDateVi(d) {
  const days = ['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'];
  return `${days[d.getDay()]}, ${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
}
function isSameDay(a, b) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
function showToast(type, title, msg) {
  const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
  const tc = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<div class="toast-icon">${icons[type]||'📢'}</div>
    <div class="toast-body"><div class="toast-title">${title}</div><div class="toast-msg">${msg}</div></div>`;
  tc.appendChild(t);
  setTimeout(() => { t.classList.add('removing'); setTimeout(()=>t.remove(), 350); }, 3500);
}

// ---- Venue Render ----
function renderVenues() {
  const grid = document.getElementById('venueGrid');
  grid.innerHTML = VENUES.map(v => `
    <div class="glass-card venue-card ${state.selectedVenue.id===v.id?'selected':''}"
         onclick="selectVenue('${v.id}')" id="venue-${v.id}">
      <div class="venue-icon">${v.icon}</div>
      <div class="venue-name">${v.name}</div>
      <div class="venue-meta">Theo giờ / ${v.unit}</div>
      <div class="venue-price">${formatMoney(v.price)}đ/h</div>
    </div>
  `).join('');
}

function selectVenue(id) {
  state.selectedVenue = VENUES.find(v=>v.id===id);
  state.selectedSlots = [];
  renderVenues();
  renderTimeGrid();
  updateSummary();
  updateVenueLabel();
  showToast('info','Đã chọn sân', `${state.selectedVenue.icon} ${state.selectedVenue.name} – ${formatMoney(state.selectedVenue.price)}đ/giờ`);
}

function updateVenueLabel() {
  const el = document.getElementById('venueLabel');
  if(el) el.textContent = `${state.selectedVenue.icon} ${state.selectedVenue.name} • ${formatMoney(state.selectedVenue.price)}đ/giờ`;
}

// ---- Mini Calendar ----
function renderCalendar() {
  const d = state.calViewDate;
  const title = document.getElementById('calMonthTitle');
  title.textContent = `Tháng ${d.getMonth()+1}/${d.getFullYear()}`;

  const grid = document.getElementById('calDayGrid');
  grid.innerHTML = '';
  const today = new Date();
  const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
  const lastDay = new Date(d.getFullYear(), d.getMonth()+1, 0);
  const startDow = firstDay.getDay();

  // Empty cells before first day
  for(let i=0; i<startDow; i++){
    const el = document.createElement('div');
    el.className = 'cal-day empty';
    grid.appendChild(el);
  }
  // Day cells
  for(let day=1; day<=lastDay.getDate(); day++){
    const date = new Date(d.getFullYear(), d.getMonth(), day);
    const el = document.createElement('div');
    el.textContent = day;
    const isToday = isSameDay(date, today);
    const isSel = isSameDay(date, state.selectedDate);
    const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    el.className = `cal-day${isToday?' today':''}${isSel?' selected':''}${isPast?' past':''}`;
    if(!isPast) {
      el.addEventListener('click', () => selectDate(date));
      // Simulate some days having bookings
      if([2,5,8,12,16,20].includes(day)) el.classList.add('has-booking');
    }
    grid.appendChild(el);
  }
}

function selectDate(date) {
  state.selectedDate = date;
  state.selectedSlots = [];
  renderCalendar();
  renderTimeGrid();
  updateSummary();
  document.getElementById('displayDate').textContent = formatDateVi(date);
}

document.getElementById('prevMonth').addEventListener('click', () => {
  const d = state.calViewDate;
  state.calViewDate = new Date(d.getFullYear(), d.getMonth()-1, 1);
  renderCalendar();
});
document.getElementById('nextMonth').addEventListener('click', () => {
  const d = state.calViewDate;
  state.calViewDate = new Date(d.getFullYear(), d.getMonth()+1, 1);
  renderCalendar();
});

// ---- Time Grid ----
function getSlotStatus(startTime) {
  if(MOCK_STATUS.maintenance.includes(startTime)) return 'maintenance';
  if(MOCK_STATUS.booked.includes(startTime)) return 'booked';
  return 'available';
}

function renderTimeGrid() {
  const grid = document.getElementById('timeGrid');
  grid.innerHTML = '';
  TIME_SLOTS_CONFIG.forEach(slot => {
    const status = getSlotStatus(slot.start);
    const isSelected = state.selectedSlots.some(s=>s.start===slot.start);
    const el = document.createElement('div');
    el.className = `time-slot ${isSelected ? 'selected' : status}`;

    let badge = '';
    if(status === 'booked')       badge = `<span class="slot-badge booked">Đã đặt</span>`;
    if(status === 'maintenance')  badge = `<span class="slot-badge maintenance">Bảo trì</span>`;

    el.innerHTML = `${badge}
      <span class="slot-time">${slot.start} – ${slot.end}</span>
      <span class="slot-duration">1 giờ</span>
      <span class="slot-price ${status==='available'||isSelected?'available':''}">${status==='available'||isSelected? formatMoney(state.selectedVenue.price)+'đ' : (status==='booked'?'Không có':'Đóng cửa')}</span>`;

    if(status === 'available') {
      el.addEventListener('click', () => toggleSlot(slot.start, slot.end));
    }
    grid.appendChild(el);
  });
}

function toggleSlot(start, end) {
  const idx = state.selectedSlots.findIndex(s=>s.start===start);
  if(idx >= 0) {
    state.selectedSlots.splice(idx, 1);
    showToast('warning','Bỏ chọn', `Khung giờ ${start} – ${end} đã được bỏ chọn`);
  } else {
    if(state.selectedSlots.length >= 4) {
      showToast('error','Giới hạn đặt', 'Bạn chỉ có thể chọn tối đa 4 khung giờ mỗi lần');
      return;
    }
    state.selectedSlots.push({ start, end, price: state.selectedVenue.price });
    showToast('success','Đã chọn', `Khung giờ ${start} – ${end} đã được thêm`);
  }
  renderTimeGrid();
  updateSummary();
}

// ---- Summary ----
function updateSummary() {
  const empty = document.getElementById('summaryEmpty');
  const items = document.getElementById('summaryItems');
  const total = document.getElementById('summaryTotal');
  const bookBtn = document.getElementById('bookBtn');
  const totalEl = document.getElementById('totalAmount');

  if(state.selectedSlots.length === 0){
    empty.style.display = '';
    items.style.display = 'none';
    total.style.display = 'none';
    bookBtn.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  items.style.display = '';
  total.style.display = '';
  bookBtn.style.display = '';

  items.innerHTML = state.selectedSlots.map(s => `
    <div class="summary-item">
      <div>
        <div class="si-label">${state.selectedVenue.icon} ${state.selectedVenue.name}</div>
        <div style="font-size:0.78rem;color:var(--text-muted);">${formatDateVi(state.selectedDate)} • ${s.start}–${s.end}</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <div class="si-value">${formatMoney(s.price)}đ</div>
        <button class="si-remove" onclick="removeSlot('${s.start}')" title="Xóa">✕</button>
      </div>
    </div>
  `).join('');

  const totalVal = state.selectedSlots.reduce((acc,s)=>acc+s.price, 0);
  totalEl.innerHTML = `${formatMoney(totalVal)} <span>đ</span>`;
}

function removeSlot(start) {
  state.selectedSlots = state.selectedSlots.filter(s=>s.start!==start);
  renderTimeGrid();
  updateSummary();
}

// ---- Checkout navigation ----
function proceedToCheckout() {
  if(state.selectedSlots.length === 0) {
    showToast('warning','Chưa chọn giờ','Vui lòng chọn ít nhất 1 khung giờ');
    return;
  }
  const booking = {
    venue: state.selectedVenue,
    date: state.selectedDate.toISOString(),
    slots: state.selectedSlots,
    total: state.selectedSlots.reduce((a,s)=>a+s.price, 0),
    createdAt: new Date().toISOString()
  };
  localStorage.setItem('smartbook_pending', JSON.stringify(booking));
  showToast('success','Chuyển hướng...','Đang đến trang thanh toán');
  setTimeout(()=>{ window.location.href = '/checkout.html'; }, 700);
}

// ---- Init ----
function init() {
  renderVenues();
  renderCalendar();
  renderTimeGrid();
  updateSummary();
  updateVenueLabel();
  document.getElementById('displayDate').textContent = formatDateVi(state.selectedDate);
}

init();
