import { useState } from 'react';
import Sheet from './Sheet';
import MacroResultCard, { type MacroDraft } from './MacroResultCard';
import type { NutritionLog } from '../../types/nutrition';

/** Edit an already-logged entry using the same card the scanner result uses. */
export default function EditLogSheet({
  log,
  onSave,
  onClose,
}: {
  log: NutritionLog;
  onSave: (id: string, patch: Partial<NutritionLog>) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<MacroDraft>({
    food_name: log.food_name ?? '',
    calories: Number(log.calories),
    protein_g: Number(log.protein_g),
    carbs_g: Number(log.carbs_g),
    fat_g: Number(log.fat_g),
  });

  return (
    <Sheet title="Edit entry" onClose={onClose}>
      <MacroResultCard
        draft={draft}
        onChange={setDraft}
        serving={log.serving_size}
        primaryLabel="Save changes"
        onPrimary={() => {
          onSave(log.id, { ...draft, food_name: draft.food_name.trim() || 'Unknown Food' });
          onClose();
        }}
      />
    </Sheet>
  );
}
