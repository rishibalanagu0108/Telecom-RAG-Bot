import os
from typing import Iterator

from dotenv import find_dotenv, load_dotenv
from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_openai import ChatOpenAI

from app.ingest import get_vectorstore

load_dotenv(find_dotenv())  # walks up from cwd until it finds .env

# Grounding prompt: explicitly forbids the LLM from using outside knowledge.
# Without this instruction, the model will confidently answer from training data
# even when the retrieved context is wrong or empty — that's a hallucination.
PROMPT = ChatPromptTemplate.from_template(
    "You are a telecom support assistant.\n"
    "Answer the question using ONLY the context provided below.\n"
    "If the answer is not in the context, say exactly: \"I don't have that information in my knowledge base.\"\n"
    "For each fact you state, cite the source file in parentheses.\n\n"
    "Context:\n{context}\n\n"
    "Question: {question}\n\n"
    "Answer:"
)


def _format_docs(docs: list[Document]) -> str:
    return "\n\n".join(
        f"[Source: {doc.metadata.get('source', 'unknown')}]\n{doc.page_content}"
        for doc in docs
    )


def build_chain():
    """Returns (chain, retriever). Retriever exposed separately so callers can show source docs."""
    vectorstore = get_vectorstore()

    # k=4: enough chunks to cover multi-source answers without blowing the 8k context window
    retriever = vectorstore.as_retriever(search_kwargs={"k": 4})
    
    llm = ChatOpenAI(
        model="nvidia/nemotron-3-super-120b-a12b:free",
        base_url="https://openrouter.ai/api/v1",
        api_key=os.getenv("OPENROUTER_API_KEY"),
        temperature=0,  # deterministic — factual retrieval tasks don't benefit from sampling
    )

    chain = (
        {"context": retriever | _format_docs, "question": RunnablePassthrough()}
        | PROMPT
        | llm
        | StrOutputParser()
    )

    return chain, retriever


def stream_answer(question: str) -> Iterator[str]:
    """Yields answer tokens one by one — used by the FastAPI SSE endpoint in M6."""
    chain, _ = build_chain()
    yield from chain.stream(question)
