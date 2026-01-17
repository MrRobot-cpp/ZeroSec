from pathlib import Path
from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain_chroma import Chroma
from langchain_ollama import OllamaEmbeddings

# -------------------------
# CONFIG
# -------------------------
BASE_DIR = Path(__file__).resolve().parents[1]
DOCS_PATH = BASE_DIR / "data" / "docs"
EMBEDDING_MODEL = "llama2"

# -------------------------
# INITIALIZE RETRIEVER
# -------------------------
def build_retriever():
    loader = DirectoryLoader(
        str(DOCS_PATH),
        glob="*.txt",
        loader_cls=TextLoader
    )

    documents = loader.load()
    texts = [d.page_content for d in documents]

    embeddings = OllamaEmbeddings(model=EMBEDDING_MODEL)
    vectorstore = Chroma.from_texts(texts=texts, embedding=embeddings)

    return vectorstore.as_retriever()
