'use client';

import * as React from 'react';
import { Globe } from 'lucide-react';

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
import { InfoRow } from '../PageDetail';

function JsonPreview({ label, data }: { label: string; data: Record<string, unknown> | null }) {
  return (
    <div className="rounded-md border p-3">
      <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <pre className="max-h-72 overflow-auto text-xs text-muted-foreground">
        {data ? JSON.stringify(data, null, 2) : '-'}
      </pre>
    </div>
  );
}

export function DomainTab({ crawl }: { crawl: CrawlDetail }) {
  const intel = crawl.domainIntel;

  if (!intel) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <Globe className="size-8 opacity-30" />
          <p>No domain intelligence available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Scope Summary</CardTitle>
          <CardDescription>Seed domain plus the dominant domain detected from the crawled pages.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <InfoRow label="Seed domain" value={intel.seedDomain} mono />
          <InfoRow label="Observed domain" value={intel.observedDomain ?? intel.seedDomain} mono />
          <InfoRow label="Seed URL" value={intel.seedUrl} mono />
          <InfoRow label="Resolved IPs" value={intel.resolvedIps.length > 0 ? intel.resolvedIps.join(', ') : '-'} mono />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>DNS</CardTitle>
          <CardDescription>Resolver output for the crawl domain.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <InfoRow label="A" value={intel.dns.a.join(', ') || '-'} mono />
          <InfoRow label="AAAA" value={intel.dns.aaaa.join(', ') || '-'} mono />
          <InfoRow label="NS" value={intel.dns.ns.join(', ') || '-'} mono />
          <InfoRow label="CNAME" value={intel.dns.cname.join(', ') || '-'} mono />
          <InfoRow
            label="MX"
            value={intel.dns.mx.length > 0 ? intel.dns.mx.map((mx) => `${mx.priority} ${mx.exchange}`).join(', ') : '-'}
            mono
          />
          <InfoRow label="TXT" value={intel.dns.txt.join(' | ') || '-'} mono />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>WHOIS / RDAP</CardTitle>
          <CardDescription>Structured registration data captured for the domain and its primary IP.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <JsonPreview label="WHOIS domain" data={intel.whoisDomain} />
          <JsonPreview label="WHOIS IP" data={intel.whoisIp} />
          <JsonPreview label="RDAP IP" data={intel.rdapIp} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Traceroute</CardTitle>
          <CardDescription>Network hops resolved from the selected IP or domain target.</CardDescription>
        </CardHeader>
        <CardContent>
          {intel.traceroute.length === 0 ? (
            <p className="text-sm text-muted-foreground">No traceroute hops captured.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hop</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>RTT 1</TableHead>
                  <TableHead>RTT 2</TableHead>
                  <TableHead>RTT 3</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {intel.traceroute.map((hop, idx) => (
                  <TableRow key={`${hop.hop}-${idx}`}>
                    <TableCell>{hop.hop}</TableCell>
                    <TableCell className="font-mono text-xs">{hop.ip ?? '*'}</TableCell>
                    <TableCell className="font-mono text-xs">{hop.rtt1 ?? '-'}</TableCell>
                    <TableCell className="font-mono text-xs">{hop.rtt2 ?? '-'}</TableCell>
                    <TableCell className="font-mono text-xs">{hop.rtt3 ?? '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ports & Services</CardTitle>
          <CardDescription>Open/closed status plus any banner captured for open services.</CardDescription>
        </CardHeader>
        <CardContent>
          {intel.ports.length === 0 ? (
            <p className="text-sm text-muted-foreground">No port scan results captured.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Port</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Banner</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {intel.ports.map((port) => (
                  <TableRow key={port.port}>
                    <TableCell className="font-mono text-xs">{port.port}</TableCell>
                    <TableCell>{port.status}</TableCell>
                    <TableCell>{port.service ?? '-'}</TableCell>
                    <TableCell className="max-w-[500px] truncate font-mono text-xs">{port.banner ?? '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {(intel.warnings.length > 0 || intel.errors.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Domain Intel Notes</CardTitle>
            <CardDescription>Non-fatal issues encountered while collecting network data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {intel.errors.map((entry, idx) => (
              <p key={`error-${idx}`} className="text-sm text-destructive">
                {entry}
              </p>
            ))}
            {intel.warnings.map((entry, idx) => (
              <p key={`warning-${idx}`} className="text-sm text-amber-700 dark:text-amber-400">
                {entry}
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
