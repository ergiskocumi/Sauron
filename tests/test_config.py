"""
Tests for core.config module.
"""

import pytest
from core.config import Settings, get_settings


def test_settings_has_defaults():
    """Verifica che Settings abbia valori di default corretti."""
    # Clear cache to get fresh settings
    get_settings.cache_clear()

    settings = Settings(
        _env_file=None,  # Non leggere da .env per il test
    )

    assert settings.app_name == "SAURON"
    assert settings.default_vdom == "root"
    assert settings.api_timeout == 30
    assert settings.ssl_verify is False
    assert settings.max_connections == 10
    assert settings.parallel_scans is True


def test_settings_reads_from_env(monkeypatch):
    """Verifica che Settings legga correttamente da variabili d'ambiente."""
    get_settings.cache_clear()

    monkeypatch.setenv("FORTIGATE_IP", "192.168.1.1:443")
    monkeypatch.setenv("FORTIGATE_API_TOKEN", "test-token-123")
    monkeypatch.setenv("DEFAULT_VDOM", "custom-vdom")
    monkeypatch.setenv("API_TIMEOUT", "60")
    monkeypatch.setenv("SSL_VERIFY", "true")
    monkeypatch.setenv("DEBUG", "true")

    settings = Settings(_env_file=None)

    assert settings.fortigate_ip == "192.168.1.1:443"
    assert settings.fortigate_api_token == "test-token-123"
    assert settings.default_vdom == "custom-vdom"
    assert settings.api_timeout == 60
    assert settings.ssl_verify is True
    assert settings.debug is True


def test_settings_validation_constraints(monkeypatch):
    """Verifica i vincoli di validazione sui campi."""
    get_settings.cache_clear()

    # api_timeout deve essere >= 5
    monkeypatch.setenv("API_TIMEOUT", "3")

    with pytest.raises(Exception):  # ValidationError
        Settings(_env_file=None)


def test_get_settings_returns_cached_instance():
    """Verifica che get_settings restituisca sempre la stessa istanza (cached)."""
    get_settings.cache_clear()

    settings1 = get_settings()
    settings2 = get_settings()

    assert settings1 is settings2


def test_settings_log_level_default():
    """Verifica il livello di log di default."""
    get_settings.cache_clear()

    settings = Settings(_env_file=None)

    assert settings.log_level == "INFO"
