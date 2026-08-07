import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { watchUserPrefs } from '../lib/userPrefs';

/** Every widget the Home tab can show, in the order it ships with. */
export const HOME_CARDS = ['program', 'habits', 'tasks', 'weight', 'events', 'budget'] as const;

export type HomeCardId = (typeof HOME_CARDS)[number];

const STORAGE_KEY = 'home.layout';

const isCardId = (v: unknown): v is HomeCardId =>
  typeof v === 'string' && (HOME_CARDS as readonly string[]).includes(v);

/**
 * Coerce anything stored into a usable order: keep the saved ids (de-duplicated,
 * unknown ones dropped) and append any card the saved layout doesn't mention.
 * That way a layout saved today still works after a new widget ships tomorrow.
 */
function normalize(value: unknown): HomeCardId[] {
  const saved = Array.isArray(value) ? value.filter(isCardId) : [];
  const seen = new Set<HomeCardId>();
  const out: HomeCardId[] = [];
  for (const id of saved) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  for (const id of HOME_CARDS) if (!seen.has(id)) out.push(id);
  return out;
}

function loadCached(): HomeCardId[] {
  if (typeof window === 'undefined') return [...HOME_CARDS];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return normalize(raw ? JSON.parse(raw) : null);
  } catch {
    return [...HOME_CARDS];
  }
}

/**
 * The user's Home widget order, cached in localStorage for an instant first
 * paint and synced through `user_preferences.home_layout` so an arrangement made
 * on the desktop follows to the phone. Writes are optimistic.
 */
export function useHomeLayout(userId: string | null) {
  const [order, setOrder] = useState<HomeCardId[]>(loadCached);

  const applyValue = useCallback((value: unknown) => {
    const next = normalize(value);
    setOrder(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota errors */
    }
  }, []);

  // Initial load.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('home_layout')
        .eq('user_id', userId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error('Failed to load home layout:', error.message);
        return;
      }
      // A user who has never rearranged has no row / a null column — leave the
      // default order in place rather than writing one out.
      if (data && data.home_layout != null) applyValue(data.home_layout);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, applyValue]);

  // Realtime + focus/visibility reconnect, like the other preferences.
  useEffect(() => {
    if (!userId) return;
    return watchUserPrefs(userId, 'home', (row) => {
      if (row.home_layout != null) applyValue(row.home_layout);
    });
  }, [userId, applyValue]);

  const save = useCallback(
    (next: HomeCardId[]) => {
      applyValue(next); // optimistic + cached
      if (!userId) return;
      void supabase
        .from('user_preferences')
        .upsert(
          { user_id: userId, home_layout: next, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        )
        .then(({ error }) => {
          if (error) console.error('Failed to save home layout:', error.message);
        });
    },
    [userId, applyValue]
  );

  const reset = useCallback(() => save([...HOME_CARDS]), [save]);

  return { order, save, reset };
}
