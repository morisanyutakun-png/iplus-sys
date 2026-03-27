from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.student import Student
from app.models.student_material import StudentMaterial, ProgressHistory, ArchivedProgress
from app.models.material import Material, MaterialNode
from app.models.print_queue import PrintQueue
from app.models.word_test import WordBook, Word
from app.schemas.student import StudentOut, StudentCreate, StudentUpdate, StudentListOut, StudentMaterialInfo
from app.services.pdf_store import pdf_exists, resolve_pdf_for_reading
from app.services.word_test_material import generate_student_pdfs

router = APIRouter()


def _build_student_out(student: Student) -> StudentOut:
    material_infos = []
    for sm in student.materials:
        mat = sm.material
        total = len(mat.nodes) if mat else 0
        effective = sm.max_node if sm.max_node else total
        pct = ((sm.pointer - 1) / effective * 100) if effective > 0 else 0
        next_title = None
        if mat and sm.pointer <= total:
            for n in mat.nodes:
                if n.sort_order == sm.pointer:
                    next_title = n.title
                    break
        material_infos.append(
            StudentMaterialInfo(
                material_key=sm.material_key,
                material_name=mat.name if mat else sm.material_key,
                pointer=sm.pointer,
                total_nodes=total,
                percent=round(pct, 1),
                next_node_title=next_title,
            )
        )
    return StudentOut(
        id=student.id,
        name=student.name,
        created_at=student.created_at,
        materials=material_infos,
    )


@router.get("", response_model=StudentListOut)
async def list_students(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Student).options(
            selectinload(Student.materials).selectinload(StudentMaterial.material).selectinload(Material.nodes)
        )
    )
    students = result.scalars().unique().all()
    return StudentListOut(students=[_build_student_out(s) for s in students])


@router.get("/{student_id}", response_model=StudentOut)
async def get_student(student_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Student)
        .where(Student.id == student_id)
        .options(
            selectinload(Student.materials).selectinload(StudentMaterial.material).selectinload(Material.nodes)
        )
    )
    student = result.scalars().first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return _build_student_out(student)


@router.post("", response_model=StudentOut)
async def create_student(body: StudentCreate, db: AsyncSession = Depends(get_db)):
    student = Student(id=body.id, name=body.name)
    db.add(student)
    await db.commit()
    await db.refresh(student)
    return StudentOut(id=student.id, name=student.name, created_at=student.created_at, materials=[])


@router.patch("/{student_id}", response_model=StudentOut)
async def update_student(student_id: str, body: StudentUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Student)
        .where(Student.id == student_id)
        .options(
            selectinload(Student.materials).selectinload(StudentMaterial.material).selectinload(Material.nodes)
        )
    )
    student = result.scalars().first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    student.name = body.name.strip()
    await db.commit()
    await db.refresh(student)
    return _build_student_out(student)


@router.delete("/{student_id}")
async def delete_student(student_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Student).where(Student.id == student_id)
    )
    student = result.scalars().first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Delete related student materials first
    await db.execute(
        delete(StudentMaterial).where(StudentMaterial.student_id == student_id)
    )
    await db.execute(delete(Student).where(Student.id == student_id))
    await db.commit()
    return {"status": "deleted"}


@router.get("/{student_id}/materials-zones")
async def get_materials_zones(student_id: str, db: AsyncSession = Depends(get_db)):
    # Get all materials
    result = await db.execute(select(Material).options(selectinload(Material.nodes)))
    all_materials = result.scalars().unique().all()

    # Get student's assigned materials (with max_node)
    result = await db.execute(
        select(StudentMaterial).where(StudentMaterial.student_id == student_id)
    )
    assigned_map = {sm.material_key: sm for sm in result.scalars().all()}

    # Get word book info for word test materials
    wb_result = await db.execute(select(WordBook))
    word_books = {wb.material_key: wb for wb in wb_result.scalars().all() if wb.material_key}

    assigned_list = []
    source_list = []
    for mat in all_materials:
        total = len(mat.nodes)
        info: dict = {
            "key": mat.key,
            "name": mat.name,
            "total_nodes": total,
        }
        if mat.key in assigned_map:
            sm = assigned_map[mat.key]
            effective = sm.max_node if sm.max_node else total
            info["pointer"] = sm.pointer
            info["max_node"] = sm.max_node
            info["percent"] = round((sm.pointer - 1) / effective * 100, 1) if effective > 0 else 0
            assigned_list.append(info)
        else:
            # Add word book info for assignment dialog
            wb = word_books.get(mat.key)
            if wb:
                info["word_book_id"] = wb.id
                info["total_words"] = wb.total_words
            source_list.append(info)

    return {"assigned": assigned_list, "source": source_list}


@router.post("/{student_id}/materials")
async def toggle_material(
    student_id: str, body: dict, db: AsyncSession = Depends(get_db)
):
    material_key = body.get("material_key")
    action = body.get("action", "toggle")

    result = await db.execute(
        select(StudentMaterial).where(
            StudentMaterial.student_id == student_id,
            StudentMaterial.material_key == material_key,
        )
    )
    existing = result.scalars().first()

    if action == "remove" or (action == "toggle" and existing):
        if existing:
            # Archive before removing
            archive = ArchivedProgress(
                student_id=student_id,
                material_key=material_key,
                pointer=existing.pointer,
            )
            history = ProgressHistory(
                student_id=student_id,
                material_key=material_key,
                action="remove",
                old_pointer=existing.pointer,
            )
            db.add(archive)
            db.add(history)
            await db.execute(
                delete(StudentMaterial).where(
                    StudentMaterial.student_id == student_id,
                    StudentMaterial.material_key == material_key,
                )
            )
            await db.commit()
            return {"status": "removed"}
    else:
        if not existing:
            sm = StudentMaterial(
                student_id=student_id, material_key=material_key, pointer=1
            )
            history = ProgressHistory(
                student_id=student_id,
                material_key=material_key,
                action="assign",
                new_pointer=1,
            )
            db.add(sm)
            db.add(history)

            # Word test material: generate per-student PDFs + queue first node
            if material_key.startswith("単語:"):
                student = await db.get(Student, student_id)
                pdf_list = await generate_student_pdfs(
                    db, student_id, student.name if student else student_id, material_key
                )
                # Queue first node for printing
                mat = await db.execute(
                    select(Material).where(Material.key == material_key)
                )
                material = mat.scalars().first()
                if material and material.nodes:
                    first_node = sorted(material.nodes, key=lambda n: n.sort_order)[0]
                    first_pdf = next(
                        (p for k, p in pdf_list if k == first_node.key), ""
                    )
                    db.add(PrintQueue(
                        student_id=student_id,
                        student_name=student.name if student else None,
                        material_key=material_key,
                        material_name=material.name,
                        node_key=first_node.key,
                        node_name=first_node.title,
                        generated_pdf=first_pdf,
                        sort_order=0,
                        status="pending",
                    ))

            await db.commit()
            return {"status": "assigned"}

    return {"status": "no_change"}


@router.put("/{student_id}/pointers")
async def save_pointers(
    student_id: str, body: dict, db: AsyncSession = Depends(get_db)
):
    pointers: dict = body.get("pointers", {})
    for material_key, new_pointer in pointers.items():
        result = await db.execute(
            select(StudentMaterial).where(
                StudentMaterial.student_id == student_id,
                StudentMaterial.material_key == material_key,
            )
        )
        sm = result.scalars().first()
        if sm and sm.pointer != new_pointer:
            history = ProgressHistory(
                student_id=student_id,
                material_key=material_key,
                action="manual_set",
                old_pointer=sm.pointer,
                new_pointer=new_pointer,
            )
            db.add(history)
            sm.pointer = new_pointer

    await db.commit()
    return {"status": "ok"}


@router.post("/{student_id}/assign-word-test")
async def assign_word_test(
    student_id: str, body: dict, db: AsyncSession = Depends(get_db)
):
    """Assign a word test material with range specification and per-student PDF generation."""
    word_book_id = body.get("word_book_id")
    start_num = body.get("start_num", 1)
    end_num = body.get("end_num")
    words_per_test = body.get("words_per_test", 100)
    questions_per_test = body.get("questions_per_test", 50)

    # Validate student
    student = await db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="生徒が見つかりません")

    # Get WordBook
    book_result = await db.execute(select(WordBook).where(WordBook.id == word_book_id))
    book = book_result.scalars().first()
    if not book or not book.material_key:
        raise HTTPException(status_code=404, detail="単語帳または教材が見つかりません")

    material_key = book.material_key
    if end_num is None:
        end_num = book.total_words

    # Check if already assigned
    existing = await db.execute(
        select(StudentMaterial).where(
            StudentMaterial.student_id == student_id,
            StudentMaterial.material_key == material_key,
        )
    )
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail="既にこの教材が割り当てられています")

    # Ensure nodes exist for the requested chunk size
    # Regenerate nodes if words_per_test differs from current node structure
    nodes_result = await db.execute(
        select(MaterialNode)
        .where(MaterialNode.material_key == material_key)
        .order_by(MaterialNode.sort_order)
    )
    existing_nodes = nodes_result.scalars().all()

    # Get all words to rebuild nodes if needed
    words_result = await db.execute(
        select(Word).where(Word.word_book_id == book.id).order_by(Word.word_number)
    )
    all_words = words_result.scalars().all()

    # Rebuild nodes with requested chunk size
    from sqlalchemy import delete as sa_delete
    await db.execute(
        sa_delete(MaterialNode).where(MaterialNode.material_key == material_key)
    )
    await db.flush()

    for i in range(0, len(all_words), words_per_test):
        chunk = all_words[i:i + words_per_test]
        chunk_num = (i // words_per_test) + 1
        first_num = chunk[0].word_number
        last_num = chunk[-1].word_number
        db.add(MaterialNode(
            key=f"単語:{book.name}:{chunk_num:03d}",
            material_key=material_key,
            title=f"{first_num}-{last_num}",
            range_text=f"No.{first_num}〜{last_num}",
            pdf_relpath="",
            duplex=True,
            sort_order=chunk_num,
        ))
    await db.flush()

    # Find nodes that cover the requested range
    refreshed = await db.execute(
        select(MaterialNode)
        .where(MaterialNode.material_key == material_key)
        .order_by(MaterialNode.sort_order)
    )
    all_nodes = refreshed.scalars().all()

    # Determine start_node and end_node sort_orders based on word range
    start_node = None
    end_node = None
    for node in all_nodes:
        from app.services.word_test_material import _parse_range
        ns, ne = _parse_range(node.range_text)
        if ns is None:
            continue
        if ne >= start_num and start_node is None:
            start_node = node.sort_order
        if ns <= end_num:
            end_node = node.sort_order

    if start_node is None or end_node is None:
        raise HTTPException(status_code=400, detail="指定範囲に該当するノードがありません")

    # Generate per-student PDFs for the range
    pdf_list = await generate_student_pdfs(
        db, student_id, student.name, material_key,
        start_node=start_node, end_node=end_node,
        questions_per_test=questions_per_test,
    )

    # Create StudentMaterial with range limits
    sm = StudentMaterial(
        student_id=student_id,
        material_key=material_key,
        pointer=start_node,
        max_node=end_node,
    )
    history = ProgressHistory(
        student_id=student_id,
        material_key=material_key,
        action="assign",
        new_pointer=start_node,
        metadata_={"start_num": start_num, "end_num": end_num, "words_per_test": words_per_test, "questions_per_test": questions_per_test},
    )
    db.add(sm)
    db.add(history)

    # Queue first node
    first_node = next((n for n in all_nodes if n.sort_order == start_node), None)
    if first_node:
        first_pdf = next((p for k, p in pdf_list if k == first_node.key), "")
        db.add(PrintQueue(
            student_id=student_id,
            student_name=student.name,
            material_key=material_key,
            material_name=f"単語テスト:{book.name}",
            node_key=first_node.key,
            node_name=first_node.title,
            generated_pdf=first_pdf,
            sort_order=0,
            status="pending",
        ))

    await db.commit()
    return {
        "status": "assigned",
        "material_key": material_key,
        "start_node": start_node,
        "end_node": end_node,
        "pdfs_generated": len(pdf_list),
    }


@router.get("/{student_id}/material-nodes/{material_key:path}")
async def get_student_material_nodes(
    student_id: str, material_key: str, db: AsyncSession = Depends(get_db)
):
    """割り当て済み教材のノード一覧（PDF有無付き）を返す"""
    # Verify assignment exists
    sm_result = await db.execute(
        select(StudentMaterial).where(
            StudentMaterial.student_id == student_id,
            StudentMaterial.material_key == material_key,
        )
    )
    sm = sm_result.scalars().first()
    if not sm:
        raise HTTPException(status_code=404, detail="この教材は割り当てられていません")

    # Get nodes (filtered by max_node if set)
    stmt = (
        select(MaterialNode)
        .where(MaterialNode.material_key == material_key)
        .order_by(MaterialNode.sort_order)
    )
    if sm.max_node:
        stmt = stmt.where(MaterialNode.sort_order <= sm.max_node)
    nodes = (await db.execute(stmt)).scalars().all()

    is_word_test = material_key.startswith("単語:")
    result = []
    for node in nodes:
        has_pdf = False
        if is_word_test:
            book_name = material_key.removeprefix("単語:")
            pdf_relpath = f"単語/{book_name}/{student_id}/{node.sort_order:03d}.pdf"
            has_pdf = await pdf_exists(db, pdf_relpath)
        elif node.pdf_relpath:
            has_pdf = await pdf_exists(db, node.pdf_relpath)

        result.append({
            "key": node.key,
            "title": node.title,
            "sort_order": node.sort_order,
            "range_text": node.range_text,
            "has_pdf": has_pdf,
            "is_current": node.sort_order == sm.pointer,
            "is_completed": node.sort_order < sm.pointer,
        })

    return {
        "student_id": student_id,
        "material_key": material_key,
        "pointer": sm.pointer,
        "max_node": sm.max_node,
        "nodes": result,
    }


@router.get("/{student_id}/preview-pdf/{material_key:path}")
async def preview_student_pdf(
    student_id: str, material_key: str,
    node_sort_order: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """生徒の割り当てPDFをプレビュー用に返す"""
    # Look up the node
    stmt = select(MaterialNode).where(
        MaterialNode.material_key == material_key,
        MaterialNode.sort_order == node_sort_order,
    )
    node = (await db.execute(stmt)).scalars().first()
    if not node:
        raise HTTPException(status_code=404, detail="ノードが見つかりません")

    # Resolve PDF path
    resolved = None
    if material_key.startswith("単語:"):
        book_name = material_key.removeprefix("単語:")
        pdf_relpath = f"単語/{book_name}/{student_id}/{node.sort_order:03d}.pdf"
        resolved = await resolve_pdf_for_reading(db, pdf_relpath)
    elif node.pdf_relpath:
        resolved = await resolve_pdf_for_reading(db, node.pdf_relpath)

    if not resolved:
        raise HTTPException(status_code=404, detail="PDFファイルが見つかりません")

    return FileResponse(resolved, media_type="application/pdf")
