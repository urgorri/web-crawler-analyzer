'use client';

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Globe,
  Plus,
  FileText,
  CheckCircle2,
  Trash2,
  Loader2,
  AlertCircle,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

import { useCrawlerStore } from '@/lib/crawler-store';
import {
  getCrawls,
  deleteCrawl,
  type CrawlSummary,
} from '@/lib/crawler-api';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    completed: {
      label: 'Completed',
      className:
        'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400',
    },
    running: {
      label: 'Running',
      className:
        'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 animate-pulse',
    },
    failed: {
      label: 'Failed',
      className:
        'border-transparent bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400',
    },
    pending: {
      label: 'Pending',
      className:
        'border-transparent bg-muted text-muted-foreground',
    },
    partial: {
      label: 'Partial',
      className:
        'border-transparent bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-400',
    },
  };
  const info = map[status] ?? map.pending;
  return <Badge className={info.className}>{info.label}</Badge>;
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return format(new Date(iso), 'MMM d, yyyy HH:mm');
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DashboardView() {
  const navigateTo = useCrawlerStore((s) => s.navigateTo);
  const qc = useQueryClient();

  const { data: crawls, isLoading, error } = useQuery({
    queryKey: ['crawls'],
    queryFn: getCrawls,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && data.some((c: CrawlSummary) => c.status === 'running')) {
        return 3000; // Refetch every 3s if there are running crawls
      }
      return false;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCrawl,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crawls'] });
      toast.success('Crawl deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const totalCrawls = crawls?.length ?? 0;
  const totalPages = crawls?.reduce((s, c) => s + c.pageCount, 0) ?? 0;
  const totalErrors = crawls?.reduce((s, c) => s + c.errorCount, 0) ?? 0;
  const totalAttempts = totalPages + totalErrors;
  const successRate =
    totalAttempts > 0
      ? Math.round(((totalAttempts - totalErrors) / totalAttempts) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Overview of all your web crawls.
          </p>
        </div>
        <Button onClick={() => navigateTo('new-crawl')}>
          <Plus className="mr-2 size-4" />
          New Crawl
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Crawls</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{totalCrawls}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-muted-foreground text-sm">
              <Globe className="mr-1 size-4" />
              crawl jobs created
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pages Analyzed</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{totalPages.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-muted-foreground text-sm">
              <FileText className="mr-1 size-4" />
              across all crawls
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Success Rate</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{successRate}%</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-muted-foreground text-sm">
              <CheckCircle2 className="mr-1 size-4" />
              {totalErrors} errors total
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Crawl list */}
      <Card>
        <CardHeader>
          <CardTitle>Crawl History</CardTitle>
          <CardDescription>Click a row to view detailed results.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && <DashboardSkeleton />}
          {error && (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <AlertCircle className="size-8" />
              <p className="text-sm">Failed to load crawls: {error.message}</p>
            </div>
          )}
          {!isLoading && !error && (!crawls || crawls.length === 0) && (
            <div className="flex flex-col items-center gap-4 py-12 text-muted-foreground">
              <Globe className="size-12 opacity-30" />
              <div className="text-center">
                <p className="font-medium">No crawls yet</p>
                <p className="text-sm">Start your first crawl to see results here.</p>
              </div>
              <Button variant="outline" onClick={() => navigateTo('new-crawl')}>
                <Plus className="mr-2 size-4" />
                New Crawl
              </Button>
            </div>
          )}
          {!isLoading && crawls && crawls.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">URLs</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Pages</TableHead>
                  <TableHead className="hidden lg:table-cell">Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {crawls.map((crawl) => (
                  <CrawlRow
                    key={crawl.id}
                    crawl={crawl}
                    onView={() => navigateTo('crawl-detail', crawl.id)}
                    onDelete={() => deleteMutation.mutate(crawl.id)}
                    deleting={deleteMutation.isPending}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function CrawlRow({
  crawl,
  onView,
  onDelete,
  deleting,
}: {
  crawl: CrawlSummary;
  onView: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const ref = useCallback(
    (node: HTMLTableRowElement | null) => {
      if (node) {
        const handler = () => onView();
        node.addEventListener('click', handler);
        return () => node.removeEventListener('click', handler);
      }
    },
    [onView],
  );

  return (
    <TableRow
      ref={ref}
      className="cursor-pointer"
    >
      <TableCell className="font-medium max-w-[200px] truncate">
        {crawl.name ?? 'Untitled'}
      </TableCell>
      <TableCell className="hidden md:table-cell text-muted-foreground">
        {crawl.seedCount}
      </TableCell>
      <TableCell>{statusBadge(crawl.status)}</TableCell>
      <TableCell className="hidden sm:table-cell tabular-nums">
        {crawl.pageCount}
      </TableCell>
      <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
        {formatDate(crawl.startedAt)}
      </TableCell>
      <TableCell className="text-right">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={(e) => e.stopPropagation()}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4 text-muted-foreground" />
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Crawl</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &ldquo;{crawl.name ?? 'Untitled'}&rdquo;?
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={onDelete}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-5 w-[180px]" />
          <Skeleton className="h-5 w-[40px] hidden md:block" />
          <Skeleton className="h-5 w-[80px]" />
          <Skeleton className="h-5 w-[40px] hidden sm:block" />
          <Skeleton className="h-5 w-[140px] hidden lg:block" />
          <Skeleton className="h-5 w-[32px] ml-auto" />
        </div>
      ))}
    </div>
  );
}
