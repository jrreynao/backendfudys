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

  // Mapeo 1..7 -> monday..sunday; acepta también strings
  const dayMap = {
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
    6: 'saturday',
    7: 'sunday',
  };
  const normalizeDay = (v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return dayMap[v] || null;
    const s = String(v).trim().toLowerCase();
    const n = parseInt(s, 10);
    if (!isNaN(n) && dayMap[n]) return dayMap[n];
    // Asume viene como nombre ya válido
    if (['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].includes(s)) return s;
    return null;
  };
  const normalizeTime = (t) => {
    if (!t) return null;
    let s = String(t).trim();
    // Acepta HH:mm o HH:mm:ss; agrega segundos si faltan
    if (/^\d{1,2}:\d{2}$/.test(s)) return s + ':00';
    if (/^\d{1,2}:\d{2}:\d{2}$/.test(s)) return s;
    // Intento básico de parseo de "9:0" -> "09:00:00"
    const parts = s.split(':');
    if (parts.length >= 2) {
      const hh = parts[0].padStart(2, '0');
      const mm = parts[1].padStart(2, '0');
      return `${hh}:${mm}:00`;
    }
    return null;
  };

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    // Eliminar horarios existentes
    await conn.query('DELETE FROM opening_hours WHERE restaurant_id = ?', [restaurantId]);
    // Insertar los nuevos horarios
    for (const h of horarios) {
      const day = normalizeDay(h.day_of_week);
      const open = normalizeTime(h.open_time);
      const close = normalizeTime(h.close_time);
      if (!day || !open || !close) {
        throw new Error(`Horario inválido: ${JSON.stringify(h)}`);
      }
      await conn.query(
        'INSERT INTO opening_hours (restaurant_id, day_of_week, open_time, close_time) VALUES (?, ?, ?, ?)',
        [restaurantId, day, open, close]
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
