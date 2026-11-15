"""Generate the existing Taza leaf mark as installable-app icons (Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1] / 'icons'
root.mkdir(exist_ok=True)
canvas = Image.new('RGB', (2048, 2048), '#326454')
draw = ImageDraw.Draw(canvas)
scale, offset = 56, 352

def point(p):
    return (offset + p[0] * scale, offset + p[1] * scale)

def bezier(a, b, c, d):
    return [point(tuple((1-t)**3*a[i]+3*(1-t)**2*t*b[i]+3*(1-t)*t*t*c[i]+t**3*d[i] for i in (0,1))) for t in [j/100 for j in range(101)]]

outline = bezier((5,19),(5,10),(10,5),(20,4)) + bezier((20,4),(20,14),(15,19),(5,19))
draw.polygon(outline, fill='#dce8d5')
draw.line([point((4,21)),point((15,10))], fill='#fcfdf9', width=36)
for p in [(4,21),(15,10)]:
    x,y=point(p);draw.ellipse((x-18,y-18,x+18,y+18),fill='#fcfdf9')
for size, name in [(192,'app-192.png'),(512,'app-512.png'),(180,'apple-touch-icon.png')]:
    canvas.resize((size,size),Image.Resampling.LANCZOS).save(root/name,optimize=True)
