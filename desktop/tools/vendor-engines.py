"""Rebuild pinned, offline engine packs. No npm install scripts are executed.

The engines run as independent GPL programs in Workers, using text protocols
or their documented C API. Retain all engine licenses and corresponding sources.
"""
from pathlib import Path
import argparse, base64, hashlib, json, re, urllib.request, zipfile

ROOT=Path(__file__).resolve().parents[1]
UPSTREAMS=json.loads((Path(__file__).with_name('engine-upstreams.json')).read_text(encoding='utf-8'))
CATALOG={
 'stockfish':{'game':'chess','name':'Stockfish 19 Lite','version':'19.0.1','source':'https://github.com/nmrugg/stockfish.js/tree/v19.0.1','license':'GPL-3.0'},
 'pikafish':{'game':'xiangqi','name':'皮卡鱼 Pikafish','version':'2023-03-05 (single-thread SIMD128 NNUE)','source':'https://github.com/ousc/Pikafish-wasm/tree/Pikafish-2023-03-05','buildSource':'https://github.com/ousc/Pikafish-wasm/releases/tag/Pikafish-2023-03-05','license':'GPL-3.0'},
 'rapfi':{'game':'gomoku','name':'Rapfi NNUE','version':'0.43.02 (freestyle NNUE)','source':'https://github.com/dotb1ue/rapfi/tree/3aedf3a','buildSource':'https://github.com/CyanXLab/GomokuAI/tree/822be514c7fa563ed2a735628cb60868b913c792/public/build','license':'GPL-3.0; network CC0-1.0'},
 'egaroucid':{'game':'reversi','name':'Egaroucid for Web','version':'web build 67aa89f','source':'https://github.com/Nyanyan/Egaroucid/tree/67aa89f18bfd22fa35730cdc0a9f4e7501c2239a/src/web','license':'GPL-3.0'},
}
def compact_rapfi(source,data):
    # Recent browsers expose resizable WASM buffers; TextDecoder requires a
    # fixed-length view. Copy only the short UTF-8 string being decoded.
    source,n=re.subn(r'Sa\.decode\(a\.subarray\(b,c\)\)', 'Sa.decode(a.slice(b,c))',source)
    assert n==1
    # This game uses freestyle Gomoku. Keep its unmodified NNUE and classical
    # fallbacks; omit the unrelated Renju and standard-rule neural networks.
    entries=re.findall(r'filename:"([^"]+)",\s*start:(\d+),\s*end:(\d+)',source)
    assert len(entries)==9
    keep=[];pieces=[];offset=0
    for name,start,end in entries:
        if 'renju_' in name or 'standard_' in name:continue
        part=data[int(start):int(end)]
        keep.append({'filename':name,'start':offset,'end':offset+len(part)})
        pieces.append(part);offset+=len(part)
    replacement='('+json.dumps({'files':keep,'remote_package_size':offset},separators=(',',':'))+')'
    source,n=re.subn(r'\(\{files:\[.*?\],remote_package_size:\d+\}\)',lambda _:replacement,source,flags=re.S)
    assert n==1 and 10000000<offset<12000000
    return source,b''.join(pieces)
def build(cache):
    for entry in UPSTREAMS:
        file=cache/entry['path']
        if not file.is_file():
            file.parent.mkdir(parents=True,exist_ok=True)
            if entry.get('archiveMember'):
                archive=cache/(entry['archiveSHA256']+'.zip')
                if not archive.is_file():
                    with urllib.request.urlopen(urllib.request.Request(entry['url'],headers={'User-Agent':'PiggyPlayground-engine-build'}),timeout=120) as r:archive.write_bytes(r.read())
                assert hashlib.sha256(archive.read_bytes()).hexdigest()==entry['archiveSHA256']
                with zipfile.ZipFile(archive) as z:file.write_bytes(z.read(entry['archiveMember']))
            else:
                with urllib.request.urlopen(urllib.request.Request(entry['url'],headers={'User-Agent':'PiggyPlayground-engine-build'}),timeout=120) as r:file.write_bytes(r.read())
        actual=hashlib.sha256(file.read_bytes()).hexdigest()
        assert actual==entry['sha256'],f"Upstream checksum mismatch: {entry['path']}"
    app=ROOT/'app';destination=app/'assets/engines';licenses=app/'assets/licenses'
    metadata={}
    for engine,info in CATALOG.items():
        base=cache/engine;out=destination/engine;out.mkdir(parents=True,exist_ok=True)
        source=(base/(engine+'.js')).read_text(encoding='utf-8')
        wasm=(base/(engine+'.wasm')).read_bytes()
        data=(base/(engine+'.data')).read_bytes() if (base/(engine+'.data')).is_file() else b''
        if engine=='rapfi':source,data=compact_rapfi(source,data)
        payload=json.dumps({'id':engine,'source':source,'wasm':base64.b64encode(wasm).decode(),'data':base64.b64encode(data).decode()},separators=(',',':'),ensure_ascii=True)
        # Small source files also fit the connected GitHub upload transport.
        chunk_size=1024*1024
        chunks=[payload[i:i+chunk_size] for i in range(0,len(payload),chunk_size)]
        paths=[]
        for i,chunk in enumerate(chunks):
            rel=f'assets/engines/{engine}/part-{i}.js';paths.append(rel)
            text='(function(r){var p=r.PIG_ENGINE_PARTS||(r.PIG_ENGINE_PARTS={});(p['+json.dumps(engine)+']||(p['+json.dumps(engine)+']=[]))['+str(i)+']=/*PIG_ENGINE_PART*/'+json.dumps(chunk)+'/*END_PART*/;})(globalThis);\n'
            assert len(text.encode())<12*1024*1024
            (app/rel).write_text(text,encoding='utf-8',newline='\n')
        metadata[engine]={**info,'parts':paths,'wasmBytes':len(wasm),'dataBytes':len(data),'wasmSHA256':hashlib.sha256(wasm).hexdigest(),'dataSHA256':hashlib.sha256(data).hexdigest() if data else None}
        (licenses/(engine+'-GPL-3.0.txt')).write_bytes((base/'LICENSE').read_bytes())
        if engine=='rapfi':(licenses/'rapfi-networks-CC0-1.0.txt').write_bytes((base/'NETWORK-LICENSE').read_bytes())
        print(engine,len(chunks),'parts',len(wasm),'wasm bytes',len(data),'data bytes',flush=True)
    (destination/'catalog.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    license_text={'GPL-3.0':(cache/'stockfish/LICENSE').read_text(encoding='utf-8'),'CC0-1.0':(cache/'rapfi/NETWORK-LICENSE').read_text(encoding='utf-8')}
    (app/'engine-catalog.js').write_text('/* Independent upstream engine programs; licenses in assets/licenses. */\nglobalThis.PIG_ENGINE_CATALOG='+json.dumps(metadata,ensure_ascii=False,separators=(',',':'))+';\nglobalThis.PIG_ENGINE_LICENSE_TEXT='+json.dumps(license_text,ensure_ascii=True,separators=(',',':'))+';\n',encoding='utf-8',newline='\n')
    size=sum(p.stat().st_size for p in app.rglob('*') if p.is_file())
    assert size<=60*1024*1024,'Existing content updater has a 60 MiB total limit'
    print('app total:',size,'bytes')
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--cache',type=Path,default=ROOT/'build/engine-upstreams');args=parser.parse_args();build(args.cache)
