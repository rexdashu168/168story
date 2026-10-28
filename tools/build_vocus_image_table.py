#!/usr/bin/env python3
"""產生「方格子插圖對照表」xlsx：每張已上架的圖（封面／內頁）對應哪一集、放在正文哪一段之後。
用法：python tools/build_vocus_image_table.py 輸出.xlsx
資料來源只有 works/liancheng/episodes.json 與 chapters/，所以圖一上架、重跑一次就更新。"""
import json, os, re, sys
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill
from openpyxl.utils import get_column_letter

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = os.path.join(root, 'works', 'liancheng')
out = sys.argv[1] if len(sys.argv) > 1 else '連城_方格子插圖對照表.xlsx'
d = json.load(open(os.path.join(W, 'episodes.json'), encoding='utf-8'))
works = json.load(open(os.path.join(root, 'data', 'works.json'), encoding='utf-8'))['works'][0]
SWAP = {23, 24, 25}   # 這三集檔名寫「封面」的圖和篇名不符，網站改放內頁

def jpg(rel):
    j = re.sub(r'\.webp$', '.jpg', rel)
    return j if os.path.exists(os.path.join(W, j)) else rel

def paras(ep):
    t = open(os.path.join(W, 'chapters', ep['file']), encoding='utf-8').read().replace('\r\n', '\n')
    return [x.strip() for x in re.split(r'\n\s*\n', t) if x.strip()]

def pname(p):
    b = re.sub(r'\.(webp|jpg)$', '', os.path.basename(p)); b = re.sub(r'_?20\d{6}[a-z]?$', '', b); b = re.sub(r'^EP\d{3}_?', '', b)
    parts = [x for x in b.split('_') if x and not re.fullmatch(r'v\d+|\d+|主圖|封面|重畫\d*', x)]
    return '、'.join(parts)

rows = []; last_ep = 0
for e in d['episodes']:
    if e['status'] != 'ready': continue
    ps = paras(e); items = []
    if e.get('img'): items.append(('封面', e['img'], None, None, ''))
    pics = sorted(((next((i for i, x in enumerate(ps) if p['after'] in x), 9999), p) for p in e.get('pics', [])), key=lambda t: t[0])
    for k, (idx, p) in enumerate(pics, 1):
        note = []
        if '宮格' in p['img']: note.append('這張是宮格（多格）圖，放進方格子前建議先確認版面')
        if p.get('poem'): note.append('網站在圖上疊了詩句、圖本身無字；詩句：' + '／'.join(p['poem']))
        items.append(('內頁%d' % k, p['img'], p['after'], idx, '；'.join(note)))
    if items: last_ep = max(last_ep, e['ep'])
    for typ, img, after, idx, note in items:
        if e['ep'] in SWAP and (typ == '封面' or '封面' in os.path.basename(img)):
            note = (note + '；' if note else '') + '檔名與位置對調：檔名寫「封面」的那張和篇名不符，網站改放內頁；封面用的是檔名寫劇情名的那張。以「類型」欄為準，不要靠檔名判斷。'
        if typ == '封面':
            pos, aft, ordn, para = '放在文章最上方（標題之後、正文之前）', '', '', ''
        else:
            pos, aft = '接在含這句話的那一段之後', after
            ordn = idx + 1 if idx < 9999 else '找不到'; para = ps[idx] if idx < 9999 else ''
        rows.append([e['ep'], e['era'], e['title'], typ, pname(img) or '（圖名未標，請看接點句與該段原文）', pos, aft, ordn, para, jpg(img), note])
    for sc in (e.get('script') or {}).get('end', []):
        rows.append([e['ep'], e['era'], e['title'], '文末附圖', '1998 演出原稿（劇本稿影像）', '放在這集正文全部結束之後', '', '', '', sc, '原稿影像，不是 AI 生成圖'])

wb = Workbook(); hf = PatternFill('solid', fgColor='2F2A27'); cov = PatternFill('solid', fgColor='F3E7CF')
def head(ws):
    for c in ws[1]: c.font = Font(bold=True, color='FFFFFF'); c.fill = hf; c.alignment = Alignment(vertical='center', wrap_text=True)
def widths(ws, ws_):
    for i, w in enumerate(ws_, 1): ws.column_dimensions[get_column_letter(i)].width = w
ws = wb.active; ws.title = '圖片清單'
ws.append(['集數', '時代', '本集標題', '類型', '圖名（檔名取得）', '插入位置', '接點句（原文逐字，在文章中搜尋這句）', '接點句在第幾段', '該段原文（劇情內容）', '網站圖檔路徑（JPG，1280×720，相對於 works/liancheng/）', '備註'])
for r in rows: ws.append(r)
head(ws); widths(ws, [6, 7, 26, 9, 22, 22, 36, 9, 60, 44, 40])
for row in ws.iter_rows(min_row=2):
    for c in row: c.alignment = Alignment(vertical='top', wrap_text=True)
    if row[3].value == '封面':
        for c in row: c.fill = cov
ws.freeze_panes = 'A2'; ws.auto_filter.ref = ws.dimensions
w2 = wb.create_sheet('作品封面與首頁輪播'); w2.append(['類型', '說明', '網站圖檔路徑（JPG）'])
w2.append(['作品封面', '《等待輪迴Ⅲ－連城情未了》整部作品的封面（直式）', jpg(works['cover'])])
for i, h in enumerate(works['hero'], 1): w2.append(['首頁輪播%d' % i, '作品首頁輪播用圖', jpg(h)])
head(w2); widths(w2, [14, 46, 48])
w3 = wb.create_sheet('尚缺的圖'); w3.append(['集數', '本集標題', '目前狀況'])
for e in d['episodes']:
    if e['status'] != 'ready': continue
    n = len(e.get('pics', [])); miss = []
    if not e.get('img'): miss.append('沒有封面')
    if e['ep'] >= 11 and n < 5: miss.append('內頁只有%d張（目標5張）' % n)
    if miss: w3.append([e['ep'], e['title'], '、'.join(miss)])
head(w3); widths(w3, [8, 36, 44])
w4 = wb.create_sheet('使用說明', 0)
for line in ['《等待輪迴Ⅲ－連城情未了》方格子插圖對照表', '',
 '一、每集一張封面、五張內頁（早期第 1～10 集、第 12～15 集等舊集內頁較少，見「尚缺的圖」）。',
 '二、封面放在文章最上方；內頁「接在含接點句的那一段之後」。接點句是從正文原樣取出的，用搜尋就找得到那一段。',
 '三、「該段原文」就是這張圖對應的劇情內容；同一集的圖已依正文先後順序排列。',
 '四、圖檔路徑是網站版（JPG，1280×720）。方格子若要更高畫質，請用雲端「連城主圖」資料夾裡 GPT 生成的原圖（1672×941）。',
 '五、早期第 1～10 集的圖檔名是舊編號，名字和集數對不上，所以「圖名」欄只能參考該段原文，不要靠檔名判斷。',
 '六、有「備註」的圖：宮格圖、疊詩圖、第 23～25 集檔名對調，請在放入方格子前留意。',
 '七、封面標色（淡黃）方便一眼分出每集的封面。', '',
 '本表只列「已經上架到網站的圖」，目前涵蓋到第 %d 集；沒有圖的集數見「尚缺的圖」。圖一上架，重跑 tools/build_vocus_image_table.py 就會更新本表。' % last_ep]:
    w4.append([line])
w4.column_dimensions['A'].width = 110; w4['A1'].font = Font(bold=True, size=14)
for r in w4.iter_rows():
    for c in r: c.alignment = Alignment(wrap_text=True, vertical='top')
wb.save(out)
print('已存', out, '｜封面', sum(r[3] == '封面' for r in rows), '內頁', sum(r[3].startswith('內頁') for r in rows), '附圖', sum(r[3] == '文末附圖' for r in rows), '｜找不到段落', sum(r[7] == '找不到' for r in rows), '｜檔案不存在', sum(not os.path.exists(os.path.join(W, r[9])) for r in rows))
