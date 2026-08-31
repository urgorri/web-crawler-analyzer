'use client';

import * as React from 'react';
import {
  Globe,
  Activity,
  Hash,
  Type,
  FormInput,
  Link2,
  Image as ImageIcon,
  Terminal,
  Palette,
  Code2,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';

import type { PageData } from '@/lib/crawler-api';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function truncate(s: string, max: number) {
  if (s.length <= max) return s;
  return s.slice(0, max) + '…';
}

function n(value: number | undefined | null, fallback = '-') {
  return value != null ? value.toLocaleString() : fallback;
}

// ─── Shared Layout Helpers ───────────────────────────────────────────────────

export function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h4 className="font-semibold text-sm">{title}</h4>
      </div>
      <Separator className="mb-3" />
      <div className="flex flex-col gap-2 ml-5">{children}</div>
    </div>
  );
}

export function SubSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">
        {label}
      </p>
      {children}
    </div>
  );
}

export function InfoRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={mono ? 'font-mono text-xs break-all' : 'text-sm'}>
        {value}
      </span>
    </div>
  );
}

// ─── Section Sub-components ──────────────────────────────────────────────────

export function PageGeneralSection({ page }: { page: PageData }) {
  return (
    <Section title="General" icon={<Globe className="size-3.5" />}>
      <InfoRow label="URL" value={page.url} mono />
      <InfoRow label="Final URL" value={page.finalUrl} mono />
      <InfoRow label="Status Code" value={page.statusCode != null ? String(page.statusCode) : '-'} />
      <InfoRow label="Title" value={page.title} />
      <InfoRow label="Language" value={page.lang} />
      <InfoRow label="Charset" value={page.charset} />
      <InfoRow label="Generator" value={page.metaGenerator} />
      <InfoRow label="Word Count" value={n(page.wordCount)} />
      <InfoRow label="Char Count" value={n(page.charCount)} />
    </Section>
  );
}

export function PagePerformanceSection({ page }: { page: PageData }) {
  if (page.loadTimeMs == null && page.domContentLoadedMs == null && page.fullContentReadyMs == null) {
    return null;
  }

  return (
    <Section title="Performance" icon={<Activity className="size-3.5" />}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <InfoRow
          label="DOM Content Loaded"
          value={page.domContentLoadedMs != null ? `${page.domContentLoadedMs}ms` : '-'}
        />
        <InfoRow
          label="Full Content Ready"
          value={page.fullContentReadyMs != null ? `${page.fullContentReadyMs}ms` : '-'}
        />
        <InfoRow
          label="Total Load Time"
          value={page.loadTimeMs != null ? `${page.loadTimeMs}ms` : '-'}
        />
      </div>
    </Section>
  );
}

export function PageMetaSection({ page }: { page: PageData }) {
  return (
    <Section title="Meta Information" icon={<Hash className="size-3.5" />}>
      <InfoRow label="Description" value={page.metaDescription} />
      <InfoRow label="Canonical" value={page.canonical} mono />
      <InfoRow label="Robots" value={page.robotsMeta} />
      <InfoRow label="Direction" value={page.dir} />
      <InfoRow label="Body Classes" value={page.bodyClasses?.join(', ')} />
      <InfoRow label="HTML Classes" value={page.htmlClasses?.join(', ')} />
    </Section>
  );
}

export function PageHeadingsSection({ page }: { page: PageData }) {
  if (!page.headings) return null;

  const headingsExist = (['h1', 'h2', 'h3'] as const).some(
    (tag) => (page.headings?.[tag] ?? []).length > 0
  );
  if (!headingsExist) return null;

  return (
    <Section title="Headings" icon={<Type className="size-3.5" />}>
      <div className="flex flex-col gap-2 ml-2">
        {(['h1', 'h2', 'h3'] as const).map((tag) => {
          const items = page.headings?.[tag] ?? [];
          if (items.length === 0) return null;
          return (
            <div key={tag}>
              <span className="font-semibold uppercase text-xs text-muted-foreground">
                {tag}
              </span>
              <ul className="list-disc pl-6 mt-1">
                {items.map((h, i) => (
                  <li key={i} className="text-foreground">
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

export function PageButtonsSection({ page }: { page: PageData }) {
  if (!page.buttons || page.buttons.length === 0) return null;

  return (
    <Section title="Buttons" icon={<FormInput className="size-3.5" />}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Text</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>ARIA Label</TableHead>
            <TableHead>Href</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {page.buttons.map((btn, i) => (
            <TableRow key={i}>
              <TableCell>{btn.text || '-'}</TableCell>
              <TableCell>{btn.type}</TableCell>
              <TableCell>{btn.aria_label || '-'}</TableCell>
              <TableCell className="max-w-[200px] truncate font-mono text-xs">
                {btn.href || '-'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Section>
  );
}

export function PageLinksSection({ page }: { page: PageData }) {
  if (!page.links) return null;

  return (
    <Section title="Links" icon={<Link2 className="size-3.5" />}>
      <SubSection label={`Internal (${page.links.internal.length})`}>
        {page.links.internal.length === 0 ? (
          <p className="text-muted-foreground text-xs">None</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Text</TableHead>
                <TableHead>Href</TableHead>
                <TableHead>Rel</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.links.internal.map((l, i) => (
                <TableRow key={i}>
                  <TableCell className="max-w-[200px] truncate">{l.text}</TableCell>
                  <TableCell className="max-w-[300px] truncate font-mono text-xs">{l.href}</TableCell>
                  <TableCell>{l.rel || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SubSection>
      <SubSection label={`External (${page.links.external.length})`}>
        {page.links.external.length === 0 ? (
          <p className="text-muted-foreground text-xs">None</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Text</TableHead>
                <TableHead>Href</TableHead>
                <TableHead>Rel</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.links.external.map((l, i) => (
                <TableRow key={i}>
                  <TableCell className="max-w-[200px] truncate">{l.text}</TableCell>
                  <TableCell className="max-w-[300px] truncate font-mono text-xs">{l.href}</TableCell>
                  <TableCell>{l.rel || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SubSection>
    </Section>
  );
}

export function PageFormsSection({ page }: { page: PageData }) {
  if (!page.forms || page.forms.length === 0) return null;

  return (
    <Section title="Forms" icon={<FormInput className="size-3.5" />}>
      {page.forms.map((form, fi) => (
        <div key={fi} className="rounded-md border p-3 space-y-2">
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>Action: <code className="font-mono">{form.action}</code></span>
            <span>Method: <code className="font-mono">{form.method}</code></span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Label</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {form.fields.map((f, fj) => (
                <TableRow key={fj}>
                  <TableCell className="font-mono text-xs">{f.name}</TableCell>
                  <TableCell>{f.type}</TableCell>
                  <TableCell>{f.label || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
    </Section>
  );
}

export function PageImagesSection({ page }: { page: PageData }) {
  if (!page.images || page.images.length === 0) return null;

  return (
    <Section title="Images" icon={<ImageIcon className="size-3.5" />}>
      <div className="grid gap-2 sm:grid-cols-2">
        {page.images.map((img, i) => (
          <div key={i} className="flex items-start gap-2 rounded-md border p-2">
            <div className="size-12 shrink-0 rounded bg-muted flex items-center justify-center overflow-hidden">
              <img
                src={img.src}
                alt={img.alt || ''}
                className="size-12 object-cover"
                loading="lazy"
              />
            </div>
            <div className="min-w-0 flex flex-col gap-0.5">
              <p className="text-xs truncate font-mono">{truncate(img.src, 60)}</p>
              <p className="text-xs text-muted-foreground">Alt: {img.alt || '-'}</p>
              {(img.width || img.height) && (
                <p className="text-xs text-muted-foreground">
                  {img.width ?? '?'}×{img.height ?? '?'}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function PageScriptsSection({ page }: { page: PageData }) {
  if (!page.scripts || page.scripts.length === 0) return null;

  return (
    <Section title="Scripts" icon={<Terminal className="size-3.5" />}>
      <ul className="space-y-1">
        {page.scripts.map((s, i) => (
          <li key={i} className="font-mono text-xs text-muted-foreground break-all">
            {truncate(s, 120)}
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function PageStylesheetsSection({ page }: { page: PageData }) {
  if (!page.stylesheets || page.stylesheets.length === 0) return null;

  return (
    <Section title="Stylesheets" icon={<Palette className="size-3.5" />}>
      <ul className="space-y-1">
        {page.stylesheets.map((s, i) => (
          <li key={i} className="font-mono text-xs text-muted-foreground break-all">
            {truncate(s, 120)}
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function PageTechSection({ page }: { page: PageData }) {
  if (!page.techEvidence || page.techEvidence.length === 0) return null;

  return (
    <Section title="Tech Evidence" icon={<Code2 className="size-3.5" />}>
      <div className="flex flex-wrap gap-1.5">
        {page.techEvidence.map((t, i) => (
          <Badge key={i} variant="secondary">{t}</Badge>
        ))}
      </div>
    </Section>
  );
}

// ─── Main PageDetail Component ───────────────────────────────────────────────

export function PageDetail({ page }: { page: PageData }) {
  return (
    <div className="flex flex-col gap-5 text-sm">
      {page.error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive">
          <p className="font-medium">Error</p>
          <p>{page.error}</p>
        </div>
      )}

      <PageGeneralSection page={page} />
      <PagePerformanceSection page={page} />
      <PageMetaSection page={page} />
      <PageHeadingsSection page={page} />
      <PageButtonsSection page={page} />
      <PageLinksSection page={page} />
      <PageFormsSection page={page} />
      <PageImagesSection page={page} />
      <PageScriptsSection page={page} />
      <PageStylesheetsSection page={page} />
      <PageTechSection page={page} />
    </div>
  );
}

export default PageDetail;
