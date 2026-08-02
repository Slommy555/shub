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
