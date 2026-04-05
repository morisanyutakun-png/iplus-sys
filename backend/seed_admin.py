"""
初回管理者アカウント作成スクリプト。

使い方:
  ADMIN_USERNAME=admin ADMIN_PASSWORD=yourpassword python seed_admin.py

または環境変数なしで実行してデフォルト値を使う（必ず変更すること）。
"""
import asyncio
import os
import sys

from sqlalchemy import select

from app.database import async_session
from app.models.user import User, UserRole
from app.auth.password import hash_password


ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")


async def main():
    if not ADMIN_PASSWORD:
        print("Error: ADMIN_PASSWORD environment variable is required.", file=sys.stderr)
        sys.exit(1)

    async with async_session() as db:
        existing = await db.execute(select(User).where(User.username == ADMIN_USERNAME))
        if existing.scalars().first():
            print(f"Admin user '{ADMIN_USERNAME}' already exists. Skipping.")
            return

        user = User(
            username=ADMIN_USERNAME,
            hashed_password=hash_password(ADMIN_PASSWORD),
            role=UserRole.admin,
        )
        db.add(user)
        await db.commit()
        print(f"Admin user '{ADMIN_USERNAME}' created successfully.")


if __name__ == "__main__":
    asyncio.run(main())
