from collections import Counter
from pathlib import Path

import chromadb
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.loaders.csv_loader import load_csv
from app.loaders.pdf_loader import load_pdf
from app.loaders.sqlite_loader import load_sqlite

RESOURCES = Path(__file__).parent.parent.parent / "resources"
CHROMA_PATH = Path(__file__).parent.parent / "data" / "chroma_db"
COLLECTION_NAME = "tele_rag"

# chunk_size=500: large enough to hold a complete FAQ answer or ticket resolution without
# losing context, small enough that one chunk doesn't pull in unrelated content.
# chunk_overlap=50: prevents a sentence split across a boundary from becoming unretrievable.
splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)


def get_embeddings() -> HuggingFaceEmbeddings:
    # all-MiniLM-L6-v2: 384-dim vectors, ~90MB download on first run, no API key needed.
    # Encodes semantic meaning — "no internet" and "connection lost" land near each other in vector space.
    return HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")


def get_vectorstore() -> Chroma:
    """Load the existing vector store — used by rag_chain.py at query time (no re-embedding)."""
    return Chroma(
        collection_name=COLLECTION_NAME,
        embedding_function=get_embeddings(),
        persist_directory=str(CHROMA_PATH),
    )


def ingest() -> None:
    print("Loading documents...")
    docs = []
    docs += load_csv(str(RESOURCES / "faq.csv"))
    docs += load_pdf(str(RESOURCES / "telecom_guide.pdf"))
    docs += load_sqlite(str(RESOURCES / "tickets.db"))
    print(f"  Loaded {len(docs)} raw documents")

    print("\nChunking...")
    chunks = splitter.split_documents(docs)
    counts = Counter(c.metadata.get("source", "unknown") for c in chunks)
    for source, count in sorted(counts.items()):
        print(f"  {source}: {count} chunks")
    print(f"  Total: {len(chunks)} chunks")

    # Drop the existing collection so re-ingestion is idempotent (no duplicate vectors)
    print("\nClearing existing collection...")
    client = chromadb.PersistentClient(path=str(CHROMA_PATH))
    try:
        client.delete_collection(COLLECTION_NAME)
    except Exception:
        pass

    print("Embedding + storing in ChromaDB (first run downloads ~90MB model)...")
    Chroma.from_documents(
        documents=chunks,
        embedding=get_embeddings(),
        collection_name=COLLECTION_NAME,
        persist_directory=str(CHROMA_PATH),
    )
    print(f"\nDone. {len(chunks)} chunks stored at {CHROMA_PATH}")


if __name__ == "__main__":
    ingest()
