"""
Retrieval eval harness — M5.

For each test question, retrieves top-k chunks and checks whether the
expected source file appears in the results. Reports per-question hit/miss
and an overall hit-rate score.

Run from backend/:  uv run python scripts/eval_retrieval.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.ingest import get_vectorstore

K = 4  # must match rag_chain.py retriever k

# Each entry: (question, expected_source_substring)
# expected_source is a substring of the source metadata value — e.g. "faq.csv",
# "tickets.db", or ".pdf". A hit = expected substring found in any of the k results.
EVAL_SET = [
    # faq.csv questions
    ("Why is my mobile internet so slow?",          "faq.csv"),
    ("How do I reset my router?",                   "faq.csv"),
    ("What happens when I exceed my data cap?",     "faq.csv"),
    ("How do I port my number to a new provider?",  "faq.csv"),
    ("Why am I being charged a roaming fee?",       "faq.csv"),

    # tickets.db questions
    ("What was the resolution for slow 4G speeds?", "tickets.db"),
    ("Customer reported no internet after switching from 3G to 4G", "tickets.db"),
    ("How was the SIM card issue resolved?",        "tickets.db"),

    # telecom_guide.pdf questions
    ("What is the difference between 4G and 5G?",   ".pdf"),
    ("How does LTE technology work?",               ".pdf"),
]


def run_eval():
    print("Loading embeddings + vector store...")
    vs = get_vectorstore()
    print(f"Running {len(EVAL_SET)} queries at k={K}\n")

    col_q  = 50
    col_s  = 12
    col_r  = 8
    header = f"{'Question':<{col_q}} {'Expected':<{col_s}} {'Result':<{col_r}} Retrieved sources"
    print(header)
    print("-" * (col_q + col_s + col_r + 30))

    hits = 0
    for question, expected in EVAL_SET:
        docs = vs.similarity_search(question, k=K)
        sources = [d.metadata.get("source", "unknown") for d in docs]
        hit = any(expected in s for s in sources)
        if hit:
            hits += 1

        result  = "HIT " if hit else "MISS"
        q_short = question[:col_q - 1]
        unique_sources = list(dict.fromkeys(sources))  # deduplicated, order preserved
        print(f"{q_short:<{col_q}} {expected:<{col_s}} {result:<{col_r}} {', '.join(unique_sources)}")

    total    = len(EVAL_SET)
    hit_rate = hits / total * 100
    print()
    print("=" * 70)
    print(f"  Hit rate: {hits}/{total}  ({hit_rate:.0f}%)")
    print("=" * 70)

    if hit_rate < 70:
        print("\n  Warning: hit rate below 70% — consider tuning chunk_size or k.")
    elif hit_rate < 90:
        print("\n  Acceptable. Review misses above to find weak spots.")
    else:
        print("\n  Retrieval is solid.")

    return hit_rate


if __name__ == "__main__":
    run_eval()
