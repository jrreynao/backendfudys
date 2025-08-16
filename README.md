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

## Despliegue con Git (cPanel / Node.js App)

1. Crea un repositorio Git (puede ser todo el monorepo o solo `backend/`).
2. En cPanel, crea una aplicación Node.js (Passenger) apuntando al directorio del backend.
3. En cPanel → Git Version Control, clona el repo en el mismo directorio del backend.
4. Asegura que exista `.cpanel.yml` para reiniciar la app tras cada `git pull`.
5. Configura las variables de entorno (DB_SOCKET, DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, BASE_PATH, etc.).
6. Tras `git push`, en cPanel ejecuta “Deploy HEAD Commit” (o activa auto-deploy).

## Despliegue en Vercel (opcional)
- Sube la carpeta `backend` a un repositorio GitHub.
- Conecta el repo a Vercel y selecciona `backend` como root.
- Configura las variables de entorno en el panel de Vercel.

## Endpoints principales
- `/api/auth`
- `/api/users`
- `/api/restaurants`
- `/api/products`
- `/api/delivery-options`
- `/api/payment-methods`
- `/api/opening-hours`
- `/api/sales`
- `/api/subscriptions`
- `/api/exchange-rates`

## Notas
- Revisa CORS para permitir el frontend en producción.
- Si sirves bajo subpath (p. ej., `/apiv2`), usa BASE_PATH y monta routers bajo ese prefijo.
