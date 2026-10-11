// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Polyfill window.hasPointerCapture / setPointerCapture / releasePointerCapture for Radix UI Tabs in jsdom
if (typeof Element !== 'undefined') {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}

// Polyfill ResizeObserver for Radix Tabs / ScrollArea in jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CrawlDetailView from '../CrawlDetailView';
import { useCrawlerStore } from '@/lib/crawler-store';
import { getCrawl, exportCrawlJson, type CrawlDetail } from '@/lib/crawler-api';
import { toast } from 'sonner';

vi.mock('@/lib/crawler-api', () => ({
  getCrawl: vi.fn(),
  exportCrawlJson: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockCrawlData: CrawlDetail = {
  id: 'crawl-123',
  name: 'Test Crawl',
  status: 'completed',
  seedCount: 1,
  pageCount: 2,
  errorCount: 1,
  startedAt: '2023-10-01T10:00:00.000Z',
  completedAt: '2023-10-01T10:05:00.000Z',
  urls: ['https://example.com'],
  config: { depth: 2, timeout: 5000 },
  engine: 'playwright',
  warnings: ['Warning item 1'],
  errors: ['Error item 1'],
  lastErrorStage: null,
  avgLoadTimeMs: 150,
  minLoadTimeMs: 100,
  maxLoadTimeMs: 200,
  p95LoadTimeMs: 190,
  domainIntel: {
    seedDomain: 'example.com',
    observedDomain: 'example.com',
    seedUrl: 'https://example.com',
    resolvedIps: ['93.184.216.34'],
    dns: {
      a: ['93.184.216.34'],
      aaaa: ['2606:2800:220:1:248:1893:25c8:1946'],
      ns: ['ns1.example.com'],
      cname: [],
      mx: [{ priority: 10, exchange: 'mail.example.com' }],
      txt: ['v=spf1 -all'],
    },
    whoisDomain: { registrar: 'Example Registrar' },
    whoisIp: { netName: 'EXAMPLE-NET' },
    rdapIp: { handle: 'NET-93-184-216-0-1' },
    traceroute: [
      { hop: 1, ip: '192.168.1.1', rtt1: '1ms', rtt2: '1ms', rtt3: '1ms' },
    ],
    ports: [
      { port: 80, status: 'open', service: 'http', banner: 'HTTP/1.1 200 OK' },
    ],
    warnings: ['DNS slow response'],
    errors: ['WHOIS rate limit'],
  },
  pages: [
    {
      id: 'page-1',
      url: 'https://example.com',
      finalUrl: 'https://example.com/',
      statusCode: 200,
      title: 'Example Domain',
      lang: 'en',
      charset: 'utf-8',
      metaGenerator: 'Next.js',
      metaDescription: 'An example domain site',
      canonical: 'https://example.com',
      robotsMeta: 'index, follow',
      dir: 'ltr',
      wordCount: 120,
      charCount: 850,
      loadTimeMs: 150,
      domContentLoadedMs: 80,
      fullContentReadyMs: 120,
      bodyClasses: ['theme-light'],
      htmlClasses: ['no-js'],
      headings: {
        h1: ['Welcome to Example'],
        h2: ['More Info'],
        h3: ['Contact'],
      },
      buttons: [
        { text: 'Learn More', type: 'button', aria_label: 'Learn more link', href: '/more' },
      ],
      links: {
        internal: [{ text: 'Home', href: 'https://example.com/home', rel: 'nofollow' }],
        external: [{ text: 'External Portal', href: 'https://external.org', rel: 'noopener' }],
      },
      forms: [
        {
          action: '/submit',
          method: 'POST',
          fields: [{ name: 'email', type: 'email', label: 'Email Address' }],
        },
      ],
      images: [
        { src: 'https://example.com/logo.png', alt: 'Logo', width: 100, height: 50 },
      ],
      scripts: ['https://example.com/app.js'],
      stylesheets: ['https://example.com/styles.css'],
      techEvidence: ['React', 'Next.js'],
      structuredData: [{ '@context': 'https://schema.org', '@type': 'WebPage', name: 'Home' }],
      network: [
        { url: 'https://example.com/api/v1', method: 'GET', status: 200, resourceType: 'fetch', size: 2048 },
      ],
      resources: [],
      visibleText: 'Welcome to Example Domain',
      visibleTextRaw: 'Welcome to Example Domain',
      error: null,
      scrapedAt: '2023-10-01T10:00:00.000Z',
    },
    {
      id: 'page-2',
      url: 'https://example.com/error-page',
      finalUrl: 'https://example.com/error-page',
      statusCode: 500,
      title: 'Error Page',
      error: 'Internal Server Error 500',
      metaDescription: null,
      canonical: null,
      robotsMeta: null,
      lang: null,
      dir: null,
      charset: null,
      visibleText: null,
      visibleTextRaw: null,
      wordCount: 0,
      charCount: 0,
      headings: null,
      buttons: [],
      links: null,
      forms: null,
      images: null,
      scripts: null,
      stylesheets: null,
      resources: null,
      network: null,
      structuredData: null,
      bodyClasses: null,
      htmlClasses: null,
      techEvidence: null,
      metaGenerator: null,
      scrapedAt: '2023-10-01T10:01:00.000Z',
    },
  ],
};

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function renderComponent() {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <CrawlDetailView />
    </QueryClientProvider>
  );
}

describe('CrawlDetailView', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useCrawlerStore.setState({
      currentView: 'crawl-detail',
      selectedCrawlId: null,
    });
  });

  it('renders "No crawl selected" when selectedCrawlId is null', () => {
    renderComponent();
    expect(screen.getByText('No crawl selected.')).toBeInTheDocument();

    const button = screen.getByRole('button', { name: /go to dashboard/i });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(useCrawlerStore.getState().currentView).toBe('dashboard');
  });

  it('renders loading skeleton while query is loading', () => {
    useCrawlerStore.setState({ selectedCrawlId: 'crawl-123' });
    vi.mocked(getCrawl).mockReturnValue(new Promise(() => {})); // pending promise

    const { container } = renderComponent();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders error message when query fails', async () => {
    useCrawlerStore.setState({ selectedCrawlId: 'crawl-123' });
    vi.mocked(getCrawl).mockRejectedValue(new Error('Network failure'));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Error loading crawl: Network failure')).toBeInTheDocument();
    });

    const button = screen.getByRole('button', { name: /back to dashboard/i });
    fireEvent.click(button);
    expect(useCrawlerStore.getState().currentView).toBe('dashboard');
  });

  it('renders crawl detail header, status, quick stats, and warnings/errors when loaded', async () => {
    useCrawlerStore.setState({ selectedCrawlId: 'crawl-123' });
    vi.mocked(getCrawl).mockResolvedValue(mockCrawlData);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Crawl')).toBeInTheDocument();
    });

    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Engine: playwright')).toBeInTheDocument();

    // Quick stats checks
    expect(screen.getAllByText('Seed URLs').length).toBeGreaterThan(0);
    expect(screen.getByText('Errors')).toBeInTheDocument();
    expect(screen.getByText('Avg Load Time')).toBeInTheDocument();

    // Warnings and errors banner
    expect(screen.getByText('Error item 1')).toBeInTheDocument();
    expect(screen.getByText('Warning item 1')).toBeInTheDocument();
  });

  it('handles Export JSON button click successfully', async () => {
    useCrawlerStore.setState({ selectedCrawlId: 'crawl-123' });
    vi.mocked(getCrawl).mockResolvedValue(mockCrawlData);

    const mockBlob = new Blob(['{"test": 123}'], { type: 'application/json' });
    vi.mocked(exportCrawlJson).mockResolvedValue(mockBlob);

    const createObjectURLMock = vi.fn().mockReturnValue('blob:http://localhost/mock-url');
    const revokeObjectURLMock = vi.fn();
    global.URL.createObjectURL = createObjectURLMock;
    global.URL.revokeObjectURL = revokeObjectURLMock;

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Crawl')).toBeInTheDocument();
    });

    const exportBtn = screen.getByRole('button', { name: /export json/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(exportCrawlJson).toHaveBeenCalledWith('crawl-123');
      expect(createObjectURLMock).toHaveBeenCalledWith(mockBlob);
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:http://localhost/mock-url');
      expect(toast.success).toHaveBeenCalledWith('JSON exported');
    });
  });

  it('handles Export JSON error gracefully', async () => {
    useCrawlerStore.setState({ selectedCrawlId: 'crawl-123' });
    vi.mocked(getCrawl).mockResolvedValue(mockCrawlData);
    vi.mocked(exportCrawlJson).mockRejectedValue(new Error('Export failed'));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Crawl')).toBeInTheDocument();
    });

    const exportBtn = screen.getByRole('button', { name: /export json/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Export failed');
    });
  });

  it('renders Overview tab content', async () => {
    useCrawlerStore.setState({ selectedCrawlId: 'crawl-123' });
    vi.mocked(getCrawl).mockResolvedValue(mockCrawlData);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Pages Analyzed')).toBeInTheDocument();
    });

    expect(screen.getByText('Internal Links')).toBeInTheDocument();
    expect(screen.getByText('External Links')).toBeInTheDocument();
    expect(screen.getByText('Technologies')).toBeInTheDocument();
    expect(screen.getByText('Domain Scope')).toBeInTheDocument();
  });

  it('renders Pages tab content and accordion items', async () => {
    useCrawlerStore.setState({ selectedCrawlId: 'crawl-123' });
    vi.mocked(getCrawl).mockResolvedValue(mockCrawlData);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Crawl')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const pagesTab = screen.getByRole('tab', { name: /pages/i });
    await user.click(pagesTab);

    await waitFor(() => {
      expect(screen.getByText('Crawled Pages (2)')).toBeInTheDocument();
    });
    expect(screen.getByText('Example Domain')).toBeInTheDocument();
  });

  it('renders empty Pages tab state when crawl has no pages', async () => {
    const user = userEvent.setup();
    useCrawlerStore.setState({ selectedCrawlId: 'crawl-123' });
    vi.mocked(getCrawl).mockResolvedValue({ ...mockCrawlData, pages: [] });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Crawl')).toBeInTheDocument();
    });

    const pagesTab = screen.getByRole('tab', { name: /pages/i });
    await user.click(pagesTab);

    await waitFor(() => {
      expect(screen.getByText('No pages crawled.')).toBeInTheDocument();
    });
  });

  it('renders Tech Evidence tab content', async () => {
    const user = userEvent.setup();
    useCrawlerStore.setState({ selectedCrawlId: 'crawl-123' });
    vi.mocked(getCrawl).mockResolvedValue(mockCrawlData);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Crawl')).toBeInTheDocument();
    });

    const techTab = screen.getByRole('tab', { name: /tech evidence/i });
    await user.click(techTab);

    await waitFor(() => {
      expect(screen.getByText('Technology Evidence (2)')).toBeInTheDocument();
    });
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('Next.js')).toBeInTheDocument();
  });

  it('renders Structured Data tab content', async () => {
    const user = userEvent.setup();
    useCrawlerStore.setState({ selectedCrawlId: 'crawl-123' });
    vi.mocked(getCrawl).mockResolvedValue(mockCrawlData);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Crawl')).toBeInTheDocument();
    });

    const structuredTab = screen.getByRole('tab', { name: /structured data/i });
    await user.click(structuredTab);

    await waitFor(() => {
      expect(screen.getByText('JSON-LD data extracted from crawled pages.')).toBeInTheDocument();
    });
    expect(screen.getByText('https://example.com')).toBeInTheDocument();
  });

  it('renders Domain Intel tab content', async () => {
    const user = userEvent.setup();
    useCrawlerStore.setState({ selectedCrawlId: 'crawl-123' });
    vi.mocked(getCrawl).mockResolvedValue(mockCrawlData);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Crawl')).toBeInTheDocument();
    });

    const domainTab = screen.getByRole('tab', { name: /domain intel/i });
    await user.click(domainTab);

    await waitFor(() => {
      expect(screen.getByText('Scope Summary')).toBeInTheDocument();
    });
    expect(screen.getByText('DNS')).toBeInTheDocument();
    expect(screen.getByText('WHOIS / RDAP')).toBeInTheDocument();
    expect(screen.getByText('Traceroute')).toBeInTheDocument();
    expect(screen.getByText('Ports & Services')).toBeInTheDocument();
    expect(screen.getByText('Domain Intel Notes')).toBeInTheDocument();
  });

  it('renders Network tab content', async () => {
    const user = userEvent.setup();
    useCrawlerStore.setState({ selectedCrawlId: 'crawl-123' });
    vi.mocked(getCrawl).mockResolvedValue(mockCrawlData);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Crawl')).toBeInTheDocument();
    });

    const networkTab = screen.getByRole('tab', { name: /network/i });
    await user.click(networkTab);

    await waitFor(() => {
      expect(screen.getByText('Network Requests (1)')).toBeInTheDocument();
    });
    expect(screen.getByText('https://example.com/api/v1')).toBeInTheDocument();
  });

  it('renders Raw JSON tab content and handles copy button click', async () => {
    const user = userEvent.setup();
    useCrawlerStore.setState({ selectedCrawlId: 'crawl-123' });
    vi.mocked(getCrawl).mockResolvedValue(mockCrawlData);

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Crawl')).toBeInTheDocument();
    });

    const rawTab = screen.getByRole('tab', { name: /raw json/i });
    await user.click(rawTab);

    await waitFor(() => {
      expect(screen.getAllByText('Raw JSON').length).toBeGreaterThan(0);
    });

    const copyBtn = screen.getByRole('button', { name: /copy json/i });
    await user.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Copied to clipboard');
  });

  it('navigates to dashboard when "Dashboard" back button is clicked in header', async () => {
    useCrawlerStore.setState({ selectedCrawlId: 'crawl-123' });
    vi.mocked(getCrawl).mockResolvedValue(mockCrawlData);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Crawl')).toBeInTheDocument();
    });

    const dashboardBtn = screen.getByRole('button', { name: /dashboard/i });
    fireEvent.click(dashboardBtn);

    expect(useCrawlerStore.getState().currentView).toBe('dashboard');
  });

  it('renders Security tab content when Security tab is clicked', async () => {
    const user = userEvent.setup();
    useCrawlerStore.setState({ selectedCrawlId: 'crawl-123' });
    vi.mocked(getCrawl).mockResolvedValue({
      ...mockCrawlData,
      analysisResults: {
        'security-headers': {
          data: {
            score: 85,
            grade: 'A',
            summary: { passed: 4, warned: 1, failed: 1 },
            audits: [
              {
                header: 'Content-Security-Policy',
                status: 'pass',
                importance: 'critical',
                description: 'Valid CSP',
              },
            ],
          },
        },
      },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Crawl')).toBeInTheDocument();
    });

    const securityTab = screen.getByRole('tab', { name: /security/i });
    await user.click(securityTab);

    await waitFor(() => {
      expect(screen.getByText('HTTP Security Header Audits')).toBeInTheDocument();
      expect(screen.getByText('Content-Security-Policy')).toBeInTheDocument();
    });
  });
});
