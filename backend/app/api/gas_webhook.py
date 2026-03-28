from fastapi import APIRouter, Depends, Request
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.print_queue import PrintQueue
from app.models.student import Student
from app.models.material import Material, MaterialNode
from app.models.student_material import StudentMaterial, ProgressHistory

router = APIRouter()


def _find_material_by_title(materials: list, title: str) -> tuple[str, str]:
    """Heuristic matching of work title to material/node."""
    title_lower = title.lower().strip()
    for mat in materials:
        # Check aliases
        for alias in (mat.aliases or []):
            if isinstance(alias, str) and alias.lower() in title_lower:
                return mat.key, mat.name
        if mat.name.lower() in title_lower or mat.key.lower() in title_lower:
            return mat.key, mat.name
    return "", ""


def _find_node_by_range(nodes: list[MaterialNode], range_text: str) -> MaterialNode | None:
    """Find a node by range text or alias matching."""
    if not range_text:
        return None
    range_lower = range_text.lower().strip()
    for node in nodes:
        if node.range_text and node.range_text.lower().strip() == range_lower:
            return node
        for alias in (node.aliases or []):
            if isinstance(alias, str) and alias.lower() in range_lower:
                return node
    return None


def _get_node_at_pointer(nodes: list[MaterialNode], pointer: int) -> MaterialNode | None:
    """Get the node at the given pointer (sort_order)."""
    for node in nodes:
        if node.sort_order == pointer:
            return node
    return None


@router.post("/webhook")
async def gas_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Receive webhook payload from Google Apps Script.

    Supports two modes:
    1. Legacy: just 'works' list → queue items (existing behavior)
    2. Enhanced: 'results' with pass/fail → auto advance pointer + queue next PDF
    """
    payload = await request.json()

    student_id = payload.get("seitoID", "")
    works = payload.get("works", [])
    results = payload.get("results", [])
    print_r = payload.get("printR", False)
    print_w = payload.get("printW", False)
    status = payload.get("status", "")
    today = payload.get("today", {})
    due = payload.get("due", {})

    # Resolve student name
    result = await db.execute(select(Student.name).where(Student.id == student_id))
    row = result.first()
    student_name = row[0] if row else ""

    # Get all materials with nodes for matching
    result = await db.execute(
        select(Material).options(selectinload(Material.nodes))
    )
    all_materials = result.scalars().unique().all()

    # Get max sort_order for queue
    result = await db.execute(
        select(sa_func.coalesce(sa_func.max(PrintQueue.sort_order), -1))
    )
    max_order = result.scalar()

    added = 0
    advanced = 0
    retried = 0

    # --- Enhanced mode: process results with pass/fail ---
    if results:
        for res_item in results:
            subject = res_item.get("subject", "")
            range_text = res_item.get("range", "")
            passed = res_item.get("pass", None)

            if passed is None:
                # 未実施 — skip
                continue

            mat_key, mat_name = _find_material_by_title(all_materials, subject)
            if not mat_key:
                continue

            # Find the material object
            mat_obj = next((m for m in all_materials if m.key == mat_key), None)
            if not mat_obj:
                continue

            # Get student's current pointer for this material
            sm_result = await db.execute(
                select(StudentMaterial).where(
                    StudentMaterial.student_id == student_id,
                    StudentMaterial.material_key == mat_key,
                )
            )
            sm = sm_result.scalars().first()

            if passed:
                # --- PASS: advance pointer, queue next node ---
                if sm:
                    old_pointer = sm.pointer
                    new_pointer = old_pointer + 1
                    sm.pointer = new_pointer

                    history = ProgressHistory(
                        student_id=student_id,
                        material_key=mat_key,
                        node_key=_get_node_at_pointer(mat_obj.nodes, old_pointer).key if _get_node_at_pointer(mat_obj.nodes, old_pointer) else None,
                        action="gas_advance",
                        old_pointer=old_pointer,
                        new_pointer=new_pointer,
                    )
                    db.add(history)
                    advanced += 1

                    # Queue the next node's PDF (question + answer)
                    next_node = _get_node_at_pointer(mat_obj.nodes, new_pointer)
                    if next_node and (next_node.pdf_relpath or next_node.answer_pdf_relpath):
                        max_order += 1
                        item = PrintQueue(
                            student_id=student_id,
                            student_name=student_name,
                            material_key=mat_key,
                            material_name=mat_name,
                            node_key=next_node.key,
                            node_name=next_node.title,
                            sort_order=max_order,
                            gas_status=status,
                            gas_today=today if today else None,
                            gas_due=due if due else None,
                            print_r=print_r,
                            print_w=print_w,
                            work_title=subject,
                            work_detail=range_text,
                            pdf_type="question",
                        )
                        db.add(item)
                        added += 1
                        if next_node.answer_pdf_relpath:
                            max_order += 1
                            answer_item = PrintQueue(
                                student_id=student_id,
                                student_name=student_name,
                                material_key=mat_key,
                                material_name=mat_name,
                                node_key=next_node.key,
                                node_name=next_node.title,
                                sort_order=max_order,
                                gas_status=status,
                                gas_today=today if today else None,
                                gas_due=due if due else None,
                                print_r=print_r,
                                print_w=print_w,
                                work_title=subject,
                                work_detail=range_text,
                                pdf_type="answer",
                            )
                            db.add(answer_item)
                            added += 1
            else:
                # --- FAIL: re-queue current node ---
                current_node = None
                if sm:
                    current_node = _get_node_at_pointer(mat_obj.nodes, sm.pointer)
                if not current_node:
                    # Try to find by range text
                    current_node = _find_node_by_range(mat_obj.nodes, range_text)

                history = ProgressHistory(
                    student_id=student_id,
                    material_key=mat_key,
                    node_key=current_node.key if current_node else None,
                    action="gas_retry",
                    old_pointer=sm.pointer if sm else None,
                    new_pointer=sm.pointer if sm else None,
                )
                db.add(history)
                retried += 1

                if current_node and (current_node.pdf_relpath or current_node.answer_pdf_relpath):
                    max_order += 1
                    item = PrintQueue(
                        student_id=student_id,
                        student_name=student_name,
                        material_key=mat_key,
                        material_name=mat_name,
                        node_key=current_node.key,
                        node_name=current_node.title,
                        sort_order=max_order,
                        gas_status=status,
                        gas_today=today if today else None,
                        gas_due=due if due else None,
                        print_r=print_r,
                        print_w=print_w,
                        work_title=subject,
                        work_detail=range_text,
                        pdf_type="question",
                    )
                    db.add(item)
                    added += 1
                    if current_node.answer_pdf_relpath:
                        max_order += 1
                        answer_item = PrintQueue(
                            student_id=student_id,
                            student_name=student_name,
                            material_key=mat_key,
                            material_name=mat_name,
                            node_key=current_node.key,
                            node_name=current_node.title,
                            sort_order=max_order,
                            gas_status=status,
                            gas_today=today if today else None,
                            gas_due=due if due else None,
                            print_r=print_r,
                            print_w=print_w,
                            work_title=subject,
                            work_detail=range_text,
                            pdf_type="answer",
                        )
                        db.add(answer_item)
                        added += 1

    # --- Legacy mode: process works list (unchanged) ---
    if works and not results:
        for work in works:
            title = work if isinstance(work, str) else work.get("title", "")
            detail = "" if isinstance(work, str) else work.get("detail", "")

            mat_key, mat_name = _find_material_by_title(all_materials, title)

            max_order += 1
            item = PrintQueue(
                student_id=student_id,
                student_name=student_name,
                material_key=mat_key,
                material_name=mat_name,
                node_key="",
                node_name="",
                sort_order=max_order,
                gas_status=status,
                gas_today=today if today else None,
                gas_due=due if due else None,
                print_r=print_r,
                print_w=print_w,
                gas_results=results,
                gas_works=works,
                work_title=title,
                work_detail=detail,
            )
            db.add(item)
            added += 1

    await db.commit()
    return {
        "status": "ok",
        "added": added,
        "advanced": advanced,
        "retried": retried,
    }
