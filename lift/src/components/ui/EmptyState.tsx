import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface Props {
  icon: LucideIcon
  title: string
  body?: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, body, action }: Props) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <Icon size={40} strokeWidth={1.25} className="text-ink-3" />
      <div className="mt-4 font-display text-[17px] font-semibold text-ink">{title}</div>
      {body && <p className="mt-1.5 max-w-[280px] text-[13px] leading-relaxed text-ink-2">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
