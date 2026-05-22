'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  ArrowLeft,
  Download,
  ExternalLink,
  AlertCircle,
  Clock,
  Copy,
  Check,
  FileText,
  Globe,
  Image as ImageIcon,
  Link2,
  Code2,
  Terminal,
  Loader2,
  Type,
  Hash,
  FormInput,
  FileCode2,
  Palette,
  Cpu,
  Activity,
  FileJson,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

import { useCrawlerStore } from '@/lib/crawler-store';
import { getCrawl, exportCrawlJson, type CrawlDetail, type PageData } from '@/lib/crawler-api';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    completed: {
      label: 'Completed',
      cls: 'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400',
    },
    running: {
      label: 'Running',
      cls: 'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 animate-pulse',
    },
    failed: {
      label: 'Failed',
      cls: 'border-transparent bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400',
    },
    pending: {
      label: 'Pending',
      cls: 'border-transparent bg-muted text-muted-foreground',
    },
    partial: {
      label: 'Partial',
      cls: 'border-transparent bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-400',
    },
  };
  const info = map[status] ?? map.pending;
  return <Badge className={info.cls}>{info.label}</Badge>;
}

function fmtDate(iso: string | null) {
  if (!iso) return '-';
  return format(new Date(iso), 'MMM d, yyyy HH:mm:ss');
}

function truncate(s: string, max: number) {
  if (s.length <= max) return s;
  return s.slice(0, max) + '…';
}

function n(value: number | undefined | null, fallback = '-') {
  return value != null ? value.toLocaleString() : fallback;
}

// ─── Main Component ──────────────────────────────────────────────────────────

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-fit"
            onClick={() => navigateTo('dashboard')}
          >
            <ArrowLeft className="mr-2 size-4" />
            Dashboard
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {crawl.name ?? 'Untitled Crawl'}
            </h1>
            {statusBadge(crawl.status)}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" />
              Started: {fmtDate(crawl.startedAt)}
            </span>
            <span>Completed: {fmtDate(crawl.completedAt)}</span>
            <span>Engine: {crawl.engine ?? '-'}</span>
          </div>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="mr-2 size-4" />
          Export JSON
        </Button>
      </div>

      {/* Quick stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MiniStat icon={<FileText className="size-4" />} label="Pages" value={crawl.pageCount} />
        <MiniStat icon={<AlertCircle className="size-4" />} label="Errors" value={crawl.errorCount} />
        <MiniStat
          icon={<Clock className="size-4" />}
          label="Avg Load Time"
          value={crawl.avgLoadTimeMs != null ? `${crawl.avgLoadTimeMs}ms` : '-'}
        />
        <MiniStat icon={<Link2 className="size-4" />} label="Seed URLs" value={crawl.seedCount} />
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
          <TabsTrigger value="network">Network</TabsTrigger>
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

        <TabsContent value="network">
          <NetworkTab crawl={crawl} />
        </TabsContent>

        <TabsContent value="raw">
          <RawTab crawl={crawl} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Mini stat ───────────────────────────────────────────────────────────────

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card className="py-4">
      <CardContent className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
          {icon}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Overview Tab ────────────────────────────────────────────────────────────

function OverviewTab({ crawl }: { crawl: CrawlDetail }) {
  const pages = crawl.pages ?? [];
  const avgWordCount =
    pages.length > 0
      ? Math.round(pages.reduce((s, p) => s + p.wordCount, 0) / pages.length)
      : 0;
  const avgCharCount =
    pages.length > 0
      ? Math.round(pages.reduce((s, p) => s + p.charCount, 0) / pages.length)
      : 0;
  const totalInternalLinks = pages.reduce(
    (s, p) => s + (p.links?.internal.length ?? 0),
    0,
  );
  const totalExternalLinks = pages.reduce(
    (s, p) => s + (p.links?.external.length ?? 0),
    0,
  );
  const totalImages = pages.reduce((s, p) => s + (p.images?.length ?? 0), 0);
  const totalForms = pages.reduce((s, p) => s + (p.forms?.length ?? 0), 0);
  const totalScripts = pages.reduce((s, p) => s + (p.scripts?.length ?? 0), 0);
  const totalStylesheets = pages.reduce(
    (s, p) => s + (p.stylesheets?.length ?? 0),
    0,
  );
  const allTech = new Set(pages.flatMap((p) => p.techEvidence ?? []));
  const errorPages = pages.filter((p) => p.error);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        title="Pages Analyzed"
        value={pages.length}
        sub={`${errorPages.length} with errors`}
        icon={<FileText className="size-4" />}
      />
      <StatCard
        title="Success"
        value={pages.length - errorPages.length}
        sub={`${pages.length > 0 ? Math.round(((pages.length - errorPages.length) / pages.length) * 100) : 0}% success`}
        icon={<Globe className="size-4" />}
      />
      <StatCard
        title="Avg Word Count"
        value={avgWordCount.toLocaleString()}
        sub={`Avg ${avgCharCount.toLocaleString()} chars`}
        icon={<Type className="size-4" />}
      />
      <StatCard
        title="Internal Links"
        value={totalInternalLinks.toLocaleString()}
        icon={<Link2 className="size-4" />}
      />
      <StatCard
        title="External Links"
        value={totalExternalLinks.toLocaleString()}
        icon={<ExternalLink className="size-4" />}
      />
      <StatCard
        title="Images"
        value={totalImages.toLocaleString()}
        icon={<ImageIcon className="size-4" />}
      />
      <StatCard
        title="Forms"
        value={totalForms}
        icon={<FormInput className="size-4" />}
      />
      <StatCard
        title="Scripts"
        value={totalScripts}
        icon={<Terminal className="size-4" />}
      />
      <StatCard
        title="Stylesheets"
        value={totalStylesheets}
        icon={<Palette className="size-4" />}
      />
      <StatCard
        title="Technologies"
        value={allTech.size}
        sub={Array.from(allTech).slice(0, 3).join(', ')}
        icon={<Code2 className="size-4" />}
      />

      {/* Seed URLs */}
      <Card className="sm:col-span-2 lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-base">Seed URLs</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm">
            {(crawl.urls ?? []).map((u, i) => (
              <li key={i} className="flex items-center gap-2">
                <Link2 className="size-3 shrink-0 text-muted-foreground" />
                <a
                  href={u}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline break-all"
                >
                  {u}
                </a>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Config */}
      {crawl.config && Object.keys(crawl.config).length > 0 && (
        <Card className="sm:col-span-2 lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Crawl Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs text-muted-foreground overflow-x-auto">
              {JSON.stringify(crawl.config, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  sub,
  icon,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardDescription className="flex items-center gap-1.5">
          {icon}
          {title}
        </CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {sub && (
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground overflow-hidden">{sub}</p>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Pages Tab ───────────────────────────────────────────────────────────────

function PagesTab({ crawl }: { crawl: CrawlDetail }) {
  const pages = crawl.pages ?? [];

  if (pages.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <FileText className="size-8 opacity-30" />
          <p>No pages crawled.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Crawled Pages ({pages.length})</CardTitle>
        <CardDescription>Expand each page to see detailed analysis data.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea>
          <Accordion type="multiple" className="w-full">
            {pages.map((page, idx) => (
              <AccordionItem key={page.id ?? idx} value={`page-${idx}`}>
                <AccordionTrigger className="text-left">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex flex-col gap-1 pr-2">
                      <span className="font-medium text-sm break-all">
                        {page.title || page.url}
                      </span>
                      <span className="text-xs text-muted-foreground truncate max-w-lg">
                        {page.url}
                      </span>
                    </div>
                    {page.loadTimeMs != null && (
                      <Badge variant="outline" className="ml-2 whitespace-nowrap text-[10px] font-mono">
                        {page.loadTimeMs}ms
                      </Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <PageDetail page={page} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function PageDetail({ page }: { page: PageData }) {
  return (
    <div className="flex flex-col gap-5 text-sm">
      {page.error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive">
          <p className="font-medium">Error</p>
          <p>{page.error}</p>
        </div>
      )}

      {/* Basics */}
      <Section title="General" icon={<Globe className="size-3.5" />}>
        <InfoRow label="URL" value={page.url} mono />
        <InfoRow label="Final URL" value={page.finalUrl} mono />
        <InfoRow label="Status Code" value={page.statusCode != null ? String(page.statusCode) : '-'} />
        <InfoRow label="Title" value={page.title} />
        <InfoRow label="Language" value={page.lang} />
        <InfoRow label="Charset" value={page.charset} />
        <InfoRow label="Generator" value={page.metaGenerator} />
        <InfoRow label="Word Count" value={n(page.wordCount)} />
        <InfoRow label="Char Count" value={n(page.charCount)} />
      </Section>

      {/* Performance */}
      {(page.loadTimeMs != null || page.domContentLoadedMs != null || page.fullContentReadyMs != null) && (
        <Section title="Performance" icon={<Activity className="size-3.5" />}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <InfoRow
              label="DOM Content Loaded"
              value={page.domContentLoadedMs != null ? `${page.domContentLoadedMs}ms` : '-'}
            />
            <InfoRow
              label="Full Content Ready"
              value={page.fullContentReadyMs != null ? `${page.fullContentReadyMs}ms` : '-'}
            />
            <InfoRow
              label="Total Load Time"
              value={page.loadTimeMs != null ? `${page.loadTimeMs}ms` : '-'}
            />
          </div>
        </Section>
      )}

      {/* Meta */}
      <Section title="Meta Information" icon={<Hash className="size-3.5" />}>
        <InfoRow label="Description" value={page.metaDescription} />
        <InfoRow label="Canonical" value={page.canonical} mono />
        <InfoRow label="Robots" value={page.robotsMeta} />
        <InfoRow label="Direction" value={page.dir} />
        <InfoRow label="Body Classes" value={page.bodyClasses?.join(', ')} />
        <InfoRow label="HTML Classes" value={page.htmlClasses?.join(', ')} />
      </Section>

      {/* Headings */}
      {page.headings && (
        <Section title="Headings" icon={<Type className="size-3.5" />}>
          <div className="flex flex-col gap-2 ml-2">
            {(['h1', 'h2', 'h3'] as const).map((tag) => {
              const items = page.headings?.[tag] ?? [];
              if (items.length === 0) return null;
              return (
                <div key={tag}>
                  <span className="font-semibold uppercase text-xs text-muted-foreground">
                    {tag}
                  </span>
                  <ul className="list-disc pl-6 mt-1">
                    {items.map((h, i) => (
                      <li key={i} className="text-foreground">
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Buttons */}
      {page.buttons && page.buttons.length > 0 && (
        <Section title="Buttons" icon={<FormInput className="size-3.5" />}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Text</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>ARIA Label</TableHead>
                <TableHead>Href</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.buttons.map((btn, i) => (
                <TableRow key={i}>
                  <TableCell>{btn.text || '-'}</TableCell>
                  <TableCell>{btn.type}</TableCell>
                  <TableCell>{btn.aria_label || '-'}</TableCell>
                  <TableCell className="max-w-[200px] truncate font-mono text-xs">
                    {btn.href || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
      )}

      {/* Links */}
      {page.links && (
        <Section title="Links" icon={<Link2 className="size-3.5" />}>
          <SubSection label={`Internal (${page.links.internal.length})`}>
            {page.links.internal.length === 0 ? (
              <p className="text-muted-foreground text-xs">None</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Text</TableHead>
                    <TableHead>Href</TableHead>
                    <TableHead>Rel</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {page.links.internal.map((l, i) => (
                    <TableRow key={i}>
                      <TableCell className="max-w-[200px] truncate">{l.text}</TableCell>
                      <TableCell className="max-w-[300px] truncate font-mono text-xs">{l.href}</TableCell>
                      <TableCell>{l.rel || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SubSection>
          <SubSection label={`External (${page.links.external.length})`}>
            {page.links.external.length === 0 ? (
              <p className="text-muted-foreground text-xs">None</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Text</TableHead>
                    <TableHead>Href</TableHead>
                    <TableHead>Rel</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {page.links.external.map((l, i) => (
                    <TableRow key={i}>
                      <TableCell className="max-w-[200px] truncate">{l.text}</TableCell>
                      <TableCell className="max-w-[300px] truncate font-mono text-xs">{l.href}</TableCell>
                      <TableCell>{l.rel || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SubSection>
        </Section>
      )}

      {/* Forms */}
      {page.forms && page.forms.length > 0 && (
        <Section title="Forms" icon={<FormInput className="size-3.5" />}>
          {page.forms.map((form, fi) => (
            <div key={fi} className="rounded-md border p-3 space-y-2">
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>Action: <code className="font-mono">{form.action}</code></span>
                <span>Method: <code className="font-mono">{form.method}</code></span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Label</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {form.fields.map((f, fj) => (
                    <TableRow key={fj}>
                      <TableCell className="font-mono text-xs">{f.name}</TableCell>
                      <TableCell>{f.type}</TableCell>
                      <TableCell>{f.label || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </Section>
      )}

      {/* Images */}
      {page.images && page.images.length > 0 && (
        <Section title="Images" icon={<ImageIcon className="size-3.5" />}>
          <div className="grid gap-2 sm:grid-cols-2">
            {page.images.map((img, i) => (
              <div key={i} className="flex items-start gap-2 rounded-md border p-2">
                <div className="size-12 shrink-0 rounded bg-muted flex items-center justify-center overflow-hidden">
                  <img
                    src={img.src}
                    alt={img.alt || ''}
                    className="size-12 object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="min-w-0 flex flex-col gap-0.5">
                  <p className="text-xs truncate font-mono">{truncate(img.src, 60)}</p>
                  <p className="text-xs text-muted-foreground">Alt: {img.alt || '-'}</p>
                  {(img.width || img.height) && (
                    <p className="text-xs text-muted-foreground">
                      {img.width ?? '?'}×{img.height ?? '?'}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Scripts */}
      {page.scripts && page.scripts.length > 0 && (
        <Section title="Scripts" icon={<Terminal className="size-3.5" />}>
          <ul className="space-y-1">
            {page.scripts.map((s, i) => (
              <li key={i} className="font-mono text-xs text-muted-foreground break-all">
                {truncate(s, 120)}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Stylesheets */}
      {page.stylesheets && page.stylesheets.length > 0 && (
        <Section title="Stylesheets" icon={<Palette className="size-3.5" />}>
          <ul className="space-y-1">
            {page.stylesheets.map((s, i) => (
              <li key={i} className="font-mono text-xs text-muted-foreground break-all">
                {truncate(s, 120)}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Tech Evidence */}
      {page.techEvidence && page.techEvidence.length > 0 && (
        <Section title="Tech Evidence" icon={<Code2 className="size-3.5" />}>
          <div className="flex flex-wrap gap-1.5">
            {page.techEvidence.map((t, i) => (
              <Badge key={i} variant="secondary">{t}</Badge>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

// ─── Tech Evidence Tab ───────────────────────────────────────────────────────

function TechTab({ crawl }: { crawl: CrawlDetail }) {
  const pages = crawl.pages ?? [];
  const techMap = new Map<string, { pages: string[] }>();

  for (const page of pages) {
    for (const tech of page.techEvidence ?? []) {
      if (!techMap.has(tech)) techMap.set(tech, { pages: [] });
      techMap.get(tech)!.pages.push(page.url);
    }
  }

  const entries = Array.from(techMap.entries()).sort((a, b) => b[1].pages.length - a[1].pages.length);

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <Code2 className="size-8 opacity-30" />
          <p>No technology evidence detected.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Technology Evidence ({entries.length})</CardTitle>
        <CardDescription>Technologies detected across all crawled pages.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Technology</TableHead>
                <TableHead>Pages</TableHead>
                <TableHead className="hidden md:table-cell">Found On</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(([tech, info]) => (
                <TableRow key={tech}>
                  <TableCell className="font-medium">{tech}</TableCell>
                  <TableCell className="tabular-nums">{info.pages.length}</TableCell>
                  <TableCell className="hidden md:table-cell max-w-[400px]">
                    <span className="font-mono text-xs text-muted-foreground truncate block">
                      {info.pages[0]}
                      {info.pages.length > 1 && ` +${info.pages.length - 1} more`}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ─── Structured Data Tab ─────────────────────────────────────────────────────

function StructuredTab({ crawl }: { crawl: CrawlDetail }) {
  const pages = crawl.pages ?? [];
  const items: { page: string; data: unknown[] }[] = [];

  for (const page of pages) {
    if (page.structuredData && page.structuredData.length > 0) {
      items.push({ page: page.url, data: page.structuredData });
    }
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <FileJson className="size-8 opacity-30" />
          <p>No structured data (JSON-LD) found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Structured Data</CardTitle>
        <CardDescription>JSON-LD data extracted from crawled pages.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea>
          <Accordion type="multiple" className="w-full">
            {items.map((item, idx) => (
              <AccordionItem key={idx} value={`sd-${idx}`}>
                <AccordionTrigger>
                  <span className="font-mono text-sm truncate pr-2">
                    {item.page}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  {item.data.map((d, di) => (
                    <SyntaxHighlighter
                      key={di}
                      language="json"
                      style={oneDark}
                      customStyle={{
                        borderRadius: '0.5rem',
                        fontSize: '0.75rem',
                        margin: di > 0 ? '0.5rem 0 0 0' : undefined,
                      }}
                    >
                      {JSON.stringify(d, null, 2)}
                    </SyntaxHighlighter>
                  ))}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ─── Network Tab ─────────────────────────────────────────────────────────────

function NetworkTab({ crawl }: { crawl: CrawlDetail }) {
  const pages = crawl.pages ?? [];
  const allRequests: Array<{
    page: string;
    url: string;
    method: string;
    status?: number;
    resourceType?: string;
    size?: number;
  }> = [];

  for (const page of pages) {
    for (const req of page.network ?? []) {
      allRequests.push({ page: page.url, ...req });
    }
  }

  if (allRequests.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <Globe className="size-8 opacity-30" />
          <p>No network requests recorded.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Network Requests ({allRequests.length})</CardTitle>
        <CardDescription>All network requests captured during crawling.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Method</TableHead>
                <TableHead>URL</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="hidden md:table-cell">Type</TableHead>
                <TableHead className="hidden lg:table-cell">Size</TableHead>
                <TableHead className="hidden xl:table-cell">Page</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allRequests.map((req, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] font-mono px-1.5">
                      {req.method}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[300px] truncate font-mono text-xs">
                    {req.url}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell tabular-nums">
                    {req.status ?? '-'}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{req.resourceType ?? '-'}</TableCell>
                  <TableCell className="hidden lg:table-cell tabular-nums">
                    {req.size != null ? `${(req.size / 1024).toFixed(1)} KB` : '-'}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell max-w-[200px] truncate text-xs text-muted-foreground">
                    {req.page}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ─── Raw JSON Tab ────────────────────────────────────────────────────────────

function RawTab({ crawl }: { crawl: CrawlDetail }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(crawl, null, 2));
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Raw JSON</CardTitle>
          <CardDescription>Complete crawl result data.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? (
            <Check className="mr-2 size-4 text-emerald-500" />
          ) : (
            <Copy className="mr-2 size-4" />
          )}
          {copied ? 'Copied' : 'Copy JSON'}
        </Button>
      </CardHeader>
      <CardContent>
        <ScrollArea>
          <SyntaxHighlighter
            language="json"
            style={oneDark}
            customStyle={{ borderRadius: '0.5rem', fontSize: '0.75rem' }}
          >
            {JSON.stringify(crawl, null, 2)}
          </SyntaxHighlighter>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ─── Shared layout helpers ───────────────────────────────────────────────────

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h4 className="font-semibold text-sm">{title}</h4>
      </div>
      <Separator className="mb-3" />
      <div className="flex flex-col gap-2 ml-5">{children}</div>
    </div>
  );
}

function SubSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">
        {label}
      </p>
      {children}
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={mono ? 'font-mono text-xs break-all' : 'text-sm'}>
        {value}
      </span>
    </div>
  );
}

// ─── Loading skeleton ────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="space-y-3">
        <Skeleton className="h-10 w-[500px]" />
        <Skeleton className="h-[400px]" />
      </div>
    </div>
  );
}
