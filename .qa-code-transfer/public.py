"""Probe the deployed custom domain. Write only short observations to the QA receipt."""
import html
import json
from pathlib import Path
import re
import sys
import time
import urllib.error
import urllib.request
from html.parser import HTMLParser

class Page(HTMLParser):
    def __init__(self,body):
        super().__init__()
        self.in_title=False; self.title=''; self.widgets=[]; self.canonical=''; self.hrefs=set(); self.formulas=0
        self.feed(body)
    def handle_starttag(self,t,attrs):
        a=dict(attrs)
        if t=='title':self.in_title=True
        if 'data-transfer-widget' in a:self.widgets.append(a['data-transfer-widget'])
        if t=='link' and a.get('rel')=='canonical':self.canonical=a['href']
        if t=='a' and a.get('href'):self.hrefs.add(a['href'])
        if t=='mjx-container':self.formulas+=1
    def handle_endtag(self,t):
        if t=='title':self.in_title=False
    def handle_data(self,data):
        if self.in_title:self.title+=data

def visit(path, marker):
    address='https://leecdiang.com'+path+'?verify='+marker
    request=urllib.request.Request(address, headers={'Cache-Control':'no-cache','User-Agent':'Beyond-the-Clock release verification'})
    with urllib.request.urlopen(request,timeout=20) as response:
        body=response.read().decode()
        print(f'{response.status} {path} | {Page(body).title} | {response.headers.get("date")}', flush=True)
    return Page(body)
article='/2026/11/27/code-training-and-reasoning/'
if len(sys.argv)>1:
    markers=json.loads(Path(sys.argv[1]).read_text())
    for i in range(24):
        try:
            marker=markers['pages_sha'][:12]+'-'+str(i)
            page=visit(article,marker)
            assert markers['title'] in page.title, page.title
            assert sorted(page.widgets)==['gradients','schedule','trace'] and page.formulas>0
            for path in ['/','/archives/']:
                assert article in visit(path,marker).hrefs,path
            print('Confirmed published article title, each interactive family, rendered formulas and both listing links.')
            break
        except (OSError,ValueError,AssertionError) as e:
            print(str(e),flush=True)
            if i==23:raise
            time.sleep(20)
else:
    for path in ['/','/archives/','/2026/11/25/rdma-four-operations/']:
        try:visit(path,str(time.time_ns()))
        except OSError as e:print(path,e,flush=True)
