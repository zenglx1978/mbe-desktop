import { Crown, Shield, Eye, User } from 'lucide-react'

export const ROLE_CONFIG: Record<string, { icon: typeof Crown; color: string; label: string }> = {
  owner:  { icon: Crown,  color: 'text-amber-500', label: '创建者' },
  admin:  { icon: Shield, color: 'text-purple-400', label: '管理员' },
  member: { icon: Shield, color: 'text-muted-foreground', label: '成员' },
  viewer: { icon: Eye,    color: 'text-zinc-500', label: '观察员' },
  client: { icon: User,   color: 'text-blue-400', label: '客户' },
}

export const AI_AGENTS = [
  { id: 'finance', name: '财务顾问', icon: '💰' },
  { id: 'legal', name: '法律顾问', icon: '⚖️' },
  { id: 'hr', name: 'HR 顾问', icon: '👥' },
  { id: 'cost', name: '造价顾问', icon: '🏗️' },
  { id: 'sales', name: '销售顾问', icon: '📈' },
  { id: 'cs', name: '客服顾问', icon: '🎧' },
  { id: 'invest', name: '投资顾问', icon: '📊' },
  { id: 'pulmonary', name: '呼吸科顾问', icon: '🫁' },
  { id: 'education', name: '教育顾问', icon: '🎓' },
  { id: 'insurance_cs', name: '保险顾问', icon: '🛡️' },
]

export function formatTime(iso: string) {
  try {
    const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z')
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}
