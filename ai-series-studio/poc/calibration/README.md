# Face identity calibration on Episode 1

Run on 26 November 2026 with `python -m studio faces-calibrate`. Raw data: `faces-episode1.json`.

Models: OpenCV YuNet for detection and SFace for recognition, both from the official OpenCV model zoo. Frames were sampled every 0.5 s from the seven clips in the approved Episode 1 cut.

## Results

| Comparison | Faces | Cosine similarity |
|---|---|---|
| Same person: face reference against the character sheet | 7 | 0.68 to 0.94, median 0.78 |
| Different people: face references against each other | 15 pairs | median 0.17, highest 0.43 (Meera against the boy) |
| Villagers in clip 3, not in the cast | 15 | 0.14 to 0.28 |
| Cast faces in accepted takes | 99 | medians 0.57 (Suman) to 0.76 (Meera) |

Scores below 0.40 in accepted takes came almost entirely from small faces in two-shots and wide shots. They also came from turned heads.

## Rule adopted for Episode 2

1. Score only faces at least 120 px wide in the source frame. Smaller faces are reported as "not scored".
2. **Pass** at a similarity of 0.40 or more to the intended character.
3. **Unsure** between 0.30 and 0.40. These go to the identity judge for a second opinion.
4. **Fail** below 0.30. These are probably a different person.
5. **Children need a margin.** Two child references, Meera and the boy, score 0.43 against each other. For protected characters, the intended character must also beat every other cast member by at least 0.10.

Under this rule the approved Episode 1 passes 69 of 72 scorable faces, which is 96%. Another 30 faces were too small to score. That 96% is the baseline for PoC criterion 2, which needs at least 90%.

## Limits

- No takes were rejected for identity in Episode 1, so the false-pass rate is not measured yet. Episode 2's rejected takes become the labelled failure set.
- SFace was trained mostly on adult faces, and child faces separate less well. Veer at five, eight, eleven, thirteen and seventeen is the hardest case. Each age must be scored against its own look's reference, and aging across looks is checked by a person.
