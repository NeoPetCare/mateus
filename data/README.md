# NeoPetCare

Aplicacao web com frontend estatico e API Node.js para os fluxos publicos da plataforma.

## Executar localmente

Requer Node.js 20 ou superior e PostgreSQL 14 ou superior.

Crie um banco e um usuário no PostgreSQL, depois configure `DATABASE_URL` com base em [.env.example](.env.example). O schema é aplicado automaticamente ao iniciar.

```powershell
cd E:\neopetcare
npm install
npm run check
npm start
```

Abra `http://localhost:3000`.

## API

- `GET /api/health`
- `GET /api/me`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/newsletter`
- `POST /api/adoptions`
- `GET/POST /api/reports`
- `GET/POST /api/partners`

Os dados são persistidos no PostgreSQL. O arquivo [db/schema.sql](db/schema.sql) é idempotente e aplicado automaticamente pelo servidor.

## Producao

Defina `NODE_ENV=production` para ativar cookies `Secure`. As sessões ainda ficam em memória no processo Node; em produção com mais de uma instância, use Redis ou outro armazenamento compartilhado. Use HTTPS, proxy reverso, backups do PostgreSQL, monitoramento e rotação de segredos antes de publicar.
