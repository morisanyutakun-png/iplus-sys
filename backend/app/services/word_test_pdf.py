"""Generate A4 word test PDF sheets (question page + answer page).

Layout:
- With review: left = review, right = new
- Without review (first range): left = new only, right = empty
"""

import random
import unicodedata
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
COL_NO_COMPACT = 22

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
FONT_NAME_LINE_LARGE = (_FONT_NAME, 10)
FONT_HEADER_LARGE = (_FONT_NAME, 13)
FONT_SECTION_LABEL_LARGE = (_FONT_NAME, 9)
FONT_COL_HEADER_LARGE = (_FONT_NAME, 7.5)
FONT_CELL_LARGE = (_FONT_NAME, 9)
FONT_CELL_LARGE_SMALL = (_FONT_NAME, 8)
FONT_CELL_LARGE_TINY = (_FONT_NAME, 7)
_MIN_COMPACT_FONT_SIZE = 2.5
_COMPACT_FONT_STEP = 0.25

_WORD_MAX_W = COL_WORD - 6
_ANSWER_MAX_W = COL_ANSWER - 6
_SPACE_EQUIVALENTS = {
    "\u00a0", "\u1680", "\u180e", "\u2000", "\u2001", "\u2002", "\u2003",
    "\u2004", "\u2005", "\u2006", "\u2007", "\u2008", "\u2009", "\u200a",
    "\u202f", "\u205f", "\u3000",
}


# ── Text helpers ──

def _text_width(text: str, font_name: str, font_size: float) -> float:
    return pdfmetrics.stringWidth(text, font_name, font_size)


def _is_joinable_text_char(ch: str) -> bool:
    category = unicodedata.category(ch)
    return category.startswith(("L", "N"))


def _sanitize_pdf_text(text: str, preserve_line_breaks: bool = False) -> str:
    if not text:
        return ""

    normalized = (
        text.replace("\r\n", "\n")
        .replace("\r", "\n")
        .replace("\u2028", "\n")
        .replace("\u2029", "\n")
    )

    cleaned: list[str] = []
    for index, ch in enumerate(normalized):
        if ch in _SPACE_EQUIVALENTS or ch in {"\t", "\v", "\f"}:
            cleaned.append(" ")
            continue

        if ch == "\n":
            prev_char = normalized[index - 1] if index > 0 else ""
            next_char = normalized[index + 1] if index + 1 < len(normalized) else ""
            if preserve_line_breaks:
                cleaned.append("\n")
            elif _is_joinable_text_char(prev_char) and _is_joinable_text_char(next_char):
                continue
            else:
                cleaned.append(" ")
            continue

        if unicodedata.category(ch).startswith("C"):
            continue

        cleaned.append(ch)

    sanitized = "".join(cleaned)
    if preserve_line_breaks:
        return "\n".join(line.rstrip() for line in sanitized.split("\n")).strip("\n")
    return sanitized.strip()


def _get_font_bundle(rows_per_side: int) -> dict[str, object]:
    if rows_per_side <= 15:
        return {
            "name_line": FONT_NAME_LINE_LARGE,
            "header": FONT_HEADER_LARGE,
            "section_label": FONT_SECTION_LABEL_LARGE,
            "col_header": FONT_COL_HEADER_LARGE,
            "cell_fonts": [
                FONT_CELL_LARGE,
                FONT_CELL_LARGE_SMALL,
                FONT_CELL_LARGE_TINY,
            ],
        }

    return {
        "name_line": FONT_NAME_LINE,
        "header": FONT_HEADER,
        "section_label": FONT_SECTION_LABEL,
        "col_header": FONT_COL_HEADER,
        "cell_fonts": [FONT_CELL, FONT_CELL_SMALL, FONT_CELL_TINY],
    }


def _wrap_lines(text: str, max_width: float, font_name: str, font_size: float) -> list[str]:
    """Split text into lines that each fit within max_width."""
    sanitized = _sanitize_pdf_text(text)
    if not sanitized:
        return []
    if _text_width(sanitized, font_name, font_size) <= max_width:
        return [sanitized]

    lines: list[str] = []
    current = ""
    for ch in sanitized:
        test = current + ch
        if _text_width(test, font_name, font_size) > max_width and current:
            lines.append(current.rstrip())
            current = ch
        else:
            current = test
    if current:
        lines.append(current.rstrip())
    return lines or [sanitized]


def _wrap_lines_with_breaks(
    text: str,
    max_width: float,
    font_name: str,
    font_size: float,
) -> list[str]:
    """Split text into lines while preserving explicit line breaks."""
    sanitized = _sanitize_pdf_text(text, preserve_line_breaks=True)
    if not sanitized:
        return []

    lines: list[str] = []
    for raw_line in sanitized.split("\n"):
        if not raw_line:
            lines.append("")
            continue
        lines.extend(_wrap_lines(raw_line, max_width, font_name, font_size))

    while lines and not lines[-1]:
        lines.pop()
    return lines


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


def _compact_line_height(font_size: float) -> float:
    return max(font_size * 1.12, font_size + 0.2)


def _compact_font_sizes(fonts: list[tuple[str, float]]) -> list[float]:
    max_size = max(font_size for _, font_size in fonts)
    sizes: list[float] = []
    current = max_size
    while current >= _MIN_COMPACT_FONT_SIZE:
        sizes.append(round(current, 2))
        current -= _COMPACT_FONT_STEP
    if not sizes or sizes[-1] != _MIN_COMPACT_FONT_SIZE:
        sizes.append(_MIN_COMPACT_FONT_SIZE)
    return sizes


def _fits_within_height(lines: list[str], font_size: float, max_height: float) -> bool:
    if not lines:
        return True
    return len(lines) * _compact_line_height(font_size) <= max_height + 0.1


def _choose_font_and_wrap_by_height(
    text: str,
    max_width: float,
    max_height: float,
    fonts: list[tuple[str, float]],
) -> tuple[tuple[str, float], list[str]]:
    sanitized = _sanitize_pdf_text(text, preserve_line_breaks=True)
    if not sanitized:
        return fonts[0], []

    font_name = fonts[0][0]
    fallback_font = (font_name, _MIN_COMPACT_FONT_SIZE)
    fallback_lines = _wrap_lines_with_breaks(
        sanitized,
        max_width,
        font_name,
        _MIN_COMPACT_FONT_SIZE,
    )

    for font_size in _compact_font_sizes(fonts):
        lines = _wrap_lines_with_breaks(sanitized, max_width, font_name, font_size)
        if _fits_within_height(lines, font_size, max_height):
            return (font_name, font_size), lines
        fallback_font = (font_name, font_size)
        fallback_lines = lines

    return fallback_font, fallback_lines


def _estimate_compact_split_ratio(
    question: str,
    answer: str,
    show_answers: bool,
) -> float | None:
    if not show_answers:
        return None

    sanitized_answer = _sanitize_pdf_text(answer, preserve_line_breaks=True)
    if not sanitized_answer:
        return None

    sanitized_question = _sanitize_pdf_text(question, preserve_line_breaks=True)
    question_weight = len(sanitized_question.replace("\n", "")) + sanitized_question.count("\n") * 10
    answer_weight = len(sanitized_answer.replace("\n", "")) + sanitized_answer.count("\n") * 10
    total_weight = max(question_weight + answer_weight, 1)
    ratio = question_weight / total_weight
    return min(max(ratio, 0.52), 0.74)


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
    fonts = _get_font_bundle(rows_per_side)

    # Header: student grade + name at the very top-right
    name_line = ""
    if student_grade and student_name:
        name_line = f"{student_grade}  {student_name}"
    elif student_name:
        name_line = student_name
    if name_line:
        c.setFont(*fonts["name_line"])
        c.drawRightString(PAGE_W - MARGIN_R, PAGE_H - 20, _sanitize_pdf_text(name_line))

    # Title below the name
    c.setFont(*fonts["header"])
    prefix = "【解答】" if show_answers else ""
    header_text = f"{prefix}{title}"
    c.drawRightString(PAGE_W - MARGIN_R, BODY_TOP + 4, _sanitize_pdf_text(header_text))

    # Section labels above each group
    label_y = TABLE_TOP + 3
    if left_label:
        c.setFont(*fonts["section_label"])
        c.setFillColorRGB(0.2, 0.2, 0.2)
        c.drawString(MARGIN_L + 2, label_y, _sanitize_pdf_text(left_label))
        c.setFillColorRGB(0, 0, 0)
    if right_label:
        c.setFont(*fonts["section_label"])
        c.setFillColorRGB(0.2, 0.2, 0.2)
        right_x = MARGIN_L + GROUP_W + GAP_BETWEEN_GROUPS
        c.drawString(right_x + 2, label_y, _sanitize_pdf_text(right_label))
        c.setFillColorRGB(0, 0, 0)

    if rows_per_side <= 15:
        _draw_compact_group(c, MARGIN_L, left_words, show_answers, rows_per_side)

        sep_x = MARGIN_L + GROUP_W + GAP_BETWEEN_GROUPS / 2
        c.setStrokeColorRGB(0.3, 0.3, 0.3)
        c.setLineWidth(0.5)
        c.line(sep_x - 1.5, TABLE_TOP, sep_x - 1.5, MARGIN_BOTTOM)
        c.line(sep_x + 1.5, TABLE_TOP, sep_x + 1.5, MARGIN_BOTTOM)

        _draw_compact_group(
            c,
            MARGIN_L + GROUP_W + GAP_BETWEEN_GROUPS,
            right_words,
            show_answers,
            rows_per_side,
        )
        return

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
    fonts = _get_font_bundle(rows)
    word_fonts = fonts["cell_fonts"]
    answer_fonts = fonts["cell_fonts"]

    result = []
    for i in range(rows):
        _, word, translation = words[i] if i < len(words) else (0, "", "")
        word = _sanitize_pdf_text(word)
        translation = _sanitize_pdf_text(translation)

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
    fonts = _get_font_bundle(rows_per_side)

    row_info = _compute_row_heights(words, show_answers, rows_per_side)

    total_units = sum(info[0] for info in row_info)
    unit_h = TABLE_HEIGHT / max(total_units, rows_per_side)
    unit_h = max(unit_h, 6.0)

    # Column headers
    c.setFont(*fonts["col_header"])
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
            number_font = fonts["cell_fonts"][0]
            c.setFont(*number_font)
            num_y = y_bottom + (row_h - number_font[1]) / 2 + 1
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


def _draw_compact_group(
    c: Canvas,
    x_start: float,
    words: list[tuple[int, str, str]],
    show_answers: bool,
    rows_per_side: int,
) -> None:
    fonts = _get_font_bundle(rows_per_side)
    question_fonts = fonts["cell_fonts"]
    answer_fonts = fonts["cell_fonts"]
    row_h = TABLE_HEIGHT / max(rows_per_side, 1)
    content_x = x_start + COL_NO_COMPACT

    c.setFont(*fonts["col_header"])
    c.setFillColorRGB(0.4, 0.4, 0.4)
    col_header_y = TABLE_TOP - 8
    c.drawString(x_start + 2, col_header_y, "No.")
    c.drawString(content_x + 2, col_header_y, "問題 / 解答")
    c.setFillColorRGB(0, 0, 0)

    c.setStrokeColorRGB(0, 0, 0)
    c.setLineWidth(0.8)
    c.line(x_start, TABLE_TOP, x_start + GROUP_W, TABLE_TOP)

    y_top = TABLE_TOP
    for i in range(rows_per_side):
        num, question, answer = words[i] if i < len(words) else (0, "", "")
        y_bottom = y_top - row_h

        if i % 2 == 0:
            c.setFillColorRGB(0.96, 0.96, 0.96)
            c.rect(x_start, y_bottom, GROUP_W, row_h, fill=True, stroke=False)

        c.setFillColorRGB(0, 0, 0)

        if num > 0:
            number_font = fonts["cell_fonts"][0]
            c.setFont(*number_font)
            num_y = y_bottom + (row_h - number_font[1]) / 2 + 1
            c.drawRightString(content_x - 4, num_y, str(num))

        inner_left = content_x + 3
        inner_right = x_start + GROUP_W - 3
        inner_top = y_top - 4
        inner_bottom = y_bottom + 3
        question_max_w = max(inner_right - inner_left, 1)
        content_height = max(inner_top - inner_bottom, 8)
        split_ratio = _estimate_compact_split_ratio(question, answer, show_answers)

        if split_ratio is None:
            question_height = None
            question_font, question_lines = _choose_font_and_wrap_by_height(
                question,
                question_max_w,
                content_height,
                question_fonts,
            )
            answer_font, answer_lines = answer_fonts[0], []
        else:
            question_height = max(content_height * split_ratio - 2, 8)
            answer_height = max(content_height - question_height - 2, 8)
            question_font, question_lines = _choose_font_and_wrap_by_height(
                question,
                question_max_w,
                question_height,
                question_fonts,
            )
            answer_font, answer_lines = _choose_font_and_wrap_by_height(
                answer,
                question_max_w,
                answer_height,
                answer_fonts,
            )

        if question_lines:
            c.setFont(*question_font)
            q_line_h = _compact_line_height(question_font[1])
            question_block_h = len(question_lines) * q_line_h
            if question_height is None:
                q_top = inner_bottom + (content_height + question_block_h) / 2
            else:
                q_top = inner_top
            q_y = q_top - question_font[1]
            for line in question_lines:
                c.drawString(inner_left, q_y, line)
                q_y -= q_line_h

        if question_height is not None:
            answer_height = max(content_height - question_height - 2, 8)
            split_y = inner_bottom + answer_height + 2

            c.setStrokeColorRGB(0.75, 0.75, 0.75)
            c.setLineWidth(0.3)
            c.line(content_x, split_y, x_start + GROUP_W, split_y)

            if answer_lines:
                c.setFont(*answer_font)
                a_line_h = _compact_line_height(answer_font[1])
                a_y = split_y - 3 - answer_font[1]
                for line in answer_lines:
                    c.drawString(inner_left, a_y, line)
                    a_y -= a_line_h

        c.setStrokeColorRGB(0.75, 0.75, 0.75)
        c.setLineWidth(0.3)
        c.line(x_start, y_bottom, x_start + GROUP_W, y_bottom)

        y_top = y_bottom

    final_y = y_top
    c.setStrokeColorRGB(0.6, 0.6, 0.6)
    c.setLineWidth(0.4)
    c.line(content_x, TABLE_TOP, content_x, final_y)

    c.setStrokeColorRGB(0, 0, 0)
    c.setLineWidth(0.8)
    c.line(x_start, final_y, x_start + GROUP_W, final_y)
    c.line(x_start, TABLE_TOP, x_start, final_y)
    c.line(x_start + GROUP_W, TABLE_TOP, x_start + GROUP_W, final_y)
