// DOCX 生成引擎 — 基于 docx 包
// AI Agent 通过结构化数据 → 生成专业 Word 文档

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, Table, TableRow, TableCell, WidthType,
  BorderStyle, Header, Footer, PageNumber, NumberFormat,
  TableOfContents, PageBreak, ShadingType,
} from 'docx'

// ────────────────────── 类型定义 ──────────────────────

interface DocSection {
  type: 'heading' | 'paragraph' | 'bullets' | 'numbered' | 'table' | 'pagebreak' | 'toc'
  level?: 1 | 2 | 3
  text?: string
  items?: string[]
  bold?: boolean
  italic?: boolean
  table?: { headers: string[]; rows: string[][] }
  align?: 'left' | 'center' | 'right'
}

interface DocxData {
  title?: string
  subtitle?: string
  author?: string
  company?: string
  date?: string
  theme?: 'default' | 'legal' | 'finance' | 'mbe'
  hasToc?: boolean
  headerText?: string
  footerText?: string
  sections: DocSection[]
}

// ────────────────────── 主题配色 ──────────────────────

const THEMES = {
  default: { heading: '2F5496', accent: '4472C4', text: '333333', tableBg: 'D9E2F3', tableBorder: '8EAADB' },
  legal: { heading: '2C3E50', accent: '34495E', text: '2C3E50', tableBg: 'ECF0F1', tableBorder: 'BDC3C7' },
  finance: { heading: '1F4E79', accent: '2E75B6', text: '1F1F1F', tableBg: 'E2EFDA', tableBorder: 'A9D18E' },
  mbe: { heading: '4F46E5', accent: '6366F1', text: '1E293B', tableBg: 'EEF2FF', tableBorder: 'A5B4FC' },
}

// ────────────────────── 构建器 ──────────────────────

function buildParagraph(section: DocSection, theme: typeof THEMES.default): Paragraph {
  const align = section.align === 'center' ? AlignmentType.CENTER
    : section.align === 'right' ? AlignmentType.RIGHT
    : AlignmentType.LEFT

  return new Paragraph({
    alignment: align,
    spacing: { after: 200, line: 360 },
    children: [
      new TextRun({
        text: section.text || '',
        font: 'Microsoft YaHei',
        size: 24,
        color: theme.text,
        bold: section.bold,
        italics: section.italic,
      }),
    ],
  })
}

function buildHeading(section: DocSection, theme: typeof THEMES.default): Paragraph {
  const levelMap: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
  }
  const sizeMap: Record<number, number> = { 1: 36, 2: 30, 3: 26 }
  const level = section.level || 1

  return new Paragraph({
    heading: levelMap[level] || HeadingLevel.HEADING_1,
    spacing: { before: level === 1 ? 400 : 300, after: 200 },
    children: [
      new TextRun({
        text: section.text || '',
        font: 'Microsoft YaHei',
        size: sizeMap[level] || 30,
        color: theme.heading,
        bold: true,
      }),
    ],
  })
}

function buildBullets(section: DocSection, theme: typeof THEMES.default): Paragraph[] {
  return (section.items || []).map(item =>
    new Paragraph({
      bullet: { level: 0 },
      spacing: { after: 120, line: 340 },
      children: [
        new TextRun({
          text: item,
          font: 'Microsoft YaHei',
          size: 22,
          color: theme.text,
        }),
      ],
    }),
  )
}

function buildNumbered(section: DocSection, theme: typeof THEMES.default): Paragraph[] {
  return (section.items || []).map((item, idx) =>
    new Paragraph({
      spacing: { after: 120, line: 340 },
      children: [
        new TextRun({
          text: `${idx + 1}. ${item}`,
          font: 'Microsoft YaHei',
          size: 22,
          color: theme.text,
        }),
      ],
    }),
  )
}

function buildTable(section: DocSection, theme: typeof THEMES.default): Table {
  const tableData = section.table!
  const colCount = tableData.headers.length
  const colWidth = Math.floor(9000 / colCount)

  const headerRow = new TableRow({
    tableHeader: true,
    height: { value: 500, rule: 'atLeast' as unknown as any },
    children: tableData.headers.map(h =>
      new TableCell({
        shading: { type: ShadingType.SOLID, color: theme.tableBg },
        width: { size: colWidth, type: WidthType.DXA },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({
            text: h, font: 'Microsoft YaHei', size: 20, bold: true, color: theme.heading,
          })],
        })],
      }),
    ),
  })

  const dataRows = tableData.rows.map(row =>
    new TableRow({
      children: row.map(cell =>
        new TableCell({
          width: { size: colWidth, type: WidthType.DXA },
          children: [new Paragraph({
            children: [new TextRun({
              text: cell, font: 'Microsoft YaHei', size: 20, color: theme.text,
            })],
          })],
        }),
      ),
    }),
  )

  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows: [headerRow, ...dataRows],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: theme.tableBorder },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: theme.tableBorder },
      left: { style: BorderStyle.SINGLE, size: 1, color: theme.tableBorder },
      right: { style: BorderStyle.SINGLE, size: 1, color: theme.tableBorder },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: theme.tableBorder },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: theme.tableBorder },
    },
  })
}

// ────────────────────── 导出函数 ──────────────────────

export async function generateDocx(
  data: Record<string, unknown>,
  _template?: string,
): Promise<Buffer> {
  const docData = data as unknown as DocxData
  const themeName = docData.theme || 'mbe'
  const theme = THEMES[themeName] || THEMES.mbe

  const children: (Paragraph | Table | TableOfContents)[] = []

  // 标题页
  if (docData.title) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 2000, after: 200 },
      children: [new TextRun({
        text: docData.title,
        font: 'Microsoft YaHei',
        size: 48,
        color: theme.heading,
        bold: true,
      })],
    }))
  }

  if (docData.subtitle) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({
        text: docData.subtitle,
        font: 'Microsoft YaHei',
        size: 28,
        color: theme.accent,
      })],
    }))
  }

  // 元信息行
  const metaParts = []
  if (docData.company) metaParts.push(docData.company)
  if (docData.author) metaParts.push(docData.author)
  metaParts.push(docData.date || new Date().toLocaleDateString('zh-CN'))

  if (metaParts.length > 0) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
      children: [new TextRun({
        text: metaParts.join('  |  '),
        font: 'Microsoft YaHei',
        size: 20,
        color: '999999',
      })],
    }))
  }

  // 目录
  if (docData.hasToc) {
    children.push(new Paragraph({
      children: [new TextRun({ text: '', break: 1 })],
    }))
    children.push(new TableOfContents('目录', {
      hyperlink: true,
      headingStyleRange: '1-3',
    }))
    children.push(new Paragraph({
      children: [new PageBreak()],
    }))
  }

  // 正文内容
  for (const section of docData.sections) {
    switch (section.type) {
      case 'heading':
        children.push(buildHeading(section, theme))
        break
      case 'paragraph':
        children.push(buildParagraph(section, theme))
        break
      case 'bullets':
        children.push(...buildBullets(section, theme))
        break
      case 'numbered':
        children.push(...buildNumbered(section, theme))
        break
      case 'table':
        if (section.table) {
          children.push(buildTable(section, theme))
          children.push(new Paragraph({ spacing: { after: 200 }, children: [] }))
        }
        break
      case 'pagebreak':
        children.push(new Paragraph({ children: [new PageBreak()] }))
        break
      case 'toc':
        children.push(new TableOfContents('目录', {
          hyperlink: true,
          headingStyleRange: '1-3',
        }))
        break
    }
  }

  // 构建文档
  const doc = new Document({
    creator: docData.author || 'MBE Desktop',
    title: docData.title || 'MBE 文档',
    description: `由 MBE Desktop AI 专家生成`,
    sections: [{
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({
              text: docData.headerText || docData.company || 'MBE Desktop',
              font: 'Microsoft YaHei', size: 16, color: '999999',
            })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: docData.footerText || '本文档由 MBE AI 专家生成  —  ',
                font: 'Microsoft YaHei', size: 16, color: '999999',
              }),
              new TextRun({
                children: ['第 ', PageNumber.CURRENT, ' 页 / 共 ', PageNumber.TOTAL_PAGES, ' 页'],
                font: 'Microsoft YaHei', size: 16, color: '999999',
              }),
            ],
          })],
        }),
      },
      children,
    }],
    numbering: {
      config: [{
        reference: 'default-bullet',
        levels: [{
          level: 0,
          format: NumberFormat.BULLET,
          text: '\u2022',
          alignment: AlignmentType.LEFT,
        }],
      }],
    },
  })

  return Buffer.from(await Packer.toBuffer(doc))
}
