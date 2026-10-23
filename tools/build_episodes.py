"""從「創作劇情與網頁設計交接母檔」第 7 節的對照目錄，重建網站目錄 works/liancheng/episodes.json。

用法：python tools/build_episodes.py 交接母檔.md
- 只取「集數、標題、古代或 1998」三樣；交接檔裡的編輯摘要一律不進網站（避免劇透，也不能冒充正文）。
- 標成「規劃未寫」的集數狀態為 planned，網站只顯示集數與「規劃中」，不顯示標題。
- 已經改成 ready 的集數會保留，不會被重設。
注意：交接母檔本身含內部資料，不要放進這個公開儲存庫。
"""
import json, os, re, sys

def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    t = open(sys.argv[1], encoding='utf-8').read()
    rows = re.findall(r'^\| EP(\d{3}) \| ([^|]+?) \| ([^|]+?) \| ([^|]+?) \|\s*$', t, re.M)
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = os.path.join(here, 'works', 'liancheng', 'episodes.json')
    old = {}
    if os.path.exists(out):
        for e in json.load(open(out, encoding='utf-8'))['episodes']:
            old[e['ep']] = e
    eps = []
    for n, title, era, note in rows:
        n = int(n)
        planned = note.strip().startswith('規劃未寫')
        era = '古代' if era.strip().startswith('古代') else '1998'
        o = old.get(n, {})
        st = 'planned' if planned else (o.get('status') if o.get('status') == 'ready' else 'writing')
        e = {'ep': n, 'era': era, 'status': st, 'file': 'EP%03d.md' % n}
        if not planned:
            e['title'] = title.strip()
        eps.append(e)
    if not eps or [e['ep'] for e in eps] != list(range(1, len(eps) + 1)):
        sys.exit('集數不連續或沒讀到目錄，沒有寫入')
    json.dump({'episodes': eps}, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    c = lambda s: sum(1 for e in eps if e['status'] == s)
    print('寫入 %s：%d 集（已上架 %d、撰寫中 %d、規劃中 %d；1998 %d 集、古代 %d 集）' % (
        out, len(eps), c('ready'), c('writing'), c('planned'),
        sum(1 for e in eps if e['era'] == '1998'), sum(1 for e in eps if e['era'] == '古代')))

if __name__ == '__main__':
    main()
