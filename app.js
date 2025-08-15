const authRouter = require('./routes/auth');
const cartRouter = require('./routes/cart');
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();


const restaurantsRouter = require('./routes/restaurants');
const productsRouter = require('./routes/products');
const usersRouter = require('./routes/users');
const salesRouter = require('./routes/sales');
const subscriptionsRouter = require('./routes/subscriptions');
const paymentMethodsRouter = require('./routes/payment_methods');
const deliveryOptionsRouter = require('./routes/delivery_options');
const openingHoursRouter = require('./routes/opening_hours');
const exchangeRatesRouter = require('./routes/exchange_rates');

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use('/api/restaurants', restaurantsRouter);
app.use('/api/products', productsRouter);
app.use('/api/users', usersRouter);
app.use('/api/sales', salesRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/payment-methods', paymentMethodsRouter); // Ruta correcta para payment methods
app.use('/api/delivery-options', deliveryOptionsRouter);
app.use('/api/opening-hours', openingHoursRouter);
app.use('/api/exchange-rates', exchangeRatesRouter);
app.use('/api/auth', authRouter);
app.use('/api/cart', cartRouter);

// Health checks (para probar CORS y disponibilidad sin tocar DB)
app.options('*', cors());
app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});
// Health DB: prueba rápida de conexión
const db = require('./db');
app.get('/api/health/db', async (req, res) => {
  try {
    const conn = await db.getConnection();
    await conn.query('SELECT 1');
    conn.release?.();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Chequeo de red a host/puerto de DB (sin abrir sesión MySQL) para diagnosticar ETIMEDOUT/ENOTFOUND
app.get('/api/health/db-network', async (req, res) => {
  const net = require('net');
  const host = process.env.DB_SOCKET ? '(socket)' : (process.env.DB_HOST || 'localhost');
  const port = process.env.DB_SOCKET ? 0 : (process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306);
  if (process.env.DB_SOCKET) {
    return res.json({ ok: true, mode: 'socket', socketPath: process.env.DB_SOCKET });
  }
  const start = Date.now();
  const socket = new net.Socket();
  let finished = false;
  socket.setTimeout(5000);
  socket.once('connect', () => {
    finished = true;
    socket.destroy();
    res.json({ ok: true, host, port, rttMs: Date.now() - start });
  });
  socket.once('timeout', () => {
    if (finished) return;
    finished = true;
    socket.destroy();
    res.status(504).json({ ok: false, host, port, error: 'timeout', rttMs: Date.now() - start });
  });
  socket.once('error', (err) => {
    if (finished) return;
    finished = true;
    res.status(502).json({ ok: false, host, port, error: err.code || err.message });
  });
  try {
    socket.connect(port, host);
  } catch (err) {
    res.status(500).json({ ok: false, host, port, error: err.message });
  }
});

// Egress IP del servidor (para whitelisting en cPanel Remote MySQL)
app.get('/api/health/egress-ip', async (req, res) => {
  try {
    const https = require('https');
    https.get('https://api.ipify.org?format=json', (r) => {
      let data = '';
      r.on('data', (chunk) => (data += chunk));
      r.on('end', () => {
        try {
          const json = JSON.parse(data);
          res.json({ ok: true, ip: json.ip });
        } catch (e) {
          res.status(502).json({ ok: false, error: 'invalid ipify response' });
        }
      });
    }).on('error', (err) => {
      res.status(502).json({ ok: false, error: err.message });
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Endpoint para subir archivos (logo/banner)
const upload = require('./upload');
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se subió ningún archivo' });
  }
  // Construye la URL pública del archivo
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error global:', err);
  res.status(500).json({ error: 'Error interno del servidor', details: err.message });
});

const port = process.env.PORT || 3000;
try {
  app.listen(port, () => {
    console.log(`Servidor backend corriendo en el puerto ${port}`);
  });
} catch (err) {
  console.error('Error al iniciar el servidor:', err);
}
