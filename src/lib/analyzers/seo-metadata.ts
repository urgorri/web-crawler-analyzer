import type {
  AnalysisContext,
  SiteAnalyzer,
} from './types';

export type SeoAuditStatus = 'pass' | 'warn' | 'fail';

export interface SeoAuditItem {
  id: string;
  name: string;
  status: SeoAuditStatus;
  score: number;
  importance: 'critical' | 'high' | 'medium' | 'low';
  value?: string | number | null;
  message: string;
  recommendation?: string;
}

export interface SeoMetadataReport {
  score: number; // 0-100
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  audits: SeoAuditItem[];
  summary: {
    passed: number;
    warned: number;
    failed: number;
    total: number;
  };
}

export class SeoMetadataAnalyzer
  implements SiteAnalyzer<SeoMetadataReport>
{
  public readonly id = 'seo-metadata';
  public readonly name = 'SEO & Metadata Quality';
  public readonly category = 'seo' as const;
  public readonly description =
    'Audits title length, meta description, heading structure, canonical link, OpenGraph tags, and image alt text.';

  public async isAvailable(): Promise<boolean> {
    return true;
  }

  public async run(context: AnalysisContext): Promise<SeoMetadataReport> {
    const html = context.html || '';
    const audits: SeoAuditItem[] = [];

    // Helper to extract meta content by name or property from HTML
    const getMetaContent = (nameOrProperty: string): string | null => {
      const match =
        html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${nameOrProperty}["'][^>]+content=["']([^"']*)["']`, 'i')) ||
        html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${nameOrProperty}["']`, 'i'));
      return match ? match[1].trim() : null;
    };

    // Helper to extract title from HTML
    const getHtmlTitle = (): string | null => {
      const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      return match ? match[1].trim() : null;
    };

    // Helper to extract canonical link
    const getCanonicalHref = (): string | null => {
      const match =
        html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i) ||
        html.match(/<link[^>]+href=["']([^"']*)["'][^>]+rel=["']canonical["']/i);
      return match ? match[1].trim() : null;
    };

    // 1. Title Tag Audit
    const title = getHtmlTitle();
    if (!title) {
      audits.push({
        id: 'title-presence',
        name: 'Page Title',
        status: 'fail',
        score: 0,
        importance: 'critical',
        value: null,
        message: 'No <title> tag found on the page.',
        recommendation: 'Add a descriptive title tag between 30 and 60 characters for search engine rankings.',
      });
    } else if (title.length < 30) {
      audits.push({
        id: 'title-presence',
        name: 'Page Title',
        status: 'warn',
        score: 15,
        importance: 'high',
        value: `${title.length} characters`,
        message: `Title is relatively short (${title.length} chars): "${title}".`,
        recommendation: 'Expand title to 30-60 characters with relevant primary keywords and brand identity.',
      });
    } else if (title.length > 65) {
      audits.push({
        id: 'title-presence',
        name: 'Page Title',
        status: 'warn',
        score: 20,
        importance: 'high',
        value: `${title.length} characters`,
        message: `Title is long (${title.length} chars) and may be truncated in search results.`,
        recommendation: 'Keep the title under 60-65 characters to avoid truncation in Google SERPs.',
      });
    } else {
      audits.push({
        id: 'title-presence',
        name: 'Page Title',
        status: 'pass',
        score: 25,
        importance: 'critical',
        value: `${title.length} characters`,
        message: `Title length is optimal (${title.length} chars): "${title}".`,
      });
    }

    // 2. Meta Description Audit
    const description = getMetaContent('description');
    if (!description) {
      audits.push({
        id: 'meta-description',
        name: 'Meta Description',
        status: 'fail',
        score: 0,
        importance: 'critical',
        value: null,
        message: 'No meta description found.',
        recommendation: 'Add a concise, compelling meta description between 70 and 160 characters.',
      });
    } else if (description.length < 70) {
      audits.push({
        id: 'meta-description',
        name: 'Meta Description',
        status: 'warn',
        score: 10,
        importance: 'high',
        value: `${description.length} characters`,
        message: `Meta description is short (${description.length} chars).`,
        recommendation: 'Expand description to 70-160 characters to maximize click-through rate.',
      });
    } else if (description.length > 165) {
      audits.push({
        id: 'meta-description',
        name: 'Meta Description',
        status: 'warn',
        score: 15,
        importance: 'high',
        value: `${description.length} characters`,
        message: `Meta description exceeds 160 chars (${description.length} chars) and may be truncated.`,
        recommendation: 'Keep meta description between 120 and 160 characters for complete display.',
      });
    } else {
      audits.push({
        id: 'meta-description',
        name: 'Meta Description',
        status: 'pass',
        score: 25,
        importance: 'critical',
        value: `${description.length} characters`,
        message: `Meta description length is optimal (${description.length} chars).`,
      });
    }

    // 3. Heading Structure (H1)
    const h1Matches = html.match(/<h1[^>]*>[\s\S]*?<\/h1>/gi) || [];
    if (h1Matches.length === 0) {
      audits.push({
        id: 'heading-h1',
        name: 'H1 Heading',
        status: 'fail',
        score: 0,
        importance: 'critical',
        value: 0,
        message: 'No <h1> tag was found.',
        recommendation: 'Include exactly one <h1> heading representing the main topic of the page.',
      });
    } else if (h1Matches.length > 1) {
      audits.push({
        id: 'heading-h1',
        name: 'H1 Heading',
        status: 'warn',
        score: 10,
        importance: 'medium',
        value: h1Matches.length,
        message: `Multiple <h1> tags found (${h1Matches.length}).`,
        recommendation: 'Use a single primary <h1> per page to maintain clear topic hierarchy.',
      });
    } else {
      audits.push({
        id: 'heading-h1',
        name: 'H1 Heading',
        status: 'pass',
        score: 15,
        importance: 'critical',
        value: 1,
        message: 'Page has exactly one <h1> heading.',
      });
    }

    // 4. Canonical URL
    const canonical = getCanonicalHref();
    if (!canonical) {
      audits.push({
        id: 'canonical-url',
        name: 'Canonical Tag',
        status: 'warn',
        score: 5,
        importance: 'medium',
        value: null,
        message: 'No canonical URL tag found.',
        recommendation: 'Define a <link rel="canonical" href="..."> to prevent duplicate content issues.',
      });
    } else {
      audits.push({
        id: 'canonical-url',
        name: 'Canonical Tag',
        status: 'pass',
        score: 15,
        importance: 'medium',
        value: canonical,
        message: `Canonical link specified: ${canonical}`,
      });
    }

    // 5. Open Graph Meta Tags
    const ogTitle = getMetaContent('og:title');
    const ogImage = getMetaContent('og:image');
    const ogDesc = getMetaContent('og:description');
    const ogCount = [ogTitle, ogImage, ogDesc].filter(Boolean).length;

    if (ogCount === 3) {
      audits.push({
        id: 'open-graph',
        name: 'Social Cards (Open Graph)',
        status: 'pass',
        score: 10,
        importance: 'medium',
        value: '3/3 configured',
        message: 'Open Graph title, image, and description tags are present.',
      });
    } else if (ogCount > 0) {
      audits.push({
        id: 'open-graph',
        name: 'Social Cards (Open Graph)',
        status: 'warn',
        score: 5,
        importance: 'low',
        value: `${ogCount}/3 configured`,
        message: `Partial Open Graph setup: ${[ogTitle ? 'title' : '', ogImage ? 'image' : '', ogDesc ? 'desc' : ''].filter(Boolean).join(', ')}.`,
        recommendation: 'Provide og:title, og:image, and og:description for rich previews on social networks.',
      });
    } else {
      audits.push({
        id: 'open-graph',
        name: 'Social Cards (Open Graph)',
        status: 'warn',
        score: 0,
        importance: 'low',
        value: 'None',
        message: 'No Open Graph tags detected.',
        recommendation: 'Configure Open Graph (og:title, og:image) for rich previews when links are shared.',
      });
    }

    // 6. Image Alt Attributes
    const imgMatches = html.match(/<img[^>]+>/gi) || [];
    let missingAltCount = 0;
    for (const img of imgMatches) {
      if (!/alt=["'][^"']*["']/i.test(img)) {
        missingAltCount++;
      }
    }

    if (imgMatches.length === 0) {
      audits.push({
        id: 'image-alt-tags',
        name: 'Image Alt Text',
        status: 'pass',
        score: 10,
        importance: 'medium',
        value: '0 images',
        message: 'No <img> elements found on the page.',
      });
    } else if (missingAltCount > 0) {
      audits.push({
        id: 'image-alt-tags',
        name: 'Image Alt Text',
        status: 'warn',
        score: Math.max(0, 10 - Math.min(10, missingAltCount * 2)),
        importance: 'medium',
        value: `${missingAltCount}/${imgMatches.length} missing alt`,
        message: `${missingAltCount} out of ${imgMatches.length} images are missing an alt attribute.`,
        recommendation: 'Add descriptive alt text to all images for SEO and accessibility (WCAG).',
      });
    } else {
      audits.push({
        id: 'image-alt-tags',
        name: 'Image Alt Text',
        status: 'pass',
        score: 10,
        importance: 'medium',
        value: `${imgMatches.length} images checked`,
        message: 'All images have alt attributes.',
      });
    }

    // Calculate overall score (capped at 100)
    const earnedScore = audits.reduce((sum, a) => sum + a.score, 0);
    const score = Math.min(100, Math.max(0, earnedScore));

    let grade: SeoMetadataReport['grade'] = 'F';
    if (score >= 90) grade = 'A+';
    else if (score >= 80) grade = 'A';
    else if (score >= 70) grade = 'B';
    else if (score >= 60) grade = 'C';
    else if (score >= 45) grade = 'D';

    const passed = audits.filter((a) => a.status === 'pass').length;
    const warned = audits.filter((a) => a.status === 'warn').length;
    const failed = audits.filter((a) => a.status === 'fail').length;

    return {
      score,
      grade,
      audits,
      summary: {
        passed,
        warned,
        failed,
        total: audits.length,
      },
    };
  }
}
