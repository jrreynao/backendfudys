const db = require('./db');
const bcrypt = require('bcryptjs');

async function hashPasswords() {
  const [users] = await db.query('SELECT id, password FROM users');
  for (const user of users) {
    // Solo hashea si la contraseña no está hasheada (no empieza con $2)
    if (!user.password.startsWith('$2')) {
      const hashed = await bcrypt.hash(user.password, 10);
      await db.query('UPDATE users SET password = ? WHERE id = ?', [hashed, user.id]);
      console.log(`Contraseña de usuario ${user.id} actualizada`);
    }
  }
  process.exit();
}

hashPasswords();
