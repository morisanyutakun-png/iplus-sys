"""Generate A4 word test PDF sheets (question page + answer page).

Layout:
- With review: left = review, right = new
- Without review (first range): left = new only, right = empty
"""

import random
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas

# ── Font setup ──
_FONT_DIR = Path(__file__).resolve().parent.parent.parent / "assets" / "fonts"
_FONT_CANDIDATES = [
    _FONT_DIR / "NotoSansJP.ttf",
    Path("/Library/Fonts/Arial Unicode.ttf"),
]

_FONT_NAME = "NotoSansJP"
_font_registered = False
for _fp in _FONT_CANDIDATES:
    if _fp.exists():
        try:
            pdfmetrics.registerFont(TTFont(_FONT_NAME, str(_fp)))
            _font_registered = True
            break
        except Exception:
            continue

if not _font_registered:
    raise RuntimeError(
        f"No Japanese font found. Place NotoSansJP.ttf in {_FONT_DIR}"
    )

# ── Layout constants (A4 = 595.28 x 841.89 pt) ──
PAGE_W, PAGE_H = A4
MARGIN_L = 30
MARGIN_R = 30
MARGIN_TOP = 50
MARGIN_BOTTOM = 30
GAP_BETWEEN_GROUPS = 12

BODY_W = PAGE_W - MARGIN_L - MARGIN_R
GROUP_W = (BODY_W - GAP_BETWEEN_GROUPS) / 2

COL_NO = 28
COL_WORD = 115
COL_ANSWER = GROUP_W - COL_NO - COL_WORD

BODY_TOP = PAGE_H - MARGIN_TOP
HEADER_HEIGHT = 22
TABLE_TOP = BODY_TOP - HEADER_HEIGHT
TABLE_HEIGHT = TABLE_TOP - MARGIN_BOTTOM

FONT_NAME_LINE = (_FONT_NAME, 9)
FONT_HEADER = (_FONT_NAME, 11)
FONT_SECTION_LABEL = (_FONT_NAME, 8)
FONT_COL_HEADER = (_FONT_NAME, 6.5)
FONT_CELL = (_FONT_NAME, 7)
FONT_CELL_SMALL = (_FONT_NAME, 6)
FONT_CELL_TINY = (_FONT_NAME, 5)

_WORD_MAX_W = COL_WORD - 6
_ANSWER_MAX_W = COL_ANSWER - 6


# ── Text helpers ──

def _text_width(text: str, font_name: str, font_size: float) -> float:
    return pdfmetrics.stringWidth(text, font_name, font_size)


def _wrap_lines(text: str, max_width: float, font_name: str, font_size: float) -> list[str]:
    """Split text into lines that each fit within max_width."""
    if not text:
        return []
    if _text_width(text, font_name, font_size) <= max_width:
        return [text]

    lines: list[str] = []
    current = ""
    for ch in text:
        test = current + ch
        if _text_width(test, font_name, font_size) > max_width and current:
            lines.append(current)
            current = ch
        else:
            current = test
    if current:
        lines.append(current)
    return lines or [text]


def _choose_font_and_wrap(
    text: str, max_width: float, fonts: list[tuple[str, float]],
) -> tuple[tuple[str, float], list[str]]:
    """Try each font (largest first). Pick the first that fits in <=2 lines."""
    if not text:
        return fonts[0], []

    for font in fonts:
        lines = _wrap_lines(text, max_width, *font)
        if len(lines) <= 2:
            return font, lines

    return fonts[-1], _wrap_lines(text, max_width, *fonts[-1])


# ── Public API ──

def _prepare_words(
    new_words: list[tuple[int, str, str]],
    review_words: list[tuple[int, str, str]] | None,
    questions_per_test: int,
    rows_per_side: int,
) -> tuple[list[tuple[int, str, str]], list[tuple[int, str, str]], str, str, bool]:
    """Prepare and shuffle words for PDF generation. Returns (left_words, right_words, left_label, right_label, has_review)."""
    rps = max(1, rows_per_side)
    qpt = min(questions_per_test, rps)

    has_review = bool(review_words)

    sampled_new = list(new_words)
    random.shuffle(sampled_new)
    sampled_new = sampled_new[:qpt]

    if has_review:
        sampled_review = list(review_words)
        random.shuffle(sampled_review)
        sampled_review = sampled_review[:qpt]
    else:
        sampled_review = []

    if has_review:
        left_words = sampled_review
        right_words = sampled_new
    else:
        left_words = sampled_new
        right_words = []

    while len(left_words) < rps:
        left_words.append((0, "", ""))
    while len(right_words) < rps:
        right_words.append((0, "", ""))

    return left_words, right_words, has_review


def generate_word_test_pdf(
    output_path: Path,
    title: str,
    new_words: list[tuple[int, str, str]],
    review_words: list[tuple[int, str, str]] | None = None,
    student_name: str | None = None,
    student_grade: str | None = None,
    new_range_label: str = "",
    review_range_label: str = "",
    questions_per_test: int = 50,
    rows_per_side: int = 50,
) -> Path:
    """Generate a 2-page PDF: page 1 = test (blank answers), page 2 = answer key.

    Layout:
    - With review: LEFT = review, RIGHT = new
    - Without review (first range): LEFT = new, RIGHT = empty
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    rps = max(1, rows_per_side)

    left_words, right_words, has_review = _prepare_words(
        new_words, review_words, questions_per_test, rps,
    )
    left_label = review_range_label if has_review else new_range_label
    right_label = new_range_label if has_review else ""

    c = Canvas(str(output_path), pagesize=A4)

    _draw_page(
        c, title, left_words, right_words,
        show_answers=False, student_name=student_name,
        student_grade=student_grade,
        left_label=left_label, right_label=right_label,
        rows_per_side=rps,
    )
    c.showPage()

    _draw_page(
        c, title, left_words, right_words,
        show_answers=True, student_name=student_name,
        student_grade=student_grade,
        left_label=left_label, right_label=right_label,
        rows_per_side=rps,
    )
    c.showPage()

    c.save()
    return output_path


def generate_word_test_pdfs(
    question_output_path: Path,
    answer_output_path: Path,
    title: str,
    new_words: list[tuple[int, str, str]],
    review_words: list[tuple[int, str, str]] | None = None,
    student_name: str | None = None,
    student_grade: str | None = None,
    new_range_label: str = "",
    review_range_label: str = "",
    questions_per_test: int = 50,
    rows_per_side: int = 50,
) -> tuple[Path, Path]:
    """Generate two separate PDFs: question PDF and answer PDF.

    Returns (question_path, answer_path).
    """
    question_output_path.parent.mkdir(parents=True, exist_ok=True)
    answer_output_path.parent.mkdir(parents=True, exist_ok=True)
    rps = max(1, rows_per_side)

    left_words, right_words, has_review = _prepare_words(
        new_words, review_words, questions_per_test, rps,
    )
    left_label = review_range_label if has_review else new_range_label
    right_label = new_range_label if has_review else ""

    # Question PDF
    cq = Canvas(str(question_output_path), pagesize=A4)
    _draw_page(
        cq, title, left_words, right_words,
        show_answers=False, student_name=student_name,
        student_grade=student_grade,
        left_label=left_label, right_label=right_label,
        rows_per_side=rps,
    )
    cq.showPage()
    cq.save()

    # Answer PDF
    ca = Canvas(str(answer_output_path), pagesize=A4)
    _draw_page(
        ca, title, left_words, right_words,
        show_answers=True, student_name=student_name,
        student_grade=student_grade,
        left_label=left_label, right_label=right_label,
        rows_per_side=rps,
    )
    ca.showPage()
    ca.save()

    return question_output_path, answer_output_path


# ── Internal drawing ──

def _draw_page(
    c: Canvas,
    title: str,
    left_words: list[tuple[int, str, str]],
    right_words: list[tuple[int, str, str]],
    show_answers: bool,
    student_name: str | None = None,
    student_grade: str | None = None,
    left_label: str = "",
    right_label: str = "",
    rows_per_side: int = 50,
) -> None:
    """Draw one page of the test sheet."""

    # Header: student grade + name at the very top-right
    name_line = ""
    if student_grade and student_name:
        name_line = f"{student_grade}  {student_name}"
    elif student_name:
        name_line = student_name
    if name_line:
        c.setFont(*FONT_NAME_LINE)
        c.drawRightString(PAGE_W - MARGIN_R, PAGE_H - 20, name_line)

    # Title below the name
    c.setFont(*FONT_HEADER)
    prefix = "【解答】" if show_answers else ""
    header_text = f"{prefix}{title}"
    c.drawRightString(PAGE_W - MARGIN_R, BODY_TOP + 4, header_text)

    # Section labels above each group
    label_y = TABLE_TOP + 3
    if left_label:
        c.setFont(*FONT_SECTION_LABEL)
        c.setFillColorRGB(0.2, 0.2, 0.2)
        c.drawString(MARGIN_L + 2, label_y, left_label)
        c.setFillColorRGB(0, 0, 0)
    if right_label:
        c.setFont(*FONT_SECTION_LABEL)
        c.setFillColorRGB(0.2, 0.2, 0.2)
        right_x = MARGIN_L + GROUP_W + GAP_BETWEEN_GROUPS
        c.drawString(right_x + 2, label_y, right_label)
        c.setFillColorRGB(0, 0, 0)

    # Draw left group
    _draw_group(c, MARGIN_L, left_words, show_answers, rows_per_side)

    # Separator (double line)
    sep_x = MARGIN_L + GROUP_W + GAP_BETWEEN_GROUPS / 2
    c.setStrokeColorRGB(0.3, 0.3, 0.3)
    c.setLineWidth(0.5)
    c.line(sep_x - 1.5, TABLE_TOP, sep_x - 1.5, MARGIN_BOTTOM)
    c.line(sep_x + 1.5, TABLE_TOP, sep_x + 1.5, MARGIN_BOTTOM)

    # Draw right group
    _draw_group(c, MARGIN_L + GROUP_W + GAP_BETWEEN_GROUPS, right_words, show_answers, rows_per_side)


def _compute_row_heights(
    words: list[tuple[int, str, str]], show_answers: bool, rows: int,
) -> list[tuple[float, list[str], tuple[str, float], list[str], tuple[str, float]]]:
    """Pre-compute row heights and wrapped text for all rows."""
    word_fonts = [FONT_CELL, FONT_CELL_SMALL, FONT_CELL_TINY]
    answer_fonts = [FONT_CELL, FONT_CELL_SMALL, FONT_CELL_TINY]

    result = []
    for i in range(rows):
        _, word, translation = words[i] if i < len(words) else (0, "", "")

        word_font, word_lines = _choose_font_and_wrap(word, _WORD_MAX_W, word_fonts)

        if show_answers and translation:
            trans_font, trans_lines = _choose_font_and_wrap(translation, _ANSWER_MAX_W, answer_fonts)
        else:
            trans_font, trans_lines = FONT_CELL, []

        line_count = max(len(word_lines), len(trans_lines), 1)
        result.append((line_count, word_lines, word_font, trans_lines, trans_font))

    return result


def _draw_group(
    c: Canvas,
    x_start: float,
    words: list[tuple[int, str, str]],
    show_answers: bool,
    rows_per_side: int = 50,
) -> None:
    """Draw one group of rows with variable row heights for wrapping."""

    row_info = _compute_row_heights(words, show_answers, rows_per_side)

    total_units = sum(info[0] for info in row_info)
    unit_h = TABLE_HEIGHT / max(total_units, rows_per_side)
    unit_h = max(unit_h, 6.0)

    # Column headers
    c.setFont(*FONT_COL_HEADER)
    c.setFillColorRGB(0.4, 0.4, 0.4)
    col_header_y = TABLE_TOP - 8
    c.drawString(x_start + 2, col_header_y, "No.")
    c.drawString(x_start + COL_NO + 2, col_header_y, "英単語")
    c.drawString(x_start + COL_NO + COL_WORD + 2, col_header_y, "訳")
    c.setFillColorRGB(0, 0, 0)

    # Top border
    c.setStrokeColorRGB(0, 0, 0)
    c.setLineWidth(0.8)
    c.line(x_start, TABLE_TOP, x_start + GROUP_W, TABLE_TOP)

    y_top = TABLE_TOP
    for i in range(rows_per_side):
        line_count, word_lines, word_font, trans_lines, trans_font = row_info[i]
        row_h = unit_h * line_count
        y_bottom = y_top - row_h

        num = words[i][0] if i < len(words) else 0

        # Alternate row background
        if i % 2 == 0:
            c.setFillColorRGB(0.96, 0.96, 0.96)
            c.rect(x_start, y_bottom, GROUP_W, row_h, fill=True, stroke=False)

        c.setFillColorRGB(0, 0, 0)

        # Number
        if num > 0:
            c.setFont(*FONT_CELL)
            num_y = y_bottom + (row_h - 6.5) / 2 + 1
            c.drawRightString(x_start + COL_NO - 4, num_y, str(num))

        # English word lines
        if word_lines:
            c.setFont(*word_font)
            line_h = word_font[1] + 1.5
            block_h = line_h * len(word_lines)
            text_start_y = y_bottom + (row_h + block_h) / 2 - word_font[1]
            for li, line in enumerate(word_lines):
                c.drawString(x_start + COL_NO + 3, text_start_y - li * line_h, line)

        # Translation lines (answer page only)
        if trans_lines:
            c.setFont(*trans_font)
            line_h = trans_font[1] + 1.5
            block_h = line_h * len(trans_lines)
            text_start_y = y_bottom + (row_h + block_h) / 2 - trans_font[1]
            for li, line in enumerate(trans_lines):
                c.drawString(x_start + COL_NO + COL_WORD + 3, text_start_y - li * line_h, line)

        # Row border
        c.setStrokeColorRGB(0.75, 0.75, 0.75)
        c.setLineWidth(0.3)
        c.line(x_start, y_bottom, x_start + GROUP_W, y_bottom)

        y_top = y_bottom

    # Bottom border
    final_y = y_top
    c.setStrokeColorRGB(0, 0, 0)
    c.setLineWidth(0.8)
    c.line(x_start, final_y, x_start + GROUP_W, final_y)

    # Vertical column separators
    c.setStrokeColorRGB(0.6, 0.6, 0.6)
    c.setLineWidth(0.4)
    c.line(x_start + COL_NO, TABLE_TOP, x_start + COL_NO, final_y)
    c.line(x_start + COL_NO + COL_WORD, TABLE_TOP, x_start + COL_NO + COL_WORD, final_y)

    # Outer borders
    c.setStrokeColorRGB(0, 0, 0)
    c.setLineWidth(0.8)
    c.line(x_start, TABLE_TOP, x_start, final_y)
    c.line(x_start + GROUP_W, TABLE_TOP, x_start + GROUP_W, final_y)
