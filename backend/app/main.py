import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.ingest import ingest as _run_ingest
from app.rag_chain import build_chain

# Loaded once at startup, reloaded after /ingest
_chain = None
_retriever = None


def _reload_chain():
    global _chain, _retriever
    _chain, _retriever = build_chain()


@asynccontextmanager
async def lifespan(app: FastAPI):
    _reload_chain()
    yield


app = FastAPI(title="Tele-RAG API", lifespan=lifespan)

# Allow any origin so the React dev server (M7) can call this without a proxy
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class QueryRequest(BaseModel):
    question: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ingest")
def ingest():
    """Re-ingest all documents and reload the retriever with fresh vectors."""
    try:
        _run_ingest()
        _reload_chain()
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/query")
def query(req: QueryRequest):
    """Stream answer tokens via SSE. Final event carries source citations."""
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="question must not be empty")

    def event_stream():
        try:
            # Retrieve once here for citations; chain runs its own retrieval internally
            docs = _retriever.invoke(req.question)
            sources = list(dict.fromkeys(
                d.metadata.get("source", "unknown") for d in docs
            ))

            for token in _chain.stream(req.question):
                if token:
                    yield f"data: {json.dumps({'token': token})}\n\n"

            # done event — frontend listens for this to render citation chips
            yield f"event: done\ndata: {json.dumps({'sources': sources})}\n\n"

        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
