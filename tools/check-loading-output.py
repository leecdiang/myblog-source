"""Validate static math and deliberate loading hints in the generated site."""
from pathlib import Path
from html.parser import HTMLParser
import re
ROOT=Path(__file__).resolve().parents[1]/'public'
class Tags(HTMLParser):
    def __init__(self,html):
        super().__init__();self.tags=[];self.feed(html)
    def handle_starttag(self,tag,attrs):self.tags.append((tag,dict(attrs)))
count=pages=0
for file in ROOT.rglob('*.html'):
    html=file.read_text()
    if 'data-static-math="true"' not in html:continue
    tags=Tags(html).tags
    expected=sum(int(a['data-math-prerendered']) for t,a in tags if 'data-math-prerendered' in a)
    containers=[a for t,a in tags if t=='mjx-container']
    assert len(containers)==expected,(file,expected,len(containers))
    assert sum(t=='math' for t,a in tags)==expected,file
    assert all('data-tex' in a for a in containers)
    assert not any(t=='mjx-merror' for t,a in tags)
    assert not any(t=='script' and '/third-party/math/mathjax.js' in a.get('src','') for t,a in tags)
    styles=[a for t,a in tags if t=='link' and 'data-static-math-style' in a]
    assert len(styles)==(1 if expected else 0)
    if expected:assert (ROOT/styles[0]['href'].lstrip('/')).is_file()
    count+=expected;pages+=1
assert pages>=8 and count>=150
model=Tags((ROOT/'2026/11/06/architecture-performance-equations/index.html').read_text()).tags
assert any(t=='details' and 'open' not in a for t,a in model)
asv=Tags((ROOT/'2026/10/14/agent-step-value/index.html').read_text()).tags
video=next(a for t,a in asv if t=='video')
assert video['preload']=='none' and video['width']=='967' and video['height']=='544' and 'controls' in video
home=Tags((ROOT/'index.html').read_text()).tags
assert any(t=='source' and 'home-portrait-mobile-' in a.get('srcset','') for t,a in home)
assert not any(t=='link' and a.get('rel')=='preload' and '/ambient/' in a.get('href','') for t,a in home)
style=next(a['href'] for t,a in home if t=='link' and 'data-studio-style' in a)
css=(ROOT/style.lstrip('/')).read_text()
assert '@view-transition' in css and 'prefers-reduced-motion' in css
print(f'Passed: {count} static expressions across {pages} pages, MathML/TeX, local math CSS, TOC, video and portrait hints, reduced-motion navigation.')
