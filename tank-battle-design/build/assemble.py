from pathlib import Path
import re, json, subprocess, html, hashlib, zipfile
from collections import Counter

ROOT = Path(__file__).resolve().parents[1]
HAN = re.compile(r'[\u3400-\u4dbf\u4e00-\u9fff\U00020000-\U0002fa1f]')
PARTS = sorted((ROOT / 'parts').glob('*.md'))
assert len(PARTS) == 7, f'Expected seven parts, got {len(PARTS)}'

def clean_body(s):
    s = re.sub(r'```.*?```', '', s, flags=re.S)
    out, in_sources = [], False
    for line in s.splitlines():
        if re.match(r'^## 第\d+章', line):
            in_sources = False
        elif re.match(r'^#{2,4}\s+.*(?:本部分.*来源|本章.*来源|资料与.*核验|本部分资料|参考资料|参考来源|来源与实施边界|资料与待核验)', line):
            in_sources = True
        if in_sources or re.match(r'^\s*#', line) or line.lstrip().startswith('|'):
            continue
        line = re.sub(r'!?\[[^\]]*\]\([^)]*\)', '', line)
        line = re.sub(r'https?://\S+', '', line)
        line = re.sub(r'`[^`]*`', '', line)
        out.append(line)
    return '\n'.join(out)

texts = [p.read_text() for p in PARTS]
body = '\n\n'.join(texts)
chapters = re.findall(r'^## (第(\d+)章[^\n]*)$', body, re.M)
assert [int(x[1]) for x in chapters] == list(range(1,31)), 'Chapter order or count invalid'
strict = clean_body(body)
paragraphs = [p.strip() for p in re.split(r'\n\s*\n', strict) if len(HAN.findall(p)) >= 40]
dups = {p: n for p, n in Counter(paragraphs).items() if n > 1}
duplicate_han = sum(len(HAN.findall(p)) * (n-1) for p,n in dups.items())
strict_count = len(HAN.findall(strict)) - duplicate_han
assert strict_count > 50000, f'Only {strict_count} substantive Han characters'
assert not re.search(r'|\bTODO\b|此处省略|待补充正文', body), 'Placeholder/citation token remains'

titles = [x[0] for x in chapters]
def slug(text):
    return re.sub(r'\s+', '-', re.sub(r'[^\w\s-]', '', text.lower()).strip())

stats = {
    'count_definition': 'Only Han characters in the 30 authored chapters. Excludes headings, tables, source-list sections, fenced and inline code, markdown links and URL addresses; exact repeated long paragraphs deducted. Front matter, prototype captions, contents and source appendix excluded.',
    'substantive_body_han': strict_count,
    'all_chapter_han_before_exclusions': len(HAN.findall(body)),
    'exact_duplicate_long_paragraphs': len(dups),
    'duplicate_han_excluded': duplicate_han,
    'chapter_count': len(chapters),
    'prototype_count': 5,
    'requirement_over_50000': strict_count > 50000,
    'parts': [{'file': p.name, 'han_all': len(HAN.findall(t)), 'han_conservative': len(HAN.findall(clean_body(t))), 'bytes': len(t.encode()), 'sha256': hashlib.sha256(t.encode()).hexdigest()} for p,t in zip(PARTS,texts)],
    'chapter_titles': titles,
    'status': 'design_document_and_image_concepts_only; game_not_implemented; no_pdf',
}

figure_data = [
('P01-top-down-v2', '俯视战斗：路线、沼泽、密林与墙体缺口', '对应第05—10、19—22章；查看俯视镜头下的路线选择和地形区分。'),
('P02-over-shoulder-v2', '过肩驾驶：近景压痕与前方接敌空间', '对应第15、21、22章；查看坦克、履带轨迹、准星与缺口之间的关系。'),
('P03-mission-brief', '战前简报：时局、部队、本车与任务', '对应第02—04、10、25章；示意地图不代表精确历史坐标。'),
('P04-refit', '任务间整备：配给选择与装备说明', '对应第11—14、25章；正文正式选项名称为均衡、反装甲和破障。'),
('P05-track-study', '地表差异：泥地、雪地、旋转与石路', '对应第20、21、23章；展示材料和运动方向，不能证明游戏已实现变形。')]

front = (ROOT/'build/front-matter.md').read_text()
toc = '\n## 正文章节目录\n\n' + '\n'.join(f'- [{title}](#{slug(title)})' for title in titles)
size_note = f'\n\n> 篇幅核验：30 章正文按保守口径统计为 **{strict_count:,} 个汉字**；标题、表格、来源列表、代码、目录、原型图说明及重复长段落不计入此数。详细记录见 [字数与结构检查](qa/字数与结构检查.json)。\n'
gallery_md = '\n\n## 原型图册与阅读说明\n\n五张图均由 ImageGen 生成，属于概念原型，非运行截图。正式功能、数值和文案以正文章节为准。\n'
for id,title,desc in figure_data:
    assert (ROOT/'prototypes'/f'{id}.png').is_file(), id
    gallery_md += f'\n### {id[:3]} · {title}\n\n![{title}](prototypes/{id}.png)\n\n{desc}\n'
gallery_md += '\n原始生成提示与逐图审阅见 [生成提示](prototypes/生成提示.json) 和 [原型审阅说明](prototypes/原型审阅说明.md)。\n'

appendix=(ROOT/'build/implementation-appendix.md').read_text()
sources = sorted(set(re.findall(r'https?://[^\s\)\]>]+', body+'\n'+appendix)))
sources_md = '\n\n## 来源索引与交付说明\n\n本索引保留文中实际引用的来源。军史网页用于核对背景，技术文档用于界定未来实现方式，不代表本文引用的所有细节都完成了逐条学术审订。具体用途及待核验项目见相应章节。\n\n'
for u in sources:
    label=u.split('/')[2]+' / '+u.split('/')[-1].replace('_',' ').replace('-',' ')[:90]
    sources_md+=f'- [{label}]({u})\n'
sources_md+='\n本次交付为 Markdown、本地阅读页、概念图与文档检查记录，未生成 PDF。全部游戏操作测试、性能测试、音频听测和真实履带轨迹验证均留待游戏实施阶段完成。\n'

complete = front + size_note + toc + '\n\n' + body + '\n\n' + appendix + gallery_md + sources_md
md_path=ROOT/'坦克大战_完整设计计划.md'
md_path.write_text(complete)

# Use Pandoc for document conversion, not a custom markdown parser.
result=subprocess.run(['pandoc',str(md_path),'-f','markdown+pipe_tables+fenced_code_blocks+autolink_bare_uris','-t','html5','--section-divs','--wrap=none'],capture_output=True,text=True,check=True)
content=result.stdout
gallery=''.join(f'<figure><a href="prototypes/{id}.png" target="_blank" rel="noopener"><img src="prototypes/{id}.png" alt="{html.escape(title)}"></a><figcaption><strong>{id[:3]} · {html.escape(title)}</strong><br>{html.escape(desc)}</figcaption></figure>' for id,title,desc in figure_data)
template=(ROOT/'build/reader-template.html').read_text()
reader=template.replace('__HAN_COUNT__',f'{strict_count:,}').replace('__GALLERY__',gallery).replace('__CONTENT__',content)
assert '__CONTENT__' not in reader
(ROOT/'index.html').write_text(reader)
stats.update({'markdown_bytes':md_path.stat().st_size,'html_bytes':len(reader.encode()),'source_links':len(sources),'markdown_sha256':hashlib.sha256(complete.encode()).hexdigest()})
(ROOT/'qa/字数与结构检查.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2))
print(json.dumps({k:stats[k] for k in ['substantive_body_han','all_chapter_han_before_exclusions','exact_duplicate_long_paragraphs','chapter_count','markdown_bytes','html_bytes']},ensure_ascii=False))

# Portable package is assembled after visual review, via --package.
import sys
if '--package' in sys.argv:
    paths=[md_path, ROOT/'index.html', ROOT/'qa/字数与结构检查.json', ROOT/'qa/交付检查.md']
    paths += [ROOT/'prototypes'/f'{id}.png' for id,_,_ in figure_data]
    paths += [ROOT/'prototypes/原型审阅说明.md',ROOT/'prototypes/生成提示.json']
    with zipfile.ZipFile(ROOT/'坦克大战_设计计划与原型.zip','w',zipfile.ZIP_DEFLATED) as z:
        for p in paths:
            if p.is_file() and not p.name.endswith('-v1.png'):
                z.write(p,p.relative_to(ROOT))
    print('package_bytes', (ROOT/'坦克大战_设计计划与原型.zip').stat().st_size)
