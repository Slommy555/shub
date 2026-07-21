import { useState } from 'react';
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

  const renameBudget = (b: Budget) => {
    const name = window.prompt('Rename budget', b.name);
    if (name && name.trim() && name.trim() !== b.name) onRename(b.id, name.trim());
  };
  const deleteBudget = (b: Budget) => {
    if (budgets.length <= 1) {
      window.alert('You can’t delete your only budget.');
      return;
    }
    if (window.confirm(`This will permanently delete all data in "${b.name}". Continue?`)) onDelete(b.id);
  };

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          aria-label="Previous budget"
          onClick={() => cycle(-1)}
          disabled={budgets.length < 2}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border active:opacity-80 disabled:opacity-40"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-[15px] font-semibold active:opacity-80"
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
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border active:opacity-80 disabled:opacity-40"
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
                <div
                  key={b.id}
                  className="flex items-center gap-1 rounded-xl pr-1"
                  style={{ background: b.id === active?.id ? 'var(--color-accent-subtle)' : 'var(--color-bg-surface)' }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(b.id);
                      setOpen(false);
                    }}
                    className="flex min-w-0 flex-1 items-center justify-between px-3 py-3 text-left text-[15px] font-medium active:opacity-80"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    <span className="truncate">{b.name}</span>
                    {b.id === active?.id && (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label={`Rename ${b.name}`}
                    onClick={() => renameBudget(b)}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg active:opacity-70"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${b.name}`}
                    onClick={() => deleteBudget(b)}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg active:opacity-70"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                      <path d="M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            <p className="mb-3 px-1 text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
              Use the pencil to rename a budget, or the trash to delete it.
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
                  className="rounded-xl px-5 text-sm font-semibold"
                  style={{ background: 'var(--color-accent)', color: 'var(--color-accent-text)', minHeight: '48px' }}
                >
                  Create
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="w-full rounded-xl py-3.5 text-sm font-semibold active:opacity-85"
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
