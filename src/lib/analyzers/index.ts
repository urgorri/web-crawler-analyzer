import { defaultAnalyzerRegistry } from './registry';
import { SecurityHeadersAnalyzer } from './security-headers';
import { TechProfilerAnalyzer } from './tech-profiler';
import { SeoMetadataAnalyzer } from './seo-metadata';

export * from './types';
export * from './registry';
export * from './security-headers';
export * from './tech-profiler';
export * from './seo-metadata';

// Register built-in analyzers into default registry
defaultAnalyzerRegistry
  .register(new SecurityHeadersAnalyzer())
  .register(new TechProfilerAnalyzer())
  .register(new SeoMetadataAnalyzer());
