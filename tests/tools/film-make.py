"""The walkthrough video, from the frames tests/tools/film.mjs filmed.

Each filmed screen gets a caption band in the console's own colours, with the part of the
screen it talks about outlined in ice blue. Each scene opens on a short card. One MP4 per
scene, joined at the end.

  python3 tests/tools/film-make.py frames     draws the captioned frames only, to look at
  python3 tests/tools/film-make.py video      draws them and makes /tmp/film/out/console.mp4
"""
import json, os, subprocess, sys, textwrap
from PIL import Image, ImageDraw, ImageFont

FILM = "/tmp/film/"
OUT = FILM + "out/"
W, H, SHOT_H = 1920, 1080, 930
BG, BAND, TEXT, HEAD, MUTED, ICE = "#1F2024", "#1A1B1E", "#D4D7DC", "#F2F3F5", "#9A9EA6", "#8EC5FF"
SERIF = "/usr/share/fonts/truetype/google-fonts/Lora-Variable.ttf"
SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
SANS_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
SCENES = ["All sites", "A site's Overview", "The page editor", "Adding things", "Theme settings", "Templates, add-ons and default text",
          "Saving safely", "People", "Start building", "Edit code", "In short"]
TOTAL = len(SCENES)
FPS, FADE = 30, 0.6


def font(path, size):
    return ImageFont.truetype(path, size)


def spaced(draw, xy, text, f, fill, gap=2.0):
    """Small capitals with a little space between the letters, like the console's labels."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=f, fill=fill)
        x += draw.textlength(ch, font=f) + gap
    return x


def wrap(d, text, f, width):
    """Lines that fit the width, measured as drawn."""
    lines, cur = [], ""
    for word in text.split():
        nxt = (cur + " " + word).strip()
        if d.textlength(nxt, font=f) <= width or not cur:
            cur = nxt
        else:
            lines.append(cur); cur = word
    if cur:
        lines.append(cur)
    return lines


def label(scene):
    return "%d OF %d    %s" % (scene, TOTAL, SCENES[scene - 1].upper())


def frame(fr, i):
    shot = Image.open(fr["file"]).convert("RGB").crop((0, 0, W, SHOT_H))
    img = Image.new("RGB", (W, H), BG)
    img.paste(shot, (0, 0))
    d = ImageDraw.Draw(img)
    k = W / 1440.0
    for b in fr["boxes"]:
        x0, y0 = b["x"] * k - 8, b["y"] * k - 8
        x1, y1 = (b["x"] + b["width"]) * k + 8, (b["y"] + b["height"]) * k + 8
        x0, y0, x1, y1 = max(4, x0), max(4, y0), min(W - 4, x1), min(SHOT_H - 4, y1)
        d.rounded_rectangle((x0, y0, x1, y1), radius=14, outline=ICE, width=5)
    d.rectangle((0, SHOT_H, W, H), fill=BAND)
    spaced(d, (72, SHOT_H + 22), label(fr["scene"]), font(SANS_B, 17), MUTED)
    f = font(SERIF, 34)
    lines = wrap(d, fr["caption"], f, W - 144)[:2]
    for n, line in enumerate(lines):
        d.text((72, SHOT_H + 54 + n * 44), line, font=f, fill=HEAD)
    path = OUT + "c%02d.png" % i
    img.save(path)
    return path


def card(scene, path):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    spaced(d, (160, 430), "%d OF %d" % (scene, TOTAL), font(SANS_B, 22), ICE, 3)
    d.text((160, 474), SCENES[scene - 1], font=font(SERIF, 88), fill=HEAD)
    img.save(path)
    return path


def title(path):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    spaced(d, (160, 360), "ARTISCOPE, GROVE GALLERY, LONDON", font(SANS_B, 20), MUTED, 3)
    d.text((160, 402), "Artiscope Digital Home", font=font(SERIF, 112), fill=HEAD)
    d.text((164, 556), "How the console works, and what it does", font=font(SERIF, 46), fill=TEXT)
    spaced(d, (164, 660), "VERSION 52, NOVEMBER 2026", font(SANS_B, 18), ICE, 3)
    img.save(path)
    return path


def closing(path):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    spaced(d, (160, 190), "11 OF 11", font(SANS_B, 22), ICE, 3)
    d.text((160, 232), "In short", font=font(SERIF, 88), fill=HEAD)
    points = [
        "Every site in one place, changed on the page itself, as visitors will see it.",
        "Nothing goes live by accident: Undo, trial copies, one question before Save, Versions and Go back.",
        "Editors work on their own copies. Only the admin manages people and code.",
        "The whole look, the fixed words and the extras are set once for every page.",
        "New sites are built in four steps, in the same tool, ready to edit straight away.",
    ]
    f = font(SERIF, 34)
    y = 380
    for p in points:
        for line in wrap(d, p, f, 1560):
            d.text((160, y), line, font=f, fill=TEXT)
            y += 46
        y += 22
    spaced(d, (160, 990), "ARTISCOPE DIGITAL HOME    VERSION 52", font(SANS_B, 18), MUTED, 3)
    img.save(path)
    return path


def hold(caption):
    return round(max(6.0, 2.2 + len(caption) / 14.0), 2)


def encode(stills, path):
    """One scene: its stills held for their time, joined by short fades, faded in and out."""
    args = ["ffmpeg", "-y", "-v", "error"]
    for p, _ in stills:
        args += ["-framerate", str(FPS), "-i", p]
    parts, total = [], 0.0
    for n, (_, dur) in enumerate(stills):
        parts.append("[%d:v]format=yuv420p,loop=-1:1,trim=duration=%s,setpts=PTS-STARTPTS[v%d]" % (n, dur, n))
    last, offset = "v0", stills[0][1]
    for n in range(1, len(stills)):
        out = "x%d" % n
        parts.append("[%s][v%d]xfade=transition=fade:duration=%s:offset=%s[%s]" % (last, n, FADE, round(offset - FADE, 3), out))
        offset = offset - FADE + stills[n][1]
        last = out
    total = offset
    parts.append("[%s]fade=t=in:st=0:d=0.4,fade=t=out:st=%s:d=0.4[o]" % (last, round(total - 0.4, 3)))
    tmp = path[:-4] + ".part.mp4"
    args += ["-filter_complex", ";".join(parts), "-map", "[o]", "-r", str(FPS), "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", tmp]
    subprocess.run(args, check=True)
    os.replace(tmp, path)
    return total


def main():
    os.makedirs(OUT, exist_ok=True)
    data = json.load(open(FILM + "frames.json"))
    frames = data["frames"]
    drawn = [(frame(fr, i + 1), fr) for i, fr in enumerate(frames)]
    if sys.argv[1:] == ["frames"]:
        print("drew", len(drawn), "frames in", OUT)
        return
    files, total = [], 0.0
    total += encode([(title(OUT + "title.png"), 6.0)], OUT + "s00.mp4"); files.append(OUT + "s00.mp4")
    for s in range(1, TOTAL):
        stills = [(card(s, OUT + "card%02d.png" % s), 2.6)] + [(p, hold(fr["caption"])) for p, fr in drawn if fr["scene"] == s]
        if len(stills) == 1:
            continue
        f = OUT + "s%02d.mp4" % s
        total += encode(stills, f); files.append(f)
    total += encode([(closing(OUT + "closing.png"), 14.0)], OUT + "s11.mp4"); files.append(OUT + "s11.mp4")
    with open(OUT + "list.txt", "w") as fh:
        fh.write("".join("file '%s'\n" % f for f in files))
    final = OUT + "console.part.mp4"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", OUT + "list.txt", "-c", "copy", "-movflags", "+faststart", final], check=True)
    os.replace(final, OUT + "console.mp4")
    print("video: %.0f seconds" % total)


if __name__ == "__main__":
    main()
