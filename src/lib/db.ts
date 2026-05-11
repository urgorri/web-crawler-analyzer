import { PrismaClient } from '@prisma/client'

const resolvedDatabaseUrl =
  process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0
    ? process.env.DATABASE_URL
    : 'file:./db/custom.db'

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
