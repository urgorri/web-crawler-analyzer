export type AnalyzerCategory =
  | 'seo'
  | 'tech'
  | 'security'
  | 'network'
  | 'performance';

export interface AnalysisNetworkEntry {
  url: string;
  method: string;
  status?: number;
  resourceType?: string;
  size?: number;
}

export interface AnalysisContext {
  crawlId: string;
  targetUrl: string;
  finalUrl: string;
  domain: string;
  statusCode: number;
  html?: string;
  headers?: Record<string, string>;
  scripts?: string[];
  stylesheets?: string[];
  metaGenerator?: string;
  networkRequests?: AnalysisNetworkEntry[];
  config?: Record<string, unknown>;
}

export interface AnalyzerResult<T = unknown> {
  analyzerId: string;
  name: string;
  category: AnalyzerCategory;
  status: 'success' | 'skipped' | 'failed';
  data?: T;
  error?: string;
  durationMs: number;
}

export interface SiteAnalyzer<TResult = unknown> {
  readonly id: string;
  readonly name: string;
  readonly category: AnalyzerCategory;
  readonly description: string;

  /**
   * Check whether this analyzer can run in the current environment
   * (e.g., checks for network access, credentials, or binaries).
   */
  isAvailable(): Promise<boolean>;

  /**
   * Execute analysis on the provided page or domain context.
   */
  run(context: AnalysisContext): Promise<TResult>;
}
