import type {
  AnalysisContext,
  AnalyzerResult,
  SiteAnalyzer,
} from './types';

export class AnalyzerRegistry {
  private analyzers: Map<string, SiteAnalyzer> = new Map();

  /**
   * Register a new analyzer into the registry.
   */
  public register(analyzer: SiteAnalyzer): this {
    this.analyzers.set(analyzer.id, analyzer);
    return this;
  }

  /**
   * Unregister an analyzer by ID.
   */
  public unregister(id: string): boolean {
    return this.analyzers.delete(id);
  }

  /**
   * Retrieve an analyzer by ID.
   */
  public get(id: string): SiteAnalyzer | undefined {
    return this.analyzers.get(id);
  }

  /**
   * List all registered analyzers.
   */
  public list(): SiteAnalyzer[] {
    return Array.from(this.analyzers.values());
  }

  /**
   * Run all matching analyzers against a given page/domain context.
   * If `enabledModules` is provided, only analyzers whose ID is in the set will execute.
   * Execution of each analyzer is wrapped with timing and isolated against crashes.
   */
  public async executeAll(
    context: AnalysisContext,
    enabledModules?: string[] | Record<string, boolean>
  ): Promise<Record<string, AnalyzerResult>> {
    const results: Record<string, AnalyzerResult> = {};
    const analyzers = this.list();

    const isEnabled = (id: string): boolean => {
      if (!enabledModules) return true;
      if (Array.isArray(enabledModules)) {
        return enabledModules.includes(id);
      }
      return enabledModules[id] !== false;
    };

    const runPromises = analyzers.map(async (analyzer) => {
      const startTime = performance.now();

      if (!isEnabled(analyzer.id)) {
        results[analyzer.id] = {
          analyzerId: analyzer.id,
          name: analyzer.name,
          category: analyzer.category,
          status: 'skipped',
          durationMs: 0,
        };
        return;
      }

      try {
        const available = await analyzer.isAvailable();
        if (!available) {
          results[analyzer.id] = {
            analyzerId: analyzer.id,
            name: analyzer.name,
            category: analyzer.category,
            status: 'skipped',
            error: 'Analyzer is unavailable in this environment',
            durationMs: Math.round(performance.now() - startTime),
          };
          return;
        }

        const data = await analyzer.run(context);
        results[analyzer.id] = {
          analyzerId: analyzer.id,
          name: analyzer.name,
          category: analyzer.category,
          status: 'success',
          data,
          durationMs: Math.round(performance.now() - startTime),
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results[analyzer.id] = {
          analyzerId: analyzer.id,
          name: analyzer.name,
          category: analyzer.category,
          status: 'failed',
          error: message,
          durationMs: Math.round(performance.now() - startTime),
        };
      }
    });

    await Promise.all(runPromises);
    return results;
  }
}

// Global default singleton registry
export const defaultAnalyzerRegistry = new AnalyzerRegistry();
