import type {
  ReminderReviewModel,
  ReviewModel,
  WeightReviewModel,
} from '../../lib/claudeRouter';
import HabitConfirmCard from './HabitConfirmCard';
import WorkoutStartCard from './WorkoutStartCard';
import WeightConfirmCard from './WeightConfirmCard';
import ReminderConfirmCard from './ReminderConfirmCard';

interface Props {
  review: ReviewModel;
  onChange: (patch: Partial<ReviewModel>) => void;
}

/**
 * The habit / workout / weight / reminder sections of a voice review. Rendered
 * inside VoicePopup alongside the existing task sections so the user reviews
 * everything in one place before confirming. Purely presentational — the parent
 * owns the ReviewModel state and runs the handlers on confirm.
 */
export default function NewActionSections({ review, onChange }: Props) {
  const patchReminder = (id: string, rp: Partial<ReminderReviewModel>) =>
    onChange({ reminders: review.reminders.map((r) => (r.id === id ? { ...r, ...rp } : r)) });
  const patchWeight = (wp: Partial<WeightReviewModel>) =>
    onChange({ weight: review.weight ? { ...review.weight, ...wp } : null });

  return (
    <>
      {/* Habits */}
      {review.habits && review.habits.targets.length > 0 && (
        <Section title="Habits to complete" onDismiss={() => onChange({ habits: null })}>
          <HabitConfirmCard
            model={review.habits}
            onRemoveTarget={(id) =>
              onChange({
                habits: review.habits
                  ? { ...review.habits, targets: review.habits.targets.filter((h) => h.id !== id) }
                  : null,
              })
            }
          />
        </Section>
      )}

      {/* Workout */}
      {review.workout && (
        <Section title="Workout to start">
          <WorkoutStartCard model={review.workout} onDismiss={() => onChange({ workout: null })} />
        </Section>
      )}

      {/* Weight */}
      {review.weight && (
        <Section title="Weight to log">
          <WeightConfirmCard
            model={review.weight}
            onChange={patchWeight}
            onDismiss={() => onChange({ weight: null })}
          />
        </Section>
      )}

      {/* Reminders */}
      {review.reminders.length > 0 && (
        <Section title="Reminders to set" onDismiss={() => onChange({ reminders: [] })}>
          <div className="space-y-2">
            {review.reminders.map((r) => (
              <ReminderConfirmCard
                key={r.id}
                model={r}
                onChange={(rp) => patchReminder(r.id, rp)}
                onDismiss={() => onChange({ reminders: review.reminders.filter((x) => x.id !== r.id) })}
              />
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

function Section({
  title,
  onDismiss,
  children,
}: {
  title: string;
  onDismiss?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{title}</p>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-[11px] font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            Dismiss
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
