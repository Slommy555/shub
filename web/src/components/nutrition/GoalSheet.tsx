import { useState } from 'react';
import Sheet from './Sheet';
import type { Macros, NutritionGoals } from '../../types/nutrition';

const FIELDS: { key: keyof Macros; label: string }[] = [
  { key: 'calories', label: 'Calorie goal' },
  { key: 'protein_g', label: 'Protein goal (g)' },
  { key: 'carbs_g', label: 'Carbs goal (g)' },
  { key: 'fat_g', label: 'Fat goal (g)' },
];

/** Four numbers, one save. Leaving a field at 0 hides that column's progress. */
export default function GoalSheet({
  goals,
  onSave,
  onClose,
}: {
  goals: NutritionGoals | null;
  onSave: (next: Macros) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Macros>({
    calories: Number(goals?.calories ?? 0),
    protein_g: Number(goals?.protein_g ?? 0),
    carbs_g: Number(goals?.carbs_g ?? 0),
    fat_g: Number(goals?.fat_g ?? 0),
  });

  const set = (key: keyof Macros, raw: string) => {
    const n = raw === '' ? 0 : parseFloat(raw);
    setDraft((prev) => ({ ...prev, [key]: Number.isFinite(n) && n >= 0 ? n : 0 }));
  };

  return (
    <Sheet title="Daily goals" onClose={onClose}>
      <div className="space-y-3">
        {FIELDS.map((f) => (
          <label key={f.key} className="flex items-center gap-3">
            <span className="flex-1 text-[15px]" style={{ color: 'var(--color-text-secondary)' }}>
              {f.label}
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={String(draft[f.key])}
              onChange={(e) => set(f.key, e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              className="w-32 shrink-0 rounded-xl border px-3 text-right text-[15px] font-semibold tabular-nums outline-none"
              style={{
                background: 'var(--color-bg-surface)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-primary)',
                height: 44,
              }}
            />
          </label>
        ))}
      </div>

      <button
        type="button"
        onClick={() => {
          onSave(draft);
          onClose();
        }}
        className="mt-5 w-full rounded-full text-[15px] font-semibold transition-transform active:scale-[0.98]"
        style={{ background: 'var(--color-accent)', color: 'var(--color-accent-text)', height: 48 }}
      >
        Save goals
      </button>
    </Sheet>
  );
}
