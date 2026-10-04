import { store } from './store.js';
import { kangaTile, accentFor } from './visuals.js';

const list = document.getElementById('queue');
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

document.querySelectorAll('[data-tile]').forEach(el => { el.innerHTML = kangaTile(el.dataset.tile); });

function esc(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function render() {
  const queue = store.queue();
  list.innerHTML = '';
  document.getElementById('q-count').textContent = queue.length
    ? `${queue.length} question${queue.length > 1 ? 's' : ''} from visitors`
    : 'Questions from visitors';
  if (!queue.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.innerHTML = `<p><b>No questions waiting.</b> Every visitor question this week matched one of Noor’s answers.</p>
      <p>Want to see how it works? Load three questions visitors might ask:</p>
      <ul class="demo-list">${DEMO.map(d => `<li>“${esc(d.question)}”</li>`).join('')}</ul>
      <button type="button" class="btn" id="demo">Load sample questions</button>`;
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
    li.style.setProperty('--accent', accentFor(item.question));
    const when = new Date(item.at).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    const hint = hintFor(item.question);
    li.innerHTML = `
      <div class="q-top">
        <span class="q-tile" aria-hidden="true">${kangaTile(item.question)}</span>
        <div>
          <h3>“${esc(item.question)}”</h3>
          <p class="q-meta">Asked ${when} · visitor reads ${LANG_NAMES[item.lang] || item.lang.toUpperCase()}</p>
        </div>
      </div>
      <label for="sw-${item.id}">Noor’s answer in Swahili</label>
      <textarea id="sw-${item.id}" rows="2" lang="sw" placeholder="${esc(hint.sw)}"></textarea>
      <label for="en-${item.id}">Same answer in English</label>
      <textarea id="en-${item.id}" rows="2" placeholder="${esc(hint.en)}"></textarea>
      <label for="t-${item.id}">Short topic name</label>
      <input id="t-${item.id}" type="text" placeholder="${esc(hint.topic)}">
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
