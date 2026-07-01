# Milestones

## M1 — Project Scaffold ✅
- `uv` installed and verified
- Folder structure: `backend/`, `frontend/`, `resources/`, `backend/data/chroma_db/`
- All backend deps installed via `uv add` into `backend/pyproject.toml`
- `.env.example` with `MOONSHOT_API_KEY=`
- FastAPI app with `GET /health` → `{"status": "ok"}`
- `.gitignore` and `CLAUDE.md` added

**Concept:** Dependency isolation — separate Python env per project so LangChain version mismatches don't silently break retrieval.

---

## M2 — Document Loaders ✅
- `backend/app/loaders/csv_loader.py`
- `backend/app/loaders/pdf_loader.py`
- `backend/app/loaders/sqlite_loader.py` (custom — no LangChain built-in)
- `backend/scripts/test_loaders.py` — prints doc count + sample per source

**Concept:** A LangChain `Document` is just `{page_content: str, metadata: dict}`. Metadata (source file, page/row number) is what surfaces as citations later — getting it right here pays off in M4+.

---

## M3 — Chunking + Embeddings + Vector Store
- `backend/app/ingest.py` — split → embed → store in Chroma
- `python -m app.ingest` re-ingests everything from `resources/`
- Prints chunk counts per source after ingestion

**Concept:** Embeddings are vectors capturing semantic meaning. Chunk size controls retrieval granularity — too large and irrelevant text pollutes the context; too small and a chunk loses its meaning.

---

## M4 — Retrieval + Kimi Generation Chain (LCEL)
- `backend/app/rag_chain.py` — retriever → prompt → Kimi via LCEL `|` pipe syntax
- CLI test: ask a question, see answer + retrieved source chunks

**Concept:** Grounding — the LLM is instructed to answer only from retrieved context, not from its training data, to prevent hallucination on domain-specific facts.

---

## M5 — Eval Harness
- `backend/scripts/eval_retrieval.py` — 5–10 fixed questions with expected source files
- Runs retrieval only (no generation), checks if expected source is in top-k
- Prints hit-rate score table

**Concept:** Retrieval quality must be measured independently of generation quality. A wrong retrieval guarantees a wrong answer regardless of how good the LLM is.

---

## M6 — FastAPI Endpoints
- `POST /ingest` — triggers re-ingestion
- `POST /query` — streams answer via SSE, final event includes source citations
- Proper error handling

**Concept:** SSE (Server-Sent Events) streaming lets the UI render tokens as they arrive, making LLM latency feel much lower to the user.

---

## M7 — React Frontend
- Chat UI with message list, input box, streaming token rendering
- Source citation chips per AI response
- Tailwind styling, loading + error states

**Concept:** Connecting a streaming SSE backend to a React frontend — handling incremental token events and flushing citations from the final event.

---

## M8 — Wrap-up
- README with setup + run instructions
- Written summary of every AI engineering concept covered across M1–M7
