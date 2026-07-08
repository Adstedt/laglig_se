# Position Tracking — områden keyword import

Ready-to-import keyword lists for the Semrush Position Tracking campaign on the
`laglig.se` project (project ID `30064903`). Source of truth is
`../keywords.csv` (filtered to `page_route LIKE '/omraden/%'`); regenerate these
if the briefs change.

## Files

| File | Keywords | Use |
|---|---|---|
| `omraden-primary-only.txt` | 49 | One primary keyword per områden page — the minimal watch list. |
| `omraden-primary-secondary.txt` | 180 | Primary + secondary. Good on any plan tier. |
| **`omraden-top500.txt`** | **500** | **Recommended for a 500-keyword plan.** All 180 primary+secondary, plus long-tail distributed round-robin across pages (even coverage, no page hogs the budget). |
| **`omraden-top500-tagged.csv`** | **500** | Same 500 set as above, as `keyword,tag,type` (49 primary + 131 secondary + 320 long-tail). Import this if you want keywords + per-page tags in one file. |
| `omraden-all-keywords.txt` | 661 | Everything incl. all long-tail — needs Guru+ (>500 cap). |
| `omraden-keywords-tagged.csv` | 661 | `keyword,tag,type` where `tag` = page slug. Apply as tags in Semrush to get per-URL dashboard filtering. |

`tag` = the page slug where the keyword is its **strongest** target (primary >
secondary > long-tail), so each tag maps to the page that most wants that keyword.

## Import (Semrush UI)

1. Project `laglig.se` → Position Tracking → Set up.
2. Domain `laglig.se`, exact-domain scope. Google · Sweden · Mobile · Swedish.
   (Confirm production `NEXT_PUBLIC_BASE_URL` isn't `www` before choosing scope.)
3. Paste `omraden-top500.txt` (one keyword per line).
4. Apply tags from `omraden-keywords-tagged.csv` (tag = page slug) for per-URL views.
5. Add 2–4 competitors; enable the weekly ranking-change email.

Landing Pages report auto-maps which URL ranks for each keyword — the områden
pages are monitored automatically once the keywords are in.

## Regenerate

Filter `../keywords.csv` on `page_route` starting `/omraden/`, dedupe by keyword.
The top-500 set = all primary+secondary, then long-tail round-robin per page up
to the 500 cap.
