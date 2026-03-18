import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.database import engine
from app.api.router import api_router

logger = logging.getLogger(__name__)

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations" / "versions"


async def run_migrations(conn):
    """Run SQL migration files that haven't been applied yet."""
    # Create migrations tracking table if not exists
    await conn.execute(text(
        "CREATE TABLE IF NOT EXISTS _migrations (filename VARCHAR PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())"
    ))
    result = await conn.execute(text("SELECT filename FROM _migrations"))
    applied = {row[0] for row in result.fetchall()}

    if not MIGRATIONS_DIR.exists():
        return

    for sql_file in sorted(MIGRATIONS_DIR.glob("*.sql")):
        if sql_file.name not in applied:
            logger.info(f"Applying migration: {sql_file.name}")
            sql = sql_file.read_text()
            for statement in sql.split(";"):
                stmt = statement.strip()
                if stmt and not stmt.startswith("--"):
                    await conn.execute(text(stmt))
            await conn.execute(
                text("INSERT INTO _migrations (filename) VALUES (:f)"),
                {"f": sql_file.name},
            )
            logger.info(f"Migration applied: {sql_file.name}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-create tables on startup
    from app.models import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await run_migrations(conn)
    yield
    await engine.dispose()


app = FastAPI(title="iPlus Sys", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.get("/ping")
async def ping():
    return {"status": "ok"}
