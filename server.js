const express = require('express');
const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Server Node.js đang chạy ngon lành!');
});

app.listen(3000, () => {
  console.log('Localhost đang chạy tại: http://localhost:3000');
});