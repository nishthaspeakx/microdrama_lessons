import os, sys
sys.path.insert(0, os.environ["DRAMA_SKILL_SCRIPTS"])
from edlkit import Run, save

R = "edit"
r = Run(R)
seg = lambda c, a, b, **kw: dict(clip=c, **{"in": a, "out": b}, **kw)

card_style = dict(
    font="Cormorant Garamond", weight=600, italic=False, size=100, upper=True, track=8,
    fill=[246, 238, 220], shadow="soft",
    caption_font="Cormorant Garamond", caption_weight=500, caption_size=76, caption_fill=[226, 190, 120],
    caption_upper=True, caption_track=10,
    rule="accent", rule_width=0.35, rule_size=4, rule_color=[226, 190, 120],
    align="left", y=0.74, shade=0.25,
)

segments = [
    seg("c1", r.start("c1"), 1.25, note="air: the market street reads in a second; out at 1.25 so the fireball is on screen before the third second; picture 07b3: a still wide of the street with walkers, read at 1.1 s, kept short on purpose for the three-second fireball"),
    seg("c1", 1.875, r.dur("c1"), note="Meera looks up, the fireball, the glass, her mother's wave with closed lips, her own wave, the dust wall, her face in the dust: all whole"),
    seg("c2", r.start("c2"), 8.25, note="join: c2 opens behind Meera on the thinning dust, a new angle and not c1's dust wall again, both kept; her call, the listening beat and her second call whole; air: she stands still by the shopfront after 8.25"),
    seg("c2", 8.667, r.dur("c2"), note="the close on her eyes ends her search"),
    seg("c3", r.start("c3"), 11.0, note="join: a new beat in the same street, the villagers look up; the blazing object, the old shopkeeper, the torn fields, the ducking villagers and the crushed shops alternate as asked, all whole; air: the plume over the distant shops has read by 11.0"),
    seg("c3", 11.667, 13.2, note="air: the young man's stare at the horizon has read by 13.2"),
    seg("c3", 13.625, r.dur("c3"), note="the landing is felt: the villagers stagger and the street shakes, held to the end of the rumble"),
    seg("c4", r.start("c4"), 1.75, note="join: a scene change from the shaking street to the farm road; the road's first second is still, so the pickup's approach is kept to 1.6 s"),
    seg("c4", 2.542, r.dur("c4"), note="the cab, the streak, the brake, the ditch, the jolt, Suman slumped: short shots, all whole"),
    seg("c5", r.start("c5"), 14.25, note="join: c5 opened on c4's last frame again, starts after the repeat at 0.167; the truck in the ditch from outside is a new angle with the dust settled, kept; Suman's line whole; air: the boy's look up has read by 14.25; join: the 0.21 s sliver of Devendra climbing out at 14.54 is cut on its shot change"),
    seg("c6", r.start("c6"), 2.1, note="air: Devendra's look up past the boy has read by 2.1"),
    seg("c6", 2.792, r.dur("c6"), note="the torn field, then the slow tilt up the towering craft held whole as asked, Devendra, the low hatch, Suman's look"),
    seg("c7", r.start("c7"), 1.7, note="join: c7 opened on c6's last frame again, starts after the repeat at 0.167; the three small under the craft is a new wide, kept to 1.5 s as nothing moves after it"),
    seg("c7", 2.667, r.dur("c7"), note="join: Devendra's close is the shot of his line, not c6's look again; Suman, the boy's two hands, her look down, then the boy from the chest up held whole: his eyes turn blue and one pulse of light shows at his collar, the episode ends on him"),
    dict(black=1.0, note="the script's Cut to black"),
]
cards = [
    dict(type="time", at=["c1", 0.2], dur=1.0, text="2014", pos="high"),
    dict(type="name", at=["c1", 1.95], dur=1.3, name="Young Meera"),
    dict(type="name", at=["c4", 2.6], dur=1.05, name="Devendra", align="left"),
    dict(type="name", at=["c4", 3.78], dur=1.15, name="Suman", align="right"),
]
edl = dict(run=R, card_style=card_style, pace="breathing", ending="cut", segments=segments, cards=cards, sfx=[], subtitles=True)
if __name__ == "__main__":
    print(save(edl))
