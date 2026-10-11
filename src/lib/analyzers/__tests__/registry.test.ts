import { describe, it, expect, vi } from 'vitest';
import { AnalyzerRegistry } from '../registry';
import type { AnalysisContext, SiteAnalyzer } from '../types';

describe('AnalyzerRegistry', () => {
  const dummyContext: AnalysisContext = {
    crawlId: 'crawl-test-1',
    targetUrl: 'https://example.com',
    finalUrl: 'https://example.com',
    domain: 'example.com',
    statusCode: 200,
  };

  it('registers and retrieves analyzers', () => {
    const registry = new AnalyzerRegistry();

    const mockAnalyzer: SiteAnalyzer = {
      id: 'mock-seo',
      name: 'Mock SEO Analyzer',
      category: 'seo',
      description: 'Tests basic SEO metrics',
      isAvailable: async () => true,
      run: async () => ({ score: 100 }),
    };

    registry.register(mockAnalyzer);
    expect(registry.get('mock-seo')).toBe(mockAnalyzer);
    expect(registry.list()).toHaveLength(1);
    expect(registry.list()[0].id).toBe('mock-seo');

    const unregistered = registry.unregister('mock-seo');
    expect(unregistered).toBe(true);
    expect(registry.get('mock-seo')).toBeUndefined();
  });

  it('executes registered analyzers and returns results', async () => {
    const registry = new AnalyzerRegistry();

    const analyzer1: SiteAnalyzer = {
      id: 'analyzer-1',
      name: 'Analyzer 1',
      category: 'seo',
      description: 'First test analyzer',
      isAvailable: async () => true,
      run: async () => ({ ok: true }),
    };

    const analyzer2: SiteAnalyzer = {
      id: 'analyzer-2',
      name: 'Analyzer 2',
      category: 'security',
      description: 'Second test analyzer',
      isAvailable: async () => true,
      run: async () => {
        throw new Error('Analysis exploded');
      },
    };

    registry.register(analyzer1).register(analyzer2);

    const results = await registry.executeAll(dummyContext);

    expect(results['analyzer-1'].status).toBe('success');
    expect(results['analyzer-1'].data).toEqual({ ok: true });
    expect(results['analyzer-2'].status).toBe('failed');
    expect(results['analyzer-2'].error).toBe('Analysis exploded');
  });

  it('skips analyzers when disabled via enabledModules list or map', async () => {
    const registry = new AnalyzerRegistry();

    const runSpy = vi.fn().mockResolvedValue({ done: true });
    const analyzer: SiteAnalyzer = {
      id: 'tech-profiler',
      name: 'Tech Profiler',
      category: 'tech',
      description: 'Identifies stack',
      isAvailable: async () => true,
      run: runSpy,
    };

    registry.register(analyzer);

    // Test with array (not included)
    const arrayResults = await registry.executeAll(dummyContext, ['seo']);
    expect(arrayResults['tech-profiler'].status).toBe('skipped');
    expect(runSpy).not.toHaveBeenCalled();

    // Test with object map (explicit false)
    const mapResults = await registry.executeAll(dummyContext, { 'tech-profiler': false });
    expect(mapResults['tech-profiler'].status).toBe('skipped');
    expect(runSpy).not.toHaveBeenCalled();

    // Test with object map (explicit true)
    const activeResults = await registry.executeAll(dummyContext, { 'tech-profiler': true });
    expect(activeResults['tech-profiler'].status).toBe('success');
    expect(runSpy).toHaveBeenCalledOnce();
  });

  it('marks analyzer as skipped when isAvailable returns false', async () => {
    const registry = new AnalyzerRegistry();

    const unavailableAnalyzer: SiteAnalyzer = {
      id: 'traceroute',
      name: 'Traceroute Network',
      category: 'network',
      description: 'Raw ICMP socket trace',
      isAvailable: async () => false,
      run: async () => ({ hops: [] }),
    };

    registry.register(unavailableAnalyzer);

    const results = await registry.executeAll(dummyContext);
    expect(results['traceroute'].status).toBe('skipped');
    expect(results['traceroute'].error).toContain('unavailable');
  });
});
