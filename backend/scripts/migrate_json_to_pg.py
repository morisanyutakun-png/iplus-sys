"""
One-time migration script: JSON files → PostgreSQL.

Usage:
  DATABASE_URL=postgresql+asyncpg://iplus:iplus@localhost:5432/iplus \
    python -m scripts.migrate_json_to_pg /path/to/iplus_sys
"""

import asyncio
import json
import os
import sys

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Add parent to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def migrate(source_dir: str, database_url: str):
    engine = create_async_engine(database_url, echo=True)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    # Create tables
    from app.models import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with session_factory() as db:
        # 1. Migrate students
        students_path = os.path.join(source_dir, "data", "students.json")
        if os.path.exists(students_path):
            with open(students_path, encoding="utf-8") as f:
                students = json.load(f)
            for s in students:
                await db.execute(
                    text(
                        "INSERT INTO students (id, name) VALUES (:id, :name) "
                        "ON CONFLICT (id) DO UPDATE SET name = :name"
                    ),
                    {"id": s["student_id"], "name": s["student_name"]},
                )
            print(f"Migrated {len(students)} students")

        # 2. Migrate materials + nodes
        materials_path = os.path.join(source_dir, "data", "materials.json")
        if os.path.exists(materials_path):
            with open(materials_path, encoding="utf-8") as f:
                data = json.load(f)
            materials = data.get("materials", [])
            for idx, m in enumerate(materials):
                aliases = json.dumps(m.get("aliases", []))
                await db.execute(
                    text(
                        "INSERT INTO materials (key, name, start_on, aliases, sort_order) "
                        "VALUES (:key, :name, :start_on, :aliases::jsonb, :sort_order) "
                        "ON CONFLICT (key) DO UPDATE SET name = :name, start_on = :start_on, "
                        "aliases = :aliases::jsonb, sort_order = :sort_order"
                    ),
                    {
                        "key": m["material_key"],
                        "name": m["material_name"],
                        "start_on": m.get("start_on"),
                        "aliases": aliases,
                        "sort_order": idx,
                    },
                )
                for nidx, n in enumerate(m.get("nodes", [])):
                    node_aliases = json.dumps(n.get("aliases", []))
                    await db.execute(
                        text(
                            "INSERT INTO material_nodes (key, material_key, title, range_text, "
                            "pdf_relpath, duplex, sort_order, aliases) "
                            "VALUES (:key, :mk, :title, :range, :pdf, :duplex, :order, :aliases::jsonb) "
                            "ON CONFLICT (key) DO UPDATE SET title = :title, range_text = :range, "
                            "pdf_relpath = :pdf, duplex = :duplex, sort_order = :order"
                        ),
                        {
                            "key": n["node_key"],
                            "mk": m["material_key"],
                            "title": n.get("title", ""),
                            "range": n.get("range_text", ""),
                            "pdf": n.get("pdf_relpath", ""),
                            "duplex": n.get("duplex", False),
                            "order": nidx + 1,
                            "aliases": node_aliases,
                        },
                    )
            print(f"Migrated {len(materials)} materials")

        # 3. Migrate student_nodes (pointers + history)
        nodes_dir = os.path.join(source_dir, "data", "student_nodes")
        if os.path.isdir(nodes_dir):
            count = 0
            for filename in os.listdir(nodes_dir):
                if not filename.endswith(".json"):
                    continue
                student_id = filename.replace(".json", "")
                filepath = os.path.join(nodes_dir, filename)
                with open(filepath, encoding="utf-8") as f:
                    sdata = json.load(f)

                pointers = sdata.get("pointers", {})
                for mat_key, ptr in pointers.items():
                    await db.execute(
                        text(
                            "INSERT INTO student_materials (student_id, material_key, pointer) "
                            "VALUES (:sid, :mk, :ptr) "
                            "ON CONFLICT (student_id, material_key) DO UPDATE SET pointer = :ptr"
                        ),
                        {"sid": student_id, "mk": mat_key, "ptr": ptr},
                    )

                # Migrate assigned_history
                for entry in sdata.get("assigned_history", []):
                    action = "assign"
                    if entry.get("removed"):
                        action = "remove"
                    elif entry.get("from_test"):
                        action = "advance"
                    mat = entry.get("material", "")
                    await db.execute(
                        text(
                            "INSERT INTO progress_history (student_id, material_key, node_key, action, metadata) "
                            "VALUES (:sid, :mk, :nk, :action, :meta::jsonb)"
                        ),
                        {
                            "sid": student_id,
                            "mk": mat,
                            "nk": entry.get("node"),
                            "action": action,
                            "meta": json.dumps(
                                {k: v for k, v in entry.items() if k not in ("material", "node", "timestamp")}
                            ),
                        },
                    )

                # Migrate archived_progress
                for mat_key, ptr in sdata.get("archived_progress", {}).items():
                    await db.execute(
                        text(
                            "INSERT INTO archived_progress (student_id, material_key, pointer) "
                            "VALUES (:sid, :mk, :ptr)"
                        ),
                        {"sid": student_id, "mk": mat_key, "ptr": ptr},
                    )
                count += 1
            print(f"Migrated {count} student node files")

        # 4. Migrate print_queue
        queue_path = os.path.join(source_dir, "exports", "print_queue.json")
        if os.path.exists(queue_path):
            with open(queue_path, encoding="utf-8") as f:
                queue = json.load(f)
            for idx, q in enumerate(queue):
                await db.execute(
                    text(
                        "INSERT INTO print_queue (student_id, student_name, material_key, material_name, "
                        "node_key, node_name, sort_order, status) "
                        "VALUES (:sid, :sn, :mk, :mn, :nk, :nn, :order, 'pending')"
                    ),
                    {
                        "sid": q.get("student", ""),
                        "sn": q.get("student_name", ""),
                        "mk": q.get("material", ""),
                        "mn": q.get("material_name", ""),
                        "nk": q.get("node", ""),
                        "nn": q.get("node_name", ""),
                        "order": idx,
                    },
                )
            print(f"Migrated {len(queue)} queue items")

        # 5. Migrate print_log
        log_path = os.path.join(source_dir, "exports", "print_log.json")
        if os.path.exists(log_path):
            with open(log_path, encoding="utf-8") as f:
                logs = json.load(f)
            for entry in logs:
                await db.execute(
                    text(
                        "INSERT INTO print_log (type, job_id, student_id, student_name, "
                        "material_key, material_name, node_key, node_name, success) "
                        "VALUES (:type, :jid, :sid, :sn, :mk, :mn, :nk, :nn, :success)"
                    ),
                    {
                        "type": entry.get("type", "printed"),
                        "jid": entry.get("job_id", ""),
                        "sid": entry.get("student", ""),
                        "sn": entry.get("student_name", ""),
                        "mk": entry.get("material", ""),
                        "mn": entry.get("material_name", ""),
                        "nk": entry.get("node", ""),
                        "nn": entry.get("node_name", ""),
                        "success": entry.get("type") == "printed",
                    },
                )
            print(f"Migrated {len(logs)} log entries")

        await db.commit()
        print("Migration complete!")

    await engine.dispose()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python -m scripts.migrate_json_to_pg <source_dir>")
        sys.exit(1)

    source_dir = sys.argv[1]
    database_url = os.environ.get(
        "DATABASE_URL", "postgresql+asyncpg://iplus:iplus@localhost:5432/iplus"
    )
    asyncio.run(migrate(source_dir, database_url))
