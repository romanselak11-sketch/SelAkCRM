from decimal import Decimal

import pytest

from selakcrm.domain.policy_income import assert_valid_policy_combination, compute_agent_income_d


def test_only_s_zero():
    assert_valid_policy_combination("1000", "", "0")
    assert compute_agent_income_d("1000", "", "0").quantize(Decimal("0.01")) == Decimal("0.00")


def test_s_plus_pct_bank():
    assert_valid_policy_combination("100", "12.5", "0")
    assert compute_agent_income_d("100", "12.5", "0").quantize(Decimal("0.01")) == Decimal("12.50")


def test_only_prub():
    assert_valid_policy_combination("", "", "99.995")
    assert compute_agent_income_d("", "", "99.995").quantize(Decimal("0.01")) == Decimal("100.00")


def test_rejects_only_pct():
    with pytest.raises(ValueError):
        assert_valid_policy_combination("", "10", "0")
