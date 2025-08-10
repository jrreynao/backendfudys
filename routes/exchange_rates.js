const express = require('express');
const router = express.Router();
const db = require('../db');

// Obtener tasa de cambio más reciente
router.get('/latest', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM exchange_rates ORDER BY date DESC LIMIT 1');
    res.json(rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Agregar tasa de cambio
router.post('/', async (req, res) => {
  const { usd_to_ves, date } = req.body;
  try {
    const [result] = await db.query('INSERT INTO exchange_rates (usd_to_ves, date) VALUES (?, ?)', [usd_to_ves, date]);
    res.json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
