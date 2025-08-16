const express = require('express');
const router = express.Router();
const db = require('../db');

// Obtener productos de un restaurante (ordenados por display_order)
router.get('/:restaurantId', async (req, res) => {
  try {
  const [rows] = await db.query('SELECT * FROM products WHERE restaurant_id = ? ORDER BY display_order ASC, id ASC', [req.params.restaurantId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Agregar producto
router.post('/', async (req, res) => {
  const { restaurant_id, name, description, price_usd, image_url } = req.body;
  try {
    let price = price_usd;
    if (typeof price === 'string') {
      // Permite formatos "12,50" o con símbolos, deja solo dígitos, coma y punto
      price = price.trim().replace(/[^0-9,\.\-]/g, '').replace(/,/g, '.');
      price = parseFloat(price);
    }
    if (typeof price !== 'number' || Number.isNaN(price)) price = 0;
    // Calcular el próximo display_order para este restaurante
    const [nextRows] = await db.query('SELECT COALESCE(MAX(display_order)+1, 0) AS nextOrder FROM products WHERE restaurant_id = ?', [restaurant_id]);
    const nextOrder = (nextRows && nextRows[0] && nextRows[0].nextOrder !== undefined) ? nextRows[0].nextOrder : 0;
    const [result] = await db.query(
      'INSERT INTO products (restaurant_id, name, description, price_usd, image_url, display_order) VALUES (?, ?, ?, ?, ?, ?)',
      [restaurant_id, name, description, price, image_url, nextOrder]
    );
    res.json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Editar producto
router.put('/:id', async (req, res) => {
  const { name, description, price_usd, image_url } = req.body;
  try {
    let price = price_usd;
    if (typeof price === 'string') {
      price = price.trim().replace(/[^0-9,\.\-]/g, '').replace(/,/g, '.');
      price = parseFloat(price);
    }
    if (typeof price !== 'number' || Number.isNaN(price)) price = 0;
    await db.query('UPDATE products SET name=?, description=?, price_usd=?, image_url=? WHERE id=?', [name, description, price, image_url, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eliminar producto
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM products WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reordenar productos: body = { items: [{id: number, order: number}, ...] }
router.put('/reorder/:restaurantId', async (req, res) => {
  const { items } = req.body || {};
  const restaurantId = req.params.restaurantId;
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'Formato inválido' });
  }
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (const it of items) {
      if (typeof it.id === 'undefined' || typeof it.order === 'undefined') continue;
      await conn.query(
        'UPDATE products SET display_order = ? WHERE id = ? AND restaurant_id = ?',
        [it.order, it.id, restaurantId]
      );
    }
    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    try { await conn.rollback(); } catch(_) {}
    res.status(500).json({ error: err.message });
  } finally {
    try { await conn.release(); } catch(_) {}
  }
});

module.exports = router;
