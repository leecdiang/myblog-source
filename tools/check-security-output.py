"""Independently verify the bytes browsers receive, including CSP script hashes."""
from pathlib import Path
from html.parser import HTMLParser
import base64
import hashlib
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]

class Page(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=False)
        self.tags = []
        self.scripts = []
        self.script = None
        self.feed(html)
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.tags.append((tag, attrs))
        assert not any(name.lower().startswith('on') for name in attrs), attrs
        if tag == 'script':
            self.script = [attrs, '']
    def handle_data(self, value):
        if self.script is not None:
            self.script[1] += value
    def handle_endtag(self, tag):
        if tag == 'script' and self.script is not None:
            self.scripts.append(self.script)
            self.script = None

count = 0
for file in sorted((ROOT / 'public').rglob('*.html')):
    page = Page(file.read_text())
    policies = [a['content'] for t, a in page.tags if t == 'meta' and a.get('http-equiv', '').lower() == 'content-security-policy']
    assert len(policies) == 1, file
    policy = dict(part.strip().split(' ', 1) for part in policies[0].split(';'))
    assert policy['default-src'] == "'self'", file
    assert policy['object-src'] == policy['base-uri'] == "'none'", file
    iframe_article = file.relative_to(ROOT / 'public').as_posix() == '2026/11/08/llm-inference-from-token-to-cluster/index.html'
    assert policy['frame-src'] == ("'self'" if iframe_article else "'none'"), file
    if iframe_article:
        frames = [a for tag, a in page.tags if tag == 'iframe']
        assert len(frames) == 2 and all(
            frame.get('sandbox') == 'allow-scripts'
            and frame.get('src', '').startswith('./interactive/inference-lab.html?tab=')
            for frame in frames
        ), (file, frames)
    assert "'unsafe-inline'" not in policy['script-src'] and "'unsafe-eval'" not in policy['script-src'], file
    assert any(t == 'meta' and a.get('name') == 'referrer' and a.get('content') == 'strict-origin-when-cross-origin' for t, a in page.tags), file
    first_script = next((i for i, (t, _) in enumerate(page.tags) if t == 'script'), len(page.tags))
    csp_index = next(i for i, (t, a) in enumerate(page.tags) if t == 'meta' and a.get('http-equiv', '').lower() == 'content-security-policy')
    assert csp_index < first_script, file
    for attrs, text in page.scripts:
        if 'src' in attrs:
            src = attrs['src']
            assert src.startswith('/') and not src.startswith('//'), (file, src)
            assert (ROOT / 'public' / src.split('?')[0].lstrip('/')).is_file(), (file, src)
        elif attrs.get('type', '').lower() not in ('application/json', 'application/ld+json'):
            digest = "'sha256-" + base64.b64encode(hashlib.sha256(text.encode()).digest()).decode() + "'"
            assert digest in policy['script-src'].split(), (file, digest)
    count += 1
assert count >= 100, count
config = (ROOT / '_config.yml').read_text()
assert not re.search(r'^admin:', config, re.M)
assert 'ip: 127.0.0.1' in config
assert not (ROOT / 'node_modules/hexo-admin').exists()
ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
sitemap = ET.parse(ROOT / 'public/baidusitemap.xml')
urls = [node.text for node in sitemap.findall('s:url/s:loc', ns)]
assert len(urls) >= 19 and all(url.startswith('https://leecdiang.com/') for url in urls), urls
print(f'Passed: {count} HTML pages, final script hashes and local assets, CSP placement, referrer policy, no admin, loopback preview, {len(urls)} Baidu sitemap URLs.')
