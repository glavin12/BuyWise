"""BuyWise illustration generator — rubber-hose gullak cast.
Hand-authored vector components composed into scene plates (SVG).
Palette is the direction contract's; line work is black ink.
"""
import math, os

INK = "#161616"
CREAM = "#F3EEE2"
TOMATO = "#F0604A"
CLAY = "#E2553C"      # gullak clay, a hair deeper than the tomato block
CLAY_DK = "#B8412D"
PERI = "#6E67EE"
MARI = "#F4C443"
MINT = "#BEE3CB"
SAGE = "#9CC7AE"
CHAR = "#1B1B1D"

OUT = os.path.join(os.path.dirname(__file__), "out")
os.makedirs(OUT, exist_ok=True)

_uid = [0]
def uid(p):
    _uid[0] += 1
    return f"{p}{_uid[0]}"

def defs_halftone(pid, color=INK, op=0.38, step=6, r=1.55):
    return (f'<pattern id="{pid}" width="{step}" height="{step}" patternUnits="userSpaceOnUse" '
            f'patternTransform="rotate(18)"><circle cx="{step/2}" cy="{step/2}" r="{r}" fill="{color}" opacity="{op}"/></pattern>')

# ---------- small parts ----------
def glove(x, y, rot=0, s=1.0, flip=False):
    sx = -s if flip else s
    return f'''<g transform="translate({x},{y}) rotate({rot}) scale({sx},{s})" stroke="{INK}" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round">
  <ellipse cx="-10" cy="-13" rx="6.2" ry="10" fill="{CREAM}" transform="rotate(-14 -10 -13)"/>
  <ellipse cx="0" cy="-17" rx="6.4" ry="11" fill="{CREAM}"/>
  <ellipse cx="10" cy="-13" rx="6.2" ry="10" fill="{CREAM}" transform="rotate(14 10 -13)"/>
  <ellipse cx="-16" cy="2" rx="5.6" ry="8.5" fill="{CREAM}" transform="rotate(-48 -16 2)"/>
  <circle cx="0" cy="0" r="14" fill="{CREAM}"/>
  <path d="M-5 -2 L-4 6 M1 -3 L1 6 M6 -2 L5 6" fill="none" stroke-width="2.4"/>
  <path d="M-13 12 Q0 19 13 12 L11 22 Q0 27 -11 22 Z" fill="{CREAM}"/>
</g>'''

def shoe(x, y, s=1.0, flip=False):
    sx = -s if flip else s
    return f'''<g transform="translate({x},{y}) scale({sx},{s})" stroke="{INK}" stroke-width="3.2" stroke-linejoin="round">
  <path d="M-14 -4 C-14 -16 6 -16 14 -10 C30 -8 34 4 28 10 C18 14 -10 14 -16 10 C-20 6 -18 0 -14 -4 Z" fill="{INK}"/>
  <ellipse cx="18" cy="-3" rx="6" ry="3" fill="{CREAM}" stroke="none" transform="rotate(-12 18 -3)"/>
</g>'''

def hose(x1, y1, cx, cy, x2, y2, w=10):
    return f'<path d="M{x1} {y1} Q{cx} {cy} {x2} {y2}" fill="none" stroke="{INK}" stroke-width="{w}" stroke-linecap="round"/>'

def pie_eye(cx, cy, rx=12, ry=17, look=(2, 3), blink=False):
    if blink:
        return f'<path d="M{cx-rx} {cy+2} Q{cx} {cy-9} {cx+rx} {cy+2}" fill="none" stroke="{INK}" stroke-width="4" stroke-linecap="round"/>'
    px, py = cx + look[0], cy + look[1]
    return f'''<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="{CREAM}" stroke="{INK}" stroke-width="3.4"/>
<ellipse cx="{px}" cy="{py}" rx="{rx*0.55:.1f}" ry="{ry*0.66:.1f}" fill="{INK}"/>
<path d="M{px} {py} L{px+rx*0.25:.1f} {py-ry*0.72:.1f} L{px+rx*0.62:.1f} {py-ry*0.42:.1f} Z" fill="{CREAM}"/>'''

def sparkle(x, y, s=1.0, fill=MARI):
    return f'<path transform="translate({x},{y}) scale({s})" d="M0 -14 L3.5 -3.5 L14 0 L3.5 3.5 L0 14 L-3.5 3.5 L-14 0 L-3.5 -3.5 Z" fill="{fill}" stroke="{INK}" stroke-width="2.6" stroke-linejoin="round"/>'

def cloud(x, y, s=1.0, fill=CREAM):
    # scalloped puff cloud, 1930s smoke-puff style
    return f'''<g transform="translate({x},{y}) scale({s})" stroke="{INK}" stroke-width="3.4" stroke-linejoin="round" fill="{fill}">
  <path d="M-46 16 C-62 16 -64 -6 -48 -8 C-52 -26 -30 -34 -20 -22 C-16 -40 12 -42 16 -24 C28 -36 50 -26 44 -8 C62 -6 60 18 42 16 Z"/>
  <path d="M-40 8 C-36 0 -26 0 -24 8" fill="none" stroke-width="2.4"/>
</g>'''

def motion_lines(x, y, n=3, length=22, gap=9, rot=0):
    ls = "".join(f'<path d="M0 {i*gap} L{-length + i*5} {i*gap}" />' for i in range(n))
    return f'<g transform="translate({x},{y}) rotate({rot})" stroke="{INK}" stroke-width="3.2" stroke-linecap="round" fill="none">{ls}</g>'

def rupee_coin(x, y, r=22, s=1.0, face=False, look=(1, 2), fill=MARI, tilt=0):
    hid = uid("ht")
    body = f'''<g transform="translate({x},{y}) rotate({tilt}) scale({s})">
  <defs>{defs_halftone(hid, op=0.3, step=5, r=1.2)}</defs>
  <ellipse cx="3" cy="3" rx="{r}" ry="{r}" fill="{INK}"/>
  <circle cx="0" cy="0" r="{r}" fill="{fill}" stroke="{INK}" stroke-width="3.2"/>
  <path d="M{r*0.1:.1f} {-r:.1f} A{r} {r} 0 0 1 {r*0.1:.1f} {r:.1f} A{r*0.9:.1f} {r} 0 0 0 {r*0.1:.1f} {-r:.1f}Z" fill="url(#{hid})"/>
  <circle cx="0" cy="0" r="{r*0.74:.1f}" fill="none" stroke="{INK}" stroke-width="1.8" stroke-dasharray="2.5 3.5"/>'''
    if face:
        e = r * 0.34
        body += pie_eye(-r*0.33, -r*0.12, rx=e*0.8, ry=e*1.1, look=look) + pie_eye(r*0.33, -r*0.12, rx=e*0.8, ry=e*1.1, look=look)
        body += f'<path d="M{-r*0.3:.1f} {r*0.32:.1f} Q0 {r*0.62:.1f} {r*0.3:.1f} {r*0.32:.1f}" fill="none" stroke="{INK}" stroke-width="3" stroke-linecap="round"/>'
    else:
        body += f'<text x="0" y="{r*0.36:.1f}" text-anchor="middle" font-family="Barlow Semi Condensed, Archivo, sans-serif" font-weight="700" font-size="{r*1.05:.1f}" fill="{INK}">&#8377;</text>'
    return body + "</g>"

def coin_buddy(x, y, s=1.0, look=(1, 2), arms="up", tilt=0):
    """A walking coin sidekick with hose limbs."""
    out = f'<g transform="translate({x},{y}) rotate({tilt}) scale({s})">'
    out += hose(-12, 18, -16, 34, -20, 44, 7) + hose(12, 18, 18, 34, 22, 44, 7)
    out += shoe(-22, 48, 0.55, flip=True) + shoe(24, 48, 0.55)
    if arms == "up":
        out += hose(-22, -2, -38, -16, -40, -34, 7) + hose(22, -2, 38, -16, 40, -34, 7)
        out += glove(-40, -40, -20, 0.62) + glove(40, -40, 20, 0.62, flip=True)
    else:
        out += hose(-22, 4, -36, 10, -40, 22, 7) + hose(22, 4, 36, 10, 40, 22, 7)
        out += glove(-40, 26, 160, 0.6) + glove(40, 26, -160, 0.6, flip=True)
    out += rupee_coin(0, 0, r=26, face=True, look=look)
    return out + "</g>"

# ---------- the gullak ----------
GULLAK_BODY = "M-34 -76 C-104 -66 -116 44 -64 78 C-32 98 32 98 64 78 C116 44 104 -66 34 -76 Z"

def gullak(x, y, s=1.0, arm_l="wave", arm_r="hip", eyes="open", look=(2, 3), mouth="grin",
           legs=True, lift=0, tilt=0):
    """Rubber-hose clay gullak (Indian piggy-bank pot). Origin = belly centre, ~230 wide."""
    hid = uid("ht"); cid = uid("cl")
    g = f'<g transform="translate({x},{y}) rotate({tilt}) scale({s})">'
    g += f'<defs>{defs_halftone(hid)}<clipPath id="{cid}"><path d="{GULLAK_BODY}"/></clipPath></defs>'
    front = ""
    # legs behind body
    if legs:
        g += hose(-30, 80, -38, 104 - lift, -44, 124 - lift) + hose(30, 80, 40, 104, 50, 124)
        g += shoe(-52, 130 - lift, 1.05, flip=True) + shoe(58, 130, 1.05)
    # arms behind body (shoulders hidden by body)
    if arm_l == "wave":
        g += hose(-86, -6, -118, -20, -120, -58) + glove(-121, -70, -12, 1.0)
    elif arm_l == "hip":
        g += hose(-90, 4, -128, 22, -112, 46); front += glove(-106, 50, 130, 0.9)
    elif arm_l == "hold":
        g += hose(-88, 6, -118, 16, -122, 40) + glove(-120, 50, 170, 0.95)
    elif arm_l == "up":
        g += hose(-80, -30, -108, -70, -96, -112) + glove(-94, -124, 8, 1.0)
    if arm_r == "hip":
        g += hose(90, 4, 128, 22, 112, 46); front += glove(106, 50, -130, 0.9, flip=True)
    elif arm_r == "wave":
        g += hose(86, -6, 118, -20, 120, -58) + glove(121, -70, 12, 1.0, flip=True)
    elif arm_r == "hold":
        g += hose(88, 6, 118, 16, 122, 40) + glove(120, 50, -170, 0.95, flip=True)
    elif arm_r == "up":
        g += hose(80, -30, 108, -70, 96, -112) + glove(94, -124, -8, 1.0, flip=True)
    elif arm_r == "point":
        g += hose(88, -4, 128, -8, 150, -26) + glove(160, -32, 60, 0.95, flip=True)
    # pot foot ring
    g += f'<path d="M-44 84 C-44 100 44 100 44 84 L40 96 C30 106 -30 106 -40 96 Z" fill="{CLAY_DK}" stroke="{INK}" stroke-width="3.6" stroke-linejoin="round"/>'
    # ink offset (print misregistration) then body
    g += f'<path d="{GULLAK_BODY}" transform="translate(5,5)" fill="{INK}"/>'
    g += f'<path d="{GULLAK_BODY}" fill="{CLAY}" stroke="{INK}" stroke-width="4.2" stroke-linejoin="round"/>'
    # halftone shading on the right/bottom, clipped
    g += f'<g clip-path="url(#{cid})"><ellipse cx="58" cy="40" rx="92" ry="86" fill="url(#{hid})"/>'
    # cream highlight crescent
    g += f'<path d="M-74 -30 C-80 -2 -74 22 -60 40 C-66 12 -64 -14 -52 -40 Z" fill="{CREAM}" opacity=".85"/>'
    # painted band: marigold stripe with cream dots, like a hand-painted pot
    g += f'<path d="M-112 34 C-60 58 60 58 112 34 L112 50 C60 74 -60 74 -112 50 Z" fill="{MARI}" stroke="{INK}" stroke-width="3"/>'
    for i, bx in enumerate(range(-84, 96, 24)):
        by = 50 + 10 * math.cos(bx / 70)
        g += f'<circle cx="{bx}" cy="{by:.1f}" r="3.4" fill="{CREAM}" stroke="{INK}" stroke-width="1.8"/>'
    g += f'<path d="M-100 74 C-50 92 50 92 100 74" fill="none" stroke="{INK}" stroke-width="2.4" stroke-dasharray="1 8" stroke-linecap="round"/></g>'
    g += f'<path d="M-66 -52 Q-55 -60 -44 -52 T-22 -52 T0 -52 T22 -52 T44 -52 T66 -52" fill="none" stroke="{CREAM}" stroke-width="3.2" stroke-linecap="round" clip-path="url(#{cid})"/>'
    # neck rim + knob
    g += f'<path d="M-40 -74 C-40 -92 40 -92 40 -74 C30 -66 -30 -66 -40 -74 Z" fill="{CLAY}" stroke="{INK}" stroke-width="4" stroke-linejoin="round"/>'
    g += f'<ellipse cx="0" cy="-86" rx="30" ry="9" fill="{CLAY_DK}" stroke="{INK}" stroke-width="3.6"/>'
    g += f'<circle cx="0" cy="-100" r="11" fill="{CLAY}" stroke="{INK}" stroke-width="3.6"/>'
    # coin slot on the shoulder
    g += f'<rect x="-22" y="-64" width="44" height="9" rx="4.5" fill="{INK}" transform="rotate(-6 0 -60)"/>'
    # face
    if eyes == "open":
        g += pie_eye(-28, -24, look=look) + pie_eye(24, -24, look=look)
    elif eyes == "wink":
        g += pie_eye(-28, -24, look=look) + pie_eye(24, -24, blink=True)
    elif eyes == "sleep":
        g += pie_eye(-28, -22, blink=True) + pie_eye(24, -22, blink=True)
    g += f'<circle cx="-50" cy="4" r="8" fill="{TOMATO}" opacity=".0"/>'
    g += f'<ellipse cx="-52" cy="2" rx="9" ry="6" fill="#F58E78" /><ellipse cx="48" cy="2" rx="9" ry="6" fill="#F58E78"/>'
    if mouth == "grin":
        g += f'<path d="M-30 2 Q-2 40 28 2 Q-2 12 -30 2 Z" fill="{INK}" stroke="{INK}" stroke-width="3.4" stroke-linejoin="round"/>'
        g += f'<path d="M-12 18 Q-2 28 10 18 Q-1 12 -12 18 Z" fill="{TOMATO}"/>'
    elif mouth == "o":
        g += f'<ellipse cx="-2" cy="12" rx="9" ry="11" fill="{INK}"/><ellipse cx="-2" cy="16" rx="5" ry="4" fill="{TOMATO}"/>'
    elif mouth == "smile":
        g += f'<path d="M-20 6 Q-2 24 16 6" fill="none" stroke="{INK}" stroke-width="4" stroke-linecap="round"/>'
    elif mouth == "snore":
        g += f'<path d="M-12 10 Q-2 16 8 10" fill="none" stroke="{INK}" stroke-width="3.6" stroke-linecap="round"/>'
    return g + front + "</g>"

def envelope(x, y, w=120, h=76, fill=CREAM, rot=0, flap=MARI, label=None):
    hid = uid("ht")
    s = f'<g transform="translate({x},{y}) rotate({rot})"><defs>{defs_halftone(hid, op=.22)}</defs>'
    s += f'<rect x="{-w/2+4}" y="{-h/2+4}" width="{w}" height="{h}" rx="6" fill="{INK}"/>'
    s += f'<rect x="{-w/2}" y="{-h/2}" width="{w}" height="{h}" rx="6" fill="{fill}" stroke="{INK}" stroke-width="3.2"/>'
    s += f'<rect x="{-w/2}" y="{-h/2}" width="{w}" height="{h}" rx="6" fill="url(#{hid})"/>'
    s += f'<path d="M{-w/2} {-h/2+4} L0 {h*0.1:.1f} L{w/2} {-h/2+4}" fill="{flap}" stroke="{INK}" stroke-width="3.2" stroke-linejoin="round"/>'
    return s + "</g>"

def svg(w, h, body, bg=None):
    b = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">{b}{body}</svg>'

def save(name, content):
    p = os.path.join(OUT, name)
    with open(p, "w") as f:
        f.write(content)
    return p
