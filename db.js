// Conexión a MySQL para desarrollo y producción (Render/cPanel)
const mysql = require('mysql2/promise');

// Permite conexión por socket (cPanel) o por host/puerto (Render)
const useSocket = !!process.env.DB_SOCKET;

// Timeouts opcionales
const connectTimeout = process.env.DB_CONNECT_TIMEOUT_MS
  ? parseInt(process.env.DB_CONNECT_TIMEOUT_MS, 10)
  : 10000; // 10s por defecto
const acquireTimeout = process.env.DB_ACQUIRE_TIMEOUT_MS
  ? parseInt(process.env.DB_ACQUIRE_TIMEOUT_MS, 10)
  : 10000; // 10s por defecto

// SSL opcional (para proveedores que requieran TLS)
let ssl;
if ((process.env.DB_SSL || '').toLowerCase() === 'true') {
  ssl = {
    rejectUnauthorized: (process.env.DB_SSL_REJECT_UNAUTHORIZED || 'true').toLowerCase() === 'true',
  };
  if (process.env.DB_SSL_CA) {
    ssl.ca = process.env.DB_SSL_CA;
  }
}
const baseConfig = {
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'app',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout,
  acquireTimeout,
};

const config = useSocket
  ? { ...baseConfig, socketPath: process.env.DB_SOCKET, ...(ssl ? { ssl } : {}) }
  : {
      ...baseConfig,
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
      ...(ssl ? { ssl } : {}),
    };

// Log seguro (sin credenciales)
console.log('[DB] Modo conexión:', useSocket ? 'socket' : 'host');
if (useSocket) {
  console.log('[DB] socketPath:', process.env.DB_SOCKET);
} else {
  console.log('[DB] host:', config.host, 'port:', config.port, 'db:', config.database);
}
if (ssl) {
  console.log('[DB] SSL: enabled; rejectUnauthorized:', ssl.rejectUnauthorized, ssl.ca ? 'CA: provided' : 'CA: none');
} else {
  console.log('[DB] SSL: disabled');
}
console.log('[DB] Timeouts ms -> connect:', connectTimeout, 'acquire:', acquireTimeout);

const pool = mysql.createPool(config);
module.exports = pool;
