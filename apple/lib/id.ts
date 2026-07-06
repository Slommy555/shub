/**
 * RFC4122-ish v4 UUID. React Native / Hermes has no crypto.randomUUID, and
 * these ids are only used to reconcile optimistic rows with realtime events
 * (the DB is the source of truth), so Math.random is sufficient here.
 */
export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
