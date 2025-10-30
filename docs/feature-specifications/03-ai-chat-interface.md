# Feature Specification: AI Chat Interface

**Document Version:** 1.0
**Last Updated:** 2024-01-20
**Status:** Draft
**Owner:** Product Team

---

## Executive Summary

The AI Chat Interface is the core value proposition of Laglig.se - a context-aware legal compliance assistant that combines RAG (Retrieval-Augmented Generation) with drag-and-drop component streaming to provide hallucination-free, citation-backed answers about Swedish laws and user-specific compliance requirements.

**Key Differentiators:**
- **Zero Hallucination Guarantee:** AI only answers from RAG database or dragged component data
- **Multi-Component Context:** Drag law cards, employee cards, tasks, and files into chat for rich contextual queries
- **Citation-First:** Every response includes hover tooltips and clickable links to source laws/documents
- **Built on Vercel AI SDK:** Leverages streaming, tool calling, and prompt engineering best practices

---

## Table of Contents

1. [Core Principles](#core-principles)
2. [User Interface](#user-interface)
3. [Conversation Patterns](#conversation-patterns)
4. [Component Streaming Architecture](#component-streaming-architecture)
5. [RAG Implementation](#rag-implementation)
6. [Context Awareness System](#context-awareness-system)
7. [Citations & Source Attribution](#citations--source-attribution)
8. [File Upload & Analysis](#file-upload--analysis)
9. [Error Handling & Guardrails](#error-handling--guardrails)
10. [Chat History & Persistence](#chat-history--persistence)
11. [AI Task & Law Generation](#ai-task--law-generation)
12. [Chat Summarization & Export](#chat-summarization--export)
13. [Technical Implementation](#technical-implementation)
14. [Post-MVP Features](#post-mvp-features)

---

## Core Principles

### 1. Hallucination Prevention
**The AI NEVER generates information outside the provided context.**

**Implementation:**
- System prompt enforces strict grounding: "ONLY answer using RAG chunks or component data"
- Post-processing validation: Every claim must cite [Law §X] or [Document: Y]
- If information missing: "I don't have enough information in the current context to answer that."

### 2. Citation-First Architecture
Every AI response must include:
- Inline citations with hover tooltips
- Clickable links to law sections or documents
- Highlighted quotes from source materials

### 3. Context Richness
Users build context through drag-and-drop:
- Law cards → Full law metadata + tasks + notes
- Employee cards → HR data + training status + linked laws
- Files → Full text extraction + metadata
- Tasks → Task details + linked laws/employees

### 4. Conversational Intelligence
AI maintains conversation memory within each chat thread:
- Remembers previously dragged components
- References earlier queries
- Builds on previous answers

### 5. User Control
AI suggests actions, user approves:
- "Shall I create a task for this?"
- "Would you like me to add this law to your list?"
- Never mutates data without explicit confirmation

---

## User Interface

### Right Sidebar Layout

```
┌─────────────────────────────────┐
│  💬 AI Chat                [−]  │ ← Collapse button
├─────────────────────────────────┤
│                                 │
│  [Context Pills]                │
│  📋 Arbetsmiljölagen    [×]     │
│  👤 Anna Svensson       [×]     │
│                                 │
├─────────────────────────────────┤
│                                 │
│  ┌─────────────────────────┐   │
│  │ AI: Hej! Hur kan jag    │   │
│  │ hjälpa dig med lag-     │   │
│  │ efterlevnad idag?       │   │
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │ User: Är vi compliant?  │   │
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │ AI: Based on Arbetsmil- │   │
│  │ jölagen 3:2a [¹], you   │   │
│  │ need a risk assessment. │   │
│  │                         │   │
│  │ [¹] Arbetsmiljölagen... │   │
│  └─────────────────────────┘   │
│                                 │
│  [Scroll for more...]          │
│                                 │
├─────────────────────────────────┤
│  [Drop files or cards here]    │ ← Drop zone
│  ┌───────────────────────────┐ │
│  │ 💬 Skriv din fråga...     │ │
│  │                      [📎] │ │ ← File upload
│  └───────────────────────────┘ │
│  [Ny Chat] [📄 Sammanfatta]   │
└─────────────────────────────────┘
```

### UI Components

#### Header
- **Title:** "💬 AI Chat"
- **Actions:**
  - Collapse button (minimize sidebar to 60px icon)
  - New chat button (starts fresh conversation)
  - Summarize button (appears after 5+ messages)

#### Context Pills Area
- Displays all dragged components as pills
- Format: `[Icon] Name [×]`
- Click × to remove component from context
- Max 10 components (enforced)
- Visual hierarchy: Law cards → Employees → Files → Tasks

#### Message Area
- **Auto-scroll to bottom** on new messages
- **Streaming text** appears word-by-word (Vercel AI SDK `useChat`)
- **Citation hover tooltips** on numbered references
- **Typing indicator** when AI is thinking: "..." animated dots
- **Error messages** in red pill: "⚠️ Could not retrieve answer"

#### Input Area
- **Text input:** Multiline textarea, auto-expand up to 5 rows
- **Drop zone:** Highlight border when dragging component over chat
- **File upload button:** Opens file picker (PDF, DOCX, XLSX)
- **Send button:** Primary action, disabled when empty
- **Placeholder text:**
  - Default: "Skriv din fråga om lagefterlevnad..."
  - With context: "Fråga om Arbetsmiljölagen och Anna Svensson..."

---

## Conversation Patterns

### Pattern 1: Standard Q&A

**User input:**
```
"Vad kräver arbetsmiljölagen för riskbedömningar?"
```

**AI response:**
```
Enligt Arbetsmiljölagen 3:2a¹ ska arbetsgivaren:

1. Systematiskt undersöka arbetsförhållandena
2. Bedöma risker för ohälsa och olycksfall
3. Vidta åtgärder för att förebygga ohälsa
4. Dokumentera riskbedömningen

Riskbedömningen ska göras kontinuerligt och alltid när:
- Nya arbetsuppgifter införs
- Arbetsmiljön förändras
- Olycksfall eller tillbud inträffar

[¹] Arbetsmiljölagen (1977:1160) 3 kap. 2a §
    "Arbetsgivaren skall systematiskt planera, leda och
    kontrollera verksamheten på ett sätt som leder till
    att arbetsmiljön uppfyller föreskrivna krav..."
```

**Technical flow:**
1. User query → Generate embedding (OpenAI `text-embedding-3-large`)
2. Vector search in Supabase pgvector (top 10 chunks)
3. Inject chunks into system prompt
4. Stream response with Vercel AI SDK `streamText`
5. Parse citations and render hover tooltips

---

### Pattern 2: Document Analysis

**User action:**
Drags `Anställningskontrakt_Anna.pdf` into chat

**Context pill appears:**
```
📄 Anställningskontrakt_Anna.pdf [×]
```

**User input:**
```
"Är detta kontrakt compliant med Anställningsskyddslagen?"
```

**AI response:**
```
Jag har granskat anställningskontraktet för Anna Svensson
mot Anställningsskyddslagen (1982:80).

✅ Uppfyller kraven:
- Skriftlig form (§4)¹
- Anställningsform tydligt angiven (§5)²
- Uppsägningstid specificerad (§11)³

⚠️ Saknas eller behöver förtydligas:
- Provanställningens längd (max 6 månader enligt §6)⁴
  → Kontraktet anger "3-6 månader" vilket är oklart
- Hänvisning till kollektivavtal (rekommenderat)

Rekommendation: Förtydliga provanställningstiden till
ett specifikt antal månader (t.ex. "3 månader").

[¹] Anställningsskyddslagen 4§ "En arbetsgivare ska ge
    en arbetstagare skriftlig information om..."
[²] Anställningsskyddslagen 5§ "Avtal om anställning..."
[³] Anställningsskyddslagen 11§ "Vid uppsägning från..."
[⁴] Anställningsskyddslagen 6§ "En provanställning får
    inte avse längre tid än sex månader..."
```

**Technical flow:**
1. File uploaded → Extract text (PDF.js or Textract)
2. Store in Mina Filer (if not already stored)
3. Add file object to chat context:
   ```json
   {
     "type": "file",
     "filename": "Anställningskontrakt_Anna.pdf",
     "extracted_text": "FULL TEXT...",
     "linked_laws": ["Anställningsskyddslagen"]
   }
   ```
4. User query → RAG retrieval for Anställningsskyddslagen
5. LLM receives: File text + RAG chunks + Query
6. Stream analysis with citations

---

### Pattern 3: Multi-Component Comparison

**User action:**
Drags into chat:
1. `📋 Arbetsmiljölagen` (law card)
2. `👤 Anna Svensson` (employee card)
3. `👤 Erik Johansson` (employee card)

**Context pills:**
```
📋 Arbetsmiljölagen [×]
👤 Anna Svensson [×]
👤 Erik Johansson [×]
```

**User input:**
```
"Vilken utbildning saknar Anna och Erik för att vara compliant?"
```

**AI response:**
```
Baserat på Arbetsmiljölagen 3:3¹ och medarbetarnas
nuvarande utbildningsstatus:

**Anna Svensson (Byggnadsarbetare)**
✅ Genomförd utbildning:
- Arbetsmiljöutbildning (2023-06-15)
- GDPR-utbildning (2023-07-01)

❌ Saknas:
- Första hjälpen-utbildning (obligatorisk för byggarbetare)²
- Säkerhet vid arbete på hög höjd³

**Erik Johansson (Kontorsanställd)**
✅ Genomförd utbildning:
- GDPR-utbildning (2023-05-20)

❌ Saknas:
- Arbetsmiljöutbildning (obligatorisk för alla anställda)¹

Rekommendation: Boka Första hjälpen för Anna och
Arbetsmiljöutbildning för Erik inom 30 dagar.

Vill du att jag skapar uppgifter för detta i din Kanban?

[¹] Arbetsmiljölagen 3:3 "Arbetstagare ska få den
    utbildning som behövs..."
[²] AFS 2012:3 Första hjälpen och krisstöd
[³] AFS 2013:4 Arbete på hög höjd
```

**User clicks:** "Ja, skapa uppgifter"

**AI creates tasks:**
```
✅ Uppgifter skapade:
1. [Uppgift] Boka Första hjälpen-utbildning för Anna Svensson
   Kopplad till: Arbetsmiljölagen, Anna Svensson
   Deadline: 2024-02-20

2. [Uppgift] Boka Arbetsmiljöutbildning för Erik Johansson
   Kopplad till: Arbetsmiljölagen, Erik Johansson
   Deadline: 2024-02-20
```

**Technical flow:**
1. Multiple component objects in context
2. RAG retrieval for Arbetsmiljölagen
3. LLM compares employee training data vs. law requirements
4. AI generates task JSON structures
5. User confirms → tRPC mutation creates tasks in DB

---

### Pattern 4: Proactive Suggestions (Post-MVP)

**Scenario:** User views Arbetsmiljölagen law page

**AI initiates:**
```
💡 Jag märkte att du tittar på Arbetsmiljölagen.
Vill du att jag identifierar vilka krav som gäller
för ditt team (5 byggarbetare, 2 kontorsanställda)?
```

**User:** "Ja"

**AI retrieves:**
- Team composition from HR module
- Existing law cards and compliance status
- Related tasks

**AI responds:**
```
Baserat på ditt team har jag identifierat 8 krav från
Arbetsmiljölagen:

✅ Uppfyllt (5 krav):
- Skriftlig arbetsmiljöplan (3:1a)
- Skyddsombud utsett (6:1)
- ...

⚠️ Att göra (3 krav):
- Riskbedömning för arbete på hög höjd (3:2a)
- Årlig arbetsmiljörond (3:2)
- Uppdatera systematiskt arbetsmiljöarbete (SAM) (3:1)

Vill du att jag skapar uppgifter för de 3 saknade kraven?
```

---

## Component Streaming Architecture

### Drag-and-Drop Mechanics

**Supported components:**
1. **Law Cards** (from Dashboard Kanban or Law Pages)
2. **Employee Cards** (from HR Module)
3. **Task Cards** (from Kanban board)
4. **Files** (from Mina Filer or desktop)

**Visual feedback:**

**Phase 1: Drag Start**
```
User grabs law card → Card gets semi-transparent
Chat sidebar highlights drop zone with pulsing border
```

**Phase 2: Hover Over Drop Zone**
```
Drop zone shows preview:
┌───────────────────────────────┐
│ Drop here to add context      │
│ ┌─────────────────────────┐   │
│ │ 📋 Arbetsmiljölagen     │   │
│ │ (1977:1160)             │   │
│ └─────────────────────────┘   │
└───────────────────────────────┘
```

**Phase 3: Drop**
```
Component animates into context pills area
API call: POST /api/chat/add-context
Component data serialized to JSON and added to chat state
```

**Phase 4: Context Active**
```
Context pill appears:
📋 Arbetsmiljölagen [×]

Placeholder text updates:
"Fråga om Arbetsmiljölagen..."
```

### Component Data Serialization

#### Law Card Object
```typescript
interface LawCardContext {
  type: "law_card";
  law_id: string;
  law_name: string; // "Arbetsmiljölagen (1977:1160)"
  law_category: string; // "Labor Law"
  status: "compliant" | "under_review" | "non_compliant" | "not_applicable";
  tasks: {
    id: string;
    title: string;
    status: "todo" | "in_progress" | "done";
    deadline: string | null;
  }[];
  notes: string | null; // User's notes on this law
  linked_files: string[]; // File IDs from Mina Filer
  linked_employees: string[]; // Employee IDs affected by this law
  last_reviewed: string | null; // ISO 8601 date
  priority: "high" | "medium" | "low";
}
```

**Example:**
```json
{
  "type": "law_card",
  "law_id": "law_abc123",
  "law_name": "Arbetsmiljölagen (1977:1160)",
  "law_category": "Labor Law",
  "status": "under_review",
  "tasks": [
    {
      "id": "task_xyz",
      "title": "Conduct annual risk assessment",
      "status": "in_progress",
      "deadline": "2024-02-15"
    }
  ],
  "notes": "Updated safety policy 2024-01-15 after audit",
  "linked_files": ["file_789"],
  "linked_employees": ["emp_anna", "emp_erik"],
  "last_reviewed": "2024-01-15T10:30:00Z",
  "priority": "high"
}
```

#### Employee Card Object
```typescript
interface EmployeeCardContext {
  type: "employee_card";
  employee_id: string;
  name: string;
  role: string;
  employment_type: "full_time" | "part_time" | "consultant";
  start_date: string; // ISO 8601
  completed_trainings: {
    name: string;
    completed_date: string;
    expires_date: string | null;
  }[];
  missing_trainings: string[]; // Training names
  linked_laws: string[]; // Law IDs that apply to this employee
  linked_tasks: string[]; // Task IDs assigned to this employee
  compliance_status: "compliant" | "needs_attention";
}
```

**Example:**
```json
{
  "type": "employee_card",
  "employee_id": "emp_anna",
  "name": "Anna Svensson",
  "role": "Construction Worker",
  "employment_type": "full_time",
  "start_date": "2023-06-01",
  "completed_trainings": [
    {
      "name": "Arbetsmiljöutbildning",
      "completed_date": "2023-06-15",
      "expires_date": "2026-06-15"
    },
    {
      "name": "GDPR-utbildning",
      "completed_date": "2023-07-01",
      "expires_date": null
    }
  ],
  "missing_trainings": ["Första hjälpen", "Arbete på hög höjd"],
  "linked_laws": ["law_arbetsmiljo", "law_arbetstid"],
  "linked_tasks": ["task_risk_assessment"],
  "compliance_status": "needs_attention"
}
```

#### File Object
```typescript
interface FileContext {
  type: "file";
  file_id: string;
  filename: string;
  file_type: string; // MIME type
  file_size: number; // bytes
  uploaded_date: string; // ISO 8601
  uploaded_by: string; // User ID
  folder_path: string; // e.g., "Anställningskontrakt/2024"
  linked_laws: string[]; // Law IDs this file relates to
  linked_tasks: string[]; // Task IDs this file is evidence for
  linked_employees: string[]; // Employee IDs if applicable
  extracted_text: string; // Full text from PDF/DOCX
  ocr_applied: boolean; // True if scanned PDF
  tags: string[]; // User-defined tags
}
```

**Example:**
```json
{
  "type": "file",
  "file_id": "file_789",
  "filename": "Anställningskontrakt_Anna.pdf",
  "file_type": "application/pdf",
  "file_size": 524288,
  "uploaded_date": "2024-01-10T09:15:00Z",
  "uploaded_by": "user_123",
  "folder_path": "Anställningskontrakt/2024",
  "linked_laws": ["law_anstallningsskydd"],
  "linked_tasks": ["task_review_contracts"],
  "linked_employees": ["emp_anna"],
  "extracted_text": "ANSTÄLLNINGSAVTAL\n\nMellan...",
  "ocr_applied": false,
  "tags": ["byggnadsarbetare", "2024"]
}
```

#### Task Object
```typescript
interface TaskContext {
  type: "task";
  task_id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done";
  priority: "high" | "medium" | "low";
  created_date: string; // ISO 8601
  deadline: string | null;
  assigned_to: string | null; // Employee ID
  linked_laws: string[]; // Law IDs this task addresses
  linked_employees: string[]; // Affected employees
  linked_files: string[]; // Evidence files
  column: "backlog" | "todo" | "in_progress" | "done";
}
```

**Example:**
```json
{
  "type": "task",
  "task_id": "task_xyz",
  "title": "Conduct annual risk assessment",
  "description": "Review all construction sites for safety hazards per Arbetsmiljölagen 3:2a",
  "status": "in_progress",
  "priority": "high",
  "created_date": "2024-01-05T14:20:00Z",
  "deadline": "2024-02-15",
  "assigned_to": "user_123",
  "linked_laws": ["law_arbetsmiljo"],
  "linked_employees": ["emp_anna", "emp_erik"],
  "linked_files": ["file_risk_template"],
  "column": "in_progress"
}
```

---

### Maximum Context Limits

**Component limit:** 10 components max
**Reasoning:**
- Prevents context window overflow (GPT-4 Turbo: 128k tokens)
- Maintains response quality (too much context → generic answers)
- UX clarity (10 pills fit in sidebar without scrolling)

**When limit reached:**
```
User tries to drag 11th component → Warning appears:
"⚠️ Maximum 10 components. Remove one before adding another."
```

**Auto-prioritization (Post-MVP):**
AI could suggest: "Your context is full. Shall I remove the oldest component (📋 GDPR) to make room?"

---

## RAG Implementation

### Architecture Overview

```
┌──────────────┐
│  User Query  │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ Generate Embedding   │ ← OpenAI text-embedding-3-large
│ (1536-dim vector)    │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────────────┐
│ Vector Search (Supabase)     │ ← pgvector similarity search
│ Retrieve top 10 chunks       │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│ (Optional) Rerank Chunks     │ ← Cohere Rerank or cross-encoder
│ Sort by relevance            │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│ Inject into System Prompt    │
│ + Component Context          │
│ + Conversation History       │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│ LLM (GPT-4 Turbo)            │ ← Vercel AI SDK streamText
│ Generate Response            │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│ Stream to Client             │ ← Vercel AI SDK useChat
│ Render with Citations        │
└──────────────────────────────┘
```

---

### Semantic Chunking Strategy

#### Law Content (SFS Documents)

**Chunk by:** Article/Paragraph with section headers

**Example: Arbetsmiljölagen**
```
Chunk 1:
---
Law: Arbetsmiljölagen (1977:1160)
Chapter: 3 - Allmänna skyldigheter för arbetsgivare
Section: 2a §
---
Arbetsgivaren skall systematiskt planera, leda och kontrollera
verksamheten på ett sätt som leder till att arbetsmiljön uppfyller
föreskrivna krav på en god arbetsmiljö. Arbetsgivaren skall
undersöka arbetsförhållandena och bedöma de risker för ohälsa
och olycksfall som finns i verksamheten (riskbedömning).
---
Tokens: 87
Previous section: 3:2 (Arbetsmiljö och arbetstid)
Next section: 3:3 (Utbildning och information)
```

**Metadata stored:**
```typescript
interface LawChunk {
  id: string;
  law_id: string;
  law_name: string; // "Arbetsmiljölagen (1977:1160)"
  law_category: string; // "Labor Law"
  chapter: string | null; // "3"
  chapter_title: string | null; // "Allmänna skyldigheter..."
  section: string | null; // "2a"
  chunk_text: string; // Full text
  chunk_index: number; // Order in document
  token_count: number;
  embedding: number[]; // 1536-dim vector
  effective_date: string; // ISO 8601
  amendment_date: string | null;
  is_current: boolean; // False if superseded by amendment
  previous_section: string | null; // "3:2"
  next_section: string | null; // "3:3"
}
```

**Chunk size:**
- Target: **500-800 tokens** (~375-600 words)
- Max: **1000 tokens**
- Overlap: **50-100 tokens** (include context from adjacent sections)

**Why this approach:**
- Swedish laws are structured by article/paragraph → natural boundaries
- Users cite laws by section (e.g., "3:2a") → matches mental model
- Section headers provide semantic context

---

#### User Documents (Contracts, Policies, Risk Assessments)

**Chunk by:** Semantic sections (LLM-based chunking)

**Tool:** LangChain `SemanticChunker` or custom GPT-4 chunking

**Why:** User documents lack structured article numbering

**Example: Employment Contract**
```
Chunk 1:
---
Document: Anställningskontrakt_Anna.pdf
Section: 1. Parter och anställningsform
---
Detta anställningsavtal träffas mellan:

Arbetsgivare: Bygg AB (org.nr 556123-4567)
Adress: Storgatan 1, 123 45 Stockholm

Arbetstagare: Anna Svensson (personnr 900101-1234)
Adress: Lillgatan 5, 123 45 Stockholm

Anställningsform: Tillsvidareanställning med provanställning
Provanställningstid: 3 månader
---
Tokens: 92
```

**Metadata stored:**
```typescript
interface DocumentChunk {
  id: string;
  file_id: string;
  filename: string;
  section_title: string | null; // "1. Parter och anställningsform"
  chunk_text: string;
  chunk_index: number;
  token_count: number;
  embedding: number[];
  uploaded_date: string;
  linked_laws: string[]; // Laws referenced in this chunk
  linked_employees: string[];
}
```

---

### Vector Database: Supabase pgvector

**Setup:**
```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Law chunks table
CREATE TABLE law_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  law_id UUID REFERENCES laws(id) ON DELETE CASCADE,
  law_name TEXT NOT NULL,
  law_category TEXT,
  chapter TEXT,
  chapter_title TEXT,
  section TEXT,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  token_count INTEGER NOT NULL,
  embedding vector(1536), -- OpenAI embedding dimension
  effective_date TIMESTAMPTZ NOT NULL,
  amendment_date TIMESTAMPTZ,
  is_current BOOLEAN DEFAULT TRUE,
  previous_section TEXT,
  next_section TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vector similarity index (HNSW for performance)
CREATE INDEX law_chunks_embedding_idx
  ON law_chunks
  USING hnsw (embedding vector_cosine_ops);

-- Full-text search index (for hybrid search)
CREATE INDEX law_chunks_text_idx
  ON law_chunks
  USING gin(to_tsvector('swedish', chunk_text));
```

**Query function:**
```sql
CREATE OR REPLACE FUNCTION match_law_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_law_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  law_name text,
  chapter text,
  section text,
  chunk_text text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    law_chunks.id,
    law_chunks.law_name,
    law_chunks.chapter,
    law_chunks.section,
    law_chunks.chunk_text,
    1 - (law_chunks.embedding <=> query_embedding) AS similarity
  FROM law_chunks
  WHERE
    (filter_law_ids IS NULL OR law_chunks.law_id = ANY(filter_law_ids))
    AND is_current = TRUE
    AND 1 - (law_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY law_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

**TypeScript query:**
```typescript
import { createClient } from '@supabase/supabase-js';
import { embedQuery } from './openai'; // OpenAI embedding function

async function retrieveRelevantChunks(
  query: string,
  filterLawIds?: string[],
  limit = 10
) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  // Generate embedding for query
  const queryEmbedding = await embedQuery(query);

  // Vector search
  const { data, error } = await supabase.rpc('match_law_chunks', {
    query_embedding: queryEmbedding,
    match_threshold: 0.7,
    match_count: limit,
    filter_law_ids: filterLawIds || null,
  });

  if (error) throw error;

  return data;
}
```

---

### Embedding Generation

**Model:** OpenAI `text-embedding-3-large` (1536 dimensions)

**Why:**
- Best-in-class for multilingual (Swedish support)
- Stable API, no maintenance
- Cost: $0.13 per 1M tokens (cheap for ~1M law chunks)

**Implementation:**
```typescript
import { openai } from '@ai-sdk/openai';

export async function embedQuery(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: text,
    encoding_format: 'float',
  });

  return response.data[0].embedding;
}

export async function embedChunks(chunks: string[]): Promise<number[][]> {
  // Batch embedding (max 2048 inputs per request)
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: chunks,
    encoding_format: 'float',
  });

  return response.data.map((item) => item.embedding);
}
```

**Batch processing for law ingestion:**
```typescript
async function ingestLawDocument(lawId: string, lawText: string) {
  // 1. Chunk the law text
  const chunks = await chunkLawText(lawText);

  // 2. Generate embeddings in batches of 100
  const batchSize = 100;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const embeddings = await embedChunks(batch.map((c) => c.text));

    // 3. Insert into Supabase
    const records = batch.map((chunk, idx) => ({
      law_id: lawId,
      law_name: chunk.lawName,
      law_category: chunk.category,
      chapter: chunk.chapter,
      section: chunk.section,
      chunk_text: chunk.text,
      chunk_index: i + idx,
      token_count: chunk.tokenCount,
      embedding: embeddings[idx],
      effective_date: chunk.effectiveDate,
      is_current: true,
    }));

    await supabase.from('law_chunks').insert(records);
  }
}
```

---

### Hybrid Search (Optional Post-MVP Enhancement)

**Combine vector search + keyword search for better recall**

```typescript
async function hybridSearch(
  query: string,
  filterLawIds?: string[],
  limit = 10
) {
  // 1. Vector search
  const vectorResults = await retrieveRelevantChunks(query, filterLawIds, limit);

  // 2. Keyword search (PostgreSQL full-text search)
  const { data: keywordResults } = await supabase
    .from('law_chunks')
    .select('*')
    .textSearch('chunk_text', query, {
      type: 'websearch',
      config: 'swedish',
    })
    .limit(limit);

  // 3. Merge and deduplicate
  const mergedResults = [...vectorResults, ...keywordResults];
  const uniqueResults = Array.from(
    new Map(mergedResults.map((r) => [r.id, r])).values()
  );

  // 4. Rerank by RRF (Reciprocal Rank Fusion)
  return rerankByRRF(uniqueResults, vectorResults, keywordResults);
}

function rerankByRRF(
  combined: Chunk[],
  vectorResults: Chunk[],
  keywordResults: Chunk[]
) {
  const k = 60; // RRF constant
  const scores = new Map<string, number>();

  combined.forEach((chunk) => {
    let score = 0;

    const vectorRank = vectorResults.findIndex((r) => r.id === chunk.id);
    if (vectorRank !== -1) score += 1 / (k + vectorRank + 1);

    const keywordRank = keywordResults.findIndex((r) => r.id === chunk.id);
    if (keywordRank !== -1) score += 1 / (k + keywordRank + 1);

    scores.set(chunk.id, score);
  });

  return combined.sort((a, b) => (scores.get(b.id) || 0) - (scores.get(a.id) || 0));
}
```

---

### Reranking (Optional Post-MVP Enhancement)

**Tool:** Cohere Rerank API or cross-encoder model

**Why:** Vector search retrieves semantically similar chunks, but reranking improves precision by considering query-chunk interaction.

**Implementation:**
```typescript
import { CohereClient } from 'cohere-ai';

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

async function rerankChunks(query: string, chunks: Chunk[]) {
  const response = await cohere.rerank({
    model: 'rerank-multilingual-v3.0',
    query,
    documents: chunks.map((c) => c.chunk_text),
    topN: 10,
  });

  return response.results.map((result) => ({
    ...chunks[result.index],
    relevanceScore: result.relevance_score,
  }));
}
```

**Cost:** $2 per 1000 searches (Cohere Rerank)
**Use case:** High-stakes queries where precision matters (e.g., contract analysis)

---

## Context Awareness System

### Page-Based Context Injection

**The AI knows what page the user is on and auto-includes relevant context.**

**Implementation:**
```typescript
// Client: Send current page context with each query
const { messages, input, handleSubmit } = useChat({
  api: '/api/chat',
  body: {
    pageContext: {
      type: 'law_page',
      lawId: 'law_abc123',
      lawName: 'Arbetsmiljölagen (1977:1160)',
    },
    componentContext: contextPills, // Dragged components
  },
});
```

**Server: Inject page context into system prompt**
```typescript
// app/api/chat/route.ts
export async function POST(req: Request) {
  const { messages, pageContext, componentContext } = await req.json();

  let systemPrompt = BASE_SYSTEM_PROMPT;

  // Add page-specific context
  if (pageContext?.type === 'law_page') {
    systemPrompt += `\n\nThe user is currently viewing: ${pageContext.lawName}`;
    systemPrompt += `\nFocus your answers on this law unless the user asks about something else.`;
  }

  if (pageContext?.type === 'employee_page') {
    systemPrompt += `\n\nThe user is viewing employee: ${pageContext.employeeName}`;
    systemPrompt += `\nProvide compliance information relevant to this employee's role and training.`;
  }

  // Add component context (dragged cards)
  if (componentContext?.length > 0) {
    systemPrompt += `\n\nComponents in context:`;
    componentContext.forEach((comp: any) => {
      systemPrompt += `\n- ${comp.type}: ${comp.name || comp.filename}`;
    });
    systemPrompt += `\n\nUse this context to provide specific, actionable answers.`;
  }

  // Continue with RAG retrieval and LLM call...
}
```

---

### Context Pills Display

**Visual representation of active context:**

```tsx
// components/ChatContextPills.tsx
export function ChatContextPills({ context, onRemove }: Props) {
  return (
    <div className="flex flex-wrap gap-2 p-3 bg-muted/50 border-b">
      {context.map((item) => (
        <Badge
          key={item.id}
          variant="secondary"
          className="flex items-center gap-1"
        >
          {getIcon(item.type)}
          <span className="text-xs">{item.name}</span>
          <button
            onClick={() => onRemove(item.id)}
            className="ml-1 hover:text-destructive"
          >
            ×
          </button>
        </Badge>
      ))}
      {context.length >= 10 && (
        <Badge variant="destructive">Max context reached</Badge>
      )}
    </div>
  );
}

function getIcon(type: string) {
  switch (type) {
    case 'law_card':
      return '📋';
    case 'employee_card':
      return '👤';
    case 'file':
      return '📄';
    case 'task':
      return '✅';
    default:
      return '📎';
  }
}
```

---

## Citations & Source Attribution

### Citation Format

**Every AI claim must include a numbered citation with hover tooltip and clickable link.**

**Example response:**
```
Enligt Arbetsmiljölagen 3:2a¹ ska arbetsgivaren systematiskt
undersöka arbetsförhållandena och bedöma risker.

Riskbedömningen ska dokumenteras² och uppdateras när
förändringar sker i verksamheten.

[¹] Arbetsmiljölagen (1977:1160) 3 kap. 2a §
    "Arbetsgivaren skall systematiskt planera, leda och
    kontrollera verksamheten på ett sätt som leder till
    att arbetsmiljön uppfyller föreskrivna krav..."
    [Visa hela paragrafen →]

[²] AFS 2001:1 § 7 - Systematiskt arbetsmiljöarbete
    "Arbetsgivaren ska dokumentera riskbedömningar,
    åtgärder och uppföljning..."
    [Visa föreskrift →]
```

---

### Implementation

**Step 1: LLM generates response with citation markers**

**System prompt:**
```
When referencing laws or documents, ALWAYS include numbered citations like [¹], [²].

At the end of your response, provide a "Sources" section with full citations:

Example:
According to Arbetsmiljölagen 3:2a[¹], employers must...

Sources:
[¹] Arbetsmiljölagen (1977:1160) 3 kap. 2a §
    Quote: "Arbetsgivaren skall systematiskt planera..."
    Chunk ID: chunk_abc123
```

**Step 2: Parse citations on client**

```typescript
// lib/parseCitations.ts
export function parseCitationsFromText(text: string) {
  const citationRegex = /\[(\d+)\]/g;
  const sourcesRegex = /Sources:\n([\s\S]+)/;

  // Extract inline citation numbers
  const inlineCitations = [...text.matchAll(citationRegex)].map((m) => m[1]);

  // Extract sources section
  const sourcesMatch = text.match(sourcesRegex);
  const sources = sourcesMatch ? parseSourcesSection(sourcesMatch[1]) : [];

  return { inlineCitations, sources };
}

function parseSourcesSection(sourcesText: string) {
  // Parse each [¹] block into structured data
  const sourceBlocks = sourcesText.split(/\n\[(\d+)\]/);
  const sources = [];

  for (let i = 1; i < sourceBlocks.length; i += 2) {
    const number = sourceBlocks[i];
    const content = sourceBlocks[i + 1];

    const lawNameMatch = content.match(/^(.+?)\n/);
    const quoteMatch = content.match(/Quote: "(.+?)"/);
    const chunkIdMatch = content.match(/Chunk ID: (\S+)/);

    sources.push({
      number,
      lawName: lawNameMatch?.[1]?.trim(),
      quote: quoteMatch?.[1],
      chunkId: chunkIdMatch?.[1],
    });
  }

  return sources;
}
```

**Step 3: Render citations with hover tooltips**

```tsx
// components/ChatMessage.tsx
export function ChatMessage({ message }: { message: Message }) {
  const { inlineCitations, sources } = parseCitationsFromText(message.content);

  return (
    <div className="message">
      <MessageText
        text={message.content}
        citations={inlineCitations}
        sources={sources}
      />
    </div>
  );
}

function MessageText({ text, citations, sources }: Props) {
  // Replace [¹] with hoverable citation component
  const parts = text.split(/(\[\d+\])/);

  return (
    <div>
      {parts.map((part, idx) => {
        const citationMatch = part.match(/\[(\d+)\]/);
        if (citationMatch) {
          const citationNumber = citationMatch[1];
          const source = sources.find((s) => s.number === citationNumber);

          return (
            <HoverCard key={idx}>
              <HoverCardTrigger>
                <sup className="citation-link">{part}</sup>
              </HoverCardTrigger>
              <HoverCardContent className="w-80">
                <div className="space-y-2">
                  <h4 className="font-semibold">{source?.lawName}</h4>
                  <p className="text-sm text-muted-foreground">
                    "{source?.quote}"
                  </p>
                  <Button variant="link" asChild>
                    <Link href={`/laws/${source?.chunkId}`}>
                      Visa hela paragrafen →
                    </Link>
                  </Button>
                </div>
              </HoverCardContent>
            </HoverCard>
          );
        }
        return <span key={idx}>{part}</span>;
      })}
    </div>
  );
}
```

---

### Clickable Links to Law Sections

**Each citation links directly to the law page, scrolled to the relevant section.**

**URL format:**
```
/laws/arbetsmiljolagen-1977-1160?section=3-2a
```

**Implementation:**
```typescript
// app/laws/[slug]/page.tsx
export default function LawPage({ params, searchParams }: Props) {
  const section = searchParams.section; // e.g., "3-2a"

  useEffect(() => {
    if (section) {
      const element = document.getElementById(`section-${section}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element?.classList.add('highlight-section'); // Yellow highlight effect
    }
  }, [section]);

  // Render law content with section anchors
  return (
    <div>
      <h1>{law.name}</h1>
      {law.chapters.map((chapter) =>
        chapter.sections.map((sec) => (
          <section
            key={sec.id}
            id={`section-${sec.number}`}
            className="law-section"
          >
            <h3>{sec.number} §</h3>
            <p>{sec.text}</p>
          </section>
        ))
      )}
    </div>
  );
}
```

**CSS for highlight effect:**
```css
.highlight-section {
  background-color: rgba(250, 204, 21, 0.2);
  border-left: 4px solid #facc15;
  padding-left: 1rem;
  animation: fadeHighlight 3s ease-out;
}

@keyframes fadeHighlight {
  0% {
    background-color: rgba(250, 204, 21, 0.4);
  }
  100% {
    background-color: rgba(250, 204, 21, 0.1);
  }
}
```

---

## File Upload & Analysis

### Upload Workflow

**Method 1: Drag file from desktop into chat**

```
User drags PDF → Drop zone highlights → File uploads →
AI analysis begins → Context pill appears
```

**Method 2: Click upload button**

```
User clicks 📎 → File picker opens → User selects PDF →
File uploads → AI analysis begins
```

**Method 3: Drag from Mina Filer**

```
User drags file from Mina Filer → Already uploaded →
AI receives file context immediately
```

---

### File Processing Pipeline

```typescript
// app/api/chat/upload-file/route.ts
export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  const userId = getCurrentUserId(); // From auth

  // 1. Validate file
  const validation = validateFile(file);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // 2. Upload to storage (Supabase Storage or S3)
  const fileId = generateId();
  const filePath = `users/${userId}/chat-uploads/${fileId}_${file.name}`;
  await supabase.storage.from('files').upload(filePath, file);

  // 3. Extract text
  let extractedText = '';
  if (file.type === 'application/pdf') {
    extractedText = await extractPdfText(file);
    // If scanned (low text confidence), apply OCR
    if (extractedText.length < 100) {
      extractedText = await applyOCR(file);
    }
  } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    extractedText = await extractDocxText(file);
  } else if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    extractedText = await extractXlsxText(file);
  }

  // 4. Store in Mina Filer database
  const { data: fileRecord } = await supabase.from('files').insert({
    id: fileId,
    user_id: userId,
    filename: file.name,
    file_type: file.type,
    file_size: file.size,
    file_path: filePath,
    extracted_text: extractedText,
    folder_path: 'Chat Uploads', // Auto-folder for chat uploads
    uploaded_date: new Date().toISOString(),
  }).select().single();

  // 5. Return file context for chat
  return NextResponse.json({
    file: {
      type: 'file',
      file_id: fileId,
      filename: file.name,
      file_type: file.type,
      extracted_text: extractedText,
      uploaded_date: fileRecord.uploaded_date,
    },
  });
}
```

---

### Text Extraction

**PDF (native text):**
```typescript
import { getDocument } from 'pdfjs-dist';

async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: arrayBuffer }).promise;

  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += pageText + '\n\n';
  }

  return fullText;
}
```

**PDF (scanned with OCR):**
```typescript
import Tesseract from 'tesseract.js';

async function applyOCR(file: File): Promise<string> {
  const { data: { text } } = await Tesseract.recognize(file, 'swe', {
    logger: (m) => console.log(m), // Progress logging
  });

  return text;
}
```

**Alternative: AWS Textract (Post-MVP for higher accuracy):**
```typescript
import { TextractClient, AnalyzeDocumentCommand } from '@aws-sdk/client-textract';

async function extractWithTextract(file: File): Promise<string> {
  const client = new TextractClient({ region: 'eu-north-1' });
  const arrayBuffer = await file.arrayBuffer();

  const command = new AnalyzeDocumentCommand({
    Document: { Bytes: new Uint8Array(arrayBuffer) },
    FeatureTypes: ['TABLES', 'FORMS'],
  });

  const response = await client.send(command);

  // Parse blocks into text
  const text = response.Blocks
    ?.filter((b) => b.BlockType === 'LINE')
    .map((b) => b.Text)
    .join('\n');

  return text || '';
}
```

**DOCX:**
```typescript
import mammoth from 'mammoth';

async function extractDocxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}
```

**XLSX:**
```typescript
import * as XLSX from 'xlsx';

async function extractXlsxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  let text = '';
  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    text += `Sheet: ${sheetName}\n`;
    text += XLSX.utils.sheet_to_csv(sheet) + '\n\n';
  });

  return text;
}
```

---

### File Size Limits

**Max file size for AI analysis:** 30 MB

**Reasoning:**
- Fits in LLM context window (GPT-4 Turbo: 128k tokens ≈ 96k words)
- 30 MB PDF ≈ 10,000 pages (most contracts are <100 pages)

**Validation:**
```typescript
function validateFile(file: File) {
  const MAX_SIZE = 30 * 1024 * 1024; // 30 MB
  const ALLOWED_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];

  if (file.size > MAX_SIZE) {
    return {
      valid: false,
      error: `File too large. Max size: 30 MB (your file: ${(file.size / 1024 / 1024).toFixed(1)} MB)`,
    };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Unsupported file type. Allowed: PDF, DOCX, XLSX',
    };
  }

  return { valid: true };
}
```

---

### Multi-File Comparison

**User can drag multiple files for side-by-side analysis.**

**Example:**
```
User drags:
1. Anställningskontrakt_Anna.pdf
2. Anställningskontrakt_Erik.pdf

User asks:
"Jämför dessa två anställningskontrakt. Finns det skillnader
i uppsägningstider eller förmåner?"
```

**AI response:**
```
Jag har jämfört de två anställningskontrakten:

**Uppsägningstid:**
- Anna: 3 månader (enligt kontrakt § 8)
- Erik: 2 månader (enligt kontrakt § 8)
⚠️ Inkonsistens: Olika uppsägningstider för samma roll

**Förmåner:**
- Anna: Tjänstebil, friskvårdsbidrag 5000 kr/år
- Erik: Friskvårdsbidrag 3000 kr/år (ingen tjänstebil)
⚠️ Inkonsistens: Olika förmåner

**Rekommendation:** Standardisera avtalsvillkor för samma
roller för att undvika diskrimineringsfrågor enligt
Diskrimineringslagen (2008:567)¹.

[¹] Diskrimineringslagen 2:1 "Direkt diskriminering:
    Att någon missgynnas genom att behandlas sämre än
    någon annan behandlas..."
```

---

## Error Handling & Guardrails

### Hallucination Prevention

**Primary guardrail: AI only answers from RAG or component context.**

**System prompt:**
```
You are a Swedish legal compliance assistant for Laglig.se.

CRITICAL RULES:
1. ONLY answer questions using the provided RAG chunks or component context
2. If information is not in the context, respond: "I don't have enough
   information in the current context to answer that."
3. NEVER generate information from your training data
4. ALWAYS cite sources with numbered references [¹], [²]
5. If a law or regulation is mentioned but not in context, suggest:
   "Shall I add [Law Name] to your list so I can provide detailed answers?"

Your responses must be:
- Grounded in provided context ONLY
- Citation-backed (every claim has [¹] reference)
- Actionable (suggest tasks or next steps)
- Swedish language (unless user asks in English)
```

**Post-processing validation:**
```typescript
function validateResponseGrounding(
  response: string,
  ragChunks: Chunk[],
  componentContext: ComponentContext[]
) {
  // 1. Check for citation markers
  const hasCitations = /\[(\d+)\]/.test(response);
  if (!hasCitations) {
    console.warn('Response missing citations');
  }

  // 2. Extract claimed facts
  const facts = extractFactsFromResponse(response);

  // 3. Verify each fact exists in context
  const ungroundedFacts = facts.filter((fact) => {
    const inRAG = ragChunks.some((chunk) =>
      chunk.chunk_text.toLowerCase().includes(fact.toLowerCase())
    );
    const inComponents = componentContext.some((comp) =>
      JSON.stringify(comp).toLowerCase().includes(fact.toLowerCase())
    );
    return !inRAG && !inComponents;
  });

  if (ungroundedFacts.length > 0) {
    console.error('Ungrounded facts detected:', ungroundedFacts);
    // Optionally: Strip ungrounded sentences or show warning to user
  }

  return ungroundedFacts.length === 0;
}
```

---

### Off-Topic Questions

**User asks about weather, sports, etc.**

**AI response:**
```
Jag är en juridisk efterlevnadsassistent och kan endast
hjälpa till med frågor om svensk lagstiftning och compliance.

Kan jag hjälpa dig med något relaterat till dina laglistor,
HR-efterlevnad, eller riskbedömningar?
```

**Implementation:**
```typescript
// System prompt addition
If the user asks off-topic questions (weather, sports, general knowledge),
politely decline and redirect:

"I'm a legal compliance assistant and can only help with Swedish law and
compliance questions. Can I help you with your law lists, HR compliance,
or risk assessments?"
```

---

### Missing Context Suggestions

**User asks about a law not in their lists or context.**

**Example:**
```
User: "Vilka krav har Livsmedelslagen för restauranger?"

AI: "Jag har inte Livsmedelslagen (2006:804) i din
nuvarande kontext eller laglistor.

Vill du att jag lägger till Livsmedelslagen så att
jag kan ge dig detaljerade svar?

[Lägg till Livsmedelslagen] [Nej, tack]"
```

**If user clicks "Lägg till":**
```typescript
// AI generates add-to-list action
const action = {
  type: 'add_law_to_list',
  law_id: 'law_livsmedel',
  law_name: 'Livsmedelslagen (2006:804)',
  target_list: 'default', // Or user selects specific list
};

// User confirms → tRPC mutation
await trpc.lawLists.addLaw.mutate({
  listId: userDefaultListId,
  lawId: action.law_id,
});

// Chat updates
<SystemMessage>
  ✅ Livsmedelslagen tillagd i din lista "Min huvudlista".
  Fråga igen så kan jag nu ge dig detaljerade svar!
</SystemMessage>
```

---

### Rate Limiting (TBD)

**To prevent abuse and control costs.**

**Proposed tiers:**
- **Basic:** 50 queries/day
- **Pro:** 500 queries/day
- **Enterprise:** Unlimited

**Implementation (Redis token bucket):**
```typescript
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export async function checkRateLimit(userId: string): Promise<boolean> {
  const key = `rate_limit:${userId}`;
  const limit = getUserQueryLimit(userId); // 50, 500, or Infinity
  const window = 24 * 60 * 60; // 24 hours in seconds

  const current = await redis.incr(key);

  if (current === 1) {
    // First request, set expiration
    await redis.expire(key, window);
  }

  return current <= limit;
}

async function handleChatQuery(userId: string, query: string) {
  const allowed = await checkRateLimit(userId);

  if (!allowed) {
    return {
      error: 'Rate limit exceeded',
      message: 'Du har nått din dagliga gräns för AI-frågor. Uppgradera till Pro för fler frågor.',
      upgradeUrl: '/pricing',
    };
  }

  // Process query...
}
```

---

### Content Moderation

**Detect offensive, illegal, or inappropriate input.**

**Tool:** OpenAI Moderation API

```typescript
import { openai } from '@ai-sdk/openai';

export async function moderateInput(text: string): Promise<boolean> {
  const response = await openai.moderations.create({ input: text });

  const flagged = response.results[0].flagged;

  if (flagged) {
    console.warn('Flagged input:', response.results[0].categories);
  }

  return flagged;
}

// In chat route
const isFlagged = await moderateInput(userQuery);
if (isFlagged) {
  return NextResponse.json({
    error: 'Inappropriate content detected',
    message: 'Vänligen skriv en respektfull fråga relaterad till lagefterlevnad.',
  });
}
```

---

## Chat History & Persistence

### Database Schema

```sql
-- Chats table
CREATE TABLE chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT, -- Auto-generated from first message
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,
  component_context JSONB, -- Dragged components at time of message
  rag_chunks_used JSONB, -- Which chunks were retrieved for this response
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX chat_messages_chat_id_idx ON chat_messages(chat_id);
CREATE INDEX chats_user_id_idx ON chats(user_id);
```

---

### Saving Messages

```typescript
// app/api/chat/route.ts
export async function POST(req: Request) {
  const { messages, chatId, componentContext } = await req.json();
  const userId = getCurrentUserId();

  // 1. Get or create chat
  let chat;
  if (chatId) {
    chat = await supabase.from('chats').select('*').eq('id', chatId).single();
  } else {
    // New chat
    const title = generateChatTitle(messages[0].content); // First message
    const { data } = await supabase.from('chats').insert({
      user_id: userId,
      title,
    }).select().single();
    chat = data;
  }

  // 2. Save user message
  await supabase.from('chat_messages').insert({
    chat_id: chat.id,
    role: 'user',
    content: messages[messages.length - 1].content,
    component_context: componentContext,
  });

  // 3. Generate AI response
  const ragChunks = await retrieveRelevantChunks(messages[messages.length - 1].content);
  const aiResponse = await generateAIResponse(messages, ragChunks, componentContext);

  // 4. Save assistant message
  await supabase.from('chat_messages').insert({
    chat_id: chat.id,
    role: 'assistant',
    content: aiResponse.text,
    rag_chunks_used: ragChunks,
  });

  // 5. Stream response to client
  return new StreamingResponse(aiResponse.stream);
}
```

---

### Loading Chat History

```typescript
// app/api/chat/[chatId]/route.ts
export async function GET(req: Request, { params }: { params: { chatId: string } }) {
  const userId = getCurrentUserId();

  // Fetch chat with messages
  const { data: chat } = await supabase
    .from('chats')
    .select(`
      *,
      messages:chat_messages(*)
    `)
    .eq('id', params.chatId)
    .eq('user_id', userId) // Security: only user's own chats
    .single();

  return NextResponse.json({ chat });
}
```

**Client:**
```tsx
// components/ChatInterface.tsx
export function ChatInterface({ chatId }: { chatId?: string }) {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (chatId) {
      // Load existing chat
      fetch(`/api/chat/${chatId}`)
        .then((res) => res.json())
        .then((data) => setMessages(data.chat.messages));
    }
  }, [chatId]);

  const { messages: liveMessages, input, handleSubmit } = useChat({
    api: '/api/chat',
    initialMessages: messages,
    body: { chatId },
  });

  return <ChatUI messages={liveMessages} input={input} onSubmit={handleSubmit} />;
}
```

---

### Chat List Sidebar

**Show recent chats in sidebar for quick access.**

```tsx
// components/ChatSidebar.tsx
export function ChatSidebar() {
  const { data: chats } = trpc.chats.list.useQuery();

  return (
    <div className="w-64 border-r">
      <Button onClick={() => createNewChat()}>+ Ny Chat</Button>
      <div className="space-y-1 mt-4">
        {chats?.map((chat) => (
          <Link
            key={chat.id}
            href={`/dashboard?chat=${chat.id}`}
            className="block p-2 hover:bg-muted rounded"
          >
            <div className="font-medium truncate">{chat.title}</div>
            <div className="text-xs text-muted-foreground">
              {formatRelativeTime(chat.updated_at)}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

---

### Retention Policy

**Chats stored for 365 days, then auto-deleted.**

**Cron job:**
```typescript
// app/api/cron/cleanup-old-chats/route.ts
export async function GET(req: Request) {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const { data: deletedChats } = await supabase
    .from('chats')
    .delete()
    .lt('created_at', oneYearAgo.toISOString())
    .select('id');

  console.log(`Deleted ${deletedChats?.length} old chats`);

  return NextResponse.json({ deleted: deletedChats?.length });
}
```

**Vercel Cron (vercel.json):**
```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup-old-chats",
      "schedule": "0 2 * * *"
    }
  ]
}
```

---

## AI Task & Law Generation

### Task Generation Workflow

**AI suggests creating a task based on conversation.**

**Example:**
```
User: "Vi saknar en riskbedömning för byggarbetare"

AI: "Enligt Arbetsmiljölagen 3:2a¹ måste ni göra en
riskbedömning för alla arbetsuppgifter.

Vill du att jag skapar en uppgift för detta?

[Ja, skapa uppgift] [Nej, tack]"
```

**User clicks "Ja, skapa uppgift"**

**AI generates task JSON:**
```json
{
  "type": "create_task",
  "task": {
    "title": "Genomför riskbedömning för byggarbetare",
    "description": "Enligt Arbetsmiljölagen 3:2a ska arbetsgivaren systematiskt undersöka arbetsförhållandena och bedöma risker för ohälsa och olycksfall.",
    "priority": "high",
    "deadline": "2024-03-15", // 30 days from now
    "linked_laws": ["law_arbetsmiljo"],
    "linked_employees": ["emp_anna", "emp_erik"],
    "status": "todo",
    "column": "backlog"
  }
}
```

**User confirms → Task created:**
```tsx
// Client: Handle task creation confirmation
const handleTaskCreation = async (taskData: GeneratedTask) => {
  const confirmed = await confirm('Skapa denna uppgift?');
  if (!confirmed) return;

  await trpc.tasks.create.mutate(taskData);

  // Show success message in chat
  appendSystemMessage('✅ Uppgift skapad: "Genomför riskbedömning för byggarbetare"');
};
```

**Task appears in Kanban board immediately.**

---

### Law Addition Workflow

**AI suggests adding a law to user's list.**

**Example:**
```
User: "Vad säger dataskyddsförordningen om cookies?"

AI: "Jag har inte GDPR (Dataskyddsförordningen) i din
nuvarande laglistor.

Vill du att jag lägger till GDPR så att jag kan ge
detaljerade svar om cookies och samtycke?

[Lägg till GDPR] [Nej, tack]"
```

**User clicks "Lägg till GDPR"**

**AI adds law to default list:**
```typescript
await trpc.lawLists.addLaw.mutate({
  listId: user.defaultListId,
  lawId: 'law_gdpr',
});

// Chat updates
appendSystemMessage('✅ GDPR tillagd i "Min huvudlista". Fråga igen!');
```

**User asks again:**
```
User: "Nu kan du svara: Vad säger GDPR om cookies?"

AI: "Enligt GDPR Artikel 6¹ och ePrivacy-direktivet²,
cookies kräver uttryckligt samtycke från användare...

[Details with full citations]"
```

---

### Implementation with Vercel AI SDK Tools

**Vercel AI SDK supports "tools" (function calling) for structured actions.**

```typescript
// app/api/chat/route.ts
import { streamText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = await streamText({
    model: openai('gpt-4-turbo'),
    messages,
    tools: {
      createTask: tool({
        description: 'Create a compliance task for the user',
        parameters: z.object({
          title: z.string().describe('Task title'),
          description: z.string().describe('Detailed task description'),
          priority: z.enum(['high', 'medium', 'low']),
          deadline: z.string().optional().describe('ISO 8601 date'),
          linkedLaws: z.array(z.string()).describe('Law IDs related to task'),
          linkedEmployees: z.array(z.string()).optional(),
        }),
        execute: async (params) => {
          // Create task in database
          const task = await createTask({
            ...params,
            userId: getCurrentUserId(),
          });

          return {
            success: true,
            taskId: task.id,
            message: `✅ Uppgift skapad: "${params.title}"`,
          };
        },
      }),

      addLawToList: tool({
        description: 'Add a law to the user\'s law list',
        parameters: z.object({
          lawId: z.string(),
          lawName: z.string(),
          listId: z.string().optional().describe('Defaults to user\'s main list'),
        }),
        execute: async (params) => {
          const listId = params.listId || getUserDefaultListId();
          await addLawToList(listId, params.lawId);

          return {
            success: true,
            message: `✅ ${params.lawName} tillagd i din laglista`,
          };
        },
      }),
    },
  });

  return result.toAIStreamResponse();
}
```

**Client automatically handles tool calls:**
```tsx
const { messages, input, handleSubmit } = useChat({
  api: '/api/chat',
  // Tool results automatically integrated into conversation
});
```

---

## Chat Summarization & Export

### Summarization Trigger

**Button appears after 5+ messages:**

```tsx
{messages.length >= 5 && (
  <Button onClick={handleSummarize} variant="outline">
    📄 Sammanfatta denna konversation
  </Button>
)}
```

---

### Summarization Logic

```typescript
// app/api/chat/[chatId]/summarize/route.ts
export async function POST(req: Request, { params }: Props) {
  const { chatId } = params;

  // 1. Fetch full conversation
  const { data: messages } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true });

  // 2. Generate summary with GPT-4
  const summary = await generateSummary(messages);

  // 3. Return summary
  return NextResponse.json({ summary });
}

async function generateSummary(messages: Message[]) {
  const conversationText = messages
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n\n');

  const prompt = `
Summarize this legal compliance conversation in Swedish.

Format:
# [Topic Title]
**Datum:** [Date]

## Frågor som diskuterades
- [Question 1]
- [Question 2]

## Viktiga fynd
- ✅ [Compliant item]
- ⚠️ [Needs attention]
- ❌ [Non-compliant]

## Rekommenderade åtgärder
1. [Action 1]
2. [Action 2]

## Refererade dokument
- [Document 1]
- [Document 2]

## Refererade lagar
- [Law 1]
- [Law 2]

Conversation:
${conversationText}
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages: [{ role: 'user', content: prompt }],
  });

  return response.choices[0].message.content;
}
```

---

### Export Formats

**1. PDF Export**

```typescript
import { jsPDF } from 'jspdf';

export function exportSummaryToPDF(summary: string, chatTitle: string) {
  const doc = new jsPDF();

  // Add company logo
  // doc.addImage(logoBase64, 'PNG', 10, 10, 30, 30);

  // Add title
  doc.setFontSize(18);
  doc.text(chatTitle, 50, 20);

  // Add summary
  doc.setFontSize(11);
  const lines = doc.splitTextToSize(summary, 180);
  doc.text(lines, 10, 50);

  // Add footer
  doc.setFontSize(8);
  doc.text('Genererad av Laglig.se AI Chat', 10, 280);

  // Download
  doc.save(`${chatTitle}_sammanfattning.pdf`);
}
```

**2. Markdown Export**

```typescript
export function exportSummaryToMarkdown(summary: string, chatTitle: string) {
  const blob = new Blob([summary], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${chatTitle}_sammanfattning.md`;
  a.click();

  URL.revokeObjectURL(url);
}
```

**3. Email Export (Post-MVP)**

```typescript
import { Resend } from 'resend';

export async function emailSummary(
  summary: string,
  chatTitle: string,
  recipientEmail: string
) {
  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: 'Laglig.se <noreply@laglig.se>',
    to: recipientEmail,
    subject: `Chat-sammanfattning: ${chatTitle}`,
    html: `
      <h1>${chatTitle}</h1>
      <div>${marked(summary)}</div>
      <hr>
      <p><small>Genererad av Laglig.se AI Chat</small></p>
    `,
  });
}
```

---

## Technical Implementation

### Vercel AI SDK Architecture

**The entire chat system is built on Vercel AI SDK for streaming and tool calling.**

```
┌─────────────────────────────────────┐
│         Client (React)              │
│  ┌───────────────────────────────┐  │
│  │  useChat() hook               │  │
│  │  - Manages messages state     │  │
│  │  - Handles streaming          │  │
│  │  - Auto-scrolls chat          │  │
│  └───────────────────────────────┘  │
└─────────────┬───────────────────────┘
              │ POST /api/chat
              ▼
┌─────────────────────────────────────┐
│    Server (Next.js Route Handler)   │
│  ┌───────────────────────────────┐  │
│  │  streamText() from Vercel SDK │  │
│  │  - RAG chunk injection        │  │
│  │  - Component context          │  │
│  │  - Tool definitions           │  │
│  │  - System prompt              │  │
│  └───────────────────────────────┘  │
└─────────────┬───────────────────────┘
              │ OpenAI API call
              ▼
┌─────────────────────────────────────┐
│         OpenAI GPT-4 Turbo          │
│  - Generates response               │
│  - Calls tools if needed            │
│  - Streams tokens back              │
└─────────────┬───────────────────────┘
              │ Streaming response
              ▼
┌─────────────────────────────────────┐
│         Client renders stream       │
│  - Word-by-word display             │
│  - Parse citations                  │
│  - Render hover tooltips            │
└─────────────────────────────────────┘
```

---

### Client Implementation

```tsx
// components/ChatInterface.tsx
'use client';

import { useChat } from 'ai/react';
import { useState } from 'react';

export function ChatInterface({ chatId }: { chatId?: string }) {
  const [contextPills, setContextPills] = useState<ComponentContext[]>([]);

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    body: {
      chatId,
      componentContext: contextPills,
    },
    onFinish: (message) => {
      // Message complete, save to database
      console.log('AI response finished:', message);
    },
  });

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const componentData = JSON.parse(e.dataTransfer.getData('application/json'));

    if (contextPills.length >= 10) {
      alert('Maximum 10 components in context');
      return;
    }

    setContextPills([...contextPills, componentData]);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Context Pills */}
      <ChatContextPills context={contextPills} onRemove={(id) => {
        setContextPills(contextPills.filter((c) => c.id !== id));
      }} />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        {isLoading && <TypingIndicator />}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t p-4">
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed p-2 rounded"
        >
          <textarea
            value={input}
            onChange={handleInputChange}
            placeholder="Skriv din fråga om lagefterlevnad..."
            className="w-full resize-none"
            rows={3}
          />
        </div>
        <Button type="submit" disabled={isLoading}>
          Skicka
        </Button>
      </form>
    </div>
  );
}
```

---

### Server Implementation

```typescript
// app/api/chat/route.ts
import { streamText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

export async function POST(req: Request) {
  const { messages, chatId, componentContext } = await req.json();
  const userId = getCurrentUserId();

  // 1. Retrieve relevant law chunks via RAG
  const lastMessage = messages[messages.length - 1];
  const ragChunks = await retrieveRelevantChunks(lastMessage.content);

  // 2. Build system prompt with context
  const systemPrompt = buildSystemPrompt(ragChunks, componentContext);

  // 3. Stream response
  const result = await streamText({
    model: openai('gpt-4-turbo'),
    system: systemPrompt,
    messages,
    tools: {
      createTask: tool({
        description: 'Create a compliance task',
        parameters: z.object({
          title: z.string(),
          description: z.string(),
          priority: z.enum(['high', 'medium', 'low']),
          linkedLaws: z.array(z.string()),
        }),
        execute: async (params) => {
          const task = await createTask({ ...params, userId });
          return { success: true, taskId: task.id };
        },
      }),

      addLawToList: tool({
        description: 'Add a law to user\'s list',
        parameters: z.object({
          lawId: z.string(),
          lawName: z.string(),
        }),
        execute: async (params) => {
          await addLawToList(userId, params.lawId);
          return { success: true };
        },
      }),
    },
    onFinish: async ({ text }) => {
      // Save assistant message to database
      await saveChatMessage({
        chatId,
        role: 'assistant',
        content: text,
        ragChunksUsed: ragChunks,
      });
    },
  });

  return result.toAIStreamResponse();
}

function buildSystemPrompt(
  ragChunks: Chunk[],
  componentContext: ComponentContext[]
) {
  let prompt = `You are a Swedish legal compliance assistant for Laglig.se.

CRITICAL RULES:
1. ONLY answer using provided RAG chunks or component context
2. If information missing, say: "I don't have enough information..."
3. ALWAYS cite sources with [¹], [²]
4. Respond in Swedish unless asked in English

`;

  // Add RAG chunks
  if (ragChunks.length > 0) {
    prompt += `\n\nRelevant law sections:\n`;
    ragChunks.forEach((chunk, idx) => {
      prompt += `\n[${idx + 1}] ${chunk.law_name} ${chunk.chapter}:${chunk.section}\n`;
      prompt += `${chunk.chunk_text}\n`;
    });
  }

  // Add component context
  if (componentContext.length > 0) {
    prompt += `\n\nComponents in context:\n`;
    componentContext.forEach((comp) => {
      prompt += `\n${comp.type}: ${JSON.stringify(comp, null, 2)}\n`;
    });
  }

  return prompt;
}
```

---

## Post-MVP Features

### 1. Voice Chat

**User speaks questions instead of typing.**

**Implementation:**
- Browser Web Speech API or OpenAI Whisper API
- Voice input button in chat
- Transcript appears as text message
- AI responds with text (optional: text-to-speech for response)

---

### 2. AI Agents with External Search

**AI can browse external sources for latest case law, government updates, etc.**

**Critical constraint:** External sources MUST be flagged and cannot be basis for decisions without RAG support.

**Example:**
```
User: "Har det kommit nya domar om distansarbete?"

AI: "Jag söker på external källor...

🌐 Extern källa: Arbetsdomstolen dom 2024:12
'Arbetsgivare får inte ensidigt kräva återgång till kontor
om distansarbete varit praxis'

⚠️ OBS: Detta är från en extern källa och inte verifierad
mot Laglig.se:s lagdatabas. Vill du att jag lägger till
detta som en referens i dina noteringar för Arbetsmiljölagen?

För juridiskt bindande svar, kontakta alltid en jurist."
```

**Implementation:**
```typescript
// Tool: External web search
externalSearch: tool({
  description: 'Search external sources (only when RAG insufficient)',
  parameters: z.object({
    query: z.string(),
  }),
  execute: async ({ query }) => {
    const results = await searchWeb(query); // Tavily, Perplexity, etc.
    return {
      results,
      disclaimer: 'External source - not verified against Laglig.se database',
    };
  },
}),
```

---

### 3. Multi-Lingual Support

**User can ask questions in English about Swedish laws.**

**Example:**
```
User: "What does Arbetsmiljölagen require for remote work?"

AI: "According to Arbetsmiljölagen (Work Environment Act) 3:2a¹,
employers must assess risks even for remote work environments..."
```

**Implementation:** GPT-4 natively supports multilingual, just detect user language and respond accordingly.

---

### 4. AI-Generated Compliance Reports

**User:** "Generate an audit report for my compliance with Arbetsmiljölagen"

**AI generates:**
```markdown
# Arbetsmiljölagen Compliance Audit Report
**Företag:** Bygg AB
**Datum:** 2024-01-20
**Granskad av:** Laglig.se AI

## Sammanfattning
Ni uppfyller 7 av 10 granskade krav från Arbetsmiljölagen.

## Detaljerad Bedömning

### ✅ Uppfyllda krav (7)
1. Systematiskt arbetsmiljöarbete dokumenterat (3:1a)
2. Skyddsombud utsett (6:1)
...

### ⚠️ Behöver åtgärdas (3)
1. Riskbedömning för arbete på hög höjd saknas (3:2a)
   - **Åtgärd:** Genomför riskbedömning inom 30 dagar
   - **Ansvarig:** [Tilldelad person]
...

## Bilagor
- [Länk till riskbedömningsmall]
- [Länk till arbetsplatsinspektionsprotokoll]

---
*Denna rapport är genererad av Laglig.se AI och bör granskas
av en kvalificerad arbetsmiljöexpert eller jurist innan beslut tas.*
```

**Export as PDF with ISO-compliant audit trail formatting.**

---

### 5. Proactive Weekly Digests

**Every Monday, AI emails user:**

```
Hej [Name]!

Här är vad som hänt med dina lagar denna vecka:

🔔 Nya ändringar (2)
- Arbetsmiljölagen: Ny föreskrift om distansarbete (2024-01-15)
- GDPR: EU-kommissionen uppdaterade cookiestandard (2024-01-17)

📋 Uppgifter att göra (5)
- Genomför riskbedömning för byggarbetare (deadline: 2024-02-01)
- Uppdatera GDPR-policy (deadline: 2024-02-15)
...

📈 Teamaktivitet
- Anna Svensson slutförde Första hjälpen-utbildning ✅
- Erik Johansson: Arbetsmiljöutbildning kvarstår ⚠️

Logga in på Laglig.se för att se detaljer.

Mvh,
Laglig.se AI
```

---

## Success Metrics

**How do we measure if the AI Chat is successful?**

### Product Metrics
- **Usage:** % of active users who use chat weekly
- **Engagement:** Average messages per session
- **Retention:** Users who return to chat within 7 days
- **Feature adoption:** % of users who drag components into chat

### Quality Metrics
- **Citation rate:** % of responses with valid citations (target: 100%)
- **Hallucination rate:** % of responses flagged as ungrounded (target: <1%)
- **User satisfaction:** Thumbs up/down on responses (target: >85% positive)

### Business Metrics
- **Task creation:** # of tasks created via AI suggestions
- **Law additions:** # of laws added via AI recommendations
- **Upsell:** % of Basic users who upgrade after hitting query limits

---

## Conclusion

The AI Chat Interface is Laglig.se's core differentiator. By combining:
- **RAG-powered grounding** (zero hallucinations)
- **Multi-component context streaming** (UX moat)
- **Citation-first architecture** (trust & credibility)
- **Vercel AI SDK** (fast, modern implementation)

...we create a legal AI assistant that competitors (Notisum, Karnov) cannot easily replicate.

**Next steps:**
1. Implement RAG pipeline (law chunking, embedding, vector search)
2. Build drag-and-drop component streaming
3. Develop citation parsing and hover tooltips
4. Integrate Vercel AI SDK with tool calling
5. Launch MVP with 3 core conversation patterns

---

**Document End**
