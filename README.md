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

En desarrollo, si no existe `dist/crawl.js`, la API usa `tsx` como fallback para ejecutar `crawl.ts`.

## Flujo de crawl
El flujo se mantiene desde `src/app/page.tsx` usando:

- `DashboardView`
- `NewCrawlView`
- `CrawlDetailView`

y consume las API routes en `src/app/api/crawls/*`.
