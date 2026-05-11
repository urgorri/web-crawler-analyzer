# Web Crawler Analyzer

Flujo simple: corrés un crawl y se guarda **un archivo JSON** por ejecución en `output/`.

## Requisitos

- Node.js 20+
- npm 10+

## Instalación

```bash
npm install
```

## Uso

```bash
ALLOW_PRIVATE_TARGETS=true npm run dev
```

1. Creás un crawl desde el dashboard / API.
2. El proceso ejecuta el crawler.
3. Al terminar, guarda todo el resultado en `output/<crawl-id>.json`.

No se usa SQLite. No se usa Prisma.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm --prefix mini-services/crawler-service run build
npm --prefix mini-services/crawler-service run start
```

## Security Policy: SSRF Protection

This project implements a unified SSRF protection policy. See **[docs/SSRF-POLICY.md](docs/SSRF-POLICY.md)**.
