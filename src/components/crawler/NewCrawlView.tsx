'use client';

import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  ArrowLeft,
  Play,
  Settings2,
  Loader2,
  Link2,
  AlertCircle,
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
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';

import { useCrawlerStore } from '@/lib/crawler-store';
import { createCrawl, type CrawlConfig } from '@/lib/crawler-api';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isValidUrl(s: string): boolean {
  try {
    const u = new URL(s.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function NewCrawlView() {
  const navigateTo = useCrawlerStore((s) => s.navigateTo);

  const [urls, setUrls] = useState('');
  const [configOpen, setConfigOpen] = useState(false);
  const [timeout, setTimeout_] = useState('30000');
  const [maxPages, setMaxPages] = useState('50');
  const [concurrency, setConcurrency] = useState('2');
  const [headless, setHeadless] = useState(true);
  const [waitForNetwork, setWaitForNetwork] = useState('2000');
  const [userAgent, setUserAgent] = useState('');

  const urlList = urls
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const urlErrors = urlList.filter((u) => !isValidUrl(u));

  const mutation = useMutation({
    mutationFn: (vars: { urls: string[]; config: CrawlConfig }) =>
      createCrawl(vars.urls, vars.config),
    onSuccess: () => {
      toast.success('Crawl started successfully!');
      navigateTo('dashboard');
    },
    onError: (err: Error) => {
      toast.error(`Failed to start crawl: ${err.message}`);
    },
  });

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

    const cfg: CrawlConfig = {
      timeout: Number(timeout) || 30000,
      maxPages: Number(maxPages) || 50,
      concurrency: Number(concurrency) || 2,
      headless,
      waitForNetwork: Number(waitForNetwork) || 2000,
    };
    if (userAgent.trim()) cfg.userAgent = userAgent.trim();

    mutation.mutate({ urls: urlList, config: cfg });
  }, [urlList, urlErrors, timeout, maxPages, concurrency, headless, waitForNetwork, userAgent, mutation]);

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
              {urlErrors.length > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                  <AlertCircle className="size-3" />
                  {urlErrors.length} invalid
                </span>
              )}
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
    </div>
  );
}
