import ssl

import certifi
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

# Neon requires SSL; detect from URL
connect_args = {}
if "neon.tech" in settings.database_url or "sslmode" in settings.database_url:
    ssl_ctx = ssl.create_default_context(cafile=certifi.where())
    connect_args["ssl"] = ssl_ctx

engine = create_async_engine(
    settings.database_url.split("?")[0],  # strip query params for asyncpg
    echo=False,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=300,
    connect_args=connect_args,
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    async with async_session() as session:
        yield session
