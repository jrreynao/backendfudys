const authRouter = require('./routes/auth');
const cartRouter = require('./routes/cart');
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();


const restaurantsRouter = require('./routes/restaurants');
const productsRouter = require('./routes/products');
const usersRouter = require('./routes/users');
const salesRouter = require('./routes/sales');
const subscriptionsRouter = require('./routes/subscriptions');
const paymentMethodsRouter = require('./routes/payment_methods');
const deliveryOptionsRouter = require('./routes/delivery_options');
const openingHoursRouter = require('./routes/opening_hours');
const exchangeRatesRouter = require('./routes/exchange_rates');

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use('/api/restaurants', restaurantsRouter);
app.use('/api/products', productsRouter);
app.use('/api/users', usersRouter);
app.use('/api/sales', salesRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/payment-methods', paymentMethodsRouter); // Ruta correcta para payment methods
app.use('/api/delivery-options', deliveryOptionsRouter);
app.use('/api/opening-hours', openingHoursRouter);
app.use('/api/exchange-rates', exchangeRatesRouter);
app.use('/api/auth', authRouter);
app.use('/api/cart', cartRouter);

// Endpoint para subir archivos (logo/banner)
const upload = require('./upload');
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se subió ningún archivo' });
  }
  // Construye la URL pública del archivo
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.listen(3000, () => {
  console.log('Servidor backend corriendo en http://localhost:3000');
});
