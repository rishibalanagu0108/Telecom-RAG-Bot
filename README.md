# Tele-RAG

A multi-source Retrieval-Augmented Generation (RAG) system over telecom support data. Ask questions in plain English and get answers grounded in a FAQ sheet, support tickets database, and a product/policy guide — with source citations for every fact.

---

## What it does

- Ingests three data sources (CSV, PDF, SQLite) into a local vector store
- At query time, retrieves the most relevant chunks and passes them as context to an LLM
- Streams the answer token-by-token via SSE
- Shows which source files backed each answer (anti-hallucination grounding)

---

## Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI + Python 3.11 |
| Package manager | `uv` |
| Embeddings | `sentence-transformers/all-MiniLM-L6-v2` (local, no API key) |
| Vector store | ChromaDB (persisted to `backend/data/chroma_db/`) |
| LLM | OpenRouter — `nvidia/nemotron-3-super-120b-a12b:free` |
| LLM framework | LangChain LCEL |
| Frontend | React + Vite + Tailwind CSS |

---

## Project structure

```
tele-rag/
├── resources/
│   ├── faq.csv               # Q&A pairs (25 rows)
│   ├── telecom_guide.pdf     # Product & policy guide
│   └── tickets.db            # SQLite — 20 support tickets
│
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app (GET /health, POST /ingest, POST /query)
│   │   ├── ingest.py         # Loaders → chunker → embeddings → ChromaDB
│   │   ├── rag_chain.py      # LCEL chain: retriever | prompt | LLM | parser
│   │   └── loaders/
│   │       ├── csv_loader.py
│   │       ├── pdf_loader.py
│   │       └── sqlite_loader.py
│   └── scripts/
│       ├── test_loaders.py   # Verify raw document loading
│       ├── test_ingest.py    # 14-check ingest pipeline validator
│       ├── test_chain.py     # Interactive CLI question answering
│       └── eval_retrieval.py # Retrieval eval harness (hit-rate scoring)
│
└── frontend/
    └── src/
        └── App.jsx           # Streaming chat UI with source citation chips
```

---

## Setup

### Prerequisites

- Python 3.11+
- [uv](https://docs.astral.sh/uv/) — `curl -LsSf https://astral.sh/uv/install.sh | sh`
- Node.js 18+
- An [OpenRouter](https://openrouter.ai) API key (free tier works)

### 1. Clone and configure

```bash
git clone <repo-url>
cd tele-rag
cp .env.example .env
```

Edit `.env` and add your key:

```
OPENROUTER_API_KEY=sk-or-v1-...
```

### 2. Install backend dependencies

```bash
cd backend
uv sync
```

### 3. Ingest documents into ChromaDB

```bash
cd backend
uv run python -m app.ingest
```

This downloads the `all-MiniLM-L6-v2` embeddings model (~90 MB on first run), chunks all three data sources, and stores 89 vectors in ChromaDB.

### 4. Start the backend

```bash
cd backend
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 5. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Returns `{"status": "ok"}` |
| `POST` | `/ingest` | Re-ingests all documents, reloads the retriever |
| `POST` | `/query` | SSE stream — tokens + final `event: done` with source citations |

### Query request

```json
POST /query
{ "question": "Why is my mobile internet slow?" }
```

### Query SSE response

```
data: {"token": "Slow"}
data: {"token": " speeds"}
data: {"token": " are"}
...
event: done
data: {"sources": ["faq.csv", "tickets.db", "telecom_guide.pdf"]}
```

---

## Scripts

All run from `backend/` with `uv run`:

```bash
# Validate all three loaders parse correctly
uv run python scripts/test_loaders.py

# Full ingest pipeline check (14 assertions)
uv run python scripts/test_ingest.py

# Interactive CLI — ask a question, see retrieved chunks + streamed answer
uv run python scripts/test_chain.py

# Retrieval eval — 10 fixed Q&A pairs, prints hit-rate score table
uv run python scripts/eval_retrieval.py
```

---

## How retrieval works

```
Question
   │
   ▼
Embed with all-MiniLM-L6-v2
   │
   ▼
ChromaDB cosine search → top 4 chunks
   │
   ▼
Format chunks with [Source: filename] headers
   │
   ▼
Inject into grounding prompt
   │
   ▼
LLM (OpenRouter) → streamed answer + citations
```

The grounding prompt explicitly forbids the LLM from using outside knowledge. If the answer isn't in the retrieved chunks, the model responds: *"I don't have that information in my knowledge base."*

---

## Adding new data sources

1. Drop a file into `resources/`
2. Write a loader in `backend/app/loaders/` that returns `List[Document]`
3. Import and call it in `backend/app/ingest.py`
4. Re-run `uv run python -m app.ingest`

---

## Current retrieval score

10 test questions across all three sources — **9/10 hit rate (90%)** at `k=4`.
