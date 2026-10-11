'use client';

import { useState, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Play,
  Settings2,
  Loader2,
  Link2,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';

import { useCrawlerStore } from '@/lib/crawler-store';
import { createCrawl, getCrawlProgress, type CrawlConfig } from '@/lib/crawler-api';
import { getRegistrableDomainFromUrl } from '@/lib/domain-utils';
import { isValidUrl } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';

// ─── Component ───────────────────────────────────────────────────────────────

export default function NewCrawlView() {
  const navigateTo = useCrawlerStore((s) => s.navigateTo);

  const [urls, setUrls] = useState('');
  const [crawlName, setCrawlName] = useState('');
  const [activeCrawlId, setActiveCrawlId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [timeout, setTimeout_] = useState('30000');
  const [maxPages, setMaxPages] = useState('50');
  const [concurrency, setConcurrency] = useState('2');
  const [headless, setHeadless] = useState(true);
  const [waitForNetwork, setWaitForNetwork] = useState('2000');
  const [userAgent, setUserAgent] = useState('');
  const [enableTech, setEnableTech] = useState(true);
  const [enableSecurity, setEnableSecurity] = useState(true);
  const [enableSeo, setEnableSeo] = useState(true);

  const urlList = urls
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const urlErrors = urlList.filter((u) => !isValidUrl(u));
  const detectedDomains = Array.from(
    new Set(urlList.map((u) => getRegistrableDomainFromUrl(u)).filter(Boolean)),
  );
  const scopeDomain = detectedDomains[0] ?? null;
  const scopeErrors = detectedDomains.length > 1;

  const mutation = useMutation({
    mutationFn: (vars: { urls: string[]; config: CrawlConfig; name?: string }) =>
      createCrawl(vars.urls, vars.config, vars.name),
    onSuccess: (data) => {
      toast.success('Crawl started successfully!');
      setActiveCrawlId(data.id);
      setIsDialogOpen(true);
    },
    onError: (err: Error) => {
      toast.error(`Failed to start crawl: ${err.message}`);
    },
  });

  const { data: progress } = useQuery({
    queryKey: ['crawl-progress', activeCrawlId],
    queryFn: () => getCrawlProgress(activeCrawlId!),
    enabled: !!activeCrawlId && isDialogOpen,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status && data.status !== 'running') {
        return false;
      }
      return 1000;
    },
  });

  const isFinished = progress
    ? (progress.status && progress.status !== 'running') ||
      ((progress.pageCount + progress.errorCount) >= urlList.length && urlList.length > 0)
    : false;


  const handleSubmit = useCallback(() => {
    if (urlList.length === 0) {
      toast.error('Please enter at least one URL.');
      return;
    }
    if (urlErrors.length > 0) {
      toast.error(
        `${urlErrors.length} invalid URL(s) detected. Only http/https allowed.`,
      );
      return;
    }
    if (scopeErrors) {
      toast.error('All URLs in a crawl must belong to the same registrable domain.');
      return;
    }

    const cfg: CrawlConfig = {
      timeout: Number(timeout) || 30000,
      maxPages: Number(maxPages) || 50,
      concurrency: Number(concurrency) || 2,
      headless,
      waitForNetwork: Number(waitForNetwork) || 2000,
      modules: {
        tech: enableTech,
        'tech-profiler': enableTech,
        securityHeaders: enableSecurity,
        'security-headers': enableSecurity,
        'seo-metadata': enableSeo,
        seo: enableSeo,
      },
    };
    if (userAgent.trim()) cfg.userAgent = userAgent.trim();

    mutation.mutate({ urls: urlList, config: cfg, name: crawlName.trim() });
  }, [urlList, urlErrors, scopeErrors, timeout, maxPages, concurrency, headless, waitForNetwork, userAgent, enableTech, enableSecurity, enableSeo, crawlName, mutation]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      {/* Back */}
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigateTo('dashboard')}>
        <ArrowLeft className="mr-2 size-4" />
        Back to Dashboard
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Crawl</h1>
        <p className="text-muted-foreground text-sm">
          Enter URLs to analyze and optionally configure crawl settings.
        </p>
      </div>

      {/* Crawl Name */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="crawlName">Crawl name (optional)</Label>
        <Input
          id="crawlName"
          placeholder="My SEO audit - homepage"
          value={crawlName}
          onChange={(e) => setCrawlName(e.target.value)}
        />
      </div>

      {/* URL input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="size-5" />
            URLs
          </CardTitle>
          <CardDescription>
            One URL per line. Only http:// and https:// are accepted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder={`https://example.com\nhttps://another-site.org/page`}
            rows={6}
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            className="font-mono text-sm"
          />
          {urlList.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="text-muted-foreground">
                {urlList.length} URL{urlList.length !== 1 ? 's' : ''}
              </span>
              {scopeDomain && (
                <span className="text-muted-foreground">
                  Scope: <span className="font-medium text-foreground">{scopeDomain}</span>
                </span>
              )}
              {urlErrors.length > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                  <AlertCircle className="size-3" />
                  {urlErrors.length} invalid
                </span>
              )}
              {scopeErrors && (
                <span className="flex items-center gap-1 text-destructive">
                  <AlertCircle className="size-3" />
                  Multiple domains
                </span>
              )}
            </div>
          )}
          {scopeErrors && (
            <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
              All URLs must share the same registrable domain.
            </div>
          )}
          {urlErrors.length > 0 && (
            <div className="mt-2 max-h-24 overflow-y-auto rounded-md border border-destructive/40 bg-destructive/5 p-2">
              <ul className="list-disc pl-4 text-xs text-destructive">
                {urlErrors.map((u, i) => (
                  <li key={i}>{u}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Config */}
      <Card>
        <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
          <CardHeader className="cursor-pointer select-none" onClick={() => setConfigOpen((o) => !o)}>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="size-5" />
              Configuration
            </CardTitle>
            <CardDescription>
              Advanced crawl settings. Defaults work well for most sites.
            </CardDescription>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="flex flex-col gap-6">
              <Separator />
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="timeout">Timeout per page (ms)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    min={1000}
                    value={timeout}
                    onChange={(e) => setTimeout_(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="maxPages">Max pages</Label>
                  <Input
                    id="maxPages"
                    type="number"
                    min={1}
                    value={maxPages}
                    onChange={(e) => setMaxPages(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="concurrency">Concurrency</Label>
                  <Input
                    id="concurrency"
                    type="number"
                    min={1}
                    max={10}
                    value={concurrency}
                    onChange={(e) => setConcurrency(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="waitForNetwork">Wait for network (ms)</Label>
                  <Input
                    id="waitForNetwork"
                    type="number"
                    min={0}
                    value={waitForNetwork}
                    onChange={(e) => setWaitForNetwork(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="headless">Headless mode</Label>
                  <p className="text-muted-foreground text-sm">
                    Run browser without visible window.
                  </p>
                </div>
                <Switch
                  id="headless"
                  checked={headless}
                  onCheckedChange={setHeadless}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="userAgent">Custom User-Agent</Label>
                <Input
                  id="userAgent"
                  placeholder="Leave empty for default"
                  value={userAgent}
                  onChange={(e) => setUserAgent(e.target.value)}
                />
              </div>

              <div className="space-y-3 pt-2">
                <Label className="text-sm font-semibold">Modular Analyzers</Label>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <Label htmlFor="enableTech" className="text-sm">Tech Profiler</Label>
                      <p className="text-xs text-muted-foreground">Frameworks, CMS & stack</p>
                    </div>
                    <Switch
                      id="enableTech"
                      checked={enableTech}
                      onCheckedChange={setEnableTech}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <Label htmlFor="enableSecurity" className="text-sm">Security Headers</Label>
                      <p className="text-xs text-muted-foreground">CSP, HSTS & web safety</p>
                    </div>
                    <Switch
                      id="enableSecurity"
                      checked={enableSecurity}
                      onCheckedChange={setEnableSecurity}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
                    <div className="space-y-0.5">
                      <Label htmlFor="enableSeo" className="text-sm">SEO Quality</Label>
                      <p className="text-xs text-muted-foreground">Titles, meta descriptions, headings & Open Graph</p>
                    </div>
                    <Switch
                      id="enableSeo"
                      checked={enableSeo}
                      onCheckedChange={setEnableSeo}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Submit */}
      <Button
        size="lg"
        className="w-full"
        disabled={mutation.isPending}
        onClick={handleSubmit}
      >
        {mutation.isPending ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Starting…
          </>
        ) : (
          <>
            <Play className="mr-2 size-4" />
            Start Crawl
          </>
        )}
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) setActiveCrawlId(null);
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {isFinished ? 'Crawl Finished' : 'Crawl Progress'}
            </DialogTitle>
            <DialogDescription>
              {isFinished
                ? 'The analysis is complete. You can now view the detailed report.'
                : 'We are analyzing your URLs. You can close this dialog; the crawl will continue in the background.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-6 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {isFinished ? 'Final Status' : 'Progress'}
                </span>
                <span className="font-medium">
                  {progress ? Math.min(Math.round(((progress.pageCount + progress.errorCount) / urlList.length) * 100), 100) : 0}%
                </span>
              </div>
              <Progress
                value={progress ? ((progress.pageCount + progress.errorCount) / urlList.length) * 100 : 0}
                className={isFinished ? "bg-emerald-100 [&>div]:bg-emerald-500" : ""}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  Pages
                </div>
                <div className="mt-1 text-2xl font-bold">{progress?.pageCount ?? 0}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <XCircle className="size-4 text-destructive" />
                  Errors
                </div>
                <div className="mt-1 text-2xl font-bold">{progress?.errorCount ?? 0}</div>
              </div>
            </div>

            {!isFinished && progress?.url && (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-muted-foreground uppercase">Current/Last URL</div>
                <div className="rounded-md bg-muted p-2 text-xs font-mono break-all truncate">
                  {progress.url}
                </div>
                {progress.title && (
                  <div className="text-xs text-muted-foreground italic truncate">
                    &quot;{progress.title}&quot;
                  </div>
                )}
                {progress.error && (
                  <div className="text-xs text-destructive truncate">
                    Error: {progress.error}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setIsDialogOpen(false);
                navigateTo('dashboard');
              }}>
                Go to Dashboard
              </Button>
              {isFinished && activeCrawlId && (
                <Button onClick={() => {
                  setIsDialogOpen(false);
                  navigateTo('crawl-detail', activeCrawlId);
                }}>
                  View Report
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
