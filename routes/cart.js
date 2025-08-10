const express = require('express');
const router = express.Router();
const db = require('../db');

// Guardar carrito temporal (puede ser en frontend, aquí solo ejemplo de endpoint)
router.post('/save', async (req, res) => {
  // Aquí podrías guardar el carrito en la base de datos si lo deseas
  res.json({ success: true });
});

// Generar mensaje de WhatsApp para pedido
router.post('/whatsapp-message', async (req, res) => {
  const { products, total_usd, total_ves, customer_name, restaurant_whatsapp } = req.body;
  let message = `¡Hola! Quiero hacer un pedido:\n`;
  products.forEach((p, i) => {
    message += `- ${p.name} x${p.quantity} ($${p.price_usd} / Bs. ${p.price_ves})\n`;
  });
  message += `Total: $${total_usd} / Bs. ${total_ves}\n`;
  if (customer_name) message += `Cliente: ${customer_name}\n`;
  const url = `https://wa.me/${restaurant_whatsapp}?text=${encodeURIComponent(message)}`;
  res.json({ whatsapp_url: url, message });
});

module.exports = router;
