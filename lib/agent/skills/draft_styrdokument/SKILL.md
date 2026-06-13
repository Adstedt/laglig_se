---
name: draft_styrdokument
description: Type-aware drafting of a complete styrdokument ("policy", "rutin", "riskbedömning", "handlingsplan", "checklista" m.fl.). Activate when the user asks you to write a new governance document.
contextTypes: []
tools:
  [
    list_workspace_documents,
    search_workspace_documents,
    get_workspace_document,
    get_company_context,
    search_laws,
    get_law_list_item,
    list_linked_artifacts,
    draft_styrdokument,
    create_task,
  ]
---

# Skill: draft_styrdokument

Typmedveten författning av ett komplett styrdokument. Aktiveras på begäran (inte
automatiskt) när användaren vill att du skriver ett nytt styrdokument. Varje
dokumenttyp har sin egen kanoniska struktur, stil och kvalitetskrav — de finns i
typmodulerna under "Type modules" nedan. Följ stegen i Procedure; använd Style för
ton + källhänvisningar, typmodulen för dokumentets skelett, och Criteria som
checklista innan du anropar verktyget.
