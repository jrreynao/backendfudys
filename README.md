# Backend Node.js para Marketplace

## Instalación

```bash
npm install
```

## Variables de entorno
Copia `.env.example` a `.env` y completa los valores reales.

## Ejecución local

```bash
node app.js
```

## Despliegue en Vercel
- Sube la carpeta `backend` a un repositorio GitHub.
- Conecta el repo a Vercel y selecciona `backend` como root.
- Configura las variables de entorno en el panel de Vercel.

## Endpoints principales
- `/api/auth`
- `/api/users`
- `/api/restaurants`
- `/api/products`
- `/api/cart`
- `/api/favorites`
- `/api/sales`
- `/api/subscriptions`

## Notas
- Revisa la configuración de CORS para permitir tu frontend en producción.
