from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://iplus:iplus@localhost:5432/iplus"
    printer_name: str = "Kyocera_TASKalfa_4054ci_J_"
    printer_command: str = "lp"
    materials_base_dirs: list[str] = ["/Volumes/JukuShare", "/Volumes/JukuShare-1"]
    pdf_storage_dir: str = "storage/pdfs"
    cors_origins: list[str] = ["*"]
    # Cloud deployment
    environment: str = "development"  # development | production

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: object) -> object:
        if isinstance(v, str):
            if not v.strip():
                return ["*"]
            if v.strip().startswith("["):
                import json
                return json.loads(v)
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
