// Conexión a MySQL para desarrollo local y producción
const mysql = require('mysql2/promise');

const isProduction = false; // Cambia a true cuando subas a cPanel

const config = isProduction
  ? {
      host: 'TU_HOST_CPanel',
      user: 'TU_USUARIO_CPanel',
      password: 'TU_PASSWORD_CPanel',
      database: 'TU_DB_CPanel',
      port: 3306,
    }
  : {
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'app',
      port: 3306,
    };

const pool = mysql.createPool(config);

module.exports = pool;
