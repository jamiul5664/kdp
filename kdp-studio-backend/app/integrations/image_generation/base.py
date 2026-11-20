import hashlib
import io
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional
from PIL import Image

IllustrationType = Literal[
    "coloring",
    "activity",
    "puzzle_diagram",
    "childrens_illustration",
    "journal_decoration",
    "educational_diagram",
    "cover_artwork",
]

COLORING_STYLE_DIRECTIVES = (
    "Pure solid white background (#FFFFFF). Crisp, clean, closed black ink outlines only. "
    "No gray shading, no gradients, no drop shadows, no watermarks, no embedded text unless "
    "explicitly requested. Print-friendly vector-like coloring book line art."
)


@dataclass
class ImageGenerationParams:
    prompt: str
    illustration_type: IllustrationType
    model_name: str = "gemini-image"
    target_width_in: float = 8.5
    target_height_in: float = 11.0
    target_dpi: int = 300
    style_guide: str = ""
    seed: Optional[int] = None
    allow_embedded_text: bool = False
    version: int = 1

    def build_final_prompt(self) -> str:
        parts = [self.prompt.strip()]
        if self.illustration_type == "coloring":
            parts.append(COLORING_STYLE_DIRECTIVES)
        if not self.allow_embedded_text:
            parts.append("Do not render watermarks or unwanted embedded text.")
        if self.style_guide:
            parts.append(f"Consistent Art Direction: {self.style_guide}")
        return " ".join(parts)


@dataclass
class PixelResolutionReport:
    actual_width_px: int
    actual_height_px: int
    effective_dpi_x: float
    effective_dpi_y: float
    min_effective_dpi: float
    meets_300_dpi: bool
    note: str


@dataclass
class GeneratedImageAsset:
    asset_id: str
    provider_id: str
    model_name: str
    prompt: str
    illustration_type: IllustrationType
    parameters: Dict[str, Any]
    version: int
    sha256_hash: str
    is_duplicate: bool
    resolution: PixelResolutionReport
    image_bytes: bytes
    mime_type: str = "image/png"
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


def inspect_actual_pixel_resolution(
    image_bytes: bytes,
    target_width_in: float,
    target_height_in: float,
    required_dpi: int = 300,
) -> PixelResolutionReport:
    """Check actual pixel dimensions — NEVER trust EXIF/header DPI metadata alone."""
    with Image.open(io.BytesIO(image_bytes)) as img:
        actual_w, actual_h = img.size

    eff_x = round(actual_w / max(0.1, target_width_in), 1)
    eff_y = round(actual_h / max(0.1, target_height_in), 1)
    min_eff = min(eff_x, eff_y)
    meets = min_eff >= required_dpi
    note = (
        f"Verified {actual_w}×{actual_h}px ({min_eff} effective DPI for "
        f"{target_width_in}\"×{target_height_in}\")."
        if meets
        else (
            f"Under-resolution warning: {actual_w}×{actual_h}px yields only {min_eff} effective DPI "
            f"(minimum {required_dpi} DPI required for KDP print)."
        )
    )
    return PixelResolutionReport(
        actual_width_px=actual_w,
        actual_height_px=actual_h,
        effective_dpi_x=eff_x,
        effective_dpi_y=eff_y,
        min_effective_dpi=min_eff,
        meets_300_dpi=meets,
        note=note,
    )


def compute_asset_hash(image_bytes: bytes) -> str:
    return hashlib.sha256(image_bytes).hexdigest()


class ImageProvider(ABC):
    provider_id: str

    @abstractmethod
    async def generate(self, params: ImageGenerationParams) -> bytes:
        raise NotImplementedError
