// Conexión a MySQL para desarrollo y producción (Render/cPanel)
const mysql = require('mysql2/promise');

// Permite conexión por socket (cPanel) o por host/puerto (Render)
const useSocket = !!process.env.DB_SOCKET;
const baseConfig = {
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'app',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const config = useSocket
  ? { ...baseConfig, socketPath: process.env.DB_SOCKET }
  : {
      ...baseConfig,
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    };

// Log seguro (sin credenciales)
console.log('[DB] Modo conexión:', useSocket ? 'socket' : 'host');
if (useSocket) {
  console.log('[DB] socketPath:', process.env.DB_SOCKET);
} else {
  console.log('[DB] host:', config.host, 'port:', config.port, 'db:', config.database);
}

const pool = mysql.createPool(config);
module.exports = pool;
