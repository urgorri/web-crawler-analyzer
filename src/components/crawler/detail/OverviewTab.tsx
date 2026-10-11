'use client';

import * as React from 'react';
import {
  FileText,
  Globe,
  Type,
  Link2,
  Image as ImageIcon,
  FormInput,
  Terminal,
  Palette,
  Code2,
} from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { CrawlDetail } from '@/lib/crawler-api';
import { InfoRow } from '../PageDetail';

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

export function OverviewTab({ crawl }: { crawl: CrawlDetail }) {
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
