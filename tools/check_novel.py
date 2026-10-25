"""上架前檢查。用法：python tools/check_novel.py   （加 --self-test 驗證檢查本身會不會叫）

檢查：作品清單的圖片都在；每部作品集數連續；狀態只能是 ready／writing／planned；
規劃中以外的集數都有標題；標成 ready 的正文存在、不是空的、插圖都在、沒有亂碼；
公開目錄只准有 ep／era／status／file／title 五個欄位（擋住編輯摘要、內部備註被放上公開站）；
篇名與正文沒有舊人名（V44 已裁定改掉的寫法）。
"""
import json, os, re, sys, tempfile, shutil

OLD_NAMES = ['芬嵐', '仲誠', '淑棻', '博彥']
KEYS = {'ep', 'era', 'status', 'file', 'title', 'img', 'pics', 'audio', 'script'}   # script：1998 演出原稿 {top:[...], end:[...]}，讀完 scriptUnlock 那一集才顯示   # img：每集主圖，路徑相對於作品資料夾；audio：聲音檔名（不含副檔名）

def check(root):
    errs = []
    works = json.load(open(os.path.join(root, 'data', 'works.json'), encoding='utf-8'))['works']
    for w in works:
        base = os.path.join(root, 'works', w['id'])
        for p in [w['cover']] + w['hero']:
            if not os.path.exists(os.path.join(base, p)):
                errs.append('%s：圖片不存在 %s' % (w['id'], p))
        d = json.load(open(os.path.join(base, 'episodes.json'), encoding='utf-8'))
        eps = d['episodes']
        if set(d) != {'episodes'}:
            errs.append('%s：目錄只准有 episodes，多了 %s' % (w['id'], sorted(set(d) - {'episodes'})))
        if [e['ep'] for e in eps] != list(range(1, len(eps) + 1)):
            errs.append('%s：集數不連續' % w['id'])
        for e in eps:
            tag = '%s 第%d集' % (w['id'], e['ep'])
            if set(e) - KEYS:
                errs.append('%s：公開目錄出現不該有的欄位 %s' % (tag, sorted(set(e) - KEYS)))
            if e['status'] not in ('ready', 'writing', 'planned'):
                errs.append('%s：狀態只能是 ready／writing／planned，現在是 %s' % (tag, e['status']))
            if e.get('era') not in ('1998', '古代'):
                errs.append('%s：era 只能是 1998 或 古代' % tag)
            if e['status'] != 'planned' and not e.get('title'):
                errs.append('%s：沒有標題' % tag)
            for n in OLD_NAMES:
                if n in e.get('title', ''):
                    errs.append('%s：篇名有舊人名「%s」' % (tag, n))
            if e.get('audio') and not (w.get('audio') and re.match(r'^(https://|[\w-]+/)', w['audio']) and w['audio'].endswith('/')):
                errs.append('%s：有聲音檔，但作品清單沒有正確的聲音檔網址（https:// 開頭、/ 結尾）' % tag)
            if e.get('img') and not os.path.exists(os.path.join(base, e['img'])):
                errs.append('%s：主圖不存在 %s' % (tag, e['img']))
            for pos, L in (e.get('script') or {}).items():
                if pos not in ('top', 'end'):
                    errs.append('%s：原稿位置只能是 top 或 end，現在是 %s' % (tag, pos))
                for p in L:
                    if not os.path.exists(os.path.join(base, p)):
                        errs.append('%s：原稿圖片不存在 %s' % (tag, p))
            if e['status'] != 'ready':
                continue
            f = os.path.join(base, 'chapters', e['file'])
            if not os.path.exists(f):
                errs.append('%s：標成 ready 但找不到正文 %s' % (tag, e['file']))
                continue
            t = open(f, encoding='utf-8').read()
            for pc in e.get('pics', []):   # 正文插圖：圖要存在、要接在正文裡找得到的那段文字後面
                if not os.path.exists(os.path.join(base, pc.get('img', ''))):
                    errs.append('%s：插圖不存在 %s' % (tag, pc.get('img')))
                for line in pc.get('poem', []):   # 題畫詩每一句都要是正文裡的原句（不計標點）
                    if re.sub(r'[，。、！？…「」]', '', line) not in re.sub(r'[，。、！？…「」\s]', '', t):
                        errs.append('%s：插圖上的詩句在正文裡找不到「%s」' % (tag, line))
                if not pc.get('after'):
                    errs.append('%s：插圖沒有位置文字（after）' % tag)
                else:   # 網站是把圖接在「第一個」含這段文字的段落後面，所以要恰好一段，0 段是找不到，2 段以上會接錯地方
                    hits = sum(1 for para in re.split(r'\n\s*\n', t) if pc['after'] in para)
                    if hits == 0:
                        errs.append('%s：插圖的位置文字在正文裡找不到「%s」' % (tag, pc['after']))
                    elif hits > 1:
                        errs.append('%s：插圖的位置文字在正文裡出現 %d 段，圖會接到第一段後面：「%s」' % (tag, hits, pc['after']))
            if not t.strip():
                errs.append('%s：正文是空的' % tag)
            if '�' in t:
                errs.append('%s：正文有亂碼' % tag)
            for n in OLD_NAMES:
                if n in t:
                    errs.append('%s：正文有舊人名「%s」' % (tag, n))
            for img in re.findall(r'^!\[[^\]]*\]\(([^)\s]+)\)\s*$', t, re.M):
                if not os.path.exists(os.path.join(base, 'chapters', img)):
                    errs.append('%s：插圖不存在 %s' % (tag, img))
    return errs, works

def self_test(root):
    tmp = tempfile.mkdtemp()
    try:
        t = os.path.join(tmp, 'n')
        shutil.copytree(root, t, ignore=shutil.ignore_patterns('tools'))
        errs, _ = check(t)
        assert not errs, '正對照組（目前的網站）就有錯：%s' % errs
        p = os.path.join(t, 'works', 'liancheng', 'episodes.json')
        d = json.load(open(p, encoding='utf-8'))
        # 全部上架之後就沒有「撰寫中」的集數可借用，所以在暫存複本裡補四集假的來做壞案例
        for k in range(4):
            d['episodes'].append({'ep': 901 + k, 'era': '1998', 'status': 'writing', 'file': 'EP%03d.md' % (901 + k), 'title': '測試'})
        w = [i for i, e in enumerate(d['episodes']) if e['status'] == 'writing']
        assert len(w) >= 4, '撰寫中的集數不夠做自我測試'
        d['episodes'][w[0]]['status'] = 'ready'            # 壞案例一：ready 但沒有正文
        d['episodes'][w[1]]['title'] = '芬嵐的長笛'         # 壞案例二：舊人名
        d['episodes'][w[2]]['note'] = '內部摘要'            # 壞案例四：內部欄位跑進公開目錄
        d['episodes'][w[3]]['status'] = 'draft'            # 壞案例五：私人預覽的狀態跑進公開目錄
        d['episodes'][w[1]]['img'] = 'img/ep/不存在.jpg'     # 壞案例六：主圖不存在
        d['episodes'][w[2]]['audio'] = 'EP903'              # 壞案例八：有聲音檔，作品卻沒有聲音檔網址
        json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False)
        errs, _ = check(t)
        for k in ('找不到正文', '舊人名', '不該有的欄位', '狀態只能是', '主圖不存在', '聲音檔網址'):
            assert any(k in e for e in errs), (k, errs)
        open(os.path.join(t, 'works', 'liancheng', 'chapters', d['episodes'][w[0]]['file']), 'w', encoding='utf-8').write('正文。\n\n![圖](不存在.jpg)\n')
        errs, _ = check(t)                                 # 壞案例三：插圖不存在
        assert any('插圖不存在' in e for e in errs) and not any('找不到正文' in e for e in errs), errs
        open(os.path.join(t, 'works', 'liancheng', 'chapters', d['episodes'][w[0]]['file']), 'w', encoding='utf-8').write('一句話。\n\n另一段。\n\n一句話。\n')
        d['episodes'][w[0]]['pics'] = [{'after': '一句話。', 'img': 'img/pic/不存在.jpg'}]
        json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False)
        errs, _ = check(t)                                 # 壞案例九：錨點出現兩段，圖會接錯地方
        assert any('出現 2 段' in e for e in errs), errs
        d['episodes'][w[0]]['pics'] = [{'after': '不在正文的字。', 'img': 'img/pic/不存在.jpg'}]
        json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False)
        errs, _ = check(t)                                 # 壞案例十：錨點完全找不到，圖會消失
        assert any('找不到' in e and '不在正文的字' in e for e in errs), errs
        print('自我測試通過：正常的網站放行，新增的錨點壞案例（重複、找不到）也都有叫')
    finally:
        shutil.rmtree(tmp)

if __name__ == '__main__':
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if '--self-test' in sys.argv:
        self_test(root); sys.exit(0)
    errs, works = check(root)
    for e in errs:
        print('✗', e)
    print('檢查 %d 部作品：%s' % (len(works), '有 %d 個問題' % len(errs) if errs else '全部通過'))
    sys.exit(1 if errs else 0)
