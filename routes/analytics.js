const express = require('express');
const router = express.Router();
const db = require('../db');

function parseDate(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// POST /analytics/visit/:customUrl -> registra una visita
router.post('/visit/:customUrl', async (req, res) => {
  const { customUrl } = req.params;
  try {
    const [rows] = await db.query('SELECT id FROM restaurants WHERE custom_url = ?', [customUrl]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Tienda no encontrada' });
    }
    const restaurantId = rows[0].id;
    const ua = (req.headers['user-agent'] || '').toString().slice(0, 255);
    const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString().slice(0, 100);
    try {
      await db.query(
        'INSERT INTO store_visits (restaurant_id, custom_url, user_agent, ip) VALUES (?, ?, ?, ?)',
        [restaurantId, customUrl, ua, ip]
      );
    } catch (err) {
      // Si la tabla no existe, intenta crearla on-the-fly (idempotente)
      if (err && (err.code === 'ER_NO_SUCH_TABLE' || /doesn\'t exist/i.test(err.message))) {
        try {
          await db.query(`CREATE TABLE IF NOT EXISTS store_visits (
            id INT AUTO_INCREMENT PRIMARY KEY,
            restaurant_id INT NOT NULL,
            custom_url VARCHAR(120) NOT NULL,
            user_agent VARCHAR(255),
            ip VARCHAR(100),
            visited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_restaurant_id (restaurant_id),
            INDEX idx_custom_url (custom_url),
            INDEX idx_visited_at (visited_at),
            FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
          await db.query(
            'INSERT INTO store_visits (restaurant_id, custom_url, user_agent, ip) VALUES (?, ?, ?, ?)',
            [restaurantId, customUrl, ua, ip]
          );
        } catch (e2) {
          console.error('Error creando/insertando store_visits:', e2);
          // No bloquear al usuario final por problemas de analítica
        }
      } else {
        console.error('Error insertando visita:', err);
      }
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error registrando visita' });
  }
});

// GET /analytics/visits/by-store?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/visits/by-store', async (req, res) => {
  const from = parseDate(req.query.from);
  const to = parseDate(req.query.to);
  try {
    let where = '';
    const params = [];
    if (from) { where += (where ? ' AND ' : ' WHERE ') + 'v.visited_at >= ?'; params.push(from.toISOString().slice(0, 19).replace('T',' ')); }
    if (to)   { where += (where ? ' AND ' : ' WHERE ') + 'v.visited_at <= ?'; params.push(to.toISOString().slice(0, 19).replace('T',' ')); }
    const [rows] = await db.query(
      `SELECT r.id AS restaurant_id, r.name AS restaurant_name, r.custom_url, COUNT(v.id) AS visits
       FROM restaurants r
       LEFT JOIN store_visits v ON v.restaurant_id = r.id ${where}
       GROUP BY r.id, r.name, r.custom_url
       ORDER BY visits DESC, r.name ASC
       LIMIT 500`,
      params
    );
    res.json(rows || []);
  } catch (err) {
    // Si la tabla no existe, responder con todos 0
    if (err && (err.code === 'ER_NO_SUCH_TABLE' || /doesn\'t exist/i.test(err.message))) {
      try {
        const [rows] = await db.query('SELECT id AS restaurant_id, name AS restaurant_name, custom_url FROM restaurants');
        res.json((rows || []).map(r => ({ ...r, visits: 0 })));
      } catch (e2) {
        res.status(500).json({ error: e2.message || 'Error obteniendo visitas' });
      }
    } else {
      res.status(500).json({ error: err.message || 'Error obteniendo visitas' });
    }
  }
});

module.exports = router;
