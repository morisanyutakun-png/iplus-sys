"""Generate A4 word test PDF sheets (question page + answer page).

Layout: left side = review words, right side = new words.
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
ROWS_PER_GROUP = 50
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
ROW_H = TABLE_HEIGHT / ROWS_PER_GROUP

FONT_NAME_LINE = (_FONT_NAME, 9)
FONT_HEADER = (_FONT_NAME, 11)
FONT_SECTION_LABEL = (_FONT_NAME, 8)
FONT_COL_HEADER = (_FONT_NAME, 6.5)
FONT_CELL = (_FONT_NAME, 7)
FONT_CELL_SMALL = (_FONT_NAME, 6)


def _fit_text(text: str, max_width: float, font_name: str, font_size: float) -> str:
    """Truncate text with '…' if it exceeds max_width in the given font."""
    if not text:
        return text
    w = pdfmetrics.stringWidth(text, font_name, font_size)
    if w <= max_width:
        return text
    ellipsis_w = pdfmetrics.stringWidth("…", font_name, font_size)
    while len(text) > 1:
        text = text[:-1]
        if pdfmetrics.stringWidth(text, font_name, font_size) + ellipsis_w <= max_width:
            return text + "…"
    return "…"


def generate_word_test_pdf(
    output_path: Path,
    title: str,
    new_words: list[tuple[int, str, str]],
    review_words: list[tuple[int, str, str]] | None = None,
    student_name: str | None = None,
    new_range_label: str = "",
    review_range_label: str = "",
    questions_per_test: int = 50,
) -> Path:
    """Generate a 2-page PDF: page 1 = test (blank answers), page 2 = answer key.

    Layout: LEFT = review (復習), RIGHT = new (新出).

    Args:
        new_words: Words for the right side (new/current range).
        review_words: Words for the left side (review from previous ranges).
            None or empty means no review (left side drawn as empty grid).
        questions_per_test: Max questions per side (capped at ROWS_PER_GROUP).
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)

    qpt = min(questions_per_test, ROWS_PER_GROUP)

    # RIGHT side = new words (shuffled, sampled to qpt)
    right_words = list(new_words)
    random.shuffle(right_words)
    right_words = right_words[:qpt]

    # LEFT side = review words (shuffled, sampled to qpt)
    if review_words:
        left_words = list(review_words)
        random.shuffle(left_words)
        left_words = left_words[:qpt]
    else:
        left_words = []

    # Pad both sides to exactly ROWS_PER_GROUP
    while len(left_words) < ROWS_PER_GROUP:
        left_words.append((0, "", ""))
    while len(right_words) < ROWS_PER_GROUP:
        right_words.append((0, "", ""))

    c = Canvas(str(output_path), pagesize=A4)

    # Page 1: Question sheet (blank answers)
    _draw_page(
        c, title, left_words, right_words,
        show_answers=False, student_name=student_name,
        left_label=review_range_label, right_label=new_range_label,
    )
    c.showPage()

    # Page 2: Answer key
    _draw_page(
        c, title, left_words, right_words,
        show_answers=True, student_name=student_name,
        left_label=review_range_label, right_label=new_range_label,
    )
    c.showPage()

    c.save()
    return output_path


def _draw_page(
    c: Canvas,
    title: str,
    left_words: list[tuple[int, str, str]],
    right_words: list[tuple[int, str, str]],
    show_answers: bool,
    student_name: str | None = None,
    left_label: str = "",
    right_label: str = "",
) -> None:
    """Draw one page of the test sheet."""

    # ── Header area (right-aligned) ──
    # Line 1: Student name at the very top-right
    if student_name:
        c.setFont(*FONT_NAME_LINE)
        c.drawRightString(PAGE_W - MARGIN_R, PAGE_H - 20, student_name)

    # Line 2: Title (with answer prefix) below the name
    c.setFont(*FONT_HEADER)
    prefix = "【解答】" if show_answers else ""
    header_text = f"{prefix}{title}"
    c.drawRightString(PAGE_W - MARGIN_R, BODY_TOP + 4, header_text)

    # Section labels above each group
    label_y = TABLE_TOP + 3
    if left_label:
        c.setFont(*FONT_SECTION_LABEL)
        c.setFillColorRGB(0.2, 0.2, 0.2)
        fitted = _fit_text(left_label, GROUP_W - 4, *FONT_SECTION_LABEL)
        c.drawString(MARGIN_L + 2, label_y, fitted)
        c.setFillColorRGB(0, 0, 0)
    if right_label:
        c.setFont(*FONT_SECTION_LABEL)
        c.setFillColorRGB(0.2, 0.2, 0.2)
        right_x = MARGIN_L + GROUP_W + GAP_BETWEEN_GROUPS
        fitted = _fit_text(right_label, GROUP_W - 4, *FONT_SECTION_LABEL)
        c.drawString(right_x + 2, label_y, fitted)
        c.setFillColorRGB(0, 0, 0)

    # Draw left group (review words)
    _draw_group(c, MARGIN_L, left_words, show_answers)

    # Draw separator (double line)
    sep_x = MARGIN_L + GROUP_W + GAP_BETWEEN_GROUPS / 2
    c.setStrokeColorRGB(0.3, 0.3, 0.3)
    c.setLineWidth(0.5)
    c.line(sep_x - 1.5, TABLE_TOP, sep_x - 1.5, MARGIN_BOTTOM)
    c.line(sep_x + 1.5, TABLE_TOP, sep_x + 1.5, MARGIN_BOTTOM)

    # Draw right group (new words)
    _draw_group(c, MARGIN_L + GROUP_W + GAP_BETWEEN_GROUPS, right_words, show_answers)


def _draw_group(
    c: Canvas,
    x_start: float,
    words: list[tuple[int, str, str]],
    show_answers: bool,
) -> None:
    """Draw one group of 50 rows (No | English | Translation)."""

    word_col_max = COL_WORD - 6
    answer_col_max = COL_ANSWER - 6

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

    for i in range(ROWS_PER_GROUP):
        y_top = TABLE_TOP - i * ROW_H
        y_bottom = y_top - ROW_H
        y_text = y_bottom + (ROW_H - 6.5) / 2 + 1

        num, word, translation = words[i] if i < len(words) else (0, "", "")

        # Alternate row background
        if i % 2 == 0:
            c.setFillColorRGB(0.96, 0.96, 0.96)
            c.rect(x_start, y_bottom, GROUP_W, ROW_H, fill=True, stroke=False)

        c.setFillColorRGB(0, 0, 0)

        # Number
        c.setFont(*FONT_CELL)
        if num > 0:
            c.drawRightString(x_start + COL_NO - 4, y_text, str(num))

        # English word (fit to column width)
        if word:
            c.setFont(*FONT_CELL)
            display = _fit_text(word, word_col_max, *FONT_CELL)
            c.drawString(x_start + COL_NO + 3, y_text, display)

        # Translation (answer page only, fit to column width)
        if show_answers and translation:
            font = FONT_CELL_SMALL if len(translation) > 14 else FONT_CELL
            c.setFont(*font)
            display = _fit_text(translation, answer_col_max, *font)
            c.drawString(x_start + COL_NO + COL_WORD + 3, y_text, display)

        # Row border
        c.setStrokeColorRGB(0.75, 0.75, 0.75)
        c.setLineWidth(0.3)
        c.line(x_start, y_bottom, x_start + GROUP_W, y_bottom)

    # Bottom border
    final_y = TABLE_TOP - ROWS_PER_GROUP * ROW_H
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
