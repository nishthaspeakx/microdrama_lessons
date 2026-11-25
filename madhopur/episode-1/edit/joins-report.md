<!-- paths -->
Paths (use these, never a guessed one):
- scripts: `<editor-scripts>`
- references: `skill_view(name="drama-editor", file_path="references/<file>.md") (not on disk)`
- sfx: `None`
- run_dir: `edit`
- work: `edit/drama-work`
<!-- /paths -->

# Joins: edit

Every join between two generations, with its strip. Read every strip; a flag is a question, not a verdict.

## 1. c1 -> c2

![](edit/drama-work/joins/edit/01_c1__c2.jpg)

- out on: (no words in the last 4 s)
- in on: मम்मी.. पापा.....
- **repeat_look: c2 at 0.00 shows what c1 showed at 10.25, 2.6 s before its end (similarity 0.86): an action played again? Or the conversation simply goes on (shot / reverse shot): look**

## 2. c2 -> c3

![](edit/drama-work/joins/edit/02_c2__c3.jpg)

- out on: (no words in the last 4 s)
- in on: (no words in the first 4 s)
- the script here (read the strip against it):

  > मम्मी? … पापा?
  > Young Yash pushes through the maize. Through a gap, he sees a teenage boy tied to a wooden post. A red S is painted on the boy’s shirt.
  > THE TEENAGE BOY
  > रुको! मेरी रस्सी खोल दो!

- no flags

## 3. c3 -> c4

![](edit/drama-work/joins/edit/03_c3__c4.jpg)

- out on: (no words in the last 4 s)
- in on: (no words in the first 4 s)
- **still_head: c4's first second has no words and almost no movement (0.5): dead air?**

## 4. c4 -> c5

![](edit/drama-work/joins/edit/04_c4__c5.jpg)

- out on: (no words in the last 4 s)
- in on: (no words in the first 4 s)
- **continuation: c5 opens on c4's last frame again (similarity 1.00); its repeat runs to 0.167 s: start it there (r.start)**
- **repeat_look: c5 at 0.17 shows what c4 showed at 9.75, 5.2 s before its end (similarity 0.96): an action played again? Or the conversation simply goes on (shot / reverse shot): look**

## 5. c5 -> c6

![](edit/drama-work/joins/edit/05_c5__c6.jpg)

- out on: ...लगी है?
- in on: (no words in the first 4 s)
- **sliver: c5's last shot is 0.21 s**

## 6. c6 -> c7

![](edit/drama-work/joins/edit/06_c6__c7.jpg)

- out on: (no words in the last 4 s)
- in on: (no words in the first 4 s)
- **repeat_look: c7 at 2.75 shows what c6 showed at 8.00, 3.9 s before its end (similarity 0.92): an action played again? Or the conversation simply goes on (shot / reverse shot): look**

<!-- repeats -->
## Lines said twice inside a clip

None found.
<!-- /repeats -->

<!-- offscript -->
## Words not in the script

6 or more heard words in a row that the script does not have: often a stage direction the generator read aloud, which no viewer should hear. Listen to the stretch (energy.py, strip.py) and cut it where a clean cut exists; a line said its own way stays.

None found.

Shorter runs (2-5 words), each to check by ear: a line misheard or said its own way stays; a direction read aloud (a voice describing a face, a tone, a movement) is cut.

- **c5** 8.28-10.26: 'दरो मत, तुमे'
<!-- /offscript -->

<!-- pace -->
## Air: silences that run on

Shots held in silence past their beat. Trim each one whose beat has landed, the cut still on the shot change. The part given for each pace is the most it trims; cut on the frame where the reaction has read or the turn into the line starts, which differs from shot to shot. Keep a reaction that changes on the face or an action that moves the story (higher `motion`); look at the frames first: edit/drama-work/air/edit/air_00.jpg, edit/drama-work/air/edit/air_01.jpg, edit/drama-work/air/edit/air_02.jpg, edit/drama-work/air/edit/air_03.jpg, edit/drama-work/air/edit/air_04.jpg, edit/drama-work/air/edit/air_05.jpg, edit/drama-work/air/edit/air_06.jpg, edit/drama-work/air/edit/air_07.jpg, edit/drama-work/air/edit/air_08.jpg, edit/drama-work/air/edit/air_09.jpg (one row per silence, in this order; amber = the tight limit, cyan = the breathing limit).

- **c1** shot 0.00-1.88, no line: silent 0.00-1.88, some movement (motion 3.74); keep 0.00-1.12 (tight, saves 0.8 s), 0.00-1.62 (breathing, saves 0.2 s)
- **c1** shot 4.75-6.21, no line: silent 4.75-6.21, still (motion 2.06); keep 4.75-5.75 (tight, saves 0.5 s), whole (breathing)
- **c1** shot 8.12-10.42, no line: silent 8.12-10.42, some movement (motion 5.69); keep 8.12-9.12 (tight, saves 1.3 s), 8.12-9.62 (breathing, saves 0.8 s)
- **c1** shot 10.42-11.96, no line: silent 10.42-11.96, some movement (motion 7.24); keep 10.42-11.42 (tight, saves 0.5 s), 10.42-11.92 (breathing, saves 0.0 s)
- **c2** shot 0.00-1.79, no line: silent 0.00-1.79, some movement (motion 3.48); keep 0.00-1.12 (tight, saves 0.7 s), 0.00-1.62 (breathing, saves 0.2 s)
- **c2** shot 5.54-7.71, no line: silent 5.54-7.71, some movement (motion 5.44); keep 5.54-6.54 (tight, saves 1.2 s), 5.54-7.04 (breathing, saves 0.7 s)
- **c3** shot 0.00-2.67, no line: silent 0.00-2.67, still (motion 1.49); keep 0.00-1.12 (tight, saves 1.5 s), 0.00-1.62 (breathing, saves 1.0 s)
- **c3** shot 2.67-4.62, no line: silent 2.67-4.62, moving (motion 25.19): an action, keep it unless it repeats; keep 2.67-4.07 (tight, saves 0.6 s), whole (breathing)
- **c3** shot 7.00-10.00, before a line ('रुको! मेरी रसा खोल'): silent 7.00-7.90, moving (motion 16.17): an action, keep it unless it repeats; keep 7.55-10.00 (tight, saves 0.6 s), whole (breathing)
- **c3** shot 12.00-13.88, no line: silent 12.00-13.88, some movement (motion 4.76); keep 12.00-13.00 (tight, saves 0.9 s), 12.00-13.50 (breathing, saves 0.4 s)
- **c3** shot 13.88-16.00, no line: silent 13.88-16.00, moving (motion 16.69): an action, keep it unless it repeats; keep 13.88-15.28 (tight, saves 0.7 s), 13.88-15.97 (breathing, saves 0.0 s)
- **c3** shot 16.00-17.88, no line: silent 16.00-17.88, moving (motion 19.33): an action, keep it unless it repeats; keep 16.00-17.40 (tight, saves 0.5 s), whole (breathing)
- **c4** shot 5.00-6.50, no line: silent 5.00-6.50, some movement (motion 7.95); keep 5.00-6.00 (tight, saves 0.5 s), whole (breathing)
- **c4** shot 9.88-11.62, no line: silent 9.88-11.62, moving (motion 9.31): an action, keep it unless it repeats; keep 9.88-11.28 (tight, saves 0.3 s), whole (breathing)
- **c4** shot 11.62-13.50, no line: silent 11.62-13.50, moving (motion 9.89): an action, keep it unless it repeats; keep 11.62-13.03 (tight, saves 0.5 s), whole (breathing)
- **c4** shot 13.50-14.96, no line: silent 13.50-14.96, some movement (motion 5.21); keep 13.50-14.50 (tight, saves 0.5 s), whole (breathing)
- **c5** shot 5.92-7.92, no line: silent 5.92-7.92, moving (motion 12.99): an action, keep it unless it repeats; keep 5.92-7.32 (tight, saves 0.6 s), whole (breathing)
- **c5** shot 11.12-12.75, no line: silent 11.12-12.75, some movement (motion 5.1); keep 11.12-12.12 (tight, saves 0.6 s), 11.12-12.62 (breathing, saves 0.1 s)
- **c5** shot 12.75-14.54, no line: silent 12.75-14.54, some movement (motion 4.9); keep 12.75-13.75 (tight, saves 0.8 s), 12.75-14.25 (breathing, saves 0.3 s)
- **c6** shot 0.00-2.88, no line: silent 0.00-2.88, some movement (motion 4.7); keep 0.00-1.12 (tight, saves 1.8 s), 0.00-1.62 (breathing, saves 1.2 s)
- **c6** shot 4.54-6.62, no line: silent 4.54-6.62, still (motion 0.25); keep 4.54-5.54 (tight, saves 1.1 s), 4.54-6.04 (breathing, saves 0.6 s)
- **c6** shot 8.12-10.04, no line: silent 8.12-10.04, still (motion 0.36); keep 8.12-9.12 (tight, saves 0.9 s), 8.12-9.62 (breathing, saves 0.4 s)
- **c6** shot 10.04-11.92, no line: silent 10.04-11.92, moving (motion 12.21): an action, keep it unless it repeats; keep 10.04-11.44 (tight, saves 0.5 s), whole (breathing)
- **c7** shot 0.00-2.54, no line: silent 0.00-2.54, still (motion 1.01); keep 0.00-1.12 (tight, saves 1.4 s), 0.00-1.62 (breathing, saves 0.9 s)
- **c7** shot 2.54-5.42, before a line ('सुमन'): silent 2.54-4.30, still (motion 2.71); keep 3.95-5.42 (tight, saves 1.4 s), 3.80-5.42 (breathing, saves 1.3 s)
- **c7** shot 6.71-8.54, no line: silent 6.71-8.54, moving (motion 8.1): an action, keep it unless it repeats; keep 6.71-8.11 (tight, saves 0.4 s), whole (breathing)
- **c7** shot 9.83-11.38, no line: silent 9.83-11.38, some movement (motion 3.21); keep 9.83-10.83 (tight, saves 0.5 s), 9.83-11.33 (breathing, saves 0.0 s)
- **c7** shot 11.38-12.96, no line: silent 11.38-12.96, some movement (motion 4.66); keep 11.38-12.38 (tight, saves 0.6 s), 11.38-12.88 (breathing, saves 0.1 s)
<!-- /pace -->
