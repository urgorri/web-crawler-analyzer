import { PrismaClient } from '@prisma/client'
import path from 'path'

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0) {
    return process.env.DATABASE_URL
  }

  const absoluteDbPath = path.resolve(process.cwd(), 'db', 'custom.db')

  // Prisma SQLite URLs use forward slashes across platforms.
  return `file:${absoluteDbPath.replaceAll('\\', '/')}`
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
