import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  TableLayoutType,
  WidthType,
  AlignmentType,
  BorderStyle,
  ExternalHyperlink,
  Footer,
  PageNumber,
  type FileChild,
  type IRunOptions,
  type IParagraphOptions,
} from 'docx'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DocumentExportMetadata {
  title: string
  documentNumber?: string | undefined
  version: number
  status: string
  approvedAt?: Date | null | undefined
  workspaceName: string
}

export interface TiptapContentJSON {
  type: 'doc'
  content: TiptapExportNode[]
}

export interface TiptapExportNode {
  type: string
  attrs?: Record<string, unknown> | undefined
  content?: TiptapExportNode[] | undefined
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }> | undefined
  text?: string | undefined
}

// ---------------------------------------------------------------------------
// Mark → TextRun options
// ---------------------------------------------------------------------------

function marksToRunOptions(
  marks?: TiptapExportNode['marks']
): Partial<IRunOptions> {
  if (!marks) return {}

  const opts: Record<string, unknown> = {}

  for (const mark of marks) {
    if (mark.type === 'bold') opts.bold = true
    else if (mark.type === 'italic') opts.italics = true
    else if (mark.type === 'underline') opts.underline = {}
    else if (mark.type === 'textStyle' && mark.attrs?.color) {
      opts.color = String(mark.attrs.color).replace('#', '')
    }
  }
  return opts as Partial<IRunOptions>
}

function getAlignment(
  attrs?: Record<string, unknown>
): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  const align = attrs?.textAlign as string | undefined
  if (align === 'center') return AlignmentType.CENTER
  if (align === 'right') return AlignmentType.RIGHT
  if (align === 'justify') return AlignmentType.JUSTIFIED
  return undefined
}

// ---------------------------------------------------------------------------
// Node converters
// ---------------------------------------------------------------------------

function convertTextRuns(
  node: TiptapExportNode
): (TextRun | ExternalHyperlink)[] {
  if (!node.content) return []

  const runs: (TextRun | ExternalHyperlink)[] = []

  for (const child of node.content) {
    if (child.type === 'text' && child.text) {
      const linkMark = child.marks?.find((m) => m.type === 'link')
      if (linkMark) {
        runs.push(
          new ExternalHyperlink({
            children: [
              new TextRun({
                text: child.text,
                style: 'Hyperlink',
                ...marksToRunOptions(
                  child.marks?.filter((m) => m.type !== 'link')
                ),
              }),
            ],
            link: String(linkMark.attrs?.href ?? ''),
          })
        )
      } else {
        runs.push(
          new TextRun({ text: child.text, ...marksToRunOptions(child.marks) })
        )
      }
    } else if (child.type === 'hardBreak') {
      runs.push(new TextRun({ break: 1 }))
    }
  }

  return runs
}

function convertHeading(node: TiptapExportNode): Paragraph {
  const level = (node.attrs?.level as number) ?? 1
  const headingLevel =
    level === 1
      ? HeadingLevel.HEADING_1
      : level === 2
        ? HeadingLevel.HEADING_2
        : HeadingLevel.HEADING_3

  const opts: Record<string, unknown> = {
    heading: headingLevel,
    children: convertTextRuns(node),
  }
  const align = getAlignment(node.attrs)
  if (align) opts.alignment = align

  return new Paragraph(opts as IParagraphOptions)
}

function convertParagraph(
  node: TiptapExportNode,
  extraOpts?: Partial<IParagraphOptions>
): Paragraph {
  const opts: Record<string, unknown> = {
    children: convertTextRuns(node),
    ...extraOpts,
  }
  const align = getAlignment(node.attrs)
  if (align) opts.alignment = align

  return new Paragraph(opts as IParagraphOptions)
}

function convertListItems(
  node: TiptapExportNode,
  bullet: boolean,
  level: number = 0
): Paragraph[] {
  const paragraphs: Paragraph[] = []

  for (const item of node.content ?? []) {
    if (item.type !== 'listItem') continue

    for (const child of item.content ?? []) {
      if (child.type === 'paragraph') {
        const listOpts: Record<string, unknown> = {}
        if (bullet) {
          listOpts.bullet = { level }
        } else {
          listOpts.numbering = { reference: 'default-numbering', level }
        }
        paragraphs.push(
          convertParagraph(child, listOpts as Partial<IParagraphOptions>)
        )
      } else if (child.type === 'bulletList' || child.type === 'orderedList') {
        paragraphs.push(
          ...convertListItems(child, child.type === 'bulletList', level + 1)
        )
      }
    }
  }

  return paragraphs
}

// A4 portrait usable width in DXA (twips): 210mm − 2×25.4mm default margins
// ≈ 9026 DXA. Splitting this equally across columns + a FIXED layout makes Word
// constrain a wide table to the page and wrap cell text instead of running it
// past the right margin (19.8 QA — agent tables can be 7+ columns).
const A4_CONTENT_WIDTH_DXA = 9026

function convertTable(node: TiptapExportNode): Table {
  const rows: TableRow[] = []

  // Column count = widest row (accounting for colspans), min 1.
  let maxCols = 1
  for (const row of node.content ?? []) {
    if (row.type !== 'tableRow') continue
    let count = 0
    for (const cell of row.content ?? []) {
      if (cell.type !== 'tableCell' && cell.type !== 'tableHeader') continue
      count += (cell.attrs?.colspan as number) ?? 1
    }
    maxCols = Math.max(maxCols, count)
  }
  const colDxa = Math.floor(A4_CONTENT_WIDTH_DXA / maxCols)
  const columnWidths = Array.from({ length: maxCols }, () => colDxa)

  for (const row of node.content ?? []) {
    if (row.type !== 'tableRow') continue

    const cells: TableCell[] = []
    for (const cell of row.content ?? []) {
      if (cell.type !== 'tableCell' && cell.type !== 'tableHeader') continue

      const colspan = (cell.attrs?.colspan as number) ?? 1
      const rowspan = (cell.attrs?.rowspan as number) ?? 1

      const cellChildren: Paragraph[] = []
      for (const cellChild of cell.content ?? []) {
        if (cellChild.type === 'paragraph') {
          cellChildren.push(convertParagraph(cellChild))
        }
      }
      if (cellChildren.length === 0) {
        cellChildren.push(new Paragraph({}))
      }

      const cellOpts: Record<string, unknown> = {
        children: cellChildren,
        // Explicit cell width (with FIXED layout) keeps Word from auto-expanding
        // the table past the page; text wraps within the fixed cell.
        width: { size: colDxa * colspan, type: WidthType.DXA },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1 },
          bottom: { style: BorderStyle.SINGLE, size: 1 },
          left: { style: BorderStyle.SINGLE, size: 1 },
          right: { style: BorderStyle.SINGLE, size: 1 },
        },
      }
      if (colspan > 1) cellOpts.columnSpan = colspan
      if (rowspan > 1) cellOpts.rowSpan = rowspan

      cells.push(
        new TableCell(cellOpts as ConstructorParameters<typeof TableCell>[0])
      )
    }

    if (cells.length > 0) {
      rows.push(new TableRow({ children: cells }))
    }
  }

  return new Table({
    rows,
    columnWidths,
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
  })
}

function convertHorizontalRule(): Paragraph {
  return new Paragraph({
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    },
  })
}

// ---------------------------------------------------------------------------
// Main: walk Tiptap JSON → FileChild[]
// ---------------------------------------------------------------------------

function convertNode(node: TiptapExportNode): FileChild[] {
  switch (node.type) {
    case 'heading':
      return [convertHeading(node)]
    case 'paragraph':
      return [convertParagraph(node)]
    case 'bulletList':
      return convertListItems(node, true)
    case 'orderedList':
      return convertListItems(node, false)
    case 'table':
      return [convertTable(node)]
    case 'horizontalRule':
      return [convertHorizontalRule()]
    case 'image':
      // Images require async fetch — skip in sync conversion (embedded separately if needed)
      return [
        new Paragraph({
          children: [
            new TextRun({
              text: `[Bild: ${String(node.attrs?.src ?? '')}]`,
              italics: true,
              color: '999999',
            }),
          ],
        }),
      ]
    default:
      // Unknown nodes — skip gracefully
      return []
  }
}

// ---------------------------------------------------------------------------
// Metadata header
// ---------------------------------------------------------------------------

function buildMetadataHeader(meta: DocumentExportMetadata): FileChild[] {
  const children: FileChild[] = []

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: meta.title,
          bold: true,
          size: 32,
          font: 'Calibri',
        }),
      ],
      spacing: { after: 100 },
    })
  )

  if (meta.documentNumber) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Dokumentnr: ${meta.documentNumber}`,
            size: 20,
            color: '666666',
            font: 'Calibri',
          }),
        ],
      })
    )
  }

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Version: v${meta.version} | Status: ${meta.status}`,
          size: 20,
          color: '666666',
          font: 'Calibri',
        }),
      ],
    })
  )

  if (meta.approvedAt) {
    const dateStr = new Date(meta.approvedAt).toLocaleDateString('sv-SE')
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Godkänd: ${dateStr}`,
            size: 20,
            color: '666666',
            font: 'Calibri',
          }),
        ],
      })
    )
  }

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: meta.workspaceName,
          size: 20,
          color: '999999',
          font: 'Calibri',
        }),
      ],
      spacing: { after: 400 },
    })
  )

  // Separator line
  children.push(
    new Paragraph({
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      },
      spacing: { after: 200 },
    })
  )

  return children
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generateDocx(
  contentJson: TiptapContentJSON,
  metadata: DocumentExportMetadata
): Promise<Buffer> {
  const children: FileChild[] = []

  // Metadata header
  children.push(...buildMetadataHeader(metadata))

  // Content
  for (const node of contentJson.content ?? []) {
    children.push(...convertNode(node))
  }

  const doc = new Document({
    sections: [
      {
        children,
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 18,
                    color: '999999',
                  }),
                ],
              }),
            ],
          }),
        },
      },
    ],
    numbering: {
      config: [
        {
          reference: 'default-numbering',
          levels: [
            {
              level: 0,
              format: 'decimal',
              text: '%1.',
              alignment: AlignmentType.LEFT,
            },
            {
              level: 1,
              format: 'decimal',
              text: '%1.%2.',
              alignment: AlignmentType.LEFT,
            },
          ],
        },
      ],
    },
  })

  return Buffer.from(await Packer.toBuffer(doc))
}
