'use client';

import * as React from 'react';
import { FileText } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { CrawlDetail } from '@/lib/crawler-api';
import { PageDetail } from '../PageDetail';

export function PagesTab({ crawl }: { crawl: CrawlDetail }) {
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
