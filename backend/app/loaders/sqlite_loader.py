import sqlite3
from pathlib import Path
from typing import List

from langchain_core.documents import Document

# LangChain has no built-in SQLite loader, so we write one.
# The pattern is: connect → fetch rows → convert each row to a Document.
# A Document is just page_content (the text the LLM will read) + metadata (used for citations).


def load_sqlite(file_path: str, table: str = "tickets") -> List[Document]:
    filename = Path(file_path).name
    conn = sqlite3.connect(file_path)
    conn.row_factory = sqlite3.Row  # lets us access columns by name
    cur = conn.cursor()
    cur.execute(f"SELECT * FROM {table}")  # noqa: S608 — internal tool, table name is not user input
    rows = cur.fetchall()
    conn.close()

    docs = []
    for row in rows:
        # Combine the human-readable fields into page_content so the retriever can match against them
        page_content = (
            f"Issue: {row['issue_type']}\n"
            f"Description: {row['description']}\n"
            f"Resolution: {row['resolution']}"
        )
        doc = Document(
            page_content=page_content,
            metadata={
                "source": filename,
                "table": table,
                "row_id": row["id"],
                "ticket_id": row["ticket_id"],
                "category": row["category"],
                "status": row["status"],
            },
        )
        docs.append(doc)

    return docs
