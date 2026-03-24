# Generative AI PDF Summarizer & Q&A

A local-first PDF Summarization + Question Answering project with **two implementations**:

1. **Python + Streamlit + LangChain + FAISS** (original implementation)
2. **TypeScript + React + Express + Transformers.js** (web app implementation)

Both implementations are designed to run locally and keep document processing on your machine.

---

## Repository Structure

### Python / Streamlit stack
- `app.py` – Streamlit UI entrypoint
- `rag_pipeline.py` – PDF loading, chunking, embeddings, FAISS store
- `summarizer.py` – map-reduce style summarization
- `qa_system.py` – retrieval + prompt-based QA
- `model_loader.py` – DistilGPT2 pipeline loader/cache

### TypeScript / React + Express stack
- `server.ts` – API server (`/api/upload`, `/api/summarize`, `/api/ask`, `/api/metrics`)
- `src/App.tsx` – React UI
- `src/main.tsx` – React bootstrap
- `vite.config.ts` – Vite config

---

## Prerequisites

### Python stack
- Python 3.8+

### TypeScript stack
- Node.js 20+ (recommended)
- npm 10+

---

## Quick Start

## Option A: Run Python Streamlit app

1. Create and activate a virtual environment (recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Start the app:
   ```bash
   streamlit run app.py
   ```
4. Open `http://localhost:8501`.

## Option B: Run TypeScript web app

1. Install dependencies:
   ```bash
   npm ci
   ```
2. Start dev server (Express + Vite middleware):
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000`.

---

## TypeScript API Contract

### `POST /api/upload`
- Form-data field: `pdf` (PDF file, max 20MB)
- Response includes:
  - `docId` (required for follow-up calls)
  - `pageCount`
  - `chunkCount`

### `POST /api/summarize`
- JSON body:
  ```json
  { "docId": "<document-id>" }
  ```

### `POST /api/ask`
- JSON body:
  ```json
  { "docId": "<document-id>", "question": "..." }
  ```
- Returns:
  - `answer`
  - `sources` (top retrieved chunks + scores)

### `GET /api/metrics`
- Returns structured in-memory request metrics:
  - request counts
  - endpoint counts
  - status counts
  - average latency

---

## Testing / Validation

### Python smoke
```bash
python -m py_compile app.py summarizer.py rag_pipeline.py qa_system.py model_loader.py
```

### TypeScript checks
```bash
npm run lint
```

### TypeScript API smoke
```bash
npm run smoke:ts
```

### Python pipeline smoke
```bash
python tests/python_smoke.py
```

---


## Primary Backend Decision

To reduce architecture drift, the **TypeScript (Express + React) stack is the primary web implementation** going forward.
The Python Streamlit app remains available as a legacy/local reference implementation.

Boundary going forward:
- New web/API features should be added to TypeScript first.
- Python path is maintained for local experimentation and parity validation.

---

## Notes on Model Quality

Default models prioritize local execution and lightweight runtime.
For higher quality summarization and QA, evaluate stronger local instruction-tuned models and compare:
- factuality
- grounding
- latency
- memory usage

---

## Troubleshooting

- If `npm run lint` fails with “Cannot find module …”, run `npm ci` first.
- First run may take longer while models are downloaded.
- If uploads fail on large PDFs, keep files under 20MB and verify available memory.
