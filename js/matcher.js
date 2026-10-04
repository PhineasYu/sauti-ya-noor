// Matches a visitor's question to one of Noor's recorded answers.
// The AI never writes an answer. It only picks which of Noor's answers to play,
// and says "not sure" when no answer is close enough.

const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
// Multilingual sentence model (50+ languages, Apache-2.0), 8-bit quantized.
export const MODEL_ID = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

// Below these scores the app does not guess; the question goes to Noor's daughter.
const EMBED_THRESHOLD = 0.55;
const KEYWORD_THRESHOLD = 0.34;

const STOP = new Set(('a an the is are do does i we you your can to of on in at for it this that be how what ' +
  'there any have has please me my our would could should will with from about there ' +
  'le la les un une de des du est et je vous il on au à ' +
  'der die das ein eine ist und ich du sie es wir zu am im mit').split(' '));

function tokens(text) {
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/).filter(t => t && !STOP.has(t));
}

function cosine(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s; // vectors are normalized
}

export class Matcher {
  constructor(answers) {
    this.answers = answers;
    this.mode = 'loading'; // 'loading' | 'ai' | 'keyword'
    this.extractor = null;
    this.index = [];       // [{answerIndex, vector}]
  }

  async init(onProgress = () => {}) {
    try {
      const { pipeline, env } = await import(TRANSFORMERS_URL);
      env.allowLocalModels = false;
      env.useBrowserCache = true; // model is cached on the phone after the first visit
      const files = {};
      this.extractor = await pipeline('feature-extraction', MODEL_ID, {
        dtype: 'q8',
        progress_callback: p => {
          if (p.status === 'progress' && p.total) {
            files[p.file] = { loaded: p.loaded, total: p.total };
            const loaded = Object.values(files).reduce((s, f) => s + f.loaded, 0);
            const total = Object.values(files).reduce((s, f) => s + f.total, 0);
            onProgress({ loaded, total });
          }
        }
      });
      await this.rebuild();
      this.mode = 'ai';
    } catch (err) {
      console.warn('On-device model unavailable, using keyword matching.', err);
      this.mode = 'keyword';
    }
    return this.mode;
  }

  async rebuild() {
    if (!this.extractor) return;
    const texts = [], owners = [];
    this.answers.forEach((a, i) => {
      a.examples.forEach(e => { texts.push(e); owners.push(i); });
    });
    const out = await this.extractor(texts, { pooling: 'mean', normalize: true });
    const vecs = out.tolist();
    this.index = vecs.map((v, k) => ({ answerIndex: owners[k], vector: v }));
  }

  async setAnswers(answers) {
    this.answers = answers;
    await this.rebuild();
  }

  async match(question) {
    if (this.mode === 'ai') return this.matchEmbedding(question);
    return this.matchKeyword(question);
  }

  async matchEmbedding(question) {
    const out = await this.extractor([question], { pooling: 'mean', normalize: true });
    const q = out.tolist()[0];
    const best = new Map();
    for (const { answerIndex, vector } of this.index) {
      const s = cosine(q, vector);
      if (s > (best.get(answerIndex) ?? -1)) best.set(answerIndex, s);
    }
    const ranked = [...best.entries()].sort((a, b) => b[1] - a[1]);
    const [idx, score] = ranked[0];
    return {
      answer: score >= EMBED_THRESHOLD ? this.answers[idx] : null,
      candidate: this.answers[idx],
      score, mode: 'ai', threshold: EMBED_THRESHOLD
    };
  }

  matchKeyword(question) {
    const q = new Set(tokens(question));
    let best = { idx: 0, score: 0 };
    this.answers.forEach((a, i) => {
      const kw = new Set([...(a.keywords || []).flatMap(tokens), ...a.examples.flatMap(tokens)]);
      let hits = 0;
      q.forEach(t => { if (kw.has(t)) hits++; });
      const score = q.size ? hits / Math.sqrt(q.size * 3) : 0;
      if (score > best.score) best = { idx: i, score };
    });
    const score = Math.min(1, best.score);
    return {
      answer: score >= KEYWORD_THRESHOLD ? this.answers[best.idx] : null,
      candidate: this.answers[best.idx],
      score, mode: 'keyword', threshold: KEYWORD_THRESHOLD
    };
  }
}
