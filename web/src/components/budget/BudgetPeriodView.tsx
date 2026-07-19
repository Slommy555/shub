import { useEffect, useMemo, useRef, useState } from 'react';
import { fromView, toView, TIMEFRAME_FACTOR, TIMEFRAME_LABEL, type Timeframe } from '../../types/budget';
import { useBudgetPeriod } from '../../hooks/budget/useBudgetPeriod';
import { useBudgetGroups } from '../../hooks/budget/useBudgetGroups';
import { useBudgetAllocations } from '../../hooks/budget/useBudgetAllocations';
import { useBudgetSummary } from '../../hooks/budget/useBudgetSummary';
import IncomeInput from './IncomeInput';
import SummaryStrip from './SummaryStrip';
import GroupCard from './GroupCard';
import AddGroupForm from './AddGroupForm';

/** The single persistent budget: income, summary, and editable expense groups. */
export default function BudgetPeriodView({ userId, timeframe }: { userId: string; timeframe: Timeframe }) {
  const factor = TIMEFRAME_FACTOR[timeframe];

  const { period, setIncome } = useBudgetPeriod(userId);
  const groupsApi = useBudgetGroups(userId);
  const allocApi = useBudgetAllocations(userId, period?.id ?? null);
  const summary = useBudgetSummary(period?.income ?? 0, allocApi.allocations, factor);

  // --- gesture state --------------------------------------------------------
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [swipe, setSwipe] = useState<{ id: string; x: number } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [order, setOrder] = useState<string[]>([]);

  const swipeRef = useRef<typeof swipe>(null);
  swipeRef.current = swipe;
  const orderRef = useRef<string[]>([]);
  orderRef.current = order;
  const rowEls = useRef<Map<string, HTMLDivElement>>(new Map());

  // Keep the render order synced with the groups list except mid-drag.
  useEffect(() => {
    if (!dragId) setOrder(groupsApi.groups.map((g) => g.id));
  }, [groupsApi.groups, dragId]);

  const groupById = useMemo(() => new Map(groupsApi.groups.map((g) => [g.id, g])), [groupsApi.groups]);
  const orderedGroups = order.map((id) => groupById.get(id)).filter((g): g is NonNullable<typeof g> => !!g);

  const toggleExpand = (id: string) => {
    setExpandedId((cur) => {
      const next = cur === id ? null : id;
      if (next) void allocApi.ensureAllocation(id);
      return next;
    });
  };

  const rowAt = (y: number): string | null => {
    let best: string | null = null;
    let bestDist = Infinity;
    for (const id of orderRef.current) {
      const el = rowEls.current.get(id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      const d = Math.abs(mid - y);
      if (d < bestDist) {
        bestDist = d;
        best = id;
      }
    }
    return best;
  };

  // Single pointer arbiter per card header: tap → expand, long-press → reorder,
  // horizontal drag → swipe-to-delete, vertical drag → let the page scroll.
  const onHeaderPointerDown = (id: string, e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('input,button,textarea,[data-no-drag]')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startT = Date.now();
    let mode: 'pending' | 'reorder' | 'swipe' = 'pending';

    if (swipeRef.current && swipeRef.current.id !== id) setSwipe(null);

    const longPress = window.setTimeout(() => {
      if (mode === 'pending') {
        mode = 'reorder';
        setDragId(id);
        if ('vibrate' in navigator) {
          try {
            navigator.vibrate(10);
          } catch {
            /* ignore */
          }
        }
      }
    }, 450);

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (mode === 'pending') {
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
          mode = 'swipe';
          window.clearTimeout(longPress);
        } else if (Math.abs(dy) > 8) {
          // vertical scroll — abandon this gesture, let the page scroll
          window.clearTimeout(longPress);
          cleanup();
          return;
        }
      }
      if (mode === 'swipe') {
        ev.preventDefault();
        setSwipe({ id, x: Math.max(-96, Math.min(0, dx)) });
      } else if (mode === 'reorder') {
        ev.preventDefault();
        const overId = rowAt(ev.clientY);
        if (overId && overId !== id) {
          const ids = orderRef.current.slice();
          const from = ids.indexOf(id);
          const to = ids.indexOf(overId);
          if (from !== -1 && to !== -1) {
            ids.splice(from, 1);
            ids.splice(to, 0, id);
            setOrder(ids);
          }
        }
      }
    };

    const up = () => {
      window.clearTimeout(longPress);
      if (mode === 'reorder') {
        void groupsApi.reorder(orderRef.current);
        setDragId(null);
      } else if (mode === 'swipe') {
        const x = swipeRef.current && swipeRef.current.id === id ? swipeRef.current.x : 0;
        setSwipe(x < -48 ? { id, x: -88 } : null);
      } else if (Date.now() - startT < 400) {
        // tap
        if (swipeRef.current && swipeRef.current.id === id) setSwipe(null);
        else toggleExpand(id);
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

  const deleteGroup = (id: string, name: string) => {
    if (window.confirm(`Delete ${name}? This will remove it from all periods.`)) {
      void groupsApi.deleteGroup(id);
      setSwipe(null);
      if (expandedId === id) setExpandedId(null);
    }
  };

  return (
    <div>
      <IncomeInput
        label={`${TIMEFRAME_LABEL[timeframe]} income`}
        value={toView(period?.income ?? 0, timeframe)}
        onSave={(n) => setIncome(fromView(n, timeframe))}
      />
      <SummaryStrip summary={summary} />

      {/* Expense groups */}
      {orderedGroups.length === 0 ? (
        <div className="flex flex-col items-center gap-1 py-12 text-center">
          <p className="text-[17px]" style={{ color: 'var(--color-text-tertiary)' }}>
            No expense groups yet
          </p>
          <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            Tap the button below to add your first group
          </p>
        </div>
      ) : (
        <div>
          {orderedGroups.map((g) => (
            <GroupCard
              key={g.id}
              group={g}
              amount={toView(allocApi.allocations[g.id]?.amount ?? 0, timeframe)}
              expanded={expandedId === g.id}
              swipeX={swipe && swipe.id === g.id ? swipe.x : 0}
              dragging={dragId === g.id}
              onHeaderPointerDown={(e) => onHeaderPointerDown(g.id, e)}
              onChangeAmount={(n) => allocApi.setAmount(g.id, fromView(n, timeframe))}
              onChangeName={(name) => groupsApi.updateGroup(g.id, { name })}
              onChangeColor={(color) => groupsApi.updateGroup(g.id, { color })}
              onDelete={() => deleteGroup(g.id, g.name)}
              rowRef={(el) => {
                if (el) rowEls.current.set(g.id, el);
                else rowEls.current.delete(g.id);
              }}
            />
          ))}
        </div>
      )}

      <AddGroupForm onAdd={groupsApi.addGroup} />
    </div>
  );
}
