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
