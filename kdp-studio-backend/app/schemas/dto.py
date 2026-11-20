from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=2, max_length=160)
    imprint_name: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ChatRequest(BaseModel):
    conversation_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    message: str = Field(min_length=1)
    attachments: List[Dict[str, Any]] = Field(default_factory=list)


class ResearchRequest(BaseModel):
    query: str = Field(min_length=2, max_length=240)
    category: str = "All Categories"
    target_audience: str = "General"
    marketplace: str = "amazon.com"
    csv_dataset: Optional[str] = None
    weights: Optional[Dict[str, float]] = None


class BookProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    subtitle: Optional[str] = None
    book_type: str = "Coloring Books"
    target_audience: str = "Adults"
    language: str = "en"
    trim_width: float = 8.5
    trim_height: float = 11.0
    page_count: int = Field(default=100, ge=24, le=828)
    bleed: bool = True
    paper_type: str = "white"


class PageUpsertRequest(BaseModel):
    page_number: int = Field(ge=1)
    page_type: str = "content"
    content_json: Dict[str, Any] = Field(default_factory=dict)
    image_asset_id: Optional[UUID] = None


class CoverGenerateRequest(BaseModel):
    project_id: UUID
    trim_width_in: float = 6.0
    trim_height_in: float = 9.0
    page_count: int = Field(ge=24, le=828)
    paper_type: str = "white"
    ink_type: str = "black_and_white"
    bleed: bool = True
    cover_finish: str = "matte"
    title: str
    subtitle: str = ""
    author_name: str
    back_description: str = ""
    reserve_barcode_area: bool = True


class ApprovalActionRequest(BaseModel):
    action: str = Field(pattern="^(approve|reject|request_revision)$")
    note: Optional[str] = None


class ExportRequest(BaseModel):
    project_id: UUID
    artifact_type: str = Field(
        pattern="^(interior_pdf|full_cover_pdf|metadata_json|book_preview|complete_zip)$"
    )


class SeoAuditRequest(BaseModel):
    title: str
    subtitle: str = ""
    description: str = ""
    keywords: List[str] = Field(default_factory=list, max_length=7)
    categories: List[str] = Field(default_factory=list, max_length=3)
    target_audience: str = ""
    author_name: str = ""


class SettingsUpdateRequest(BaseModel):
    theme: Optional[str] = None
    default_marketplace: Optional[str] = None
    default_trim_size: Optional[str] = None
    default_paper_type: Optional[str] = None
    scoring_weights_json: Optional[Dict[str, float]] = None
