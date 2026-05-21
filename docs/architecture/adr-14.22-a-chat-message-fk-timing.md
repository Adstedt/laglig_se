# ADR-14.22-A: `PendingAgentAction.chat_message_id` FK-Timing Resolution

**Status:** Accepted · **Author:** Winston (Architect) · **Date:** 2026-05-21
**Drives:** Story 14.22 (AC 22 / 22a / Task 6 rewrite) and the whole 14.23–14.31 agent-approval-card stack.

---

## 1. Context

Story 14.22 AC 22a assumed the assistant `ChatMessage` is persisted **server-side in `app/api/chat/route.ts` `onFinish`** using a preallocated UUID, so a `PendingAgentAction` row created mid-tool-loop could safely FK to it. A freshness re-validation (2026-05-21) found that assumption is false against the live code:

- `app/api/chat/route.ts` `onFinish` writes **only** `ChatUsageEvent` + `WorkspaceUsage` — no `ChatMessage`.
- The assistant `ChatMessage` is persisted **client-side**, in the `useChat` `onFinish` callback, via `saveChatMessage({ role: 'ASSISTANT', ... })` (`lib/hooks/use-chat-interface.ts`).
- `saveChatMessage` does not accept an `id`; `prisma.chatMessage.create` defaults `@default(uuid())` (`app/actions/ai-chat.ts`).
- The AI SDK request-body `messageId` is the **last user-message id**, not a preallocated assistant id. The assistant id is generated client-side **after** the stream finishes and never reaches the server.

So during the tool loop there is **no assistant-message id in existence anywhere** — a pending row created in `create_task` (`execute:false`) would have nothing valid to point at. The problem is **ordering**: tools run inside `streamText` (before `onFinish`), so a pending insert precedes any `onFinish`-time `ChatMessage` write.

## 2. Decision

**Write a stub `ChatMessage` row before the tool loop.** `route.ts` generates `assistantMessageId = randomUUID()`, **inserts a minimal `ChatMessage` (that id, `content: ''`, current conversation/context scope) BEFORE invoking `streamText()`**, threads the id into `createAgentTools(workspaceId, userId, { assistantMessageId })`, and emits it as the stream's assistant message id so the client reconciles. In `onFinish`, the stub is **updated** with final content + metadata, in the same `$transaction` as the existing usage writes. The client's assistant-message `saveChatMessage` call is **removed** (server becomes the sole writer). The `chat_message_id` FK stays **non-null, `onDelete: Cascade`** — no nullability, no deferral.

## 3. Rationale

- **Beats "preallocate + write only in onFinish" (the literal AC 22a):** even with a preallocated id, the `ChatMessage` written in `onFinish` lands *after* the mid-loop pending insert — the FK still dangles. A stub written before `streamText()` is the only point that strictly dominates every tool execution.
- **Is not the rejected reconcile-later approach (story Dev Notes):** `chat_message_id` is never null/invalid — the FK target exists before the pending row does. Only the stub's *content* column (no FK depends on it; 14.23's `pending-actions:by-message` batch query never reads it) is filled later. The invariant is *strengthened*, not relaxed.
- **Server-canonical (A) over client-threaded (B):** B keeps the FK valid only if the client's `saveChatMessage` runs before the tool's pending insert — it provably runs after (client `onFinish` is post-stream). B reintroduces the dangling-FK race; making it safe requires a server stub anyway, defeating B's point.
- **Double-write avoidance:** server owns the assistant row; the client's assistant-save is removed. One writer. (The client's *user*-message save is unaffected.)
- **Regeneration / edit (14.19, later):** server mints the id and the SDK start-chunk carries it to the client, so client/server agree with no fixup. A regenerate = new turn = new stub id = new pending scope; `onDelete: Cascade` cleans up.
- **14.23–14.31 cascade:** a single pre-loop stub satisfies every later write tool; 14.23's per-message grouping and 14.24's IN_EDITOR draft inherit the guarantee for free.

## 4. Concrete Implementation Guidance

```
route.ts POST
  1. assistantMessageId = randomUUID()
  2. prisma.chatMessage.create({ id: assistantMessageId, role: ASSISTANT, content: '',
       context_*, conversation_id, workspace_id, user_id })          ← STUB, before stream
  3. tools = createAgentTools(workspaceId, userId, { assistantMessageId })
  4. streamText({ ... tools ... })
        └─ create_task(execute:false) → PendingAgentAction.create({ chat_message_id: assistantMessageId })  ✅ FK valid
  5. toUIMessageStreamResponse() emits start-chunk carrying assistantMessageId → client message.id reconciles
  6. onFinish → prisma.chatMessage.update({ where:{id:assistantMessageId}, data:{ content, metadata } }) + usage writes (same $transaction)
client useChat.onFinish
  7. DELETE the saveChatMessage('ASSISTANT', ...) call — server now owns it
```

**File-level changes:**
- **`prisma/schema.prisma`** — `PendingAgentAction` as AC 1–4 specify; `chat_message_id String` (non-null) `@relation(..., onDelete: Cascade)`; inverse `pending_agent_actions` on `ChatMessage`. `content @db.Text` already accepts `''` — stub legal, no schema change.
- **`app/api/chat/route.ts`** — mint id; insert stub before `streamText` (skip for the `'default'` workspace fallback, mirroring the existing usage-write guard); pass `{ assistantMessageId }` to `createAgentTools`; set the response message id to `assistantMessageId`; in `onFinish` `update` the stub in the same `$transaction` as usage writes.
- **`app/actions/ai-chat.ts`** — USER-path `saveChatMessage` unchanged; assistant path no longer called from client; do NOT add an `id` param. Add a `content != ''` filter to `getChatHistory` so aborted-stream stubs don't render as empty bubbles.
- **`lib/agent/tools/index.ts`** — `createAgentTools(workspaceId, userId, context?: { assistantMessageId })`; thread into write-tool factories; read tools ignore it.
- **`lib/agent/tools/create-task.ts`** — on `execute:false`, create the pending row with `chat_message_id: context.assistantMessageId`; include `{ pendingActionId }` in `WriteToolResponse.data`.
- **`lib/hooks/use-chat-interface.ts`** — remove the assistant-message `saveChatMessage` block; verify the SDK reconciles `message.id` to the server start-chunk id.

## 5. Risks & Follow-ups

- **Aborted/errored streams leave empty stubs** → `getChatHistory` must filter `content != ''` (without it, empty bubbles render).
- **Stub insert latency** — one indexed INSERT before `streamText`; negligible vs. model TTFT; do not transaction-wrap it with the stream.
- **`workspaceId === 'default'` fallback** — skip the stub (FK to a non-existent workspace would fail); gate as the existing `onFinish` usage-write branch does.
- **AI SDK id authority** — server must set the stream's assistant message id to `assistantMessageId` so the client's optimistic id is overwritten; required for 14.19 regeneration correlation.
- **Double-submit / retries** — `randomUUID()` per request → unique stub per turn; no collision.

## 6. Impact on Story 14.22 (applied 2026-05-21)

AC 22a replaced (stub-before-loop); AC 22 amended; Dev Notes "Rejected alternative" annotated to distinguish this ruling; Task 6.1 / 6.2 rewritten; Task 6.7 (remove client assistant-save + set stream id) and Task 6.8 (`getChatHistory` stub filter) added; AC 1 / Data Models confirm FK stays non-null `onDelete: Cascade` (no nullability/deferral).
