# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A multi-source RAG (Retrieval-Augmented Generation) system over telecom support data. Built milestone-by-milestone as a learning project — each milestone must be confirmed by the user before the next begins.

## Commands

All backend commands must be run with `uv run` from the **project root** (where `uv.lock` is not — actually from the `backend/` dir where `pyproject.toml` lives). The `.venv` is at `backend/.venv`.

```bash
# Start the API server
cd backend && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Re-ingest all documents into ChromaDB
cd backend && uv run python -m app.ingest

# Run loader tests
cd backend && uv run python scripts/test_loaders.py

# Run retrieval eval harness
cd backend && uv run python scripts/eval_retrieval.py

# Add a backend dependency
cd backend && uv add <package>
```

Never use `pip install` or `python -m venv` — always `uv`.

## Architecture

### Data flow

```
resources/          →  loaders  →  chunker  →  embeddings  →  ChromaDB
faq.csv                                                         (backend/data/chroma_db/)
telecom_guide.pdf
tickets.db
```

At query time: question → ChromaDB retriever → top-k chunks → prompt → Kimi LLM → streamed answer + source citations.

### Backend (`backend/app/`)

- **`main.py`** — FastAPI app. Endpoints: `GET /health`, `POST /ingest`, `POST /query` (SSE stream).
- **`ingest.py`** — Orchestrates loaders → `RecursiveCharacterTextSplitter` → `HuggingFaceEmbeddings` → Chroma. Run this to populate/refresh the vector store.
- **`rag_chain.py`** — Builds the LCEL chain: Chroma retriever | prompt template | Kimi LLM. The chain is the query-time path.
- **`loaders/`** — Three loaders, each returns `List[Document]`:
  - `csv_loader.py` — wraps LangChain `CSVLoader`
  - `pdf_loader.py` — wraps LangChain `PyPDFLoader`
  - `sqlite_loader.py` — **custom**: connects to `tickets.db`, reads the `tickets` table (columns: `ticket_id`, `category`, `issue_type`, `description`, `resolution`, `status`), converts each row to a `Document` with metadata.
- **`scripts/`** — standalone test/eval scripts, not imported by the app.

### LLM

Kimi (Moonshot AI) is accessed via `ChatOpenAI` with `base_url="https://api.moonshot.cn/v1"` and model `moonshot-v1-8k`. API key from `.env` as `MOONSHOT_API_KEY`.

### Embeddings

`sentence-transformers/all-MiniLM-L6-v2` via `HuggingFaceEmbeddings` — runs locally, no API key. First run downloads the model weights (~90MB) to the HuggingFace cache.

### Vector store

ChromaDB persisted to `backend/data/chroma_db/`. Excluded from git (regenerable via `uv run python -m app.ingest`). Collection name: `tele_rag`.

### Frontend (`frontend/`)

React + Vite + Tailwind. Connects to the FastAPI `/query` SSE endpoint for streaming. Not yet initialized (Milestone 7).

## Resources

| File | Content |
|------|---------|
| `resources/faq.csv` | Q&A pairs: columns `id, question, answer, category` |
| `resources/telecom_guide.pdf` | Telecom product/policy guide |
| `resources/tickets.db` | SQLite — `tickets` table, 20 rows, columns: `id, ticket_id, category, issue_type, description, resolution, status` |

## Milestone status

The build follows a fixed milestone order. Current progress lives in the session memory. Do not skip ahead without user confirmation.
