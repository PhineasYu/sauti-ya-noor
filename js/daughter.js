// The family's side: answer visitors' open questions, record Noor, manage her answers.
import { store, recordings, loadAnswers } from './store.js';
import { kangaTile, accentFor } from './visuals.js';

const $ = s => document.querySelector(s);
const queueEl = $('#queue');
const libraryEl = $('#library');

// Sample questions, each with the kind of answer we hope for (shown as a hint).
const DEMO = [
  { question: 'Is there a toilet on the farm?', lang: 'en',
    hint: { sw: 'Ndiyo, kuna choo safi karibu na nyumba yetu.', en: 'Yes, there’s a clean toilet next to our house.', topic: 'Toilets' } },
  { question: 'Est-ce que les chiens sont acceptés ?', lang: 'fr',
    hint: { sw: 'Mbwa wanakaribishwa, lakini tafadhali wakae na kamba.', en: 'Dogs are welcome, but please keep them on a lead.', topic: 'Dogs' } },
  { question: 'Kann man bei euch übernachten?', lang: 'de',
    hint: { sw: 'Hatuna vyumba, lakini kuna nyumba ya wageni kijijini.', en: 'We don’t have rooms, but there’s a guesthouse in the village.', topic: 'Staying overnight' } }
];
const LANG_NAMES = { en: 'English', fr: 'French', de: 'German' };
const hintFor = q => DEMO.find(d => d.question === q)?.hint
  || { sw: 'Andika jibu la Noor hapa…', en: 'Write Noor’s answer here…', topic: 'Short topic name' };

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function toast(text) {
  const t = document.createElement('div');
  t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

// ---------- playback: one sound at a time ----------
let player = null;
function play(src) {
  player?.pause();
  player = new Audio(src);
  player.play().catch(() => toast('This phone could not play the sound.'));
}
async function sourceFor(answer, recIds) {
  if (recIds.includes(answer.id)) return URL.createObjectURL(await recordings.get(answer.id));
  return answer.custom ? null : `audio/${answer.id}.mp3`;
}

// ---------- recorder: Record → Stop → (listen, record again) ----------
function recorder(onDone, label = 'Record Noor') {
  const wrap = document.createElement('div');
  wrap.className = 'rec';
  wrap.innerHTML = `<button type="button" class="rec-btn"><i aria-hidden="true"></i><span>${label}</span></button>
    <span class="rec-time" aria-live="polite"></span>`;
  const btn = wrap.querySelector('.rec-btn'), time = wrap.querySelector('.rec-time');
  let mr = null, chunks = [], t0 = 0, timer = 0;

  btn.addEventListener('click', async () => {
    if (mr) { mr.stop(); return; }
    if (!window.MediaRecorder || !navigator.mediaDevices?.getUserMedia) {
      toast('This browser can’t record. Try Chrome or Safari on the phone.'); return;
    }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { toast('Allow the microphone to record Noor.'); return; }
    chunks = [];
    mr = new MediaRecorder(stream);
    mr.ondataavailable = e => e.data.size && chunks.push(e.data);
    mr.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      clearInterval(timer);
      const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
      mr = null;
      wrap.classList.remove('on');
      btn.querySelector('span').textContent = 'Record again';
      time.textContent = '';
      await onDone(blob);
    };
    mr.start();
    t0 = Date.now();
    wrap.classList.add('on');
    btn.querySelector('span').textContent = 'Stop';
    timer = setInterval(() => { time.textContent = `${Math.round((Date.now() - t0) / 1000)}s`; }, 250);
  });
  return wrap;
}

// ---------- waiting questions ----------
function renderQueue() {
  const queue = store.queue();
  queueEl.innerHTML = '';
  $('#q-count').textContent = queue.length
    ? `${queue.length} question${queue.length > 1 ? 's' : ''} from visitors`
    : 'Questions from visitors';

  if (!queue.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.innerHTML = `<p><b>No questions waiting.</b> Questions arrive when a visitor taps “Send to Noor’s family”, or when someone asks on this phone and no answer fits.</p>
      <p>To try it, load three questions a visitor might ask:</p>
      <ul class="demo-list">${DEMO.map(d => `<li>“${esc(d.question)}”</li>`).join('')}</ul>
      <button type="button" class="btn" id="demo">Load sample questions</button>`;
    queueEl.appendChild(li);
    li.querySelector('#demo').addEventListener('click', () => {
      DEMO.forEach(d => store.addToQueue(d.question, d.lang));
      render();
    });
    return;
  }

  queue.slice().reverse().forEach(item => { // newest first
    const li = document.createElement('li');
    li.className = 'q-item';
    li.style.setProperty('--accent', accentFor(item.question));
    const when = new Date(item.at).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    const hint = hintFor(item.question);
    li.innerHTML = `
      <div class="q-top">
        <span class="q-tile" aria-hidden="true">${kangaTile(item.question)}</span>
        <div>
          <h3>“${esc(item.question)}”</h3>
          <p class="q-meta">Asked ${when} · visitor reads ${LANG_NAMES[item.lang] || esc(item.lang).toUpperCase()}</p>
        </div>
      </div>
      <label for="sw-${item.id}">1 · Noor’s answer in Swahili</label>
      <textarea id="sw-${item.id}" rows="2" lang="sw" placeholder="${esc(hint.sw)}"></textarea>
      <label for="en-${item.id}">2 · Same answer in English</label>
      <textarea id="en-${item.id}" rows="2" placeholder="${esc(hint.en)}"></textarea>
      <label for="t-${item.id}">3 · Short topic name</label>
      <input id="t-${item.id}" type="text" placeholder="${esc(hint.topic)}">
      <p class="q-label">4 · Noor says it <span>(optional, you can record later)</span></p>
      <div class="q-rec"></div>
      <div class="q-actions">
        <button type="button" class="btn" data-act="save">Add to answers</button>
        <button type="button" class="btn ghost" data-act="skip">Not relevant, remove</button>
      </div>`;

    let pending = null;
    const recSlot = li.querySelector('.q-rec');
    recSlot.appendChild(recorder(blob => {
      pending = blob;
      recSlot.querySelector('.rec-play')?.remove();
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn ghost rec-play'; b.textContent = '▶ Listen';
      b.addEventListener('click', () => play(URL.createObjectURL(blob)));
      recSlot.appendChild(b);
    }));

    li.querySelector('[data-act="save"]').addEventListener('click', async () => {
      const sw = li.querySelector(`#sw-${item.id}`).value.trim();
      const en = li.querySelector(`#en-${item.id}`).value.trim();
      const topic = li.querySelector(`#t-${item.id}`).value.trim() || 'New answer';
      if (!sw || !en) { li.querySelector(sw ? `#en-${item.id}` : `#sw-${item.id}`).focus(); toast('Write the answer in Swahili and English first.'); return; }
      const id = 'custom-' + item.id;
      store.addCustom({
        id, custom: true, topic, sw_title: topic,
        sw, en, fr: en, de: en,
        // The answer text helps the AI match reworded questions, not just the original wording.
        examples: [item.question, en], keywords: []
      });
      if (pending) await recordings.save(id, pending);
      store.removeFromQueue(item.id);
      toast(`Added. The next visitor who asks will ${pending ? 'hear Noor' : 'read your answer'}.`);
      render();
    });
    li.querySelector('[data-act="skip"]').addEventListener('click', () => {
      store.removeFromQueue(item.id);
      render();
    });
    queueEl.appendChild(li);
  });
}

// ---------- Noor's answers ----------
async function renderLibrary(answers, recIds) {
  libraryEl.innerHTML = '';
  answers.forEach(a => {
    const hasRec = recIds.includes(a.id);
    const voice = hasRec ? ['own', 'Noor’s voice'] : a.custom ? ['none', 'Text only'] : ['ai', 'AI voice'];
    const li = document.createElement('li');
    li.className = 'lib-item';
    li.style.setProperty('--accent', accentFor(a.id));
    li.innerHTML = `
      <span class="lib-tile" aria-hidden="true">${kangaTile(a.id)}</span>
      <div class="lib-text">
        <p class="lib-topic">${esc(a.topic)}${a.custom ? ' <em>added by family</em>' : ''}</p>
        <p class="lib-q">“${esc(a.examples[0])}”</p>
        <span class="badge badge-${voice[0]}">${voice[1]}</span>
      </div>
      <div class="lib-actions"></div>`;
    const actions = li.querySelector('.lib-actions');

    const playBtn = document.createElement('button');
    playBtn.type = 'button'; playBtn.className = 'icon-btn'; playBtn.textContent = '▶';
    playBtn.setAttribute('aria-label', `Play ${a.topic}`);
    playBtn.disabled = voice[0] === 'none';
    playBtn.addEventListener('click', async () => play(await sourceFor(a, recIds)));
    actions.appendChild(playBtn);

    actions.appendChild(recorder(async blob => {
      await recordings.save(a.id, blob);
      toast(`Saved. Visitors on this phone now hear Noor for “${a.topic}”.`);
      render();
    }, hasRec ? 'Re-record' : 'Record'));

    if (hasRec && !a.custom) {
      const back = document.createElement('button');
      back.type = 'button'; back.className = 'link-btn'; back.textContent = 'Use AI voice';
      back.addEventListener('click', async () => { await recordings.remove(a.id); render(); });
      actions.appendChild(back);
    }
    if (a.custom) {
      const del = document.createElement('button');
      del.type = 'button'; del.className = 'link-btn'; del.textContent = 'Delete';
      del.addEventListener('click', async () => {
        if (!confirm(`Delete “${a.topic}”? Visitors will no longer get this answer.`)) return;
        store.removeCustom(a.id);
        await recordings.remove(a.id);
        render();
      });
      actions.appendChild(del);
    }
    libraryEl.appendChild(li);
  });
}

async function render() {
  const [answers, recIds] = await Promise.all([loadAnswers(), recordings.ids()]);
  $('#st-wait').textContent = store.queue().length;
  $('#st-added').textContent = answers.filter(a => a.custom).length;
  $('#st-voice').textContent = `${answers.filter(a => recIds.includes(a.id)).length}/${answers.length}`;
  renderQueue();
  await renderLibrary(answers, recIds);
}

// A visitor shared their question: daughter.html#ask=...&lang=fr
function importFromLink() {
  const p = new URLSearchParams(location.hash.slice(1));
  const q = p.get('ask')?.trim().slice(0, 300);
  if (!q) return;
  const added = store.addToQueue(q, ['en', 'fr', 'de'].includes(p.get('lang')) ? p.get('lang') : 'en');
  history.replaceState(null, '', location.pathname);
  toast(added ? 'New question from a visitor. It’s at the top of your list.' : 'This question is already in your list.');
}

document.querySelectorAll('[data-tile]').forEach(el => { el.innerHTML = kangaTile(el.dataset.tile); });
importFromLink();
render();
