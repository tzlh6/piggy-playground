"""Bundle app/ into one self-contained HTML file for browsers (Chrome 109 / Firefox 115 on Windows 7 also work)."""
import argparse,base64,re,json,os
from html import escape
from pathlib import Path
A=str(Path(__file__).resolve().parent / 'app') + os.sep
parser=argparse.ArgumentParser()
parser.add_argument('output',type=Path)
parser.add_argument('--external-engines',action='store_true',help='Leave chess engine packs in separate files for the Android asset loader')
args=parser.parse_args()
def uri(p,mime):return f"data:{mime};base64,"+base64.b64encode(open(A+p,'rb').read()).decode()
html=open(A+'index.html',encoding='utf8').read()
# Keep one script order across source, offline web and Android.
script_tag = r'<script src="([^"]+)"></script>'
SCRIPTS = re.findall(script_tag, html)
assert SCRIPTS[0] == 'version.js' and SCRIPTS[-1] == 'app.js'
html=re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>','',html)
license_details='<details class="github-licenses"><summary>GitHub 参考项目许可证（MIT / BSD-2-Clause）</summary>'
for f in sorted(os.listdir(A+'assets/licenses')):
    if f.endswith(('-MIT.txt','-BSD-2-Clause.txt')):
        name=re.sub(r'-(MIT|BSD-2-Clause)\.txt$', '', f).replace('_','/',1)
        license_details+='<h4>'+escape(name)+'</h4><pre>'+escape(open(A+'assets/licenses/'+f,encoding='utf8').read())+'</pre>'
license_details+='</details>'
assert html.count('<pre id="license"></pre>')==1
html=html.replace('<pre id="license"></pre>','<pre id="license"></pre>'+license_details)
pig=uri('assets/pig.svg','image/svg+xml')
cards={f[:-4]:uri('assets/cards/'+f,'image/svg+xml') for f in sorted(os.listdir(A+'assets/cards')) if f.endswith('.svg')}
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+open(A+'style.css',encoding='utf8').read()+'</style>')
# KaTeX（猪猪爱学习的公式）：样式内联，只保留 woff2 字体并转成 data URI
katex_css=open(A+'assets/katex/katex.min.css',encoding='utf8').read()
def katex_font(m):
    return 'src:url('+uri('assets/katex/fonts/'+m.group(1)+'.woff2','font/woff2')+') format("woff2")'
katex_css,n=re.subn(r'src:url\(fonts/([\w-]+)\.woff2\) format\("woff2"\)(?:,url\([^)]*\) format\("[^"]*"\))*',katex_font,katex_css)
assert n>=15 and 'url(fonts/' not in katex_css, 'KaTeX 字体未全部内联'
assert html.count('<link rel="stylesheet" href="assets/katex/katex.min.css">')==1
html=html.replace('<link rel="stylesheet" href="assets/katex/katex.min.css">','<style>'+katex_css+'</style>')
html=html.replace('href="assets/pig.png"','href="'+uri('assets/pig.png','image/png')+'"')
for k,v in cards.items():html=html.replace(f'src="assets/cards/{k}.svg"',f'src="{v}"')
def js(n):
    s=open(A+n,encoding='utf8').read().replace('assets/pig.svg',pig)
    return '<script>'+s.replace('</script','<\\/script')+'</script>'
skins={f[:-4]:uri('assets/skins/'+f,'image/svg+xml') for f in sorted(os.listdir(A+'assets/skins')) if f.endswith('.svg')}
match_art={f[:-4]:uri('assets/match/'+f,'image/svg+xml') for f in sorted(os.listdir(A+'assets/match')) if f.endswith('.svg')}
scripts='<script>window.PIG_MATCH_URI='+json.dumps(match_art)+';window.CARD_URI='+json.dumps(cards)+';window.PIG_SKIN_URI='+json.dumps(skins)+';</script>'+''.join(js(n) for n in SCRIPTS)
# Embed the optional background AI in the offline edition as well.
worker_modules=['vendor/chess.js','vendor/xiangqi.js','board-core.js','battleship-core.js','board-session.js']
worker_source='\n'.join(open(A+n,encoding='utf8').read() for n in worker_modules)
worker_source+='\n'+re.sub(r"importScripts\([^;]+;",'',open(A+'board-worker.js',encoding='utf8').read())
scripts='<script>window.PIG_BOARD_WORKER_SOURCE='+json.dumps(worker_source,ensure_ascii=False).replace('</script','<\\/script')+';</script>'+scripts
# Independent engines remain entirely offline, including WASM and neural nets.
# Non-executable JSON nodes avoid initializing or parsing unused engines at boot.
engine_nodes=[]
engine_catalog=Path(A+'assets/engines/catalog.json')
if engine_catalog.is_file() and not args.external_engines:
    for engine,info in json.loads(engine_catalog.read_text(encoding='utf-8')).items():
        parts=[]
        for part in info['parts']:
            source=Path(A+part).read_text(encoding='utf-8')
            chunk=source.split('/*PIG_ENGINE_PART*/',1)[1].split('/*END_PART*/',1)[0]
            parts.append(json.loads(chunk))
        payload=''.join(parts)
        assert json.loads(payload)['id']==engine
        engine_nodes.append('<script type="application/json" id="pig-engine-'+engine+'">'+payload.replace('</script','<\\/script')+'</script>')
scripts=''.join(engine_nodes)+scripts
html,count=re.subn(r'(?:'+script_tag+r'\s*)+',lambda m:scripts,html)
assert count == 1, 'Expected a single block of external app scripts'
html=html.replace('assets/pig.svg',pig)
assert 'src="assets/' not in html and "href=\"assets/" not in html, 'unbundled asset left'
output = args.output
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(html, encoding='utf8', newline='\n')
print(output, len(html)//1024, 'KB')
