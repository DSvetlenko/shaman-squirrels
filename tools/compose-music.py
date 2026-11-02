"""Музыка и синтезированные звуки игры «Шаман».

Треки сочинены и синтезированы этим скриптом (без сэмплов и чужих записей),
поэтому никаких ограничений по лицензии нет. Запуск:

    python3 tools/compose-music.py

Результат — assets/audio/music-menu.mp3, music-game.mp3 и несколько коротких
эффектов (hop, pop, tick, open). Нужны numpy, scipy и ffmpeg.
"""
import os
import subprocess
import tempfile

import numpy as np
from scipy.signal import fftconvolve, butter, sosfilt
from scipy.io import wavfile

SR = 44100
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'assets', 'audio')
rng = np.random.default_rng(7)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def note_names(s):
    """'A3 C4 E4' -> midi"""
    names = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
    out = []
    for t in s.split():
        n = names[t[0]]
        i = 1
        if t[i] == '#':
            n += 1; i += 1
        elif t[i] == 'b':
            n -= 1; i += 1
        out.append(n + 12 * (int(t[i:]) + 1))
    return out


def env_adsr(n, a, d, s, r, sustain_len):
    a, d, r = int(a * SR), int(d * SR), int(r * SR)
    sl = max(0, int(sustain_len * SR) - a - d)
    e = np.concatenate([
        np.linspace(0, 1, max(a, 1), endpoint=False),
        np.linspace(1, s, max(d, 1), endpoint=False),
        np.full(sl, s),
        np.linspace(s, 0, max(r, 1)),
    ])
    if len(e) < n:
        e = np.pad(e, (0, n - len(e)))
    return e[:n]


def lowpass(x, cutoff, order=2):
    sos = butter(order, cutoff, btype='low', fs=SR, output='sos')
    return sosfilt(sos, x)


def highpass(x, cutoff, order=2):
    sos = butter(order, cutoff, btype='high', fs=SR, output='sos')
    return sosfilt(sos, x)


def saw(f, t, phase=0.0):
    # мягкая пила: сумма первых гармоник, без резкого «звона»
    out = np.zeros_like(t)
    for k in range(1, 9):
        out += np.sin(2 * np.pi * f * k * t + phase * k) / k * (0.85 ** k)
    return out


def pad_note(freq, dur, amp=0.12):
    n = int((dur + 2.0) * SR)
    t = np.arange(n) / SR
    voices = []
    for cents in (-8, 0, 8):
        f = freq * 2 ** (cents / 1200)
        voices.append(saw(f, t, rng.uniform(0, 6.28)))
    sig = sum(voices) / 3
    # медленное дыхание фильтра
    sig = lowpass(sig, 950, order=4) * (1 + 0.15 * np.sin(2 * np.pi * 0.17 * t))
    return sig * env_adsr(n, 1.2, 0.6, 0.8, 1.8, dur) * amp


def pluck(freq, amp=0.2, decay=0.55, bright=1.0):
    n = int((decay * 5) * SR)
    t = np.arange(n) / SR
    sig = (np.sin(2 * np.pi * freq * t) + 0.35 * bright * np.sin(2 * np.pi * 2 * freq * t) * np.exp(-t * 8)
           + 0.12 * bright * np.sin(2 * np.pi * 3.01 * freq * t) * np.exp(-t * 14))
    e = np.exp(-t / decay) * np.minimum(1, t / 0.004)
    return sig * e * amp


def bass_note(freq, dur, amp=0.18):
    n = int((dur + 0.6) * SR)
    t = np.arange(n) / SR
    sig = np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(2 * np.pi * 2 * freq * t)
    return lowpass(sig, 380) * env_adsr(n, 0.04, 0.3, 0.7, 0.5, dur) * amp


def kick(amp=0.35):
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    f = 110 * np.exp(-t * 22) + 42
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 9) * amp


def shaker(amp=0.05):
    n = int(0.08 * SR)
    t = np.arange(n) / SR
    s = highpass(rng.standard_normal(n), 6000)
    return s * np.exp(-t * 60) * np.minimum(1, t / 0.006) * amp


def place(buf, sig, at, pan=0.0):
    i = int(at * SR)
    if i >= buf.shape[1]:
        return
    j = min(buf.shape[1], i + len(sig))
    l = np.cos((pan + 1) * np.pi / 4)
    r = np.sin((pan + 1) * np.pi / 4)
    buf[0, i:j] += sig[: j - i] * l * 1.414
    buf[1, i:j] += sig[: j - i] * r * 1.414


def reverb(buf, seconds=2.6, mix=0.3):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    out = np.zeros_like(buf)
    for ch in range(2):
        ir = rng.standard_normal(n) * np.exp(-t / (seconds / 4.5))
        ir = lowpass(ir, 5200)
        ir /= np.sqrt(np.sum(ir ** 2))
        out[ch] = fftconvolve(buf[ch], ir)[: buf.shape[1]]
    return buf * (1 - mix) + out * mix


def delay(buf, time, fb=0.35, mix=0.25):
    d = int(time * SR)
    out = buf.copy()
    echo = np.zeros_like(buf)
    for k in range(1, 6):
        g = fb ** k
        sh = np.zeros_like(buf)
        sh[:, d * k:] = buf[:, : buf.shape[1] - d * k]
        echo += sh * g * (1 if k % 2 else 0.8)
    # пинг-понг: чётные отражения в другой канал
    echo[[0, 1]] = echo[[1, 0]] * 0.5 + echo * 0.5
    return out + lowpass(echo, 3500) * mix


def master(buf, peak=0.82):
    buf = highpass(buf, 30)
    # мягкое ограничение
    buf = np.tanh(buf * 1.2) / np.tanh(1.2)
    return buf / (np.max(np.abs(buf)) + 1e-9) * peak


def render_loop(build, loop_seconds, beat):
    """Рендерит два прохода и берёт второй, чтобы хвосты эха и реверберации
    первого прохода переходили в начало — тогда петля звучит без шва."""
    total = loop_seconds * 2 + 3
    buf = np.zeros((2, int(total * SR)))
    build(buf, 0.0)
    build(buf, loop_seconds)
    buf = delay(buf, beat * 0.75, fb=0.3, mix=0.18)
    buf = reverb(buf, 2.8, 0.32)
    a, b = int(loop_seconds * SR), int(loop_seconds * 2 * SR)
    return master(buf[:, a:b])


def track_menu():
    """«Над облаками»: тихие пэды и редкие переливы, ля минор."""
    beat = 60 / 84
    bar = beat * 4
    chords = ['A2 E3 G3 B3 C4', 'F2 C3 E3 G3 A3', 'C3 G3 B3 D4 E4', 'G2 D3 G3 B3 E4',
              'A2 E3 G3 B3 C4', 'F2 C3 E3 A3 C4', 'D3 A3 C4 E4 F4', 'E2 B2 E3 G#3 B3']
    melody_pool = [note_names('A4 C5 E5 G5 B4'), note_names('A4 C5 E5 F5 G4'), note_names('G4 B4 D5 E5 C5'),
                   note_names('G4 B4 D5 E5 A4'), note_names('A4 C5 E5 B4 G5'), note_names('A4 C5 F5 E5 G4'),
                   note_names('A4 D5 F5 E5 C5'), note_names('G#4 B4 E5 D5 B4')]
    loop = bar * 16
    mrng = np.random.default_rng(11)
    pattern = []
    for rep in range(2):
        for ci in range(8):
            notes = melody_pool[ci]
            steps = [0, 3, 6, 8, 11, 14] if (ci + rep) % 2 == 0 else [0, 2, 6, 9, 12]
            pattern.append([(s, notes[int(mrng.integers(len(notes)))], mrng.uniform(-0.6, 0.6)) for s in steps if mrng.random() < 0.8])

    def build(buf, t0):
        for rep in range(2):
            for ci, ch in enumerate(chords):
                t = t0 + (rep * 8 + ci) * bar
                ns = note_names(ch)
                for k, n in enumerate(ns):
                    place(buf, pad_note(midi(n), bar, 0.07 if k else 0.05), t, pan=(k - 2) * 0.25)
                place(buf, bass_note(midi(ns[0] - 12 if ns[0] > 45 else ns[0]), bar * 0.95, 0.16), t)
                for s, n, pan in pattern[rep * 8 + ci]:
                    place(buf, pluck(midi(n), 0.11, 0.9), t + s * beat / 4, pan)
    return render_loop(build, loop, beat), loop


def track_game():
    """«Перевал»: живее, арпеджио, мягкий бит."""
    beat = 60 / 96
    bar = beat * 4
    chords = ['A2 E3 G3 C4', 'F2 C3 E3 A3', 'C3 G3 B3 E4', 'G2 D3 G3 B3',
              'A2 E3 G3 C4', 'F2 C3 E3 A3', 'D3 A3 C4 F4', 'E2 B2 E3 G#3']
    arp_pool = [note_names('A4 C5 E5 G5'), note_names('F4 A4 C5 E5'), note_names('C5 E5 G5 B4'), note_names('G4 B4 D5 G5'),
                note_names('A4 C5 E5 B4'), note_names('F4 A4 C5 G5'), note_names('D5 F5 A4 C5'), note_names('E5 G#4 B4 D5')]
    loop = bar * 16
    lead = note_names('E5 D5 C5 A4 C5 D5 E5 G5 E5 D5 C5 D5 E5 A4 B4 C5')

    def build(buf, t0):
        for rep in range(2):
            for ci, ch in enumerate(chords):
                t = t0 + (rep * 8 + ci) * bar
                ns = note_names(ch)
                for k, n in enumerate(ns):
                    place(buf, pad_note(midi(n), bar, 0.045), t, pan=(k - 1.5) * 0.3)
                arp = arp_pool[ci]
                for s in range(8):
                    n = arp[s % 4] + (12 if (s == 6 and rep == 1) else 0)
                    place(buf, pluck(midi(n), 0.085, 0.32, 0.8), t + s * beat / 2, pan=0.35 if s % 2 else -0.35)
                for b in (0, 2):
                    place(buf, bass_note(midi(ns[0]), beat * 1.6, 0.17), t + b * beat)
                for b in range(4):
                    if b in (0, 2):
                        place(buf, kick(0.26), t + b * beat)
                    for h in range(2):
                        place(buf, shaker(0.035 if h else 0.022), t + b * beat + h * beat / 2, pan=0.2)
                if rep == 1:
                    for k in range(2):
                        n = lead[(ci * 2 + k) % len(lead)]
                        place(buf, pluck(midi(n), 0.07, 0.8, 0.6), t + k * bar / 2 + beat * 0.5, pan=0.1)
    return render_loop(build, loop, beat), loop


# ---------------------------------------------------------------- короткие эффекты
def sfx_hop():
    n = int(0.16 * SR)
    t = np.arange(n) / SR
    f = 420 + 520 * (t / 0.16) ** 0.7
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 26) * np.minimum(1, t / 0.004) * 0.5


def sfx_pop():
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    f = 900 * np.exp(-t * 18) + 300
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 32) * 0.55


def sfx_tick():
    n = int(0.05 * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * 1800 * t) * np.exp(-t * 120) + 0.4 * highpass(rng.standard_normal(n), 3000) * np.exp(-t * 200)
    return s * 0.35


def sfx_open():
    n = int(0.28 * SR)
    t = np.arange(n) / SR
    noise = lowpass(rng.standard_normal(n), 2400) * np.sin(np.pi * t / 0.28) ** 2 * 0.25
    tone = np.sin(2 * np.pi * (520 + 300 * t / 0.28) * t) * np.exp(-t * 9) * 0.2
    return noise + tone


def write_mp3(stereo_or_mono, name, kbps=128):
    data = stereo_or_mono
    if data.ndim == 2:
        data = data.T
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, 'x.wav')
        wavfile.write(wav, SR, (np.clip(data, -1, 1) * 32767).astype(np.int16))
        args = ['ffmpeg', '-v', 'error', '-y', '-i', wav]
        if data.ndim == 1:
            args += ['-ac', '1']
        args += ['-b:a', f'{kbps}k', os.path.join(OUT, name)]
        subprocess.run(args, check=True)
    print(name)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    # В конец файла дописывается полсекунды начала: MP3 добавляет тишину
    # по краям, поэтому игра зацикливает точный отрезок длиной loop (music.json).
    meta = {}
    for name, fn in [('menu', track_menu), ('game', track_game)]:
        loop, length = fn()
        tail = loop[:, : int(0.5 * SR)]
        write_mp3(np.concatenate([loop, tail], axis=1), f'music-{name}.mp3', 112)
        meta[name] = round(length, 6)
    import json
    with open(os.path.join(OUT, 'music.json'), 'w') as f:
        json.dump(meta, f)
    for nm, fn in [('hop', sfx_hop), ('pop', sfx_pop), ('tick', sfx_tick), ('open', sfx_open)]:
        s = fn()
        write_mp3(s / (np.max(np.abs(s)) + 1e-9) * 0.8, nm + '.mp3', 96)
