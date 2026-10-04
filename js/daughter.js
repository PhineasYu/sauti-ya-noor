import { store } from './store.js';

const list = document.getElementById('queue');
const DEMO = [
  { question: 'Is there a toilet on the farm?', lang: 'en' },
  { question: 'Est-ce que les chiens sont acceptés ?', lang: 'fr' },
  { question: 'Kann man bei euch übernachten?', lang: 'de' }
];

function esc(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function render() {
  const queue = store.queue();
  list.innerHTML = '';
  if (!queue.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.innerHTML = `<p>No questions waiting. Every visitor question this week matched one of Noor’s answers.</p>
      <button type="button" class="btn ghost" id="demo">Add 3 sample questions</button>`;
    list.appendChild(li);
    li.querySelector('#demo').addEventListener('click', () => {
      DEMO.forEach(d => store.addToQueue(d.question, d.lang));
      render();
    });
    return;
  }
  queue.forEach(item => {
    const li = document.createElement('li');
    li.className = 'q-item';
    const when = new Date(item.at).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    li.innerHTML = `
      <h3>“${esc(item.question)}”</h3>
      <p class="q-meta">Asked ${when}, subtitles in ${item.lang.toUpperCase()}</p>
      <label for="sw-${item.id}">Noor’s answer in Swahili</label>
      <textarea id="sw-${item.id}" rows="2" lang="sw"></textarea>
      <label for="en-${item.id}">Same answer in English</label>
      <textarea id="en-${item.id}" rows="2"></textarea>
      <label for="t-${item.id}">Short topic name</label>
      <input id="t-${item.id}" type="text" placeholder="Toilets and facilities">
      <div class="q-actions">
        <button type="button" class="btn" data-act="save">Add to Noor’s answers</button>
        <button type="button" class="btn ghost" data-act="skip">Not relevant, remove</button>
      </div>`;
    li.querySelector('[data-act="save"]').addEventListener('click', () => {
      const sw = li.querySelector(`#sw-${item.id}`).value.trim();
      const en = li.querySelector(`#en-${item.id}`).value.trim();
      const topic = li.querySelector(`#t-${item.id}`).value.trim() || 'New answer';
      if (!sw || !en) { li.querySelector(sw ? `#en-${item.id}` : `#sw-${item.id}`).focus(); return; }
      store.addCustom({
        id: 'custom-' + item.id, custom: true, topic, sw_title: topic,
        sw, en, fr: en, de: en,
        examples: [item.question], keywords: []
      });
      store.removeFromQueue(item.id);
      render();
    });
    li.querySelector('[data-act="skip"]').addEventListener('click', () => {
      store.removeFromQueue(item.id);
      render();
    });
    list.appendChild(li);
  });
}

render();
