"""
Verify the full ingest pipeline end-to-end:
  1. Raw document counts per source
  2. Chunk counts after splitting
  3. ChromaDB collection size matches
  4. Similarity search returns sensible results

Run from backend/:  uv run python scripts/test_ingest.py
"""
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.ingest import COLLECTION_NAME, CHROMA_PATH, get_embeddings, get_vectorstore
from app.ingest import splitter
from app.loaders.csv_loader import load_csv
from app.loaders.pdf_loader import load_pdf
from app.loaders.sqlite_loader import load_sqlite

RESOURCES = Path(__file__).parent.parent.parent / "resources"

PASS = "PASS"
FAIL = "FAIL"

results = []

def check(label: str, condition: bool, detail: str = ""):
    status = PASS if condition else FAIL
    results.append((status, label, detail))
    marker = "✓" if condition else "✗"
    print(f"  [{marker}] {label}", f"— {detail}" if detail else "")


# ── 1. Raw loader counts ─────────────────────────────────────────────────────
print("\n── 1. Raw document loaders ─────────────────────────────")
csv_docs  = load_csv(str(RESOURCES / "faq.csv"))
pdf_docs  = load_pdf(str(RESOURCES / "telecom_guide.pdf"))
sql_docs  = load_sqlite(str(RESOURCES / "tickets.db"))

check("CSV loader returns docs",     len(csv_docs) > 0,  f"{len(csv_docs)} docs")
check("PDF loader returns docs",     len(pdf_docs) > 0,  f"{len(pdf_docs)} docs")
check("SQLite loader returns docs",  len(sql_docs) > 0,  f"{len(sql_docs)} docs")
check("SQLite doc has ticket_id metadata",
      "ticket_id" in sql_docs[0].metadata,
      str(sql_docs[0].metadata))

# ── 2. Chunking ───────────────────────────────────────────────────────────────
print("\n── 2. Chunking ─────────────────────────────────────────")
all_docs = csv_docs + pdf_docs + sql_docs
chunks   = splitter.split_documents(all_docs)
counts   = Counter(c.metadata.get("source", "unknown") for c in chunks)

check("Total chunks > 0",            len(chunks) > 0,        f"{len(chunks)} total")
check("CSV produced chunks",         any("faq" in s for s in counts),
      f"{sum(v for k,v in counts.items() if 'faq' in k)} chunks")
check("PDF produced chunks",         any("telecom" in s or ".pdf" in s for s in counts),
      f"{sum(v for k,v in counts.items() if '.pdf' in k or 'telecom' in k)} chunks")
check("SQLite produced chunks",      any(".db" in s or "ticket" in s for s in counts),
      f"{sum(v for k,v in counts.items() if '.db' in k or 'ticket' in k)} chunks")
check("No chunk exceeds 550 chars",
      all(len(c.page_content) <= 550 for c in chunks),
      f"max={max(len(c.page_content) for c in chunks)}")

# ── 3. ChromaDB collection size ───────────────────────────────────────────────
print("\n── 3. ChromaDB vector store ────────────────────────────")
import chromadb
client     = chromadb.PersistentClient(path=str(CHROMA_PATH))
collection = client.get_or_create_collection(COLLECTION_NAME)
db_count   = collection.count()

check("ChromaDB collection exists",  db_count > 0,  f"{db_count} vectors stored")
check("DB count matches chunk count", db_count == len(chunks),
      f"db={db_count}, chunks={len(chunks)}")

# ── 4. Similarity search ──────────────────────────────────────────────────────
print("\n── 4. Similarity search (k=4) ──────────────────────────")
print("   (loads embeddings model — first run downloads ~90 MB)")
vs   = get_vectorstore()
hits = vs.similarity_search("slow mobile internet", k=4)

check("Returns 4 chunks",            len(hits) == 4,    f"{len(hits)} returned")
check("Top hit has source metadata", "source" in hits[0].metadata,
      hits[0].metadata.get("source", "missing"))
check("Top hit mentions internet/speed",
      any(w in hits[0].page_content.lower() for w in ("slow", "speed", "internet", "mobile")),
      hits[0].page_content[:80].replace("\n", " "))

# ── Summary ───────────────────────────────────────────────────────────────────
passed = sum(1 for s, *_ in results if s == PASS)
failed = sum(1 for s, *_ in results if s == FAIL)
print(f"\n{'='*52}")
print(f"  {passed} passed  |  {failed} failed  |  {len(results)} total")
print(f"{'='*52}")

if failed:
    print("\nFailed checks:")
    for status, label, detail in results:
        if status == FAIL:
            print(f"  ✗ {label} — {detail}")
    sys.exit(1)
