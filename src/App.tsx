import { useEffect, useMemo, useState } from 'react'
import type { Problem } from './types'
import ProgressAnalytics from './components/ProgressAnalytics'
import Heatmap from './components/Heatmap'
import SheetAccordion from './components/SheetAccordion'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; problems: Problem[] }

export default function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [query, setQuery] = useState('')
  const [hideSolved, setHideSolved] = useState(false)

  useEffect(() => {
    // Read the single source of truth produced by scripts/sync.py.
    // Relative path so it resolves correctly under any GitHub Pages base.
    fetch('./data/striver_sheet.json', { cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: Problem[]) => setState({ status: 'ready', problems: data }))
      .catch((e) => setState({ status: 'error', message: String(e.message ?? e) }))
  }, [])

  const allProblems = state.status === 'ready' ? state.problems : []

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allProblems.filter((p) => {
      if (hideSolved && p.completed) return false
      if (q && !p.problemName.toLowerCase().includes(q)) return false
      return true
    })
  }, [allProblems, query, hideSolved])

  const filtersActive = query.trim().length > 0 || hideSolved

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-50">
          ⚡ A2Z LeetCode Tracker
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Auto-synced progress through Striver&apos;s A2Z DSA Sheet.
        </p>
      </header>

      {state.status === 'loading' && (
        <div className="rounded-xl border border-white/10 bg-[#161b22] p-10 text-center text-gray-400">
          Loading progress…
        </div>
      )}

      {state.status === 'error' && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-300">
          Couldn&apos;t load <code>./data/striver_sheet.json</code> ({state.message}). Make sure the
          data file exists and the sync has run at least once.
        </div>
      )}

      {state.status === 'ready' && (
        <div className="flex flex-col gap-6">
          <ProgressAnalytics problems={allProblems} />
          <Heatmap problems={allProblems} />

          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search problems…"
              className="w-full rounded-lg border border-white/10 bg-[#161b22] px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:border-sky-500 focus:outline-none sm:max-w-sm"
            />
            <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={hideSolved}
                onChange={(e) => setHideSolved(e.target.checked)}
                className="h-4 w-4 accent-emerald-500"
              />
              Hide solved
            </label>
          </div>

          <SheetAccordion problems={filtered} expandAll={filtersActive} />

          <footer className="pt-4 text-center text-xs text-gray-600">
            Showing {filtered.length} of {allProblems.length} problems · data auto-synced from
            LeetCode
          </footer>
        </div>
      )}
    </div>
  )
}
