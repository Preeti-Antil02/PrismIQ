"""
Document Ingestion & Normalization Service for PrismIQ Batch 2.
Supports CSV, PDF, DOCX, TXT, and raw text inputs with validation,
SHA-256 deduplication, and multi-tenant isolation.
"""

import csv
import hashlib
import io
import logging
import os
import re
import uuid
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Max allowable file size: 15 MB
MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024

SUPPORTED_FORMATS = {"csv", "pdf", "docx", "txt", "direct_input"}


class DocumentIngestionError(Exception):
    """Raised when document ingestion or parsing fails validation."""
    pass


class DocumentIngestionService:
    """
    Normalizes multi-format documents into canonical text and structured records.
    """

    @staticmethod
    def compute_content_hash(text: str) -> str:
        """Compute deterministic SHA-256 hash of normalized text."""
        normalized = re.sub(r"\s+", " ", text.strip()).lower()
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    @classmethod
    def parse_file(
        cls,
        file_bytes: bytes,
        filename: str,
        source_type: str = "notes",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Validate, detect format, and parse raw file bytes into extracted text and records.
        """
        if not file_bytes:
            raise DocumentIngestionError("Uploaded file is empty.")

        if len(file_bytes) > MAX_FILE_SIZE_BYTES:
            raise DocumentIngestionError(
                f"File size exceeds maximum limit of {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB."
            )

        fname = filename.strip()
        ext = os.path.splitext(fname)[1].lower().lstrip(".")
        if ext not in SUPPORTED_FORMATS and ext != "tsv":
            raise DocumentIngestionError(
                f"Unsupported file format '.{ext}'. Supported formats: {', '.join(sorted(SUPPORTED_FORMATS))}"
            )

        format_key = "csv" if ext in ("csv", "tsv") else ext
        meta = metadata or {}
        meta["original_filename"] = fname
        meta["file_size_bytes"] = len(file_bytes)

        if format_key == "csv":
            return cls.parse_csv(file_bytes, fname, source_type, meta)
        elif format_key == "pdf":
            return cls.parse_pdf(file_bytes, fname, source_type, meta)
        elif format_key == "docx":
            return cls.parse_docx(file_bytes, fname, source_type, meta)
        elif format_key == "txt":
            return cls.parse_txt(file_bytes, fname, source_type, meta)
        else:
            raise DocumentIngestionError(f"Unsupported format handler for: {format_key}")

    @classmethod
    def parse_direct_text(
        cls,
        raw_text: str,
        title: str = "Direct Text Input",
        source_type: str = "notes",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Parse directly pasted text or transcripts.
        """
        cleaned = raw_text.strip()
        if len(cleaned) < 10:
            raise DocumentIngestionError("Input text too short (minimum 10 characters required).")

        chash = cls.compute_content_hash(cleaned)
        meta = metadata or {}
        meta["title"] = title
        meta["character_count"] = len(cleaned)
        meta["word_count"] = len(cleaned.split())

        return {
            "source_type": source_type,
            "file_format": "direct_input",
            "filename": title,
            "content_hash": chash,
            "raw_content": cleaned,
            "metadata": meta,
            "parsed_records": [],
        }

    @classmethod
    def parse_csv(
        cls,
        file_bytes: bytes,
        filename: str,
        source_type: str,
        metadata: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Parse CSV / TSV files with auto-detection of delimiters and common column headers.
        """
        text = None
        for enc in ("utf-8", "utf-8-sig", "latin-1", "cp1252"):
            try:
                text = file_bytes.decode(enc)
                break
            except UnicodeDecodeError:
                continue

        if text is None:
            raise DocumentIngestionError("Unable to decode CSV file with supported text encodings.")

        # Auto-detect delimiter (comma or tab)
        first_line = text.splitlines()[0] if text.splitlines() else ""
        delimiter = "\t" if "\t" in first_line and first_line.count("\t") > first_line.count(",") else ","

        reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
        rows: List[Dict[str, Any]] = []
        for r in reader:
            clean_row = {str(k).strip(): str(v).strip() for k, v in r.items() if k is not None}
            if any(clean_row.values()):
                rows.append(clean_row)

        if not rows:
            raise DocumentIngestionError("CSV file contains no readable data rows.")

        chash = cls.compute_content_hash(text)
        metadata["row_count"] = len(rows)
        metadata["columns"] = list(rows[0].keys())

        return {
            "source_type": source_type,
            "file_format": "csv",
            "filename": filename,
            "content_hash": chash,
            "raw_content": text,
            "metadata": metadata,
            "parsed_records": rows,
        }

    @classmethod
    def parse_pdf(
        cls,
        file_bytes: bytes,
        filename: str,
        source_type: str,
        metadata: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Extract readable text from PDF documents using pypdf.
        """
        try:
            import pypdf
        except ImportError:
            raise DocumentIngestionError("pypdf library not available in runtime environment.")

        try:
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            if reader.is_encrypted:
                try:
                    reader.decrypt("")
                except Exception:
                    raise DocumentIngestionError("Encrypted or password-protected PDF files are not supported.")

            pages_text = []
            for i, page in enumerate(reader.pages):
                page_t = page.extract_text() or ""
                if page_t.strip():
                    pages_text.append(f"--- Page {i + 1} ---\n{page_t.strip()}")

            full_text = "\n\n".join(pages_text).strip()
            if not full_text:
                raise DocumentIngestionError("PDF contains no extractable text (scanned or image-only PDFs require OCR).")

            chash = cls.compute_content_hash(full_text)
            metadata["page_count"] = len(reader.pages)
            metadata["character_count"] = len(full_text)

            return {
                "source_type": source_type,
                "file_format": "pdf",
                "filename": filename,
                "content_hash": chash,
                "raw_content": full_text,
                "metadata": metadata,
                "parsed_records": [],
            }
        except DocumentIngestionError:
            raise
        except Exception as e:
            raise DocumentIngestionError(f"Corrupted or invalid PDF file: {str(e)}")

    @classmethod
    def parse_docx(
        cls,
        file_bytes: bytes,
        filename: str,
        source_type: str,
        metadata: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Extract text and table rows from DOCX files using python-docx.
        """
        try:
            import docx
        except ImportError:
            raise DocumentIngestionError("python-docx library not available in runtime environment.")

        try:
            doc = docx.Document(io.BytesIO(file_bytes))
            paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]

            # Also extract tables if present
            table_rows = []
            for table in doc.tables:
                for row in table.rows:
                    row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
                    if row_text:
                        table_rows.append(row_text)

            combined_parts = []
            if paragraphs:
                combined_parts.append("\n\n".join(paragraphs))
            if table_rows:
                combined_parts.append("\n[Tables]\n" + "\n".join(table_rows))

            full_text = "\n\n".join(combined_parts).strip()
            if not full_text:
                raise DocumentIngestionError("DOCX document contains no readable text content.")

            chash = cls.compute_content_hash(full_text)
            metadata["paragraph_count"] = len(paragraphs)
            metadata["table_count"] = len(doc.tables)

            return {
                "source_type": source_type,
                "file_format": "docx",
                "filename": filename,
                "content_hash": chash,
                "raw_content": full_text,
                "metadata": metadata,
                "parsed_records": [],
            }
        except DocumentIngestionError:
            raise
        except Exception as e:
            raise DocumentIngestionError(f"Corrupted or invalid DOCX document: {str(e)}")

    @classmethod
    def parse_txt(
        cls,
        file_bytes: bytes,
        filename: str,
        source_type: str,
        metadata: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Parse raw plain text files.
        """
        text = None
        for enc in ("utf-8", "utf-8-sig", "latin-1", "cp1252"):
            try:
                text = file_bytes.decode(enc)
                break
            except UnicodeDecodeError:
                continue

        if text is None:
            raise DocumentIngestionError("Unable to decode plain text file with supported encodings.")

        cleaned = text.strip()
        if len(cleaned) < 10:
            raise DocumentIngestionError("Text file is too short or empty.")

        chash = cls.compute_content_hash(cleaned)
        metadata["character_count"] = len(cleaned)
        metadata["line_count"] = len(cleaned.splitlines())

        return {
            "source_type": source_type,
            "file_format": "txt",
            "filename": filename,
            "content_hash": chash,
            "raw_content": cleaned,
            "metadata": metadata,
            "parsed_records": [],
        }
