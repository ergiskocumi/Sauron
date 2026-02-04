from core.config import Settings


def test_settings_reads_env_and_defaults(monkeypatch):
    monkeypatch.setenv("FORTIGATE_IP", "192.168.1.1")
    monkeypatch.setenv("FORTIGATE_API_TOKEN", "secret")

    settings = Settings()

    assert settings.fortigate_ip == "192.168.1.1"
    assert settings.fortigate_api_token == "secret"
    assert settings.default_vdom == "root"
    assert settings.api_timeout == 10
