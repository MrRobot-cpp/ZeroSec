import uuid
import hashlib
from datetime import datetime
from pathlib import Path
from docx import Document
from PyPDF2 import PdfReader, PdfWriter

CANARY_TOKENS = ["zqxorin", "velmora", "kythrax"]
WATERMARK_TEXT = "Internal Reference: zqxorin velmora zqxorin"
OUTPUT_DIR = Path(__file__).resolve().parents[1] / "data" / "canary_output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def generate_metadata(content: bytes) -> dict:
    canary_id = str(uuid.uuid4())
    timestamp = datetime.utcnow().isoformat()
    hash_val = calculate_hash(content)
    return {
        "canary_id": canary_id,
        "timestamp": timestamp,
        "hash": hash_val
    }

def calculate_hash(content: bytes) -> str:
    sha256 = hashlib.sha256()
    sha256.update(content)
    return sha256.hexdigest()

def watermark_txt(input_path: str) -> dict:
    with open(input_path, "rb") as f:
        original_content = f.read()
    meta = generate_metadata(original_content)
    watermarked_content = (
        f"{WATERMARK_TEXT}\nCanary-ID: {meta['canary_id']}\nTimestamp: {meta['timestamp']}\nSHA256: {meta['hash']}\n".encode("utf-8") + original_content
    )
    output_path = OUTPUT_DIR / (Path(input_path).stem + "_canary.txt")
    with open(output_path, "wb") as f:
        f.write(watermarked_content)
    meta["output_path"] = str(output_path)
    return meta

def watermark_pdf(input_path: str) -> dict:
    with open(input_path, "rb") as f:
        original_content = f.read()
    meta = generate_metadata(original_content)
    reader = PdfReader(input_path)
    writer = PdfWriter()
    for page in reader.pages:
        page_text = f"{WATERMARK_TEXT}\nCanary-ID: {meta['canary_id']}\nTimestamp: {meta['timestamp']}\nSHA256: {meta['hash']}\n"
        if "/Annots" not in page:
            page["/Annots"] = []
        page.extract_text()
        writer.add_page(page)
    output_path = OUTPUT_DIR / (Path(input_path).stem + "_canary.pdf")
    with open(output_path, "wb") as f:
        writer.write(f)
    meta["output_path"] = str(output_path)
    return meta

def watermark_docx(input_path: str) -> dict:
    doc = Document(input_path)
    with open(input_path, "rb") as f:
        original_content = f.read()
    meta = generate_metadata(original_content)
    doc.add_paragraph(WATERMARK_TEXT)
    doc.add_paragraph(f"Canary-ID: {meta['canary_id']}")
    doc.add_paragraph(f"Timestamp: {meta['timestamp']}")
    doc.add_paragraph(f"SHA256: {meta['hash']}")
    output_path = OUTPUT_DIR / (Path(input_path).stem + "_canary.docx")
    doc.save(output_path)
    meta["output_path"] = str(output_path)
    return meta
