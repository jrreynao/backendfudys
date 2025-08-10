const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');
const jwtSecret = require('../jwt_secret');
const bcrypt = require('bcryptjs');

// Middleware para verificar JWT
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  console.log('Authorization header:', authHeader);
  if (!authHeader) return res.status(401).json({ error: 'Token requerido' });
  const token = authHeader.split(' ')[1];
  console.log('Token recibido:', token);
  if (!token) return res.status(401).json({ error: 'Token inválido' });
  try {
    const decoded = jwt.verify(token, jwtSecret);
    console.log('Token decodificado:', decoded);
    req.user = decoded;
    next();
  } catch (err) {
    console.log('Error al verificar token:', err.message);
    return res.status(401).json({ error: 'Token inválido' });
  }
}

// Recuperar contraseña: envía email con enlace de recuperación
const nodemailer = require('nodemailer');

// ENDPOINTS DE RECUPERACIÓN DE CONTRASEÑA PRIMERO
router.post('/recover-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requerido' });
  try {
    // Verifica si el usuario existe
    const [userRows] = await db.query('SELECT id, email, name FROM users WHERE email = ?', [email]);
    if (!userRows.length) {
      // No revela si el email existe por seguridad
      return res.json({ success: true });
    }
    const user = userRows[0];
    // Genera un token de recuperación (puedes usar UUID o JWT si prefieres)
    const recoveryToken = Math.random().toString(36).substr(2, 32);
    // Guarda el token en la base de datos (asegúrate de tener la tabla password_resets)
    await db.query('INSERT INTO password_resets (user_id, token, created_at) VALUES (?, ?, NOW())', [user.id, recoveryToken]);
    // Construye el enlace de recuperación usando el host de la petición
    // Usa FRONTEND_URL si está definida, si no usa el host de la petición
    const frontendUrl = process.env.FRONTEND_URL;
    let recoveryUrl;
    if (frontendUrl) {
      recoveryUrl = `${frontendUrl.replace(/\/$/, '')}/reset-password?token=${recoveryToken}`;
    } else {
      const protocol = req.protocol;
      const host = req.get('host');
      recoveryUrl = `${protocol}://${host}/reset-password?token=${recoveryToken}`;
    }
    // Configura el transporter SMTP usando variables de entorno
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: parseInt(process.env.SMTP_PORT) === 465, // true para 465, false para otros
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        rejectUnauthorized: false // Ignorar error de certificado en pruebas
      }
    });
    // Envía el correo
    await transporter.sendMail({
      from: 'Fudys <info@fudys.app>',
      to: email,
      subject: 'Recupera tu contraseña',
      html: `<p>Hola ${user.name || ''},<br>Recibimos una solicitud para recuperar tu contraseña.<br><a href='${recoveryUrl}'>Haz clic aquí para restablecerla</a>.<br>Si no solicitaste esto, ignora este mensaje.</p>`
    });
    return res.json({ success: true });
  } catch (err) {
    console.error('Error en recover-password:', err);
    return res.status(500).json({ error: 'Error enviando el correo' });
  }
});

router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: 'Token y nueva contraseña requeridos' });
  try {
    // Busca el token en la base de datos
    const [resetRows] = await db.query('SELECT * FROM password_resets WHERE token = ?', [token]);
    if (!resetRows.length) return res.status(400).json({ error: 'Token inválido' });
    const reset = resetRows[0];
    // Verifica si el token ya fue usado
    if (reset.used) return res.status(400).json({ error: 'Token ya utilizado' });
    // Verifica expiración (válido 1 hora)
    const createdAt = new Date(reset.created_at);
    const now = new Date();
    if ((now - createdAt) > 60 * 60 * 1000) return res.status(400).json({ error: 'Token expirado' });
    // Actualiza la contraseña del usuario
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, reset.user_id]);
    // Marca el token como usado
    await db.query('UPDATE password_resets SET used = 1 WHERE id = ?', [reset.id]);
    return res.json({ success: true });
  } catch (err) {
    console.error('Error en reset-password:', err);
    return res.status(500).json({ error: 'Error al restablecer la contraseña' });
  }
});

// Eliminar cuenta y todos los datos relacionados del usuario autenticado
router.delete('/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Contraseña requerida' });
    // Obtener hash de la contraseña
    const [userRows] = await db.query('SELECT password, role FROM users WHERE id = ?', [userId]);
    if (!userRows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    const hash = userRows[0].password;
    const role = userRows[0].role;
    const valid = await bcrypt.compare(password, hash);
    if (!valid) return res.status(401).json({ error: 'Contraseña incorrecta' });
    // Eliminar datos relacionados
    // Si es dueño de tienda, buscar restaurante
    let restaurantId = null;
    if (role === 'store_owner' || role === 'admin') {
      const [restRows] = await db.query('SELECT id FROM restaurants WHERE owner_id = ?', [userId]);
      if (restRows.length) {
        restaurantId = restRows[0].id;
        // Eliminar horarios
        await db.query('DELETE FROM opening_hours WHERE restaurant_id = ?', [restaurantId]);
        // Eliminar métodos de pago
        await db.query('DELETE FROM payment_methods WHERE restaurant_id = ?', [restaurantId]);
        // Eliminar opciones de entrega
        await db.query('DELETE FROM delivery_options WHERE restaurant_id = ?', [restaurantId]);
        // Eliminar productos
        await db.query('DELETE FROM products WHERE restaurant_id = ?', [restaurantId]);
        // Eliminar ventas y sus items
        const [sales] = await db.query('SELECT id FROM sales WHERE restaurant_id = ?', [restaurantId]);
        for (const sale of sales) {
          await db.query('DELETE FROM sale_items WHERE sale_id = ?', [sale.id]);
        }
        await db.query('DELETE FROM sales WHERE restaurant_id = ?', [restaurantId]);
        // Eliminar suscripciones
        await db.query('DELETE FROM subscriptions WHERE restaurant_id = ?', [restaurantId]);
        // Eliminar restaurante
        await db.query('DELETE FROM restaurants WHERE id = ?', [restaurantId]);
      }
    }
    // Eliminar ventas hechas como usuario (comprador)
    const [userSales] = await db.query('SELECT id FROM sales WHERE user_id = ?', [userId]);
    for (const sale of userSales) {
      await db.query('DELETE FROM sale_items WHERE sale_id = ?', [sale.id]);
    }
    await db.query('DELETE FROM sales WHERE user_id = ?', [userId]);
    // Finalmente, eliminar usuario
    await db.query('DELETE FROM users WHERE id = ?', [userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Actualizar perfil del usuario autenticado (nombre, email, teléfono)
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email, phone } = req.body;
    if (!name && !email && !phone) {
      return res.status(400).json({ error: 'Debe proporcionar al menos un campo para actualizar (name, email, phone)' });
    }
    // Construir consulta dinámica
    const fields = [];
    const values = [];
    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (email !== undefined) { fields.push('email = ?'); values.push(email); }
    if (phone !== undefined) { fields.push('phone = ?'); values.push(phone); }
    if (fields.length === 0) {
      return res.status(400).json({ error: 'Nada para actualizar' });
    }
    await db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, [...values, userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener perfil del usuario autenticado
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    console.log('Buscando usuario con id:', req.user.id);
    const [rows] = await db.query('SELECT id, name, email, phone, role FROM users WHERE id = ?', [req.user.id]);
    if (rows.length === 0) {
      console.log('Usuario no encontrado en la base de datos');
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    console.log('Usuario encontrado:', rows[0]);
    res.json(rows[0]);
  } catch (err) {
    console.log('Error al buscar usuario:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Obtener todos los usuarios
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM users');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Registrar usuario (siempre hashear la contraseña)
router.post('/', async (req, res) => {
  const { name, email, password, role, phone } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)',
      [name, email, hashedPassword, role || 'customer', phone]
    );
    // Obtener el usuario recién creado
    const [userRows] = await db.query('SELECT id, name, email, role FROM users WHERE id = ?', [result.insertId]);
    const user = userRows[0];
    // Generar token JWT
    const jwt = require('jsonwebtoken');
    const jwtSecret = require('../jwt_secret');
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, jwtSecret, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cambiar el rol de un usuario (solo super admin)
router.put('/:id/role', authMiddleware, async (req, res) => {
  try {
    // Verificar que el usuario autenticado es super admin
    const [adminRows] = await db.query('SELECT role FROM users WHERE id = ?', [req.user.id]);
    if (!adminRows.length || (adminRows[0].role !== 'super_admin' && adminRows[0].role !== 'superadmin')) {
      return res.status(403).json({ error: 'Solo el super admin puede cambiar roles' });
    }
    const userId = req.params.id;
    const { role } = req.body;
    if (!role) return res.status(400).json({ error: 'Nuevo rol requerido' });
    await db.query('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener el restaurante asociado al usuario autenticado (solo para store_owner)
router.get('/profile/restaurant', authMiddleware, async (req, res) => {
  try {
    // Solo para store_owner
    const [userRows] = await db.query('SELECT id, role FROM users WHERE id = ?', [req.user.id]);
    if (!userRows.length || userRows[0].role !== 'store_owner') {
      return res.status(403).json({ error: 'Solo disponible para store_owner' });
    }
    // Buscar restaurante asociado
    const [restRows] = await db.query('SELECT id, name FROM restaurants WHERE owner_id = ?', [req.user.id]);
    if (!restRows.length) {
      return res.status(404).json({ error: 'No se encontró restaurante asociado a este usuario' });
    }
    res.json(restRows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
