const express = require('express');
const path = require('path');
const app = express();

// ---- Middleware ----
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---- CORS (dev convenience) ----
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// ---- Serve static files from public/ ----
app.use(express.static(path.join(__dirname, 'public')));

// ---- API Routes (placeholder — expand as needed) ----
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'Smart Booking System' });
});

// GET /api/slots?venueId=san-cau-long&date=2026-10-12
app.get('/api/slots', (req, res) => {
  const { venueId, date } = req.query;
  // Mock response — replace with real DB queries
  res.json({
    venueId: venueId || 'san-cau-long',
    date: date || new Date().toISOString().slice(0, 10),
    slots: [
      { start: '06:00', end: '07:00', status: 'available' },
      { start: '07:00', end: '08:00', status: 'available' },
      { start: '08:00', end: '09:00', status: 'booked' },
      { start: '09:00', end: '10:00', status: 'booked' },
      { start: '10:00', end: '11:00', status: 'available' },
      { start: '11:00', end: '12:00', status: 'available' },
      { start: '13:00', end: '14:00', status: 'available' },
      { start: '14:00', end: '15:00', status: 'booked' },
      { start: '15:00', end: '16:00', status: 'available' },
      { start: '16:00', end: '17:00', status: 'available' },
      { start: '17:00', end: '18:00', status: 'booked' },
      { start: '18:00', end: '19:00', status: 'available' },
      { start: '19:00', end: '20:00', status: 'available' },
      { start: '20:00', end: '21:00', status: 'maintenance' },
      { start: '21:00', end: '22:00', status: 'maintenance' },
    ]
  });
});

// POST /api/bookings — create a booking
app.post('/api/bookings', (req, res) => {
  const { venue, date, slots, customer, paymentMethod } = req.body;
  if(!venue || !date || !slots || !customer) {
    return res.status(400).json({ error: 'Thiếu thông tin đặt lịch' });
  }
  const code = 'SB-' + Math.random().toString(36).toUpperCase().slice(2, 8);
  res.status(201).json({
    success: true,
    bookingCode: code,
    message: 'Đặt lịch thành công!',
    data: { code, venue, date, slots, customer, paymentMethod, createdAt: new Date().toISOString() }
  });
});

// POST /api/checkin — verify a QR ticket
app.post('/api/checkin', (req, res) => {
  const { code } = req.body;
  if(!code) return res.status(400).json({ error: 'Thiếu mã đặt lịch' });
  // Mock validation — integrate with real DB
  const valid = code.startsWith('SB-');
  if(valid) {
    res.json({ success: true, message: 'Check-in thành công!', code, checkedAt: new Date().toISOString() });
  } else {
    res.status(404).json({ success: false, message: 'Mã đặt lịch không hợp lệ', code });
  }
});

// ---- Fallback: serve index.html for all non-API routes (Express 5 syntax) ----
app.use((req, res) => {
  if(req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint không tồn tại' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---- Start server ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Smart Booking System đang chạy tại: http://localhost:${PORT}`);
  console.log(`📅 Calendar:   http://localhost:${PORT}/index.html`);
  console.log(`💳 Checkout:   http://localhost:${PORT}/checkout.html`);
  console.log(`🛡️  Admin Scan: http://localhost:${PORT}/admin-scan.html`);
  console.log(`❤️  Health API: http://localhost:${PORT}/api/health\n`);
});
