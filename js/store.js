// Everything stays on this device. In the real service the queue would be
// stored here and forwarded when the daughter's phone next has signal.

const QUEUE = 'sauti.queue';
const CUSTOM = 'sauti.custom';

function read(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

export const store = {
  queue: () => read(QUEUE),
  addToQueue(question, lang) {
    const q = read(QUEUE);
    // The same question arriving twice (e.g. a shared link opened again) is kept once.
    if (q.some(x => x.question.trim().toLowerCase() === question.trim().toLowerCase())) return false;
    q.push({ id: Date.now().toString(36), question, lang, at: new Date().toISOString() });
    write(QUEUE, q);
    return true;
  },
  removeFromQueue(id) { write(QUEUE, read(QUEUE).filter(q => q.id !== id)); },
  custom: () => read(CUSTOM),
  addCustom(answer) { const c = read(CUSTOM); c.push(answer); write(CUSTOM, c); },
  removeCustom(id) { write(CUSTOM, read(CUSTOM).filter(a => a.id !== id)); }
};

export async function loadAnswers() {
  const res = await fetch('data/answers.json');
  const data = await res.json();
  return [...data.answers, ...store.custom()];
}

// ---------- Noor's own recordings, one per answer id (IndexedDB) ----------
function db() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('sauti', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('recordings');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction('recordings', mode);
    const req = fn(t.objectStore('recordings'));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}

export const recordings = {
  async get(id) { try { return await tx('readonly', s => s.get(id)); } catch { return undefined; } },
  async ids() { try { return await tx('readonly', s => s.getAllKeys()); } catch { return []; } },
  save: (id, blob) => tx('readwrite', s => s.put(blob, id)),
  remove: id => tx('readwrite', s => s.delete(id))
};

// Link that drops a visitor's question straight into the family's queue.
export function familyLink(question, lang) {
  const url = new URL('daughter.html', location.href);
  url.hash = new URLSearchParams({ ask: question, lang }).toString();
  return url.toString();
}
