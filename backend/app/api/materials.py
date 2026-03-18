import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.models.material import Material, MaterialNode
from app.schemas.material import MaterialOut, MaterialListOut, MaterialCreate, MaterialCreateSimple, MaterialNodeCreate, MaterialNodeOut

router = APIRouter()


@router.get("", response_model=MaterialListOut)
async def list_materials(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Material).options(selectinload(Material.nodes)).order_by(Material.sort_order)
    )
    materials = result.scalars().unique().all()
    return MaterialListOut(materials=[MaterialOut.model_validate(m) for m in materials])


@router.post("", response_model=MaterialOut)
async def create_material(body: MaterialCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Material).where(Material.key == body.key))
    if result.scalars().first():
        raise HTTPException(status_code=409, detail="Material already exists")

    max_result = await db.execute(
        select(sa_func.coalesce(sa_func.max(Material.sort_order), 0))
    )
    max_order = max_result.scalar()

    material = Material(
        key=body.key,
        name=body.name,
        start_on=body.start_on,
        aliases=body.aliases,
        sort_order=max_order + 1,
    )
    db.add(material)
    await db.commit()
    await db.refresh(material)
    return MaterialOut.model_validate(material)


@router.post("/simple", response_model=MaterialOut)
async def create_material_simple(body: MaterialCreateSimple, db: AsyncSession = Depends(get_db)):
    """Simplified material creation: name only. Key is auto-generated from name."""
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="名前を入力してください")

    key = name

    result = await db.execute(select(Material).where(Material.key == key))
    if result.scalars().first():
        raise HTTPException(status_code=409, detail="同じ名前の教材が既に存在します")

    max_result = await db.execute(
        select(sa_func.coalesce(sa_func.max(Material.sort_order), 0))
    )
    max_order = max_result.scalar()

    material = Material(
        key=key,
        name=name,
        aliases=[],
        sort_order=max_order + 1,
    )
    db.add(material)
    await db.commit()
    await db.refresh(material)
    return MaterialOut.model_validate(material)


@router.get("/{material_key}", response_model=MaterialOut)
async def get_material(material_key: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Material)
        .where(Material.key == material_key)
        .options(selectinload(Material.nodes))
    )
    material = result.scalars().first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    return MaterialOut.model_validate(material)


@router.post("/{material_key}/nodes", response_model=MaterialNodeOut)
async def add_node(
    material_key: str, body: MaterialNodeCreate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Material).where(Material.key == material_key)
    )
    material = result.scalars().first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    # Get max sort_order for this material
    result = await db.execute(
        select(sa_func.coalesce(sa_func.max(MaterialNode.sort_order), 0)).where(
            MaterialNode.material_key == material_key
        )
    )
    max_order = result.scalar()

    node = MaterialNode(
        key=body.key,
        material_key=material_key,
        title=body.title,
        range_text=body.range_text,
        pdf_relpath=body.pdf_relpath,
        duplex=body.duplex,
        sort_order=max_order + 1,
    )
    db.add(node)
    await db.commit()
    await db.refresh(node)
    return MaterialNodeOut.model_validate(node)


@router.post("/{material_key}/nodes/simple", response_model=MaterialNodeOut)
async def add_node_simple(
    material_key: str,
    title: str = Form(...),
    file: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
):
    """Simplified node creation: title + optional PDF upload only.
    Auto-generates node key and handles PDF storage."""
    result = await db.execute(
        select(Material).where(Material.key == material_key)
    )
    material = result.scalars().first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    # Get next sort_order
    result = await db.execute(
        select(sa_func.coalesce(sa_func.max(MaterialNode.sort_order), 0)).where(
            MaterialNode.material_key == material_key
        )
    )
    max_order = result.scalar()
    next_order = max_order + 1

    # Auto-generate node key
    node_key = f"{material_key}:{next_order:03d}"

    # Handle PDF upload
    pdf_relpath = ""
    if file and file.filename and file.filename.lower().endswith(".pdf"):
        # Build subfolder from material key (replace : with /)
        subfolder = material_key.replace(":", "/")
        storage_root = Path(settings.pdf_storage_dir)
        target_dir = storage_root / subfolder
        target_dir.mkdir(parents=True, exist_ok=True)

        target_file = target_dir / file.filename
        with open(target_file, "wb") as f:
            shutil.copyfileobj(file.file, f)
        pdf_relpath = str(target_file.relative_to(storage_root))

    node = MaterialNode(
        key=node_key,
        material_key=material_key,
        title=title.strip(),
        range_text=title.strip(),
        pdf_relpath=pdf_relpath,
        duplex=False,
        sort_order=next_order,
    )
    db.add(node)
    await db.commit()
    await db.refresh(node)
    return MaterialNodeOut.model_validate(node)
