import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * One draggable slot in the Home grid.
 *
 * The whole tile is the drag target, which is only safe because rearranging is
 * an explicit mode: while it's on, the card's own contents are made
 * non-interactive, so a drag can never land on a checkbox or an input. Outside
 * that mode this renders a plain div with no drag machinery attached at all.
 */
export default function SortableCard({
  id,
  className = '',
  children,
}: {
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`relative h-full cursor-grab rounded-2xl active:cursor-grabbing ${className}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        // The tile being dragged floats above its neighbours as they shuffle.
        zIndex: isDragging ? 30 : undefined,
        opacity: isDragging ? 0.9 : 1,
        boxShadow: isDragging ? '0 12px 40px -12px rgba(0,0,0,0.5)' : undefined,
        outline: '2px dashed var(--color-accent-muted)',
        outlineOffset: 2,
      }}
    >
      {/* Swallows clicks so dragging can't toggle a habit or open the Budget
          tab. h-full passes the stretched grid height down to the card. */}
      <div className="pointer-events-none h-full select-none">{children}</div>

      <span
        aria-hidden
        className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-lg"
        style={{ background: 'var(--color-bg-overlay)', color: 'var(--color-text-secondary)' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.6" />
          <circle cx="15" cy="6" r="1.6" />
          <circle cx="9" cy="12" r="1.6" />
          <circle cx="15" cy="12" r="1.6" />
          <circle cx="9" cy="18" r="1.6" />
          <circle cx="15" cy="18" r="1.6" />
        </svg>
      </span>
    </div>
  );
}
