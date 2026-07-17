// Placeholder for the Budget tab. The previous Budget Tracker was gutted for a
// full rebuild; this renders a bare screen so the tab and its nav entry stay
// live without any of the old feature code. Supabase tables are left untouched.
export default function BudgetTab(_: { userId: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-gray-50 dark:bg-gray-950">
      <span className="text-gray-500 dark:text-gray-400">Budget</span>
    </div>
  );
}
