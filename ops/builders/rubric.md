# Builder certification rubric

Score each dimension 1–5. **Pass = average ≥ 3.5 and no dimension at 1.**  
Do **not** publish numeric scores to clients. Map to tiers only.

| Dimension | 1 | 3 | 5 |
|-----------|---|---|---|
| **Completeness** | Missing core flows | All must-haves work | Must-haves + polish + seed data |
| **Security mindset** | Secrets committed / open admin | Auth present, basic hygiene | Clear threat notes, hashed creds, HTTPS |
| **Efficiency** | Slow, chaotic thrash | Ships in window | High leverage with AI tools, clean commits |
| **Longevity** | Spaghetti, no README | Runnable + readable structure | Clear modules, env docs, migration path |
| **UX judgment** | Broken mobile / confusing | Usable for layman admin | Calm hierarchy, obvious next actions |
| **Recovery** | Freezes on errors | Recovers from mistakes on recording | Explains tradeoffs; fixes without panic |
| **Communication** | Unclear README | Adequate handoff | Operator could Care this tomorrow |

## Tier mapping

| Tier | Rule | Assignable SKUs |
|------|------|-----------------|
| Associate | Pass | Starter only · supervised |
| Builder | Pass + Completeness ≥ 4 + Longevity ≥ 4 | Starter + Growth |
| Principal | Pass + all ≥ 4 and Security ≥ 4 | All SKUs · can review others |

## Fail fast

Automatic fail if: payment recording doesn’t update ledger, admin is publicly writable without auth, or recording shows another person driving the machine undisclosed.
