from __future__ import annotations

from decimal import Decimal, ROUND_HALF_EVEN


def round_bankers2(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN)


def _dec_or_null(v: str | None) -> Decimal | None:
    if v is None or v == "":
        return None
    return Decimal(v)


def _dec_rub(v: str | None) -> Decimal:
    if v is None or v == "":
        return Decimal(0)
    return Decimal(v)


def assert_valid_policy_combination(
    insurance_sum_s: str | None,
    premium_percent: str | None,
    premium_rubles: str | None,
) -> None:
    s = _dec_or_null(insurance_sum_s)
    prub = _dec_rub(premium_rubles)
    has_s = s is not None and s != 0
    pct_field_provided = premium_percent is not None and premium_percent != ""
    has_rub = prub != 0

    if pct_field_provided and not has_s and not has_rub:
        raise ValueError("Недопустимо: задан только P% без S и без P₽")


def compute_agent_income_d(
    insurance_sum_s: str | None,
    premium_percent: str | None,
    premium_rubles: str | None,
) -> Decimal:
    assert_valid_policy_combination(insurance_sum_s, premium_percent, premium_rubles)
    s = _dec_or_null(insurance_sum_s)
    ppct = _dec_or_null(premium_percent)
    prub = _dec_rub(premium_rubles)

    has_s = s is not None and s != 0
    pct_used = ppct is not None

    if has_s and not pct_used and prub == 0:
        return Decimal(0)
    if has_s and pct_used:
        return round_bankers2(s * ppct / Decimal(100) + prub)  # type: ignore[operator]
    if has_s and not pct_used and prub != 0:
        return round_bankers2(prub)
    if not has_s and prub != 0:
        return round_bankers2(prub)
    return Decimal(0)
