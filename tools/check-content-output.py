"""Check generated output after `hexo generate`; uses the Python standard library."""
from html.parser import HTMLParser
from pathlib import Path
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1] / 'public'
class Tags(HTMLParser):
    def __init__(self, content):
        super().__init__(); self.tags=[]; self.feed(content)
    def handle_starttag(self, name, attributes):
        self.tags.append((name, dict(attributes)))
    def find(self, tag_name, **attributes):
        return [a for tag,a in self.tags if tag==tag_name and all(a.get(k)==v for k,v in attributes.items())]

atom={'a':'http://www.w3.org/2005/Atom'}
entries=ET.parse(ROOT/'atom.xml').findall('a:entry',atom)
assert len(entries)==20
for entry in entries:
    content=entry.find('a:content',atom)
    assert content.get('type')=='html'
    html=content.text or ''
    tags=Tags(html)
    assert not any(tags.find(t) for t in ['script','style','button','input','select'])
    for a in tags.find('img'):
        assert a['src'].startswith('https://leecdiang.com/') or a['src'].startswith('https://')
    assert '<p>' in html

model=(ROOT/'2026/11/06/architecture-performance-equations/index.html').read_text()
assert 'I^{<em>' not in model and ',; I' not in model
assert model.count('I_{\\mathrm{ridge}}')==3
assert re.findall(r'INTERACTIVE MODEL · (\d+)',model)==['01','02','03','04','05']
assert 'm_{L2}' in model and '局部缺失率' in model

photo=(ROOT/'2026/06/06/eight-thousand-miles/index.html').read_text()
images=Tags(photo).find('img')
images=[a for a in images if 'assets/photos/' in a.get('srcset','')]
assert len(images)==43
for a in images:
    assert all(a.get(k) for k in ['src','width','height','alt','srcset','sizes'])
    assert not a.get('data-src')
    assert int(a['width'])>0 and int(a['height'])>0
assert len(Tags(photo).find('a',**{'class':'photo-original'}))==43

for path,language in [('2026/11/04/why-x86-is-a-mess','zh-CN'),('2026/10/14/agent-step-value','en')]:
    tags=Tags((ROOT/path/'index.html').read_text())
    assert tags.find('article',**{'class':'post-content'})[0]['lang']==language
for path in ['architecture-performance-equations','why-x86-is-a-mess','gemm-languages-to-architecture','flow-control-from-pfc-to-backpressure']:
    day={'architecture-performance-equations':'06','why-x86-is-a-mess':'04','gemm-languages-to-architecture':'03','flow-control-from-pfc-to-backpressure':'05'}[path]
    tags=Tags((ROOT/'2026/11'/day/path/'index.html').read_text())
    cover=tags.find('meta',property='og:image')
    assert len(cover)==1 and cover[0]['content'].startswith('https://leecdiang.com/images/social/')
    assert (ROOT/cover[0]['content'].split('leecdiang.com/')[1]).is_file()
    for prop in ['datePublished','dateModified','image']:
        assert tags.find('meta',itemprop=prop)
    assert tags.find('link',itemprop='url')[0]['href']=='https://leecdiang.com/about/'
    assert tags.find('meta',**{'name':'twitter:card'})[0]['content']=='summary_large_image'

sitemap={'s':'http://www.sitemaps.org/schemas/sitemap/0.9'}
urls=[u.text for u in ET.parse(ROOT/'sitemap.xml').findall('s:url/s:loc',sitemap)]
for page in ['about','archives','photography','links','categories']:
    assert 'https://leecdiang.com/'+page+'/' in urls
assert not any('reproduce' in u or '404.html' in u or '?' in u for u in urls)
assert (ROOT/'404.html').is_file()
print(f'Passed: {len(entries)} Atom entries, 43 photography images, formulas, language, four article covers and microdata, sitemap, 404.')
