"""Bundle app/ into one self-contained HTML file for browsers (Chrome 109 / Firefox 115 on Windows 7 also work)."""
import base64,re,sys,json,os
from html import escape
from pathlib import Path
A=str(Path(__file__).resolve().parent / 'app') + os.sep
def uri(p,mime):return f"data:{mime};base64,"+base64.b64encode(open(A+p,'rb').read()).decode()
html=open(A+'index.html',encoding='utf8').read()
# 与 index.html 的脚本顺序一致；新增模块在这里登记
SCRIPTS=['version.js','catalog.js','help.js','core.js','match-core.js','arcade-core.js','vendor/chess.js','vendor/xiangqi.js','board-core.js','battleship-core.js','board-session.js','rhythm-core.js','challenge-core.js','jump-core.js','pool-core.js','gate-core.js','study-core.js','study-math.js','roulette-core.js','doudizhu-core.js','doudizhu-net.js','pig-art.js','look.js','sounds.js','audio.js','match-ui.js','arcade.js','challenge.js','jump-ui.js','pool-ui.js','gate-ui.js','assets/katex/katex.min.js','assets/katex/mhchem.min.js','study-ui.js','board-ui.js','roulette-art.js','roulette-ui.js','doudizhu-art.js','doudizhu-finale.js','doudizhu-ui.js','app.js']
for n in SCRIPTS:assert f'<script src="{n}"></script>' in html, n+' 未在 index.html 中引用'
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
html=re.sub(r'<script src="version.js"></script>.*?<script src="app.js"></script>',lambda m:scripts,html,flags=re.S)
html=html.replace('assets/pig.svg',pig)
assert 'src="assets/' not in html and "href=\"assets/" not in html, 'unbundled asset left'
output = Path(sys.argv[1])
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(html, encoding='utf8', newline='\n')
print(output, len(html)//1024, 'KB')
