import { useRef, useState } from 'react';
import type { Budget } from '../../types/budget';

interface Props {
  budgets: Budget[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

/**
 * Budget switcher: `[←] [ Name ▾ ] [→]`. Arrows cycle through budgets; tapping
 * the name opens a picker sheet to switch, create, rename, or delete a budget.
 */
export default function BudgetSwitcher({ budgets, activeId, onSelect, onCreate, onRename, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const longPressRef = useRef<number | null>(null);
  const firedRef = useRef(false);

  const active = budgets.find((b) => b.id === activeId) ?? budgets[0] ?? null;
  const idx = active ? budgets.findIndex((b) => b.id === active.id) : -1;

  const cycle = (dir: -1 | 1) => {
    if (budgets.length < 2 || idx < 0) return;
    const next = (idx + dir + budgets.length) % budgets.length;
    onSelect(budgets[next].id);
  };

  const submitCreate = () => {
    const n = newName.trim();
    if (!n) return;
    onCreate(n);
    setNewName('');
    setCreating(false);
    setOpen(false);
  };

  // Long-press a row → rename/delete action prompt; a plain tap switches.
  const startLongPress = (b: Budget) => {
    firedRef.current = false;
    if (longPressRef.current) window.clearTimeout(longPressRef.current);
    longPressRef.current = window.setTimeout(() => {
      longPressRef.current = null;
      firedRef.current = true;
      const action = window.prompt(
        `Manage "${b.name}"\n\nType R to rename, D to delete, or Cancel.`,
        'R'
      );
      if (!action) return;
      const a = action.trim().toLowerCase();
      if (a === 'r') {
        const name = window.prompt('Rename budget', b.name);
        if (name && name.trim()) onRename(b.id, name.trim());
      } else if (a === 'd') {
        if (budgets.length <= 1) {
          window.alert('You can’t delete your only budget.');
          return;
        }
        if (window.confirm(`This will permanently delete all data in "${b.name}". Continue?`)) {
          onDelete(b.id);
        }
      }
    }, 500);
  };
  const cancelLongPress = () => {
    if (longPressRef.current) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          aria-label="Previous budget"
          onClick={() => cycle(-1)}
          disabled={budgets.length < 2}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border active:opacity-80 disabled:opacity-40"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full border py-2.5 text-[15px] font-semibold active:opacity-80"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)' }}
        >
          <span className="truncate">{active?.name ?? 'Budget'}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        <button
          type="button"
          aria-label="Next budget"
          onClick={() => cycle(1)}
          disabled={budgets.length < 2}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border active:opacity-80 disabled:opacity-40"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => {
            setOpen(false);
            setCreating(false);
          }}
        >
          <div
            className="w-full max-w-app rounded-t-3xl border p-4 sm:rounded-3xl"
            style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-3 px-1 text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
              Budgets
            </h2>
            <div className="mb-3 flex max-h-[50vh] flex-col gap-1 overflow-y-auto">
              {budgets.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    cancelLongPress();
                    if (firedRef.current) {
                      firedRef.current = false;
                      return; // long-press already handled this row
                    }
                    onSelect(b.id);
                    setOpen(false);
                  }}
                  onPointerDown={() => startLongPress(b)}
                  onPointerUp={cancelLongPress}
                  onPointerLeave={cancelLongPress}
                  className="flex items-center justify-between rounded-xl px-3 py-3 text-left text-[15px] font-medium active:opacity-80"
                  style={{
                    background: b.id === active?.id ? 'var(--color-accent-subtle)' : 'var(--color-bg-surface)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  <span className="truncate">{b.name}</span>
                  {b.id === active?.id && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </button>
              ))}
            </div>

            <p className="mb-3 px-1 text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
              Long-press a budget to rename or delete it.
            </p>

            {creating ? (
              <div className="flex gap-2">
                <input
                  autoFocus
                  placeholder="Budget name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitCreate();
                  }}
                  className="min-w-0 flex-1 rounded-xl border px-3 text-base outline-none"
                  style={{ height: '48px', background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                />
                <button
                  type="button"
                  onClick={submitCreate}
                  className="rounded-full px-5 text-sm font-semibold"
                  style={{ background: 'var(--color-accent)', color: 'var(--color-accent-text)', minHeight: '48px' }}
                >
                  Create
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="w-full rounded-full py-3.5 text-sm font-semibold active:opacity-85"
                style={{ background: 'var(--color-accent)', color: 'var(--color-accent-text)', minHeight: '48px' }}
              >
                + New budget
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
