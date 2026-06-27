#!/usr/bin/env python3
"""
Sync LeetCode activity into data/striver_sheet.json.

Two modes:

  FULL (recommended) — set LEETCODE_SESSION to your logged-in session cookie.
      Fetches your COMPLETE list of solved problems (accurate "X / 474" count) via
      the authenticated problemset query, and fills in solve dates for your most
      recent submissions.

  PUBLIC (no cookie) — only LEETCODE_USERNAME is set.
      LeetCode's public endpoint (recentAcSubmissionList) is hard-capped at the 20
      most recent accepted submissions, so a public sync can only ever see those 20.
      It still never un-marks anything, so progress accumulates over time as you solve
      more — but it cannot backfill problems you solved before tracking began.

The sync only ever turns problems ON (completed = true). It never marks a solved
problem as unsolved, so historical progress is preserved across runs.

Configuration (environment variables):
    LEETCODE_USERNAME   (required)  LeetCode handle to sync.
    LEETCODE_SESSION    (optional)  Session cookie -> enables a full, accurate sync.
    LEETCODE_CSRF       (optional)  csrftoken cookie, sent alongside the session.
    LEETCODE_LIMIT      (optional)  Recent AC submissions to fetch for dates (default 20).

Run:  python scripts/sync.py
"""

import json
import os
import sys
import time
from datetime import datetime, timezone

import requests

GRAPHQL_URL = "https://leetcode.com/graphql"
SUBMISSIONS_API = "https://leetcode.com/api/submissions/"

# data/striver_sheet.json lives one directory up from this script's folder.
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(REPO_ROOT, "data", "striver_sheet.json")

RECENT_AC_QUERY = """
query recentAcSubmissions($username: String!, $limit: Int!) {
  recentAcSubmissionList(username: $username, limit: $limit) {
    title
    titleSlug
    timestamp
  }
}
"""

# Authenticated: the `status` field reflects the logged-in user, so filtering by
# AC returns exactly the problems that user has solved.
SOLVED_LIST_QUERY = """
query solvedProblems($categorySlug: String, $limit: Int!, $skip: Int!, $filters: QuestionListFilterInput) {
  problemsetQuestionList: questionList(
    categorySlug: $categorySlug
    limit: $limit
    skip: $skip
    filters: $filters
  ) {
    total: totalNum
    questions: data {
      titleSlug
      status
    }
  }
}
"""


def _session(extra_headers: dict | None = None) -> requests.Session:
    s = requests.Session()
    s.headers.update(
        {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; a2z-tracker/1.0)",
            "Referer": "https://leetcode.com/problemset/",
            "Origin": "https://leetcode.com",
        }
    )
    if extra_headers:
        s.headers.update(extra_headers)
    return s


def _post(session: requests.Session, query: str, variables: dict) -> dict:
    resp = session.post(
        GRAPHQL_URL, json={"query": query, "variables": variables}, timeout=30
    )
    resp.raise_for_status()
    payload = resp.json()
    if payload.get("errors"):
        raise RuntimeError(f"GraphQL errors: {payload['errors']}")
    return payload.get("data") or {}


def to_date(unix_timestamp: str | int) -> str:
    """Convert a Unix timestamp (seconds) to a local YYYY-MM-DD date string."""
    ts = int(unix_timestamp)
    return datetime.fromtimestamp(ts, tz=timezone.utc).astimezone().strftime("%Y-%m-%d")


def fetch_recent_dates(username: str, limit: int) -> dict[str, str]:
    """Map titleSlug -> most recent solve date from the public recent-AC endpoint."""
    session = _session()
    data = _post(session, RECENT_AC_QUERY, {"username": username, "limit": limit})
    submissions = data.get("recentAcSubmissionList")
    if submissions is None:
        raise RuntimeError(
            f"No submission list for '{username}'. Is the username correct and the profile public?"
        )
    latest: dict[str, int] = {}
    for sub in submissions:
        slug, ts = sub.get("titleSlug"), sub.get("timestamp")
        if not slug or ts is None:
            continue
        ts = int(ts)
        if slug not in latest or ts > latest[slug]:
            latest[slug] = ts
    return {slug: to_date(ts) for slug, ts in latest.items()}


def _auth_session(session_cookie: str, csrf: str | None) -> requests.Session:
    """A requests.Session carrying the user's LeetCode auth cookies."""
    cookies = [f"LEETCODE_SESSION={session_cookie}"]
    headers = {"X-Requested-With": "XMLHttpRequest"}
    if csrf:
        cookies.append(f"csrftoken={csrf}")
        headers["x-csrftoken"] = csrf
    headers["Cookie"] = "; ".join(cookies)
    return _session(headers)


def fetch_all_solved(session_cookie: str, csrf: str | None) -> set[str]:
    """Authenticated: return the full set of solved titleSlugs for the cookie's user."""
    session = _auth_session(session_cookie, csrf)

    solved: set[str] = set()
    skip, page = 0, 100
    while True:
        data = _post(
            session,
            SOLVED_LIST_QUERY,
            {"categorySlug": "", "limit": page, "skip": skip, "filters": {"status": "AC"}},
        )
        block = data.get("problemsetQuestionList") or {}
        total = block.get("total") or 0
        questions = block.get("questions") or []
        for q in questions:
            if q.get("titleSlug"):
                solved.add(q["titleSlug"])
        skip += page
        if skip >= total or not questions:
            break
    if not solved:
        raise RuntimeError(
            "Authenticated query returned 0 solved problems. The LEETCODE_SESSION cookie "
            "is likely expired or invalid."
        )
    return solved


def fetch_submission_dates(session_cookie: str, csrf: str | None) -> dict[str, str]:
    """
    Authenticated: walk the user's full submission history and return
    titleSlug -> most recent accepted solve date (YYYY-MM-DD).

    The /api/submissions/ endpoint returns every submission (paginated, 20 at a
    time, newest first). Because it's ordered newest-first, the FIRST accepted
    entry we see for a slug is its most recent solve, so we keep that and skip
    older duplicates.
    """
    session = _auth_session(session_cookie, csrf)
    session.headers["Referer"] = "https://leetcode.com/submissions/"

    latest_ts: dict[str, int] = {}
    offset, page, max_pages = 0, 20, 1000  # 20k submissions is a generous ceiling
    for _ in range(max_pages):
        resp = session.get(SUBMISSIONS_API, params={"offset": offset, "limit": page}, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        dump = data.get("submissions_dump") or []
        for sub in dump:
            if sub.get("status_display") != "Accepted":
                continue
            slug, ts = sub.get("title_slug"), sub.get("timestamp")
            if not slug or ts is None:
                continue
            ts = int(ts)
            if slug not in latest_ts or ts > latest_ts[slug]:
                latest_ts[slug] = ts
        if not data.get("has_next") or not dump:
            break
        offset += page
        time.sleep(0.3)  # be gentle on the submissions endpoint
    return {slug: to_date(ts) for slug, ts in latest_ts.items()}


def main() -> int:
    username = os.environ.get("LEETCODE_USERNAME")
    if not username:
        print("ERROR: LEETCODE_USERNAME environment variable is not set.", file=sys.stderr)
        return 1

    limit = int(os.environ.get("LEETCODE_LIMIT", "20"))
    session_cookie = os.environ.get("LEETCODE_SESSION")
    csrf = os.environ.get("LEETCODE_CSRF")

    # Recent solve dates are available in both modes (public endpoint).
    print(f"Fetching recent solve dates for '{username}' (last {limit})…")
    recent_dates = fetch_recent_dates(username, limit)
    print(f"  → dates for {len(recent_dates)} recent problem(s).")

    # dates: titleSlug -> last-solved date. Start with the public recent solves,
    # then (Full mode) overlay the complete history so EVERY solved problem is dated.
    dates: dict[str, str] = dict(recent_dates)

    if session_cookie:
        print("FULL mode: fetching complete solved list via authenticated session…")
        solved_slugs = fetch_all_solved(session_cookie, csrf)
        print(f"  → {len(solved_slugs)} total solved problems on your account.")

        print("Fetching full submission history for solve dates…")
        history_dates = fetch_submission_dates(session_cookie, csrf)
        print(f"  → dated {len(history_dates)} problem(s) from history.")
        for slug, date in history_dates.items():
            dates.setdefault(slug, date)  # recent_dates win ties (freshest source)
    else:
        print(
            "PUBLIC mode: no LEETCODE_SESSION set — limited to the 20 most recent solves.\n"
            "  Set LEETCODE_SESSION for an accurate full-history sync."
        )
        solved_slugs = set(recent_dates.keys())

    with open(DATA_PATH, "r", encoding="utf-8") as f:
        problems = json.load(f)

    newly_completed = 0
    for problem in problems:
        slug = problem.get("titleSlug")
        if not slug:
            continue
        is_solved = slug in solved_slugs or slug in dates
        if not is_solved:
            continue
        if not problem.get("completed"):
            newly_completed += 1
        problem["completed"] = True
        # Apply a known date if we have one; otherwise keep whatever was there.
        if slug in dates:
            problem["lastSolved"] = dates[slug]

    total_completed = sum(1 for p in problems if p.get("completed"))
    dated = sum(1 for p in problems if p.get("completed") and p.get("lastSolved"))
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(problems, f, indent=2, ensure_ascii=False)
        f.write("\n")

    rel = os.path.relpath(DATA_PATH, REPO_ROOT)
    print(
        f"Marked {newly_completed} new · {total_completed}/{len(problems)} solved "
        f"({dated} with a date) → {rel}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
