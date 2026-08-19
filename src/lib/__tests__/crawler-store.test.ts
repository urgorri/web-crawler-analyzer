import { describe, it, expect, beforeEach } from 'vitest';
import { useCrawlerStore } from '../crawler-store';

describe('useCrawlerStore', () => {
  // Reset state before each test to ensure test isolation
  beforeEach(() => {
    useCrawlerStore.setState({
      currentView: 'dashboard',
      selectedCrawlId: null,
    });
  });

  it('should have the correct initial state', () => {
    const state = useCrawlerStore.getState();
    expect(state.currentView).toBe('dashboard');
    expect(state.selectedCrawlId).toBeNull();
    expect(typeof state.navigateTo).toBe('function');
  });

  it('should update currentView when navigating without an ID', () => {
    const { navigateTo } = useCrawlerStore.getState();
    navigateTo('new-crawl');

    const state = useCrawlerStore.getState();
    expect(state.currentView).toBe('new-crawl');
    expect(state.selectedCrawlId).toBeNull();
  });

  it('should update currentView and selectedCrawlId when navigating with an ID', () => {
    const { navigateTo } = useCrawlerStore.getState();
    navigateTo('crawl-detail', 'test-crawl-123');

    const state = useCrawlerStore.getState();
    expect(state.currentView).toBe('crawl-detail');
    expect(state.selectedCrawlId).toBe('test-crawl-123');
  });

  it('should reset selectedCrawlId to null when navigating to a view without providing an ID', () => {
    const { navigateTo } = useCrawlerStore.getState();

    // First, navigate to a view with an ID
    navigateTo('crawl-detail', 'test-crawl-123');
    let state = useCrawlerStore.getState();
    expect(state.selectedCrawlId).toBe('test-crawl-123');

    // Then, navigate back to dashboard without an ID
    navigateTo('dashboard');

    state = useCrawlerStore.getState();
    expect(state.currentView).toBe('dashboard');
    expect(state.selectedCrawlId).toBeNull();
  });
});
