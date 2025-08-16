// Conexión a MySQL para desarrollo local y producción
const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'app',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
};

console.log('Conectando a MySQL con config:', config);
const pool = mysql.createPool(config);
pool.getConnection = async function() {
  return await mysql.createPool(config).getConnection();
};
module.exports = pool;
