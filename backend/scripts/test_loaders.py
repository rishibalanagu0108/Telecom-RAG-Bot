"""Run this to verify all three loaders parse correctly before touching embeddings."""
import sys
from pathlib import Path

# Allow running as `uv run python scripts/test_loaders.py` from backend/
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.loaders.csv_loader import load_csv
from app.loaders.pdf_loader import load_pdf
from app.loaders.sqlite_loader import load_sqlite

RESOURCES = Path(__file__).parent.parent.parent / "resources"


def test(label: str, docs):
    print(f"\n{'='*50}")
    print(f"{label}: {len(docs)} documents")
    print(f"--- Sample document ---")
    sample = docs[0]
    print(f"content: {sample.page_content[:200]!r}")
    print(f"metadata: {sample.metadata}")


test("CSV (faq.csv)", load_csv(str(RESOURCES / "faq.csv")))
test("PDF (telecom_guide.pdf)", load_pdf(str(RESOURCES / "telecom_guide.pdf")))
test("SQLite (tickets.db)", load_sqlite(str(RESOURCES / "tickets.db")))
