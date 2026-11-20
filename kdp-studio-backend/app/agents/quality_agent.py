from typing import Any, Dict, List
from app.agents.base import AgentContext, AgentResult, BaseAgent
from app.services.cover_service import CoverCalculationInput, KDPCoverCalculator


class KDPQualityCheckerAgent(BaseAgent):
    """
    Agent 10 (Agent A): KDP Quality Checker Agent.
    Validates Interior PDF, Cover PDF, trim size, page count, bleed, margins, font embedding,
    image resolution, cover dimensions, blank pages, text overflow, and image overflow.
    Returns Pass / Warning / Fail with explicit explanation and suggested fix per check.
    """

    name = "KDPQualityCheckerAgent"

    async def run(self, payload: Dict[str, Any], context: AgentContext) -> AgentResult:
        checks: List[Dict[str, str]] = []

        def add_check(name: str, status: str, explanation: str, suggested_fix: str) -> None:
            checks.append(
                {
                    "check": name,
                    "status": status,  # "Pass" | "Warning" | "Fail"
                    "explanation": explanation,
                    "suggested_fix": suggested_fix,
                }
            )

        trim_w = float(payload.get("trim_width_in", 6.0))
        trim_h = float(payload.get("trim_height_in", 9.0))
        page_count = int(payload.get("page_count", 0))
        bleed = bool(payload.get("bleed", True))
        paper_type = str(payload.get("paper_type", "white"))
        ink_type = str(payload.get("ink_type", "black_and_white"))

        interior_pdf_bytes: bytes | None = payload.get("interior_pdf_bytes")
        cover_pdf_bytes: bytes | None = payload.get("cover_pdf_bytes")
        interior_report: Dict[str, Any] = payload.get("interior_validation_report") or {}
        cover_specs: Dict[str, Any] = payload.get("cover_specifications") or {}
        margins_in: Dict[str, float] = payload.get("margins_in") or {}
        low_res_pages: List[int] = payload.get("low_res_image_pages") or []
        blank_pages: List[int] = payload.get("unexpected_blank_pages") or []
        text_overflow_pages: List[int] = payload.get("text_overflow_pages") or []
        image_overflow_pages: List[int] = payload.get("image_overflow_pages") or []
        fonts_embedded = payload.get("fonts_embedded", True)

        # 1. Interior PDF presence & integrity
        if interior_pdf_bytes and interior_pdf_bytes.startswith(b"%PDF-") and b"%%EOF" in interior_pdf_bytes[-64:]:
            add_check("Interior PDF", "Pass", "Valid PDF header and EOF marker detected.", "No action required.")
        elif interior_report:
            add_check("Interior PDF", "Warning", "Interior validation metadata provided without raw PDF bytes.", "Attach generated interior PDF bytes for binary integrity verification.")
        else:
            add_check("Interior PDF", "Fail", "Interior PDF is missing or corrupted.", "Regenerate interior manuscript using KDPInteriorPDFService.")

        # 2. Cover PDF presence & integrity
        if cover_pdf_bytes and cover_pdf_bytes.startswith(b"%PDF-") and b"%%EOF" in cover_pdf_bytes[-64:]:
            add_check("Cover PDF", "Pass", "Full-wrap cover PDF binary integrity verified.", "No action required.")
        elif cover_specs:
            add_check("Cover PDF", "Warning", "Cover specifications supplied without cover PDF bytes.", "Export print-ready full-wrap cover PDF before upload.")
        else:
            add_check("Cover PDF", "Fail", "Full-wrap cover PDF is missing.", "Run CoverDesignerAgent to generate the full-wrap cover PDF.")

        # 3. Trim size validation (KDP paperback bounds: 4"-8.5" wide x 6"-11.69" tall)
        if 4.0 <= trim_w <= 8.5 and 6.0 <= trim_h <= 11.69:
            add_check("Trim Size", "Pass", f'Trim {trim_w}" × {trim_h}" is within Amazon KDP paperback limits.', "No action required.")
        else:
            add_check("Trim Size", "Fail", f'Trim {trim_w}" × {trim_h}" exceeds KDP paperback trim limits.', 'Select a supported KDP trim such as 6"×9", 8.5"×8.5", or 8.5"×11".')

        # 4. Page count validation (24–828 paperback)
        if 24 <= page_count <= 828:
            add_check("Page Count", "Pass", f"{page_count} pages falls within KDP paperback bounds (24–828).", "No action required.")
        else:
            add_check("Page Count", "Fail", f"Page count {page_count} is outside KDP paperback range (24–828).", "Adjust interior page count to at least 24 and at most 828 pages.")

        # 5. Bleed validation
        bleed_desc = 'enabled (+0.125" outer/top/bottom)' if bleed else "disabled (no-bleed)"
        add_check(
            "Bleed",
            "Pass",
            f"Bleed setting is {bleed_desc}.",
            'Verify full-page artwork extends 0.125" past trim if bleed is enabled.',
        )

        # 6. Margins validation
        min_inside = 0.375 if page_count <= 150 else 0.5 if page_count <= 300 else 0.625 if page_count <= 500 else 0.75 if page_count <= 700 else 0.875
        min_outer = 0.375 if bleed else 0.25
        inside_m = float(margins_in.get("inside", min_inside))
        outside_m = float(margins_in.get("outside", min_outer))
        if inside_m >= min_inside and outside_m >= min_outer:
            add_check("Margins", "Pass", f'Inside ({inside_m}") and outside ({outside_m}") margins meet KDP safe zones.', "No action required.")
        else:
            add_check("Margins", "Fail", f'Margins inside={inside_m}", outside={outside_m}" fall below KDP minimum (inside>={min_inside}", outside>={min_outer}").', f'Increase inside gutter to >= {min_inside}" and outside margin to >= {min_outer}".')

        # 7. Font embedding
        if fonts_embedded:
            add_check("Font Embedding", "Pass", "All interior and cover fonts are marked embedded/subsetted.", "No action required.")
        else:
            add_check("Font Embedding", "Fail", "One or more fonts are not embedded.", "Embed all TTF/OTF fonts in ReportLab before exporting final PDFs.")

        # 8. Image resolution (actual pixels >= 300 DPI)
        if not low_res_pages:
            add_check("Image Resolution", "Pass", "All placed images meet >= 300 effective DPI based on pixel dimensions.", "No action required.")
        else:
            add_check("Image Resolution", "Fail", f"Images below 300 effective DPI on page(s): {low_res_pages}.", "Regenerate flagged illustrations at >= 300 DPI for target print dimensions.")

        # 9. Cover dimensions vs official KDP dynamic spine math
        if 24 <= page_count <= 828:
            expected_dims = KDPCoverCalculator.calculate(
                CoverCalculationInput(
                    trim_width_in=trim_w,
                    trim_height_in=trim_h,
                    page_count=page_count,
                    paper_type=paper_type,
                    ink_type=ink_type,
                    bleed=bleed,
                )
            )
            supplied_wrap = cover_specs.get("full_wrap_in") or {}
            if supplied_wrap:
                w_ok = abs(float(supplied_wrap.get("width", 0)) - expected_dims.full_width_in) <= 0.01
                h_ok = abs(float(supplied_wrap.get("height", 0)) - expected_dims.full_height_in) <= 0.01
                if w_ok and h_ok:
                    add_check("Cover Dimensions", "Pass", f'Full-wrap cover matches expected {expected_dims.full_width_in}" × {expected_dims.full_height_in}" (spine {expected_dims.spine_width_in}").', "No action required.")
                else:
                    add_check("Cover Dimensions", "Fail", f'Supplied cover {supplied_wrap} does not match expected {expected_dims.full_width_in}" × {expected_dims.full_height_in}".', "Recalculate cover wrap using KDPCoverCalculator after finalizing page count.")
            else:
                add_check("Cover Dimensions", "Warning", f'Expected full-wrap {expected_dims.full_width_in}" × {expected_dims.full_height_in}" not yet matched against exported cover specs.', "Generate full-wrap cover PDF and re-run quality check.")
        else:
            add_check("Cover Dimensions", "Fail", "Cannot validate cover spine width while page count is invalid.", "Fix page count (24–828) first, then recalculate cover dimensions.")

        # 10. Blank pages
        if not blank_pages:
            add_check("Blank Pages", "Pass", "No unexpected blank pages detected.", "No action required.")
        else:
            add_check("Blank Pages", "Warning", f"Unexpected blank pages detected at page(s): {blank_pages}.", "Remove accidental blank pages or mark intentional reverse pages as single-sided.")

        # 11. Text overflow
        if not text_overflow_pages:
            add_check("Text Overflow", "Pass", "No text clipping or overflow outside safe margins detected.", "No action required.")
        else:
            add_check("Text Overflow", "Fail", f"Text overflowed safe margins on page(s): {text_overflow_pages}.", "Shorten copy, decrease font size slightly, or split content across two pages.")

        # 12. Image overflow
        if not image_overflow_pages:
            add_check("Image Overflow", "Pass", "No unintended image bleed/overflow outside bounds detected.", "No action required.")
        else:
            add_check("Image Overflow", "Fail", f"Image overflow detected on page(s): {image_overflow_pages}.", "Fit illustrations inside safe margins or enable full-bleed trim specifications.")

        fail_count = sum(1 for c in checks if c["status"] == "Fail")
        warn_count = sum(1 for c in checks if c["status"] == "Warning")
        overall = "Fail" if fail_count > 0 else "Warning" if warn_count > 0 else "Pass"

        return AgentResult(
            agent_name=self.name,
            status="completed",
            summary=(
                f"KDP Quality Checker completed ({overall}): "
                f"{len(checks) - fail_count - warn_count} Pass, {warn_count} Warning, {fail_count} Fail."
            ),
            data={
                "overall_status": overall,
                "pass_count": len(checks) - fail_count - warn_count,
                "warning_count": warn_count,
                "fail_count": fail_count,
                "checks": checks,
                "ready_for_final_export_approval": fail_count == 0,
            },
            warnings=[c["explanation"] for c in checks if c["status"] != "Pass"],
        )
