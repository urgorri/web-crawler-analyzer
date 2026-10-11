import { defaultAnalyzerRegistry } from './registry';
import { SecurityHeadersAnalyzer } from './security-headers';
import { TechProfilerAnalyzer } from './tech-profiler';

export * from './types';
export * from './registry';
export * from './security-headers';
export * from './tech-profiler';

// Register built-in analyzers into default registry
defaultAnalyzerRegistry
  .register(new SecurityHeadersAnalyzer())
  .register(new TechProfilerAnalyzer());
