const express = require('express');
const router = express.Router();
const db = require('../db');

// Obtener ventas por restaurante
router.get('/:restaurantId', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM sales WHERE restaurant_id = ?', [req.params.restaurantId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Registrar venta
router.post('/', async (req, res) => {
  const { restaurant_id, user_id, total_usd, total_ves, commission_usd } = req.body;
  try {
    const [result] = await db.query('INSERT INTO sales (restaurant_id, user_id, total_usd, total_ves, commission_usd) VALUES (?, ?, ?, ?, ?)', [restaurant_id, user_id, total_usd, total_ves, commission_usd]);
    res.json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Estadísticas de ventas y suscripción para un restaurante
router.get('/restaurant/:restaurantId/stats', async (req, res) => {
  const { restaurantId } = req.params;
  const { from, to } = req.query;
  try {
    // Totales generales
    const [totals] = await db.query(
      `SELECT 
        IFNULL(SUM(total_usd),0) AS total_sales_usd,
        IFNULL(SUM(total_ves),0) AS total_sales_ves,
        COUNT(*) AS total_orders
      FROM sales
      WHERE restaurant_id = ?
        AND created_at BETWEEN ? AND ?`,
      [restaurantId, from || '2000-01-01', to || '2100-12-31']
    );

    // Ventas agrupadas por día
    const [byDay] = await db.query(
      `SELECT 
        DATE(created_at) AS date,
        COUNT(*) AS orders,
        IFNULL(SUM(total_usd),0) AS amount_usd,
        IFNULL(SUM(total_ves),0) AS amount_ves
      FROM sales
      WHERE restaurant_id = ?
        AND created_at BETWEEN ? AND ?
      GROUP BY DATE(created_at)
      ORDER BY date DESC`,
      [restaurantId, from || '2000-01-01', to || '2100-12-31']
    );

    // Suscripción activa
    const [subs] = await db.query(
      `SELECT is_active, start_date, end_date, DATEDIFF(end_date, CURDATE()) AS days_left
       FROM subscriptions
       WHERE restaurant_id = ? AND is_active = TRUE
       ORDER BY end_date DESC LIMIT 1`,
      [restaurantId]
    );

    res.json({
      total_sales_usd: totals[0].total_sales_usd,
      total_sales_ves: totals[0].total_sales_ves,
      total_orders: totals[0].total_orders,
      sales_by_day: byDay,
      subscription: subs[0] || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Estadísticas globales para super admin
router.get('/global/stats', async (req, res) => {
  const { from, to } = req.query;
  try {
    // Totales globales
    const [totals] = await db.query(
      `SELECT 
        IFNULL(SUM(total_usd),0) AS total_sales_usd,
        IFNULL(SUM(total_ves),0) AS total_sales_ves,
        COUNT(*) AS total_orders
      FROM sales
      WHERE created_at BETWEEN ? AND ?`,
      [from || '2000-01-01', to || '2100-12-31']
    );

    // Ventas agrupadas por tienda
    const [byStore] = await db.query(
      `SELECT 
        s.restaurant_id,
        r.name AS restaurant_name,
        IFNULL(SUM(s.total_usd),0) AS total_usd,
        IFNULL(SUM(s.total_ves),0) AS total_ves,
        COUNT(*) AS orders
      FROM sales s
      JOIN restaurants r ON s.restaurant_id = r.id
      WHERE s.created_at BETWEEN ? AND ?
      GROUP BY s.restaurant_id, r.name
      ORDER BY total_usd DESC`,
      [from || '2000-01-01', to || '2100-12-31']
    );

    res.json({
      total_sales_usd: totals[0].total_sales_usd,
      total_sales_ves: totals[0].total_sales_ves,
      total_orders: totals[0].total_orders,
      sales_by_store: byStore
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
