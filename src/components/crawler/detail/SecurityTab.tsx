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
import type { SecurityHeadersReport, SecurityHeaderAudit } from '@/lib/analyzers/security-headers';

const gradeColors: Record<string, string> = {
  'A+': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300',
  A: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300',
  B: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300',
  C: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300',
  D: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 border-orange-300',
  F: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300',
};

export function SecurityTab({ crawl }: { crawl: CrawlDetail }) {
  const securityReport = crawl.analysisResults?.['security-headers']?.data as SecurityHeadersReport | undefined;

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
              {audits?.map((audit: SecurityHeaderAudit, index: number) => (
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
