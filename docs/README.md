# laglig.se Documentation

Complete documentation for the laglig.se Swedish legal AI platform.

---

## 📚 Documentation Index

### 🎯 Start Here

| Document | Purpose | Audience |
|----------|---------|----------|
| **[PRD](./prd.md)** | Product Requirements Document - Complete feature specifications | Everyone |
| **[Brief](./brief.md)** | Initial product brief and vision | Product/Strategy |
| **[Architecture](./architecture.md)** | Technical architecture and system design | Engineering |

### 🗄️ Data & Schema

| Document | Purpose | Audience |
|----------|---------|----------|
| **[Prisma Schema Preview](./prisma-schema-preview.prisma)** | Complete database schema (Prisma ORM) | Backend Developers |
| **[Entity Relationship Diagram](./entity-relationship-diagram.md)** | Visual database structure | Everyone |
| **[Data Model Verification](./data-model-verification.md)** | Schema validation against requirements | Backend/Product |

### 🔌 External APIs

**📂 [external-apis/](./external-apis/README.md)** - Complete API documentation

Quick links:
- **[Riksdagen API](./external-apis/riksdagen-api-comprehensive-analysis.md)** - SFS law ingestion (Epic 2.2)
- **[Domstolsverket API](./external-apis/domstolsverket-api-comprehensive-analysis.md)** - Court case ingestion (Epic 2.3)
- **[MVP Implementation](./external-apis/mvp-implementation/)** - Change detection, amendment tracking
- **[Future Phases](./external-apis/future-phases/)** - Phase 2 (förarbeten), Phase 3 (political analytics)

### 🎨 Frontend Specifications

| Document | Purpose | Audience |
|----------|---------|----------|
| **[Front-End Spec](./front-end-spec.md)** | Complete UI/UX specifications | Frontend Developers |
| **[Component Library](./front-end-spec-component-library.md)** | Reusable component specifications | Frontend Developers |

**📂 [feature-specifications/](./feature-specifications/README.md)** - Detailed feature specs

Quick links:
- [01 - Homepage & Onboarding](./feature-specifications/01-homepage-and-onboarding.md)
- [02 - Dashboard & Workspace](./feature-specifications/02-dashboard-and-workspace.md)
- [03 - AI Chat Interface](./feature-specifications/03-ai-chat-interface.md)
- [04 - Law Pages (Alla Lagar)](./feature-specifications/04-law-pages-alla-lagar.md)
- [05 - HR Module](./feature-specifications/05-hr-module.md)
- [06 - User & Team Management](./feature-specifications/06-user-team-management.md)
- [07 - Change Monitoring System](./feature-specifications/07-change-monitoring-system.md)

### 🔍 Competitive Analysis

**📂 [competitive-analysis/](./competitive-analysis/)** - Competitor intelligence

- **[Notisum Change Notifications](./competitive-analysis/notisum-change-notification-analysis.md)** - How Notisum handles amendments
- **[Competitive Intelligence Addon](./competitive-intelligence-addon.md)** - General competitive insights

**📂 [notisum-data-mapping/](./notisum-data-mapping/README.md)** - Detailed Notisum feature parity analysis

### 📖 Reference

**📂 [reference/](./reference/)** - External system references

- **[Fortnox Employee Schema](./reference/fortnox-employee-schema-analysis.md)** - For HR module integration

### 🧠 Planning & Research

| Document | Purpose | Audience |
|----------|---------|----------|
| **[Market Research](./market-research.md)** | Market analysis and opportunity sizing | Product/Strategy |
| **[Brainstorming Session Results](./brainstorming-session-results.md)** | Early ideation and concepts | Everyone |

---

## 🚀 Quick Start Guides

### For Backend Developers (Epic 2.2 & 2.3)

**Day 1: Setup & Schema**
1. Read [PRD](./prd.md) Epic 2.2 & 2.3 (30 min)
2. Review [Prisma Schema](./prisma-schema-preview.prisma) (30 min)
3. Review [Architecture](./architecture.md) Section 3 (Backend Services) (30 min)

**Week 1: API Understanding**
1. Read [External APIs Deep Dive](./external-apis/external-apis-deep-dive.md) (30 min)
2. Read [Riksdagen API Comprehensive Analysis](./external-apis/riksdagen-api-comprehensive-analysis.md) (2 hours)
3. Read [Domstolsverket API Comprehensive Analysis](./external-apis/domstolsverket-api-comprehensive-analysis.md) (2 hours)

**Week 2: Implementation**
1. Review [SFS Change Detection Strategy](./external-apis/mvp-implementation/sfs-change-detection-strategy.md) (1 hour)
2. Review [Amendment Tracking Strategy](./external-apis/mvp-implementation/historical-amendment-tracking-strategy.md) (1 hour)
3. Start Epic 2.2 implementation using Section 12 code from Riksdagen API doc

### For Frontend Developers (Epic 1.x)

**Day 1: Setup & Design**
1. Read [PRD](./prd.md) Epic 1 (30 min)
2. Review [Front-End Spec](./front-end-spec.md) (2 hours)
3. Review [Component Library](./front-end-spec-component-library.md) (1 hour)

**Week 1: Feature Implementation**
1. Read [Homepage & Onboarding](./feature-specifications/01-homepage-and-onboarding.md) (1 hour)
2. Read [Dashboard & Workspace](./feature-specifications/02-dashboard-and-workspace.md) (1 hour)
3. Read [AI Chat Interface](./feature-specifications/03-ai-chat-interface.md) (1 hour)
4. Start Epic 1 implementation

### For Product/Strategy Team

**Understanding the Vision:**
1. Read [Brief](./brief.md) (30 min)
2. Read [PRD](./prd.md) (2 hours)
3. Review [Market Research](./market-research.md) (1 hour)

**Competitive Intelligence:**
1. Browse [Notisum Data Mapping](./notisum-data-mapping/README.md) (30 min)
2. Read [Competitive Intelligence Addon](./competitive-intelligence-addon.md) (30 min)
3. Read [Notisum Change Notification Analysis](./competitive-analysis/notisum-change-notification-analysis.md) (30 min)

**Future Planning:**
1. Read [Phase 2: Förarbeten Integration](./external-apis/future-phases/phase-2-forarbeten-integration.md) (1 hour)
2. Read [Phase 3: Political Analytics](./external-apis/future-phases/phase-3-political-analytics.md) (1 hour)

---

## 📊 Project Status

### ✅ Documentation Complete (100% Implementation-Ready)

**Epic 2.2: SFS Law Ingestion**
- ✅ API documentation complete
- ✅ Change detection strategy documented
- ✅ Amendment tracking strategy documented
- ✅ Production-ready code examples provided
- 🔄 Ready for development

**Epic 2.3: Court Case Ingestion**
- ✅ API documentation complete
- ✅ Implementation guide provided
- ✅ Competitive advantage identified (AD broken on Notisum)
- 🔄 Ready for development

**Frontend (Epic 1.x)**
- ✅ Complete UI/UX specifications
- ✅ Component library defined
- ✅ Feature specs for all major features
- 🔄 Ready for development

### 📅 Future Phases

**Phase 2: Förarbeten Integration** (Post-MVP, Q1-Q2 2025)
- ✅ Complete planning documentation
- ⏳ Deferred to post-MVP

**Phase 3: Political Analytics** (Post-MVP, Q3-Q4 2025)
- ✅ Complete planning documentation
- ⏳ Deferred to post-MVP (after Phase 2)

---

## 🎯 Key Business Metrics

### MVP (Epic 1-3)

**Target market:** Swedish SMEs with 10-250 employees
**Launch timeline:** Q4 2024 - Q1 2025
**Pricing tiers:**
- Basic: SEK 500/month (5 users)
- Professional: SEK 1,500/month (15 users + change notifications)
- Enterprise: Custom pricing (unlimited users + API access)

### Phase 2 (Förarbeten)

**Target market:** Law firms, larger enterprises
**Launch timeline:** Q1-Q2 2025
**Value proposition:** AI that understands legislative intent, not just law text
**Pricing:** Professional tier differentiator

### Phase 3 (Political Analytics)

**Target market:** Journalists, researchers, lobbyists, policy analysts
**Launch timeline:** Q3-Q4 2025
**Value proposition:** Policy intelligence platform
**Pricing:** New "Policy Intelligence" tier (SEK 3,500-5,000/month)
**Projected ARR:** SEK 3.7M-4.6M (~€320K-400K)

---

## 📈 Data Volume Overview

| Data Type | Volume | Ingestion Time | Storage | Status |
|-----------|--------|----------------|---------|--------|
| **SFS Laws** | 11,351 laws (1968-present) | ~38 hours | ~400 MB | Epic 2.2 |
| **Court Cases (AD)** | ~10,000 cases | ~18 hours | ~500 MB | Epic 2.3 Priority #1 |
| **Court Cases (HFD)** | ~20,000 cases | ~36 hours | ~1 GB | Epic 2.3 Priority #2 |
| **Court Cases (HD)** | ~15,000 cases | ~27 hours | ~750 MB | Epic 2.3 Priority #3 |
| **Court Cases (HovR)** | ~5,000-55,000 cases | ~9-99 hours | ~250 MB-2.75 GB | Epic 2.3 Priority #4 |
| **Förarbeten** | ~30,000 documents | ~24 hours | ~3 GB | Phase 2 |
| **Political Metadata** | ~11,000 contexts | ~6 hours | ~12 MB | Phase 3 |

**Total MVP:** ~50,000-100,000 documents, ~72-144 hours ingestion, ~2-6 GB storage

---

## 🔗 External Resources

### APIs
- [Riksdagen API Documentation](https://data.riksdagen.se/dokumentation/)
- [Domstolsverket PUH API](https://www.domstol.se/rattsfall/)
- [Lagrummet RInfo](https://lagrummet.se/rinfo) (future consideration)

### Competitors
- [Notisum](https://www.notisum.se/)
- [Zeteo](https://www.zeteo.se/)
- [Juno](https://www.juno.se/)
- [Rättsnätet](https://www.rattsnatet.se/)

### Legal Resources
- [Juridiska Föreningens förarbeteportal](https://foreningenjuridica.se/forarbeten/) (context for Phase 2)
- [Swedish Parliament Legislative Process](https://www.riksdagen.se/sv/sa-funkar-riksdagen/demokrati/sa-stiftas-svenska-lagar/)

---

## 🗂️ Document Structure Legend

```
docs/
├── README.md                          # This file - Documentation index
├── prd.md                            # Product Requirements Document
├── brief.md                          # Product brief
├── architecture.md                   # Technical architecture
│
├── 📊 Data & Schema
│   ├── prisma-schema-preview.prisma
│   ├── entity-relationship-diagram.md
│   └── data-model-verification.md
│
├── 🔌 External APIs
│   └── external-apis/
│       ├── README.md                 # API documentation index
│       ├── riksdagen-api-comprehensive-analysis.md
│       ├── domstolsverket-api-comprehensive-analysis.md
│       ├── external-apis-deep-dive.md
│       ├── mvp-implementation/       # MVP-specific strategies
│       ├── future-phases/            # Phase 2 & 3 planning
│       └── archive/                  # Superseded docs
│
├── 🎨 Frontend
│   ├── front-end-spec.md
│   ├── front-end-spec-component-library.md
│   └── feature-specifications/
│       ├── README.md
│       ├── 01-homepage-and-onboarding.md
│       ├── 02-dashboard-and-workspace.md
│       ├── 03-ai-chat-interface.md
│       ├── 04-law-pages-alla-lagar.md
│       ├── 05-hr-module.md
│       ├── 06-user-team-management.md
│       └── 07-change-monitoring-system.md
│
├── 🔍 Competitive Analysis
│   ├── competitive-analysis/
│   │   └── notisum-change-notification-analysis.md
│   ├── competitive-intelligence-addon.md
│   └── notisum-data-mapping/
│       ├── README.md
│       └── [18 detailed feature mappings]
│
├── 📖 Reference
│   └── reference/
│       └── fortnox-employee-schema-analysis.md
│
└── 🧠 Planning & Research
    ├── market-research.md
    └── brainstorming-session-results.md
```

---

## 📝 Document Maintenance

**Last updated:** 2025-11-06
**Documentation status:** 100% implementation-ready for MVP (Epic 1-3)

**Key changes:**
- 2025-11-06: Reorganized external-apis folder (mvp-implementation, future-phases, archive)
- 2025-11-06: Added Phase 3 political analytics documentation
- 2025-11-06: Completed Phase 2 förarbeten integration documentation
- 2025-11-06: Fixed 2 critical blockers + 5 high-priority gaps (now 100% ready)

**Next updates:**
- [ ] Add actual implementation notes once Epic 2.2/2.3 development starts
- [ ] Document API performance baselines from production testing
- [ ] Add troubleshooting guides based on real issues
- [ ] Update Phase 2/3 timelines based on MVP launch date

---

## 👥 Contributing

When adding new documentation:

1. **Determine appropriate location:**
   - API docs → `external-apis/`
   - Frontend specs → `feature-specifications/`
   - Competitive intel → `competitive-analysis/` or `notisum-data-mapping/`
   - Schema changes → Update `prisma-schema-preview.prisma` + `data-model-verification.md`

2. **Update relevant README files:**
   - Main docs README (this file)
   - Subfolder READMEs (external-apis, feature-specifications, notisum-data-mapping)

3. **Cross-reference related docs:**
   - Link to PRD stories
   - Link to schema sections
   - Link to implementation guides

4. **Maintain consistency:**
   - Use markdown headers consistently
   - Include "Last updated" date
   - Add "Purpose" and "Audience" metadata at top of docs

---

**Need help?** Open an issue or ask in team chat.
