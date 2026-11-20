"""
Unit & Integration Tests for Document Ingestion & Deduplication (Batch 2).
Tests CSV, PDF, DOCX, TXT, direct text parsing, SHA-256 deduplication,
and multi-tenant isolation.
"""

import io
import pytest
from src import batch2_storage
from src.document_ingestion_service import (
    DocumentIngestionError,
    DocumentIngestionService,
)

TENANT_A = "11111111-1111-1111-1111-111111111111"
TENANT_B = "22222222-2222-2222-2222-222222222222"


@pytest.fixture(autouse=True)
def reset_storage():
    batch2_storage.clear_tenant_cache()


def test_parse_direct_text():
    raw = "Prospect mentioned Competitor X has introduced aggressive 30% discounts for annual contracts."
    parsed = DocumentIngestionService.parse_direct_text(raw, title="Call Note", source_type="notes")
    assert parsed["file_format"] == "direct_input"
    assert parsed["filename"] == "Call Note"
    assert len(parsed["content_hash"]) == 64
    assert "Competitor X" in parsed["raw_content"]
    assert parsed["metadata"]["word_count"] > 5


def test_parse_direct_text_too_short():
    with pytest.raises(DocumentIngestionError, match="too short"):
        DocumentIngestionService.parse_direct_text("short")


def test_parse_csv_reviews():
    csv_content = """company,review,rating,sentiment
Acme Corp,Their search feature is blazingly fast and accurate,5,positive
Acme Corp,Onboarding was a nightmare and took 3 months,2,negative
RivalInc,Pricing surged 40% upon renewal with zero notice,1,negative
"""
    parsed = DocumentIngestionService.parse_file(
        file_bytes=csv_content.encode("utf-8"),
        filename="customer_reviews.csv",
        source_type="customer_review",
    )
    assert parsed["file_format"] == "csv"
    assert len(parsed["parsed_records"]) == 3
    assert parsed["parsed_records"][0]["company"] == "Acme Corp"
    assert parsed["parsed_records"][2]["company"] == "RivalInc"
    assert parsed["metadata"]["row_count"] == 3


def test_parse_csv_empty():
    with pytest.raises(DocumentIngestionError):
        DocumentIngestionService.parse_file(b"", filename="empty.csv")


def test_parse_txt():
    txt_content = "Customer interview transcript with VP of Engineering discussing cloud migration hurdles."
    parsed = DocumentIngestionService.parse_file(
        file_bytes=txt_content.encode("utf-8"),
        filename="interview.txt",
        source_type="interview",
    )
    assert parsed["file_format"] == "txt"
    assert parsed["raw_content"] == txt_content
    assert parsed["metadata"]["character_count"] == len(txt_content)


def test_parse_pdf():
    import pypdf
    # Create minimal in-memory PDF using pypdf
    writer = pypdf.PdfWriter()
    writer.add_blank_page(width=200, height=200)
    pdf_bytes = io.BytesIO()
    writer.write(pdf_bytes)

    # Blank PDF has no text, should raise DocumentIngestionError
    with pytest.raises(DocumentIngestionError, match="no extractable text"):
        DocumentIngestionService.parse_file(
            file_bytes=pdf_bytes.getvalue(),
            filename="blank.pdf",
            source_type="notes",
        )


def test_parse_docx():
    import docx
    doc = docx.Document()
    doc.add_heading("Customer Q3 Interview Notes", level=1)
    doc.add_paragraph("Prospect expressed significant interest in our automated compliance audit trail.")
    docx_bytes = io.BytesIO()
    doc.save(docx_bytes)

    parsed = DocumentIngestionService.parse_file(
        file_bytes=docx_bytes.getvalue(),
        filename="notes.docx",
        source_type="interview",
    )
    assert parsed["file_format"] == "docx"
    assert "Customer Q3 Interview Notes" in parsed["raw_content"]
    assert "automated compliance" in parsed["raw_content"]


def test_deduplication_same_tenant():
    raw_text = "This is a recurring sales call transcript discussing vendor evaluation criteria."
    parsed1 = DocumentIngestionService.parse_direct_text(raw_text, title="Call 1")
    doc1 = batch2_storage.save_document(parsed1, TENANT_A)
    assert doc1["is_duplicate"] is False

    # Second ingestion of identical text for Tenant A
    parsed2 = DocumentIngestionService.parse_direct_text(raw_text, title="Call 1 Copy")
    doc2 = batch2_storage.save_document(parsed2, TENANT_A)
    assert doc2["is_duplicate"] is True
    assert doc2["id"] == doc1["id"]


def test_tenant_isolation_deduplication():
    raw_text = "Standard deal document uploaded independently by two distinct enterprise tenants."
    parsed = DocumentIngestionService.parse_direct_text(raw_text, title="Deal Doc")

    doc_a = batch2_storage.save_document(parsed, TENANT_A)
    doc_b = batch2_storage.save_document(parsed, TENANT_B)

    assert doc_a["id"] != doc_b["id"]
    assert doc_b["is_duplicate"] is False
    assert len(batch2_storage.list_documents(TENANT_A)) == 1
    assert len(batch2_storage.list_documents(TENANT_B)) == 1
