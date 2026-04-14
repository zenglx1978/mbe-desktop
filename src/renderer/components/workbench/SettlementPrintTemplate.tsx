/**
 * 结算单打印模板 — QuickBooks "Invoices" 对标
 *
 * 使用 window.print() + @media print CSS 生成 PDF。
 * Electron 中可通过 webContents.printToPDF() 直出 PDF 文件。
 * 包含：公司抬头、品牌信息、费用明细、对账核验、签章位。
 */
import { useRef, useCallback } from 'react'
import { Printer, Download } from 'lucide-react'
import type { Brand, Settlement } from '@/stores/brand-store'

interface Props {
  brand: Brand
  settlement: Settlement
  companyName?: string
  companyAddress?: string
  companyTaxId?: string
  onClose: () => void
  color: string
}

export default function SettlementPrintTemplate({
  brand, settlement, companyName = 'MBE 智能运营有限公司',
  companyAddress = '', companyTaxId = '', onClose, color,
}: Props) {
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  const handleDownloadPDF = useCallback(async () => {
    // Electron 环境：通过 IPC 调用 webContents.printToPDF
    if ((window as any).electronAPI?.printToPDF) {
      try {
        const pdfPath = await (window as any).electronAPI.printToPDF({
          filename: `结算单_${brand.name}_${settlement.month}.pdf`,
        })
        alert(`PDF 已保存: ${pdfPath}`)
      } catch {
        window.print()
      }
    } else {
      window.print()
    }
  }, [brand, settlement])

  const recon = settlement.reconciliation
  const base = settlement.baseServiceFee
  const perf = settlement.performanceCommission
  const fixed = brand.fixedMonthlyFee
  const total = settlement.totalAmount
  const tax = settlement.taxAmount

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white text-gray-900 rounded-2xl shadow-2xl max-w-[700px] w-full max-h-[90vh] overflow-y-auto">
        {/* 操作栏（不打印） */}
        <div className="flex items-center justify-between px-6 py-3 border-b print:hidden">
          <span className="text-sm font-medium text-gray-600">结算单预览</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors">
              <Printer className="w-3.5 h-3.5" /> 打印
            </button>
            <button type="button" onClick={handleDownloadPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-colors"
              style={{ backgroundColor: color }}>
              <Download className="w-3.5 h-3.5" /> 导出 PDF
            </button>
            <button type="button" onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors">
              关闭
            </button>
          </div>
        </div>

        {/* 打印正文 */}
        <div ref={printRef} className="px-10 py-8 print:px-0 print:py-0" id="settlement-print-area">
          {/* 公司抬头 */}
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-gray-900">{companyName}</h1>
            {companyAddress && <p className="text-xs text-gray-500 mt-0.5">{companyAddress}</p>}
            {companyTaxId && <p className="text-xs text-gray-500">税号: {companyTaxId}</p>}
            <div className="mt-3 border-b-2 border-gray-900" />
          </div>

          {/* 标题 */}
          <div className="text-center mb-6">
            <h2 className="text-lg font-bold">品牌服务结算单</h2>
            <p className="text-sm text-gray-500 mt-1">结算期间: {settlement.month}</p>
          </div>

          {/* 双栏信息 */}
          <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
            <div>
              <h3 className="font-semibold text-gray-700 mb-2 border-b border-gray-200 pb-1">服务方信息</h3>
              <div className="space-y-1 text-gray-600">
                <p>公司: {companyName}</p>
                <p>结算单号: {settlement.id.slice(0, 12).toUpperCase()}</p>
                <p>开具日期: {new Date().toLocaleDateString('zh-CN')}</p>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-700 mb-2 border-b border-gray-200 pb-1">品牌方信息</h3>
              <div className="space-y-1 text-gray-600">
                <p>品牌: {brand.name}</p>
                <p>类目: {brand.category}</p>
                <p>平台: {brand.platforms.join('、')}</p>
                {brand.contactPerson && <p>对接人: {brand.contactPerson}</p>}
              </div>
            </div>
          </div>

          {/* 费用明细表 */}
          <table className="w-full text-sm mb-6 border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-900">
                <th className="text-left py-2 font-semibold">项目</th>
                <th className="text-right py-2 font-semibold">计算基础</th>
                <th className="text-right py-2 font-semibold">费率</th>
                <th className="text-right py-2 font-semibold">金额 (元)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="py-2">月度 GMV</td>
                <td className="text-right py-2">—</td>
                <td className="text-right py-2">—</td>
                <td className="text-right py-2 font-mono">{settlement.gmv.toLocaleString()}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-2">基础服务费</td>
                <td className="text-right py-2">GMV × 费率</td>
                <td className="text-right py-2">{brand.contractRate}%</td>
                <td className="text-right py-2 font-mono">{base.toLocaleString()}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-2">绩效佣金</td>
                <td className="text-right py-2">GMV × 费率</td>
                <td className="text-right py-2">{brand.performanceRate}%</td>
                <td className="text-right py-2 font-mono">{perf.toLocaleString()}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-2">固定月费</td>
                <td className="text-right py-2">月度固定</td>
                <td className="text-right py-2">—</td>
                <td className="text-right py-2 font-mono">{fixed.toLocaleString()}</td>
              </tr>
              <tr className="border-b-2 border-gray-900 font-bold">
                <td className="py-2" colSpan={3}>应收合计（税前）</td>
                <td className="text-right py-2 font-mono">{total.toLocaleString()}</td>
              </tr>
              <tr className="border-b border-gray-200 text-gray-500">
                <td className="py-2">服務稅 (6%)</td>
                <td className="text-right py-2" colSpan={2}></td>
                <td className="text-right py-2 font-mono">{tax.toLocaleString()}</td>
              </tr>
              <tr className="font-bold text-lg">
                <td className="py-3" colSpan={3}>价税合计</td>
                <td className="text-right py-3 font-mono" style={{ color }}>{(total + tax).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          {/* 对账核验 */}
          {recon && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-gray-700 mb-2 text-sm">对账核验</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">外部 GMV</span><span className="font-mono">{recon.gmv.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">GMV 差异</span><span className={`font-mono ${Math.abs(recon.gmv - settlement.gmv) > 0 ? 'text-red-600' : 'text-green-600'}`}>{(recon.gmv - settlement.gmv).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">外部佣金</span><span className="font-mono">{recon.commission.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">扣款/退款</span><span className="font-mono text-red-600">-{recon.deductions.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">数据来源</span><span>{recon.source}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">对账时间</span><span>{new Date(recon.reconciledAt).toLocaleDateString('zh-CN')}</span></div>
              </div>
            </div>
          )}

          {/* 签章区 */}
          <div className="grid grid-cols-2 gap-8 mt-10 pt-6 border-t border-gray-300">
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-12">服务方签章</p>
              <div className="border-b border-gray-400 w-48" />
              <p className="text-xs text-gray-400 mt-1">日期: ____________</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-12">品牌方确认</p>
              <div className="border-b border-gray-400 w-48" />
              <p className="text-xs text-gray-400 mt-1">日期: ____________</p>
            </div>
          </div>

          {/* 备注 */}
          {settlement.notes && (
            <div className="mt-6 text-xs text-gray-500">
              <p className="font-semibold">备注:</p>
              <p>{settlement.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* 打印专用样式 */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #settlement-print-area, #settlement-print-area * { visibility: visible; }
          #settlement-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  )
}
