# Epic 3: RAG-Powered AI Chat Interface (DETAILED)

**Goal:** Implement zero-hallucination AI chatbot with drag-and-drop context building, citation-first responses, and streaming UI.

**Value Delivered:** Users can ask legal questions and receive accurate, cited answers grounded in Swedish law + drag-and-drop UX makes AI contextual and powerful.

---

## Story 3.1: Set Up Vector Database (pgvector + Embeddings)

**As a** developer,
**I want** to embed all 10,000+ laws into a vector database,
**so that** the AI can perform semantic similarity search for RAG.

**Acceptance Criteria:**

1. pgvector extension enabled in Supabase PostgreSQL
2. New table `law_embeddings` created with fields: id, law_id, chunk_text, embedding (vector(1536)), metadata
3. Semantic chunking script implemented (500-800 tokens per chunk)
4. Script chunks all 10,000+ laws, generates embeddings using OpenAI `text-embedding-3-small`
5. Embeddings stored in database (estimated 50,000-100,000 chunks total)
6. Vector index created for fast similarity search (HNSW or IVFFlat)
7. Script handles rate limits (max 1,000 requests/minute)
8. Progress logging: "Embedded 1,000/10,000 laws..."
9. Script completes in <8 hours
10. Test query: "What are employee rights during sick leave?" returns relevant chunks

---

## Story 3.2: Implement RAG Query Pipeline

**As a** developer,
**I want** to build a RAG pipeline that retrieves relevant law chunks and generates answers,
**so that** the AI chatbot can respond accurately to user questions.

**Acceptance Criteria:**

1. API endpoint created: `POST /api/chat/query`
2. Request body: `{ query: string, context?: string[] }`
3. Pipeline steps:
   - Generate embedding for user query
   - Perform vector similarity search (retrieve top 10 chunks)
   - Construct prompt with system instructions + retrieved chunks + user query
   - Call OpenAI GPT-4 or Anthropic Claude
   - Return response with citations
4. System prompt enforces: "ONLY answer from provided chunks, cite sources, else say 'I don't have enough information'"
5. Response format: `{ answer: string, citations: [{ law_id, sfs_number, title, chunk_text }] }`
6. RAG accuracy tested with 20 sample questions (manual review: >90% grounded answers)
7. Query latency <3 seconds end-to-end
8. Error handling: LLM timeout, no relevant chunks found
9. Logging: User query, retrieved chunks, LLM response

---

## Story 3.3: Build AI Chat UI with Streaming Responses

**As a** user,
**I want** to type a legal question and see the AI response stream in real-time,
**so that** I get fast, engaging answers.

**Acceptance Criteria:**

1. AI Chat sidebar component created (fixed right side, 400px width)
2. Chat interface includes: message history, input field, send button
3. User types question, clicks Send
4. Message appears in chat history immediately
5. AI response streams word-by-word using Vercel AI SDK `useChat` hook
6. Streaming animation (typing indicator while waiting)
7. Citations appear inline: `[1]`, `[2]` with hover tooltips showing source law
8. Citation tooltip includes: law title, SFS number, snippet, "View law" link
9. Chat history persisted in workspace (requires Epic 5 for multi-tenancy)
10. Mobile: Chat sidebar converts to full-screen modal
11. Keyboard shortcut: `Cmd+K` or `/` opens chat

---

## Story 3.4: Implement Drag-and-Drop for Law Cards into Chat

**As a** user,
**I want** to drag law cards from my law list into the chat,
**so that** the AI can answer questions specifically about those laws.

**Acceptance Criteria:**

1. Law cards made draggable using `@dnd-kit` or `react-beautiful-dnd`
2. Chat input area is a drop zone
3. User drags law card into chat → card converts to "context pill" above input field
4. Context pill displays: law title, "X" button to remove
5. When user sends message, backend includes law_id in context
6. RAG pipeline retrieves chunks ONLY from specified laws (not full database)
7. Visual feedback: Drop zone highlights on hover, smooth animation on drop
8. Max 10 context items to prevent overload
9. Context persists across chat messages (stays until manually removed)
10. Mobile: Tap law card → "Add to chat context" button → pill appears

---

## Story 3.5: Implement Drag-and-Drop for Employee Cards into Chat

**As a** user,
**I want** to drag employee cards into chat,
**so that** the AI can answer HR questions specific to that employee.

**Acceptance Criteria:**

1. Employee cards (from HR Module Epic 7) made draggable
2. Dragging employee card into chat adds context pill
3. Context pill displays: employee name, role, "X" to remove
4. Backend includes employee metadata in RAG prompt: role, employment type, contract date, assigned kollektivavtal
5. Example query: "What are [Employee Name]'s vacation rights?" → AI considers their specific kollektivavtal
6. Context persists until removed
7. Visual feedback: Drop zone highlights, smooth animation
8. Mobile: Tap employee → "Add to chat context"
9. Privacy: Only users with HR Manager or Admin role can drag employee cards (role check in Epic 5)

---

## Story 3.6: Implement Drag-and-Drop for Task Cards into Chat

**As a** user,
**I want** to drag compliance task cards into chat,
**so that** the AI can help me understand or complete that task.

**Acceptance Criteria:**

1. Task cards (from Kanban Epic 6) made draggable
2. Dragging task card into chat adds context pill
3. Context pill displays: task title, "X" to remove
4. Backend includes task metadata in RAG prompt: task description, linked law, status
5. Example query: "How do I complete this task?" → AI explains based on linked law
6. Context persists until removed
7. Visual feedback: Drop zone highlights, animation
8. Mobile: Tap task → "Add to chat context"

---

## Story 3.7: Implement Drag-and-Drop for Files into Chat (Kollektivavtal PDFs)

**As a** user,
**I want** to drag uploaded kollektivavtal PDFs into chat,
**so that** the AI can answer questions from that specific agreement.

**Acceptance Criteria:**

1. File upload feature (from HR Module Epic 7) allows PDF uploads
2. Uploaded PDFs chunked and embedded into vector database (separate from laws)
3. File cards made draggable
4. Dragging file into chat adds context pill
5. Context pill displays: filename, "X" to remove
6. RAG pipeline searches both law embeddings AND file embeddings
7. Citations distinguish between laws and uploaded files
8. Example query: "What does our kollektivavtal say about overtime?" → AI searches uploaded PDF
9. File embeddings tagged with workspace_id for multi-tenancy
10. Mobile: Tap file → "Add to chat context"

---

## Story 3.8: Implement AI Component Streaming (Law Cards, Task Suggestions)

**As a** user,
**I want** the AI to suggest law cards or tasks directly in the chat,
**so that** I can take action without leaving the conversation.

**Acceptance Criteria:**

1. LLM prompt includes tool/function calling for components
2. AI can stream back components: `law_card`, `task_suggestion`, `employee_suggestion`
3. Frontend renders streamed components as interactive cards in chat
4. Law card includes: title, category, "Add to list" button
5. Task suggestion includes: title, description, "Create task" button
6. Clicking "Add to list" adds law to user's workspace (requires Epic 5)
7. Clicking "Create task" opens task creation modal (requires Epic 6)
8. Component streaming uses Vercel AI SDK tool calling
9. Example: User asks "What HR laws apply to restaurants?" → AI streams 5 law cards
10. Mobile-responsive component rendering

---

## Story 3.9: Add Citation Verification and Hallucination Detection

**As a** product owner,
**I want** to verify that AI responses are grounded in retrieved chunks,
**so that** we minimize hallucinations and maintain trust.

**Acceptance Criteria:**

1. Backend logs every AI response with: query, retrieved chunks, LLM response
2. Post-processing script checks if answer contains claims not in retrieved chunks
3. Hallucination detection uses simple keyword matching (v1) or LLM-based verification (v2)
4. If hallucination detected, flag response for manual review
5. Dashboard shows hallucination rate: Target <5%
6. Prompt engineering iteration to reduce hallucinations
7. System instruction enforced: "If you cannot answer from provided sources, respond 'I don't have enough information to answer that question.'"
8. Test with 50 edge case questions (manual review confirms >95% grounded)

---

## Story 3.10: Implement Chat History and Session Management

**As a** user,
**I want** my chat history saved,
**so that** I can reference previous conversations.

**Acceptance Criteria:**

1. Chat messages stored in `chat_messages` table: id, workspace_id, user_id, role (user/assistant), content, created_at
2. Chat sidebar loads last 20 messages on open
3. Infinite scroll to load older messages
4. Messages grouped by date ("Today", "Yesterday", "Last week")
5. User can delete individual messages or clear entire history
6. Chat history scoped to workspace (multi-tenancy in Epic 5)
7. Search within chat history (keyword search)
8. Export chat history as PDF or text file
9. Privacy: Chat history deleted if workspace deleted (Epic 5 soft-delete cascade)

---

## Story 3.11: Optimize AI API Costs with Caching

**As a** product owner,
**I want** to cache AI responses for common queries,
**so that** we reduce OpenAI API costs.

**Acceptance Criteria:**

1. Response caching implemented using Redis or Vercel KV
2. Cache key: hash of query + context (law_ids)
3. Cache hit → Return cached response (skip LLM call)
4. Cache miss → Call LLM, store response in cache
5. Cache TTL: 7 days
6. Cache invalidation: When law content changes
7. Analytics tracking: Cache hit rate target >50%
8. Cost tracking: AI API costs per query logged
9. Dashboard shows: Daily API costs, cache hit rate, queries per tier
10. Optimization: Cheaper embedding model if cost/query >€0.10

---

## Story 3.12: Add Legal Disclaimer and AI Response Warnings

**As a** product owner,
**I want** to display legal disclaimers prominently,
**so that** users understand AI guidance is not legal advice.

**Acceptance Criteria:**

1. First-time chat users see disclaimer modal before sending first message
2. Disclaimer text: "AI-assisted guidance, not legal advice. Consult a lawyer for specific situations."
3. User must click "I understand" to proceed
4. Disclaimer shown in footer of every chat message (small text)
5. AI responses include warning for high-risk topics (e.g., termination, discrimination): "⚠️ Consider consulting a lawyer for this matter"
6. High-risk topic detection via keyword matching (expandable list)
7. Terms of Service updated to include AI usage terms
8. Legal review of disclaimer language (external lawyer review recommended)

---

**Epic 3 Complete: 12 stories, 3-4 weeks estimated**

---
