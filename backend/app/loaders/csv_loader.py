from pathlib import Path
from typing import List

from langchain_community.document_loaders import CSVLoader
from langchain_core.documents import Document


def load_csv(file_path: str) -> List[Document]:
    loader = CSVLoader(
        file_path=file_path,
        metadata_columns=["id", "category"],  # keep these as metadata, not page_content
        source_column="question",              # used as the metadata["source"] value
    )
    docs = loader.load()

    # Normalise the source so citations show the filename, not the question text
    filename = Path(file_path).name
    for doc in docs:
        doc.metadata["source"] = filename

    return docs
