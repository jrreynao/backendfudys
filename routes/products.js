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
    let price = price_usd;
    if (typeof price === 'string') {
      // Permite formatos "12,50" o con símbolos, deja solo dígitos, coma y punto
      price = price.trim().replace(/[^0-9,\.\-]/g, '').replace(/,/g, '.');
      price = parseFloat(price);
    }
    if (typeof price !== 'number' || Number.isNaN(price)) price = 0;
    const [result] = await db.query(
      'INSERT INTO products (restaurant_id, name, description, price_usd, image_url) VALUES (?, ?, ?, ?, ?)'
      , [restaurant_id, name, description, price, image_url]
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

module.exports = router;
