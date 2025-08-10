const express = require('express');
const router = express.Router();
const db = require('../db');

// Obtener suscripciones por restaurante
router.get('/:restaurantId', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM subscriptions WHERE restaurant_id = ?', [req.params.restaurantId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Activar suscripción
router.post('/', async (req, res) => {
  const { restaurant_id, start_date, end_date } = req.body;
  try {
    const [result] = await db.query('INSERT INTO subscriptions (restaurant_id, start_date, end_date, is_active) VALUES (?, ?, ?, 1)', [restaurant_id, start_date, end_date]);
    res.json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
