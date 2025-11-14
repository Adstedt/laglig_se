# Introduction

This document outlines the complete fullstack architecture for **Laglig.se**, including backend systems, frontend implementation, and their integration. It serves as the single source of truth for AI-driven development, ensuring consistency across the entire technology stack.

This unified approach combines what would traditionally be separate backend and frontend architecture documents, streamlining the development process for modern fullstack applications where these concerns are increasingly intertwined.

**Project Context:**
Laglig.se is a Swedish legal compliance SaaS platform targeting SMBs, ISO compliance managers, and public sector. The platform combines a comprehensive legal database (**170,000+ documents** including SFS laws, court cases, EU legislation) with AI-powered question answering, proactive change monitoring, and Kanban-style compliance workflows.

**Architectural Complexity Drivers:**

- **Massive SEO footprint:** 170,000+ server-rendered pages requiring sub-2s load times
- **RAG-powered AI:** Zero-hallucination requirement demands vector search + LLM orchestration
- **Dynamic onboarding:** Real-time law generation with conversational AI (3-5 contextual questions)
- **GDPR compliance:** Swedish legal domain with EU user data sovereignty requirements
- **Cost-conscious scaling:** Target 60% margins with AI costs at ~11% of revenue at scale

**Business Goals:**

- 10M SEK ARR within 18 months (83K SEK/month)
- 760+ paying customers
- SEO dominance (rank #1-3 for 100+ Swedish legal search terms, 50K monthly organic visitors)
- Fortnox integration by Month 9 (500 customers via partnership)

**Technical Approach:**
This architecture adopts a **Serverless Monolith (Vercel Edge + Functions)** with Next.js 16 App Router, Supabase PostgreSQL (pgvector), and OpenAI GPT-4 for RAG. The system prioritizes:

1. **Rapid MVP delivery** (solo-founder velocity)
2. **SEO-first rendering** (SSR for all 170K public pages)
3. **Cost-conscious AI** (pgvector avoids Pinecone costs until 100K queries/day)
4. **Clear scaling path** (identified triggers for migration to dedicated services)

**Scaling Horizons:**

- **0-1K users (Months 0-6):** Current architecture sufficient, Vercel free tier
- **1K-10K users (Months 6-12):** Supabase Pro tier ($25/mo), Vercel Pro ($20/mo)
- **10K-100K users (Months 12-24):** Migrate pgvector → Pinecone (NFR17), consider edge caching
- **100K+ users (Post-MVP):** Re-architect to microservices if needed

---
