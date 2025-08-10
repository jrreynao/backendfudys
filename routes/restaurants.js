const express = require('express');
const router = express.Router();
const db = require('../db');

// Obtener todos los restaurantes
router.get('/', async (req, res) => {
  try {
    const [restaurants] = await db.query('SELECT * FROM restaurants');
    // Para cada restaurante, obtener sus productos y su suscripción activa
    for (const r of restaurants) {
      const [products] = await db.query('SELECT * FROM products WHERE restaurant_id = ?', [r.id]);
      r.products = products;
      // Obtener la suscripción activa (la más reciente y activa)
      const [subs] = await db.query('SELECT * FROM subscriptions WHERE restaurant_id = ? AND is_active = 1 ORDER BY end_date DESC LIMIT 1', [r.id]);
      r.subscription = subs.length > 0 ? subs[0] : null;
      // Obtener los horarios
      const [openingHours] = await db.query('SELECT * FROM opening_hours WHERE restaurant_id = ?', [r.id]);
      r.openingHours = openingHours;
    }
    res.json(restaurants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Middleware para verificar JWT
const jwt = require('jsonwebtoken');
const jwtSecret = require('../jwt_secret');
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Token requerido' });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token inválido' });
  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

// Registrar nuevo restaurante (requiere autenticación)
router.post('/', authMiddleware, async (req, res) => {
  const { name, description, logo_url, banner_url, custom_url, whatsapp } = req.body;
  const owner_id = req.user.id;
  if (!name || !custom_url) {
    return res.status(400).json({ error: 'Faltan campos obligatorios (name, custom_url)' });
  }
  try {
    // Verificar y actualizar el rol del usuario si es necesario
    const [userRows] = await db.query('SELECT role FROM users WHERE id = ?', [owner_id]);
    if (!userRows.length) {
      return res.status(400).json({ error: 'Usuario no encontrado' });
    }
    if (userRows[0].role !== 'store_owner') {
      await db.query('UPDATE users SET role = ? WHERE id = ?', ['store_owner', owner_id]);
    }
    // Crear restaurante con owner_id
    const [result] = await db.query(
      'INSERT INTO restaurants (owner_id, name, description, logo_url, banner_url, custom_url, whatsapp) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [owner_id, name, description || '', logo_url || '', banner_url || '', custom_url, whatsapp || '']
    );
    const restaurantId = result.insertId;
    // Crear suscripción gratuita de 7 días
    const today = new Date();
    const startDate = today.toISOString().slice(0, 10);
    const endDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await db.query(
      'INSERT INTO subscriptions (restaurant_id, start_date, end_date, is_active) VALUES (?, ?, ?, 1)',
      [restaurantId, startDate, endDate]
    );
    res.status(201).json({ id: restaurantId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

// Obtener configuración completa de un restaurante
router.get('/:id/config', async (req, res) => {
  const { id } = req.params;
  try {
    // Datos básicos del restaurante (incluye custom_url)
    const [restaurants] = await db.query('SELECT name, description, whatsapp, logo_url, banner_url, custom_url FROM restaurants WHERE id = ?', [id]);
    const restaurant = restaurants[0] || {};
    // Métodos de pago
    const [paymentMethods] = await db.query('SELECT * FROM payment_methods WHERE restaurant_id = ?', [id]);
    // Opciones de entrega
    const [deliveryOptions] = await db.query('SELECT * FROM delivery_options WHERE restaurant_id = ?', [id]);
    // Horarios
    const [openingHours] = await db.query('SELECT * FROM opening_hours WHERE restaurant_id = ?', [id]);
    // Suscripción activa
    const [subs] = await db.query('SELECT * FROM subscriptions WHERE restaurant_id = ? AND is_active = 1 ORDER BY end_date DESC LIMIT 1', [id]);
    const subscription = subs.length > 0 ? subs[0] : null;
    // Si no hay logo, usar /uploads/logo.png por defecto
    let logoUrl = restaurant.logo_url;
    if (!logoUrl || logoUrl.trim() === '') {
      logoUrl = '/uploads/logo.png';
    }
    res.json({
      name: restaurant.name || '',
      description: restaurant.description || '',
      whatsapp: restaurant.whatsapp || '',
      logo_url: logoUrl,
      banner_url: restaurant.banner_url || '',
      custom_url: restaurant.custom_url || '',
      paymentMethods,
      deliveryOptions,
      openingHours,
      subscription
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
});

// Subir logo o banner (form-data, campo: logo o banner)
const upload = require('../upload');
const fs = require('fs');
const path = require('path');

router.post('/:id/upload-logo', upload.single('logo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió archivo' });
  const { id } = req.params;
  const logoUrl = `/uploads/${req.file.filename}`;
  try {
    await db.query('UPDATE restaurants SET logo_url = ? WHERE id = ?', [logoUrl, id]);
    res.json({ logo_url: logoUrl });
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar logo' });
  }
});

router.post('/:id/upload-banner', upload.single('banner'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió archivo' });
  const { id } = req.params;
  const bannerUrl = `/uploads/${req.file.filename}`;
  try {
    await db.query('UPDATE restaurants SET banner_url = ? WHERE id = ?', [bannerUrl, id]);
    res.json({ banner_url: bannerUrl });
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar banner' });
  }
});

// Actualizar configuración de un restaurante (nombre, descripción, whatsapp, logo_url, banner_url)
router.put('/:id/config', async (req, res) => {
  const { id } = req.params;
  const { name, description, whatsapp, logo_url, banner_url, custom_url } = req.body;
  try {
    // Validar unicidad de custom_url si se va a actualizar
    if (custom_url !== undefined) {
      const [rows] = await db.query('SELECT id FROM restaurants WHERE custom_url = ? AND id != ?', [custom_url, id]);
      if (rows.length > 0) {
        return res.status(400).json({ error: 'La URL personalizada ya está en uso.' });
      }
    }
    const fields = [];
    const values = [];
    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description); }
    if (whatsapp !== undefined) { fields.push('whatsapp = ?'); values.push(whatsapp); }
    if (logo_url !== undefined) { fields.push('logo_url = ?'); values.push(logo_url); }
    if (banner_url !== undefined) { fields.push('banner_url = ?'); values.push(banner_url); }
    if (custom_url !== undefined) { fields.push('custom_url = ?'); values.push(custom_url); }
    if (fields.length > 0) {
      await db.query(`UPDATE restaurants SET ${fields.join(', ')} WHERE id = ?`, [...values, id]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar configuración' });
  }
});
// Obtener restaurante por custom_url
router.get('/custom/:customUrl', async (req, res) => {
  const { customUrl } = req.params;
  try {
    const [restaurants] = await db.query('SELECT * FROM restaurants WHERE custom_url = ?', [customUrl]);
    if (restaurants.length === 0) {
      return res.status(404).json({ error: 'No encontrado' });
    }
    const r = restaurants[0];
    // Obtener productos
    const [products] = await db.query('SELECT * FROM products WHERE restaurant_id = ?', [r.id]);
    r.products = products;
    // Obtener suscripción activa
    const [subs] = await db.query('SELECT * FROM subscriptions WHERE restaurant_id = ? AND is_active = 1 ORDER BY end_date DESC LIMIT 1', [r.id]);
    r.subscription = subs.length > 0 ? subs[0] : null;
    // Obtener horarios
    const [openingHours] = await db.query('SELECT * FROM opening_hours WHERE restaurant_id = ?', [r.id]);
    r.openingHours = openingHours;
    res.json(r);
  } catch (err) {
    res.status(500).json({ error: 'Error al buscar restaurante por custom_url' });
  }
});
