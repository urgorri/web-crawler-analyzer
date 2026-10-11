'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  Clock,
  Link2,
  Activity,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { useCrawlerStore } from '@/lib/crawler-store';
import { getCrawl, exportCrawlJson } from '@/lib/crawler-api';
import {
  DetailHeader,
  MiniStat,
  DetailSkeleton,
  OverviewTab,
  PagesTab,
  TechTab,
  StructuredTab,
  DomainTab,
  NetworkTab,
  SecurityTab,
  SeoTab,
  PluginsTab,
  RawTab,
} from './detail';

export default function CrawlDetailView() {
  const crawlId = useCrawlerStore((s) => s.selectedCrawlId);
  const navigateTo = useCrawlerStore((s) => s.navigateTo);

  const { data: crawl, isLoading, error } = useQuery({
    queryKey: ['crawl', crawlId],
    queryFn: () => getCrawl(crawlId!),
    enabled: !!crawlId,
  });

  const handleExport = async () => {
    try {
      const blob = await exportCrawlJson(crawlId!);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crawl-${crawlId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('JSON exported');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  if (!crawlId) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-muted-foreground">
        <AlertCircle className="size-8" />
        <p>No crawl selected.</p>
        <Button variant="outline" onClick={() => navigateTo('dashboard')}>
          Go to Dashboard
        </Button>
      </div>
    );
  }

  if (isLoading) return <DetailSkeleton />;
  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-muted-foreground">
        <AlertCircle className="size-8" />
        <p>Error loading crawl: {error.message}</p>
        <Button variant="outline" onClick={() => navigateTo('dashboard')}>
          Back to Dashboard
        </Button>
      </div>
    );
  }
  if (!crawl) return null;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <DetailHeader
        crawl={crawl}
        onBack={() => navigateTo('dashboard')}
        onExport={handleExport}
      />

      {/* Quick stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat icon={<Link2 className="size-4" />} label="Seed URLs" value={crawl.seedCount} />
        <MiniStat icon={<AlertCircle className="size-4" />} label="Errors" value={crawl.errorCount} />
        <MiniStat
          icon={<Clock className="size-4" />}
          label="Avg Load Time"
          value={crawl.avgLoadTimeMs != null ? `${crawl.avgLoadTimeMs}ms` : '-'}
        />
        <MiniStat icon={<Activity className="size-4" />} label="Status" value={crawl.status} />
      </div>

      {/* Warnings / errors */}
      {(crawl.warnings?.length || crawl.errors?.length) ? (
        <Card className="border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
          <CardContent className="pt-0">
            {crawl.errors?.map((e, i) => (
              <p key={i} className="flex items-start gap-2 text-sm text-destructive mt-2">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {e}
              </p>
            ))}
            {crawl.warnings?.map((w, i) => (
              <p key={i} className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400 mt-2">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {w}
              </p>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pages">Pages</TabsTrigger>
          <TabsTrigger value="tech">Tech Evidence</TabsTrigger>
          <TabsTrigger value="structured">Structured Data</TabsTrigger>
          <TabsTrigger value="domain">Domain Intel</TabsTrigger>
          <TabsTrigger value="network">Network</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="seo">SEO Quality</TabsTrigger>
          <TabsTrigger value="plugins">Plugins</TabsTrigger>
          <TabsTrigger value="raw">Raw JSON</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab crawl={crawl} />
        </TabsContent>

        <TabsContent value="pages">
          <PagesTab crawl={crawl} />
        </TabsContent>

        <TabsContent value="tech">
          <TechTab crawl={crawl} />
        </TabsContent>

        <TabsContent value="structured">
          <StructuredTab crawl={crawl} />
        </TabsContent>

        <TabsContent value="domain">
          <DomainTab crawl={crawl} />
        </TabsContent>

        <TabsContent value="network">
          <NetworkTab crawl={crawl} />
        </TabsContent>

        <TabsContent value="security">
          <SecurityTab crawl={crawl} />
        </TabsContent>

        <TabsContent value="seo">
          <SeoTab crawl={crawl} />
        </TabsContent>

        <TabsContent value="plugins">
          <PluginsTab crawl={crawl} />
        </TabsContent>

        <TabsContent value="raw">
          <RawTab crawl={crawl} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
