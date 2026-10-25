#!/usr/bin/env python3
"""Fail-fast preflight for novel publishes.

Any failed check exits non-zero. Callers must stop before bumping SW or committing.
Usage: python3 tools/publish_guard.py [--root DIR] [--ep N]
"""
import argparse, json, os, subprocess, sys
from PIL import Image


def fail(msg):
    print('GUARD FAIL: ' + msg)
    sys.exit(1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', default='.')
    ap.add_argument('--ep', type=int, default=None, help='only check this episode (legacy issues elsewhere are not blocked)')
    args = ap.parse_args()
    root = os.path.abspath(args.root)
    lv = os.path.join(root, 'works', 'liancheng')

    # 1. JSON must parse
    try:
        with open(os.path.join(lv, 'episodes.json'), encoding='utf-8') as f:
            eps = json.load(f)['episodes']
    except Exception as ex:
        fail('episodes.json 無法解析: %s' % ex)

    # 2. every pics/img must exist; pics images must be 1280x720; anchors must appear exactly once
    for e in eps:
        if args.ep is not None and e['ep'] != args.ep:
            continue
        ch = os.path.join(lv, 'chapters', e['file'])
        text = open(ch, encoding='utf-8').read() if os.path.exists(ch) else None
        if e.get('img') and not os.path.exists(os.path.join(lv, e['img'])):
            fail('第%s集 img 不存在: %s' % (e['ep'], e['img']))
        for p in e.get('pics', []):
            path = os.path.join(lv, p['img'])
            if not os.path.exists(path):
                fail('第%s集 pics 圖檔不存在: %s' % (e['ep'], p['img']))
            size = Image.open(path).size
            if size != (1280, 720):
                fail('第%s集 圖檔尺寸不是 1280x720: %s %s' % (e['ep'], p['img'], size))
            if text is None:
                fail('第%s集 章節檔不存在: %s' % (e['ep'], e['file']))
            n = text.count(p['after'])
            if n != 1:
                fail('第%s集 錨點出現 %d 次（需要 1）: %s' % (e['ep'], n, p['after'][:20]))

    # 3. existing validator must pass
    validator = os.path.join(root, 'tools', 'check_novel.py')
    r = subprocess.run([sys.executable, validator], cwd=root, capture_output=True, text=True)
    if r.returncode != 0:
        fail('既有驗證器未通過:\n' + r.stdout + r.stderr)

    print('GUARD OK')


if __name__ == '__main__':
    main()
