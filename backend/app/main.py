from fastapi import FastAPI

app = FastAPI(title="Tele-RAG API")


@app.get("/health")
def health():
    return {"status": "ok"}
