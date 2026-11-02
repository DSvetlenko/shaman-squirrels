# Ресурсы игры и лицензии

Все файлы лежат внутри репозитория. Игра не загружает ничего со сторонних сайтов.

## Графика

Вся игровая графика нарисована кодом в `src/art/svg.js` специально для этой игры: белки, жёлуди, куча орехов, пень с дуплом, парящие острова, доски, болты, ящик, батут, шипы, фон с закатом и облаками. Иконки приложения и заставки (`assets/icons`, `assets/splash`) собраны из этой же графики скриптом `tools/make-icons.mjs`.

Готовые бесплатные спрайты (например, Kenney New Platformer Pack, CC0) рассматривались, но их детский стиль не подошёл к задаче «не слишком детский интерфейс», поэтому в игре их нет.

## Звуки

Источник — паки Kenney (www.kenney.nl), лицензия **CC0 1.0** (общественное достояние, можно использовать в коммерческих проектах, указание автора необязательно). Файлы взяты из зеркал паков на GitHub и перекодированы в MP3 (моно, 96 кбит/с), чтобы работать в Safari на iPhone.

| Файл | Исходный звук | Пак Kenney | Зеркало |
|---|---|---|---|
| `assets/audio/click.mp3` | click_002.wav | Interface Sounds | github.com/Calinou/kenney-interface-sounds |
| `assets/audio/select.mp3` | select_002.wav | Interface Sounds | github.com/Calinou/kenney-interface-sounds |
| `assets/audio/back.mp3` | back_002.wav | Interface Sounds | github.com/Calinou/kenney-interface-sounds |
| `assets/audio/saved.mp3` | pluck_002.wav | Interface Sounds | github.com/Calinou/kenney-interface-sounds |
| `assets/audio/denied.mp3` | error_004.wav | Interface Sounds | github.com/Calinou/kenney-interface-sounds |
| `assets/audio/star.mp3` | confirmation_002.wav | Interface Sounds | github.com/Calinou/kenney-interface-sounds |
| `assets/audio/place.mp3` | impact_wood_medium_002.ogg | Impact Sounds | github.com/Boyquotes/kenney-impact-sounds-for-godot |
| `assets/audio/crate.mp3` | impact_soft_medium_001.ogg | Impact Sounds | github.com/Boyquotes/kenney-impact-sounds-for-godot |
| `assets/audio/pin.mp3` | metal_click.ogg | RPG Audio | github.com/Boyquotes/kenney-rpg-audio-for-godot |
| `assets/audio/creak.mp3` | creak_2.ogg | RPG Audio | github.com/Boyquotes/kenney-rpg-audio-for-godot |
| `assets/audio/nut.mp3` | handle_coins.ogg | RPG Audio | github.com/Boyquotes/kenney-rpg-audio-for-godot |
| `assets/audio/boing.mp3` | pep_sound_3.ogg | Digital Audio | github.com/Boyquotes/kenney-digital-audio-for-godot |
| `assets/audio/release.mp3` | phaser_up_3.ogg | Digital Audio | github.com/Boyquotes/kenney-digital-audio-for-godot |
| `assets/audio/lost.mp3` | low_down.ogg | Digital Audio | github.com/Boyquotes/kenney-digital-audio-for-godot |
| `assets/audio/win.mp3` | jingles_pizzi_2.ogg | Music Jingles | github.com/Boyquotes/kenney-music-jingles-for-godot |
| `assets/audio/lose.mp3` | jingles_pizzi_1.ogg | Music Jingles | github.com/Boyquotes/kenney-music-jingles-for-godot |

Оригинальные страницы паков: https://kenney.nl/assets/interface-sounds, https://kenney.nl/assets/impact-sounds, https://kenney.nl/assets/rpg-audio, https://kenney.nl/assets/digital-audio, https://kenney.nl/assets/music-jingles

## Шрифты

| Шрифт | Файлы | Лицензия | Источник |
|---|---|---|---|
| Unbounded | `assets/fonts/unbounded-*.woff2` | SIL Open Font License 1.1 | Google Fonts, пакет @fontsource/unbounded |
| Manrope | `assets/fonts/manrope-*.woff2` | SIL Open Font License 1.1 | Google Fonts, пакет @fontsource/manrope |

OFL разрешает встраивать шрифты в игру и распространять их вместе с ней.

## Иконки интерфейса

Lucide (https://lucide.dev), лицензия **ISC**. Нужные иконки встроены в `src/ui/icons.js`, текст лицензии — `vendor/LUCIDE-LICENSE`.

## Библиотеки

qrcode-generator 2.0.4 (Kazuhiko Arase, https://github.com/kazuhikoarase/qrcode-generator), лицензия **MIT** — рисует QR-код для переноса прогресса. Файл `vendor/qrcode.mjs`, лицензия — `vendor/QRCODE-LICENSE`.

jsQR 1.4.0 (https://github.com/cozmo/jsQR), лицензия **Apache 2.0** — распознаёт QR-код с камеры. Файл `vendor/jsQR.min.js` (сжат esbuild), лицензия — `vendor/JSQR-LICENSE`.

Phaser 3.90.0 (https://phaser.io), лицензия **MIT**. Файл `vendor/phaser.min.js`, текст лицензии — `vendor/PHASER-LICENSE.md`. Физика — встроенный в Phaser движок Matter.js (MIT).
