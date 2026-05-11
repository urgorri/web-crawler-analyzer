// Types shared between API routes for crawler page data

export interface PageData {
  url: string;
  final_url: string;
  status_code: number;
  title: string;
  meta_description: string;
  canonical: string;
  robots_meta: string;
  lang: string;
  dir: string;
  charset: string;
  meta_generator: string;
  visible_text: string;
  // visible_text_raw: string;
  word_count: number;
  char_count: number;
  headings: { h1: string[]; h2: string[]; h3: string[] };
  buttons: Array<{
    text: string;
    type: string;
    aria_label: string;
    href?: string;
    name?: string;
    value?: string;
  }>;
  links: {
    internal: Array<{ text: string; href: string; rel: string }>;
    external: Array<{ text: string; href: string; rel: string }>;
  };
  forms: Array<{
    action: string;
    method: string;
    fields: Array<{ name: string; type: string; label: string }>;
  }>;
  images: Array<{
    src: string;
    alt: string;
    width?: number;
    height?: number;
    naturalWidth?: number;
    naturalHeight?: number;
  }>;
  scripts: string[];
  stylesheets: string[];
  resources: Array<{ type: string; url: string; size?: number }>;
  network: Array<{
    url: string;
    method: string;
    status?: number;
    resourceType?: string;
    size?: number;
  }>;
  structured_data: Record<string, unknown>[];
  body_classes: string[];
  html_classes: string[];
  tech_evidence: string[];
}
