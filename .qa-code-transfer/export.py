"""Capture tested routes plus their static dependencies. Keep the live site's prior files."""
from base64 import b64encode
from hashlib import sha1
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import unquote, urljoin, urlparse

public, deployed = Path('public'), Path('../deployed')
out = Path('../receipts')
target = '2026/11/27/code-training-and-reasoning/'
slug = 'code-training-and-reasoning'
base_url = 'https://leecdiang.com/'
selected = {}
reasons = {}
def keep(rel, why):
    rel = rel.lstrip('/')
    f = public / rel
    if not f.is_file() or '..' in Path(rel).parts: return
    content = f.read_bytes()
    if (deployed / rel).is_file() and (deployed / rel).read_bytes() == content: return
    selected[rel] = content
    reasons.setdefault(rel, why)

class Links(HTMLParser):
    def __init__(self, content):
        super().__init__()
        self.refs = set()
        self.post_links=[]
        self.feed(content)
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if tag=='a':
            href=a.get('href') or ''
            if re.match(r'/20[0-9]{2}/[0-9]{2}/[0-9]{2}/[^/]+/$', href):
                self.post_links.append(href)
        for att in ['src','poster','data-src']:
            if a.get(att):self.refs.add(a[att])
        if tag=='link' and a.get('href'):self.refs.add(a['href'])
        if tag=='meta' and a.get('property',a.get('name','')) in ['og:image','twitter:image'] and a.get('content'):self.refs.add(a['content'])
        if a.get('srcset'):
            self.refs.update(s.split()[0] for s in a['srcset'].split(',') if s.strip())

relevant_taxonomies=set()
for f in public.rglob('index.html'):
    rel=f.relative_to(public).as_posix()
    group=re.match(r'^((?:categories|tags)/[^/]+)/',rel)
    if group and '/'+target in f.read_text():
        relevant_taxonomies.add(group[1]+'/')

for f in sorted(public.rglob('*')):
    if not f.is_file():continue
    rel = f.relative_to(public).as_posix()
    if rel.startswith(target) or rel in ['atom.xml','sitemap.xml','baidusitemap.xml','tags/index.html','categories/index.html']:
        keep(rel,'article, feed or taxonomy index')
        continue
    if f.suffix!='.html':continue
    raw = f.read_text()
    if '/'+target in raw:
        keep(rel,'page directly references the new article')
    elif re.match(r'^(archives|page)/',rel) or any(rel.startswith(prefix) for prefix in relevant_taxonomies):
        old=deployed/rel
        before=Links(old.read_text()).post_links if old.is_file() else []
        after=Links(raw).post_links
        if before!=after: keep(rel,'the list of article links changed')

for rel in list(selected):
    if not rel.endswith('.html'):continue
    for href in Links(selected[rel].decode()).refs:
        resolved=urlparse(urljoin(base_url+rel,href))
        if resolved.netloc!='leecdiang.com':continue
        asset=unquote(resolved.path).lstrip('/')
        if not asset or asset.endswith('/') or asset.endswith('.html'):continue
        if not (deployed/asset).is_file():keep(asset,'asset used by a release page')
assert target+'index.html' in selected, sorted(selected)
assert not any('/.git' in k or k.startswith('.') or k.endswith(('.bak','.tmp')) for k in selected)
# New isolated article resources are always from the tested build, including revisions to existing assets.
for rel in list(selected):
    assert selected[rel] == (public/rel).read_bytes()
chunks=out/'chunks'
chunks.mkdir(exist_ok=True)
manifest=[]
for rel, buf in sorted(selected.items()):
    oid=sha1(b'blob '+str(len(buf)).encode()+b'\0'+buf).hexdigest()
    encoded=b64encode(buf).decode()
    parts=[]
    for n,start in enumerate(range(0,len(encoded),48000)):
        name=oid+'-'+str(n)+'.b64'
        (chunks/name).write_text(encoded[start:start+48000])
        parts.append(name)
    manifest.append({'path':rel,'blob':oid,'bytes':len(buf),'reason':reasons[rel],'parts':parts})
(out/'release.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=1))
print(json.dumps([(x['path'],x['bytes']) for x in manifest],ensure_ascii=False,indent=1))
