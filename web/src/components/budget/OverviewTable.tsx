import { useMemo, useRef, useState } from 'react';
import { formatMoney, parseMoney, type BudgetGroup } from '../../types/budget';
import type { PayDay } from '../../hooks/budget/usePayDayIncomes';
import AddGroupForm from './AddGroupForm';

// Column geometry (mobile-first). Name is fixed; the two money columns share the
// remaining width equally but never shrink below 100px, so the table scrolls
// horizontally inside its wrapper on very narrow screens.
const NAME_W = 140;
const COL_MIN = 100;
const MIN_TABLE_W = NAME_W + COL_MIN * 2;
const ROW_MIN_H = 52;

type EditCol = 'name' | 'weekly' | 'monthly';
interface EditState {
  id: string;
  col: EditCol;
}

interface Props {
  groups: BudgetGroup[];
  monthLabel: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  payDays: PayDay[];
  weeklyIncome: number;
  monthlyIncome: number;
  onSetPayDayIncome: (thursday: string, n: number) => void;
  weeklyOf: (g: BudgetGroup) => number;
  monthlyOf: (g: BudgetGroup) => number;
  onSaveWeekly: (g: BudgetGroup, n: number) => void;
  onSaveMonthly: (g: BudgetGroup, n: number) => void;
  onAddGroup: (name: string, color: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

/** A labelled currency input (raw number while focused, formatted on blur). */
function IncomeField({
  label,
  value,
  onSave,
}: {
  label: string;
  value: number;
  onSave: (n: number) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState('');
  const display = focused ? text : value ? formatMoney(value) : '';
  return (
    <label className="flex-1">
      <span
        className="mb-1.5 block text-xs font-medium"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {label}
      </span>
      <input
        inputMode="decimal"
        placeholder="$0"
        value={display}
        onFocus={(e) => {
          setFocused(true);
          setText(value ? String(value) : '');
          requestAnimationFrame(() => e.target.select());
        }}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          setFocused(false);
          const n = parseMoney(text);
          if (n !== value) onSave(n);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        className="w-full rounded-xl border px-3 text-base font-medium tabular-nums outline-none"
        style={{
          height: '48px',
          background: 'var(--color-bg-surface)',
          borderColor: focused ? 'var(--color-accent-muted)' : 'var(--color-border)',
          color: 'var(--color-text-primary)',
        }}
      />
    </label>
  );
}

/** The inline input that replaces a money cell while it is being edited. */
function CellInput({
  initial,
  onCommit,
}: {
  initial: number;
  onCommit: (n: number | null) => void;
}) {
  const [text, setText] = useState(initial ? String(initial) : '');
  return (
    <input
      data-no-drag
      autoFocus
      inputMode="decimal"
      placeholder="$0"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onFocus={(e) => requestAnimationFrame(() => e.target.select())}
      onBlur={() => onCommit(text.trim() === '' ? null : parseMoney(text))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') onCommit(null);
      }}
      className="w-full rounded-lg border px-2 text-right text-[15px] tabular-nums outline-none"
      style={{
        height: '38px',
        background: 'var(--color-bg-surface)',
        borderColor: 'var(--color-accent-muted)',
        color: 'var(--color-text-primary)',
      }}
    />
  );
}

/** The inline input that replaces the group name while it is being edited. */
function NameInput({
  initial,
  onCommit,
}: {
  initial: string;
  onCommit: (v: string | null) => void;
}) {
  const [text, setText] = useState(initial);
  return (
    <input
      data-no-drag
      autoFocus
      value={text}
      onChange={(e) => setText(e.target.value)}
      onFocus={(e) => requestAnimationFrame(() => e.target.select())}
      onBlur={() => onCommit(text.trim() ? text.trim() : null)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') onCommit(null);
      }}
      className="w-full rounded-lg border px-2 text-[15px] outline-none"
      style={{
        height: '38px',
        background: 'var(--color-bg-surface)',
        borderColor: 'var(--color-accent-muted)',
        color: 'var(--color-text-primary)',
      }}
    />
  );
}

export default function OverviewTable({
  groups,
  monthLabel,
  onPrevMonth,
  onNextMonth,
  payDays,
  weeklyIncome,
  monthlyIncome,
  onSetPayDayIncome,
  weeklyOf,
  monthlyOf,
  onSaveWeekly,
  onSaveMonthly,
  onAddGroup,
  onRename,
  onDelete,
}: Props) {
  const [swipe, setSwipe] = useState<{ id: string; x: number } | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);
  const swipeRef = useRef<typeof swipe>(null);
  swipeRef.current = swipe;

  const totals = useMemo(() => {
    let m = 0;
    let w = 0;
    for (const g of groups) {
      m += monthlyOf(g);
      w += weeklyOf(g);
    }
    return { monthly: m, weekly: w };
  }, [groups, monthlyOf, weeklyOf]);

  // Single pointer arbiter per row: a horizontal drag swipes to reveal delete; a
  // tap either closes an open swipe or opens the tapped cell's inline editor; a
  // vertical drag is abandoned so the page scrolls normally.
  const onRowPointerDown = (id: string, e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('input,button,[data-no-drag]')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const col = (target.closest('[data-col]') as HTMLElement | null)?.getAttribute('data-col') as
      | EditCol
      | null;
    const startX = e.clientX;
    const startY = e.clientY;
    const startT = Date.now();
    let mode: 'pending' | 'swipe' = 'pending';

    if (swipeRef.current && swipeRef.current.id !== id) setSwipe(null);

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (mode === 'pending') {
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
          mode = 'swipe';
          setEditing(null);
        } else if (Math.abs(dy) > 8) {
          cleanup();
          return;
        }
      }
      if (mode === 'swipe') {
        ev.preventDefault();
        setSwipe({ id, x: Math.max(-96, Math.min(0, dx)) });
      }
    };

    const up = () => {
      if (mode === 'swipe') {
        const x = swipeRef.current && swipeRef.current.id === id ? swipeRef.current.x : 0;
        setSwipe(x < -48 ? { id, x: -88 } : null);
      } else if (Date.now() - startT < 400) {
        // tap
        if (swipeRef.current && swipeRef.current.id === id) setSwipe(null);
        else if (col) setEditing({ id, col });
      }
      cleanup();
    };

    function cleanup() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    }

    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const cellBase = 'flex items-center justify-end px-3 tabular-nums';

  return (
    <div>
      {/* Month navigator */}
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={onPrevMonth}
          className="grid h-11 w-11 place-items-center rounded-full border active:opacity-80"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="text-[17px] font-semibold" style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
          {monthLabel}
        </span>
        <button
          type="button"
          aria-label="Next month"
          onClick={onNextMonth}
          className="grid h-11 w-11 place-items-center rounded-full border active:opacity-80"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* Pay-day incomes for the month */}
      <div className="mb-2 flex items-center justify-between">
        <span
          className="text-[11px] font-medium uppercase"
          style={{ letterSpacing: '0.08em', color: 'var(--color-text-secondary)' }}
        >
          Pay days
        </span>
        <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          Weekly income
        </span>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3">
        {payDays.map((p) => (
          <IncomeField
            key={p.date}
            label={p.label}
            value={p.income}
            onSave={(n) => onSetPayDayIncome(p.date, n)}
          />
        ))}
      </div>

      {/* Income totals */}
      <div className="mb-5 grid grid-cols-2 gap-3">
        <div
          className="rounded-2xl border p-4"
          style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
        >
          <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Monthly income
          </span>
          <span className="text-xl font-bold tabular-nums" style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
            {formatMoney(monthlyIncome)}
          </span>
        </div>
        <div
          className="rounded-2xl border p-4"
          style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
        >
          <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Weekly (avg)
          </span>
          <span className="text-xl font-bold tabular-nums" style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
            {formatMoney(weeklyIncome)}
          </span>
        </div>
      </div>

      {/* Table */}
      <div
        className="overflow-x-auto rounded-2xl border"
        style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
      >
        <div style={{ minWidth: MIN_TABLE_W }}>
          {/* Header */}
          <div
            className="flex items-center border-b"
            style={{ borderColor: 'var(--color-border)', height: '40px' }}
          >
            <div
              className="px-4 text-[11px] font-medium uppercase"
              style={{ width: NAME_W, letterSpacing: '0.04em', color: 'var(--color-text-secondary)' }}
            >
              Group
            </div>
            <div
              className="flex-1 px-3 text-right text-[11px] font-medium uppercase"
              style={{ minWidth: COL_MIN, letterSpacing: '0.04em', color: 'var(--color-text-secondary)' }}
            >
              Monthly
            </div>
            <div
              className="flex-1 px-3 text-right text-[11px] font-medium uppercase"
              style={{ minWidth: COL_MIN, letterSpacing: '0.04em', color: 'var(--color-text-secondary)' }}
            >
              Weekly
            </div>
          </div>

          {/* Rows */}
          {groups.length === 0 ? (
            <div
              className="flex items-center justify-center px-4 py-10 text-center text-[15px]"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              No expense groups yet
            </div>
          ) : (
            groups.map((g) => {
              const swipeX = swipe && swipe.id === g.id ? swipe.x : 0;
              const editName = editing?.id === g.id && editing.col === 'name';
              const editWeekly = editing?.id === g.id && editing.col === 'weekly';
              const editMonthly = editing?.id === g.id && editing.col === 'monthly';
              return (
                <div key={g.id} className="relative select-none border-t" style={{ borderColor: 'var(--color-border)' }}>
                  {/* Delete action behind the row */}
                  <div className="absolute inset-y-0 right-0 flex items-center">
                    <button
                      data-no-drag
                      type="button"
                      onClick={() => {
                        onDelete(g.id);
                        setSwipe(null);
                      }}
                      className="flex h-full items-center px-5 text-sm font-semibold"
                      style={{ background: 'var(--color-danger)', color: '#fff' }}
                    >
                      Delete
                    </button>
                  </div>

                  {/* Foreground row */}
                  <div
                    onPointerDown={(e) => onRowPointerDown(g.id, e)}
                    className="relative flex items-stretch"
                    style={{
                      minHeight: ROW_MIN_H,
                      transform: `translateX(${swipeX}px)`,
                      transition: swipe && swipe.id === g.id ? 'transform 160ms ease' : 'none',
                      background: 'var(--color-bg-elevated)',
                      touchAction: 'pan-y',
                      cursor: 'pointer',
                    }}
                  >
                    {/* Name + color dot */}
                    <div
                      data-col="name"
                      className="flex items-center gap-2.5 px-4 py-2"
                      style={{ width: NAME_W }}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: g.color }}
                      />
                      {editName ? (
                        <NameInput
                          initial={g.name}
                          onCommit={(v) => {
                            if (v && v !== g.name) onRename(g.id, v);
                            setEditing(null);
                          }}
                        />
                      ) : (
                        <span
                          className="min-w-0 flex-1 truncate text-[15px] font-medium"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          {g.name}
                        </span>
                      )}
                    </div>

                    {/* Monthly */}
                    <div data-col="monthly" className={`${cellBase} flex-1`} style={{ minWidth: COL_MIN }}>
                      {editMonthly ? (
                        <CellInput
                          initial={Math.round(monthlyOf(g) * 100) / 100}
                          onCommit={(n) => {
                            if (n !== null) onSaveMonthly(g, n);
                            setEditing(null);
                          }}
                        />
                      ) : (
                        <span className="text-[15px]" style={{ color: 'var(--color-text-primary)' }}>
                          {formatMoney(monthlyOf(g))}
                        </span>
                      )}
                    </div>

                    {/* Weekly */}
                    <div data-col="weekly" className={`${cellBase} flex-1`} style={{ minWidth: COL_MIN }}>
                      {editWeekly ? (
                        <CellInput
                          initial={Math.round(weeklyOf(g) * 100) / 100}
                          onCommit={(n) => {
                            if (n !== null) onSaveWeekly(g, n);
                            setEditing(null);
                          }}
                        />
                      ) : (
                        <span className="text-[15px]" style={{ color: 'var(--color-text-primary)' }}>
                          {formatMoney(weeklyOf(g))}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Footer total */}
          <div
            className="flex items-center border-t"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-overlay)', minHeight: ROW_MIN_H }}
          >
            <div
              className="px-4 text-[15px] font-semibold"
              style={{ width: NAME_W, color: 'var(--color-text-primary)' }}
            >
              Total
            </div>
            <div
              className="flex flex-1 items-center justify-end px-3 text-[15px] font-semibold tabular-nums"
              style={{ minWidth: COL_MIN, color: 'var(--color-text-primary)' }}
            >
              {formatMoney(totals.monthly)}
            </div>
            <div
              className="flex flex-1 items-center justify-end px-3 text-[15px] font-semibold tabular-nums"
              style={{ minWidth: COL_MIN, color: 'var(--color-text-primary)' }}
            >
              {formatMoney(totals.weekly)}
            </div>
          </div>
        </div>
      </div>

      <AddGroupForm onAdd={onAddGroup} />
    </div>
  );
}
