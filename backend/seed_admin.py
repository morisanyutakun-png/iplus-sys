"""
初回管理者アカウント作成スクリプト。

使い方:
  ADMIN_USERNAME=admin ADMIN_GOOGLE_EMAIL=admin@example.com python seed_admin.py

または環境変数なしで実行するとエラーになります。
"""
import asyncio
import os
import sys

from sqlalchemy import select

from app.database import async_session
from app.models.user import User, UserRole


ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_GOOGLE_EMAIL = os.environ.get("ADMIN_GOOGLE_EMAIL", "")


async def main():
    if not ADMIN_GOOGLE_EMAIL:
        print("Error: ADMIN_GOOGLE_EMAIL environment variable is required.", file=sys.stderr)
        print("Usage: ADMIN_USERNAME=admin ADMIN_GOOGLE_EMAIL=admin@example.com python seed_admin.py", file=sys.stderr)
        sys.exit(1)

    async with async_session() as db:
        existing = await db.execute(select(User).where(User.google_email == ADMIN_GOOGLE_EMAIL))
        if existing.scalars().first():
            print(f"Admin with email '{ADMIN_GOOGLE_EMAIL}' already exists. Skipping.")
            return

        user = User(
            username=ADMIN_USERNAME,
            google_email=ADMIN_GOOGLE_EMAIL,
            role=UserRole.admin,
        )
        db.add(user)
        await db.commit()
        print(f"Admin user '{ADMIN_USERNAME}' ({ADMIN_GOOGLE_EMAIL}) created successfully.")


if __name__ == "__main__":
    asyncio.run(main())
