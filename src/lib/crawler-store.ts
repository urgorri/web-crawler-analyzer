import { create } from 'zustand';

interface AppState {
  currentView: 'dashboard' | 'new-crawl' | 'crawl-detail';
  selectedCrawlId: string | null;
  navigateTo: (view: 'dashboard' | 'new-crawl' | 'crawl-detail', crawlId?: string) => void;
}

export const useCrawlerStore = create<AppState>((set) => ({
  currentView: 'dashboard',
  selectedCrawlId: null,
  navigateTo: (view, crawlId) =>
    set({
      currentView: view,
      selectedCrawlId: crawlId ?? null,
    }),
}));
