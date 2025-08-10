// Configuración de multer para subir imágenes de logo/banner
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + ext;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

module.exports = upload;

// --- Endpoint Express para subir archivos (logo/banner) ---
// Agrega esto en tu archivo principal de rutas, por ejemplo en routes/index.js o app.js:
//
// const upload = require('./upload');
// router.post('/api/upload', upload.single('file'), (req, res) => {
//   if (!req.file) {
//     return res.status(400).json({ error: 'No se subió ningún archivo' });
//   }
//   // Construye la URL pública del archivo
//   const fileUrl = `/uploads/${req.file.filename}`;
//   res.json({ url: fileUrl });
// });
