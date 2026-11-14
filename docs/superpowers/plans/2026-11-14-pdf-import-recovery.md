# Recover incomplete Socrative answer keys

Reproduced actual user PDF rejection in document extraction before AI runs. Separate readable question/choice structure from answer-key completeness. Emit structured source for missing/ambiguous visual marks; keep all questions and choices. AI import automatically completes missing answers and checks supplied keys for potential mistakes without silently replacing them. Conflicting or genuinely ambiguous answers remain reviewable draft items, not whole-file extraction failures.

Keep strict structural validation, original wording/choice IDs, child-process PDF isolation and no fabricated answers. Add real generated-PDF regressions for partial/multiple/no answer marks, mocked AI review, actual supplied-file reproduction and HTTP/browser boundary coverage. No user quiz or API keys committed. Validate and publish Public only.
