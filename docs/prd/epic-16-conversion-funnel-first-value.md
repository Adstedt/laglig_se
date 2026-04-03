# Epic 16: Conversion Funnel & First-Value Optimization

**Goal:** Transform the signup-to-value journey from a multi-step friction funnel into a seamless experience where users see personalized compliance value within 90 seconds of their first interaction. Introduce headless agent skills that work autonomously to generate personalized law lists — the same AI brain as the chat agent, running server-side without a chat window.

**Delivers:**
- Pre-auth value preview (org number + website URL → regulatory area preview on landing page)
- Frictionless onboarding (pre-auth data carries through signup via localStorage — no re-entry needed)
- Contextual onboarding questions (activity flags, industry specifics)
- Headless agent skill: auto-generated personalized law list (40-80 laws with commentary)
- Populated dashboard from minute one (monitoring, tasks, compliance tracking all derive from the list)

**Architecture Pattern — Headless Agent Skills:**
The core innovation is reusing the existing AI agent infrastructure (`createAgentTools()`, `search_laws`, `get_company_context`) with `generateText()` instead of `streamText()`. Same brain, same tools, no chat UI. This pattern is composable — once established, future skills (re-evaluate list, generate compliance report, assess law change impact) follow the same structure: prompt + tools + trigger.

**Requirements covered:** FR2, FR3, FR20, FR21, FR23, FR30, NFR4, NFR5

**Estimated stories:** 5

**Dependencies:**
- Epic 15 (BolagsAPI integration) — Done (Stories 15.1, 15.2)
- Epic 14 (Compliance agent + tools) — Done
- Epic 12 (Templates) — Done (provides curated quality floor)
- Epic 10 (Workspace onboarding) — Done (current wizard)

**Target Flow:**
```
Landing Page          Signup            Verification       Onboarding              Dashboard
┌──────────────┐  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Org nr + URL │→ │ Standard   │→ │ Click email  │→ │ PRE-FILLED form  │→ │ Law list ready   │
│ See preview  │  │ signup     │  │ link         │  │ Activity flags   │  │ 47 laws grouped  │
│ "12 areas"   │  │ Data saved │  │ Standard     │  │ Quick confirm    │  │ with commentary  │
│              │  │ to local-  │  │ verification │  │ → Trigger skill  │  │ Monitoring alive │
│ [Kom igång]  │  │ Storage    │  │              │  │                  │  │ Tasks suggested  │
└──────────────┘  └────────────┘  └──────────────┘  └──────────────────┘  └──────────────────┘
  ~5 sec            ~10 sec          ~30 sec           ~15 sec               ~60 sec
                                  (user is motivated                    (skill runs in background)
                                   — already saw value)
```

**Stories:**
1. **16.1 Pre-Auth Data Bridge & Streamlined Onboarding** — localStorage persistence of landing page data through signup + verification, pre-filled onboarding wizard, standard auth throughout
2. **16.2 Landing Page Company Preview** — Public org number + URL lookup, regulatory area preview, CTA passthrough to signup
3. **16.3 Contextual Onboarding Questions** — Activity flag capture via 3-5 conditional questions during onboarding
4. **16.4 Headless Law List Generation Skill** — Server-side agent skill using `generateText()` + existing tools to auto-generate personalized law list after onboarding

**Cost Model:**
- Landing page preview: ~$0.001/lookup (BolagsAPI free tier + optional URL fetch)
- Law list generation: ~$0.05-0.15/signup (one `generateText` call, 10-15 tool steps, Sonnet)
- At 100 signups/month: ~$5-15/month in AI costs for law list generation

**Priority:** High — directly impacts activation rate, time-to-value, and trial-to-paid conversion.
