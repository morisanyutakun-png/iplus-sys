from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, delete, func as sa_func, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.lesson_record import LessonRecord
from app.models.student_material import StudentMaterial, ProgressHistory, ArchivedProgress
from app.models.material import Material, MaterialNode
from app.models.print_queue import PrintQueue
from app.schemas.lesson_record import (
    LessonRecordOut,
    LessonRecordBatchRequest,
    LessonRecordBatchResponse,
    MasteryBatchRequest,
    MasteryBatchResponse,
    MasteryResultItem,
)

router = APIRouter()


@router.get("")
async def list_lesson_records(
    student_id: str | None = Query(None),
    material_key: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    limit: int = Query(200, le=1000),
    db: AsyncSession = Depends(get_db),
):
    query = select(LessonRecord).order_by(
        LessonRecord.lesson_date.desc(), LessonRecord.id.desc()
    )
    if student_id:
        query = query.where(LessonRecord.student_id == student_id)
    if material_key:
        query = query.where(LessonRecord.material_key == material_key)
    if date_from:
        query = query.where(LessonRecord.lesson_date >= date_from)
    if date_to:
        query = query.where(LessonRecord.lesson_date <= date_to)
    query = query.limit(limit)

    result = await db.execute(query)
    records = result.scalars().all()
    return {"records": [LessonRecordOut.model_validate(r) for r in records]}


@router.post("/batch", response_model=LessonRecordBatchResponse)
async def batch_upsert_lesson_records(
    body: LessonRecordBatchRequest,
    db: AsyncSession = Depends(get_db),
):
    if not body.records:
        return LessonRecordBatchResponse(upserted=0)

    for rec in body.records:
        accuracy_rate = None
        if rec.score is not None and rec.max_score is not None and rec.max_score > 0:
            accuracy_rate = rec.score / rec.max_score

        stmt = pg_insert(LessonRecord).values(
            student_id=rec.student_id,
            material_key=rec.material_key,
            node_key=rec.node_key,
            lesson_date=rec.lesson_date,
            status=rec.status,
            score=rec.score,
            max_score=rec.max_score,
            accuracy_rate=accuracy_rate,
            notes=rec.notes,
        )
        stmt = stmt.on_conflict_do_update(
            constraint="uq_lesson_record",
            set_={
                "status": stmt.excluded.status,
                "score": stmt.excluded.score,
                "max_score": stmt.excluded.max_score,
                "accuracy_rate": stmt.excluded.accuracy_rate,
                "notes": stmt.excluded.notes,
                "updated_at": func.now(),
            },
        )
        await db.execute(stmt)

    await db.commit()
    return LessonRecordBatchResponse(upserted=len(body.records))


@router.post("/batch-with-progress", response_model=MasteryBatchResponse)
async def batch_mastery_input(
    body: MasteryBatchRequest,
    db: AsyncSession = Depends(get_db),
):
    """定着度入力: 結果保存 + ポインタ進行 + 印刷キュー自動追加"""
    if not body.records:
        return MasteryBatchResponse(processed=0, advanced=0, retried=0, queued=0, results=[])

    # Get current max sort_order in print queue
    max_order_result = await db.execute(
        select(sa_func.coalesce(sa_func.max(PrintQueue.sort_order), 0))
    )
    sort_order = max_order_result.scalar() + 1

    results: list[MasteryResultItem] = []
    advanced_count = 0
    retried_count = 0
    queued_count = 0
    completed_count = 0

    for rec in body.records:
        # 1. Save lesson record (upsert)
        accuracy_rate = None
        if rec.score is not None and rec.max_score is not None and rec.max_score > 0:
            accuracy_rate = rec.score / rec.max_score

        stmt = pg_insert(LessonRecord).values(
            student_id=rec.student_id,
            material_key=rec.material_key,
            node_key=rec.node_key,
            lesson_date=rec.lesson_date,
            status=rec.status,
            score=rec.score,
            max_score=rec.max_score,
            accuracy_rate=accuracy_rate,
            notes=rec.notes,
        )
        stmt = stmt.on_conflict_do_update(
            constraint="uq_lesson_record",
            set_={
                "status": stmt.excluded.status,
                "score": stmt.excluded.score,
                "max_score": stmt.excluded.max_score,
                "accuracy_rate": stmt.excluded.accuracy_rate,
                "notes": stmt.excluded.notes,
                "updated_at": func.now(),
            },
        )
        await db.execute(stmt)

        # 2. Load StudentMaterial and Material with nodes
        sm_result = await db.execute(
            select(StudentMaterial)
            .where(
                StudentMaterial.student_id == rec.student_id,
                StudentMaterial.material_key == rec.material_key,
            )
            .options(
                selectinload(StudentMaterial.material)
                .selectinload(Material.nodes)
            )
        )
        sm = sm_result.scalars().first()
        if not sm or not sm.material:
            continue

        old_pointer = sm.pointer
        nodes_sorted = sorted(sm.material.nodes, key=lambda n: n.sort_order)
        total_nodes = len(nodes_sorted)
        effective_total = sm.max_node if sm.max_node else total_nodes
        did_advance = False

        # 2b. Update low_score_streak counter
        if accuracy_rate is not None:
            if accuracy_rate < 0.6:
                sm.low_score_streak = (sm.low_score_streak or 0) + 1
            else:
                sm.low_score_streak = 0
            sm.last_accuracy = accuracy_rate

        # 3. Advance pointer if completed
        if rec.status == "completed" and old_pointer <= effective_total:
            sm.pointer = old_pointer + 1
            did_advance = True
            advanced_count += 1

            # Log progress history
            db.add(ProgressHistory(
                student_id=rec.student_id,
                material_key=rec.material_key,
                node_key=rec.node_key,
                action="advance",
                old_pointer=old_pointer,
                new_pointer=sm.pointer,
                metadata_={"source": "mastery_input", "score": rec.score, "max_score": rec.max_score, "accuracy_rate": accuracy_rate},
            ))
        else:
            retried_count += 1

        # 4. Check if material is completed (pointer exceeded total)
        is_completed = False
        if did_advance and sm.pointer > effective_total:
            is_completed = True
            completed_count += 1
            # Archive progress before removing assignment
            db.add(ArchivedProgress(
                student_id=rec.student_id,
                material_key=rec.material_key,
                pointer=effective_total,
            ))
            db.add(ProgressHistory(
                student_id=rec.student_id,
                material_key=rec.material_key,
                action="complete",
                old_pointer=effective_total,
                metadata_={"auto_unassign": True, "total_nodes": total_nodes, "max_node": sm.max_node},
            ))
            await db.execute(
                delete(StudentMaterial).where(
                    StudentMaterial.student_id == rec.student_id,
                    StudentMaterial.material_key == rec.material_key,
                )
            )

        # 5. Queue next node for printing (only if not completed)
        new_pointer = sm.pointer
        queued_node_key = None
        queued_node_title = None

        if not is_completed and new_pointer <= effective_total:
            # Find the node at current pointer
            next_node = next(
                (n for n in nodes_sorted if n.sort_order == new_pointer), None
            )
            if next_node:
                # For word test materials, use per-student PDF paths (question + answer)
                gen_q_pdf = None
                gen_a_pdf = None
                if rec.material_key.startswith("単語:"):
                    book_name = rec.material_key.removeprefix("単語:")
                    gen_q_pdf = f"単語/{book_name}/{rec.student_id}/{next_node.sort_order:03d}_q.pdf"
                    gen_a_pdf = f"単語/{book_name}/{rec.student_id}/{next_node.sort_order:03d}_a.pdf"

                # Question entry
                queue_entry = PrintQueue(
                    student_id=rec.student_id,
                    student_name=None,
                    material_key=rec.material_key,
                    material_name=sm.material.name,
                    node_key=next_node.key,
                    node_name=next_node.title,
                    sort_order=sort_order,
                    status="pending",
                    generated_pdf=gen_q_pdf,
                    pdf_type="question",
                )
                db.add(queue_entry)
                sort_order += 1
                queued_count += 1

                # Answer entry (for word tests or nodes with answer PDF)
                has_answer = bool(gen_a_pdf) or bool(next_node.answer_pdf_relpath)
                if has_answer:
                    answer_entry = PrintQueue(
                        student_id=rec.student_id,
                        student_name=None,
                        material_key=rec.material_key,
                        material_name=sm.material.name,
                        node_key=next_node.key,
                        node_name=next_node.title,
                        sort_order=sort_order,
                        status="pending",
                        generated_pdf=gen_a_pdf,
                        pdf_type="answer",
                    )
                    db.add(answer_entry)
                    sort_order += 1
                    queued_count += 1

                queued_node_key = next_node.key
                queued_node_title = next_node.title

        results.append(MasteryResultItem(
            student_id=rec.student_id,
            material_key=rec.material_key,
            node_key=rec.node_key,
            status=rec.status,
            advanced=did_advance,
            completed=is_completed,
            new_pointer=new_pointer,
            queued_node_key=queued_node_key,
            queued_node_title=queued_node_title,
        ))

    await db.commit()
    return MasteryBatchResponse(
        processed=len(results),
        advanced=advanced_count,
        retried=retried_count,
        queued=queued_count,
        completed=completed_count,
        results=results,
    )
