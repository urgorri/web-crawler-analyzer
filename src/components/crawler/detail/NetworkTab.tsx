'use client';

import * as React from 'react';
import { Globe } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { CrawlDetail } from '@/lib/crawler-api';

export function NetworkTab({ crawl }: { crawl: CrawlDetail }) {
  const allRequests = React.useMemo(() => {
    const pages = crawl.pages ?? [];
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
  }, [crawl.pages]);

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
