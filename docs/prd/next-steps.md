# Next Steps

This PRD is now complete and ready for handoff to specialized roles. The following prompts should be used to initiate the next phases of the project.

---

## UX Expert Handoff Prompt

**Prompt for UX Expert/Designer:**

```
I need you to create a comprehensive design system and UI/UX specifications for Laglig.se based on the attached PRD (docs/prd.md).

CONTEXT:
- Product: Swedish legal compliance SaaS platform
- Design Philosophy: "Coolt med koll" - Minimalist, OpenAI-inspired aesthetic
- Target Users: SMB owners, HR managers, ISO compliance consultants
- Key Interactions: Drag-and-drop context building, streaming AI responses, Kanban compliance tracking

YOUR DELIVERABLES:

1. **Design System Specification**
   - Complete Tailwind config with color tokens, typography scale, spacing system
   - Component library based on shadcn/ui (buttons, badges, cards, forms, modals)
   - Icon library selection and usage guidelines
   - Animation and transition standards

2. **High-Fidelity Mockups** (Priority Screens)
   - Homepage with dynamic onboarding widget (streaming law list generation)
   - Dashboard summary view (compliance progress ring, AI insights, activity feed)
   - Kanban compliance workspace (5 columns, draggable law cards)
   - AI Chat sidebar (with context pills, streaming responses, inline citations)
   - Individual law page (4 tabs: Overview, Content, Change History, Notes)
   - HR Module - Employee list (table/card toggle views)
   - Changes tab (GitHub-style diff view)

3. **Interaction Design Specifications**
   - Drag-and-drop states and animations (law cards → chat, Kanban movements)
   - Streaming UI patterns (law list generation, AI responses, component streaming)
   - Mobile responsive breakpoints and adaptations
   - Error states and loading states
   - Empty states and onboarding flows

4. **Accessibility Guidelines**
   - WCAG AA compliance checklist
   - Keyboard navigation maps
   - Screen reader annotations
   - Color contrast validation

REFERENCE MATERIALS IN PRD:
- Section "User Interface Design Goals" (lines 247-496) contains full UX vision
- Section "Key Interaction Paradigms" details 5 core interactions
- Section "Branding" specifies color palette, typography, design inspiration

DELIVERABLE FORMAT:
- Figma file with all screens, components, and design tokens
- Design handoff document (Markdown) with implementation notes for developers
- Component usage examples and documentation

Please confirm you understand the requirements and are ready to proceed.
```

---

## Architect Handoff Prompt

**Prompt for Technical Architect:**

```
I need you to create a comprehensive technical architecture specification for Laglig.se based on the attached PRD (docs/prd.md).

CONTEXT:
- Product: Swedish legal compliance SaaS with AI-powered chatbot
- Stack: Next.js 14 (App Router), Supabase PostgreSQL + pgvector, OpenAI/Anthropic, Vercel deployment
- Constraints: Bootstrap-funded, solo founder, 4-6 month MVP timeline
- Scale Target: 10,000 concurrent users, 10,000+ laws, 50k-100k vector embeddings

YOUR DELIVERABLES:

1. **System Architecture Document**
   - High-level architecture diagram (Next.js app, Supabase, external APIs, Vercel infrastructure)
   - Data flow diagrams for critical paths (RAG query, change detection, onboarding)
   - Service boundaries and API contracts
   - Authentication and authorization architecture (Supabase Auth, RLS policies)
   - Multi-tenancy data isolation strategy

2. **Database Schema Design**
   - Complete Prisma schema with all tables, relationships, indexes
   - Tables: workspaces, users, workspace_members, legal_documents (polymorphic for all content types), court_cases, eu_documents, cross_references, amendments, document_subjects, law_embeddings, content_changes, employees, kollektivavtal, tasks, chat_messages, workspace_costs, activity_log
   - Row-Level Security (RLS) policies for multi-tenancy
   - Migration strategy (Prisma Migrate, CI/CD integration)
   - Data retention and GDPR compliance mechanisms

3. **Technical Risk Mitigation Plans**
   - **RAG Implementation:** Chunk size optimization, retrieval parameter tuning, hallucination detection strategy
   - **Multi-Source API Dependencies (Riksdagen, Domstolsverket, EUR-Lex):** Fallback/retry logic, caching strategy, rate limit handling
   - **Vector Database Scaling:** pgvector → Pinecone migration triggers, query performance monitoring
   - **Drag-and-Drop Performance:** State management approach, virtualization if needed, mobile touch handling
   - **Daily Multi-Content-Type Change Detection:** Job architecture (BullMQ queue?), checkpoint/resume mechanism, parallel processing design
   - **Multi-Tenancy Security:** RLS policy testing, penetration testing plan, data isolation verification

4. **API Specification**
   - RESTful API endpoints for all features (or Next.js API routes documentation)
   - Request/response schemas (Zod validation)
   - Error handling and status codes
   - Rate limiting strategy per tier
   - Webhook handling (Stripe, future integrations)

5. **AI/RAG Pipeline Architecture**
   - Vector embedding generation workflow (OpenAI text-embedding-3-small)
   - Semantic chunking implementation (500-800 tokens)
   - RAG query pipeline (embedding → similarity search → LLM prompt construction)
   - Caching strategy (Redis/Vercel KV for responses)
   - Citation extraction and verification
   - Cost optimization strategies (NFR18 - unit economics tracking)

6. **CI/CD & Deployment Strategy**
   - GitHub Actions workflows (test, build, deploy)
   - Vercel deployment configuration
   - Environment management (dev, staging, production)
   - Database migration automation
   - Monitoring and alerting setup (Sentry, Vercel Analytics)

7. **Testing Strategy**
   - Unit testing approach (Vitest + React Testing Library)
   - Integration testing (Playwright/Cypress for critical paths)
   - Security testing (RLS policy validation, penetration tests)
   - Performance testing (load testing for 10k concurrent users)

CRITICAL REQUIREMENTS FROM PRD:
- NFR1: Core Web Vitals (LCP <2.5s, FID <100ms, CLS <0.1)
- NFR2: AI response time <3 seconds
- NFR4: Encrypted personnummer (AES-256)
- NFR10: Change detection completes in <2 hours
- NFR18: Unit economics tracking (>80% gross margin target)
- FR41: Fortnox schema compatibility (future integration)

REFERENCE MATERIALS IN PRD:
- Section "Technical Assumptions" (lines 509-677) defines full stack
- Section "Technical Risk Areas" (lines 678-866) flags 6 high-complexity areas
- Section "Requirements" (lines 111-246) contains 41 FR + 26 NFR
- All 86 user stories (lines 967-2878) contain implementation acceptance criteria

DELIVERABLE FORMAT:
- Architecture Decision Records (ADRs) for key technical choices
- Technical specification document (Markdown) with diagrams
- Database schema (Prisma schema file)
- API documentation (OpenAPI/Swagger or detailed Markdown)
- Risk mitigation implementation plans

Please confirm you understand the requirements and are ready to proceed.
```

---

## Recommended Next Actions

After UX and Architecture phases complete:

1. **Epic 1 Sprint Planning** - Break Epic 1 stories into implementable tasks
2. **Development Environment Setup** - Initialize Next.js project, Supabase project, Vercel deployment
3. **Begin Implementation** - Start with Story 1.1 (Initialize Next.js 14 Project)

**Estimated Timeline:**

- UX Design Phase: 2-3 weeks
- Architecture Phase: 2 weeks (can overlap with UX)
- Development (8 Epics): 16-22 weeks
- **Total: 20-27 weeks (~5-7 months)**

---
