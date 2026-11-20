import io
from typing import Dict, List, Optional
from uuid import uuid4
from PIL import Image, ImageDraw
from app.integrations.image_generation.base import (
    GeneratedImageAsset,
    ImageGenerationParams,
    ImageProvider,
    compute_asset_hash,
    inspect_actual_pixel_resolution,
)


class LocalPrintPlaceholderProvider(ImageProvider):
    """Deterministic high-resolution raster generator for local dev & unit testing (true 300 DPI pixels)."""

    provider_id = "local_raster_dev"

    async def generate(self, params: ImageGenerationParams) -> bytes:
        width_px = max(300, int(params.target_width_in * params.target_dpi))
        height_px = max(300, int(params.target_height_in * params.target_dpi))
        bg = (255, 255, 255) if params.illustration_type == "coloring" else (245, 247, 250)
        img = Image.new("RGB", (width_px, height_px), color=bg)
        draw = ImageDraw.Draw(img)
        margin = int(min(width_px, height_px) * 0.08)
        draw.rectangle(
            [margin, margin, width_px - margin, height_px - margin],
            outline=(15, 23, 42),
            width=4,
        )
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()


class AssetLibrary:
    """Stores prompts, provider IDs, generation parameters, versions, pixel checks, and duplicate hashes."""

    def __init__(self) -> None:
        self._assets: Dict[str, GeneratedImageAsset] = {}
        self._hashes: Dict[str, str] = {}

    def register(
        self,
        provider_id: str,
        params: ImageGenerationParams,
        image_bytes: bytes,
    ) -> GeneratedImageAsset:
        sha = compute_asset_hash(image_bytes)
        is_dup = sha in self._hashes
        resolution = inspect_actual_pixel_resolution(
            image_bytes,
            target_width_in=params.target_width_in,
            target_height_in=params.target_height_in,
            required_dpi=params.target_dpi,
        )
        asset = GeneratedImageAsset(
            asset_id=str(uuid4()),
            provider_id=provider_id,
            model_name=params.model_name,
            prompt=params.build_final_prompt(),
            illustration_type=params.illustration_type,
            parameters={
                "target_width_in": params.target_width_in,
                "target_height_in": params.target_height_in,
                "target_dpi": params.target_dpi,
                "style_guide": params.style_guide,
                "seed": params.seed,
            },
            version=params.version,
            sha256_hash=sha,
            is_duplicate=is_dup,
            resolution=resolution,
            image_bytes=image_bytes,
        )
        self._assets[asset.asset_id] = asset
        self._hashes.setdefault(sha, asset.asset_id)
        return asset

    def list_assets(self) -> List[GeneratedImageAsset]:
        return list(self._assets.values())

    def get(self, asset_id: str) -> Optional[GeneratedImageAsset]:
        return self._assets.get(asset_id)


class IllustrationEngine:
    """High-level engine coordinating provider calls, variations, regeneration, and asset library storage."""

    def __init__(self, provider: Optional[ImageProvider] = None, library: Optional[AssetLibrary] = None) -> None:
        self.provider = provider or LocalPrintPlaceholderProvider()
        self.library = library or AssetLibrary()

    async def generate_for_page(self, params: ImageGenerationParams) -> GeneratedImageAsset:
        raw_bytes = await self.provider.generate(params)
        return self.library.register(self.provider.provider_id, params, raw_bytes)

    async def generate_variations(
        self, params: ImageGenerationParams, count: int = 2
    ) -> List[GeneratedImageAsset]:
        outputs: List[GeneratedImageAsset] = []
        for idx in range(count):
            variant = ImageGenerationParams(
                prompt=params.prompt,
                illustration_type=params.illustration_type,
                model_name=params.model_name,
                target_width_in=params.target_width_in,
                target_height_in=params.target_height_in,
                target_dpi=params.target_dpi,
                style_guide=params.style_guide,
                seed=(params.seed or 100) + idx,
                allow_embedded_text=params.allow_embedded_text,
                version=params.version + idx,
            )
            outputs.append(await self.generate_for_page(variant))
        return outputs
