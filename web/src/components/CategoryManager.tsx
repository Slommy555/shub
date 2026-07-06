import { useState } from 'react';
import { COLOR_DOT, COLOR_KEYS, type CategoryRecord, type ColorKey } from '../types';
import { useApp } from '../context/AppContext';

function ColorPicker({ value, onChange }: { value: ColorKey; onChange: (c: ColorKey) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {COLOR_KEYS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={c}
          className={[
            'h-5 w-5 rounded-full transition-transform',
            COLOR_DOT[c],
            value === c ? 'ring-2 ring-offset-1 ring-gray-500 dark:ring-offset-gray-900' : 'hover:scale-110',
          ].join(' ')}
        />
      ))}
    </div>
  );
}

function CategoryRow({ cat, canDelete }: { cat: CategoryRecord; canDelete: boolean }) {
  const { categories } = useApp();
  const [name, setName] = useState(cat.name);

  function commitName() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== cat.name) categories.updateCategory(cat.id, { name: trimmed });
    else setName(cat.name);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-100 px-2 py-2 dark:border-gray-800">
      <span className={`h-3 w-3 shrink-0 rounded-full ${COLOR_DOT[cat.color]}`} />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm outline-none hover:border-gray-200 focus:border-gray-500 dark:hover:border-gray-700"
      />
      <ColorPicker value={cat.color} onChange={(color) => categories.updateCategory(cat.id, { color })} />
      <button
        type="button"
        disabled={!canDelete}
        onClick={() => categories.deleteCategory(cat.id)}
        title={canDelete ? 'Delete category' : 'Keep at least one category'}
        className="grid h-7 w-7 place-items-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-red-500/10"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        </svg>
      </button>
    </div>
  );
}

export default function CategoryManager() {
  const { categories } = useApp();
  const list = categories.categories;
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<ColorKey>('indigo');

  function add() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    categories.addCategory(trimmed, newColor);
    setNewName('');
    setNewColor('indigo');
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-1 text-sm font-semibold text-gray-700 dark:text-gray-200">Categories</h2>
      <p className="mb-3 text-xs text-gray-400">
        Rename, recolor, add, or delete. Renaming updates every task using it.
      </p>

      <div className="space-y-2">
        {list.map((cat) => (
          <CategoryRow key={cat.id} cat={cat} canDelete={list.length > 1} />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="New category…"
          className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500 dark:border-gray-700 dark:bg-gray-950"
        />
        <ColorPicker value={newColor} onChange={setNewColor} />
        <button
          type="button"
          onClick={add}
          className="rounded-lg bg-gray-800 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-700"
        >
          Add
        </button>
      </div>
    </section>
  );
}
