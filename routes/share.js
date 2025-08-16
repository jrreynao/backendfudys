const express = require('express');
const router = express.Router();
const db = require('../db');

function getProto(req) {
  return (req.headers['x-forwarded-proto'] || '').toString().split(',')[0] || 'https';
}

function absUrl(req, path) {
  const proto = getProto(req);
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (!path.startsWith('/')) path = '/' + path;
  return `${proto}://${host}${path}`;
}

// HTML helper to render OG tags and redirect
function renderOgHtml({ title, description, imageUrl, url }) {
  const esc = (s) => String(s || '').replace(/"/g, '&quot;');
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${esc(url)}" />
  <meta property="og:image" content="${esc(imageUrl)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${esc(imageUrl)}" />
  <meta http-equiv="refresh" content="0; url=${esc(url)}" />
  <link rel="canonical" href="${esc(url)}" />
</head>
<body>
  <p>Redirigiendo a <a href="${esc(url)}">${esc(url)}</a>…</p>
  <script>location.replace(${JSON.stringify(url)});</script>
</body>
</html>`;
}

// Share page (homepage): /share -> default OG and redirect to '/'
router.get('/', async (req, res) => {
  const url = absUrl(req, '/');
  const imageUrl = absUrl(req, '/icons/Icon-512.png');
  const html = renderOgHtml({ title: 'fudys', description: 'tus tiendas favoritas en un solo lugar', imageUrl, url });
  res.set('Content-Type', 'text/html; charset=utf-8').send(html);
});

// Share page: /share/:customUrl -> returns OG meta for the store and redirects to /:customUrl
router.get('/:customUrl', async (req, res) => {
  const { customUrl } = req.params;
  try {
    const [rows] = await db.query('SELECT name, logo_url FROM restaurants WHERE custom_url = ?', [customUrl]);
    let title = 'fudys';
    let description = 'pide facil y rapido';
    let publicPath = `/${customUrl}`;
  let imagePath = '/icons/Icon-512.png';

    if (rows && rows.length > 0) {
      const r = rows[0];
      if (r.name) title = r.name;
      // Prefer store logo if exists
      if (r.logo_url && typeof r.logo_url === 'string' && r.logo_url.trim()) {
        imagePath = r.logo_url.startsWith('/uploads/') ? r.logo_url : `/uploads/${r.logo_url.replace(/^\/+/, '')}`;
      }
    }

    const url = absUrl(req, publicPath);
    // Ensure og:image uses the same mount prefix as current router if BASE_PATH is used
    let img = imagePath;
    if (img.startsWith('/uploads/')) {
      // e.g., req.baseUrl: '/share' or '/apiv2/share' --> map to '/uploads' or '/apiv2/uploads'
      const uploadsBase = req.baseUrl.endsWith('/share') && req.baseUrl !== '/share'
        ? req.baseUrl.replace(/\/share$/, '/uploads')
        : '/uploads';
      img = img.replace(/^\/uploads/, uploadsBase);
    }
    const imageUrl = absUrl(req, img);
    const html = renderOgHtml({ title, description, imageUrl, url });
    res.set('Content-Type', 'text/html; charset=utf-8').send(html);
  } catch (err) {
    const url = absUrl(req, '/');
    const imageUrl = absUrl(req, '/icons/Icon-512.png');
    const html = renderOgHtml({ title: 'fudys', description: 'tus tiendas favoritas en un solo lugar', imageUrl, url });
    res.set('Content-Type', 'text/html; charset=utf-8').send(html);
  }
});

module.exports = router;
