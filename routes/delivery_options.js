const express = require('express');
const router = express.Router();
const db = require('../db');

// Obtener opciones de entrega por restaurante
router.get('/:restaurantId', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM delivery_options WHERE restaurant_id = ?', [req.params.restaurantId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Agregar opción de entrega
router.post('/', async (req, res) => {
  const { restaurant_id, type, price } = req.body;
  try {
    let query, params;
    if (type === 'delivery' && price !== undefined) {
      query = 'INSERT INTO delivery_options (restaurant_id, type, price) VALUES (?, ?, ?)';
      params = [restaurant_id, type, price];
    } else {
      query = 'INSERT INTO delivery_options (restaurant_id, type) VALUES (?, ?)';
      params = [restaurant_id, type];
    }
    const [result] = await db.query(query, params);
    res.json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Activar/desactivar opción de entrega
router.put('/:id', async (req, res) => {
  const { is_active } = req.body;
  try {
    await db.query('UPDATE delivery_options SET is_active=? WHERE id=?', [is_active, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
