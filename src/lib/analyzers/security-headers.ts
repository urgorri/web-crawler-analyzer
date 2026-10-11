import type {
  AnalysisContext,
  SiteAnalyzer,
} from './types';

export type SecurityHeaderStatus = 'pass' | 'warn' | 'fail';

export interface SecurityHeaderAudit {
  header: string;
  value: string | null;
  status: SecurityHeaderStatus;
  score: number;
  importance: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  recommendation?: string;
}

export interface SecurityHeadersReport {
  score: number; // 0-100
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  audits: SecurityHeaderAudit[];
  summary: {
    passed: number;
    warned: number;
    failed: number;
    total: number;
  };
}

export class SecurityHeadersAnalyzer
  implements SiteAnalyzer<SecurityHeadersReport>
{
  public readonly id = 'security-headers';
  public readonly name = 'HTTP Security Headers';
  public readonly category = 'security' as const;
  public readonly description =
    'Audits HTTP response headers for web security best practices (CSP, HSTS, X-Frame-Options, etc.)';

  public async isAvailable(): Promise<boolean> {
    return true;
  }

  public async run(context: AnalysisContext): Promise<SecurityHeadersReport> {
    const rawHeaders = context.headers || {};
    // Normalize headers to lowercase
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawHeaders)) {
      if (typeof v === 'string') {
        headers[k.toLowerCase()] = v;
      }
    }

    const audits: SecurityHeaderAudit[] = [];

    // 1. Content-Security-Policy
    const csp = headers['content-security-policy'];
    if (csp) {
      const isWeak =
        csp.includes('unsafe-inline') || csp.includes('unsafe-eval');
      audits.push({
        header: 'Content-Security-Policy',
        value: csp.slice(0, 300),
        status: isWeak ? 'warn' : 'pass',
        score: isWeak ? 15 : 25,
        importance: 'critical',
        title: 'Content Security Policy (CSP)',
        description: isWeak
          ? 'CSP is present but permits unsafe-inline or unsafe-eval.'
          : 'Robust Content Security Policy is enforced.',
        recommendation: isWeak
          ? 'Refactor inline scripts/styles to use nonces or hashes.'
          : undefined,
      });
    } else {
      audits.push({
        header: 'Content-Security-Policy',
        value: null,
        status: 'fail',
        score: 0,
        importance: 'critical',
        title: 'Content Security Policy (CSP)',
        description: 'Missing CSP header increases vulnerability to XSS attacks.',
        recommendation:
          "Define a restrictive Content-Security-Policy header (e.g. default-src 'self').",
      });
    }

    // 2. Strict-Transport-Security (HSTS)
    const hsts = headers['strict-transport-security'];
    const isHttps = context.targetUrl.startsWith('https://');
    if (hsts) {
      const hasMaxAge = /max-age=\d+/i.test(hsts);
      audits.push({
        header: 'Strict-Transport-Security',
        value: hsts,
        status: hasMaxAge ? 'pass' : 'warn',
        score: hasMaxAge ? 20 : 10,
        importance: 'high',
        title: 'HTTP Strict Transport Security (HSTS)',
        description: 'Forces browsers to connect via HTTPS exclusively.',
      });
    } else {
      audits.push({
        header: 'Strict-Transport-Security',
        value: null,
        status: isHttps ? 'warn' : 'fail',
        score: 0,
        importance: 'high',
        title: 'HTTP Strict Transport Security (HSTS)',
        description: 'HSTS is not enabled on this domain.',
        recommendation:
          'Add Strict-Transport-Security: max-age=31536000; includeSubDomains',
      });
    }

    // 3. X-Frame-Options
    const xfo = headers['x-frame-options'];
    if (xfo) {
      const valid = ['deny', 'sameorigin'].includes(xfo.toLowerCase());
      audits.push({
        header: 'X-Frame-Options',
        value: xfo,
        status: valid ? 'pass' : 'warn',
        score: valid ? 15 : 8,
        importance: 'medium',
        title: 'Clickjacking Protection (X-Frame-Options)',
        description: `Protects against UI redress / clickjacking attacks (${xfo}).`,
      });
    } else {
      audits.push({
        header: 'X-Frame-Options',
        value: null,
        status: 'fail',
        score: 0,
        importance: 'medium',
        title: 'Clickjacking Protection (X-Frame-Options)',
        description: 'Missing X-Frame-Options or frame-ancestors in CSP.',
        recommendation: 'Add X-Frame-Options: SAMEORIGIN or DENY.',
      });
    }

    // 4. X-Content-Type-Options
    const xcto = headers['x-content-type-options'];
    if (xcto && xcto.toLowerCase() === 'nosniff') {
      audits.push({
        header: 'X-Content-Type-Options',
        value: xcto,
        status: 'pass',
        score: 15,
        importance: 'medium',
        title: 'MIME-Type Sniffing Protection',
        description: 'Prevents browsers from MIME-sniffing the response body.',
      });
    } else {
      audits.push({
        header: 'X-Content-Type-Options',
        value: xcto || null,
        status: 'fail',
        score: 0,
        importance: 'medium',
        title: 'MIME-Type Sniffing Protection',
        description: 'Missing or invalid X-Content-Type-Options header.',
        recommendation: 'Add X-Content-Type-Options: nosniff',
      });
    }

    // 5. Referrer-Policy
    const refPol = headers['referrer-policy'];
    if (refPol) {
      audits.push({
        header: 'Referrer-Policy',
        value: refPol,
        status: 'pass',
        score: 15,
        importance: 'low',
        title: 'Referrer Policy',
        description: `Controls referrer data leakage (${refPol}).`,
      });
    } else {
      audits.push({
        header: 'Referrer-Policy',
        value: null,
        status: 'warn',
        score: 5,
        importance: 'low',
        title: 'Referrer Policy',
        description: 'No explicit Referrer-Policy specified.',
        recommendation: 'Add Referrer-Policy: strict-origin-when-cross-origin',
      });
    }

    // 6. Permissions-Policy
    const permPol = headers['permissions-policy'];
    if (permPol) {
      audits.push({
        header: 'Permissions-Policy',
        value: permPol.slice(0, 200),
        status: 'pass',
        score: 10,
        importance: 'low',
        title: 'Browser Feature Permissions Policy',
        description: 'Restricts access to browser features and device sensors.',
      });
    } else {
      audits.push({
        header: 'Permissions-Policy',
        value: null,
        status: 'warn',
        score: 0,
        importance: 'low',
        title: 'Browser Feature Permissions Policy',
        description: 'Permissions-Policy is not configured.',
      });
    }

    const totalPossible = 100;
    const earnedScore = Math.min(
      totalPossible,
      audits.reduce((sum, a) => sum + a.score, 0)
    );

    let grade: SecurityHeadersReport['grade'] = 'F';
    if (earnedScore >= 90) grade = 'A+';
    else if (earnedScore >= 80) grade = 'A';
    else if (earnedScore >= 65) grade = 'B';
    else if (earnedScore >= 50) grade = 'C';
    else if (earnedScore >= 35) grade = 'D';

    const passed = audits.filter((a) => a.status === 'pass').length;
    const warned = audits.filter((a) => a.status === 'warn').length;
    const failed = audits.filter((a) => a.status === 'fail').length;

    return {
      score: earnedScore,
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
