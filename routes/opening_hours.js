const express = require('express');
const router = express.Router();
const db = require('../db');

// Obtener horarios por restaurante
router.get('/:restaurantId', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM opening_hours WHERE restaurant_id = ?', [req.params.restaurantId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Agregar horario
router.post('/', async (req, res) => {
  const { restaurant_id, day_of_week, open_time, close_time } = req.body;
  try {
    const [result] = await db.query('INSERT INTO opening_hours (restaurant_id, day_of_week, open_time, close_time) VALUES (?, ?, ?, ?)', [restaurant_id, day_of_week, open_time, close_time]);
    res.json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

// Actualizar todos los horarios de un restaurante
router.put('/:restaurantId', async (req, res) => {
  const restaurantId = req.params.restaurantId;
  const horarios = req.body.horarios;
  if (!Array.isArray(horarios)) {
    return res.status(400).json({ error: 'El payload debe incluir un array "horarios".' });
  }
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    // Eliminar horarios existentes
    await conn.query('DELETE FROM opening_hours WHERE restaurant_id = ?', [restaurantId]);
    // Insertar los nuevos horarios
    for (const h of horarios) {
      await conn.query(
        'INSERT INTO opening_hours (restaurant_id, day_of_week, open_time, close_time) VALUES (?, ?, ?, ?)',
        [restaurantId, h.day_of_week, h.open_time, h.close_time]
      );
    }
    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});
