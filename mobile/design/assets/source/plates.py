"""Scene plates for BuyWise screens, composed from gen.py's rubber-hose cast."""
from gen import *

def ground_shadow(x, y, rx=60, ry=9, op=.18):
    return f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{INK}" opacity="{op}"/>'

def hill(w, y, fill=SAGE, amp=18):
    return (f'<path d="M0 {y} C{w*0.2} {y-amp} {w*0.35} {y-amp} {w*0.5} {y-4} '
            f'C{w*0.66} {y+8} {w*0.8} {y-amp-6} {w} {y-6} L{w} {y+400} L0 {y+400} Z" '
            f'fill="{fill}" stroke="{INK}" stroke-width="3.2"/>')

def falling_coin(x, y, r=13, tilt=0):
    return motion_lines(x + 7, y - r - 5, n=3, length=15, gap=7, rot=90) + rupee_coin(x, y, r=r, tilt=tilt)

# ---- A. Login hero: coins dropping into the gullak ----
def login_hero():
    W, H = 390, 372
    b = ""
    # big sun disc + rays behind
    b += f'<circle cx="198" cy="176" r="128" fill="{MINT}" stroke="{INK}" stroke-width="3.2"/>'
    rays = "".join(
        f'<path d="M{198+140*math.cos(a):.1f} {176+140*math.sin(a):.1f} L{198+162*math.cos(a):.1f} {176+162*math.sin(a):.1f}"/>'
        for a in [i*math.pi/10 for i in range(20)])
    b += f'<g stroke="{INK}" stroke-width="3" stroke-linecap="round">{rays}</g>'
    b += hill(W, 322, fill=SAGE, amp=22)
    b += cloud(70, 74, 0.95) + cloud(338, 120, 0.62)
    b += sparkle(46, 184, 0.9) + sparkle(352, 44, 1.05, fill=CREAM) + sparkle(300, 214, 0.7, fill=TOMATO)
    b += falling_coin(236, 34, r=14, tilt=-14) + falling_coin(266, 70, r=11, tilt=20)
    b += ground_shadow(196, 346, 92, 10)
    b += gullak(192, 214, 0.92, arm_l="wave", arm_r="hip", look=(4, -2))
    b += ground_shadow(58, 356, 30, 6)
    b += coin_buddy(58, 304, 0.74, look=(3, -1), arms="up", tilt=-8)
    return svg(W, H, b)

# ---- B. Budget front card: gullak juggling envelopes ----
def budget_plate():
    W, H = 330, 238
    b = ""
    b += cloud(52, 118, 0.7) + cloud(290, 70, 0.55)
    b += sparkle(30, 40, 0.8, fill=CREAM) + sparkle(304, 150, 0.7, fill=TOMATO)
    b += envelope(82, 44, 78, 50, fill=CREAM, rot=-16, flap=TOMATO)
    b += envelope(250, 30, 72, 46, fill=PERI, rot=14, flap=CREAM)
    b += motion_lines(40, 58, n=3, length=18, gap=8, rot=24)
    b += gullak(166, 168, 0.72, arm_l="up", arm_r="up", eyes="wink", mouth="grin", look=(0, -3))
    b += envelope(166, 58, 86, 54, fill=MINT, rot=-4, flap=MARI)
    return svg(W, H, b)

# ---- C. Avatars ----
def avatar_user():
    # gullak face crop inside a coral disc
    b = f'<defs><clipPath id="avc"><circle cx="40" cy="40" r="38"/></clipPath></defs>'
    b += f'<circle cx="40" cy="40" r="38" fill="{MARI}"/>'
    b += f'<g clip-path="url(#avc)">{gullak(40, 66, 0.52, arm_l="none", arm_r="none", legs=False, look=(2, 2))}</g>'
    b += f'<circle cx="40" cy="40" r="38" fill="none" stroke="{INK}" stroke-width="3"/>'
    return svg(80, 80, b)

def avatar_ai():
    b = f'<circle cx="40" cy="40" r="38" fill="{MINT}" stroke="{INK}" stroke-width="3"/>'
    b += rupee_coin(40, 42, r=25, face=True, look=(2, 1))
    b += sparkle(64, 16, 0.5, fill=MARI)
    return svg(80, 80, b)

# ---- D. Empty-ish sleeping gullak for chat welcome (small) ----
def goal_badge():
    W, H = 120, 120
    b = coin_buddy(60, 58, 0.9, arms="up", look=(0, -2))
    return svg(W, H, b)

if __name__ == "__main__":
    for name, fn in [("login_hero.svg", login_hero), ("budget_plate.svg", budget_plate),
                     ("avatar_user.svg", avatar_user), ("avatar_ai.svg", avatar_ai),
                     ("goal_badge.svg", goal_badge)]:
        print(save(name, fn()))
