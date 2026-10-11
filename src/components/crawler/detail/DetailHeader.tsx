'use client';

import * as React from 'react';
import { ArrowLeft, Download, Clock } from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { CrawlDetail } from '@/lib/crawler-api';

export function statusBadge(status: string) {
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

export function fmtDate(iso: string | null) {
  if (!iso) return '-';
  return format(new Date(iso), 'MMM d, yyyy HH:mm:ss');
}

interface DetailHeaderProps {
  crawl: CrawlDetail;
  onBack: () => void;
  onExport: () => void;
}

export function DetailHeader({ crawl, onBack, onExport }: DetailHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          onClick={onBack}
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
      <Button variant="outline" onClick={onExport}>
        <Download className="mr-2 size-4" />
        Export JSON
      </Button>
    </div>
  );
}
