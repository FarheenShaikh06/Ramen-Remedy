from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


def test_netlify_builds_frontend_and_preserves_client_routes():
    config_path = REPO_ROOT / "netlify.toml"
    assert config_path.is_file(), "Netlify must be configured from the repository root"

    config = config_path.read_text()

    assert '[build]' in config
    assert 'base = "frontend"' in config
    assert 'command = "npm run build"' in config
    assert 'publish = "dist"' in config
    assert '[[redirects]]' in config
    assert 'from = "/*"' in config
    assert 'to = "/index.html"' in config
    assert 'status = 200' in config
