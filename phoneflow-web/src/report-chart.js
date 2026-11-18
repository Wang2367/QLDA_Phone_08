const dayMs = 86400000
function shift(day, offset) {
  return new Date(Date.parse(day + 'T00:00:00Z') + offset * dayMs).toISOString().slice(0, 10)
}
function total(rows, start, end) {
  return rows.filter((row) => row.day >= start && row.day < end).reduce((sum, row) => sum + row.total, 0)
}
export function revenuePoints(report) {
  const buckets = report.days === 7 ? 7 : 6
  return Array.from({ length: buckets }, (_, index) => {
    const start = Math.floor(index * report.days / buckets)
    const end = Math.floor((index + 1) * report.days / buckets)
    const currentStart = shift(report.period.from, start)
    const previousStart = shift(report.previousPeriod.from, start)
    const last = shift(report.period.from, end - 1)
    return {
      label: last.slice(8, 10) + '/' + last.slice(5, 7),
      current: total(report.daily, currentStart, shift(report.period.from, end)),
      previous: total(report.daily, previousStart, shift(report.previousPeriod.from, end)),
    }
  })
}
export const reportDay = (day) => day.slice(8, 10) + '/' + day.slice(5, 7)

