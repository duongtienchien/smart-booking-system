/* =====================================================
   checkout.js — Smart Booking System
   Handles: Order summary load, payment method switch,
            VietQR generation, countdown timer, booking confirmation
   ===================================================== */

'use strict';

// ---- Utility ----
function formatMoney(n) { return n.toLocaleString('vi-VN'); }
function formatDateVi(d) {
  const days = ['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'];
  return `${days[d.getDay()]}, ${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
}
function generateBookingCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'SB-';
  for(let i=0;i<6;i++) code += chars[Math.floor(Math.random()*chars.length)];
  return code;
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

// ---- State ----
let booking = null;
let selectedMethod = 'vietqr';
let countdownInterval = null;
let countdownSeconds = 600; // 10 min
let bookingCode = '';

// ---- Load booking from localStorage ----
function loadBooking() {
  try {
    const raw = localStorage.getItem('smartbook_pending');
    if(!raw) {
      showToast('warning','Không có đơn hàng','Vui lòng quay lại chọn sân và khung giờ');
      document.getElementById('confirmBtn').disabled = true;
      // Demo data if no booking
      booking = {
        venue: { id: 'san-cau-long', name: 'Cầu lông', icon: '🏸', price: 80000 },
        date: new Date().toISOString(),
        slots: [
          { start: '08:00', end: '09:00', price: 80000 },
          { start: '10:00', end: '11:00', price: 80000 }
        ],
        total: 160000
      };
    } else {
      booking = JSON.parse(raw);
    }
    renderOrderSummary();
    startCountdown();
    generateTransferContent();
    generatePaymentQR();
  } catch(e) {
    showToast('error','Lỗi tải đơn hàng', e.message);
  }
}

// ---- Render Order Summary ----
function renderOrderSummary() {
  const d = new Date(booking.date);
  document.getElementById('orderIcon').textContent = booking.venue.icon;
  document.getElementById('orderVenueName').textContent = booking.venue.name;
  document.getElementById('orderDate').textContent = formatDateVi(d);

  const slotList = document.getElementById('orderSlots');
  slotList.innerHTML = booking.slots.map(s => `
    <div class="order-slot-item">
      <span class="order-slot-time">🕐 ${s.start} – ${s.end}</span>
      <span class="order-slot-price">${formatMoney(s.price)}đ</span>
    </div>
  `).join('');

  document.getElementById('orderTotal').textContent = formatMoney(booking.total) + 'đ';
}

// ---- Payment Method Switch ----
function selectPayMethod(el, method) {
  selectedMethod = method;
  document.querySelectorAll('.pay-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');

  document.getElementById('vietqrSection').style.display = method === 'vietqr' ? '' : 'none';
  document.getElementById('momoSection').style.display   = method === 'momo'    ? '' : 'none';
  document.getElementById('cashSection').style.display   = method === 'cash'    ? '' : 'none';

  if(method === 'momo') generateMomoQR();
}

// ---- Generate transfer content ----
function generateTransferContent() {
  const code = 'SBOOKING' + Date.now().toString().slice(-6);
  const el = document.getElementById('transferContent');
  if(el) el.innerHTML = `📝 Nội dung: <strong style="color:var(--color-primary-light);">${code}</strong>`;
  return code;
}

// ---- QR Code Generation (VietQR) ----
function generatePaymentQR() {
  const qrWrap = document.getElementById('qrCodeImg');
  if(!qrWrap || typeof QRious === 'undefined') return;

  // VietQR standard URL format
  const bank = 'MB'; // MBBank BIN
  const account = '0901234567890';
  const amount = booking ? booking.total : 0;
  const content = 'SBOOKING' + Date.now().toString().slice(-6);
  // Standard VietQR deeplink
  const vietQRData = `https://img.vietqr.io/image/${bank}-${account}-compact2.png?amount=${amount}&addInfo=${content}&accountName=SMARTBOOK+JSC`;

  // Generate QR from the VietQR URL
  const canvas = document.createElement('canvas');
  canvas.width = 180;
  canvas.height = 180;
  qrWrap.innerHTML = '';
  qrWrap.appendChild(canvas);

  new QRious({
    element: canvas,
    value: vietQRData,
    size: 180,
    backgroundAlpha: 1,
    foreground: '#000000',
    background: '#ffffff',
    level: 'H'
  });
}

// ---- MoMo QR ----
function generateMomoQR() {
  const wrap = document.getElementById('momoQr');
  if(!wrap || typeof QRious === 'undefined') return;
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 160;
  wrap.innerHTML = '';
  wrap.appendChild(canvas);
  new QRious({ element: canvas, value: `momo://pay?phone=0901234567&amount=${booking.total}&note=SmartBook`, size: 160, background: '#ffffff', foreground: '#9B4DCA', level: 'H' });
}

// ---- Countdown Timer ----
function startCountdown() {
  countdownSeconds = 600;
  updateCountdownDisplay();
  if(countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    countdownSeconds--;
    updateCountdownDisplay();
    if(countdownSeconds <= 0) {
      clearInterval(countdownInterval);
      showToast('error','Hết thời gian giữ slot','Phiên đặt lịch đã hết hạn. Vui lòng chọn lại.');
      document.getElementById('confirmBtn').disabled = true;
    }
  }, 1000);
}

function updateCountdownDisplay() {
  const m = Math.floor(countdownSeconds / 60);
  const s = countdownSeconds % 60;
  const el = document.getElementById('countdownTimer');
  const bar = document.getElementById('countdownBar');
  const pct = (countdownSeconds / 600) * 100;

  el.textContent = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  el.className = `countdown-timer${countdownSeconds < 60 ? ' urgent' : ''}`;
  if(bar) bar.style.width = pct + '%';
}

// ---- Confirm Booking ----
function confirmBooking() {
  const name  = document.getElementById('fullName').value.trim();
  const phone = document.getElementById('phone').value.trim();

  if(!name) { showToast('error','Thiếu thông tin','Vui lòng nhập họ và tên'); document.getElementById('fullName').focus(); return; }
  if(!phone || !/^(0|\+84)[0-9]{8,10}$/.test(phone.replace(/\s/g,''))) {
    showToast('error','SĐT không hợp lệ','Vui lòng nhập số điện thoại đúng định dạng');
    document.getElementById('phone').focus(); return;
  }

  // Simulate booking
  const btn = document.getElementById('confirmBtn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Đang xử lý...';

  setTimeout(() => {
    bookingCode = generateBookingCode();
    clearInterval(countdownInterval);
    localStorage.setItem('smartbook_confirmed', JSON.stringify({ ...booking, code: bookingCode, customer: { name, phone }, method: selectedMethod }));
    localStorage.removeItem('smartbook_pending');
    showConfirmModal();
    btn.disabled = false;
    btn.innerHTML = '✅ Xác nhận đặt lịch';
  }, 1500);
}

// ---- Confirm Modal ----
function showConfirmModal() {
  document.getElementById('ticketCode').textContent = bookingCode;
  const d = new Date(booking.date);
  document.getElementById('ticketMeta').innerHTML = `${booking.venue.icon} ${booking.venue.name} &bull; ${formatDateVi(d)}<br>${booking.slots.map(s=>s.start+' – '+s.end).join(', ')} &bull; <strong>${formatMoney(booking.total)}đ</strong>`;

  // Generate check-in QR
  const canvas = document.getElementById('ticketQrCanvas');
  if(canvas && typeof QRious !== 'undefined') {
    const qrData = JSON.stringify({ code: bookingCode, venue: booking.venue.id, date: booking.date, slots: booking.slots.map(s=>s.start) });
    new QRious({ element: canvas, value: qrData, size: 180, background: '#ffffff', foreground: '#1C1F35', level: 'H' });
  }

  document.getElementById('confirmModal').classList.remove('hidden');
  showToast('success','Đặt lịch thành công!', `Mã đặt lịch: ${bookingCode}`);
}

function closeModal() {
  document.getElementById('confirmModal').classList.add('hidden');
}

// ---- Download Ticket ----
function downloadTicket() {
  const canvas = document.getElementById('ticketQrCanvas');
  if(!canvas) return;
  const link = document.createElement('a');
  link.download = `SmartBook-${bookingCode}.png`;
  link.href = canvas.toDataURL();
  link.click();
  showToast('info','Đã tải vé','Mã QR của bạn đã được lưu về máy');
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', loadBooking);
