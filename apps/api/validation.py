"""Small input-validation helpers shared by the views."""
import re
from datetime import datetime, timezone

from flask import request

VALID_PRIORITIES = {"low", "medium", "high", "urgent"}
VALID_STATUSES = {"todo", "in-progress", "pending", "completed"}

MIN_PASSWORD_LENGTH = 8
USERNAME_RE = re.compile(r"^[A-Za-z0-9_.-]{3,50}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def json_body() -> dict:
    """Request JSON as a dict; anything else (missing, malformed, list) becomes {}."""
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def utcnow_naive() -> datetime:
    """Naive UTC — the representation stored in every DateTime column."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def normalize_email(value) -> str:
    return value.strip().lower() if isinstance(value, str) else ""


def validate_username(value):
    if not isinstance(value, str) or not USERNAME_RE.match(value.strip()):
        return "Username must be 3–50 characters: letters, numbers, dot, dash or underscore"
    return None


def validate_email(value):
    if not value or len(value) > 100 or not EMAIL_RE.match(value):
        return "Enter a valid email address"
    return None


def validate_password(value):
    if not isinstance(value, str) or len(value) < MIN_PASSWORD_LENGTH:
        return f"Password must be at least {MIN_PASSWORD_LENGTH} characters"
    if len(value) > 200:
        return "Password is too long"
    return None


def parse_datetime(value):
    """Parse an ISO-8601 date/datetime into naive UTC.

    Returns (datetime | None, error | None). Empty / None means "no value".
    """
    if value is None or value == "":
        return None, None
    if not isinstance(value, str):
        return None, "Invalid date"
    try:
        dt = datetime.fromisoformat(value.strip())
    except ValueError:
        return None, "Invalid date format. Use YYYY-MM-DD or ISO 8601."
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt, None


def to_int(value):
    """int(value) or None — never raises."""
    if isinstance(value, bool):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def int_list(value):
    """A list of ints, or None if `value` is not a list of int-like items."""
    if not isinstance(value, list):
        return None
    out = []
    for item in value:
        n = to_int(item)
        if n is None:
            return None
        out.append(n)
    return out
