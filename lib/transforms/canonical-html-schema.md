# Canonical HTML Schema for Legal Documents

> **Version:** 1.0
> **Status:** Draft
> **Last updated:** 2026-02-18

This document defines the **canonical HTML structure** that all `html_content` in the `legal_documents` table must conform to. It is the single source of truth (SSOT) for all downstream derivations: `json_content`, `markdown_content`, `full_text`, content chunks, and embeddings.

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Document Wrapper](#2-document-wrapper)
3. [Document Header (lovhead)](#3-document-header-lovhead)
4. [Document Body](#4-document-body)
5. [Hierarchy Levels](#5-hierarchy-levels)
6. [Sections (§ / Artikel)](#6-sections--artikel)
7. [Content Paragraphs](#7-content-paragraphs)
8. [Allmänna råd (General Guidance)](#8-allmänna-råd-general-guidance)
9. [Tables](#9-tables)
10. [Lists](#10-lists)
11. [Footnotes](#11-footnotes)
12. [Group Headings (Rubriker)](#12-group-headings-rubriker)
13. [Preamble — Special Zone](#13-preamble--special-zone)
14. [Transition Provisions (Footer)](#14-transition-provisions-footer)
15. [Appendices (Bilagor)](#15-appendices-bilagor)
16. [Cross-References](#16-cross-references)
17. [ID Conventions](#17-id-conventions)
18. [Required vs Optional Elements](#18-required-vs-optional-elements)
19. [Content Type Conformance](#19-content-type-conformance)
20. [Complete Examples](#20-complete-examples)

---

## 1. Design Principles

1. **One schema, all content types.** SFS laws, SFS amendments, agency regulations, and EU documents all follow the same structure.
2. **HTML as SSOT.** `html_content` is the master field. JSON, markdown, plaintext, and chunks are all derived from it.
3. **Semantic classes, not styling.** Classes describe document semantics (`.kapitel`, `.paragraf`, `.allmanna-rad`), never visual appearance.
4. **Stable IDs for deep linking.** Every navigable element has a deterministic `id` attribute derived from the document number and structural position.
5. **Normalizers bring non-conforming content into line.** Rather than writing multiple downstream parsers, each ingestion source has a normalizer that produces canonical HTML.
6. **Idempotency.** Running a normalizer on already-canonical HTML produces identical output.

---

## 2. Document Wrapper

Every document is wrapped in a single `<article>` element:

```html
<article class="legal-document" id="{DOC_ID}">
  <div class="lovhead">...</div>
  <div class="preamble">...</div>
  <!-- optional -->
  <div class="body" id="{DOC_ID}_BODY0001">...</div>
  <div class="appendices">...</div>
  <!-- optional -->
  <footer class="back" id="{DOC_ID}_BACK0001">...</footer>
  <!-- optional -->
</article>
```

| Attribute | Value            | Notes                                                   |
| --------- | ---------------- | ------------------------------------------------------- |
| `class`   | `legal-document` | Content-type-agnostic. Replaces the legacy `sfs` class. |
| `id`      | `{DOC_ID}`       | See [ID Conventions](#17-id-conventions).               |

**Child element order** (all except `lovhead` are optional):

1. `div.lovhead` — always first
2. `div.preamble` — EU documents, some agency regs
3. `div.body` — main content
4. `div.appendices` — bilagor
5. `footer.back` — transition provisions

---

## 3. Document Header (lovhead)

```html
<div class="lovhead">
  <h1 id="{DOC_ID}_GENH0000">
    <p class="text">{DOCUMENT_NUMBER}</p>
    <p class="text">{TITLE}</p>
  </h1>
</div>
```

| Element           | Required | Notes                                                  |
| ----------------- | -------- | ------------------------------------------------------ |
| `div.lovhead`     | Yes      | Always present                                         |
| `h1`              | Yes      | Contains document number and title                     |
| `p.text` (first)  | Yes      | Document number (e.g., `SFS 2025:732`, `MSBFS 2020:1`) |
| `p.text` (second) | Yes      | Document title                                         |
| `h1[id]`          | Optional | `{DOC_ID}_GENH0000` — present in LLM-generated output  |

---

## 4. Document Body

```html
<div class="body" id="{DOC_ID}_BODY0001">
  <!-- Content follows one of three structural patterns -->
</div>
```

The body `id` attribute is optional (present in LLM-generated output, may be absent in normalized HTML).

---

## 5. Hierarchy Levels

The canonical schema supports three structural patterns:

### 5a. Flat (no chapters)

Sections appear directly inside `div.body`, with no chapter wrappers.

```html
<div class="body">
  <h3 class="paragraph">
    <a class="paragraf" id="{DOC_ID}_P1" name="{DOC_ID}_P1">1 §</a>
  </h3>
  <p class="text">...</p>

  <h3 class="paragraph">
    <a class="paragraf" id="{DOC_ID}_P2" name="{DOC_ID}_P2">2 §</a>
  </h3>
  <p class="text">...</p>
</div>
```

**Used by:** Short SFS laws, short agency regulations, standalone AFS documents.

### 5b. Chapters (2-level hierarchy)

The most common pattern. Chapters contain sections.

```html
<div class="body">
  <section class="kapitel" id="{DOC_ID}_K1">
    <h2 class="kapitel-rubrik">1 kap. Lagens tillämpningsområde</h2>

    <h3 class="paragraph">
      <a class="paragraf" id="{DOC_ID}_K1_P1" name="{DOC_ID}_K1_P1">1 §</a>
    </h3>
    <p class="text">...</p>
  </section>

  <section class="kapitel" id="{DOC_ID}_K2">
    <h2 class="kapitel-rubrik">2 kap. Arbetsgivarens skyldigheter</h2>
    <!-- sections... -->
  </section>
</div>
```

**Used by:** Most SFS laws, most agency regulations, EU regulations/directives.

### 5c. Avdelningar + Chapters (3-level hierarchy)

Some large Swedish regulations group chapters into Avdelningar (divisions).

```html
<div class="body">
  <section class="avdelning" id="{DOC_ID}_AVD1">
    <h2 class="avdelning-rubrik">Avdelning 1 Gemensamma bestämmelser</h2>

    <section class="kapitel" id="{DOC_ID}_K1">
      <h3 class="kapitel-rubrik">1 kap. Allmänna bestämmelser</h3>

      <h3 class="paragraph">
        <a class="paragraf" id="{DOC_ID}_K1_P1" name="{DOC_ID}_K1_P1">1 §</a>
      </h3>
      <p class="text">...</p>
    </section>

    <section class="kapitel" id="{DOC_ID}_K2">
      <h3 class="kapitel-rubrik">2 kap. Definitioner</h3>
      <!-- sections... -->
    </section>
  </section>

  <section class="avdelning" id="{DOC_ID}_AVD2">
    <h2 class="avdelning-rubrik">Avdelning 2 Fysikaliska riskkällor</h2>
    <!-- chapters... -->
  </section>
</div>
```

**Heading level rules when avdelningar are present:**

| Element           | Without avdelningar           | With avdelningar                     |
| ----------------- | ----------------------------- | ------------------------------------ |
| Avdelning heading | N/A                           | `<h2 class="avdelning-rubrik">`      |
| Chapter heading   | `<h2 class="kapitel-rubrik">` | `<h3 class="kapitel-rubrik">`        |
| Section (§)       | `<h3 class="paragraph">`      | `<h3 class="paragraph">` (unchanged) |

Note: `h3.paragraph` always holds §§ regardless of hierarchy depth. When avdelningar push chapter headings to `h3`, the section headings remain `h3` as well (they are distinguished by `class="paragraph"` vs `class="kapitel-rubrik"`).

**Used by:** AFS 2023:1 (Risker i arbetsmiljön), AFS 2023:2, AFS 2023:3, and other large AFS documents.

---

## 6. Sections (§ / Artikel)

A section represents a single § (paragraf) in Swedish law or an Article in EU law.

```html
<h3 class="paragraph" id="{DOC_ID}_K{N}_P{S}">
  <a class="paragraf" id="{DOC_ID}_K{N}_P{S}" name="{DOC_ID}_K{N}_P{S}"
    >{S} §</a
  >
</h3>
```

For EU articles:

```html
<h3 class="paragraph">
  <a class="paragraf" id="{DOC_ID}_art{N}" name="{DOC_ID}_art{N}"
    >Artikel {N} — {Title}</a
  >
</h3>
```

| Attribute                   | Notes                                        |
| --------------------------- | -------------------------------------------- |
| `class="paragraph"` on `h3` | Identifies this as a section heading         |
| `class="paragraf"` on `a`   | The navigable anchor for the section         |
| `id` on `a`                 | Semantic ID for deep linking                 |
| `name` on `a`               | Duplicate of `id` for backward compatibility |

**Section numbering variants:**

- Standard: `1`, `2`, `3`
- With letter suffixes: `2a`, `15b`
- EU articles: `art1`, `art2`

### Legacy wrapper elements (tolerated but not required)

The amendment LLM prompt produces Notisum-style wrappers:

```html
<section class="ann">
  <div class="element-body annzone">
    <h3 class="paragraph">...</h3>
    <p class="text">...</p>
  </div>
</section>
```

The canonical parser **tolerates** these wrappers (they are transparent — the parser looks for `h3.paragraph` and `p.text` at any nesting depth within a chapter). Normalizers are **not required** to add or remove them.

---

## 7. Content Paragraphs

All content paragraphs (stycken) use `<p class="text">`:

```html
<p class="text" id="{DOC_ID}_K{N}_P{S}_S1">First stycke text...</p>
<p class="text" id="{DOC_ID}_K{N}_P{S}_S2">Second stycke text...</p>
```

| Attribute                | Required | Notes                                                                      |
| ------------------------ | -------- | -------------------------------------------------------------------------- |
| `class="text"`           | Yes      | Identifies content paragraphs (vs structural/heading paragraphs)           |
| `id` with `_S{T}` suffix | Optional | Stycke-level IDs (present in LLM output, may be absent in normalized HTML) |

**What counts as `p.text`:**

- Paragraph body text within a §
- List item text: `<li><p class="text">...</p></li>`
- Transition provision text
- Allmänna råd body text

**What does NOT get `class="text"`:**

- `<p>` inside `div.lovhead > h1` (these already have `class="text"`)
- `<p>` inside `div.preamble` (special zone — opaque content)
- Headings and structural elements

---

## 8. Allmänna råd (General Guidance)

Agency regulations often include non-binding guidance sections:

```html
<div class="allmanna-rad">
  <p class="allmanna-rad-heading"><strong>Allmänna råd</strong></p>
  <p class="text">Guidance text goes here...</p>
  <p class="text">More guidance...</p>
</div>
```

Variant with section-specific heading (agency LLM output):

```html
<div class="allmanna-rad">
  <h4 class="allmanna-rad-rubrik">Allmänna råd till 2 kap. 3 §</h4>
  <p class="text">Guidance text...</p>
</div>
```

| Element            | Notes                                                       |
| ------------------ | ----------------------------------------------------------- |
| `div.allmanna-rad` | Container for guidance block                                |
| Heading element    | Either `p.allmanna-rad-heading` or `h4.allmanna-rad-rubrik` |
| `p.text` children  | Guidance body text                                          |

Both heading variants are valid canonical HTML. The parser should recognize either.

---

## 9. Tables

```html
<table class="legal-table">
  <thead>
    <tr>
      <th>Column 1</th>
      <th>Column 2</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Value 1</td>
      <td>Value 2</td>
    </tr>
  </tbody>
</table>
```

| Attribute                | Notes                                                                 |
| ------------------------ | --------------------------------------------------------------------- |
| `class="legal-table"`    | Identifies legal content tables (vs layout tables which are stripped) |
| Standard `thead`/`tbody` | Preserved as-is                                                       |

Tables appear inline within sections, after the relevant `p.text` elements.

---

## 10. Lists

### Numbered lists (decimal)

```html
<ol class="list" type="1">
  <li><p class="text">First item</p></li>
  <li><p class="text">Second item</p></li>
</ol>
```

### Letter lists (alphabetic)

```html
<ol class="list" type="a">
  <li><p class="text">Item a</p></li>
  <li><p class="text">Item b</p></li>
</ol>
```

### Unordered lists

```html
<ul class="list">
  <li><p class="text">Item</p></li>
</ul>
```

### Definition-style lists (unstyled)

```html
<ul class="list" style="list-style: none;">
  <li><p class="text">term i reference</p></li>
</ul>
```

| Attribute                   | Notes                                       |
| --------------------------- | ------------------------------------------- |
| `class="list"`              | On `ol` or `ul`                             |
| `type` attribute            | `"1"` for decimal, `"a"` for alphabetic     |
| `style="list-style: none;"` | Only exception to the no-inline-styles rule |
| `<li><p class="text">`      | Each list item wraps content in `p.text`    |

Lists can be nested (e.g., decimal list containing letter sub-list).

---

## 11. Footnotes

### Inline reference (in text)

```html
<sup class="footnote-ref" data-note="{N}" title="{FOOTNOTE_TEXT}">{N}</sup>
```

### Footnote content block (amendment/LLM style)

```html
<dl class="collapse footnote-content" id="{DOC_ID}.FOOTNOTE.{N}">
  <dt>{N})</dt>
  <dd><p class="text">Senaste lydelse 2023:456.</p></dd>
</dl>
```

Both inline-only (AFS transformer style) and inline+block (amendment LLM style) are valid. The parser should handle both.

---

## 12. Group Headings (Rubriker)

Non-§ headings within a chapter (thematic groupings):

```html
<section class="group ann N2">
  <h3 class="group" id="{DOC_ID}_GEN{N}">{GROUP TITLE}</h3>
  <div class="N2">
    <!-- Sections under this group -->
  </div>
</section>
```

Simpler variant (normalized output):

```html
<h3 id="{DOC_ID}_{slug}">{Group Title}</h3>
```

Both variants are valid. Group headings are informational — they organize content visually but do not create a new hierarchy level.

---

## 13. Preamble — Special Zone

**Preamble is a special zone.** Its internal content is **opaque** — it does not follow the `h3.paragraph > a.paragraf` pattern and is not decomposed into sections by the canonical parser.

```html
<div class="preamble">
  <!-- Opaque content — structure varies by content type -->
  <p>
    EUROPAPARLAMENTET OCH EUROPEISKA UNIONENS RÅD HAR ANTAGIT DENNA FÖRORDNING
  </p>
  <p>med beaktande av fördraget om Europeiska unionens funktionssätt...</p>
  <p>(1) First recital...</p>
  <p>(2) Second recital...</p>
</div>
```

| Content Type              | Preamble Content                                |
| ------------------------- | ----------------------------------------------- |
| EU Regulations/Directives | Legal basis, recitals, institutional references |
| Some agency regulations   | Bemyndigande (authorization basis)              |
| SFS Laws                  | Rarely present                                  |
| SFS Amendments            | Not applicable                                  |

The JSON schema stores preamble as a single opaque text block (or HTML string), not as structured sections. In the canonical JSON, preamble content receives the `PREAMBLE` content role.

---

## 14. Transition Provisions (Footer)

```html
<footer class="back" id="{DOC_ID}_BACK0001">
  <section class="in-force-info" id="{DOC_ID}_IN_FORCE_INFO0001">
    <h2>Ikraftträdande- och övergångsbestämmelser</h2>
    <dl class="in-force">
      <dt class="in-force" id="{DOC_ID}_IKRAFT-{AMENDMENT_ID}">
        <a class="change-sfs-nr" href="...">{AMENDMENT_NUMBER}</a>
      </dt>
      <dd class="in-force">
        <ol class="list" type="1">
          <li>
            <p class="text">Denna lag träder i kraft den 1 januari 2026.</p>
          </li>
        </ol>
      </dd>
    </dl>
  </section>
</footer>
```

Simpler variant (agency regulations, normalized output):

```html
<footer class="back">
  <h2>Övergångsbestämmelser</h2>
  <p class="text">Denna författning träder i kraft den 1 januari 2025.</p>
</footer>
```

Both variants are valid. The key structural requirement is `footer.back` as the container.

---

## 15. Appendices (Bilagor)

```html
<div class="appendices">
  <h2>Bilaga 1 {TITLE}</h2>
  <p class="text">Appendix content...</p>
  <table class="legal-table">
    ...
  </table>

  <h2>Bilaga 2 {TITLE}</h2>
  <p class="text">More content...</p>
</div>
```

Appendices are semi-structured — they use `h2` headings for each bilaga and may contain tables, lists, and paragraphs, but do not follow the `h3.paragraph > a.paragraf` pattern.

---

## 16. Cross-References

### SFS references

```html
<a class="ref" href="/rn/goext.aspx?ref={YEAR}{NUMBER}&amp;lang=sv"
  >SFS {YEAR}:{NUMBER}</a
>
```

### EU regulation references

```html
<a class="ref" href="/rn/document/?id=CELEX{CELEX_NUMBER}"
  >förordning (EU) {NUMBER}</a
>
```

Cross-reference links are **optional** — their presence depends on the ingestion source. The canonical parser does not require them but preserves them when present.

---

## 17. ID Conventions

### DOC_ID Construction

The `DOC_ID` is derived from the document number:

| Document Number       | DOC_ID          | Rule                          |
| --------------------- | --------------- | ----------------------------- |
| `SFS 1977:1160`       | `SFS1977-1160`  | Remove spaces, colon → hyphen |
| `SFS 2025:732`        | `SFS2025-732`   | Same                          |
| `MSBFS 2020:1`        | `MSBFS2020-1`   | Same                          |
| `AFS 2023:1`          | `AFS2023-1`     | Same                          |
| `NFS 2021:6`          | `NFS2021-6`     | Same                          |
| EU CELEX `32016R0679` | `eu-32016r0679` | Lowercase, `eu-` prefix       |

### Structural IDs

| Structural Level | ID Pattern                | Example                  |
| ---------------- | ------------------------- | ------------------------ |
| Document         | `{DOC_ID}`                | `SFS1977-1160`           |
| Header           | `{DOC_ID}_GENH0000`       | `SFS1977-1160_GENH0000`  |
| Body             | `{DOC_ID}_BODY0001`       | `SFS1977-1160_BODY0001`  |
| Avdelning        | `{DOC_ID}_AVD{N}`         | `AFS2023-1_AVD1`         |
| Chapter          | `{DOC_ID}_K{N}`           | `SFS1977-1160_K2`        |
| Section (§)      | `{DOC_ID}_K{N}_P{S}`      | `SFS1977-1160_K2_P3`     |
| Section (flat)   | `{DOC_ID}_P{S}`           | `NFS2021-6_P5`           |
| Stycke           | `{DOC_ID}_K{N}_P{S}_S{T}` | `SFS1977-1160_K2_P3_S2`  |
| EU Article       | `{DOC_ID}_art{N}`         | `eu-32016r0679_art5`     |
| Group heading    | `{DOC_ID}_GEN{N}`         | `SFS2025-732_GEN0001`    |
| Footer           | `{DOC_ID}_BACK0001`       | `SFS1977-1160_BACK0001`  |
| Footnote         | `{DOC_ID}.FOOTNOTE.{N}`   | `SFS2025-732.FOOTNOTE.1` |

### Section number handling

- Standard: `P1`, `P2`, `P3`
- With letter suffix: `P2a`, `P15b`
- These appear in the `id` attribute exactly as written

---

## 18. Required vs Optional Elements

| Element                     | Required    | Notes                                             |
| --------------------------- | ----------- | ------------------------------------------------- |
| `article.legal-document`    | **Yes**     | Root wrapper                                      |
| `div.lovhead`               | **Yes**     | Document header with number + title               |
| `div.body`                  | **Yes**     | Main content container                            |
| `section.kapitel`           | Conditional | Required for chaptered docs, absent for flat docs |
| `section.avdelning`         | Conditional | Only for docs with avdelningar                    |
| `h3.paragraph > a.paragraf` | **Yes**     | Every § / article must have this                  |
| `p.text`                    | **Yes**     | Every content paragraph                           |
| `div.preamble`              | Optional    | EU docs, some agency regs                         |
| `div.appendices`            | Optional    | Documents with bilagor                            |
| `footer.back`               | Optional    | Documents with transition provisions              |
| `div.allmanna-rad`          | Optional    | Agency regulations with general guidance          |
| `table.legal-table`         | Optional    | Documents with tables                             |
| `id` on `article`           | **Yes**     | DOC_ID                                            |
| `id` on `a.paragraf`        | **Yes**     | For deep linking                                  |
| `id` on `section.kapitel`   | **Yes**     | For TOC navigation                                |
| `id` on `p.text` (stycke)   | Optional    | LLM output includes these; normalizers may omit   |

---

## 19. Content Type Conformance

### Before normalization (current state)

| Content Type                    | Conformance | What Needs Work                                                                |
| ------------------------------- | ----------- | ------------------------------------------------------------------------------ |
| SFS Amendments (PDF→LLM)        | ~98%        | Rename `class="sfs"` → `class="legal-document"`                                |
| Agency Regs (PDF→LLM)           | ~95%        | Minor alignment, rename wrapper                                                |
| AFS (HTML scraping)             | ~60%        | Inner structure: add `section.kapitel`, semantic IDs, `h3.paragraph`, `p.text` |
| EU Documents (CELLAR→transform) | ~70%        | Article markup, `p.text` classes, preamble wrapper                             |
| SFS Laws (Riksdag API)          | ~20%        | Full normalizer needed: wrapper, chapters, sections, classes                   |

### After normalization (target state)

All content types produce HTML that the canonical parser can process with **zero content-type-specific branching**.

---

## 20. Complete Examples

### Example A: SFS Law (Chaptered, after normalization)

```html
<article class="legal-document" id="SFS1977-1160">
  <div class="lovhead">
    <h1>
      <p class="text">SFS 1977:1160</p>
      <p class="text">Arbetsmiljölag</p>
    </h1>
  </div>
  <div class="body">
    <section class="kapitel" id="SFS1977-1160_K1">
      <h2 class="kapitel-rubrik">
        1 kap. Lagens ändamål och tillämpningsområde
      </h2>
      <h3 class="paragraph">
        <a class="paragraf" id="SFS1977-1160_K1_P1" name="SFS1977-1160_K1_P1"
          >1 §</a
        >
      </h3>
      <p class="text">
        Lagens ändamål är att förebygga ohälsa och olycksfall i arbetet samt att
        även i övrigt uppnå en god arbetsmiljö.
      </p>
      <h3 class="paragraph">
        <a class="paragraf" id="SFS1977-1160_K1_P2" name="SFS1977-1160_K1_P2"
          >2 §</a
        >
      </h3>
      <p class="text">
        Denna lag gäller varje verksamhet i vilken arbetstagare utför arbete för
        en arbetsgivares räkning.
      </p>
      <p class="text">
        I fråga om fartygsarbete gäller lagen dock ej annat än som följer av 1
        kap. 3 § och 3 kap. 1-4 och 7-9 §§.
      </p>
    </section>
    <section class="kapitel" id="SFS1977-1160_K2">
      <h2 class="kapitel-rubrik">2 kap. Arbetsmiljöns beskaffenhet</h2>
      <!-- ... -->
    </section>
  </div>
  <footer class="back" id="SFS1977-1160_BACK0001">
    <h2>Övergångsbestämmelser</h2>
    <p class="text">Denna lag träder i kraft den 1 juli 1978.</p>
  </footer>
</article>
```

### Example B: SFS Amendment (LLM output — already canonical)

```html
<article class="legal-document" id="SFS2025-732">
  <div class="lovhead">
    <h1 id="SFS2025-732_GENH0000">
      <p class="text">SFS 2025:732</p>
      <p class="text">Lag om ändring i arbetsmiljölagen (1977:1160)</p>
    </h1>
  </div>
  <div class="body" id="SFS2025-732_BODY0001">
    <section class="kapitel" id="SFS2025-732_K6">
      <div class="N2">
        <section class="ann">
          <div class="element-body annzone">
            <h3 class="paragraph" id="SFS2025-732_K6_P17">
              <span class="kapitel">6 kap.</span> 17 §
            </h3>
            <p class="text" id="SFS2025-732_K6_P17_S1">
              Den som utsetts till skyddsombud...
            </p>
            <p class="text" id="SFS2025-732_K6_P17_S2">
              Skyddsombudet har rätt att ta del av...
            </p>
          </div>
        </section>
      </div>
    </section>
  </div>
  <footer class="back" id="SFS2025-732_BACK0001">
    <section class="in-force-info" id="SFS2025-732_IN_FORCE_INFO0001">
      <h2>Ikraftträdande- och övergångsbestämmelser</h2>
      <dl class="in-force">
        <dt class="in-force">
          <a class="change-sfs-nr" href="/rn/goext.aspx?ref=2025732&amp;lang=sv"
            >SFS&nbsp;2025:732</a
          >
        </dt>
        <dd class="in-force">
          <ol class="list" type="1">
            <li>
              <p class="text">Denna lag träder i kraft den 1 juli 2025.</p>
            </li>
          </ol>
        </dd>
      </dl>
    </section>
  </footer>
</article>
```

Note: The `section.ann`, `div.element-body.annzone`, and `div.N2` wrappers are Notisum legacy — tolerated but not required by the canonical schema. The parser ignores them and finds `h3.paragraph` + `p.text` at any depth.

### Example C: Agency Regulation with Avdelningar (3-level)

```html
<article class="legal-document" id="AFS2023-1">
  <div class="lovhead">
    <h1>
      <p class="text">AFS 2023:1</p>
      <p class="text">Föreskrifter om risker i arbetsmiljön</p>
    </h1>
  </div>
  <div class="body">
    <section class="avdelning" id="AFS2023-1_AVD1">
      <h2 class="avdelning-rubrik">Avdelning 1 Gemensamma bestämmelser</h2>
      <section class="kapitel" id="AFS2023-1_K1">
        <h3 class="kapitel-rubrik">1 kap. Allmänna bestämmelser</h3>
        <h3 class="paragraph">
          <a class="paragraf" id="AFS2023-1_K1_P1" name="AFS2023-1_K1_P1"
            >1 §</a
          >
        </h3>
        <p class="text">Dessa föreskrifter gäller för alla verksamheter...</p>
        <div class="allmanna-rad">
          <p class="allmanna-rad-heading"><strong>Allmänna råd</strong></p>
          <p class="text">Det systematiska arbetsmiljöarbetet bör...</p>
        </div>
      </section>
      <section class="kapitel" id="AFS2023-1_K2">
        <h3 class="kapitel-rubrik">2 kap. Definitioner</h3>
        <!-- ... -->
      </section>
    </section>
    <section class="avdelning" id="AFS2023-1_AVD2">
      <h2 class="avdelning-rubrik">Avdelning 2 Fysikaliska riskkällor</h2>
      <section class="kapitel" id="AFS2023-1_K5">
        <h3 class="kapitel-rubrik">5 kap. Buller</h3>
        <h3 class="paragraph">
          <a class="paragraf" id="AFS2023-1_K5_P1" name="AFS2023-1_K5_P1"
            >1 §</a
          >
        </h3>
        <p class="text">Arbetsgivaren ska undersöka bullerexponering.</p>
        <table class="legal-table">
          <thead>
            <tr>
              <th>Exponeringsvärde</th>
              <th>Nivå</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Undre insatsvärde</td>
              <td>80 dB(A)</td>
            </tr>
          </tbody>
        </table>
      </section>
    </section>
  </div>
  <footer class="back">
    <h2>Övergångsbestämmelser</h2>
    <p class="text">Denna författning träder i kraft den 1 januari 2025.</p>
  </footer>
</article>
```

### Example D: EU Regulation (Chaptered, with preamble)

```html
<article class="legal-document" id="eu-32016r0679">
  <div class="lovhead">
    <h1>
      <p class="text">Förordning (EU) 2016/679</p>
      <p class="text">Allmän dataskyddsförordning (GDPR)</p>
    </h1>
  </div>
  <div class="preamble">
    <!-- SPECIAL ZONE — opaque content, not canonicalized -->
    <p>
      EUROPAPARLAMENTET OCH EUROPEISKA UNIONENS RÅD HAR ANTAGIT DENNA FÖRORDNING
    </p>
    <p>
      med beaktande av fördraget om Europeiska unionens funktionssätt, särskilt
      artikel 16,
    </p>
    <p>
      (1) Skyddet för fysiska personer vid behandling av personuppgifter är en
      grundläggande rättighet.
    </p>
    <p>
      (2) Principerna och reglerna för skyddet för fysiska personer vid
      behandling av deras personuppgifter bör...
    </p>
  </div>
  <div class="body">
    <section class="kapitel" id="eu-32016r0679_K1">
      <h2 class="kapitel-rubrik">KAPITEL I — Allmänna bestämmelser</h2>
      <h3 class="paragraph">
        <a class="paragraf" id="eu-32016r0679_art1" name="eu-32016r0679_art1"
          >Artikel 1 — Syfte</a
        >
      </h3>
      <p class="text">
        I denna förordning fastställs bestämmelser om skydd för fysiska
        personer...
      </p>
      <h3 class="paragraph">
        <a class="paragraf" id="eu-32016r0679_art2" name="eu-32016r0679_art2"
          >Artikel 2 — Materiellt tillämpningsområde</a
        >
      </h3>
      <p class="text">
        Denna förordning ska tillämpas på behandling av personuppgifter som helt
        eller delvis...
      </p>
    </section>
  </div>
</article>
```

### Example E: Flat Agency Regulation (no chapters)

```html
<article class="legal-document" id="NFS2021-6">
  <div class="lovhead">
    <h1>
      <p class="text">NFS 2021:6</p>
      <p class="text">
        Naturvårdsverkets föreskrifter om skydd mot mark- och vattenförorening
        vid hantering av brandfarliga vätskor och spilloljor
      </p>
    </h1>
  </div>
  <div class="body">
    <h3 class="paragraph">
      <a class="paragraf" id="NFS2021-6_P1" name="NFS2021-6_P1">1 §</a>
    </h3>
    <p class="text">Dessa föreskrifter innehåller bestämmelser om...</p>
    <h3 class="paragraph">
      <a class="paragraf" id="NFS2021-6_P2" name="NFS2021-6_P2">2 §</a>
    </h3>
    <p class="text">I dessa föreskrifter avses med...</p>
    <ol class="list" type="1">
      <li><p class="text">anläggning: en anordning för hantering...</p></li>
      <li>
        <p class="text">brandfarlig vätska: en vätska med flampunkt...</p>
      </li>
    </ol>
  </div>
</article>
```

---

## Appendix: Parser Tolerance Rules

The canonical parser should be **strict on structure** but **tolerant on wrappers**:

1. **Ignore transparent wrappers.** Elements like `div.N2`, `section.ann`, `div.element-body.annzone` are legacy Notisum nesting. The parser should traverse through them to find `h3.paragraph` and `p.text`.

2. **Accept both heading variants for Allmänna råd.** Either `p.allmanna-rad-heading` or `h4.allmanna-rad-rubrik`.

3. **Accept both footnote styles.** Inline-only (`sup.footnote-ref`) or inline+block (`dl.footnote-content`).

4. **Accept missing optional IDs.** Stycke-level IDs (`_S{T}`) and body/header IDs may be absent.

5. **Never parse inside `div.preamble`.** Treat it as opaque content.

6. **Handle both chapter heading levels.** `h2.kapitel-rubrik` (no avdelningar) or `h3.kapitel-rubrik` (with avdelningar).
