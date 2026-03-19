import json

from pydantic_settings import BaseSettings


def _parse_str_list(value: str) -> list[str]:
    """Parse a comma-separated or JSON array string into a list."""
    v = value.strip()
    if not v:
        return []
    if v.startswith("["):
        return json.loads(v)
    return [item.strip() for item in v.split(",") if item.strip()]


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://iplus:iplus@localhost:5432/iplus"
    printer_name: str = "Kyocera_TASKalfa_4054ci_J_"
    printer_command: str = "lp"
    materials_base_dirs: str = "/Volumes/JukuShare,/Volumes/JukuShare-1"
    pdf_storage_dir: str = "storage/pdfs"
    cors_origins: str = "*"
    # Cloud deployment
    environment: str = "development"  # development | production
    use_print_agent: bool = False  # If true, queue jobs for an on-prem agent to execute

    @property
    def cors_origins_list(self) -> list[str]:
        return _parse_str_list(self.cors_origins)

    @property
    def materials_base_dirs_list(self) -> list[str]:
        return _parse_str_list(self.materials_base_dirs)

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
