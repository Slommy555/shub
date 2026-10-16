import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { PageHeader } from '../components/layout/Layout'
import { SubTabs } from '../components/ui/SubTabs'
import { Skeleton } from '../components/ui/Skeleton'
import { useBodyLogs } from '../hooks/useBodyLogs'
import { fmtNum, fmtWeight, isoDate, parseDate, shortDate } from '../lib/format'
import type { BodyLogType } from '../lib/types'

const CONFIG: Record<BodyLogType, { unit: string; column: string; placeholder: string; fmt: (n: number) => string }> = {
  weight: { unit: 'lbs', column: 'Weight (lbs)', placeholder: '185.4', fmt: (n) => fmtWeight(n) },
  calories: { unit: 'kcal', column: 'Calories', placeholder: '2,340', fmt: (n) => fmtNum(n) },
}

function LogPanel({ type }: { type: BodyLogType }) {
  const cfg = CONFIG[type]
  const { logs, loading, log, remove } = useBodyLogs(type)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const today = logs.find((l) => l.logged_at === isoDate())
  const value = Number(draft.replace(/,/g, ''))
  const valid = draft.trim() !== '' && Number.isFinite(value) && value > 0

  async function submit() {
    if (!valid) return
    setSaving(true)
    setError(null)
    try {
      await log(type === 'calories' ? Math.round(value) : value)
      setDraft('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not log')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <form
        className="flex items-center gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="relative flex-1">
          <input
            aria-label={cfg.column}
            inputMode={type === 'calories' ? 'numeric' : 'decimal'}
            enterKeyHint="done"
            value={draft}
            placeholder={today ? cfg.fmt(Number(today.value)) : cfg.placeholder}
            onChange={(e) => setDraft(e.target.value.replace(type === 'calories' ? /[^\d,]/g : /[^\d.]/g, ''))}
            className="h-12 w-full rounded-input border border-[#1a1a1a] bg-[#141414] pl-4 pr-14 font-mono text-[18px] text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-gold"
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-mono text-[12px] uppercase tracking-wider text-ink-2">
            {cfg.unit}
          </span>
        </div>
        <button
          type="submit"
          disabled={!valid || saving}
          className="h-12 rounded-btn bg-gold px-6 font-display text-[14px] font-bold uppercase tracking-[0.12em] text-[#080808] transition-[filter,opacity] hover:brightness-110 disabled:opacity-40"
        >
          Log
        </button>
      </form>
      <p className="mt-2 font-mono text-[11px] text-ink-2">
        {today ? `Today: ${cfg.fmt(Number(today.value))} ${cfg.unit} · logging again replaces it` : 'Nothing logged today'}
      </p>
      {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}

      <div className="mt-6 overflow-hidden rounded-card border border-line">
        <div className="flex items-center bg-[#080808] px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-2">
          <span className="flex-1">Date</span>
          <span className="w-32 text-right">{cfg.column}</span>
          <span className="w-10" />
        </div>
        {loading ? (
          <Skeleton className="h-24 rounded-none" />
        ) : logs.length ? (
          logs.map((l, i) => (
            <div
              key={l.id}
              className={`flex items-center border-t border-line-muted px-4 py-2.5 font-mono text-[14px] ${
                i % 2 === 0 ? 'bg-[#0f0f0f]' : 'bg-[#080808]'
              }`}
            >
              <span className="flex-1 text-ink-2">{shortDate(parseDate(l.logged_at))}</span>
              <span className="w-32 text-right text-ink">{cfg.fmt(Number(l.value))}</span>
              <span className="flex w-10 justify-end">
                <button
                  aria-label="Delete entry"
                  onClick={() => remove(l.id).catch((e) => setError(e instanceof Error ? e.message : 'Could not delete'))}
                  className="flex h-8 w-8 items-center justify-center rounded-set text-ink-2 transition-colors hover:text-danger active:text-danger"
                >
                  <Trash2 size={15} />
                </button>
              </span>
            </div>
          ))
        ) : (
          <p className="border-t border-line-muted bg-[#0f0f0f] px-4 py-6 text-center font-mono text-[12px] text-ink-2">
            No entries yet
          </p>
        )}
      </div>
    </div>
  )
}

export default function Body() {
  const [tab, setTab] = useState<BodyLogType>('weight')
  return (
    <div>
      <PageHeader title="Body" />
      <div className="px-5">
        <SubTabs
          className="mb-5"
          options={[
            { value: 'weight', label: 'Weight' },
            { value: 'calories', label: 'Calories' },
          ]}
          value={tab}
          onChange={setTab}
        />
        <LogPanel key={tab} type={tab} />
      </div>
    </div>
  )
}
