"""Pravi PWA ikone iz priloženog logoa (zelena podloga, beli znak). Pokreće se ručno; izlaz ide u web/public."""
import sys
from PIL import Image, ImageFilter

SRC = '/home/user/sub-19/docs/brand/logo-sub20.png'
OUT = '/home/user/sub-19/web/public/'
src = Image.open(SRC).convert('RGB')
W = src.size[0]
# podloga logoa: uzorak iz ugla (jednobojna)
bg = src.getpixel((8, 8))
print('podloga', bg)

def resized(n, im=src):
    return im.resize((n, n), Image.LANCZOS)


# jednobojni znak: alfa = koliko je piksel svetliji od podloge → beo znak na providnoj podlozi
gray = src.convert('L')
bgl = gray.getpixel((8, 8))
def alpha_of(v):
    a = (v - bgl) * 255 / (255 - bgl)
    return max(0, min(255, int(a * 1.25)))
alpha = gray.point([alpha_of(i) for i in range(256)])
def mono(n, pad=0.0):
    a = alpha.resize((n, n), Image.LANCZOS)
    if pad:
        m = int(n * pad)
        canvas = Image.new('L', (n, n), 0)
        inner = alpha.resize((n - 2 * m, n - 2 * m), Image.LANCZOS)
        canvas.paste(inner, (m, m))
        a = canvas
    out = Image.new('RGBA', (n, n), (255, 255, 255, 0))
    out.putalpha(a)
    return out
BRAND = (51, 94, 53)  # #335E35, ista zelena kao dugme u aplikaciji
FIG = src.getpixel((int(W * 0.5), int(W * 0.36)))
print('znak', FIG)
def flat(n, scale=1.0):
    '''Beli znak preko ravne marke-zelene (bez šuma izvorne slike).'''
    base = Image.new('RGB', (n, n), BRAND)
    a = alpha.resize((n, n), Image.LANCZOS)
    if scale != 1.0:
        k = int(n * scale)
        a = a.resize((k, k), Image.LANCZOS)
        full = Image.new('L', (n, n), 0)
        full.paste(a, ((n - k) // 2, (n - k) // 2))
        a = full
    fig = Image.new('RGB', (n, n), FIG)
    base.paste(fig, (0, 0), a)
    return base
for n, name in [(512, 'icon-512.png'), (192, 'icon-192.png'), (128, 'icon-128.png'), (32, 'icon-32.png')]:
    flat(n).save(OUT + name, optimize=True)
flat(180).save(OUT + 'apple-touch-icon.png', optimize=True)
flat(512, 0.64).save(OUT + 'icon-maskable-512.png', optimize=True)
mono(512, 0.10).save(OUT + 'icon-monochrome-512.png', optimize=True)
mono(96, 0.08).save(OUT + 'badge-96.png', optimize=True)
print('gotovo')
