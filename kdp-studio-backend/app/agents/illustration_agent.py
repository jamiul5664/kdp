from typing import Any, Dict, List, Optional
from app.agents.base import AgentContext, AgentResult, BaseAgent
from app.integrations.image_generation.base import ImageGenerationParams
from app.integrations.image_generation.providers import IllustrationEngine
from app.integrations.llm.router import LLMRouter

SUPPORTED_ILLUSTRATION_TYPES = (
    "coloring",
    "activity",
    "puzzle_diagram",
    "children",
    "journal_decoration",
    "educational_diagram",
)


class IllustrationAgent(BaseAgent):
    """
    Agent 7: AI Illustration Generation Agent.
    Calls IllustrationEngine using approved page briefs, enforces coloring-book clean line-art
    directives, validates actual pixel dimensions for 300 DPI print readiness, detects duplicates,
    and supports variations & individual page regeneration.
    """

    name = "IllustrationAgent"

    def __init__(
        self,
        llm_router: LLMRouter,
        illustration_engine: Optional[IllustrationEngine] = None,
    ) -> None:
        super().__init__(llm_router)
        self.engine = illustration_engine or IllustrationEngine()

    async def run(self, payload: Dict[str, Any], context: AgentContext) -> AgentResult:
        briefs: List[Dict[str, Any]] = payload.get("page_briefs") or []
        if not briefs:
            prompt = str(payload.get("prompt") or "Original print-ready illustration")
            briefs = [{"page_number": int(payload.get("page_number", 1)), "prompt": prompt}]

        illustration_type = str(payload.get("illustration_type") or "coloring")
        if illustration_type not in SUPPORTED_ILLUSTRATION_TYPES:
            illustration_type = "coloring"

        model_name = str(payload.get("model_name") or "default-image-model")
        style_guide = str(
            payload.get("style_guide")
            or "Consistent crisp line weights, balanced negative space, print-safe margins"
        )
        width_in = float(payload.get("target_width_in", 8.5))
        height_in = float(payload.get("target_height_in", 11.0))
        variations_count = max(1, min(4, int(payload.get("variations", 1))))

        generated_assets: List[Dict[str, Any]] = []
        warnings: List[str] = []

        for item in briefs:
            page_number = int(item.get("page_number", 1))
            base_prompt = str(item.get("prompt") or item.get("illustration_brief") or "").strip()
            params = ImageGenerationParams(
                prompt=base_prompt,
                illustration_type=illustration_type,
                model_name=model_name,
                target_width_in=width_in,
                target_height_in=height_in,
                target_dpi=300,
                style_guide=style_guide,
                seed=item.get("seed"),
                allow_embedded_text=bool(item.get("allow_embedded_text", False)),
                version=int(item.get("version", 1)),
            )

            assets = (
                await self.engine.generate_variations(params, count=variations_count)
                if variations_count > 1
                else [await self.engine.generate_for_page(params)]
            )

            for asset in assets:
                if not asset.resolution.meets_300_dpi:
                    warnings.append(
                        f"Page {page_number} asset {asset.asset_id} effective DPI is "
                        f"{asset.resolution.effective_dpi_x}x{asset.resolution.effective_dpi_y} (< 300 DPI)."
                    )
                if asset.is_duplicate:
                    warnings.append(
                        f"Page {page_number} asset {asset.asset_id} matched an existing SHA-256 asset hash."
                    )
                generated_assets.append(
                    {
                        "asset_id": asset.asset_id,
                        "page_number": page_number,
                        "provider_id": asset.provider_id,
                        "model_name": asset.model_name,
                        "prompt": asset.prompt,
                        "illustration_type": asset.illustration_type,
                        "version": asset.version,
                        "sha256_hash": asset.sha256_hash,
                        "is_duplicate": asset.is_duplicate,
                        "resolution": {
                            "width_px": asset.resolution.width_px,
                            "height_px": asset.resolution.height_px,
                            "effective_dpi_x": asset.resolution.effective_dpi_x,
                            "effective_dpi_y": asset.resolution.effective_dpi_y,
                            "meets_300_dpi": asset.resolution.meets_300_dpi,
                            "note": asset.resolution.note,
                        },
                    }
                )

        return AgentResult(
            agent_name=self.name,
            status="completed",
            summary=f"Generated {len(generated_assets)} verified {illustration_type} illustration asset(s).",
            data={"assets": generated_assets, "style_guide": style_guide},
            warnings=warnings,
        )
