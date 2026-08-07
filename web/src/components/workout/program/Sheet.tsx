import { useEffect } from 'react';

/**
 * A bottom sheet, per UI_SKILL.md: elevated background, 20px top radius, a drag
 * handle, and a blurred scrim. Escape and a scrim tap both close it.
 */
export default function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="sheet-enter relative w-full max-w-lg overflow-y-auto px-4 pb-6 pt-3 sm:mx-4 sm:rounded-2xl"
        style={{
          background: 'var(--color-bg-elevated)',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          maxHeight: '86vh',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px var(--color-border-strong)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)',
        }}
      >
        <div
          className="mx-auto mb-4 h-1 w-9 rounded-sm"
          style={{ background: 'var(--color-bg-overlay)' }}
        />
        <h2
          className="mb-4 text-[17px] font-semibold"
          style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}
        >
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
