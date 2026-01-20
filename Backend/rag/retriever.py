from pathlib import Path
from langchain_community.document_loaders import DirectoryLoader, TextLoader, PyPDFLoader, UnstructuredWordDocumentLoader
from langchain_chroma import Chroma
from langchain_ollama import OllamaEmbeddings
from langchain_core.documents import Document


# -------------------------
# CONFIG
# -------------------------
BASE_DIR = Path(__file__).resolve().parents[1]
DOCS_PATH = BASE_DIR / "data" / "docs"
EMBEDDING_MODEL = "llama2"

# Global vectorstore cache
_vectorstore_cache = None
_last_file_list = set()  # Track filenames instead of just count

def extract_text_from_file(file_path):
    """Extract text from various file formats"""
    file_extension = file_path.suffix.lower()

    try:
        # Plain text files
        if file_extension in ['.txt', '.md', '.log', '.csv', '.json', '.xml', '.html', '.htm']:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read()

        # PDF files
        elif file_extension == '.pdf':
            try:
                import PyPDF2
                text = []
                with open(file_path, 'rb') as f:
                    pdf_reader = PyPDF2.PdfReader(f)
                    for page in pdf_reader.pages:
                        text.append(page.extract_text())
                return '\n'.join(text)
            except Exception as e:
                print(f"Error reading PDF {file_path}: {e}")
                return ""

        # DOCX files
        elif file_extension == '.docx':
            try:
                import docx
                doc = docx.Document(file_path)
                return '\n'.join([paragraph.text for paragraph in doc.paragraphs])
            except Exception as e:
                print(f"Error reading DOCX {file_path}: {e}")
                return ""

        # DOC files
        elif file_extension == '.doc':
            try:
                import pypandoc
                return pypandoc.convert_file(str(file_path), 'plain')
            except Exception as e:
                print(f"Error reading DOC {file_path}: {e}")
                # Fallback: try reading as text
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    return f.read()

        # Other files - try reading as text
        else:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read()

    except Exception as e:
        print(f"Error extracting text from {file_path}: {e}")
        return ""

def load_all_documents():
    """Load all documents from the docs directory, supporting multiple file types"""
    documents = []

    # Get all files in the docs directory
    for file_path in DOCS_PATH.glob('*.*'):
        if file_path.is_file():
            try:
                # Extract text content
                text_content = extract_text_from_file(file_path)

                if text_content:
                    # Create a Document object with metadata
                    doc = Document(
                        page_content=text_content,
                        metadata={
                            'source': str(file_path),
                            'filename': file_path.name,
                            'file_type': file_path.suffix
                        }
                    )
                    documents.append(doc)
            except Exception as e:
                print(f"Error loading {file_path}: {e}")

    return documents

def build_retriever(force_reload=False):
    """
    Build a retriever that dynamically loads all file types.
    Uses caching to avoid rebuilding unless files have changed.

    Args:
        force_reload: If True, force rebuild the vectorstore
    """
    global _vectorstore_cache, _last_file_list

    # Get current file list
    current_files = set(f.name for f in DOCS_PATH.glob('*.*') if f.is_file())

    # Rebuild if forced, cache is empty, or file list changed
    if force_reload or _vectorstore_cache is None or current_files != _last_file_list:
        print(f"Building/rebuilding retriever with {len(current_files)} documents...")
        print(f"Files detected: {current_files}")

        # Load all documents
        documents = load_all_documents()

        if not documents:
            print("Warning: No documents found in the docs directory")
            # Return a dummy retriever
            embeddings = OllamaEmbeddings(model=EMBEDDING_MODEL)
            _vectorstore_cache = Chroma.from_texts(
                texts=["No documents available"],
                embedding=embeddings
            )
        else:
            # Extract text content
            texts = [doc.page_content for doc in documents]
            metadatas = [doc.metadata for doc in documents]

            print(f"Loaded {len(documents)} documents with text content")

            # Create embeddings and vectorstore
            embeddings = OllamaEmbeddings(model=EMBEDDING_MODEL)
            _vectorstore_cache = Chroma.from_texts(
                texts=texts,
                embedding=embeddings,
                metadatas=metadatas
            )

        _last_file_list = current_files
        print(f"Retriever built successfully with {len(documents)} documents")

    return _vectorstore_cache.as_retriever()
