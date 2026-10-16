// Tiny change bus so independent hooks refetch after writes elsewhere.
export type Topic = 'exercises' | 'templates' | 'programs' | 'sessions' | 'folders' | 'body'

const target = new EventTarget()

export function emitChange(topic: Topic) {
  target.dispatchEvent(new Event(topic))
}

export function onChange(topic: Topic, fn: () => void): () => void {
  target.addEventListener(topic, fn)
  return () => target.removeEventListener(topic, fn)
}
