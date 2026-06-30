import { useCallback, useEffect, useRef, useState } from 'react';
import type { Priority } from '../../types';
import type {
  ProposedDeletion,
  ProposedReschedule,
  ProposedTask,
  ProposedWorkShift,
} from '../../types/voice';
import { useApp } from '../../context/AppContext';
import { VoiceProvider } from '../../context/VoiceContext';
import { useVoiceSettings } from '../../hooks/useVoiceSettings';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useSpeechRecognition, type StopReason } from '../../hooks/useSpeechRecognition';
import {
  parseTranscript,
  voiceEnabled,
  type DayLoad,
  type ExistingTaskRef,
  type ParsedTask,
  type WorkShiftRef,
} from '../../lib/anthropic';
import { addDays, parseISO, todayISO } from '../../lib/dates';
import { listDate } from '../../lib/taskOrder';
import { gatherIntentContext, parseIntents } from '../../lib/intent';
import { emptyReview, prepareReview, type ReviewModel } from '../../lib/claudeRouter';
import { matchScore } from '../../lib/fuzzy';
import {
  handleCompleteHabits,
  handleLogWeight,
  handleSetReminder,
  handleStartWorkout,
} from '../../lib/claudeActions';
import SettingsDrawer from '../SettingsDrawer';
import VoicePopup from './VoicePopup';
import MicFab from './MicFab';

const DRAFT_KEY = 'voiceDraft';
const VALID_PRIORITIES: Priority[] = ['high', 'med', 'low'];
const WORKLOAD_DAYS = 21;
// Weighted by time consumption: Long = 3, Medium = 2, Quick = 1.
const LOAD_WEIGHT: Record<Priority, number> = { high: 3, med: 2, low: 1 };
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const validTime = (t: unknown): t is string => typeof t === 'string' && HHMM.test(t);

/** Duration of a shift in hours; end <= start means it crosses midnight. */
function shiftDuration(start: string, end: string): { hours: number; overnight: boolean } {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const s = sh * 60 + sm;
  let e = eh * 60 + em;
  let overnight = false;
  if (e <= s) {
    e += 24 * 60;
    overnight = true;
  }
  return { hours: (e - s) / 60, overnight };
}

/**
 * The always-on voice listener + review pipeline, mounted once at the app shell
 * so the keyword popup can appear on any tab. Provides VoiceContext for the
 * Voice tab's manual controls.
 */
export default function VoiceController({
  children,
  userId,
  onNavigate,
}: {
  children: React.ReactNode;
  userId: string;
  onNavigate: (tab: 'workout') => void;
}) {
  const { categories, tasks, addTasks, updateTask, deleteTask } = useApp();
  const cats = categories.categories;
  const defaultCategory = cats[0]?.name ?? 'other';

  const { settings, setWorkShift } = useVoiceSettings();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [reviewing, setReviewing] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [proposed, setProposed] = useState<ProposedTask[]>([]);
  const [reschedules, setReschedules] = useState<ProposedReschedule[]>([]);
  const [deletions, setDeletions] = useState<ProposedDeletion[]>([]);
  const [workShifts, setWorkShifts] = useState<ProposedWorkShift[]>([]);
  // App-wide actions (habits/workout/weight/reminders) from the second pass.
  const [extras, setExtras] = useState<ReviewModel>(emptyReview);
  const [finalTranscript, setFinalTranscript] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 3500);
  }, []);

  /** Split Claude's response into new tasks, moves, and work-schedule changes. */
  const mapResult = useCallback(
    (
      items: ParsedTask[]
    ): {
      tasks: ProposedTask[];
      moves: ProposedReschedule[];
      removals: ProposedDeletion[];
      shifts: ProposedWorkShift[];
    } => {
      const newTasks: ProposedTask[] = [];
      const moves: ProposedReschedule[] = [];
      const removals: ProposedDeletion[] = [];
      const shifts: ProposedWorkShift[] = [];
      for (const it of items) {
        // A work directive updates the recurring schedule (not a task).
        if (it.work_shift && Array.isArray(it.work_shift.weekdays)) {
          const weekdays = it.work_shift.weekdays.filter(
            (n): n is number => typeof n === 'number' && n >= 0 && n <= 6
          );
          if (weekdays.length === 0) continue;
          shifts.push({
            id: crypto.randomUUID(),
            weekdays,
            start: validTime(it.work_shift.start) ? it.work_shift.start : '09:00',
            end: validTime(it.work_shift.end) ? it.work_shift.end : '17:00',
          });
          continue;
        }
        // A delete item carries the id of an existing task to remove.
        if (it.delete_id) {
          const existing = tasks.find((t) => t.id === it.delete_id);
          if (!existing) continue;
          // Don't double-list the same task.
          if (removals.some((r) => r.taskId === existing.id)) continue;
          removals.push({
            id: crypto.randomUUID(),
            taskId: existing.id,
            taskText: existing.text,
            reason: typeof it.reason === 'string' ? it.reason : '',
          });
          continue;
        }
        // A reschedule item carries the id of an existing task to move.
        if (it.reschedule_id) {
          const existing = tasks.find((t) => t.id === it.reschedule_id);
          const to =
            typeof it.scheduled_date === 'string' && it.scheduled_date ? it.scheduled_date : null;
          if (!existing || !to) continue;
          const from = listDate(existing);
          if (to === from) continue; // no-op move
          moves.push({
            id: crypto.randomUUID(),
            taskId: existing.id,
            taskText: existing.text,
            from,
            to,
            reason: typeof it.reason === 'string' ? it.reason : '',
          });
          continue;
        }
        newTasks.push({
          id: crypto.randomUUID(),
          text: typeof it.text === 'string' ? it.text : '',
          category: cats.some((c) => c.name === it.category) ? it.category : defaultCategory,
          priority: VALID_PRIORITIES.includes(it.priority) ? it.priority : 'med',
          due_date: typeof it.due_date === 'string' && it.due_date ? it.due_date : null,
          scheduled_date:
            typeof it.scheduled_date === 'string' && it.scheduled_date ? it.scheduled_date : null,
          start_time: validTime(it.start_time) ? it.start_time : null,
          end_time: validTime(it.end_time) ? it.end_time : null,
          subtasks: Array.isArray(it.subtasks)
            ? it.subtasks.filter((s): s is string => typeof s === 'string')
            : [],
          unsure: it.unsure && typeof it.unsure === 'object' ? it.unsure : {},
        });
      }
      return { tasks: newTasks, moves, removals, shifts };
    },
    [cats, defaultCategory, tasks]
  );

  const buildWorkload = useCallback((): DayLoad[] => {
    const loadMap = new Map<string, number>();
    for (const t of tasks) {
      const d = listDate(t);
      if (d) loadMap.set(d, (loadMap.get(d) ?? 0) + (LOAD_WEIGHT[t.priority] ?? 1));
    }
    const start = todayISO();
    return Array.from({ length: WORKLOAD_DAYS }, (_, i) => {
      const date = addDays(start, i);
      const dow = parseISO(date).getDay();
      const isWorkDay = settings.workDays.includes(dow);
      const cfg = isWorkDay ? settings.shifts[dow] : undefined;
      let shift: string | null = null;
      let overnight = false;
      let workHours = 0;
      if (cfg) {
        const dur = shiftDuration(cfg.start, cfg.end);
        workHours = dur.hours;
        overnight = dur.overnight;
        shift = `${cfg.start}–${cfg.end}`;
      }
      const freeHours = Math.max(0, Math.round(24 - workHours - settings.sleepHours));
      return { date, load: loadMap.get(date) ?? 0, isWorkDay, shift, overnight, freeHours };
    });
  }, [tasks, settings.workDays, settings.shifts, settings.sleepHours]);

  // Upcoming, still-open scheduled tasks Claude is allowed to rearrange.
  const buildExisting = useCallback((): ExistingTaskRef[] => {
    const start = todayISO();
    const end = addDays(start, WORKLOAD_DAYS);
    return tasks
      .filter((t) => {
        if (t.done) return false;
        const d = listDate(t);
        return d != null && d >= start && d < end;
      })
      .map((t) => ({
        id: t.id,
        text: t.text,
        scheduled_date: listDate(t),
        due_date: t.due_date ?? null,
        priority: t.priority,
      }));
  }, [tasks]);

  // The user's current recurring work schedule, so Claude won't re-add shifts.
  const buildWorkShifts = useCallback(
    (): WorkShiftRef[] =>
      settings.workDays
        .filter((d) => settings.shifts[d])
        .map((d) => ({ weekday: d, start: settings.shifts[d].start, end: settings.shifts[d].end })),
    [settings.workDays, settings.shifts]
  );

  const runParse = useCallback(
    async (text: string) => {
      setParsing(true);
      setParseError(null);
      setReviewing(true);

      // Pass 1 — the existing task/scheduling brain (unchanged). Drives the
      // primary error UI since it owns the core to-do flow.
      const taskPass = (async () => {
        const items = await parseTranscript(text, {
          categories: cats.map((c) => c.name),
          today: todayISO(),
          workload: buildWorkload(),
          workDayLabels: settings.workDays.map((d) => WEEKDAY_NAMES[d]),
          sleepHours: settings.sleepHours,
          existingTasks: buildExisting(),
          workShifts: buildWorkShifts(),
        });
        return mapResult(items);
      })();

      // Pass 2 — app-wide actions (habits/workout/weight/reminders). Purely
      // additive, so its failures are non-fatal and never block the task review.
      const actionPass = (async (): Promise<ReviewModel> => {
        try {
          const ctx = await gatherIntentContext();
          const actions = await parseIntents(text, ctx);
          return await prepareReview(actions, ctx);
        } catch (err) {
          console.error('App-wide actions parse failed:', err);
          return emptyReview();
        }
      })();

      const [taskResult, actionResult] = await Promise.allSettled([taskPass, actionPass]);

      const review = actionResult.status === 'fulfilled' ? actionResult.value : emptyReview();

      let mapped = mapResult([]);
      if (taskResult.status === 'fulfilled') {
        mapped = taskResult.value;
      } else {
        const err = taskResult.reason;
        setParseError(err instanceof Error ? err.message : 'Something went wrong.');
        showToast('Couldn’t parse that — your transcript is saved, try again.');
      }

      // The reminder system owns reminders; if the actions pass captured any,
      // drop a task the task pass produced that's really the same reminder.
      let proposedTasks = mapped.tasks;
      if (review.reminders.length) {
        proposedTasks = proposedTasks.filter(
          (t) => !review.reminders.some((r) => matchScore(t.text, r.text) >= 0.5)
        );
      }

      setProposed(proposedTasks);
      setReschedules(mapped.moves);
      setDeletions(mapped.removals);
      setWorkShifts(mapped.shifts);
      setExtras(review);
      setParsing(false);
    },
    [
      cats,
      mapResult,
      buildWorkload,
      buildExisting,
      buildWorkShifts,
      settings.workDays,
      settings.sleepHours,
      showToast,
    ]
  );

  const handleCaptureComplete = useCallback(
    (text: string, reason: StopReason) => {
      if (reason === 'inactivity') showToast('Recording stopped due to inactivity');
      if (!text.trim()) {
        setFinalTranscript('');
        setReviewing(false);
        return;
      }
      setFinalTranscript(text);
      runParse(text);
    },
    [runParse, showToast]
  );

  const speech = useSpeechRecognition({
    startKeyword: settings.startKeyword,
    stopKeyword: settings.stopKeyword,
    onCaptureComplete: handleCaptureComplete,
    // Mobile uses the tap-to-record FAB only — never the always-on listener.
    keywordsEnabled: !isMobile,
  });

  // Always-on keyword listener for the whole session (desktop only). On mobile
  // the recognizer is started on demand by the corner mic button instead, so we
  // never hold the mic open in the background.
  const { supported, startListening, stopListening } = speech;
  useEffect(() => {
    if (!supported || !voiceEnabled || isMobile) return;
    startListening();
    return () => stopListening();
  }, [supported, isMobile, startListening, stopListening]);

  // Restore an in-progress review draft (survives reloads/tab switches).
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft && Array.isArray(draft.proposed)) {
        setFinalTranscript(draft.finalTranscript ?? '');
        setProposed(draft.proposed);
        setReschedules(Array.isArray(draft.reschedules) ? draft.reschedules : []);
        setDeletions(Array.isArray(draft.deletions) ? draft.deletions : []);
        setWorkShifts(Array.isArray(draft.workShifts) ? draft.workShifts : []);
        setExtras(draft.extras && typeof draft.extras === 'object' ? draft.extras : emptyReview());
        setReviewing(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Persist the review draft.
  useEffect(() => {
    if (reviewing && !parsing) {
      sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          finalTranscript,
          proposed,
          reschedules,
          deletions,
          workShifts,
          extras,
        })
      );
    }
  }, [
    reviewing,
    parsing,
    finalTranscript,
    proposed,
    reschedules,
    deletions,
    workShifts,
    extras,
  ]);

  const clearDraft = () => sessionStorage.removeItem(DRAFT_KEY);

  const updateProposed = useCallback((id: string, patch: Partial<ProposedTask>) => {
    setProposed((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const deleteProposed = useCallback((id: string) => {
    setProposed((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addAnother = useCallback(() => {
    setProposed((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        text: '',
        category: defaultCategory,
        priority: 'med',
        due_date: null,
        scheduled_date: null,
        start_time: null,
        end_time: null,
        subtasks: [],
        unsure: {},
      },
    ]);
  }, [defaultCategory]);

  const reset = useCallback(() => {
    setProposed([]);
    setReschedules([]);
    setDeletions([]);
    setWorkShifts([]);
    setExtras(emptyReview());
    setFinalTranscript('');
    setParseError(null);
    setReviewing(false);
    clearDraft();
  }, []);

  const updateExtras = useCallback((patch: Partial<ReviewModel>) => {
    setExtras((prev) => ({ ...prev, ...patch }));
  }, []);

  const dismissReschedule = useCallback((id: string) => {
    setReschedules((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const dismissDeletion = useCallback((id: string) => {
    setDeletions((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const updateWorkShift = useCallback((id: string, patch: Partial<ProposedWorkShift>) => {
    setWorkShifts((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  }, []);

  const dismissWorkShift = useCallback((id: string) => {
    setWorkShifts((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const addToList = useCallback(async () => {
    const valid = proposed.filter((t) => t.text.trim());
    if (valid.length) {
      addTasks(
        valid.map((t) => ({
          text: t.text.trim(),
          category: t.category,
          priority: t.priority,
          due_date: t.due_date,
          scheduled_date: t.scheduled_date,
          // A time range only makes sense with both ends; require a day too.
          start_time: t.start_time && t.end_time ? t.start_time : null,
          end_time: t.start_time && t.end_time ? t.end_time : null,
          subtasks: t.subtasks,
        }))
      );
    }
    // Apply accepted moves of existing tasks.
    for (const r of reschedules) {
      if (r.to) updateTask(r.taskId, { scheduled_date: r.to });
    }
    // Apply accepted deletions of existing tasks.
    for (const d of deletions) {
      deleteTask(d.taskId);
    }
    // Apply work-schedule changes.
    for (const w of workShifts) {
      for (const day of w.weekdays) setWorkShift(day, w.start, w.end);
    }
    const parts: string[] = [];
    if (valid.length) parts.push(`Added ${valid.length} task${valid.length === 1 ? '' : 's'}`);
    if (reschedules.length) parts.push(`moved ${reschedules.length} existing`);
    if (deletions.length) parts.push(`removed ${deletions.length}`);
    if (workShifts.length) parts.push(`updated work schedule`);

    // App-wide actions (Supabase writes). Each handler swallows its own errors.
    if (extras.habits && extras.habits.targets.length) {
      await handleCompleteHabits(extras.habits, userId);
      const n = extras.habits.targets.length;
      parts.push(`${n} habit${n === 1 ? '' : 's'}`);
    }
    if (extras.weight) {
      await handleLogWeight(extras.weight, userId);
      parts.push('weight');
    }
    if (extras.reminders.length) {
      for (const rem of extras.reminders) await handleSetReminder(rem, userId);
      parts.push(`${extras.reminders.length} reminder${extras.reminders.length === 1 ? '' : 's'}`);
    }
    // Workout last — it navigates to the Workout tab.
    const startWorkout = extras.workout;
    if (startWorkout) parts.push('workout');

    showToast(parts.length ? parts.join(' · ') : 'Nothing to add');
    reset();
    if (startWorkout) handleStartWorkout(startWorkout, onNavigate);
  }, [
    proposed,
    reschedules,
    deletions,
    workShifts,
    extras,
    userId,
    onNavigate,
    addTasks,
    updateTask,
    deleteTask,
    setWorkShift,
    showToast,
    reset,
  ]);

  return (
    <VoiceProvider
      value={{
        enabled: voiceEnabled,
        supported,
        recording: speech.recording,
        reviewing,
        error: speech.error,
        startKeyword: settings.startKeyword,
        startManual: speech.startRecordingManual,
        stopManual: speech.stopRecordingManual,
        openSettings: () => setDrawerOpen(true),
      }}
    >
      {children}

      {voiceEnabled && supported && (speech.recording || reviewing) && (
        <VoicePopup
          recording={speech.recording}
          transcript={speech.transcript}
          finalTranscript={finalTranscript}
          parsing={parsing}
          parseError={parseError}
          proposed={proposed}
          reschedules={reschedules}
          deletions={deletions}
          workShifts={workShifts}
          extras={extras}
          stopKeyword={settings.stopKeyword}
          mobile={isMobile}
          onStop={speech.stopRecordingManual}
          onRetry={() => runParse(finalTranscript)}
          onChangeProposed={updateProposed}
          onDeleteProposed={deleteProposed}
          onAddAnother={addAnother}
          onDismissReschedule={dismissReschedule}
          onDismissDeletion={dismissDeletion}
          onChangeWorkShift={updateWorkShift}
          onDismissWorkShift={dismissWorkShift}
          onChangeExtras={updateExtras}
          onReset={reset}
          onConfirm={addToList}
        />
      )}

      {/* Mobile-only corner mic button (no always-on listener on mobile). Hidden
          while the review panel is up; shown idle (start) and recording (stop). */}
      {voiceEnabled && supported && isMobile && !reviewing && (
        <MicFab
          recording={speech.recording}
          onStart={speech.startRecordingManual}
          onStop={speech.stopRecordingManual}
        />
      )}

      <SettingsDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 animate-slide-up rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-lg dark:bg-gray-100 dark:text-gray-900">
          {toast}
        </div>
      )}
    </VoiceProvider>
  );
}
