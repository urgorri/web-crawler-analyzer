'use client';

import * as React from 'react';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { CrawlDetail } from '@/lib/crawler-api';

export function RawTab({ crawl }: { crawl: CrawlDetail }) {
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
