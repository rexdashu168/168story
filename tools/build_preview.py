"""把整個網站打包成一個 html 檔（資料、圖片、正文全部內嵌），可以直接傳給別人用手機打開預覽。

用法：python tools/build_preview.py 輸出檔.html
"""
import base64, json, os, sys

def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    rd = lambda p: open(os.path.join(root, p), encoding='utf-8').read()
    pre = {'json': {}, 'text': {}, 'img': {}}
    def img(p):
        ext = p.rsplit('.', 1)[-1].lower()
        mime = 'image/png' if ext == 'png' else 'image/jpeg'
        pre['img'][p] = 'data:%s;base64,%s' % (mime, base64.b64encode(open(os.path.join(root, p), 'rb').read()).decode())
    site = json.loads(rd('data/works.json')); pre['json']['data/works.json'] = site
    for w in site['works']:
        b = 'works/%s/' % w['id']
        for p in [w['cover']] + w['hero']:
            img(b + p)
        d = json.loads(rd(b + 'episodes.json')); pre['json'][b + 'episodes.json'] = d
        for e in d['episodes']:
            if e['status'] == 'ready':
                t = rd(b + 'chapters/' + e['file']); pre['text'][b + 'chapters/' + e['file']] = t
                import re
                for m in re.findall(r'^!\[[^\]]*\]\(([^)\s]+)\)\s*$', t, re.M):
                    img(b + 'chapters/' + m)
    html = rd('index.html')
    html = html.replace('<link rel="stylesheet" href="app.css?v=2">', '<style>' + rd('app.css') + '</style>')
    html = html.replace('<script src="app.js?v=2"></script>',
        '<script>window.__PRE=' + json.dumps(pre, ensure_ascii=False) + ';</script>\n<script>' + rd('app.js') + '</script>')
    assert '__PRE' in html and '<style>' in html, 'index.html 的引用改了，打包沒有成功'
    open(sys.argv[1], 'w', encoding='utf-8').write(html)
    print('已輸出 %s（%.1f MB）' % (sys.argv[1], os.path.getsize(sys.argv[1]) / 1e6))

if __name__ == '__main__':
    main()
