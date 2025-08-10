const express = require('express');
const router = express.Router();
const db = require('../db');

// Obtener métodos de pago por restaurante
router.get('/:restaurantId', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM payment_methods WHERE restaurant_id = ?', [req.params.restaurantId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Agregar método de pago

// Solo permitir pago_movil y efectivo
const validTypes = ['pago_movil', 'efectivo'];

// Crear o actualizar métodos de pago de una tienda (PUT)
router.put('/:restaurantId', async (req, res) => {
  const { restaurantId } = req.params;
  const { methods } = req.body; // [{type, is_active, cedula, phone, bank}]
  if (!Array.isArray(methods)) return res.status(400).json({ error: 'methods debe ser un array' });
  // Eliminar todos los métodos previos
  await db.query('DELETE FROM payment_methods WHERE restaurant_id = ?', [restaurantId]);
  const created = [];
  for (const m of methods) {
    if (!validTypes.includes(m.type)) continue;
    const [result] = await db.query(
      'INSERT INTO payment_methods (restaurant_id, type, cedula, phone, bank, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [restaurantId, m.type, m.cedula || null, m.phone || null, m.bank || null, m.is_active ? 1 : 0]
    );
    created.push({ id: result.insertId, ...m });
  }
  res.json(created);
});

// Agregar método de pago individual (solo si es válido)
router.post('/', async (req, res) => {
  const { restaurant_id, type, cedula, phone, bank, is_active } = req.body;
  if (!validTypes.includes(type)) return res.status(400).json({ error: 'Método de pago no permitido' });
  try {
    const [result] = await db.query('INSERT INTO payment_methods (restaurant_id, type, cedula, phone, bank, is_active) VALUES (?, ?, ?, ?, ?, ?)', [restaurant_id, type, cedula, phone, bank, is_active ? 1 : 0]);
    res.json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Activar/desactivar método de pago
router.put('/:id', async (req, res) => {
  const { is_active } = req.body;
  try {
    await db.query('UPDATE payment_methods SET is_active=? WHERE id=?', [is_active, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
