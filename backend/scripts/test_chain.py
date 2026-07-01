"""Ask a question from the terminal and see the answer + retrieved source chunks."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.rag_chain import build_chain

DEFAULT_QUESTION = "Why is my mobile internet slow?"

print("Loading chain (embeddings model + ChromaDB)...")
chain, retriever = build_chain()

question = input(f"\nAsk a question [{DEFAULT_QUESTION}]: ").strip()
if not question:
    question = DEFAULT_QUESTION

print("\n" + "=" * 55)
print("RETRIEVED CHUNKS")
print("=" * 55)
docs = retriever.invoke(question)
for i, doc in enumerate(docs, 1):
    source = doc.metadata.get("source", "unknown")
    snippet = doc.page_content[:200].replace("\n", " ")
    print(f"\n[{i}] {source}")
    print(f"    {snippet}...")

print("\n" + "=" * 55)
print("ANSWER (streaming)")
print("=" * 55 + "\n")
for token in chain.stream(question):
    print(token, end="", flush=True)
print("\n")
