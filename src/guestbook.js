// Keep an uncertain submission stable while its form stays unchanged. Nothing is
// persisted: the shared API retains receipts for 24h; this page stops at 23h.
export function createSubmissionTracker({ makeId = () => crypto.randomUUID(), now = Date.now } = {}) {
  let pending;
  return {
    begin(note) {
      const fingerprint = JSON.stringify([note.name, note.city || '', note.msg]);
      if (pending?.fingerprint === fingerprint) {
        if (now() - pending.created >= 23 * 60 * 60 * 1000) {
          throw new Error('This retry window has ended. Check the guestbook before submitting this note again.');
        }
        return pending.id;
      }
      pending = { fingerprint, id: makeId(), created: now() };
      return pending.id;
    },
    confirm(id) { if (pending?.id === id) pending = undefined; },
  };
}
