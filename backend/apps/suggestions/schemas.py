from typing import Literal

from ninja import Schema

SuggestionType = Literal["warning", "hint", "focus", "praise"]


class SuggestionItemSchema(Schema):
    id: str
    type: SuggestionType
    title: str
    text: str


class TodaySuggestionsSchema(Schema):
    date: str
    suggestions: list[SuggestionItemSchema]
