export type Difficulty = 'Easy' | 'Medium' | 'Hard'

/** One row of data/striver_sheet.json — the single source of truth. */
export interface Problem {
  step: string
  section: string
  problemName: string
  titleSlug: string
  leetcodeUrl: string
  /** Best external link for the problem (LeetCode if available, else GFG/CN/article). */
  problemUrl?: string
  difficulty: Difficulty
  completed: boolean
  /** "YYYY-MM-DD" when completed, otherwise null. */
  lastSolved: string | null
}
