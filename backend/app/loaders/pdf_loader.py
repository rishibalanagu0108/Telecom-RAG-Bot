from pathlib import Path
from typing import List

from langchain_community.document_loaders import PyPDFLoader
from langchain_core.documents import Document


def load_pdf(file_path: str) -> List[Document]:
    loader = PyPDFLoader(file_path)
    docs = loader.load()

    filename = Path(file_path).name
    for doc in docs:
        # PyPDFLoader sets metadata["source"] to the full path — normalise to filename
        doc.metadata["source"] = filename

    return docs
