const express = require('express');
const router = express.Router();
const db = require('../db');

// Obtener productos de un restaurante
router.get('/:restaurantId', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM products WHERE restaurant_id = ?', [req.params.restaurantId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Agregar producto
router.post('/', async (req, res) => {
  const { restaurant_id, name, description, price_usd, image_url } = req.body;
  try {
    const [result] = await db.query('INSERT INTO products (restaurant_id, name, description, price_usd, image_url) VALUES (?, ?, ?, ?, ?)', [restaurant_id, name, description, price_usd, image_url]);
    res.json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Editar producto
router.put('/:id', async (req, res) => {
  const { name, description, price_usd, image_url } = req.body;
  try {
    await db.query('UPDATE products SET name=?, description=?, price_usd=?, image_url=? WHERE id=?', [name, description, price_usd, image_url, req.params.id]);
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

module.exports = router;
