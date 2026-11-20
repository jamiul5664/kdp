from typing import Any, Dict, List
from app.integrations.storage.storage_service import LocalStorageService
from app.services.cover_service import (
    CoverCalculationInput,
    CoverDesignInput,
    KDPCoverGenerationService,
)
from app.services.pdf_service import (
    InteriorPageInput,
    InteriorPrintSpec,
    KDPInteriorPDFService,
)
from app.workers.celery_app import celery_app


@celery_app.task(
    name="app.tasks.export_tasks.export_interior_pdf_task",
    bind=True,
    max_retries=2,
    default_retry_delay=15,
)
def export_interior_pdf_task(
    self: Any,
    project_id: str,
    spec_dict: Dict[str, Any],
    pages_data: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Background Celery task compiling a print-ready KDP interior PDF + validation report."""
    try:
        pdf_engine = KDPInteriorPDFService()
        storage = LocalStorageService()
        spec = InteriorPrintSpec(**spec_dict)
        pages = [
            InteriorPageInput(
                page_number=int(p.get("page_number", idx)),
                heading=str(p.get("heading", "")),
                body_text=str(p.get("body_text", "")),
                expected_blank=bool(p.get("expected_blank", False)),
            )
            for idx, p in enumerate(pages_data, start=1)
        ]
        result = pdf_engine.generate_interior_pdf(spec, pages)
        pdf_key = f"exports/{project_id}/interior.pdf"
        preview_key = f"exports/{project_id}/interior_preview.png"
        storage.save_bytes(pdf_key, result["pdf_bytes"])
        storage.save_bytes(preview_key, result["preview_png_bytes"])
        return {
            "status": "completed",
            "storage_key": pdf_key,
            "preview_key": preview_key,
            "file_size_bytes": result["file_size_bytes"],
            "page_count": result["page_count"],
            "validation_report": result["validation_report"],
        }
    except Exception as exc:
        raise self.retry(exc=exc)


@celery_app.task(
    name="app.tasks.export_tasks.export_full_cover_pdf_task",
    bind=True,
    max_retries=2,
    default_retry_delay=15,
)
def export_full_cover_pdf_task(
    self: Any,
    project_id: str,
    calc_dict: Dict[str, Any],
    design_dict: Dict[str, Any],
) -> Dict[str, Any]:
    """Background Celery task compiling a print-ready KDP full-wrap cover PDF."""
    try:
        cover_engine = KDPCoverGenerationService()
        storage = LocalStorageService()
        res = cover_engine.generate_full_wrap_pdf(
            CoverCalculationInput(**calc_dict),
            CoverDesignInput(**design_dict),
        )
        cover_key = f"exports/{project_id}/full_cover.pdf"
        storage.save_bytes(cover_key, res["pdf_bytes"])
        return {
            "status": "completed",
            "storage_key": cover_key,
            "file_size_bytes": res["file_size_bytes"],
            "specifications": res["specifications"],
            "validation": res["validation"],
        }
    except Exception as exc:
        raise self.retry(exc=exc)
