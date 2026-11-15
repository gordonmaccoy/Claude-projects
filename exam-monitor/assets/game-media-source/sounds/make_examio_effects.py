"""Original Examio game-show cues. Every sample is mathematically synthesized.

Requires NumPy, SciPy, and FFmpeg. No imported recordings, loops, instrument
samples, commercial sound libraries, or data files; seed provides repeatability.
"""
from pathlib import Path
import subprocess

import numpy as np
from scipy import signal
from scipy.io.wavfile import write

RATE = 44100
TAU = 2 * np.pi
ROOT = Path(__file__).resolve().parent
rng = np.random.default_rng(60415961)


def zeros(seconds):
    return np.zeros((round(seconds * RATE), 2))


def clock(seconds):
    return np.arange(round(seconds * RATE), dtype=float) / RATE


def filtered_noise(n, low, high):
    return signal.sosfilt(signal.butter(2, (low, high), btype="bandpass", fs=RATE, output="sos"), rng.normal(size=n))


def put(dst, mono, at=0, gain=1, pan=0):
    start = round(at * RATE)
    mono = mono[: len(dst) - start]
    # constant-power stereo pan without a stereo cancellation phase
    dst[start:start + len(mono), 0] += mono * gain * np.sqrt((1 - pan) / 2)
    dst[start:start + len(mono), 1] += mono * gain * np.sqrt((1 + pan) / 2)


def echoes(samples, taps, dry=1.0):
    mixed = samples * dry
    for seconds, level, swap in taps:
        d = round(seconds * RATE)
        mixed[d:] += level * (samples[:-d, ::-1] if swap else samples[:-d])
    return mixed


def fades(y, tail):
    y[-round(tail * RATE):] *= np.linspace(1, 0, round(tail * RATE))[:, None]
    return y


def gong():
    d = zeros(3.25)
    t = clock(3.25)
    for i, (freq, amp, decay) in enumerate([
        (48.9, .30, 1.12), (69.3, .68, 1.40), (87.8, .43, 1.02), (104.2, .70, .92),
        (127.4, .37, .88), (166.1, .31, .77), (207.9, .24, .69), (251.8, .32, .59),
        (307.2, .24, .52), (369.7, .19, .46), (469.5, .16, .31), (571.7, .12, .30),
        (648.6, .13, .29), (793.1, .11, .23), (1028.6, .10, .20), (1371.5, .06, .15),
        (1907, .055, .1), (2403.2, .025, .09),
    ]):
        # Initial impact is slightly sharp; it falls into the panel's resonant modes.
        initial = freq * (.011 if i < 10 else .004)
        phase = TAU * (freq * t + initial * .105 * (1 - np.exp(-t / .105))) + rng.uniform(0, TAU)
        attack = .013 + (i % 5) * .003
        resonator = np.sin(phase) * (1 - np.exp(-t / attack)) * np.exp(-t / decay)
        put(d, resonator, gain=amp, pan=.47 * np.sin(i * 2.4))
    strike = filtered_noise(len(t), 135, 2900) * np.exp(-t * 57) * (1 - np.exp(-t * 800))
    put(d, strike, gain=.31, pan=-.055)
    # Further diffuse reflections, not an additional gong hit.
    return fades(echoes(d, [(.033, .14, True), (.061, .13, False), (.097, .095, True),
                           (.137, .09, True), (.223, .065, False), (.337, .039, True)]), .22)


def brass_note(midi, length, accent=1.0):
    t = clock(length)
    base = 440 * 2 ** ((midi - 69) / 12)
    vib = 0.0029 * np.sin(TAU * 5.25 * t) * np.clip((t - .11) / .25, 0, 1)
    f = base * (1 - .007 * np.exp(-t / .019) + vib)
    p = TAU / RATE * np.cumsum(f)
    rise = 1 - np.exp(-t / (.021 / accent))
    release = np.clip((length - t) / min(.103, .36 * length), 0, 1) ** 1.5
    env = rise * release * (1 - .13 * np.exp(-t / .21))
    harmonics = np.zeros_like(t)
    for k in range(1, min(17, int(15500 / base))):
        hz = k * base
        body = .62 * np.exp(-.5 * ((hz - 930) / 590) ** 2)
        edge = .85 * np.exp(-.5 * ((hz - 2310) / 960) ** 2)
        a = (.72 + body + edge) / k ** .94
        brightness = .58 + .42 * (1 - np.exp(-t / .025)) if k > 2 else 1
        harmonics += a * brightness * np.sin(k * p + .092 * k)
    breath = filtered_noise(len(t), 950, 4150) * np.exp(-t / .040)
    return (harmonics + .12 * breath) * env


def fanfare():
    d = zeros(2.85)
    # Original two-part motif: rising herald, punctuated turn, broad major cadence.
    lead = [(0.035, 67, .24), (.25, 74, .25), (.463, 79, .37), (.86, 77, .17),
            (1.023, 76, .23), (1.26, 74, .26), (1.51, 81, .39), (1.88, 79, .71)]
    harmony = [(.472, 71, .35), (.867, 74, .17), (1.033, 72, .25), (1.272, 71, .26),
               (1.52, 74, .38), (1.902, 71, .66), (1.919, 67, .64)]
    for i, (at, note, dur) in enumerate(lead):
        put(d, brass_note(note, dur, 1.2), at=at, gain=.79 if i not in (2, 7) else 1, pan=-.17)
    for at, note, dur in harmony:
        put(d, brass_note(note, dur, .88), at=at, gain=.28 if note > 68 else .20, pan=.28)
    return fades(echoes(d, [(.024, .145, True), (.045, .09, False), (.084, .11, True),
                           (.123, .084, False), (.176, .062, True), (.231, .041, False)]), .16)


def clap(duration):
    t = clock(duration)
    n = filtered_noise(len(t), rng.uniform(410, 770), rng.uniform(3700, 7000))
    env = np.exp(-t * rng.uniform(47, 92)) * (1 - np.exp(-t * 1100))
    for offset in rng.uniform(.002, .014, size=2):
        dt = np.maximum(0, t - offset)
        env += rng.uniform(.3, .72) * np.exp(-dt * rng.uniform(90, 175)) * (1 - np.exp(-dt * 1500))
    return n * env


def whoop(duration, base, climb, vowel):
    t = clock(duration)
    f = base + climb * np.sin(np.pi * np.minimum(t / duration, 1) ** .73)
    f *= 1 + .012 * np.sin(TAU * rng.uniform(4.9, 7.4) * t)
    p = TAU / RATE * np.cumsum(f)
    a = np.zeros_like(t)
    f1, f2 = vowel
    for k in range(1, 13):
        hz = f * k
        formant = np.exp(-.5 * ((hz - f1) / 160) ** 2) + .44 * np.exp(-.5 * ((hz - f2) / 260) ** 2)
        a += np.sin(p * k) * (.2 + formant) / k ** .76
    mouth = (1 - np.exp(-t / .07)) * np.clip((duration - t) / min(.25, duration * .65), 0, 1) ** 1.6
    a += .15 * filtered_noise(len(t), 700, 6100)
    return a * mouth


def cheering():
    d = zeros(4.8)
    t = clock(4.8)
    dense_bed = (1 - np.exp(-t / .18)) * np.clip((4.64 - t) / .8, 0, 1)
    # Chattery stereo room air behind discrete claps and synthesized vowel whoops.
    for i in range(7):
        bed = filtered_noise(len(t), 240 + 41 * i, 1300 + 347 * i)
        flutter = signal.sosfilt(signal.butter(1, 6.5 + i, fs=RATE, output="sos"), rng.normal(size=len(t)))
        bed *= dense_bed * np.clip(.54 + flutter * 10, .04, 1.2)
        put(d, bed, gain=.035, pan=rng.uniform(-.9, .9))
    for _ in range(34):
        length = rng.uniform(.36, .92)
        at = rng.uniform(.18, 4.35 - length)
        if rng.random() < .46:
            at *= .55  # automatic 2-second silver/bronze fade still contains a clear cheer.
        put(d, whoop(length, rng.uniform(156, 388), rng.uniform(32, 164),
                     rng.choice([(390, 1020), (660, 1300), (520, 1700)])),
            at=at, gain=rng.uniform(.011, .061), pan=rng.uniform(-.86, .86))
    for _ in range(34):
        pan = rng.uniform(-.92, .92)
        at = rng.uniform(.018, .91)
        period = rng.uniform(.17, .36)
        while at < 4.64:
            strength = np.interp(at, [0, .07, .43, 2.7, 4.05, 4.64], [.59, .72, 1, .88, .63, .24])
            put(d, clap(rng.uniform(.045, .105)), at=at, gain=strength*rng.uniform(.035, .19), pan=pan)
            at += max(.09, period + rng.normal(0, .048))
    return fades(echoes(d, [(.023, .13, True), (.055, .15, False), (.087, .11, True),
                           (.126, .085, False), (.198, .075, True)]), .29)


def finish(y, target_db):
    finite = np.isfinite(y).all()
    assert finite and np.max(np.abs(y)) > 0
    wanted = 10**(target_db / 20)
    ceiling = 10**(-1.5 / 20)
    # Peak-control in the synth before assembly; final measured levels remain below ceiling.
    # Iteratively target the mean without clipping sharp transients.
    lo, hi = 0, 100
    for _ in range(27):
        middle = (lo + hi) / 2
        result = ceiling * np.tanh(y * middle / ceiling)
        rms = np.sqrt(np.mean(result ** 2))
        if rms > wanted:
            hi = middle
        else:
            lo = middle
    result *= .97
    return result


def save_mp3(name, y, target_db):
    y = finish(y, target_db)
    wav = ROOT / (name + '.working.wav')
    dest = ROOT / (name + '.mp3')
    write(wav, RATE, np.int16(np.clip(y, -1, 1) * 32767))
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(wav),
                    '-map_metadata', '-1', '-c:a', 'libmp3lame', '-b:a', '112k', str(dest)], check=True)
    wav.unlink()
    print(name, f"{len(y)/RATE:.3f}s", f"RMS {20*np.log10(np.sqrt(np.mean(y*y))):.2f} dBFS",
          f"peak {20*np.log10(np.max(np.abs(y))):.2f} dBFS", f"{dest.stat().st_size} bytes")


if __name__ == '__main__':
    save_mp3('responses-closed', gong(), -12.2)
    save_mp3('gold-fanfare', fanfare(), -12.0)
    save_mp3('podium-cheering', cheering(), -15.1)
