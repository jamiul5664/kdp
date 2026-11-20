from dataclasses import dataclass
from typing import Dict, Tuple

BLEED_INCHES = 0.125
KDP_MIN_SPINE_TEXT_PAGES = 79

TRIM_SIZES: Dict[str, Tuple[float, float]] = {
    "6x9": (6.0, 9.0),
    "8.5x11": (8.5, 11.0),
    "8.5x8.5": (8.5, 8.5),
    "5.5x8.5": (5.5, 8.5),
    "7x10": (7.0, 10.0),
}

PAPER_CALIPERS: Dict[str, float] = {
    "white": 0.002252,
    "cream": 0.002500,
    "standard_color": 0.002252,
    "premium_color": 0.002347,
}


@dataclass(frozen=True)
class FullCoverDimensions:
    trim_width_in: float
    trim_height_in: float
    bleed_in: float
    spine_width_in: float
    full_width_in: float
    full_height_in: float
    full_width_px_300: int
    full_height_px_300: int
    spine_text_allowed: bool
    paper_caliper_in: float


def get_paper_caliper(paper_type: str, interior_type: str = "black_and_white") -> float:
    interior = interior_type.lower().replace(" ", "_")
    if interior == "premium_color":
        return PAPER_CALIPERS["premium_color"]
    if interior == "standard_color":
        return PAPER_CALIPERS["standard_color"]
    paper = paper_type.lower()
    if "cream" in paper:
        return PAPER_CALIPERS["cream"]
    return PAPER_CALIPERS["white"]


def calculate_full_cover_dimensions(
    trim_size: str,
    page_count: int,
    paper_type: str = "white",
    interior_type: str = "black_and_white",
    bleed: bool = True,
) -> FullCoverDimensions:
    """Calculate exact KDP paperback wrap dimensions using actual page count and paper caliper."""
    if trim_size not in TRIM_SIZES:
        raise ValueError(f"Unsupported KDP trim size: {trim_size}")
    if page_count < 24 or page_count > 828:
        raise ValueError("Amazon KDP paperback page count must be between 24 and 828.")

    trim_w, trim_h = TRIM_SIZES[trim_size]
    caliper = get_paper_caliper(paper_type, interior_type)
    bleed_in = BLEED_INCHES if bleed else 0.0
    spine_in = round(page_count * caliper, 4)
    full_w = round((bleed_in * 2) + (trim_w * 2) + spine_in, 3)
    full_h = round((bleed_in * 2) + trim_h, 3)

    return FullCoverDimensions(
        trim_width_in=trim_w,
        trim_height_in=trim_h,
        bleed_in=bleed_in,
        spine_width_in=spine_in,
        full_width_in=full_w,
        full_height_in=full_h,
        full_width_px_300=round(full_w * 300),
        full_height_px_300=round(full_h * 300),
        spine_text_allowed=page_count >= KDP_MIN_SPINE_TEXT_PAGES,
        paper_caliper_in=caliper,
    )
