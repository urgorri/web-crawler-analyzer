'use client';

import * as React from 'react';
import { Code2 } from 'lucide-react';

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
import type { TechProfilerReport, DetectedTechnology } from '@/lib/analyzers/tech-profiler';

export function TechTab({ crawl }: { crawl: CrawlDetail }) {
  const entries = React.useMemo(() => {
    const pages = crawl.pages ?? [];
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

  const techReport = crawl.analysisResults?.['tech-profiler']?.data as TechProfilerReport | undefined;
  const hasReport = Boolean(techReport?.technologies && techReport.technologies.length > 0);

  if (entries.length === 0 && !hasReport) {
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
    <div className="space-y-6">
      {hasReport && techReport && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Tech Profiler Analysis ({techReport.totalDetected || techReport.technologies.length})</CardTitle>
                <CardDescription>
                  Frameworks, CMS platforms, UI libraries, and tooling identified via signature matching
                </CardDescription>
              </div>
            </div>
            {techReport.categories && (
              <div className="flex flex-wrap gap-2 pt-2">
                {Object.entries(techReport.categories).map(([cat, count]) => (
                  <Badge key={cat} variant="secondary" className="text-xs">
                    {cat}: {String(count)}
                  </Badge>
                ))}
              </div>
            )}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Technology</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Evidence Signatures</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {techReport.technologies.map((tech: DetectedTechnology, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell className="font-semibold text-sm">{tech.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{tech.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={tech.confidence >= 90 ? 'default' : 'secondary'} className="text-xs">
                        {tech.confidence}%
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[360px]">
                      <div className="flex flex-wrap gap-1">
                        {tech.evidence?.map((ev: string, eIdx: number) => (
                          <span key={eIdx} className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded truncate max-w-[200px]" title={ev}>
                            {ev}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {entries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Technology Evidence ({entries.length})</CardTitle>
            <CardDescription>Raw signatures matched across all crawled URLs.</CardDescription>
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
      )}
    </div>
  );
}
