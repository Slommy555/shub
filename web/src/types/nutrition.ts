/** A food logged against a specific day, already resolved to what was eaten. */
export interface NutritionLog {
  id: string;
  user_id: string;
  food_name: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  /** Free text the user typed ("1 cup", "half the bag") — not parsed. */
  serving_size: string | null;
  logged_at: string; // YYYY-MM-DD
  created_at: string;
}

/** The user's daily targets. One row per user; absent until they set them. */
export interface NutritionGoals {
  id: string;
  user_id: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
}

/** The four numbers every part of the tab passes around. */
export interface Macros {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

/** One label within a scan, already scaled to the amount eaten of THAT label. */
export interface ScanItem extends Macros {
  food_name: string;
  /** The free text the user typed under this image. */
  amount: string;
}

/** Where a described item's macros came from, in descending trustworthiness. */
export type MacroSource = 'usda' | 'open_food_facts' | 'estimate';

/** One food Claude pulled out of a free-text meal description, before lookup. */
export interface ParsedFoodItem {
  /** Clean food name — "grilled chicken breast", not "some chicken". */
  item: string;
  quantity: number;
  /** g, oz, cup, piece, slice, tbsp … */
  unit: string;
  /** Claude's conversion of quantity+unit to grams — what the macros scale by. */
  quantity_grams: number;
  /** Branded/restaurant items go to Open Food Facts; generic ones to USDA. */
  is_branded: boolean;
  /** Simplified 2–4 word term for the database lookup. */
  search_query: string;
}

/** A parsed item resolved against a source and scaled to the amount eaten. */
export interface MealItem extends Macros {
  /** Stable across edits so React keys and row expansion survive a re-render. */
  id: string;
  name: string;
  /** "200g", "1 cup", "1 piece" — for display only. */
  quantity_display: string;
  quantity_grams: number;
  source: MacroSource;
  /** What the database called the match, when it differs from `name`. */
  matched_name: string | null;
}

/** What the vision call returns for a scan of one or more labels. */
export interface ScanResult extends Macros {
  /** A short name for the combined meal. */
  food_name: string;
  /** Per-label breakdown, in the order the images were sent. */
  items: ScanItem[];
  confidence: 'high' | 'medium' | 'low';
  /** A caveat worth surfacing ("label partially obscured"), or null. */
  note: string | null;
}
