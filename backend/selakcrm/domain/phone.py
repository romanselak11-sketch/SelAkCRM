PHONE_MAX = 32


def normalize_phone_ru(phone: str) -> str:
    digits = "".join(ch for ch in phone if ch.isdigit())
    if len(digits) == 11 and digits.startswith("8"):
        return f"+7{digits[1:]}"
    if len(digits) == 10:
        return f"+7{digits}"
    if phone.strip().startswith("+"):
        return f"+{''.join(ch for ch in phone if ch.isdigit())}"
    return f"+{digits}"


def assert_valid_phone(phone: str) -> None:
    if not phone or len(phone) > PHONE_MAX:
        raise ValueError("Телефон обязателен")
    n = normalize_phone_ru(phone)
    digits = "".join(ch for ch in n if ch.isdigit())
    if len(digits) < 10:
        raise ValueError("Некорректный телефон")
