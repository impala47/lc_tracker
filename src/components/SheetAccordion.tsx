import { useState } from 'react'
import type { Difficulty, Problem } from '../types'
import { groupBySheet } from '../lib/stats'

const DIFF_BADGE: Record<Difficulty, string> = {
  Easy: 'bg-green-500/15 text-green-400 ring-green-500/30',
  Medium: 'bg-yellow-500/15 text-yellow-400 ring-yellow-500/30',
  Hard: 'bg-red-500/15 text-red-400 ring-red-500/30',
}

function RowItem({ p }: { p: Problem }) {
  const url = p.problemUrl || p.leetcodeUrl
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/5 px-4 py-2.5 hover:bg-white/[0.03]">
      <span className="flex-1 min-w-[200px]">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-200 hover:text-sky-400 hover:underline"
          >
            {p.problemName}
          </a>
        ) : (
          <span className="text-sm text-gray-300">{p.problemName}</span>
        )}
      </span>

      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${DIFF_BADGE[p.difficulty]}`}
      >
        {p.difficulty}
      </span>

      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          p.completed ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/5 text-gray-500'
        }`}
      >
        {p.completed ? 'Solved' : 'Unsolved'}
      </span>

      {p.completed && p.lastSolved && (
        <span className="text-xs text-gray-500">Last Solved on: {p.lastSolved}</span>
      )}
    </div>
  )
}

function StepBlock({
  step,
  sections,
  solved,
  total,
  defaultOpen,
}: {
  step: string
  sections: { section: string; problems: Problem[] }[]
  solved: number
  total: number
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  // Sync with defaultOpen changes (e.g. expand-all while searching) without
  // clobbering manual toggles within a single filter state.
  const [lastDefault, setLastDefault] = useState(defaultOpen)
  if (lastDefault !== defaultOpen) {
    setLastDefault(defaultOpen)
    setOpen(defaultOpen)
  }

  const pct = total === 0 ? 0 : Math.round((solved / total) * 100)

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#161b22]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03]"
      >
        <span className={`text-gray-500 transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
        <span className="flex-1 font-semibold text-gray-100">{step}</span>
        <span className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-white/10 sm:block">
          <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </span>
        <span className="tabular-nums text-sm text-gray-400">
          {solved} / {total}
        </span>
      </button>

      {open && (
        <div className="px-2 pb-2">
          {sections.map((sec) => (
            <div key={sec.section} className="mt-2">
              <div className="px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
                {sec.section}
              </div>
              <div className="rounded-lg bg-black/20">
                {sec.problems.map((p, i) => (
                  <RowItem key={`${p.titleSlug || p.problemName}-${i}`} p={p} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SheetAccordion({
  problems,
  expandAll,
}: {
  problems: Problem[]
  expandAll: boolean
}) {
  const steps = groupBySheet(problems)

  if (steps.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-[#161b22] p-10 text-center text-gray-500">
        No problems match your filters.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {steps.map((s) => (
        <StepBlock
          key={s.step}
          step={s.step}
          sections={s.sections}
          solved={s.solved}
          total={s.total}
          defaultOpen={expandAll}
        />
      ))}
    </div>
  )
}
