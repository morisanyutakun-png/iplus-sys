"""Generate A4 word test PDF sheets (question page + answer page).

Layout: left side = new words, right side = review words.
"""

import random
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas

# ── Font setup ──
# Bundled NotoSansJP for cross-platform Japanese support
_FONT_DIR = Path(__file__).resolve().parent.parent.parent / "assets" / "fonts"
_FONT_CANDIDATES = [
    _FONT_DIR / "NotoSansJP.ttf",
    Path("/Library/Fonts/Arial Unicode.ttf"),  # macOS fallback
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

FONT_HEADER = (_FONT_NAME, 11)
FONT_SECTION_LABEL = (_FONT_NAME, 8)
FONT_COL_HEADER = (_FONT_NAME, 6.5)
FONT_CELL = (_FONT_NAME, 7)
FONT_CELL_SMALL = (_FONT_NAME, 6)


def generate_word_test_pdf(
    output_path: Path,
    title: str,
    new_words: list[tuple[int, str, str]],
    review_words: list[tuple[int, str, str]] | None = None,
    student_name: str | None = None,
    new_range_label: str = "",
    review_range_label: str = "",
) -> Path:
    """Generate a 2-page PDF: page 1 = test (blank answers), page 2 = answer key.

    Args:
        new_words: Words for the left side (new/current range). Shuffled and sampled to 50.
        review_words: Words for the right side (review from previous ranges).
            None or empty means no review (right side drawn as empty grid).
        new_range_label: Label shown above left group (e.g. "No.101〜200").
        review_range_label: Label shown above right group (e.g. "復習 No.1〜100").
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Shuffle and sample left side (new words)
    left_words = list(new_words)
    random.shuffle(left_words)
    left_words = left_words[:ROWS_PER_GROUP]

    # Shuffle and sample right side (review words)
    if review_words:
        right_words = list(review_words)
        random.shuffle(right_words)
        right_words = right_words[:ROWS_PER_GROUP]
    else:
        right_words = []

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
        left_label=new_range_label, right_label=review_range_label,
    )
    c.showPage()

    # Page 2: Answer key
    _draw_page(
        c, title, left_words, right_words,
        show_answers=True, student_name=student_name,
        left_label=new_range_label, right_label=review_range_label,
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

    # Header (right-aligned)
    c.setFont(*FONT_HEADER)
    prefix = "【解答】" if show_answers else ""
    name_part = f"{student_name}　" if student_name else ""
    header_text = f"{prefix}{name_part}{title}"
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

    # Draw left group (new words)
    _draw_group(c, MARGIN_L, left_words, show_answers)

    # Draw separator (double line)
    sep_x = MARGIN_L + GROUP_W + GAP_BETWEEN_GROUPS / 2
    c.setStrokeColorRGB(0.3, 0.3, 0.3)
    c.setLineWidth(0.5)
    c.line(sep_x - 1.5, TABLE_TOP, sep_x - 1.5, MARGIN_BOTTOM)
    c.line(sep_x + 1.5, TABLE_TOP, sep_x + 1.5, MARGIN_BOTTOM)

    # Draw right group (review words)
    _draw_group(c, MARGIN_L + GROUP_W + GAP_BETWEEN_GROUPS, right_words, show_answers)


def _draw_group(
    c: Canvas,
    x_start: float,
    words: list[tuple[int, str, str]],
    show_answers: bool,
) -> None:
    """Draw one group of 50 rows (No | English | Translation)."""

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

        # English word
        if word:
            c.setFont(*FONT_CELL)
            display = word if len(word) <= 22 else word[:21] + "…"
            c.drawString(x_start + COL_NO + 3, y_text, display)

        # Translation (answer page only)
        if show_answers and translation:
            font = FONT_CELL_SMALL if len(translation) > 14 else FONT_CELL
            c.setFont(*font)
            display = translation if len(translation) <= 26 else translation[:25] + "…"
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
