# Story Sequence and Dependencies

```
21.1 (schema) ─┬─► 21.2 (cycle CRUD) ─► 21.4 (wizard + materialisation) ─► 21.5 (item list + bedömning)
               │                                                              │
               │                                                              ├─► 21.6 (complete) ─► 21.11 (HTML rapport)
               │                                                              │
               ├─► 21.3 (scope selector) ─────────────────────────────────────┘
               │
               └─► 21.7 (findings) ─► 21.8 (task auto-spawn)
                        │
                        └─► 21.9 (seal) ─► 21.10 (immutability guard) ─► 21.12 (PDF)
                                                                            │
                                             21.13 (activity log) ◄─────────┘
                                             21.14 (permissions)  ◄─────────┘
```

Recommended execution order (optimises for incremental value + testability):

1. **21.1** (schema) — foundation
2. **21.2** (cycle CRUD) + **21.3** (scope selector) — parallelisable
3. **21.4** (wizard + materialisation) — integrates 21.2 + 21.3
4. **21.5** (item list + bedömning) — first user-visible value
5. **21.14** (permissions) — easy to land early, unblocks auditor-role tests
6. **21.13** (activity log) — wire in ActivityLog as mutations appear
7. **21.7** (findings) + **21.8** (task auto-spawn) — findings track, sequential
8. **21.6** (complete) — requires item flow working
9. **21.11** (HTML renderer) — builds on complete
10. **21.9** (seal) + **21.10** (immutability guard) — sealed cycle + safety net, sequential and paired
11. **21.12** (PDF) — last, depends on HTML renderer + seal decided; requires Architect input on stack choice before start

**Estimated elapsed: 8–12 weeks** at one full-stack developer with standard review/QA gates.

---
