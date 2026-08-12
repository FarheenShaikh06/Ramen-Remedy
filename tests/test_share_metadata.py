from pathlib import Path


FRONTEND_INDEX = Path(__file__).resolve().parents[1] / "frontend" / "index.html"


def test_shared_link_uses_ramen_remedy_title_and_description():
    html = FRONTEND_INDEX.read_text()

    assert '<title>Ramen Remedy</title>' in html
    assert '<meta property="og:title" content="Ramen Remedy" />' in html
    assert '<meta property="og:description" content="Cozy ramen bowls for warm cravings." />' in html
