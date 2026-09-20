export function weekKeyFor(dateIso: string): string {
  const d = new Date(dateIso)
  const onejan = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${week}`
}

/** Returns the Mon–Sun ISO dates (yyyy-mm-dd) for the week containing `dateIso`. */
export function currentWeekDates(dateIso: string = new Date().toISOString()): string[] {
  const d = new Date(dateIso)
  const day = d.getDay() === 0 ? 7 : d.getDay() // Mon=1..Sun=7
  const monday = new Date(d)
  monday.setDate(d.getDate() - (day - 1))
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(monday)
    dt.setDate(monday.getDate() + i)
    return dt.toISOString().slice(0, 10)
  })
}
