import { buildSeed, type MockDb } from '@/lib/mock/seed'

const STORAGE_KEY = 'dvi.mockdb.v1'

function load(): MockDb {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      // Backfill collections added after this browser first cached its mock data.
      return { ...buildSeed(), ...(JSON.parse(raw) as Partial<MockDb>) }
    }
  } catch {
    // fall through to fresh seed
  }
  const seed = buildSeed()
  persist(seed)
  return seed
}

function persist(db: MockDb): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    // ignore quota errors — mock data is best-effort
  }
}

let db: MockDb = load()

export function getDb(): MockDb {
  return db
}

export function saveDb(): void {
  persist(db)
}

export function resetDb(): void {
  db = buildSeed()
  persist(db)
}

export function nextId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}
