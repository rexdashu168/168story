"""上架前檢查。用法：python tools/check_novel.py   （加 --self-test 驗證檢查本身會不會叫）

檢查：作品清單的圖片都在；每部作品集數連續、場次對得上；標成 ready 的集數正文存在且不是空的；
正文裡的插圖檔都在；篇名與正文沒有舊人名（V44 已裁定改掉的寫法）；沒有亂碼（U+FFFD）。
"""
import json, os, re, sys, tempfile, shutil

OLD_NAMES = ['芬嵐', '仲誠', '淑棻', '博彥']

def check(root):
    errs = []
    works = json.load(open(os.path.join(root, 'data', 'works.json'), encoding='utf-8'))['works']
    for w in works:
        base = os.path.join(root, 'works', w['id'])
        for p in [w['cover']] + w['hero']:
            if not os.path.exists(os.path.join(base, p)):
                errs.append('%s：圖片不存在 %s' % (w['id'], p))
        d = json.load(open(os.path.join(base, 'episodes.json'), encoding='utf-8'))
        eps, scenes = d['episodes'], {s['scene'] for s in d['scenes']}
        if [e['ep'] for e in eps] != list(range(1, len(eps) + 1)):
            errs.append('%s：集數不連續' % w['id'])
        for e in eps:
            tag = '%s 第%d集' % (w['id'], e['ep'])
            if e['scene'] not in scenes:
                errs.append('%s：場次 %s 不在場次清單' % (tag, e['scene']))
            if e['status'] not in ('ready', 'writing'):
                errs.append('%s：狀態只能是 ready 或 writing，現在是 %s' % (tag, e['status']))
            for n in OLD_NAMES:
                if n in e['title']:
                    errs.append('%s：篇名有舊人名「%s」' % (tag, n))
            if e['status'] != 'ready':
                continue
            f = os.path.join(base, 'chapters', e['file'])
            if not os.path.exists(f):
                errs.append('%s：標成 ready 但找不到正文 %s' % (tag, e['file']))
                continue
            t = open(f, encoding='utf-8').read()
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
        d['episodes'][0]['status'] = 'ready'              # 壞案例一：ready 但沒有正文
        d['episodes'][1]['title'] = '芬嵐的長笛'            # 壞案例二：舊人名
        json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False)
        errs, _ = check(t)
        assert any('找不到正文' in e for e in errs) and any('舊人名' in e for e in errs), errs
        open(os.path.join(t, 'works', 'liancheng', 'chapters', d['episodes'][0]['file']), 'w', encoding='utf-8').write('正文。\n\n![圖](不存在.jpg)\n')
        errs, _ = check(t)                                 # 壞案例三：插圖不存在
        assert any('插圖不存在' in e for e in errs) and not any('找不到正文' in e for e in errs), errs
        print('自我測試通過：正常的網站放行，三種壞案例都有叫')
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
