from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 100


def chunk_documents(documents: list[Document]) -> list[Document]:
    """
    Split documents into fixed-size chunks for retrieval.
    Shared by both LocalRAGProvider and ExternalRAGProvider to ensure
    identical chunking behavior regardless of provider mode.

    Preserves all source metadata and adds chunk_index + total_chunks.
    Empty/whitespace-only chunks are discarded.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""],
        keep_separator=True
    )

    chunked_docs = []
    for doc in documents:
        chunks = splitter.split_text(doc.page_content)
        for i, chunk in enumerate(chunks):
            if chunk.strip():
                chunked_docs.append(Document(
                    page_content=chunk,
                    metadata={
                        **doc.metadata,
                        "chunk_index": i,
                        "total_chunks": len(chunks)
                    }
                ))
    return chunked_docs
