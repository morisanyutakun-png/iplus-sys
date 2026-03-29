"""Print ordering logic for subject-based sorting.

Order: 単語テスト → 通常教材 → 試験教材
各カテゴリ内は教科順（英語系→国語系→数学系→理科系→社会系→情報）
"""

SUBJECT_PRINT_ORDER = [
    "英語R", "英語L", "英語",
    "現代文", "古文", "漢文", "国語",
    "数学IA", "数学IIB", "数学IIIC", "数学",
    "物理基礎", "物理", "化学基礎", "化学",
    "生物基礎", "生物", "地学基礎", "地学",
    "日本史", "世界史", "地理",
    "政治経済", "倫理", "倫理政経", "現代社会", "公共",
    "情報I",
]

_WORD_TEST_BONUS = 0
_REGULAR_BONUS = 100
_EXAM_BONUS = 200


def material_sort_key(material_key: str, subject: str) -> int:
    is_word_test = material_key.startswith("単語:")
    is_exam = material_key.startswith("試験:")

    if is_word_test:
        bonus = _WORD_TEST_BONUS
    elif is_exam:
        bonus = _EXAM_BONUS
    else:
        bonus = _REGULAR_BONUS

    for i, subj in enumerate(SUBJECT_PRINT_ORDER):
        if subject == subj:
            return bonus + i

    return bonus + len(SUBJECT_PRINT_ORDER)
