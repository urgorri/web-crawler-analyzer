# Web Crawler Analyzer (minimal setup)

## Prerequisitos mínimos

- **Node.js 20+** (se eliminó dependencia obligatoria de Bun).
- **Playwright browsers** instalados (por ejemplo: `npx playwright install chromium`).
- **Archivo SQLite** accesible para Prisma (por defecto `db/custom.db`).

## Dependencias mínimas (raíz)
Este proyecto quedó reducido a lo necesario para:

- API routes de Next.js para crawl.
- Persistencia Prisma + SQLite.
- Ejecución Playwright.
- UI mínima del dashboard/crawl.

Dependencias principales usadas:

- `next`, `react`, `react-dom`
- `@prisma/client`, `prisma`
- `playwright`
- `@tanstack/react-query`, `zustand`
- `sonner`, `lucide-react`, `date-fns`
- UI base mínima (`@radix-ui/*` usados por componentes activos)
- utilidades CSS (`class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`)

## Lockfile
Se estandarizó el lockfile de la raíz a **npm**:

- `package-lock.json` ✅
- `bun.lock` (raíz) ❌ eliminado

> Nota: `mini-services/crawler-service` puede mantener su `bun.lock` histórico, pero su runtime/scripts ya están alineados a Node.

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

## Scripts

```bash
# Instalar dependencias y generar cliente Prisma (automático con postinstall)
npm install

# Desarrollo (predev ejecuta prisma generate automáticamente)
npm run dev

# Build y producción (prestart ejecuta prisma generate automáticamente)
npm run build
npm run start

# Comandos de base de datos
npm run db:push
npm run db:generate
npm run db:migrate
npm run db:reset
```

### Nota importante sobre Prisma

Después de instalar el proyecto por primera vez o después de cambiar el schema de Prisma, asegúrate de generar el cliente:

```bash
npx prisma generate
```

Los scripts `postinstall`, `predev` y `prestart` ejecutan automáticamente `prisma generate`, pero en algunos entornos puede ser necesario ejecutarlo explícitamente.

### Crawler service (Node)

```bash
npm --prefix mini-services/crawler-service run build
npm --prefix mini-services/crawler-service run start
```

### Contrato de setup y despliegue

1. **Pipeline de build/deploy:** siempre se debe compilar `mini-services/crawler-service` **antes** de levantar Next.js.
   - Este repositorio lo aplica con:
     - `prebuild`: `npm --prefix mini-services/crawler-service run build`
     - `prestart`: `prisma generate && npm --prefix mini-services/crawler-service run build`
2. **Runtime de API en producción:** se ejecuta únicamente `mini-services/crawler-service/dist/crawl.js`.
3. **Fallback TypeScript solo en desarrollo controlado:** la API usa `crawl.ts` únicamente si `ALLOW_TS_CRAWLER_FALLBACK=true` y `NODE_ENV` no es `production`.
4. **Sin fallback silencioso:** si falta `dist/crawl.js` cuando es requerido, la API marca el crawl como fallo con error explícito de infraestructura (sin intento automático con `npx`).

## Flujo de crawl
El flujo se mantiene desde `src/app/page.tsx` usando:

- `DashboardView`
- `NewCrawlView`
- `CrawlDetailView`

y consume las API routes en `src/app/api/crawls/*`.
