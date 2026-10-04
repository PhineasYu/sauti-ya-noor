# Sauti ya Noor

*"Noor's voice" in Swahili.* A Small AI prototype for the World Bank **Small AI for Development** hackathon (Hack-Nation, tourism sector).

Noor is a smallholder coffee farmer who runs farm tours. She speaks Swahili and uses a basic phone. Visitors have smartphones. So the app runs on the **visitor's** phone: they scan a QR code at the farm gate, ask a question in any language, and hear one of Noor's own recorded answers in Swahili, with subtitles in English, French or German.

## How it works

1. Noor records a fixed set of answers (15 in this demo, `data/answers.json`).
2. A small multilingual sentence model (`Xenova/paraphrase-multilingual-MiniLM-L12-v2`, 8-bit quantized, run with transformers.js) runs **in the visitor's browser** and matches the question to the closest answer.
3. The AI never writes text. It only chooses which of Noor's answers to play, so it cannot hallucinate.
4. If no answer is close enough (cosine < 0.55), the app does not guess. The question is saved for Noor's daughter, who answers at the weekend in `daughter.html`. Her answer joins the library for the next visitor.
5. After the first visit, the page, the model and the audio are cached, so it works with no signal.

If the model cannot load, the app falls back to keyword matching and says so on screen.

## Run it

Open the folder with any static server (Claude Code can start one), or visit the GitHub Pages link. The offline features need `https` or `localhost`.

## Data and licences

| What | Source | Licence |
|---|---|---|
| Sentence model | sentence-transformers `paraphrase-multilingual-MiniLM-L12-v2`, ONNX by Xenova | Apache-2.0 |
| Runtime | transformers.js 3.8.1 | Apache-2.0 |
| Answers | Written for this prototype; Noor is fictional | — |
| Swahili text | AI-translated | Needs native-speaker review |
| Audio | AI voice stand-ins (ElevenLabs `eleven_v4`, Swahili voice "Halima"), to be replaced by Noor's own recordings | ElevenLabs terms |

## What this does not cover (yet)

- Swahili is a well-supported language. For a less-supported one (e.g. Kikuyu), the fixed answer list still works: Noor just records the same answers herself. No TTS or ASR is needed on her side.
- Matching quality was not measured on real visitor questions. The threshold is a starting guess.
- The daughter's queue lives on one device in this demo. In the field it would be store-and-forward: saved on the phone, synced when there is signal.
- No personal data is collected. Questions stay on the visitor's device unless forwarded to Noor's family.
