"""Bundle app/ into one self-contained HTML file for browsers (Chrome 109 / Firefox 115 on Windows 7 also work)."""
import base64,re,sys,json,os
from html import escape
from pathlib import Path
A=str(Path(__file__).resolve().parent / 'app') + os.sep
def uri(p,mime):return f"data:{mime};base64,"+base64.b64encode(open(A+p,'rb').read()).decode()
html=open(A+'index.html',encoding='utf8').read()
# 与 index.html 的脚本顺序一致；新增模块在这里登记
SCRIPTS=['core.js','match-core.js','arcade-core.js','challenge-core.js','roulette-core.js','pig-art.js','look.js','sounds.js','audio.js','match-ui.js','arcade.js','challenge.js','roulette-art.js','roulette-ui.js','app.js']
for n in SCRIPTS:assert f'<script src="{n}"></script>' in html, n+' 未在 index.html 中引用'
html=re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>','',html)
license_details='<details class="github-licenses"><summary>GitHub 参考项目 MIT 许可证（4.1 起）</summary>'
for f in sorted(os.listdir(A+'assets/licenses')):
    if f.endswith('-MIT.txt'):
        name=f[:-8].replace('_','/',1)
        license_details+='<h4>'+escape(name)+'</h4><pre>'+escape(open(A+'assets/licenses/'+f,encoding='utf8').read())+'</pre>'
license_details+='</details>'
assert html.count('<pre id="license"></pre>')==1
html=html.replace('<pre id="license"></pre>','<pre id="license"></pre>'+license_details)
pig=uri('assets/pig.svg','image/svg+xml')
cards={f[:-4]:uri('assets/cards/'+f,'image/svg+xml') for f in sorted(os.listdir(A+'assets/cards')) if f.endswith('.svg')}
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+open(A+'style.css',encoding='utf8').read()+'</style>')
html=html.replace('href="assets/pig.png"','href="'+uri('assets/pig.png','image/png')+'"')
for k,v in cards.items():html=html.replace(f'src="assets/cards/{k}.svg"',f'src="{v}"')
def js(n):
    s=open(A+n,encoding='utf8').read().replace('assets/pig.svg',pig)
    return '<script>'+s.replace('</script','<\\/script')+'</script>'
skins={f[:-4]:uri('assets/skins/'+f,'image/svg+xml') for f in sorted(os.listdir(A+'assets/skins')) if f.endswith('.svg')}
match_art={f[:-4]:uri('assets/match/'+f,'image/svg+xml') for f in sorted(os.listdir(A+'assets/match')) if f.endswith('.svg')}
scripts='<script>window.PIG_MATCH_URI='+json.dumps(match_art)+';window.CARD_URI='+json.dumps(cards)+';window.PIG_SKIN_URI='+json.dumps(skins)+';</script>'+''.join(js(n) for n in SCRIPTS)
html=re.sub(r'<script src="core.js"></script>.*?<script src="app.js"></script>',lambda m:scripts,html,flags=re.S)
html=html.replace('assets/pig.svg',pig)
assert 'src="assets/' not in html and "href=\"assets/" not in html, 'unbundled asset left'
output = Path(sys.argv[1])
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(html, encoding='utf8', newline='\n')
print(output, len(html)//1024, 'KB')
