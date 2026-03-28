"""Print ordering logic for subject-based sorting.

Order: 単語テスト(英語) → 単語テスト(国語) → 英語 → 国語 → 数学 → 物理 → 化学 → 生物 → 社会 → その他
"""

# Subject priority order (lower = printed first)
SUBJECT_PRINT_ORDER = [
    "英語",   # 単語テスト with subject=英語 will also use this via word test detection
    "国語",   # 単語テスト with subject=国語
    "数学",
    "物理",
    "化学",
    "生物",
    "社会",
]

# Word test materials get priority over regular materials of the same subject
_WORD_TEST_BONUS = 0  # Word tests come first within their subject group
_REGULAR_BONUS = 100  # Regular materials come after all word tests


def material_sort_key(material_key: str, subject: str) -> int:
    """Return a sort priority for a material based on its subject.

    Word test materials (key starts with '単語:') are sorted before regular
    materials. Within word tests, English comes before Japanese, etc.
    """
    is_word_test = material_key.startswith("単語:")
    bonus = _WORD_TEST_BONUS if is_word_test else _REGULAR_BONUS

    for i, subj in enumerate(SUBJECT_PRINT_ORDER):
        if subject == subj:
            return bonus + i

    # Unknown subjects go last
    return bonus + len(SUBJECT_PRINT_ORDER)
