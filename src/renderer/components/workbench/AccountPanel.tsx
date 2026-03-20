/**
 * 账户面板 — 合同签约 + 订阅管理 + 发票记录
 */
import { useState, useEffect, useCallback } from 'react'
import { FileSignature, CreditCard, Receipt, RefreshCw, ExternalLink, Clock, CheckCircle, AlertCircle, XCircle } from 'lucide-react'
import { API_BASE, authHeaders } from '@/lib/api-client'

type SubTab = 'contracts' | 'subscription' | 'invoices'

interface Contract {
  id: string
  contract_no: string
  customer_name: string
  status: string
  total_amount: number
  created_at: string
  sign_url?: string
}

interface Subscription {
  id: string
  plan_name: string
  status: string
  started_at: string
  expires_at: string
  auto_renew: boolean
  monthly_quota: number
  used_quota: number
}

interface Invoice {
  id: string
  invoice_no: string
  amount: number
  status: string
  issued_at: string
  pdf_url?: string
}

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  active: { icon: CheckCircle, color: 'text-green-600', label: '生效中' },
  signed: { icon: CheckCircle, color: 'text-green-600', label: '已签约' },
  pending: { icon: Clock, color: 'text-yellow-600', label: '待处理' },
  draft: { icon: Clock, color: 'text-muted-foreground', label: '草稿' },
  sent: { icon: AlertCircle, color: 'text-blue-600', label: '待签约' },
  expired: { icon: XCircle, color: 'text-red-600', label: '已过期' },
  cancelled: { icon: XCircle, color: 'text-muted-foreground', label: '已取消' },
  paid: { icon: CheckCircle, color: 'text-green-600', label: '已支付' },
  issued: { icon: CheckCircle, color: 'text-blue-600', label: '已开具' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${cfg.color}`}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  )
}

export default function AccountPanel() {
  const [tab, setTab] = useState<SubTab>('contracts')
  const [contracts, setContracts] = useState<Contract[]>([])
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(false)

  const fetchContracts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/v1/account/contracts`, { headers: authHeaders() })
      if (res.ok) {
        const data = await res.json()
        setContracts(data.contracts ?? data.items ?? [])
      }
    } catch { /* 静默 */ }
    setLoading(false)
  }, [])

  const fetchSubscription = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/v1/account/subscription`, { headers: authHeaders() })
      if (res.ok) {
        const data = await res.json()
        setSubscription(data.subscription ?? data)
      }
    } catch { /* 静默 */ }
    setLoading(false)
  }, [])

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/v1/account/invoices`, { headers: authHeaders() })
      if (res.ok) {
        const data = await res.json()
        setInvoices(data.invoices ?? data.items ?? [])
      }
    } catch { /* 静默 */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (tab === 'contracts') fetchContracts()
    else if (tab === 'subscription') fetchSubscription()
    else if (tab === 'invoices') fetchInvoices()
  }, [tab, fetchContracts, fetchSubscription, fetchInvoices])

  const fmt = (v: number) => `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`
  const fmtDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('zh-CN') } catch { return iso }
  }

  const tabs: { key: SubTab; label: string; icon: typeof FileSignature }[] = [
    { key: 'contracts', label: '合同签约', icon: FileSignature },
    { key: 'subscription', label: '订阅管理', icon: CreditCard },
    { key: 'invoices', label: '发票记录', icon: Receipt },
  ]

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex items-center gap-4 px-4 py-3 border-b">
        {tabs.map(t => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                active ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          )
        })}
        <button
          onClick={() => {
            if (tab === 'contracts') fetchContracts()
            else if (tab === 'subscription') fetchSubscription()
            else fetchInvoices()
          }}
          className="ml-auto p-1.5 rounded-md hover:bg-muted"
          disabled={loading}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'contracts' && (
          <ContractList contracts={contracts} loading={loading} fmt={fmt} fmtDate={fmtDate} />
        )}
        {tab === 'subscription' && (
          <SubscriptionView sub={subscription} loading={loading} fmt={fmt} fmtDate={fmtDate} />
        )}
        {tab === 'invoices' && (
          <InvoiceList invoices={invoices} loading={loading} fmt={fmt} fmtDate={fmtDate} />
        )}
      </div>
    </div>
  )
}

function ContractList({ contracts, loading, fmt, fmtDate }: {
  contracts: Contract[]; loading: boolean; fmt: (v: number) => string; fmtDate: (s: string) => string
}) {
  if (loading && contracts.length === 0) return <LoadingState />
  if (contracts.length === 0) return <EmptyState icon={FileSignature} text="暂无合同" sub="合同签约后将在此显示" />

  return (
    <div className="space-y-3">
      {contracts.map(c => (
        <div key={c.id} className="rounded-lg border p-4 hover:border-primary/30 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{c.contract_no}</span>
            <StatusBadge status={c.status} />
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>客户：{c.customer_name}</p>
            <div className="flex justify-between">
              <span>金额：{fmt(c.total_amount)}</span>
              <span>{fmtDate(c.created_at)}</span>
            </div>
          </div>
          {c.sign_url && c.status === 'sent' && (
            <a
              href={c.sign_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="w-3 h-3" /> 前往签约
            </a>
          )}
        </div>
      ))}
    </div>
  )
}

function SubscriptionView({ sub, loading, fmt, fmtDate }: {
  sub: Subscription | null; loading: boolean; fmt: (v: number) => string; fmtDate: (s: string) => string
}) {
  if (loading && !sub) return <LoadingState />
  if (!sub) return <EmptyState icon={CreditCard} text="暂无订阅" sub="开通订阅后将在此显示" />

  const usagePercent = sub.monthly_quota > 0 ? Math.round((sub.used_quota / sub.monthly_quota) * 100) : 0

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="font-medium">{sub.plan_name}</span>
          <StatusBadge status={sub.status} />
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">开始日期</p>
            <p>{fmtDate(sub.started_at)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">到期日期</p>
            <p>{fmtDate(sub.expires_at)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">自动续费</p>
            <p>{sub.auto_renew ? '已开启' : '未开启'}</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <h4 className="text-sm font-medium mb-3">本月用量</h4>
        <div className="flex items-center justify-between text-sm mb-2">
          <span>{sub.used_quota.toLocaleString()} / {sub.monthly_quota.toLocaleString()} Token</span>
          <span className={usagePercent > 80 ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
            {usagePercent}%
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              usagePercent > 80 ? 'bg-red-500' : usagePercent > 50 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function InvoiceList({ invoices, loading, fmt, fmtDate }: {
  invoices: Invoice[]; loading: boolean; fmt: (v: number) => string; fmtDate: (s: string) => string
}) {
  if (loading && invoices.length === 0) return <LoadingState />
  if (invoices.length === 0) return <EmptyState icon={Receipt} text="暂无发票" sub="付款后系统将自动生成发票" />

  return (
    <div className="space-y-3">
      {invoices.map(inv => (
        <div key={inv.id} className="rounded-lg border p-4 hover:border-primary/30 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{inv.invoice_no}</span>
            <StatusBadge status={inv.status} />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>金额：{fmt(inv.amount)}</span>
            <span>{fmtDate(inv.issued_at)}</span>
          </div>
          {inv.pdf_url && (
            <a
              href={inv.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="w-3 h-3" /> 下载 PDF
            </a>
          )}
        </div>
      ))}
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  )
}

function EmptyState({ icon: Icon, text, sub }: { icon: typeof FileSignature; text: string; sub: string }) {
  return (
    <div className="text-center py-12 text-muted-foreground">
      <Icon className="w-10 h-10 mx-auto mb-3 opacity-20" />
      <p className="text-sm">{text}</p>
      <p className="text-xs mt-1">{sub}</p>
    </div>
  )
}
