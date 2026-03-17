import csv
import io
import os
import random
import re
import shutil
import subprocess
import tempfile

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse

router = APIRouter()


def _escape_tex(s: str) -> str:
    return str(s).replace("\\", "\\\\").replace("&", "\\&").replace("%", "\\%").replace("_", "\\_")


def _detect_cjk_font() -> str | None:
    candidates = [
        "Hiragino Mincho ProN", "Hiragino Kaku Gothic ProN",
        "Noto Serif CJK JP", "Noto Sans CJK JP",
        "IPAMincho", "IPAPMincho", "IPAexMincho", "TakaoPGothic",
    ]
    installed = ""
    try:
        fc = subprocess.run(
            ["fc-list", ":", "family"],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=2,
        )
        installed = fc.stdout.decode("utf-8", errors="ignore")
    except Exception:
        pass

    env_font = os.environ.get("IPLUS_CJK_FONT")
    if env_font and env_font in installed:
        return env_font

    for cand in candidates:
        if cand in installed:
            return cand
    return None


def _build_tex(
    rows: list[list[str]],
    material_name: str = "",
    node_name: str = "",
    student_name: str = "",
) -> str:
    esc = _escape_tex
    engine = "xelatex" if shutil.which("xelatex") else "pdflatex"

    tex = []
    tex.append("\\documentclass[11pt]{article}")
    tex.append("\\usepackage{ifxetex}")
    tex.append("\\ifxetex")
    tex.append("  \\usepackage{fontspec}")
    tex.append("  \\usepackage{xeCJK}")
    tex.append("\\else")
    tex.append("  \\usepackage[utf8]{inputenc}")
    tex.append("  \\usepackage[T1]{fontenc}")
    tex.append("\\fi")
    tex.append("\\usepackage{geometry}")
    tex.append("\\geometry{a4paper,left=6mm,right=6mm,top=2mm,bottom=2mm}")
    tex.append("\\usepackage{etoolbox}")
    tex.append("\\usepackage{array}")
    tex.append("\\usepackage{parskip}")
    tex.append("\\usepackage{tikz}")
    tex.append("\\usetikzlibrary{calc}")
    tex.append("\\usepackage[table]{xcolor}")
    tex.append("\\setlength{\\tabcolsep}{4pt}")
    tex.append("\\renewcommand{\\arraystretch}{0.88}")
    tex.append("\\setlength{\\parskip}{0pt}")
    tex.append("\\AtBeginEnvironment{tabular}{\\linespread{0.92}\\selectfont}")

    if engine == "xelatex":
        font = _detect_cjk_font()
        if font:
            tex.append(f"\\setCJKmainfont[Scale=0.96]{{{font}}}")

    tex.append("\\begin{document}")
    tex.append("\\pagestyle{empty}")
    tex.append("\\thispagestyle{empty}")

    # Define macros
    tex.append(f"\\newcommand{{\\MaterialName}}{{{esc(material_name)}}}")
    tex.append(f"\\newcommand{{\\NodeName}}{{{esc(node_name)}}}")
    tex.append(f"\\newcommand{{\\StudentName}}{{{esc(student_name)}}}")

    tex.append("\\enlargethispage{32mm}")
    tex.append("\\vspace*{-12pt}")
    tex.append("\\begingroup\\raggedbottom\\setlength{\\parskip}{0pt}")

    number_width = "0.025\\linewidth"
    problem_width = "0.235\\linewidth"
    answer_width = "0.235\\linewidth"
    cell_height = "8.2pt"
    arraystretch = "0.52"

    # Flatten rows to [num, question, answer]
    flat = []
    for row in rows:
        if len(row) >= 6:
            flat.append([row[0], row[1], row[2]])
            flat.append([row[3], row[4], row[5]])
        elif len(row) >= 3:
            flat.append([row[0], row[1], row[2]])

    per_page = 100
    pages = max(1, (len(flat) + per_page - 1) // per_page)

    for pagenum in range(pages):
        chunk = flat[pagenum * per_page:(pagenum + 1) * per_page]
        while len(chunk) < per_page:
            chunk.append(["", "", ""])

        tex.append("\\begin{center}")
        tex.append("\\setlength{\\tabcolsep}{0pt}")
        tex.append("\\setlength{\\arrayrulewidth}{0.4pt}")
        tex.append("\\setlength{\\doublerulesep}{1pt}")
        tex.append("\\setlength{\\extrarowheight}{0pt}")
        tex.append(f"\\renewcommand{{\\arraystretch}}{{{arraystretch}}}")

        colspec = (
            f"|p{{{number_width}}}|p{{{problem_width}}}|p{{{answer_width}}}||"
            f"p{{{number_width}}}|p{{{problem_width}}}|p{{{answer_width}}}|"
        )
        tex.append(f"\\begin{{tabular}}{{{colspec}}}")

        # Header: material+node left, student right
        tex.append(
            "\\multicolumn{3}{l}{\\scriptsize\\textbf{\\MaterialName\\ \\NodeName}} "
            "& \\multicolumn{3}{r}{\\scriptsize\\StudentName} \\\\"
        )
        tex.append("\\hline")
        tex.append("\\rowcolor{gray!15}")
        tex.append(
            "\\scriptsize 番号 & \\scriptsize 単語 & \\scriptsize 意味 "
            "& \\scriptsize 番号 & \\scriptsize 単語 & \\scriptsize 意味 \\\\"
        )
        tex.append("\\hline")

        for row_idx in range(50):
            left = chunk[row_idx]
            right = chunk[row_idx + 50]

            def cell(r, idx):
                return esc(r[idx]) if len(r) > idx else ""

            ln, lq, la = cell(left, 0), cell(left, 1), cell(left, 2)
            rn, rq, ra = cell(right, 0), cell(right, 1), cell(right, 2)

            tex.append(
                f"\\scriptsize {ln} & "
                f"\\parbox[t][{cell_height}]{{\\linewidth}}{{\\scriptsize \\textbf{{{lq}}}}} & "
                f"\\parbox[t][{cell_height}]{{\\linewidth}}{{\\footnotesize {la}}} & "
                f"\\scriptsize {rn} & "
                f"\\parbox[t][{cell_height}]{{\\linewidth}}{{\\scriptsize \\textbf{{{rq}}}}} & "
                f"\\parbox[t][{cell_height}]{{\\linewidth}}{{\\footnotesize {ra}}} \\\\"
            )
            tex.append("\\hline")

        tex.append("\\end{tabular}")
        tex.append("\\end{center}")
        if pagenum < pages - 1:
            tex.append("\\newpage")

    tex.append("\\endgroup")
    tex.append("\\end{document}")
    return "\n".join(tex)


@router.post("/generate")
async def generate_pdf(
    file: UploadFile = File(...),
    start: int = Form(1),
    end: int = Form(0),
    shuffle: bool = Form(False),
    shuffle_seed: int | None = Form(None),
    student_name: str = Form(""),
    material_name: str = Form(""),
    node_name: str = Form(""),
):
    """Generate a vocabulary test PDF from a CSV file."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "CSVファイルを指定してください")

    # Read CSV
    content = await file.read()
    text = content.decode("utf-8", errors="ignore")
    reader = csv.reader(io.StringIO(text))
    all_rows = list(reader)

    if not all_rows:
        raise HTTPException(400, "CSVが空です")

    header = all_rows[0]
    data_rows = all_rows[1:]

    # Drop section column if present
    hdr0 = str(header[0]).lower() if header else ""
    drop_left = "section" in hdr0 or "セクション" in hdr0
    if drop_left:
        header = header[1:]
        data_rows = [r[1:] for r in data_rows]

    # Normalize rows
    processed = []
    for row in data_rows:
        r = [str(x).strip() for x in row]
        if len(r) >= 6:
            processed.append(r[:6])
        elif len(r) >= 3:
            processed.append(r[:3])

    # Flatten to [num, question, answer]
    flat = []
    for row in processed:
        if len(row) >= 6:
            flat.append([row[0], row[1], row[2]])
            flat.append([row[3], row[4], row[5]])
        else:
            flat.append([row[0], row[1], row[2]])

    # Apply range filter
    if end == 0:
        end = len(flat)
    if end < start or start < 1:
        raise HTTPException(400, "無効な範囲です")

    # Select by number
    sel = []
    for r in flat:
        m = re.search(r"(\d+)", str(r[0]))
        if m:
            n = int(m.group(1))
            if start <= n <= end:
                sel.append(r)

    expected = end - start + 1
    if len(sel) < expected:
        sel = flat[start - 1:end]

    # Vocab: dedupe + random pick up to 100
    hdr_text = " ".join(str(x) for x in header).lower()
    is_vocab = any(kw in hdr_text for kw in ["英単", "単語", "word"]) or (
        file.filename and "target" in file.filename.lower()
    )

    if is_vocab:
        seen: dict[str, list] = {}
        for r in sel:
            key = str(r[1]).strip().lower() if len(r) > 1 else str(r)
            if key and key not in seen:
                seen[key] = r
        unique = list(seen.values())
        max_pick = min(100, len(unique))
        if shuffle_seed is not None:
            random.seed(shuffle_seed)
        if max_pick > 0:
            if len(unique) <= max_pick:
                sel = unique[:]
                random.shuffle(sel)
            else:
                sel = random.sample(unique, max_pick)

    if shuffle:
        if shuffle_seed is not None:
            random.seed(shuffle_seed)
        random.shuffle(sel)

    if not sel:
        raise HTTPException(400, "指定範囲にデータがありません")

    # Build TeX and compile
    tex_src = _build_tex(sel, material_name, node_name, student_name)
    engine = "xelatex" if shutil.which("xelatex") else "pdflatex"

    tmpd = tempfile.mkdtemp(prefix="iplus_pdf_")
    try:
        tex_path = os.path.join(tmpd, "out.tex")
        with open(tex_path, "w", encoding="utf-8") as f:
            f.write(tex_src)

        cmd = [engine, "-interaction=nonstopmode", "-halt-on-error", "out.tex"]
        proc = subprocess.run(cmd, cwd=tmpd, capture_output=True, timeout=30)
        if proc.returncode != 0:
            log = proc.stdout.decode(errors="ignore") + "\n" + proc.stderr.decode(errors="ignore")
            raise HTTPException(500, f"LaTeXコンパイルエラー:\n{log[-2000:]}")

        pdf_path = os.path.join(tmpd, "out.pdf")
        if not os.path.exists(pdf_path):
            raise HTTPException(500, "PDFが生成されませんでした")

        download_name = f"{material_name or 'output'}_{node_name or 'test'}.pdf"
        return FileResponse(
            pdf_path,
            media_type="application/pdf",
            filename=download_name,
            # Don't delete tmpd - it'll be cleaned up by the OS temp cleaner
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"PDF生成エラー: {str(e)}")
