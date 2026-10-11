'use client';

import * as React from 'react';
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
import type { CrawlDetail } from '@/lib/crawler-api';
import type { AnalyzerResult } from '@/lib/analyzers/types';

export function PluginsTab({ crawl }: { crawl: CrawlDetail }) {
  const results = (crawl.analysisResults || {}) as Record<string, AnalyzerResult>;
  const entries = Object.entries(results);

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          No analyzer plugin executions recorded for this crawl.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Analyzer Plugins Pipeline ({entries.length})</CardTitle>
          <CardDescription>
            Registered SiteAnalyzer extensions executed in the analysis pipeline
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Analyzer ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Execution Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(([id, res]: [string, AnalyzerResult]) => (
                <TableRow key={id}>
                  <TableCell className="font-mono text-xs font-semibold">{id}</TableCell>
                  <TableCell className="text-sm font-medium">{res?.name || id}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-xs">
                      {res?.category || 'general'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={res?.status === 'success' ? 'default' : res?.status === 'skipped' ? 'secondary' : 'destructive'} className="text-xs">
                      {res?.status || 'unknown'}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {res?.durationMs != null ? `${res.durationMs}ms` : '—'}
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
