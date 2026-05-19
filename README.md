# WebScope — Web Crawler & Analyzer

WebScope is a powerful web crawler and analyzer built with Next.js, Playwright, and Tailwind CSS. It allows you to crawl multiple URLs simultaneously and extract detailed structured data including metadata, headings, links, forms, images, scripts, technologies, and more.

## Features

- **Full Page Extraction**: Captures titles, meta descriptions, canonicals, robots meta, language, and charset.
- **Content Analysis**: Word count, character count, and visible text extraction.
- **Structure Discovery**: Headings (H1-H3), buttons, forms, and links (internal vs external).
- **Resource Tracking**: Images, scripts, stylesheets, and network requests.
- **Advanced Insights**: Structured data (JSON-LD), technology evidence detection, and body/HTML classes.
- **SSRF Protection**: Built-in security to prevent Server-Side Request Forgery by blocking private/internal network targets.
- **Modern UI**: Clean dashboard for managing crawls and detailed reports for analyzing results.
- **Export**: Download crawl results as normalized JSON files.

## Prerequisites

- **Node.js**: version 20 or higher.
- **npm**: version 10 or higher.

## Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/urgorri/webscope.git
   cd webscope
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the crawler service**:
   (Required before the first run)
   ```bash
   npm run prebuild
   ```

4. **Install Playwright browsers**:
   ```bash
   npx playwright install chromium
   ```

## Usage

### Development Mode

Run the following command to start the development server. If you want to allow crawling private targets (like localhost), use the environment variable:

```bash
ALLOW_PRIVATE_TARGETS=true npm run dev
```

The application will be available at `http://localhost:3000`.

### Production Build

```bash
npm run build
npm start
```

## How It Works

1. **Create a Crawl**: Enter one or more URLs in the dashboard.
2. **Background Execution**: The system spawns a detached crawler process using Playwright.
3. **Data Storage**: Results are saved as JSON files in the `output/` directory. No database (SQLite/Prisma) is required.
4. **Analysis**: View the detailed report in the UI or export the JSON for further processing.

## Security: SSRF Protection

This project implements a unified SSRF protection policy. By default, it blocks requests to private/internal network addresses (e.g., `localhost`, `127.0.0.1`, `192.168.x.x`).

For more details on the security implementation, see `src/lib/ssrf-policy.ts`.

## Development Scripts

- `npm run dev`: Starts the Next.js development server.
- `npm run build`: Builds the application for production.
- `npm run prebuild`: Builds the standalone crawler service.
- `npm run lint`: Runs the linter.

## Credits

Built by [Gastón Urgorri](https://github.com/urgorri).

## License

This project is open-source. Please check the repository for license details.
