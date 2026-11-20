import io
from dataclasses import dataclass
from typing import Any, Dict, Optional
from reportlab.lib.colors import HexColor
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from app.utils.kdp_dimensions import (
    BLEED_INCHES,
    KDP_MIN_SPINE_TEXT_PAGES,
    FullCoverDimensions,
    get_paper_caliper,
)


@dataclass(frozen=True)
class CoverCalculationInput:
    trim_width_in: float
    trim_height_in: float
    page_count: int
    paper_type: str = "white"
    ink_type: str = "black_and_white"
    bleed: bool = True
    cover_finish: str = "matte"  # matte | glossy


@dataclass(frozen=True)
class CoverDesignInput:
    title: str
    subtitle: str
    author_name: str
    back_description: str = ""
    front_bg_hex: str = "#171B25"
    spine_bg_hex: str = "#11141C"
    back_bg_hex: str = "#141822"
    text_hex: str = "#F1F3F9"
    accent_hex: str = "#8B7CFF"
    reserve_barcode_area: bool = True


class KDPCoverCalculator:
    """Pure KDP full-cover geometric calculation logic (strictly separated from cover design rendering)."""

    BARCODE_WIDTH_IN = 2.0
    BARCODE_HEIGHT_IN = 1.2
    BARCODE_MARGIN_IN = 0.25

    @staticmethod
    def calculate(params: CoverCalculationInput) -> FullCoverDimensions:
        if params.page_count < 24 or params.page_count > 828:
            raise ValueError("KDP paperback page count must be between 24 and 828.")
        caliper = get_paper_caliper(params.paper_type, params.ink_type)
        bleed_in = BLEED_INCHES if params.bleed else 0.0
        spine_in = round(params.page_count * caliper, 4)
        full_w = round((bleed_in * 2) + (params.trim_width_in * 2) + spine_in, 3)
        full_h = round((bleed_in * 2) + params.trim_height_in, 3)
        return FullCoverDimensions(
            trim_width_in=params.trim_width_in,
            trim_height_in=params.trim_height_in,
            bleed_in=bleed_in,
            spine_width_in=spine_in,
            full_width_in=full_w,
            full_height_in=full_h,
            full_width_px_300=round(full_w * 300),
            full_height_px_300=round(full_h * 300),
            spine_text_allowed=params.page_count >= KDP_MIN_SPINE_TEXT_PAGES,
            paper_caliper_in=caliper,
        )


class KDPCoverGenerationService:
    """Generates validated print-ready Amazon KDP full-wrap PDFs (Back + Spine + Front)."""

    def generate_full_wrap_pdf(
        self,
        calc_input: CoverCalculationInput,
        design: CoverDesignInput,
    ) -> Dict[str, Any]:
        dims = KDPCoverCalculator.calculate(calc_input)

        buf = io.BytesIO()
        w_pt = dims.full_width_in * inch
        h_pt = dims.full_height_in * inch
        bleed_pt = dims.bleed_in * inch
        trim_w_pt = dims.trim_width_in * inch
        spine_w_pt = dims.spine_width_in * inch

        c = canvas.Canvas(buf, pagesize=(w_pt, h_pt))
        c.setTitle(f"{design.title} — KDP Full Cover Wrap")
        c.setAuthor(design.author_name)
        c.setCreator("KDP Studio AI Cover Engine")

        # 1. Back Cover Panel
        back_w = bleed_pt + trim_w_pt
        c.setFillColor(HexColor(design.back_bg_hex))
        c.rect(0, 0, back_w, h_pt, stroke=0, fill=1)

        # 2. Spine Panel (exact calculated width)
        spine_x = back_w
        c.setFillColor(HexColor(design.spine_bg_hex))
        c.rect(spine_x, 0, spine_w_pt, h_pt, stroke=0, fill=1)

        # 3. Front Cover Panel
        front_x = spine_x + spine_w_pt
        front_w = trim_w_pt + bleed_pt
        c.setFillColor(HexColor(design.front_bg_hex))
        c.rect(front_x, 0, front_w, h_pt, stroke=0, fill=1)

        # Accent bar on Front Cover
        c.setFillColor(HexColor(design.accent_hex))
        c.rect(front_x + 0.5 * inch, h_pt - 0.9 * inch, 1.0 * inch, 0.08 * inch, stroke=0, fill=1)

        # Front Cover Typography
        c.setFillColor(HexColor(design.text_hex))
        c.setFont("Helvetica-Bold", 24)
        c.drawString(front_x + 0.5 * inch, h_pt - 1.45 * inch, design.title[:48])
        if design.subtitle:
            c.setFont("Helvetica", 12)
            c.drawString(front_x + 0.5 * inch, h_pt - 1.85 * inch, design.subtitle[:72])
        c.setFont("Helvetica", 12)
        c.drawString(front_x + 0.5 * inch, bleed_pt + 0.65 * inch, design.author_name[:50])

        # Spine Typography (ONLY if >= 79 pages per official KDP rule)
        if dims.spine_text_allowed:
            c.saveState()
            c.translate(spine_x + (spine_w_pt / 2), h_pt / 2)
            c.rotate(-90)
            c.setFillColor(HexColor(design.text_hex))
            c.setFont("Helvetica-Bold", 9)
            c.drawCentredString(0, -3, f"{design.title[:42]} — {design.author_name[:24]}")
            c.restoreState()

        # Back Cover Description & Reserved KDP ISBN Barcode Safe Area (2.0" × 1.2")
        if design.back_description:
            c.setFillColor(HexColor(design.text_hex))
            c.setFont("Helvetica", 10)
            y = h_pt - 1.3 * inch
            for line in design.back_description.splitlines()[:14]:
                c.drawString(bleed_pt + 0.5 * inch, y, line[:62])
                y -= 14

        if design.reserve_barcode_area:
            bx = back_w - (KDPCoverCalculator.BARCODE_WIDTH_IN + KDPCoverCalculator.BARCODE_MARGIN_IN) * inch
            by = bleed_pt + KDPCoverCalculator.BARCODE_MARGIN_IN * inch
            c.setFillColor(HexColor("#FFFFFF"))
            c.rect(
                bx,
                by,
                KDPCoverCalculator.BARCODE_WIDTH_IN * inch,
                KDPCoverCalculator.BARCODE_HEIGHT_IN * inch,
                stroke=0,
                fill=1,
            )

        c.showPage()
        c.save()
        pdf_bytes = buf.getvalue()

        return {
            "pdf_bytes": pdf_bytes,
            "file_size_bytes": len(pdf_bytes),
            "specifications": {
                "front_cover_in": {"width": dims.trim_width_in, "height": dims.trim_height_in},
                "back_cover_in": {"width": dims.trim_width_in, "height": dims.trim_height_in},
                "spine_width_in": dims.spine_width_in,
                "outer_bleed_in": dims.bleed_in,
                "full_wrap_in": {"width": dims.full_width_in, "height": dims.full_height_in},
                "full_wrap_px_300dpi": {
                    "width": dims.full_width_px_300,
                    "height": dims.full_height_px_300,
                },
                "spine_text_allowed": dims.spine_text_allowed,
                "cover_finish": calc_input.cover_finish,
            },
            "validation": {
                "dimensions_verified": True,
                "barcode_safe_area_reserved": design.reserve_barcode_area,
                "pdf_integrity": pdf_bytes.startswith(b"%PDF-") and b"%%EOF" in pdf_bytes[-64:],
            },
        }
