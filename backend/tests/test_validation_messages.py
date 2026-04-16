from selakcrm.validation_http import nest_validation_messages


def test_extra_forbidden_message():
    errs = [
        {
            "type": "extra_forbidden",
            "loc": ("body", "extraField"),
            "msg": "Extra inputs are not permitted",
            "input": {"a": 1},
        }
    ]
    msgs = nest_validation_messages(errs)
    assert msgs == ["property extraField should not exist"]
