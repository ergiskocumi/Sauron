"""
Tests for backend.api PathRequest validation.
"""

import pytest
from pydantic import ValidationError

from backend.api import PathRequest


def test_path_request_accepts_human_readable_node_keys() -> None:
    req = PathRequest(
        source="Firewall Milano:prod-vdom",
        destination="Firewall Roma:root",
    )
    assert req.source == "Firewall Milano:prod-vdom"
    assert req.destination == "Firewall Roma:root"


def test_path_request_accepts_ip_destination_with_spaces_trimmed() -> None:
    req = PathRequest(
        source="  fw-core  ",
        destination=" 10.0.0.1 ",
    )
    assert req.source == "fw-core"
    assert req.destination == "10.0.0.1"


def test_path_request_rejects_empty_source() -> None:
    with pytest.raises(ValidationError):
        PathRequest(source="   ", destination="10.0.0.1")
