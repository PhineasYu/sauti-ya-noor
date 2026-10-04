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
    q.push({ id: Date.now().toString(36), question, lang, at: new Date().toISOString() });
    write(QUEUE, q);
  },
  removeFromQueue(id) { write(QUEUE, read(QUEUE).filter(q => q.id !== id)); },
  custom: () => read(CUSTOM),
  addCustom(answer) { const c = read(CUSTOM); c.push(answer); write(CUSTOM, c); }
};

export async function loadAnswers() {
  const res = await fetch('data/answers.json');
  const data = await res.json();
  return [...data.answers, ...store.custom()];
}
