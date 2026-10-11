'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  ArrowLeft,
  Download,
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
  Type,
  FormInput,
  Palette,
  Activity,
  FileJson,
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

import { useCrawlerStore } from '@/lib/crawler-store';
import { getCrawl, exportCrawlJson, type CrawlDetail } from '@/lib/crawler-api';
import { PageDetail, InfoRow } from './PageDetail';

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
  let totalWordCount = 0;
  let totalCharCount = 0;
  let totalInternalLinks = 0;
  let totalExternalLinks = 0;
  let totalImages = 0;
  let totalForms = 0;
  let totalScripts = 0;
  let totalStylesheets = 0;

  for (const p of pages) {
    totalWordCount += p.wordCount ?? 0;
    totalCharCount += p.charCount ?? 0;
    totalInternalLinks += p.links?.internal?.length ?? 0;
    totalExternalLinks += p.links?.external?.length ?? 0;
    totalImages += p.images?.length ?? 0;
    totalForms += p.forms?.length ?? 0;
    totalScripts += p.scripts?.length ?? 0;
    totalStylesheets += p.stylesheets?.length ?? 0;
  }

  const avgWordCount =
    pages.length > 0 ? Math.round(totalWordCount / pages.length) : 0;
  const avgCharCount =
    pages.length > 0 ? Math.round(totalCharCount / pages.length) : 0;
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
        icon={<Link2 className="size-4" />}
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

      {crawl.domainIntel && (
        <Card className="sm:col-span-2 lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Domain Scope</CardTitle>
            <CardDescription>One domain per crawl, with observed domain derived from the analyzed pages.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <InfoRow label="Seed domain" value={crawl.domainIntel.seedDomain} mono />
            <InfoRow label="Observed domain" value={crawl.domainIntel.observedDomain ?? crawl.domainIntel.seedDomain} mono />
            <InfoRow label="Seed URL" value={crawl.domainIntel.seedUrl} mono />
            <InfoRow label="Resolved IPs" value={crawl.domainIntel.resolvedIps.length > 0 ? crawl.domainIntel.resolvedIps.join(', ') : '-'} mono />
          </CardContent>
        </Card>
      )}

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

// ─── Tech Evidence Tab ───────────────────────────────────────────────────────

function TechTab({ crawl }: { crawl: CrawlDetail }) {
  const pages = crawl.pages ?? [];

  const entries = React.useMemo(() => {
    const techMap = new Map<string, { pages: string[] }>();

    for (const page of pages) {
      for (const tech of page.techEvidence ?? []) {
        let techData = techMap.get(tech);
        if (!techData) {
          techData = { pages: [] };
          techMap.set(tech, techData);
        }
        techData.pages.push(page.url);
      }
    }

    return Array.from(techMap.entries()).sort((a, b) => b[1].pages.length - a[1].pages.length);
  }, [crawl.pages]);

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
  const items = React.useMemo(() => {
    const pages = crawl.pages ?? [];
    const result: { page: string; data: unknown[] }[] = [];

    for (const page of pages) {
      if (page.structuredData && page.structuredData.length > 0) {
        result.push({ page: page.url, data: page.structuredData });
      }
    }

    return result;
  }, [crawl.pages]);

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

function DomainTab({ crawl }: { crawl: CrawlDetail }) {
  const intel = crawl.domainIntel;

  if (!intel) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <Globe className="size-8 opacity-30" />
          <p>No domain intelligence available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Scope Summary</CardTitle>
          <CardDescription>Seed domain plus the dominant domain detected from the crawled pages.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <InfoRow label="Seed domain" value={intel.seedDomain} mono />
          <InfoRow label="Observed domain" value={intel.observedDomain ?? intel.seedDomain} mono />
          <InfoRow label="Seed URL" value={intel.seedUrl} mono />
          <InfoRow label="Resolved IPs" value={intel.resolvedIps.length > 0 ? intel.resolvedIps.join(', ') : '-'} mono />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>DNS</CardTitle>
          <CardDescription>Resolver output for the crawl domain.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <InfoRow label="A" value={intel.dns.a.join(', ') || '-'} mono />
          <InfoRow label="AAAA" value={intel.dns.aaaa.join(', ') || '-'} mono />
          <InfoRow label="NS" value={intel.dns.ns.join(', ') || '-'} mono />
          <InfoRow label="CNAME" value={intel.dns.cname.join(', ') || '-'} mono />
          <InfoRow
            label="MX"
            value={intel.dns.mx.length > 0 ? intel.dns.mx.map((mx) => `${mx.priority} ${mx.exchange}`).join(', ') : '-'}
            mono
          />
          <InfoRow label="TXT" value={intel.dns.txt.join(' | ') || '-'} mono />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>WHOIS / RDAP</CardTitle>
          <CardDescription>Structured registration data captured for the domain and its primary IP.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <JsonPreview label="WHOIS domain" data={intel.whoisDomain} />
          <JsonPreview label="WHOIS IP" data={intel.whoisIp} />
          <JsonPreview label="RDAP IP" data={intel.rdapIp} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Traceroute</CardTitle>
          <CardDescription>Network hops resolved from the selected IP or domain target.</CardDescription>
        </CardHeader>
        <CardContent>
          {intel.traceroute.length === 0 ? (
            <p className="text-sm text-muted-foreground">No traceroute hops captured.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hop</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>RTT 1</TableHead>
                  <TableHead>RTT 2</TableHead>
                  <TableHead>RTT 3</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {intel.traceroute.map((hop, idx) => (
                  <TableRow key={`${hop.hop}-${idx}`}>
                    <TableCell>{hop.hop}</TableCell>
                    <TableCell className="font-mono text-xs">{hop.ip ?? '*'}</TableCell>
                    <TableCell className="font-mono text-xs">{hop.rtt1 ?? '-'}</TableCell>
                    <TableCell className="font-mono text-xs">{hop.rtt2 ?? '-'}</TableCell>
                    <TableCell className="font-mono text-xs">{hop.rtt3 ?? '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ports & Services</CardTitle>
          <CardDescription>Open/closed status plus any banner captured for open services.</CardDescription>
        </CardHeader>
        <CardContent>
          {intel.ports.length === 0 ? (
            <p className="text-sm text-muted-foreground">No port scan results captured.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Port</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Banner</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {intel.ports.map((port) => (
                  <TableRow key={port.port}>
                    <TableCell className="font-mono text-xs">{port.port}</TableCell>
                    <TableCell>{port.status}</TableCell>
                    <TableCell>{port.service ?? '-'}</TableCell>
                    <TableCell className="max-w-[500px] truncate font-mono text-xs">{port.banner ?? '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {(intel.warnings.length > 0 || intel.errors.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Domain Intel Notes</CardTitle>
            <CardDescription>Non-fatal issues encountered while collecting network data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {intel.errors.map((entry, idx) => (
              <p key={`error-${idx}`} className="text-sm text-destructive">
                {entry}
              </p>
            ))}
            {intel.warnings.map((entry, idx) => (
              <p key={`warning-${idx}`} className="text-sm text-amber-700 dark:text-amber-400">
                {entry}
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Network Tab ─────────────────────────────────────────────────────────────

function NetworkTab({ crawl }: { crawl: CrawlDetail }) {
  const pages = crawl.pages ?? [];
  const allRequests = React.useMemo(() => {
    const requests: Array<{
      page: string;
      url: string;
      method: string;
      status?: number;
      resourceType?: string;
      size?: number;
    }> = [];

    for (const page of pages) {
      for (const req of page.network ?? []) {
        requests.push({ page: page.url, ...req });
      }
    }
    return requests;
  }, [pages]);

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

function JsonPreview({ label, data }: { label: string; data: Record<string, unknown> | null }) {
  return (
    <div className="rounded-md border p-3">
      <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <pre className="max-h-72 overflow-auto text-xs text-muted-foreground">
        {data ? JSON.stringify(data, null, 2) : '-'}
      </pre>
    </div>
  );
}

// ─── Security Tab ────────────────────────────────────────────────────────────

function SecurityTab({ crawl }: { crawl: CrawlDetail }) {
  const securityReport = (crawl.analysisResults?.['security-headers'] as any)?.data;

  if (!securityReport) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          No security headers audit available for this crawl.
        </CardContent>
      </Card>
    );
  }

  const { score, grade, audits, summary } = securityReport;

  const gradeColors: Record<string, string> = {
    'A+': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300',
    A: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300',
    B: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300',
    C: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300',
    D: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 border-orange-300',
    F: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300',
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Security Grade</CardDescription>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center justify-center rounded-md border px-3 py-1 text-2xl font-bold ${gradeColors[grade] || ''}`}>
                {grade}
              </span>
              <span className="text-sm text-muted-foreground font-mono">({score}/100)</span>
            </div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Passed Checks</CardDescription>
            <CardTitle className="text-2xl text-emerald-600">{summary?.passed ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Warnings</CardDescription>
            <CardTitle className="text-2xl text-amber-600">{summary?.warned ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Failed Checks</CardDescription>
            <CardTitle className="text-2xl text-rose-600">{summary?.failed ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>HTTP Security Header Audits</CardTitle>
          <CardDescription>
            Evaluation of response headers against browser security recommendations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Header</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Importance</TableHead>
                <TableHead>Details & Recommendation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audits?.map((audit: any, index: number) => (
                <TableRow key={index}>
                  <TableCell className="font-mono text-xs font-semibold">{audit.header}</TableCell>
                  <TableCell>
                    <Badge variant={audit.status === 'pass' ? 'outline' : audit.status === 'warn' ? 'secondary' : 'destructive'}>
                      {audit.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs capitalize text-muted-foreground">{audit.importance}</TableCell>
                  <TableCell className="text-xs space-y-1">
                    <p>{audit.description}</p>
                    {audit.recommendation && (
                      <p className="font-mono text-[11px] text-amber-700 dark:text-amber-400">
                        Recommendation: {audit.recommendation}
                      </p>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
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
