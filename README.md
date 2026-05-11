# Web Crawler Analyzer

Setup simple de cero (Node + SQLite + Prisma) para que la API funcione sin romperse por la DB.

## Problema que se corrigió

La app estaba usando rutas de SQLite inconsistentes entre Prisma y runtime. Eso podía terminar creando/leyendo archivos `.db` distintos y dar la sensación de DB vacía o rota.

Ahora Prisma y runtime usan una configuración de DB consistente.

- Si no definís `DATABASE_URL`, los scripts usan automáticamente: `file:${PWD}/db/custom.db`.
- Si querés sobreescribirla, podés exportar `DATABASE_URL` manualmente.

---

## Requisitos

- Node.js 20+
- npm 10+

---

## Instalación desde cero (comandos exactos)

> Ejecutar desde la raíz del repo.

```bash
# 1) Instalar dependencias
npm install

# 2) Crear/sincronizar SQLite + tablas Prisma
npm run db:init

# 3) (Recomendado) asegurar cliente Prisma generado
npm run db:generate

# 4) Levantar en desarrollo
ALLOW_PRIVATE_TARGETS=true npm run dev
```

Con eso ya queda funcionando la API con SQLite en:

- `db/custom.db`

---

## Comandos útiles de DB

```bash
# Crear/sincronizar schema en SQLite
npm run db:init

# Push del schema (sin migraciones)
npm run db:push

# Regenerar cliente Prisma
npm run db:generate

# Flujo de migración local
npm run db:migrate

# Reset completo de la base
npm run db:reset
```

---

## Scripts

```bash
# Desarrollo
npm run dev

# Build y producción
npm run build
npm run start
```

### Crawler service (Node)

```bash
npm --prefix mini-services/crawler-service run build
npm --prefix mini-services/crawler-service run start
```

---

## Security Policy: SSRF Protection

This project implements a unified SSRF (Server-Side Request Forgery) protection policy to prevent attacks via malicious URL submissions. See **[docs/SSRF-POLICY.md](docs/SSRF-POLICY.md)** for complete documentation.

### Quick Start

```bash
# Development with localhost access
ALLOW_PRIVATE_TARGETS=true npm run dev

# Production (default - blocks private networks)
npm run start
```

### Key Features

- ✅ Blocks private/internal IP ranges (10.x.x.x, 192.168.x.x, 172.16-31.x.x, localhost)
- ✅ Consistent validation across API and crawler service
- ✅ Clear error messages for rejected URLs
- ✅ Environment-based override for development only
