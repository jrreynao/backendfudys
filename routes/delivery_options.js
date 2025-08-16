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

// Actualizar (upsert) opciones de entrega por restaurante
router.put('/:restaurantId', async (req, res) => {
  const { restaurantId } = req.params;
  const { options } = req.body || {};
  if (!Array.isArray(options)) {
    return res.status(400).json({ error: 'Payload inválido: se espera { options: [...] }' });
  }
  const conn = db; // usando pool directo
  try {
    for (const opt of options) {
      const type = opt.type;
      const is_active = opt.is_active ? 1 : 0;
      let price = null;
      if (type === 'delivery') {
        const v = opt.price;
        if (typeof v === 'number') price = v;
        else if (typeof v === 'string') {
          // Normaliza coma decimal
          let cleaned = v.trim().replace(/[^0-9,.-]/g, '');
          if (cleaned.includes(',') && !cleaned.includes('.')) cleaned = cleaned.replace(/,/g, '.');
          if (cleaned.includes(',') && cleaned.includes('.')) {
            const lastComma = cleaned.lastIndexOf(',');
            const lastDot = cleaned.lastIndexOf('.');
            const decIndex = lastComma > lastDot ? lastComma : lastDot;
            const integerPart = cleaned.substring(0, decIndex).replace(/[.,]/g, '');
            const fracPart = cleaned.substring(decIndex + 1).replace(/[.,]/g, '');
            cleaned = integerPart + '.' + fracPart;
          }
          const parsed = parseFloat(cleaned);
          if (!isNaN(parsed)) price = parsed;
        }
      }
      // Buscar existente
      const [rows] = await conn.query('SELECT id FROM delivery_options WHERE restaurant_id = ? AND type = ? LIMIT 1', [restaurantId, type]);
      if (rows.length) {
        const id = rows[0].id;
        if (type === 'delivery' && price !== null) {
          await conn.query('UPDATE delivery_options SET is_active = ?, price = ? WHERE id = ?', [is_active, price, id]);
        } else {
          await conn.query('UPDATE delivery_options SET is_active = ? WHERE id = ?', [is_active, id]);
        }
      } else {
        if (type === 'delivery' && price !== null) {
          await conn.query('INSERT INTO delivery_options (restaurant_id, type, is_active, price) VALUES (?, ?, ?, ?)', [restaurantId, type, is_active, price]);
        } else {
          await conn.query('INSERT INTO delivery_options (restaurant_id, type, is_active) VALUES (?, ?, ?)', [restaurantId, type, is_active]);
        }
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
