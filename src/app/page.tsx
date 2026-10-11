'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Globe, LayoutDashboard, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';

import { useCrawlerStore } from '@/lib/crawler-store';
import DashboardView from '@/components/crawler/DashboardView';
import NewCrawlView from '@/components/crawler/NewCrawlView';
import CrawlDetailView from '@/components/crawler/CrawlDetailView';

export default function Home() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
      <Toaster richColors position="bottom-right" />
    </QueryClientProvider>
  );
}

function AppShell() {
  const { currentView, navigateTo } = useCrawlerStore();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Globe className="size-6 text-foreground" />
            <span className="text-lg font-bold tracking-tight">WebScope</span>
          </div>
          <nav className="flex items-center gap-1">
            <Button
              variant={currentView === 'dashboard' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => navigateTo('dashboard')}
            >
              <LayoutDashboard className="mr-1.5 size-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Button>
            <Button
              variant={currentView === 'new-crawl' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => navigateTo('new-crawl')}
            >
              <Plus className="mr-1.5 size-4" />
              <span className="hidden sm:inline">New Crawl</span>
            </Button>
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {currentView === 'dashboard' && <DashboardView />}
        {currentView === 'new-crawl' && <NewCrawlView />}
        {currentView === 'crawl-detail' && <CrawlDetailView />}
      </main>

      {/* Footer */}
      <footer className="border-t py-6 md:py-0">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 md:h-16 md:flex-row px-4 sm:px-6">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            Built by{" "}
            <a
              href="https://github.com/urgorri"
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-4"
            >
              Gastón Urgorri
            </a>
            . The source code is available on{" "}
            <a
              href="https://github.com/urgorri/web-crawler-analyzer"
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-4"
            >
              GitHub
            </a>
            .
          </p>
        </div>
      </footer>
    </div>
  );
}
