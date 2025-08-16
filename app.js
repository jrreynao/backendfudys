const authRouter = require('./routes/auth');
const cartRouter = require('./routes/cart');
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

// Permite servir la API bajo un subpath (por ejemplo, /apiv2)
let __rawBase = process.env.BASE_PATH || '';
// Si accidentalmente se pasa una URL completa, extrae solo el pathname
if (/^https?:\/\//i.test(__rawBase)) {
  try { __rawBase = new URL(__rawBase).pathname || ''; } catch {}
}
const BASE_PATH = (__rawBase || '').replace(/\/$/, ''); // sin barra final
const API_PREFIXES = ['/api'];
if (BASE_PATH && BASE_PATH !== '/') {
  API_PREFIXES.push(`${BASE_PATH}/api`);
}


const restaurantsRouter = require('./routes/restaurants');
const productsRouter = require('./routes/products');
const usersRouter = require('./routes/users');
const salesRouter = require('./routes/sales');
const subscriptionsRouter = require('./routes/subscriptions');
const paymentMethodsRouter = require('./routes/payment_methods');
const deliveryOptionsRouter = require('./routes/delivery_options');
const openingHoursRouter = require('./routes/opening_hours');
const exchangeRatesRouter = require('./routes/exchange_rates');
const shareRouter = require('./routes/share');

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
console.log('BASE_PATH:', JSON.stringify(BASE_PATH), 'API_PREFIXES:', API_PREFIXES);
for (const API_PREFIX of API_PREFIXES) {
  app.use(`${API_PREFIX}/restaurants`, restaurantsRouter);
  app.use(`${API_PREFIX}/products`, productsRouter);
  app.use(`${API_PREFIX}/users`, usersRouter);
  app.use(`${API_PREFIX}/sales`, salesRouter);
  app.use(`${API_PREFIX}/subscriptions`, subscriptionsRouter);
  app.use(`${API_PREFIX}/payment-methods`, paymentMethodsRouter); // Ruta correcta para payment methods
  app.use(`${API_PREFIX}/delivery-options`, deliveryOptionsRouter);
  app.use(`${API_PREFIX}/opening-hours`, openingHoursRouter);
  app.use(`${API_PREFIX}/exchange-rates`, exchangeRatesRouter);
  app.use(`${API_PREFIX}/auth`, authRouter);
  app.use(`${API_PREFIX}/cart`, cartRouter);
}

// Share routes (HTML with Open Graph for social previews). Mount at root and BASE_PATH for flexibility.
app.use('/share', shareRouter);
if (BASE_PATH && BASE_PATH !== '/') {
  app.use(`${BASE_PATH}/share`, shareRouter);
}

// Health checks (para probar CORS y disponibilidad sin tocar DB)
app.options('*', cors());
for (const API_PREFIX of API_PREFIXES) app.get(`${API_PREFIX}/health`, (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});
// Health DB: prueba rápida de conexión
const db = require('./db');
for (const API_PREFIX of API_PREFIXES) app.get(`${API_PREFIX}/health/db`, async (req, res) => {
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
for (const API_PREFIX of API_PREFIXES) app.get(`${API_PREFIX}/health/db-network`, async (req, res) => {
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
for (const API_PREFIX of API_PREFIXES) app.get(`${API_PREFIX}/health/egress-ip`, async (req, res) => {
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
for (const API_PREFIX of API_PREFIXES) app.post(`${API_PREFIX}/upload`, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se subió ningún archivo' });
  }
  // Construye la URL pública del archivo
  const fileUrl = `/uploads/${req.file.filename}`;
  // Variante que pasa por el prefijo /api para asegurar cabeceras CORS cuando solo se proxyan rutas /api/*
  const apiUploadsPrefix = (BASE_PATH && BASE_PATH !== '/') ? `${BASE_PATH}/api/uploads` : `/api/uploads`;
  const apiUrl = `${apiUploadsPrefix}/${req.file.filename}`;
  res.json({ url: fileUrl, apiUrl });
});

// Servir uploads en ambos prefijos con CORS explícito para imágenes
// Permite sobreescribir la carpeta con UPLOADS_DIR para apuntar a un directorio absoluto del servidor (ej: /home/user/public_html/apiv2/uploads)
const uploadsDir = process.env.UPLOADS_DIR && process.env.UPLOADS_DIR.trim()
  ? process.env.UPLOADS_DIR.trim()
  : path.join(__dirname, 'uploads');
const uploadsCors = (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  // Permite que navegadores consuman imágenes sin bloquear por CORP
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
};
app.use('/uploads', uploadsCors, express.static(uploadsDir));
if (BASE_PATH && BASE_PATH !== '/') {
  app.use(`${BASE_PATH}/uploads`, uploadsCors, express.static(uploadsDir));
}

// También servir uploads bajo el prefijo /api para entornos donde solo se reenvía BASE_PATH/api/* al Node (cPanel/Proxy)
if (BASE_PATH && BASE_PATH !== '/') {
  app.use(`${BASE_PATH}/api/uploads`, uploadsCors, express.static(uploadsDir));
} else {
  app.use(`/api/uploads`, uploadsCors, express.static(uploadsDir));
}

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
