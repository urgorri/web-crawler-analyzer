import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NewCrawlView from '../NewCrawlView';
import { useCrawlerStore } from '@/lib/crawler-store';
import * as crawlerApi from '@/lib/crawler-api';
import { toast } from 'sonner';

vi.mock('@/lib/crawler-api', () => ({
  createCrawl: vi.fn(),
  getCrawlProgress: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('NewCrawlView Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCrawlerStore.setState({
      currentView: 'new-crawl',
      selectedCrawlId: null,
    });
  });

  it('renders correctly with default fields', () => {
    renderWithClient(<NewCrawlView />);

    expect(screen.getByText('New Crawl')).toBeInTheDocument();
    expect(screen.getByText('Back to Dashboard')).toBeInTheDocument();
    expect(screen.getByLabelText(/crawl name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/https:\/\/example\.com/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start crawl/i })).toBeInTheDocument();
  });

  it('navigates back to dashboard when clicking Back button', () => {
    renderWithClient(<NewCrawlView />);

    const backButton = screen.getByRole('button', { name: /back to dashboard/i });
    fireEvent.click(backButton);

    expect(useCrawlerStore.getState().currentView).toBe('dashboard');
  });

  it('shows toast error when submitting empty URLs', () => {
    renderWithClient(<NewCrawlView />);

    const startButton = screen.getByRole('button', { name: /start crawl/i });
    fireEvent.click(startButton);

    expect(toast.error).toHaveBeenCalledWith('Please enter at least one URL.');
    expect(crawlerApi.createCrawl).not.toHaveBeenCalled();
  });

  it('shows error state when invalid URLs are provided', () => {
    renderWithClient(<NewCrawlView />);

    const textarea = screen.getByPlaceholderText(/https:\/\/example\.com/i);
    fireEvent.change(textarea, { target: { value: 'invalid-url' } });

    expect(screen.getByText('1 invalid')).toBeInTheDocument();

    const startButton = screen.getByRole('button', { name: /start crawl/i });
    fireEvent.click(startButton);

    expect(toast.error).toHaveBeenCalledWith(
      '1 invalid URL(s) detected. Only http/https allowed.'
    );
    expect(crawlerApi.createCrawl).not.toHaveBeenCalled();
  });

  it('shows error state when URLs from multiple registrable domains are provided', () => {
    renderWithClient(<NewCrawlView />);

    const textarea = screen.getByPlaceholderText(/https:\/\/example\.com/i);
    fireEvent.change(textarea, {
      target: { value: 'https://example.com\nhttps://anotherdomain.com' },
    });

    expect(screen.getByText('Multiple domains')).toBeInTheDocument();
    expect(
      screen.getByText('All URLs must share the same registrable domain.')
    ).toBeInTheDocument();

    const startButton = screen.getByRole('button', { name: /start crawl/i });
    fireEvent.click(startButton);

    expect(toast.error).toHaveBeenCalledWith(
      'All URLs in a crawl must belong to the same registrable domain.'
    );
    expect(crawlerApi.createCrawl).not.toHaveBeenCalled();
  });

  it('submits valid crawl configuration correctly', async () => {
    vi.mocked(crawlerApi.createCrawl).mockResolvedValue({
      id: 'crawl-999',
      name: 'Custom Crawl',
      status: 'running',
      seedCount: 1,
      pageCount: 0,
      errorCount: 0,
      startedAt: new Date().toISOString(),
      completedAt: null,
      urls: ['https://example.com'],
      config: {},
      engine: 'playwright',
      warnings: [],
      errors: [],
      lastErrorStage: null,
      pages: [],
    });

    vi.mocked(crawlerApi.getCrawlProgress).mockResolvedValue({
      status: 'running',
      pageCount: 1,
      errorCount: 0,
      url: 'https://example.com/page1',
      title: 'Page 1',
    });

    renderWithClient(<NewCrawlView />);

    const crawlNameInput = screen.getByLabelText(/crawl name/i);
    fireEvent.change(crawlNameInput, { target: { value: 'Custom Crawl' } });

    const textarea = screen.getByPlaceholderText(/https:\/\/example\.com/i);
    fireEvent.change(textarea, { target: { value: 'https://example.com' } });

    const startButton = screen.getByRole('button', { name: /start crawl/i });
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(crawlerApi.createCrawl).toHaveBeenCalledWith(
        ['https://example.com'],
        {
          timeout: 30000,
          maxPages: 50,
          concurrency: 2,
          headless: true,
          waitForNetwork: 2000,
        },
        'Custom Crawl'
      );
    });

    expect(toast.success).toHaveBeenCalledWith('Crawl started successfully!');
    expect(await screen.findByText('Crawl Progress')).toBeInTheDocument();
  });

  it('handles mutation error gracefully', async () => {
    vi.mocked(crawlerApi.createCrawl).mockRejectedValue(new Error('Network failure'));

    renderWithClient(<NewCrawlView />);

    const textarea = screen.getByPlaceholderText(/https:\/\/example\.com/i);
    fireEvent.change(textarea, { target: { value: 'https://example.com' } });

    const startButton = screen.getByRole('button', { name: /start crawl/i });
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to start crawl: Network failure');
    });
  });

  it('updates progress dialog and completes crawl flow', async () => {
    vi.mocked(crawlerApi.createCrawl).mockResolvedValue({
      id: 'crawl-123',
      name: 'Test Crawl',
      status: 'running',
      seedCount: 1,
      pageCount: 0,
      errorCount: 0,
      startedAt: new Date().toISOString(),
      completedAt: null,
      urls: ['https://example.com'],
      config: {},
      engine: 'playwright',
      warnings: [],
      errors: [],
      lastErrorStage: null,
      pages: [],
    });

    vi.mocked(crawlerApi.getCrawlProgress).mockResolvedValue({
      status: 'completed',
      pageCount: 1,
      errorCount: 0,
      url: 'https://example.com',
      title: 'Home',
    });

    renderWithClient(<NewCrawlView />);

    const textarea = screen.getByPlaceholderText(/https:\/\/example\.com/i);
    fireEvent.change(textarea, { target: { value: 'https://example.com' } });

    const startButton = screen.getByRole('button', { name: /start crawl/i });
    fireEvent.click(startButton);

    expect(await screen.findByText('Crawl Finished')).toBeInTheDocument();

    const viewReportButton = screen.getByRole('button', { name: /view report/i });
    fireEvent.click(viewReportButton);

    expect(useCrawlerStore.getState().currentView).toBe('crawl-detail');
    expect(useCrawlerStore.getState().selectedCrawlId).toBe('crawl-123');
  });
});
