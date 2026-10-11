import type {
  AnalysisContext,
  SiteAnalyzer,
} from './types';

export interface DetectedTechnology {
  name: string;
  category:
    | 'Frontend Framework'
    | 'UI & CSS'
    | 'CMS & Platform'
    | 'Analytics & Tracking'
    | 'JavaScript Library'
    | 'CDN & Hosting'
    | 'Build Tool';
  confidence: number; // 0-100
  version?: string;
  evidence: string[];
}

export interface TechProfilerReport {
  technologies: DetectedTechnology[];
  totalDetected: number;
  categories: Record<string, number>;
}

interface TechSignature {
  name: string;
  category: DetectedTechnology['category'];
  scripts?: RegExp[];
  stylesheets?: RegExp[];
  metaGenerator?: RegExp[];
  htmlPatterns?: RegExp[];
  headers?: Array<{ header: string; pattern: RegExp }>;
}

const SIGNATURES: TechSignature[] = [
  // ── Frontend Frameworks ───────────────────────────────────────────────────
  {
    name: 'Next.js',
    category: 'Frontend Framework',
    scripts: [/_next\/static/i],
    htmlPatterns: [/__next/i, /id="__NEXT_DATA__"/i],
    headers: [{ header: 'x-powered-by', pattern: /next\.js/i }],
  },
  {
    name: 'React',
    category: 'Frontend Framework',
    scripts: [/react(?:\.production|\.development)?(?:\.min)?\.js/i, /react-dom/i],
    htmlPatterns: [/data-reactroot/i, /data-reactid/i, /__reactFiber/i],
  },
  {
    name: 'Vue.js',
    category: 'Frontend Framework',
    scripts: [/vue(?:\.runtime)?(?:\.esm)?(?:\.min)?\.js/i],
    htmlPatterns: [/data-v-[a-f0-9]/i, /id="app"/i],
  },
  {
    name: 'Nuxt.js',
    category: 'Frontend Framework',
    scripts: [/_nuxt/i],
    htmlPatterns: [/__NUXT/i, /id="__nuxt"/i],
  },
  {
    name: 'Angular',
    category: 'Frontend Framework',
    scripts: [/angular(?:\.min)?\.js/i, /@angular/i],
    htmlPatterns: [/ng-version=/i, /ng-app/i],
  },
  {
    name: 'Svelte',
    category: 'Frontend Framework',
    scripts: [/svelte/i],
    htmlPatterns: [/class="svelte-[a-z0-9]+"/i],
  },
  {
    name: 'Remix',
    category: 'Frontend Framework',
    scripts: [/__remix/i],
    htmlPatterns: [/window\.__remixContext/i],
  },
  {
    name: 'Astro',
    category: 'Frontend Framework',
    scripts: [/astro/i],
    htmlPatterns: [/astro-island/i, /data-astro-cid/i],
    metaGenerator: [/astro/i],
  },

  // ── UI & CSS ─────────────────────────────────────────────────────────────
  {
    name: 'Tailwind CSS',
    category: 'UI & CSS',
    stylesheets: [/tailwind/i],
    htmlPatterns: [/(?:flex|grid|items-center|justify-between|text-sm|bg-)/i],
  },
  {
    name: 'Bootstrap',
    category: 'UI & CSS',
    stylesheets: [/bootstrap(?:\.min)?\.css/i],
    scripts: [/bootstrap(?:\.bundle)?(?:\.min)?\.js/i],
    htmlPatterns: [/class="[^"]*(?:container|row|col-[a-z0-9]+|btn-primary)[^"]*"/i],
  },
  {
    name: 'Font Awesome',
    category: 'UI & CSS',
    stylesheets: [/font-awesome/i, /fontawesome/i],
    scripts: [/fontawesome/i],
    htmlPatterns: [/class="[^"]*fa[srbld]?\s+fa-[a-z0-9-]+[^"]*"/i],
  },

  // ── CMS & Platforms ───────────────────────────────────────────────────────
  {
    name: 'WordPress',
    category: 'CMS & Platform',
    metaGenerator: [/wordpress/i],
    scripts: [/wp-content/i, /wp-includes/i],
    stylesheets: [/wp-content/i, /wp-includes/i],
    htmlPatterns: [/wp-json/i],
  },
  {
    name: 'Shopify',
    category: 'CMS & Platform',
    scripts: [/cdn\.shopify\.com/i],
    htmlPatterns: [/Shopify\.theme/i, /shopify-payment-terms/i],
    headers: [{ header: 'x-shopid', pattern: /.+/ }],
  },
  {
    name: 'Drupal',
    category: 'CMS & Platform',
    metaGenerator: [/drupal/i],
    scripts: [/drupal\.js/i, /sites\/all\/modules/i],
    headers: [{ header: 'x-generator', pattern: /drupal/i }],
  },
  {
    name: 'Squarespace',
    category: 'CMS & Platform',
    scripts: [/static1\.squarespace\.com/i],
    htmlPatterns: [/Squarespace\.Constants/i],
  },
  {
    name: 'Wix',
    category: 'CMS & Platform',
    scripts: [/static\.wixstatic\.com/i],
    metaGenerator: [/wix/i],
  },

  // ── Analytics & Tag Managers ─────────────────────────────────────────────
  {
    name: 'Google Analytics',
    category: 'Analytics & Tracking',
    scripts: [/google-analytics\.com\/analytics\.js/i, /googletagmanager\.com\/gtag\/js/i],
    htmlPatterns: [/gtag\('config'/i, /ga\('create'/i],
  },
  {
    name: 'Google Tag Manager',
    category: 'Analytics & Tracking',
    scripts: [/googletagmanager\.com\/gtm\.js/i],
    htmlPatterns: [/googletagmanager\.com\/ns\.html/i],
  },
  {
    name: 'Hotjar',
    category: 'Analytics & Tracking',
    scripts: [/static\.hotjar\.com/i],
  },

  // ── JavaScript Libraries ───────────────────────────────────────────────────
  {
    name: 'jQuery',
    category: 'JavaScript Library',
    scripts: [/jquery(?:\.[0-9.]+)?(?:\.min)?\.js/i],
  },
  {
    name: 'Lodash',
    category: 'JavaScript Library',
    scripts: [/lodash(?:\.min)?\.js/i],
  },
  {
    name: 'Three.js',
    category: 'JavaScript Library',
    scripts: [/three(?:\.min)?\.js/i],
  },
  {
    name: 'Chart.js',
    category: 'JavaScript Library',
    scripts: [/chart(?:\.min)?\.js/i],
  },

  // ── CDN & Hosting ────────────────────────────────────────────────────────
  {
    name: 'Cloudflare',
    category: 'CDN & Hosting',
    headers: [
      { header: 'cf-ray', pattern: /.+/ },
      { header: 'server', pattern: /cloudflare/i },
    ],
  },
  {
    name: 'Vercel',
    category: 'CDN & Hosting',
    headers: [{ header: 'x-vercel-id', pattern: /.+/ }],
  },
  {
    name: 'Amazon CloudFront',
    category: 'CDN & Hosting',
    headers: [{ header: 'x-amz-cf-id', pattern: /.+/ }],
  },
];

export class TechProfilerAnalyzer
  implements SiteAnalyzer<TechProfilerReport>
{
  public readonly id = 'tech-profiler';
  public readonly name = 'Technology Profiler';
  public readonly category = 'tech' as const;
  public readonly description =
    'Identifies frontend frameworks, CMSs, CSS libraries, analytics, and infrastructure components from HTML, headers, and asset signatures.';

  public async isAvailable(): Promise<boolean> {
    return true;
  }

  public async run(context: AnalysisContext): Promise<TechProfilerReport> {
    const scripts = context.scripts || [];
    const stylesheets = context.stylesheets || [];
    const html = context.html || '';
    const metaGenerator = context.metaGenerator || '';
    const rawHeaders = context.headers || {};

    const normalizedHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawHeaders)) {
      if (typeof v === 'string') {
        normalizedHeaders[k.toLowerCase()] = v;
      }
    }

    const detected: DetectedTechnology[] = [];
    const categoriesCount: Record<string, number> = {};

    for (const sig of SIGNATURES) {
      const evidence: string[] = [];
      let score = 0;

      // Check scripts
      if (sig.scripts) {
        for (const scriptUrl of scripts) {
          for (const pattern of sig.scripts) {
            if (pattern.test(scriptUrl)) {
              evidence.push(`Script: ${scriptUrl.slice(0, 100)}`);
              score += 50;
              break;
            }
          }
        }
      }

      // Check stylesheets
      if (sig.stylesheets) {
        for (const styleUrl of stylesheets) {
          for (const pattern of sig.stylesheets) {
            if (pattern.test(styleUrl)) {
              evidence.push(`Stylesheet: ${styleUrl.slice(0, 100)}`);
              score += 40;
              break;
            }
          }
        }
      }

      // Check meta generator
      if (sig.metaGenerator && metaGenerator) {
        for (const pattern of sig.metaGenerator) {
          if (pattern.test(metaGenerator)) {
            evidence.push(`Meta generator: ${metaGenerator}`);
            score += 70;
            break;
          }
        }
      }

      // Check headers
      if (sig.headers) {
        for (const { header, pattern } of sig.headers) {
          const val = normalizedHeaders[header.toLowerCase()];
          if (val && pattern.test(val)) {
            evidence.push(`Header ${header}: ${val}`);
            score += 60;
          }
        }
      }

      // Check HTML patterns
      if (sig.htmlPatterns && html) {
        for (const pattern of sig.htmlPatterns) {
          if (pattern.test(html)) {
            evidence.push(`HTML match: ${pattern.toString()}`);
            score += 35;
            break;
          }
        }
      }

      if (evidence.length > 0) {
        const confidence = Math.min(100, Math.max(30, score));
        detected.push({
          name: sig.name,
          category: sig.category,
          confidence,
          evidence,
        });

        categoriesCount[sig.category] =
          (categoriesCount[sig.category] || 0) + 1;
      }
    }

    return {
      technologies: detected,
      totalDetected: detected.length,
      categories: categoriesCount,
    };
  }
}
