# 铁迹 · 音频素材与改编说明

2026-09-10 核对来源页面。所有音频随游戏本地提供，不在游戏运行时访问素材网站。

| 游戏文件 | 作品 / 作者 | 来源 | 授权与加工 |
| --- | --- | --- | --- |
| cannon-1/2/3.mp3 | Tanks Shooting.flac / qubodup | https://freesound.org/people/qubodup/sounds/189344/ | CC0 1.0；作者标注源于美国政府靶场视频。采用公开 HQ MP3，截取 0.12、3.7、8.3 秒处各 2.8 秒，转单声道、尾部淡出、限幅。 |
| engine.mp3 | Engine-loop heavy vehicle/tank / Nayckron；协作者 qubodup | https://opengameart.org/content/engine-loop-heavy-vehicletank | 选择 CC BY 3.0 授权；由汽车引擎循环改编的重型车辆音效，并非 M4 谢尔曼原车录音。转单声道 MP3，游戏按速度改变播放速率。 |
| explosion.mp3 | 2 High Quality Explosions / Michel Baradari，qubodup 上传 | https://opengameart.org/content/2-high-quality-explosions | CC BY 3.0；使用作者页面 exp.mp3，转单声道，游戏改变速率及截断用于不同冲击。属于音效作品，不声称为战场实录。 |
| fire.mp3 | Fire Crackling / AntumDeluge | https://opengameart.org/content/fire-crackling | CC0 1.0；由壁炉燃烧音效改编，转单声道、循环播放。 |

CC BY 3.0: https://creativecommons.org/licenses/by/3.0/
CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/

音源并非二战型号逐车实录。游戏使用 HRTF 定位、距离衰减、遮挡低通与车内滤波进行混音；源文件和页面快照保存在项目 docs/asset-sources。没有步兵实体，因此没有加入凭空出现的敌军脚步声。

补充：metal.mp3 来自 **Metal Hit — Marcelo Fernandez**（上传名 marcelofg55），CC BY 3.0。来源 https://opengameart.org/content/metal-hit ，作者网站 http://www.marcelofernandezmusic.com 。截取前 1.4 秒，转单声道、淡出，游戏降低音调用于装甲撞击。

## Menu MIDI
`menu-homecoming.mid`: original 16-bar D-minor menu composition generated for Iron Traces, 72 BPM, 128 note events. Browser playback reads the MIDI file and uses synthesized string/horn/bass-like timbres, not recorded orchestral samples.

## Previous homepage music — MIDI rendering (unused)
- Ludwig van Beethoven, Symphony No.7 Op.92, II. Allegretto.
- MIDI engraving: Stelios Samelis, Mutopia-2005/08/21-595; source Litolff Verlag. Mutopia metadata designates this edition Public Domain.
- Source: https://www.mutopiaproject.org/ftp/BeethovenLv/O92/Symphony7_2/
- Original file preserved as `beethoven-allegretto.mid`.
- `beethoven-allegretto.mp3` is a local MIDI rendering with FluidSynth and GeneralUser GS v2.0.3 by S. Christian Collins. Not a live orchestra recording.
- SoundFont: https://github.com/mrbumpy409/GeneralUser-GS . License permits private/commercial music creation; full license preserved in docs/asset-sources/menu-music/SOUNDFONT-LICENSE.txt.
- Previous original menu-homecoming MIDI is retained as an unused earlier version.

## Current homepage music — John Michel recording
- Work: Ludwig van Beethoven, Symphony No. 7 in A major, Op. 92 — II. Allegretto.
- Recording credit: **John Michel** (https://johnmichel.com/), as credited on Wikimedia Commons.
- Playback file: `beethoven-allegretto-john-michel-trimmed.ogg`; original retained as `beethoven-allegretto-john-michel.ogg`.
- Source and attribution page: https://commons.wikimedia.org/wiki/File:JOHN_MICHEL_CELLO-BEETHOVEN_SYMPHONY_7_Allegretto.ogg
- Original file: https://upload.wikimedia.org/wikipedia/commons/0/0c/JOHN_MICHEL_CELLO-BEETHOVEN_SYMPHONY_7_Allegretto.ogg
- License: **Creative Commons Attribution-ShareAlike 3.0 Unported (CC BY-SA 3.0)** — https://creativecommons.org/licenses/by-sa/3.0/
- Changes: removed approximately 0.90 seconds of opening silence using Vorbis packet stream copy, without audio re-encoding or normalization. The trimmed adaptation is distributed under CC BY-SA 3.0. The game applies playback volume, pause/resume and looping.
- This recording remains under CC BY-SA 3.0; attribution and license link must accompany redistribution, and adaptations must use the same or a compatible license. No endorsement of this game is implied.
- Commons displays copyright-holder permission reviewed by Wikimedia VRT, ticket 2007090610014151. Source page snapshot: `docs/asset-sources/john-michel-allegretto/commons-file-page.html` (verified 2026-09-10).
- Earlier MIDI and MP3 files are retained as unused earlier versions; the homepage now plays the trimmed OGG.

## 2026-09-10 分层战斗音效升级

新增素材库：**Kenney — Impact Sounds 1.0**，CC0 1.0。
来源：https://kenney.nl/assets/impact-sounds
许可：https://creativecommons.org/publicdomain/zero/1.0/
文件：`foley/impactMetal_heavy_000/001/002.ogg`、`impactMetal_light_000.ogg`、`impactPlate_heavy_000.ogg`、`impactMining_000/001.ogg`、`impactWood_heavy_000.ogg`。
用于装甲冲击、后坐、墙体碎石与履带拟音。素材本身保留原始 OGG，游戏中随机调节播放速度及响度。履带为金属与地面撞击素材组合，不是谢尔曼履带实录。

**SpringySpringo — Gun reload sounds**，CC0 1.0。
来源：https://opengameart.org/content/gun-reload-sounds
原始文件：`shotguncock_0.wav`，作者注明以气枪录制。派生文件：`foley/breech.ogg`，转单声道、降调、高通及限幅；用作火炮机械动作拟音，不宣称是真实火炮装填录音。

现有 qubodup 炮声及 Michel Baradari 爆炸声继续使用，加入距离/343秒传播延迟、低通反射尾声和机械层。未加入未被物理系统模拟的“跳弹”或“穿透”判定音。

## 谢尔曼行驶实录（当前发动机循环）

**Sherman tank: rijden — Beeld en Geluid（荷兰视听研究所）**。
来源：https://commons.wikimedia.org/wiki/File:Sherman_tank,_rijden_-_SoundCloud_-_Beeld_en_Geluid.ogg
许可：CC BY-SA 3.0，https://creativecommons.org/licenses/by-sa/3.0/
原始描述：谢尔曼坦克从远处驶来，在混凝土道路上经过，外部录音；未标明具体子型号与发动机型号。

派生文件 `foley/sherman-drive.ogg` 同样以 **CC BY-SA 3.0** 发布。改动：提取约63–68秒，转单声道，45Hz高通/9kHz低通、动态压缩、200毫秒首尾交叉淡化、OGG编码。游戏根据速度调音高；静止声为行驶录音的游戏化低速处理，不是真实怠速采样。敌车暂共用此录音，通过距离滤波区分，不声称还原德国坦克发动机。

原文件保存在 docs/asset-sources/sherman/original.ogg。之前由汽车改编的 engine.mp3 保留作加载失败备用；未用于正常发动机播放。
