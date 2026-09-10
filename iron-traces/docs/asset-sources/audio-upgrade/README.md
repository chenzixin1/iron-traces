# 开放音效素材与验证

Kenney Impact Sounds: https://kenney.nl/assets/impact-sounds (CC0; 原许可见 Kenney-LICENSE.txt)
SpringySpringo Gun reload sounds: https://opengameart.org/content/gun-reload-sounds (CC0; 原始录音 shotguncock.wav)

转换：ffmpeg -i shotguncock.wav -ac 1 -af 'asetrate=32000,aresample=44100,highpass=f=90,alimiter=limit=0.8' -c:a libvorbis -q:a 5 breech.ogg

运行验证：16个素材成功解码，无失败；行驶及开炮产生7个活动声源，暂停后瞬态声源清理，仅保留静音循环源。浏览器无异常。HRTF方向、343m/s传播延迟、车内低通保留，循环声源预留容量、总声源限制48。
