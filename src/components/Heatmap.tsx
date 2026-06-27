import { useMemo } from 'react'
import type { Problem } from '../types'
import { solvedByDate } from '../lib/stats'

const DAY_MS = 24 * 60 * 60 * 1000
const WEEKDAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']
const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function toKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Map a distinct-solve count to one of the 5 GitHub heat levels. */
function level(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0
  if (count === 1) return 1
  if (count <= 3) return 2
  if (count <= 5) return 3
  return 4
}

const LEVEL_BG = ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-heat-4']

interface Cell {
  key: string
  count: number
}

export default function Heatmap({ problems }: { problems: Problem[] }) {
  const counts = useMemo(() => solvedByDate(problems), [problems])

  const { weeks, monthLabels } = useMemo(() => {
    // End on today; start ~53 weeks back, snapped to the preceding Sunday.
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const start = new Date(today.getTime() - 364 * DAY_MS)
    start.setDate(start.getDate() - start.getDay()) // back up to Sunday

    const weeks: Cell[][] = []
    const monthLabels: { col: number; label: string }[] = []
    let lastMonth = -1

    let cursor = new Date(start)
    let col = 0
    while (cursor <= today) {
      const week: Cell[] = []
      for (let d = 0; d < 7; d++) {
        if (cursor > today) {
          week.push({ key: `pad-${col}-${d}`, count: -1 })
        } else {
          const key = toKey(cursor)
          week.push({ key, count: counts.get(key) ?? 0 })
          if (cursor.getDate() <= 7 && cursor.getMonth() !== lastMonth) {
            lastMonth = cursor.getMonth()
            monthLabels.push({ col, label: MONTH_LABELS[cursor.getMonth()] })
          }
          cursor = new Date(cursor.getTime() + DAY_MS)
        }
      }
      weeks.push(week)
      col++
    }
    return { weeks, monthLabels }
  }, [counts])

  const totalSolves = useMemo(
    () => [...counts.values()].reduce((a, b) => a + b, 0),
    [counts],
  )

  return (
    <section className="overflow-x-auto rounded-xl border border-white/10 bg-[#161b22] p-6">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-gray-300">Activity</h2>
        <span className="text-xs text-gray-500">{totalSolves} solves in the last year</span>
      </div>
      <div className="flex gap-2">
        {/* Weekday labels */}
        <div className="mt-5 flex flex-col gap-[3px] pr-1 text-[10px] leading-[11px] text-gray-500">
          {WEEKDAY_LABELS.map((label, i) => (
            <div key={i} className="h-[11px]">
              {label}
            </div>
          ))}
        </div>

        <div>
          {/* Month labels */}
          <div className="relative mb-1 h-4 text-[10px] text-gray-500">
            {monthLabels.map((m) => (
              <span
                key={`${m.col}-${m.label}`}
                className="absolute"
                style={{ left: `${m.col * 14}px` }}
              >
                {m.label}
              </span>
            ))}
          </div>

          {/* Grid */}
          <div className="flex gap-[3px]">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((cell) =>
                  cell.count < 0 ? (
                    <div key={cell.key} className="h-[11px] w-[11px]" />
                  ) : (
                    <div
                      key={cell.key}
                      title={`${cell.count} solved on ${cell.key}`}
                      className={`h-[11px] w-[11px] rounded-[2px] ${LEVEL_BG[level(cell.count)]}`}
                    />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center justify-end gap-1 text-[10px] text-gray-500">
        <span>Less</span>
        {LEVEL_BG.map((bg) => (
          <div key={bg} className={`h-[11px] w-[11px] rounded-[2px] ${bg}`} />
        ))}
        <span>More</span>
      </div>
    </section>
  )
}
