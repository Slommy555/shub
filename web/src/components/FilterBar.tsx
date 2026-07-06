import { CATEGORIES, type Category, type FilterKind } from '../types';

interface Props {
  filter: FilterKind;
  onChange: (filter: FilterKind) => void;
}

function isActive(filter: FilterKind, pill: FilterKind): boolean {
  if (filter.type !== pill.type) return false;
  if (filter.type === 'category' && pill.type === 'category') {
    return filter.value === pill.value;
  }
  return true;
}

const basePills: { label: string; value: FilterKind }[] = [
  { label: 'All', value: { type: 'all' } },
  { label: 'Active', value: { type: 'active' } },
  { label: 'Done', value: { type: 'done' } },
  { label: 'High priority', value: { type: 'high' } },
];

const categoryLabel: Record<Category, string> = {
  work: 'Work',
  personal: 'Personal',
  school: 'School',
  health: 'Health',
  other: 'Other',
};

export default function FilterBar({ filter, onChange }: Props) {
  const pill = (label: string, value: FilterKind) => {
    const active = isActive(filter, value);
    return (
      <button
        key={label}
        type="button"
        onClick={() => onChange(value)}
        className={[
          'whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
          active
            ? 'bg-gray-800 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
        ].join(' ')}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex flex-wrap gap-2">
      {basePills.map((p) => pill(p.label, p.value))}
      {CATEGORIES.map((c) => pill(categoryLabel[c], { type: 'category', value: c }))}
    </div>
  );
}
