'use client';

import * as React from 'react';
import { FileJson } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

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

export function StructuredTab({ crawl }: { crawl: CrawlDetail }) {
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
