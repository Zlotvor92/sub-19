"""QA: izvlači reprezentativne frejmove i pravi listove sa simulacijom Instagram kontrola
(sigurna zona: 90 levo, 180 desno, 200 gore, 320 dole)."""
import os, subprocess, sys
from PIL import Image, ImageDraw

video = sys.argv[1]
times = [float(t) for t in sys.argv[2].split(",")]
out = sys.argv[3]
tmp = os.path.join(os.path.dirname(out), "qa_tmp")
os.makedirs(tmp, exist_ok=True)
tiles = []
for t in times:
    p = os.path.join(tmp, f"f_{t:06.2f}.png")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", video, "-frames:v", "1", p], check=True)
    im = Image.open(p).convert("RGB")
    ov = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    W, H = im.size
    sx = W / 1080
    # nebezbedne zone
    d.rectangle([0, 0, W, 200 * sx], fill=(255, 0, 0, 40))
    d.rectangle([0, H - 320 * sx, W, H], fill=(255, 0, 0, 40))
    d.rectangle([0, 0, 90 * sx, H], fill=(255, 0, 0, 40))
    d.rectangle([W - 180 * sx, 0, W, H], fill=(255, 0, 0, 40))
    # simulacija IG kontrola: ikonice desno, opis dole, traka gore
    for i, y in enumerate([1180, 1330, 1480, 1630]):
        d.ellipse([W - 120 * sx, y * sx, W - 50 * sx, (y + 70) * sx], outline=(255, 255, 255, 170), width=3)
    d.rectangle([40 * sx, 1700 * sx, 760 * sx, 1730 * sx], fill=(255, 255, 255, 90))
    d.rectangle([40 * sx, 1750 * sx, 600 * sx, 1775 * sx], fill=(255, 255, 255, 70))
    d.text((40 * sx, 90 * sx), "Reels", fill=(255, 255, 255, 200))
    im = Image.alpha_composite(im.convert("RGBA"), ov).convert("RGB")
    dd = ImageDraw.Draw(im)
    dd.text((10, 10), f"{t:.2f}s", fill=(255, 255, 0))
    tiles.append(im)
tw, th = 360, 640
cols = 4
rows = (len(tiles) + cols - 1) // cols
sheet = Image.new("RGB", (tw * cols, th * rows))
for i, im in enumerate(tiles):
    sheet.paste(im.resize((tw, th)), ((i % cols) * tw, (i // cols) * th))
sheet.save(out)
print(out)
