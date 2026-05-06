# Web Crawler Analyzer (minimal setup)

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

> Nota: `mini-services/crawler-service` mantiene su propio `bun.lock` local para su servicio independiente.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run db:push
```

## Flujo de crawl
El flujo se mantiene desde `src/app/page.tsx` usando:

- `DashboardView`
- `NewCrawlView`
- `CrawlDetailView`

y consume las API routes en `src/app/api/crawls/*`.
