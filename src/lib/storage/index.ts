import { FileSystemStorageProvider } from './file-system-storage';
import type { CrawlStorageProvider } from './types';

export * from './types';
export * from './file-system-storage';

let currentStorageProvider: CrawlStorageProvider = new FileSystemStorageProvider();

/**
 * Returns the configured storage provider singleton.
 * Defaults to FileSystemStorageProvider.
 */
export function getStorageProvider(): CrawlStorageProvider {
  return currentStorageProvider;
}

/**
 * Sets a custom storage provider (e.g. for testing, SQLite, Postgres, S3).
 */
export function setStorageProvider(provider: CrawlStorageProvider): void {
  currentStorageProvider = provider;
}
