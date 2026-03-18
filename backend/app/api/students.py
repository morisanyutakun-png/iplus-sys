from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.student import Student
from app.models.student_material import StudentMaterial, ProgressHistory, ArchivedProgress
from app.models.material import Material
from app.schemas.student import StudentOut, StudentCreate, StudentUpdate, StudentListOut, StudentMaterialInfo

router = APIRouter()


def _build_student_out(student: Student) -> StudentOut:
    material_infos = []
    for sm in student.materials:
        mat = sm.material
        total = len(mat.nodes) if mat else 0
        pct = ((sm.pointer - 1) / total * 100) if total > 0 else 0
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

    # Get student's assigned materials
    result = await db.execute(
        select(StudentMaterial).where(StudentMaterial.student_id == student_id)
    )
    assigned = {sm.material_key: sm.pointer for sm in result.scalars().all()}

    assigned_list = []
    source_list = []
    for mat in all_materials:
        total = len(mat.nodes)
        info = {
            "key": mat.key,
            "name": mat.name,
            "total_nodes": total,
        }
        if mat.key in assigned:
            info["pointer"] = assigned[mat.key]
            info["percent"] = round((assigned[mat.key] - 1) / total * 100, 1) if total > 0 else 0
            assigned_list.append(info)
        else:
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
