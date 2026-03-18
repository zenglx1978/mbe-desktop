// XLSX 生成引擎 — 基于 ExcelJS
// AI Agent 通过结构化数据 → 生成专业 Excel 工作簿

import ExcelJS from 'exceljs'

// ────────────────────── 类型定义 ──────────────────────

interface SheetData {
  name: string
  headers?: { text: string; width?: number; key?: string }[]
  rows?: Record<string, unknown>[]
  rawRows?: (string | number | null)[][]
  freezeRow?: number
  freezeCol?: number
  autoFilter?: boolean
  totals?: Record<string, 'sum' | 'average' | 'count' | 'max' | 'min'>
  conditionalFormats?: {
    column: string
    rule: 'greaterThan' | 'lessThan' | 'between'
    values: number[]
    color: string
  }[]
}

interface XlsxData {
  title?: string
  author?: string
  company?: string
  sheets: SheetData[]
  theme?: 'default' | 'finance' | 'legal' | 'mbe'
}

// ────────────────────── 主题配色 ──────────────────────

const THEMES = {
  default: {
    headerBg: '4472C4',
    headerFont: 'FFFFFF',
    altRowBg: 'F2F7FB',
    border: 'D9E2F3',
    totalBg: 'E2EFDA',
  },
  finance: {
    headerBg: '1F4E79',
    headerFont: 'FFFFFF',
    altRowBg: 'F5F5F5',
    border: 'D6DCE4',
    totalBg: 'E2EFDA',
  },
  legal: {
    headerBg: '2C3E50',
    headerFont: 'FFFFFF',
    altRowBg: 'F8F9FA',
    border: 'DEE2E6',
    totalBg: 'FFF3CD',
  },
  mbe: {
    headerBg: '6366F1',
    headerFont: 'FFFFFF',
    altRowBg: 'F1F0FF',
    border: 'C7D2FE',
    totalBg: 'ECFDF5',
  },
}

// ────────────────────── 工具函数 ──────────────────────

function applyHeaderStyle(row: ExcelJS.Row, theme: typeof THEMES.default): void {
  row.height = 28
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: theme.headerFont }, size: 11, name: 'Microsoft YaHei' }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: theme.headerBg } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = {
      bottom: { style: 'medium', color: { argb: theme.headerBg } },
    }
  })
}

function applyDataRowStyle(row: ExcelJS.Row, rowIdx: number, theme: typeof THEMES.default): void {
  row.height = 22
  row.eachCell((cell) => {
    cell.font = { size: 10, name: 'Microsoft YaHei' }
    cell.alignment = { vertical: 'middle', wrapText: true }

    if (rowIdx % 2 === 0) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: theme.altRowBg } }
    }

    cell.border = {
      bottom: { style: 'thin', color: { argb: theme.border } },
    }

    // 数字自动右对齐 + 千位分隔
    if (typeof cell.value === 'number') {
      cell.alignment = { ...cell.alignment, horizontal: 'right' }
      if (Math.abs(cell.value) >= 100) {
        cell.numFmt = '#,##0.00'
      }
    }
  })
}

function colLetter(idx: number): string {
  let s = ''
  let n = idx
  while (n > 0) {
    n--
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26)
  }
  return s
}

// ────────────────────── 导出函数 ──────────────────────

export async function generateXlsx(
  data: Record<string, unknown>,
  _template?: string,
): Promise<Buffer> {
  const xlsxData = data as unknown as XlsxData
  const themeName = xlsxData.theme || 'mbe'
  const theme = THEMES[themeName] || THEMES.mbe

  const workbook = new ExcelJS.Workbook()
  workbook.creator = xlsxData.author || 'MBE Desktop'
  workbook.company = xlsxData.company || 'MBE'
  workbook.created = new Date()

  if (xlsxData.title) {
    workbook.title = xlsxData.title
  }

  for (const sheetData of xlsxData.sheets) {
    const ws = workbook.addWorksheet(sheetData.name, {
      properties: { defaultRowHeight: 22 },
      views: [{
        state: 'frozen' as const,
        ySplit: sheetData.freezeRow ?? 1,
        xSplit: sheetData.freezeCol ?? 0,
      }],
    })

    // 设置列
    if (sheetData.headers) {
      ws.columns = sheetData.headers.map(h => ({
        header: h.text,
        key: h.key || h.text,
        width: h.width || Math.max(h.text.length * 2 + 4, 12),
      }))

      // 表头样式
      applyHeaderStyle(ws.getRow(1), theme)

      // 数据行
      if (sheetData.rows) {
        sheetData.rows.forEach((rowData, idx) => {
          const row = ws.addRow(rowData)
          applyDataRowStyle(row, idx, theme)
        })
      }

      // 自动筛选
      if (sheetData.autoFilter !== false) {
        const lastCol = colLetter(sheetData.headers.length)
        const lastRow = 1 + (sheetData.rows?.length || 0)
        ws.autoFilter = `A1:${lastCol}${lastRow}`
      }

      // 合计行
      if (sheetData.totals && sheetData.rows && sheetData.rows.length > 0) {
        const totalRow: Record<string, unknown> = {}
        const dataStartRow = 2
        const dataEndRow = dataStartRow + sheetData.rows.length - 1

        for (const [colKey, formula] of Object.entries(sheetData.totals)) {
          const colIdx = sheetData.headers.findIndex(h => (h.key || h.text) === colKey)
          if (colIdx < 0) continue
          const col = colLetter(colIdx + 1)
          const fnMap: Record<string, string> = {
            sum: 'SUM', average: 'AVERAGE', count: 'COUNT', max: 'MAX', min: 'MIN',
          }
          totalRow[colKey] = { formula: `${fnMap[formula]}(${col}${dataStartRow}:${col}${dataEndRow})` }
        }

        // 第一列显示"合计"
        const firstKey = sheetData.headers[0].key || sheetData.headers[0].text
        if (!(firstKey in totalRow)) {
          totalRow[firstKey] = '合计'
        }

        const row = ws.addRow(totalRow)
        row.height = 26
        row.eachCell((cell) => {
          cell.font = { bold: true, size: 11, name: 'Microsoft YaHei' }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: theme.totalBg } }
          cell.border = { top: { style: 'double', color: { argb: theme.headerBg } } }
        })
      }
    } else if (sheetData.rawRows) {
      sheetData.rawRows.forEach((row, idx) => {
        const excelRow = ws.addRow(row)
        if (idx === 0) {
          applyHeaderStyle(excelRow, theme)
        } else {
          applyDataRowStyle(excelRow, idx - 1, theme)
        }
      })
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
