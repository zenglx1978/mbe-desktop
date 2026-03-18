// PPTX 生成引擎 — 基于 pptxgenjs
// AI Agent 通过结构化数据 → 生成专业 PPT 文档

import PptxGenJS from 'pptxgenjs'

// ────────────────────── 类型定义 ──────────────────────

interface SlideData {
  layout?: 'title' | 'content' | 'two_column' | 'image' | 'chart' | 'table' | 'blank'
  title?: string
  subtitle?: string
  content?: string | string[]
  bullets?: string[]
  left_content?: string | string[]
  right_content?: string | string[]
  image?: { path?: string; base64?: string; width?: number; height?: number }
  table?: { headers: string[]; rows: string[][] }
  chart?: {
    type: 'bar' | 'line' | 'pie' | 'doughnut'
    labels: string[]
    data: { name: string; values: number[] }[]
  }
  notes?: string
}

interface PptxData {
  title?: string
  subtitle?: string
  author?: string
  company?: string
  theme?: 'dark' | 'light' | 'blue' | 'mbe'
  slides: SlideData[]
}

// ────────────────────── 主题配色 ──────────────────────

const THEMES = {
  mbe: {
    bg: '0a0a0f',
    primary: '6366f1',
    secondary: '8b5cf6',
    accent: '06b6d4',
    text: 'f1f5f9',
    muted: '94a3b8',
    surface: '1e1e2e',
  },
  dark: {
    bg: '1a1a2e',
    primary: '4361ee',
    secondary: '7209b7',
    accent: '00b4d8',
    text: 'e5e5e5',
    muted: '999999',
    surface: '2a2a3e',
  },
  light: {
    bg: 'ffffff',
    primary: '2563eb',
    secondary: '7c3aed',
    accent: '0891b2',
    text: '1e293b',
    muted: '64748b',
    surface: 'f1f5f9',
  },
  blue: {
    bg: '0f172a',
    primary: '3b82f6',
    secondary: '6366f1',
    accent: '22d3ee',
    text: 'f8fafc',
    muted: '94a3b8',
    surface: '1e293b',
  },
}

// ────────────────────── 幻灯片构建器 ──────────────────────

function addTitleSlide(pptx: PptxGenJS, data: PptxData, theme: typeof THEMES.mbe): void {
  const slide = pptx.addSlide()
  slide.background = { color: theme.bg }

  // 顶部装饰线
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: 0.05,
    fill: { color: theme.primary },
  })

  slide.addText(data.title || 'MBE 报告', {
    x: 0.8, y: 1.8, w: 8.4, h: 1.5,
    fontSize: 36, fontFace: 'Microsoft YaHei',
    color: theme.text, bold: true,
    align: 'left',
  })

  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: 0.8, y: 3.3, w: 8.4, h: 0.8,
      fontSize: 18, fontFace: 'Microsoft YaHei',
      color: theme.muted,
      align: 'left',
    })
  }

  // 底部信息
  const footerParts = []
  if (data.company) footerParts.push(data.company)
  footerParts.push(new Date().toLocaleDateString('zh-CN'))
  if (data.author) footerParts.push(data.author)

  slide.addText(footerParts.join('  |  '), {
    x: 0.8, y: 5.0, w: 8.4, h: 0.5,
    fontSize: 12, fontFace: 'Microsoft YaHei',
    color: theme.muted,
    align: 'left',
  })

  // 底部渐变条
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 5.45, w: '100%', h: 0.05,
    fill: { color: theme.accent },
  })
}

function addContentSlide(
  pptx: PptxGenJS,
  slideData: SlideData,
  theme: typeof THEMES.mbe,
  slideNum: number,
): void {
  const slide = pptx.addSlide()
  slide.background = { color: theme.bg }

  // 顶部标题栏
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: 0.8,
    fill: { color: theme.surface },
  })

  if (slideData.title) {
    slide.addText(slideData.title, {
      x: 0.5, y: 0.1, w: 8, h: 0.6,
      fontSize: 22, fontFace: 'Microsoft YaHei',
      color: theme.text, bold: true,
    })
  }

  // 页码
  slide.addText(`${slideNum}`, {
    x: 9.0, y: 0.15, w: 0.6, h: 0.5,
    fontSize: 14, fontFace: 'Microsoft YaHei',
    color: theme.accent, align: 'center',
  })

  const layout = slideData.layout || 'content'

  switch (layout) {
    case 'content': {
      const content = slideData.content
      const lines = Array.isArray(content) ? content : (content || '').split('\n')
      const bullets = slideData.bullets || lines

      slide.addText(
        bullets.map(b => ({ text: b, options: { bullet: { code: '2022' }, breakType: 'none' as const } })),
        {
          x: 0.5, y: 1.0, w: 9, h: 4.2,
          fontSize: 16, fontFace: 'Microsoft YaHei',
          color: theme.text,
          lineSpacing: 28,
          paraSpaceAfter: 8,
        },
      )
      break
    }

    case 'two_column': {
      const leftItems = Array.isArray(slideData.left_content)
        ? slideData.left_content
        : (slideData.left_content || '').split('\n')
      const rightItems = Array.isArray(slideData.right_content)
        ? slideData.right_content
        : (slideData.right_content || '').split('\n')

      slide.addText(
        leftItems.map(b => ({ text: b, options: { bullet: { code: '2022' }, breakType: 'none' as const } })),
        {
          x: 0.5, y: 1.0, w: 4.3, h: 4.2,
          fontSize: 14, fontFace: 'Microsoft YaHei',
          color: theme.text, lineSpacing: 24,
        },
      )
      slide.addText(
        rightItems.map(b => ({ text: b, options: { bullet: { code: '2022' }, breakType: 'none' as const } })),
        {
          x: 5.2, y: 1.0, w: 4.3, h: 4.2,
          fontSize: 14, fontFace: 'Microsoft YaHei',
          color: theme.text, lineSpacing: 24,
        },
      )
      break
    }

    case 'table': {
      if (slideData.table) {
        const { headers, rows } = slideData.table
        const tableRows: PptxGenJS.TableRow[] = [
          headers.map(h => ({ text: h, options: { bold: true, color: theme.text, fill: { color: theme.surface } } })),
          ...rows.map(row => row.map(cell => ({ text: cell, options: { color: theme.text } }))),
        ]

        slide.addTable(tableRows, {
          x: 0.5, y: 1.0, w: 9,
          fontSize: 12, fontFace: 'Microsoft YaHei',
          color: theme.text,
          border: { type: 'solid', pt: 0.5, color: theme.muted },
          colW: Array(headers.length).fill(9 / headers.length),
          autoPage: true,
          autoPageRepeatHeader: true,
        })
      }
      break
    }

    case 'chart': {
      if (slideData.chart) {
        const chartTypeMap: Record<string, PptxGenJS.CHART_NAME> = {
          bar: pptx.ChartType.bar,
          line: pptx.ChartType.line,
          pie: pptx.ChartType.pie,
          doughnut: pptx.ChartType.doughnut,
        }
        const chartType = chartTypeMap[slideData.chart.type] || pptx.ChartType.bar

        slide.addChart(chartType, slideData.chart.data.map(d => ({
          name: d.name,
          labels: slideData.chart!.labels,
          values: d.values,
        })), {
          x: 0.5, y: 1.0, w: 9, h: 4.2,
          showTitle: false,
          showLegend: true,
          legendPos: 'b',
          legendFontSize: 10,
          legendColor: theme.muted,
          catAxisLabelColor: theme.muted,
          valAxisLabelColor: theme.muted,
        })
      }
      break
    }

    default:
      break
  }

  // 底部装饰线
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 5.45, w: '100%', h: 0.05,
    fill: { color: theme.primary },
  })
}

// ────────────────────── 导出函数 ──────────────────────

export async function generatePptx(
  data: Record<string, unknown>,
  _template?: string,
): Promise<Buffer> {
  const pptxData = data as unknown as PptxData
  const themeName = pptxData.theme || 'mbe'
  const theme = THEMES[themeName] || THEMES.mbe

  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = pptxData.author || 'MBE Desktop'
  pptx.company = pptxData.company || 'MBE'
  pptx.title = pptxData.title || 'MBE 报告'

  // 封面
  addTitleSlide(pptx, pptxData, theme)

  // 内容页
  const slides = pptxData.slides || []
  slides.forEach((s, i) => {
    addContentSlide(pptx, s, theme, i + 1)
  })

  const arrayBuf = await pptx.write({ outputType: 'nodebuffer' }) as Buffer
  return Buffer.from(arrayBuf)
}
