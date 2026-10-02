import { openDB } from 'idb';

// Local-first storage. Every module (members, check-ins, giving, events...)
// reads from and writes to this local DB first, so the UI works instantly
// and fully offline. The "outbox" store queues writes that haven't
// reached the server yet; sync() flushes it when back online.

export const DB_NAME = 'dominion-city-local';
const DB_VERSION = 8;

function ensureStore(db, name, options) {
  if (!db.objectStoreNames.contains(name)) {
    return db.createObjectStore(name, options);
  }
  return null;
}

export async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Cached server data, keyed by _id, for offline reads
      ensureStore(db, 'branches', { keyPath: '_id' });
      ensureStore(db, 'departments', { keyPath: '_id' });
      ensureStore(db, 'members', { keyPath: '_id' });
      ensureStore(db, 'events', { keyPath: '_id' });
      ensureStore(db, 'welfareCases', { keyPath: '_id' });
      ensureStore(db, 'users', { keyPath: '_id' });
      ensureStore(db, 'territories', { keyPath: '_id' });
      ensureStore(db, 'eventRsvps', { keyPath: '_id' });
      ensureStore(db, 'departmentDuties', { keyPath: '_id' });

      // Append-only local logs — written locally immediately, synced
      // opportunistically, never overwritten.
      ensureStore(db, 'checkins', { keyPath: 'clientEventId' });
      ensureStore(db, 'givingEntries', { keyPath: 'clientEventId' });
      ensureStore(db, 'welfareDisbursements', { keyPath: 'clientEventId' });
      ensureStore(db, 'welfareVisits', { keyPath: 'clientEventId' });
      ensureStore(db, 'departmentAttendance', { keyPath: 'clientEventId' });
      ensureStore(db, 'evangelismContacts', { keyPath: 'clientEventId' });

      // Outbox: every pending write (of any kind) waiting to sync.
      // { id, method, url, body, createdAt, synced }
      if (!db.objectStoreNames.contains('outbox')) {
        const outbox = db.createObjectStore('outbox', {
          keyPath: 'id',
          autoIncrement: true,
        });
        outbox.createIndex('synced', 'synced');
      }
    },
  });
}

// Queue a write locally and attempt to sync immediately if online.
// Always returns instantly — the UI never waits on the network.
//
// Optional reconciliation params (used for offline-created records,
// e.g. a member added with no connection): pass `localStore` + `tempId`
// and, once the create syncs successfully, the temp record is replaced
// in that store with the server's real record (real _id and all).
export async function queueWrite({ method, url, body, localStore, tempId }) {
  const db = await getDB();
  const entry = {
    method,
    url,
    body,
    createdAt: Date.now(),
    synced: false,
    failed: false,
    localStore: localStore || null,
    tempId: tempId || null,
  };
  const id = await db.add('outbox', entry);

  if (navigator.onLine) {
    // fire and forget — don't block the caller
    syncOutbox().catch(() => {});
  }
  return { id, ...entry };
}

// Flush all pending outbox entries to the server, in order.
// Safe to call repeatedly (e.g. on a 'online' event listener) —
// already-synced entries are skipped. Guarded by a lock so two
// overlapping calls (e.g. queueWrite's fire-and-forget sync racing the
// 'online' event listener) can't both read the same pending item and
// submit it twice — non-idempotent endpoints (members, branches) have
// no other protection against that.
let syncInFlight = null;

export async function syncOutbox() {
  if (syncInFlight) return syncInFlight;
  syncInFlight = runSync().finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}

async function runSync() {
  const db = await getDB();
  const all = await db.getAll('outbox');
  const pending = all.filter((item) => !item.synced);

  for (const item of pending) {
    if (item.failed) continue; // already determined this won't succeed on retry

    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: item.body ? JSON.stringify(item.body) : undefined,
      });

      if (res.ok) {
        item.synced = true;
        item.failed = false;
        await db.put('outbox', item);

        // Reconcile a temp local record with the server's real one.
        if (item.localStore && item.tempId) {
          try {
            const serverRecord = await res.json();
            const tx = db.transaction(item.localStore, 'readwrite');
            await tx.store.delete(item.tempId);
            if (serverRecord && serverRecord._id) {
              await tx.store.put(serverRecord);
            }
            await tx.done;
          } catch {
            // response wasn't JSON or reconciliation failed — the outbox
            // write still succeeded server-side, just leave the temp
            // record as-is rather than lose data.
          }
        }
      } else if (res.status >= 400 && res.status < 500) {
        // Won't succeed on retry (bad request, forbidden, etc.) —
        // mark failed so the UI can surface it instead of retrying forever.
        item.failed = true;
        await db.put('outbox', item);
      }
      // 5xx / network hiccup: leave queued, untouched, retry next pass
    } catch {
      // offline again mid-sync — stop, will resume later
      break;
    }
  }
}

// For a "N items pending / failed" indicator in the UI.
export async function getOutboxStatus() {
  const db = await getDB();
  const all = await db.getAll('outbox');
  const pending = all.filter((i) => !i.synced && !i.failed).length;
  const failed = all.filter((i) => i.failed).length;
  return { pending, failed };
}

// Call once at app startup to auto-sync whenever connectivity returns.
export function registerSyncOnReconnect() {
  window.addEventListener('online', () => {
    syncOutbox().catch(() => {});
  });
}
