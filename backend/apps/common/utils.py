from typing import Iterable


def as_set(values: Iterable[str]) -> set[str]:
    return {value.strip() for value in values if value and value.strip()}
