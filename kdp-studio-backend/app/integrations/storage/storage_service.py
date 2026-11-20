from pathlib import Path
from app.core.config import get_settings


class LocalStorageService:
    """Persists generated PDFs, covers, illustrations, and ZIP bundles under storage/."""

    def __init__(self, base_dir: str | None = None) -> None:
        settings = get_settings()
        self.root = Path(base_dir or settings.local_storage_path).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def save_bytes(self, relative_key: str, payload: bytes) -> Path:
        target = (self.root / relative_key).resolve()
        if not str(target).startswith(str(self.root)):
            raise ValueError("Invalid storage key path traversal detected.")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(payload)
        return target

    def read_bytes(self, relative_key: str) -> bytes:
        target = (self.root / relative_key).resolve()
        if not str(target).startswith(str(self.root)) or not target.exists():
            raise FileNotFoundError(f"Stored artifact not found: {relative_key}")
        return target.read_bytes()
