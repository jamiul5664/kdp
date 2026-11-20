from app.agents.orchestrator import AgentOrchestrator
from app.integrations.image_generation.providers import IllustrationEngine
from app.integrations.llm.router import get_default_llm_router
from app.integrations.storage.storage_service import LocalStorageService
from app.services.approval_service import ApprovalEngine
from app.services.book_service import BookService
from app.services.cover_service import KDPCoverGenerationService
from app.services.pdf_service import KDPInteriorPDFService
from app.services.research_service import MarketResearchService, NicheScoringEngine
from app.services.seo_service import KDPSeoService

approval_engine = ApprovalEngine()
book_service = BookService()
illustration_engine = IllustrationEngine()
storage_service = LocalStorageService()
research_service = MarketResearchService()
scoring_engine = NicheScoringEngine()
pdf_service = KDPInteriorPDFService()
cover_service = KDPCoverGenerationService()
seo_service = KDPSeoService()

orchestrator = AgentOrchestrator(
    llm_router=get_default_llm_router(),
    approval_engine=approval_engine,
)
