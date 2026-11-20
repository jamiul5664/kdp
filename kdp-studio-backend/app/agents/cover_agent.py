from typing import Any, Dict, Optional
from app.agents.base import AgentContext, AgentResult, BaseAgent
from app.integrations.llm.router import LLMRouter
from app.services.cover_service import (
    CoverCalculationInput,
    CoverDesignInput,
    KDPCoverCalculator,
    KDPCoverGenerationService,
)


class CoverDesignerAgent(BaseAgent):
    """
    Agent 8: Amazon KDP Full-Cover Designer Agent.
    Uses KDPCoverCalculator strictly separated from KDPCoverGenerationService so spine width
    is always derived from official paper-caliper specs and page count (never guessed).
    """

    name = "CoverDesignerAgent"

    def __init__(
        self,
        llm_router: LLMRouter,
        cover_service: Optional[KDPCoverGenerationService] = None,
    ) -> None:
        super().__init__(llm_router)
        self.cover_service = cover_service or KDPCoverGenerationService()

    async def run(self, payload: Dict[str, Any], context: AgentContext) -> AgentResult:
        try:
            calc_input = CoverCalculationInput(
                trim_width_in=float(payload.get("trim_width_in", 6.0)),
                trim_height_in=float(payload.get("trim_height_in", 9.0)),
                page_count=int(payload.get("page_count", 100)),
                paper_type=str(payload.get("paper_type", "white")),
                ink_type=str(payload.get("ink_type", "black_and_white")),
                bleed=bool(payload.get("bleed", True)),
                cover_finish=str(payload.get("cover_finish", "matte")),
            )
            dims = KDPCoverCalculator.calculate(calc_input)
        except ValueError as exc:
            return AgentResult(
                agent_name=self.name,
                status="failed",
                summary="Invalid KDP cover parameters.",
                error=str(exc),
            )

        title = str(payload.get("title") or "Untitled Book").strip()
        subtitle = str(payload.get("subtitle") or "").strip()
        author_name = str(payload.get("author_name") or "Independent Publisher").strip()
        back_description = str(payload.get("back_description") or "").strip()

        llm_resp = await self._call_gateway_text(
            system_prompt=(
                "You are a book cover art director for Amazon KDP. Write concise back-cover copy "
                "(3–5 sentences) with zero misleading bestseller claims and zero trademarked terms."
            ),
            user_prompt=f"Title: {title}\nSubtitle: {subtitle}\nAudience: {context.target_audience}",
            context=context,
        )
        if not back_description and llm_resp and llm_resp.text:
            back_description = llm_resp.text

        design_input = CoverDesignInput(
            title=title,
            subtitle=subtitle,
            author_name=author_name,
            back_description=back_description,
            front_bg_hex=str(payload.get("front_bg_hex", "#171B25")),
            spine_bg_hex=str(payload.get("spine_bg_hex", "#11141C")),
            back_bg_hex=str(payload.get("back_bg_hex", "#141822")),
            text_hex=str(payload.get("text_hex", "#F1F3F9")),
            accent_hex=str(payload.get("accent_hex", "#8B7CFF")),
            reserve_barcode_area=bool(payload.get("reserve_barcode_area", True)),
        )

        generated = self.cover_service.generate_full_wrap_pdf(calc_input, design_input)
        warnings = []
        if not dims.spine_text_allowed:
            warnings.append(
                f"Spine text omitted automatically because page count ({calc_input.page_count}) is under 79 pages."
            )

        return AgentResult(
            agent_name=self.name,
            status="completed",
            summary=(
                f'Generated print-ready KDP full-wrap cover PDF ({dims.full_width_in}" × '
                f'{dims.full_height_in}", spine {dims.spine_width_in}", '
                f'{dims.full_width_px_300}×{dims.full_height_px_300} px @ 300 DPI).'
            ),
            data={
                "specifications": generated["specifications"],
                "validation": generated["validation"],
                "file_size_bytes": generated["file_size_bytes"],
                "pdf_bytes": generated["pdf_bytes"],
                "back_description": back_description,
            },
            prompt_tokens=llm_resp.prompt_tokens if llm_resp else 0,
            completion_tokens=llm_resp.completion_tokens if llm_resp else 0,
            estimated_cost_usd=llm_resp.estimated_cost_usd if llm_resp else 0.0,
            warnings=warnings,
        )
