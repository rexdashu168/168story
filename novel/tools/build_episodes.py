"""從寫作總綱 Excel 重建某部作品的目錄 episodes.json。

用法：python tools/build_episodes.py 總綱.xlsx [作品id=liancheng] [工作表=181V42一零八逐篇]
- 只更新集數、場次、篇名；已經改成 ready 的集數與檔名會保留，不會被重設成撰寫中。
- 人名依 V44 正式裁定校訂。
"""
import json, os, re, sys
import openpyxl

FIX = {'芬嵐': '芬蘭', '仲誠': '仲承', '淑棻': '淑芬', '博彥': '伯彥'}   # V44 正式裁定

def fix(s):
    for a, b in FIX.items():
        s = s.replace(a, b)
    return s

def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    xlsx = sys.argv[1]
    wid = sys.argv[2] if len(sys.argv) > 2 else 'liancheng'
    sheet = sys.argv[3] if len(sys.argv) > 3 else '181V42一零八逐篇'
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = os.path.join(here, 'works', wid, 'episodes.json')
    old = {}
    if os.path.exists(out):
        for e in json.load(open(out, encoding='utf-8'))['episodes']:
            old[e['ep']] = e
    wb = openpyxl.load_workbook(xlsx, read_only=True, data_only=True)
    rows = [r for r in wb[sheet].iter_rows(values_only=True) if r[0] and re.match(r'EP\d{3}$', str(r[0]))]
    eps, scenes = [], []
    for r in rows:
        n, sc = int(str(r[0])[2:]), int(r[1])
        title = fix(str(r[3]).strip().strip('【】'))
        o = old.get(n, {})
        eps.append({'ep': n, 'scene': sc, 'title': title,
                    'status': o.get('status', 'writing'), 'file': o.get('file', 'EP%03d.md' % n)})
        if not scenes or scenes[-1]['scene'] != sc:
            scenes.append({'scene': sc, 'name': fix(str(r[2]).strip())})
    if [e['ep'] for e in eps] != list(range(1, len(eps) + 1)):
        sys.exit('集數不連續，沒有寫入')
    changed = sum(1 for e in eps if old.get(e['ep'], {}).get('title') != e['title'])
    json.dump({'scenes': scenes, 'episodes': eps}, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('寫入 %s：%d 集、%d 場，篇名有變動 %d 集，已上架 %d 集' % (out, len(eps), len(scenes), changed,
          sum(1 for e in eps if e['status'] == 'ready')))

if __name__ == '__main__':
    main()
