import { PrismaClient } from '@prisma/client'
import path from 'path'

function normalizeSqliteFileUrl(databaseUrl: string) {
  if (!databaseUrl.startsWith('file:')) {
    return databaseUrl
  }

  const sqlitePath = databaseUrl.slice('file:'.length)

  // Keep in-memory DB untouched.
  if (sqlitePath === ':memory:') {
    return databaseUrl
  }

  // Resolve relative SQLite paths from repo root to avoid runtime cwd differences.
  if (sqlitePath.startsWith('./') || sqlitePath.startsWith('../')) {
    const absoluteDbPath = path.resolve(process.cwd(), sqlitePath)
    return `file:${absoluteDbPath.replaceAll('\\', '/')}`
  }

  return `file:${sqlitePath.replaceAll('\\', '/')}`
}

function resolveDatabaseUrl() {
  const rawDatabaseUrl =
    process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0
      ? process.env.DATABASE_URL
      : 'file:./db/custom.db'

  return normalizeSqliteFileUrl(rawDatabaseUrl)
}

const resolvedDatabaseUrl = resolveDatabaseUrl()

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
    datasources: {
      db: {
        url: resolvedDatabaseUrl,
      },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
