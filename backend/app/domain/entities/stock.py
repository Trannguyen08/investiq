"""Security master entities used to resolve article mentions."""

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Security:
    id: str
    symbol: str
    exchange: str
    issuer_name: str

    @property
    def qualified_symbol(self) -> str:
        return f"{self.exchange}:{self.symbol}"
