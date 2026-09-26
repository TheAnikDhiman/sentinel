from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class ProviderResult:
    text: str
    input_tokens: int
    output_tokens: int
    model: str


class AIProvider(Protocol):
    name: str

    @property
    def configured(self) -> bool: ...

    def generate(self, model: str, prompt: str) -> ProviderResult: ...
