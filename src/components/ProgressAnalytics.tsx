import type { Difficulty } from '../types'
import { computeStats } from '../lib/stats'
import type { Problem } from '../types'

const BAR_COLORS: Record<Difficulty, string> = {
  Easy: 'bg-green-500',
  Medium: 'bg-yellow-500',
  Hard: 'bg-red-500',
}

const TEXT_COLORS: Record<Difficulty, string> = {
  Easy: 'text-green-400',
  Medium: 'text-yellow-400',
  Hard: 'text-red-400',
}

function pct(solved: number, total: number): number {
  return total === 0 ? 0 : Math.round((solved / total) * 100)
}

export default function ProgressAnalytics({ problems }: { problems: Problem[] }) {
  const stats = computeStats(problems)

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
      {/* Global progress badge */}
      <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-[#161b22] p-6">
        <div className="text-5xl font-bold tabular-nums">
          {stats.solved}
          <span className="text-2xl font-normal text-gray-500"> / {stats.total}</span>
        </div>
        <div className="mt-1 text-sm uppercase tracking-wide text-gray-400">Solved</div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${pct(stats.solved, stats.total)}%` }}
          />
        </div>
        <div className="mt-2 text-xs text-gray-500">
          {pct(stats.solved, stats.total)}% complete
        </div>
      </div>

      {/* Per-difficulty gauges */}
      <div className="flex flex-col justify-center gap-4 rounded-xl border border-white/10 bg-[#161b22] p-6">
        {stats.byDifficulty.map((d) => (
          <div key={d.difficulty}>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className={`font-medium ${TEXT_COLORS[d.difficulty]}`}>{d.difficulty}</span>
              <span className="tabular-nums text-gray-400">
                {d.solved} / {d.total}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full ${BAR_COLORS[d.difficulty]} transition-all`}
                style={{ width: `${pct(d.solved, d.total)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
