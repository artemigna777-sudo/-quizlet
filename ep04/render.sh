#!/bin/sh
# Рендер серии: sh render.sh → mp4/ep04.mp4 (голос + музыка + звуки) и mp4/ep04-bez-muzyki.mp4 (голос + звуки).
# Нужны Node 22, ffmpeg и Chromium (HyperFrames скачивается через npx).
set -e
cd "$(dirname "$0")"
node build.mjs
(cd out && npx -y hyperframes@0.8.119 render . --fps 30 --crf 18 --video-frame-format png -o raw.mp4 >/dev/null 2>&1)
mkdir -p mp4
# Музыка приглушается под голосом (sidechain), итог — −14 LUFS, как у TikTok.
ffmpeg -y -loglevel error -i out/raw.mp4 -i out/voice.wav -i out/music.wav -i out/sfx.wav -filter_complex \
 "[1:a]asplit=2[v][key];[2:a]volume=0.55[m];[m][key]sidechaincompress=threshold=0.03:ratio=6:attack=15:release=300[md];[v][md][3:a]amix=inputs=3:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[a]" \
 -map 0:v -map "[a]" -c:v libx264 -preset slow -crf 21 -maxrate 9M -bufsize 18M -pix_fmt yuv420p -c:a aac -b:a 192k -ar 44100 -shortest -movflags +faststart mp4/ep04.mp4
ffmpeg -y -loglevel error -i mp4/ep04.mp4 -i out/voice.wav -i out/sfx.wav -filter_complex \
 "[1:a][2:a]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[a]" \
 -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart mp4/ep04-bez-muzyki.mp4
echo mp4/ep04.mp4
