/* =====================================================
   scanner.js — Smart Booking System
   Handles: Camera access, QR scan via html5-qrcode,
            Check-in validation, history tracking, stats
   ===================================================== */

'use strict';

// ---- State ----
let html5QrCode = null;
let isScanning = false;
let flashOn = false;
let currentCameraIndex = 0;
let availableCameras = [];
let scanHistory = JSON.parse(localStorage.getItem('smartbook_scan_history') || '[]');
let stats = { total: 0, success: 0, fail: 0 };

// ---- Mock DB of valid tickets (in real app, call backend API) ----
const MOCK_VALID_TICKETS = {
  'SB-ABC123': { venue: '🏸 Cầu lông', date: '2026-10-12', slots: ['08:00','09:00'], customer: 'Nguyễn Văn A', status: 'pending' },
  'SB-XYZ789': { venue: '⚽ Bóng đá', date: '2026-10-12', slots: ['15:00','16:00'], customer: 'Trần Thị B', status: 'pending' },
  'SB-QRS456': { venue: '💼 Phòng họp', date: '2026-10-12', slots: ['10:00'], customer: 'Lê Văn C', status: 'checked_in' },
};

// ---- Utility ----
function showToast(type, title, msg) {
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const tc = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<div class="toast-icon">${icons[type] || '📢'}</div>
    <div class="toast-body"><div class="toast-title">${title}</div><div class="toast-msg">${msg}</div></div>`;
  tc.appendChild(t);
  setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 350); }, 4000);
}

function formatTime(d) {
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function updateStats() {
  document.getElementById('statTotal').textContent   = stats.total;
  document.getElementById('statSuccess').textContent = stats.success;
  document.getElementById('statFail').textContent    = stats.fail;
}

// ---- Camera Init ----
async function initCameras() {
  try {
    const devices = await Html5Qrcode.getCameras();
    availableCameras = devices;
    const sel = document.getElementById('cameraSelect');
    sel.innerHTML = '';
    if(devices.length === 0) {
      sel.innerHTML = '<option>Không tìm thấy camera</option>';
      return;
    }
    devices.forEach((d, i) => {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.label || `Camera ${i + 1}`;
      sel.appendChild(opt);
    });
    // Prefer back camera
    const backIdx = devices.findIndex(d => /back|rear|environment/i.test(d.label));
    if(backIdx >= 0) { sel.selectedIndex = backIdx; currentCameraIndex = backIdx; }
    document.getElementById('switchBtn').style.display = devices.length > 1 ? '' : 'none';
  } catch(e) {
    showToast('error', 'Lỗi camera', 'Không thể truy cập camera: ' + e.message);
  }
}

// ---- Start Scanner ----
async function startScanner() {
  if(isScanning) return;
  const sel = document.getElementById('cameraSelect');
  const cameraId = sel.value;
  if(!cameraId) { showToast('warning', 'Chưa chọn camera', 'Vui lòng chọn camera để bắt đầu'); return; }

  html5QrCode = new Html5Qrcode('qrScanner', { verbose: false });
  const config = { fps: 15, qrbox: { width: 200, height: 200 }, aspectRatio: 4/3, disableFlip: false };

  try {
    await html5QrCode.start(cameraId, config, onScanSuccess, onScanFailure);
    isScanning = true;

    document.getElementById('startBtn').style.display = 'none';
    document.getElementById('stopBtn').style.display = '';
    document.getElementById('flashBtn').style.display = '';
    document.getElementById('switchBtn').style.display = availableCameras.length > 1 ? '' : 'none';
    document.getElementById('scanOverlay').style.display = '';
    document.getElementById('scannerBox').classList.add('active-scanning');
    showToast('success', 'Camera đã bật', 'Đang quét mã QR...');
  } catch(e) {
    showToast('error', 'Không thể bật camera', e.message || 'Kiểm tra quyền truy cập camera');
  }
}

// ---- Stop Scanner ----
async function stopScanner() {
  if(!html5QrCode || !isScanning) return;
  try {
    await html5QrCode.stop();
    html5QrCode.clear();
  } catch(e) { /* ignore */ }
  isScanning = false;
  flashOn = false;

  document.getElementById('startBtn').style.display = '';
  document.getElementById('stopBtn').style.display = 'none';
  document.getElementById('flashBtn').style.display = 'none';
  document.getElementById('switchBtn').style.display = 'none';
  document.getElementById('scannerBox').classList.remove('active-scanning');
  document.getElementById('qrScanner').innerHTML = '';
  showToast('info', 'Camera đã tắt', 'Scanner đã dừng');
}

// ---- Switch Camera ----
async function switchCamera() {
  if(availableCameras.length < 2) return;
  currentCameraIndex = (currentCameraIndex + 1) % availableCameras.length;
  const newCam = availableCameras[currentCameraIndex];
  document.getElementById('cameraSelect').value = newCam.id;
  await stopScanner();
  setTimeout(startScanner, 300);
}

// ---- Flash Toggle ----
async function toggleFlash() {
  if(!html5QrCode || !isScanning) return;
  try {
    flashOn = !flashOn;
    await html5QrCode.applyVideoConstraints({ advanced: [{ torch: flashOn }] });
    document.getElementById('flashBtn').textContent = flashOn ? '💡' : '🔦';
    showToast('info', flashOn ? 'Đèn flash bật' : 'Đèn flash tắt', '');
  } catch(e) {
    showToast('warning', 'Flash không hỗ trợ', 'Thiết bị không hỗ trợ điều khiển đèn flash');
  }
}

// ---- On Scan Success ----
let lastScanned = '';
let lastScannedTime = 0;

function onScanSuccess(decodedText) {
  const now = Date.now();
  // Debounce: ignore same QR within 3 seconds
  if(decodedText === lastScanned && now - lastScannedTime < 3000) return;
  lastScanned = decodedText;
  lastScannedTime = now;

  // Play success beep
  playBeep(440, 100);

  processQRCode(decodedText);
}

function onScanFailure(error) {
  // Silently ignore scan frame errors
}

// ---- Process QR ----
function processQRCode(raw) {
  stats.total++;
  updateStats();

  let ticketData = null;
  let bookingCode = '';

  // Try to parse JSON (from checkout.js format)
  try {
    const parsed = JSON.parse(raw);
    bookingCode = parsed.code || '';
    ticketData = MOCK_VALID_TICKETS[bookingCode] || null;
    if(!ticketData && bookingCode) {
      // Build from QR data
      ticketData = {
        venue: parsed.venue || 'Không rõ',
        date: parsed.date ? new Date(parsed.date).toLocaleDateString('vi-VN') : '–',
        slots: parsed.slots || [],
        customer: 'Khách hàng',
        status: 'pending'
      };
    }
  } catch(e) {
    // Raw string — treat as booking code
    bookingCode = raw.trim();
    ticketData = MOCK_VALID_TICKETS[bookingCode] || null;
  }

  if(ticketData) {
    if(ticketData.status === 'checked_in') {
      showScanResult('warning', bookingCode, ticketData, 'Vé đã được sử dụng');
      stats.fail++;
      addHistory(bookingCode, false, 'Đã sử dụng');
      showToast('warning', 'Vé đã được dùng!', `Mã ${bookingCode} đã check-in trước đó`);
    } else {
      MOCK_VALID_TICKETS[bookingCode] = { ...ticketData, status: 'checked_in' };
      showScanResult('success', bookingCode, ticketData, 'Check-in thành công!');
      stats.success++;
      addHistory(bookingCode, true, ticketData.venue);
      showToast('success', '✅ Check-in thành công!', `Mã: ${bookingCode} – ${ticketData.venue}`);
      playBeep(880, 200);
    }
  } else {
    showScanResult('error', bookingCode || raw, null, 'Mã QR không hợp lệ');
    stats.fail++;
    addHistory(bookingCode || raw, false, 'Không hợp lệ');
    showToast('error', '❌ Vé không hợp lệ!', `Mã "${bookingCode || raw}" không tồn tại trong hệ thống`);
  }

  updateStats();
  saveScanHistory();
}

// ---- Show Result ----
function showScanResult(type, code, data, statusText) {
  const area = document.getElementById('scanResultArea');
  const icons = { success: '✅', error: '❌', warning: '⚠️' };
  const titles = { success: 'Check-in Thành công!', error: 'Không hợp lệ!', warning: 'Vé đã sử dụng!' };

  let details = '';
  if(data) {
    details = `
      <div class="scan-detail-grid" style="margin-top:16px;">
        <div class="scan-detail-item">
          <div class="scan-detail-label">Mã đặt lịch</div>
          <div class="scan-detail-value" style="font-variant-numeric:tabular-nums;letter-spacing:1px;">${code}</div>
        </div>
        <div class="scan-detail-item">
          <div class="scan-detail-label">Sân / Phòng</div>
          <div class="scan-detail-value">${typeof data.venue === 'string' ? data.venue : data.venue}</div>
        </div>
        <div class="scan-detail-item">
          <div class="scan-detail-label">Ngày</div>
          <div class="scan-detail-value">${data.date || '–'}</div>
        </div>
        <div class="scan-detail-item">
          <div class="scan-detail-label">Khung giờ</div>
          <div class="scan-detail-value">${Array.isArray(data.slots) ? data.slots.join(', ') : data.slots || '–'}</div>
        </div>
        <div class="scan-detail-item" style="grid-column:1/-1;">
          <div class="scan-detail-label">Khách hàng</div>
          <div class="scan-detail-value">${data.customer || 'Không rõ'}</div>
        </div>
      </div>`;
  } else {
    details = `<div style="text-align:center;margin-top:12px;font-size:0.85rem;color:var(--text-muted);">Mã quét: <strong style="color:var(--text-primary);word-break:break-all;">${code}</strong></div>`;
  }

  area.innerHTML = `
    <div class="scan-result ${type}">
      <div class="scan-status-icon">${icons[type]}</div>
      <div class="scan-status-title">${statusText || titles[type]}</div>
      <div style="text-align:center;margin-top:6px;font-size:0.8rem;color:var(--text-muted);">${formatTime(new Date())}</div>
      ${details}
      ${type === 'success' ? `<button class="btn btn-success w-full btn-sm" style="margin-top:16px;" onclick="document.getElementById('scanResultArea').innerHTML='<div style=\\'text-align:center;color:var(--text-muted);padding:20px;\\'>Sẵn sàng quét mã tiếp theo</div>'">✅ Xác nhận & Quét tiếp</button>` : ''}
    </div>`;
}

// ---- History ----
function addHistory(code, success, desc) {
  const entry = { code, success, desc, time: new Date().toISOString() };
  scanHistory.unshift(entry);
  if(scanHistory.length > 50) scanHistory = scanHistory.slice(0, 50);
  renderHistory();
  saveScanHistory();
}

function renderHistory() {
  const list = document.getElementById('historyList');
  if(scanHistory.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:0.85rem;">Chưa có lịch sử quét</div>';
    return;
  }
  list.innerHTML = '<div class="history-list">' + scanHistory.slice(0,15).map(h => {
    const t = new Date(h.time);
    return `<div class="history-item">
      <div class="history-icon ${h.success?'success':'error'}">${h.success?'✅':'❌'}</div>
      <div>
        <div class="history-code">${h.code}</div>
        <div class="history-meta">${h.desc}</div>
      </div>
      <div class="history-time">${formatTime(t)}</div>
    </div>`;
  }).join('') + '</div>';
}

function clearHistory() {
  scanHistory = [];
  localStorage.removeItem('smartbook_scan_history');
  renderHistory();
  showToast('info','Đã xóa lịch sử','Lịch sử check-in đã được xóa');
}

function saveScanHistory() {
  localStorage.setItem('smartbook_scan_history', JSON.stringify(scanHistory));
}

// ---- Manual Check ----
function manualCheck() {
  const input = document.getElementById('manualCode');
  const code = input.value.trim().toUpperCase();
  if(!code) { showToast('warning','Chưa nhập mã','Vui lòng nhập mã đặt lịch'); return; }
  input.value = '';
  processQRCode(code);
}

// ---- Audio Beep ----
function playBeep(freq, dur) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine'; osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + dur/1000);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur/1000);
  } catch(e) { /* AudioContext not supported */ }
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  initCameras();
  renderHistory();
  updateStats();
  // Seed stats from history
  stats.total   = scanHistory.length;
  stats.success = scanHistory.filter(h=>h.success).length;
  stats.fail    = scanHistory.filter(h=>!h.success).length;
  updateStats();
});
