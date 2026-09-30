/* Move module: the built-in exercise catalogue (data only).
 *
 * `muscles[0]` is the main muscle, the rest are secondary. `pose2` is the
 * second frame of the demo animation. Text lives in i18n:
 * `fit.ex.<id>.name|cue|tip`.
 */
import type { Exercise, FitPlace } from './library';

type Dose = Pick<Exercise, 'mode' | 'sets' | 'reps' | 'sec'>;
type More = Partial<Pick<Exercise, 'pose2' | 'sides' | 'weighted' | 'level'>>;

const reps = (sets: number, n: number): Dose => ({ mode: 'reps', sets, reps: n });
const hold = (sets: number, sec: number): Dose => ({ mode: 'time', sets, sec });

const H: FitPlace[] = ['home'];
const O: FitPlace[] = ['outdoor'];
const G: FitPlace[] = ['gym'];
const HO: FitPlace[] = ['home', 'outdoor'];
const HG: FitPlace[] = ['home', 'gym'];
const OG: FitPlace[] = ['outdoor', 'gym'];
const ALL: FitPlace[] = ['home', 'outdoor', 'gym'];

const x = (
  id: string,
  places: FitPlace[],
  type: Exercise['type'],
  muscles: Exercise['muscles'],
  equipment: Exercise['equipment'],
  pose: Exercise['pose'],
  dose: Dose,
  more: More = {},
): Exercise => ({ id, places, type, muscles, equipment, pose, ...dose, level: 1, ...more });

export const EXERCISES: readonly Exercise[] = [
  // Bodyweight strength
  x('squat', HO, 'strength', ['quads', 'glutes', 'hamstrings'], 'none', 'squat', reps(3, 15), {
    pose2: 'stand',
  }),
  x('sumoSquat', HO, 'strength', ['adductors', 'quads', 'glutes'], 'none', 'squat', reps(3, 15), {
    pose2: 'stand',
  }),
  x('wallSit', H, 'strength', ['quads', 'glutes'], 'none', 'wallsit', hold(3, 40)),
  x('lunge', HO, 'strength', ['quads', 'glutes', 'hamstrings'], 'none', 'lunge', reps(3, 12), {
    pose2: 'stand',
  }),
  x(
    'reverseLunge',
    HO,
    'strength',
    ['glutes', 'quads', 'hamstrings'],
    'none',
    'lunge',
    reps(3, 10),
    {
      pose2: 'stand',
      sides: true,
    },
  ),
  x(
    'sideLunge',
    HO,
    'strength',
    ['adductors', 'quads', 'glutes'],
    'none',
    'sidelunge',
    reps(3, 10),
    {
      pose2: 'stand',
      sides: true,
      level: 2,
    },
  ),
  x('bulgarianSplit', H, 'strength', ['quads', 'glutes'], 'chair', 'lunge', reps(3, 10), {
    sides: true,
    level: 2,
  }),
  x('stepUp', OG, 'strength', ['quads', 'glutes'], 'bench', 'stepup', reps(3, 10), {
    pose2: 'stand',
    sides: true,
  }),
  x('calfRaise', ALL, 'strength', ['calves'], 'none', 'tiptoe', reps(3, 20), { pose2: 'stand' }),
  x('bridge', H, 'strength', ['glutes', 'hamstrings', 'lowerBack'], 'none', 'bridge', reps(3, 15), {
    pose2: 'supine',
  }),
  x('singleLegBridge', H, 'strength', ['glutes', 'hamstrings'], 'none', 'bridge', reps(3, 10), {
    pose2: 'supine',
    sides: true,
    level: 2,
  }),
  x('gluteKickback', H, 'strength', ['glutes', 'hamstrings'], 'mat', 'kickback', reps(3, 15), {
    pose2: 'quad',
    sides: true,
  }),
  x(
    'kneePushup',
    HO,
    'strength',
    ['chest', 'triceps', 'shoulders'],
    'none',
    'kneeplank',
    reps(3, 10),
    {
      pose2: 'kneelow',
    },
  ),
  x('pushup', HO, 'strength', ['chest', 'triceps', 'shoulders'], 'none', 'pushup', reps(3, 10), {
    pose2: 'pushlow',
    level: 2,
  }),
  x('inclinePushup', OG, 'strength', ['chest', 'triceps'], 'bench', 'inclinepush', reps(3, 12), {
    pose2: 'inclinelow',
  }),
  x('diamondPushup', HO, 'strength', ['triceps', 'chest'], 'none', 'pushup', reps(3, 8), {
    pose2: 'pushlow',
    level: 3,
  }),
  x('pikePushup', HO, 'strength', ['shoulders', 'triceps'], 'none', 'dog', reps(3, 8), {
    pose2: 'pikelow',
    level: 2,
  }),
  x('chairDip', H, 'strength', ['triceps', 'chest', 'shoulders'], 'chair', 'dip', reps(3, 10), {
    pose2: 'diplow',
  }),
  x('benchDip', OG, 'strength', ['triceps', 'chest'], 'bench', 'dip', reps(3, 10), {
    pose2: 'diplow',
    level: 2,
  }),
  x('pullUp', ALL, 'strength', ['lats', 'biceps', 'forearms'], 'pullupBar', 'pullup', reps(3, 6), {
    pose2: 'hang',
    level: 3,
  }),
  x(
    'invertedRow',
    OG,
    'strength',
    ['lats', 'biceps', 'traps'],
    'pullupBar',
    'invrow',
    reps(3, 10),
    {
      level: 2,
    },
  ),
  x('deadHang', ALL, 'strength', ['forearms', 'lats'], 'pullupBar', 'hang', hold(3, 30)),
  x('superman', H, 'strength', ['lowerBack', 'glutes'], 'none', 'superman', reps(2, 12), {
    pose2: 'prone',
  }),
  // Core
  x('plank', ALL, 'strength', ['abs', 'obliques', 'shoulders'], 'none', 'plank', hold(3, 40)),
  x('sidePlank', ALL, 'strength', ['obliques', 'abs'], 'none', 'sideplank', hold(3, 30), {
    sides: true,
    level: 2,
  }),
  x('crunch', H, 'strength', ['abs'], 'none', 'crunch', reps(3, 15), { pose2: 'supine' }),
  x('bicycleCrunch', H, 'strength', ['obliques', 'abs'], 'mat', 'bicycle', reps(3, 20), {
    pose2: 'supine',
    level: 2,
  }),
  x('legRaise', H, 'strength', ['abs'], 'mat', 'legraise', reps(3, 12), {
    pose2: 'supinestraight',
    level: 2,
  }),
  x('russianTwist', H, 'strength', ['obliques', 'abs'], 'mat', 'vsit', reps(3, 20), { level: 2 }),
  x('deadBug', H, 'strength', ['abs'], 'mat', 'deadbug', reps(3, 10), { sides: true }),
  x('birdDog', H, 'strength', ['lowerBack', 'glutes', 'abs'], 'mat', 'birddog', reps(3, 10), {
    pose2: 'quad',
    sides: true,
  }),
  x('hollowHold', H, 'strength', ['abs'], 'mat', 'hollow', hold(3, 30), { level: 3 }),
  // Cardio & HIIT
  x('jack', HO, 'cardio', ['calves', 'shoulders', 'quads'], 'none', 'jack', hold(2, 45), {
    pose2: 'stand',
  }),
  x('highKnees', HO, 'cardio', ['quads', 'calves', 'abs'], 'none', 'run', hold(3, 30), {
    pose2: 'walk',
  }),
  x('jumpRope', ALL, 'cardio', ['calves', 'shoulders', 'forearms'], 'rope', 'jumpup', hold(3, 60), {
    pose2: 'tiptoe',
  }),
  x('shadowBoxing', HO, 'cardio', ['shoulders', 'abs'], 'none', 'box', hold(3, 60)),
  x('stairClimb', HO, 'cardio', ['quads', 'glutes', 'calves'], 'none', 'stepup', hold(3, 120), {
    pose2: 'stand',
    level: 2,
  }),
  x('briskWalk', O, 'cardio', ['calves', 'quads', 'glutes'], 'none', 'walk', hold(1, 1800)),
  x('run', O, 'cardio', ['quads', 'calves', 'hamstrings'], 'none', 'run', hold(1, 1200), {
    pose2: 'walk',
    level: 2,
  }),
  x('rowErg', G, 'cardio', ['lats', 'quads', 'biceps'], 'machine', 'rowerg', hold(1, 600)),
  x('climber', HO, 'hiit', ['abs', 'shoulders', 'quads'], 'none', 'climber', hold(3, 30), {
    pose2: 'plank',
    level: 2,
  }),
  x('jumpSquat', HO, 'hiit', ['quads', 'glutes', 'calves'], 'none', 'jumpup', reps(3, 12), {
    pose2: 'squat',
    level: 2,
  }),
  x('skaterJump', HO, 'hiit', ['glutes', 'quads', 'adductors'], 'none', 'sidelunge', reps(3, 20), {
    pose2: 'jumpup',
    level: 2,
  }),
  x('bearCrawl', HO, 'hiit', ['shoulders', 'quads', 'abs'], 'none', 'bear', hold(3, 30), {
    pose2: 'quad',
    level: 2,
  }),
  x('burpee', HO, 'hiit', ['quads', 'chest', 'abs'], 'none', 'jumpup', reps(3, 10), {
    pose2: 'pushup',
    level: 3,
  }),
  x('sprints', O, 'hiit', ['quads', 'hamstrings', 'glutes'], 'none', 'run', hold(8, 20), {
    pose2: 'walk',
    level: 3,
  }),
  // Dumbbells, kettlebell, band
  x('gobletSquat', HG, 'strength', ['quads', 'glutes'], 'dumbbell', 'squat', reps(3, 12), {
    pose2: 'stand',
    weighted: true,
  }),
  x('dbLunge', HG, 'strength', ['quads', 'glutes'], 'dumbbell', 'lunge', reps(3, 10), {
    pose2: 'stand',
    sides: true,
    weighted: true,
    level: 2,
  }),
  x(
    'rdl',
    HG,
    'strength',
    ['hamstrings', 'glutes', 'lowerBack'],
    'dumbbell',
    'deadlift',
    reps(3, 10),
    {
      pose2: 'deadtop',
      weighted: true,
      level: 2,
    },
  ),
  x('dbRow', HG, 'strength', ['lats', 'biceps', 'traps'], 'dumbbell', 'row', reps(3, 10), {
    sides: true,
    weighted: true,
  }),
  x('dbShoulderPress', HG, 'strength', ['shoulders', 'triceps'], 'dumbbell', 'press', reps(3, 10), {
    pose2: 'pressdown',
    weighted: true,
  }),
  x('lateralRaise', HG, 'strength', ['shoulders'], 'dumbbell', 'raise', reps(3, 12), {
    pose2: 'stand',
    weighted: true,
  }),
  x('bicepsCurl', HG, 'strength', ['biceps', 'forearms'], 'dumbbell', 'curl', reps(3, 12), {
    weighted: true,
  }),
  x('hammerCurl', HG, 'strength', ['biceps', 'forearms'], 'dumbbell', 'curl', reps(3, 12), {
    weighted: true,
  }),
  x('tricepsExtension', HG, 'strength', ['triceps'], 'dumbbell', 'ohext2', reps(3, 12), {
    pose2: 'ohext',
    weighted: true,
  }),
  x('dbShrug', HG, 'strength', ['traps'], 'dumbbell', 'shrug', reps(3, 15), { weighted: true }),
  x('farmerCarry', HG, 'strength', ['forearms', 'traps', 'abs'], 'dumbbell', 'carry', hold(3, 40), {
    weighted: true,
  }),
  x('renegadeRow', HG, 'strength', ['lats', 'abs', 'biceps'], 'dumbbell', 'pushup', reps(3, 8), {
    sides: true,
    weighted: true,
    level: 3,
  }),
  x(
    'dbBenchPress',
    G,
    'strength',
    ['chest', 'triceps', 'shoulders'],
    'dumbbell',
    'bench',
    reps(3, 10),
    {
      pose2: 'benchdown',
      weighted: true,
    },
  ),
  x('thruster', HG, 'hiit', ['quads', 'shoulders', 'glutes'], 'dumbbell', 'press', reps(3, 12), {
    pose2: 'squat',
    weighted: true,
    level: 2,
  }),
  x(
    'kbSwing',
    HG,
    'hiit',
    ['glutes', 'hamstrings', 'lowerBack'],
    'kettlebell',
    'swing',
    reps(3, 15),
    {
      pose2: 'deadlift',
      weighted: true,
      level: 2,
    },
  ),
  x('bandPullApart', ALL, 'strength', ['traps', 'shoulders'], 'band', 'pullapart', reps(3, 15), {
    pose2: 'stand',
  }),
  x('bandRow', HO, 'strength', ['lats', 'biceps'], 'band', 'seatedrow', reps(3, 15)),
  // Gym
  x('backSquat', G, 'strength', ['quads', 'glutes', 'hamstrings'], 'barbell', 'squat', reps(4, 8), {
    pose2: 'stand',
    weighted: true,
    level: 2,
  }),
  x('frontSquat', G, 'strength', ['quads', 'abs', 'glutes'], 'barbell', 'squat', reps(4, 6), {
    pose2: 'stand',
    weighted: true,
    level: 3,
  }),
  x(
    'deadlift',
    G,
    'strength',
    ['hamstrings', 'glutes', 'lowerBack', 'traps'],
    'barbell',
    'deadlift',
    reps(3, 5),
    {
      pose2: 'deadtop',
      weighted: true,
      level: 2,
    },
  ),
  x('hipThrust', G, 'strength', ['glutes', 'hamstrings'], 'barbell', 'hipthrust', reps(3, 10), {
    weighted: true,
    level: 2,
  }),
  x('legPress', G, 'strength', ['quads', 'glutes'], 'machine', 'legpress', reps(3, 12), {
    pose2: 'legpress2',
    weighted: true,
  }),
  x('legExtension', G, 'strength', ['quads'], 'machine', 'legext', reps(3, 12), { weighted: true }),
  x('legCurl', G, 'strength', ['hamstrings'], 'machine', 'legcurl', reps(3, 12), {
    weighted: true,
  }),
  x(
    'benchPress',
    G,
    'strength',
    ['chest', 'triceps', 'shoulders'],
    'barbell',
    'bench',
    reps(4, 8),
    {
      pose2: 'benchdown',
      weighted: true,
      level: 2,
    },
  ),
  x(
    'inclineBench',
    G,
    'strength',
    ['chest', 'shoulders', 'triceps'],
    'barbell',
    'incline',
    reps(4, 8),
    {
      weighted: true,
      level: 2,
    },
  ),
  x('chestPress', G, 'strength', ['chest', 'triceps'], 'machine', 'seatpress', reps(3, 12), {
    weighted: true,
  }),
  x('cableFly', G, 'strength', ['chest'], 'cable', 'cablefly', reps(3, 12), {
    weighted: true,
    level: 2,
  }),
  x('latPulldown', G, 'strength', ['lats', 'biceps'], 'machine', 'pulldown', reps(3, 10), {
    pose2: 'pulldown2',
    weighted: true,
  }),
  x('cableRow', G, 'strength', ['lats', 'biceps', 'traps'], 'cable', 'seatedrow', reps(3, 12), {
    weighted: true,
  }),
  x('barbellRow', G, 'strength', ['lats', 'traps', 'biceps'], 'barbell', 'bentrow', reps(4, 8), {
    pose2: 'deadlift',
    weighted: true,
    level: 2,
  }),
  x('facePull', G, 'strength', ['traps', 'shoulders'], 'cable', 'pullapart', reps(3, 15), {
    weighted: true,
  }),
  x('overheadPress', G, 'strength', ['shoulders', 'triceps'], 'barbell', 'press', reps(3, 8), {
    pose2: 'pressdown',
    weighted: true,
    level: 2,
  }),
  x('pushdown', G, 'strength', ['triceps'], 'cable', 'pushdown', reps(3, 12), { weighted: true }),
  x('barbellCurl', G, 'strength', ['biceps', 'forearms'], 'barbell', 'curl', reps(3, 10), {
    weighted: true,
  }),
  x('hangingLegRaise', OG, 'strength', ['abs'], 'pullupBar', 'hangknee', reps(3, 10), {
    pose2: 'hang',
    level: 3,
  }),
  x('cableChop', G, 'strength', ['obliques', 'abs'], 'cable', 'chop', reps(3, 12), {
    sides: true,
    weighted: true,
    level: 2,
  }),
  x(
    'backExtension',
    G,
    'strength',
    ['lowerBack', 'glutes', 'hamstrings'],
    'machine',
    'backext',
    reps(3, 12),
  ),
  // Yoga
  x('mountain', HO, 'yoga', ['abs', 'lowerBack'], 'mat', 'stand', hold(1, 30)),
  x('sunSalutation', HO, 'yoga', ['hamstrings', 'shoulders', 'abs'], 'mat', 'dog', reps(1, 5), {
    pose2: 'stand',
    level: 2,
  }),
  x('downDog', HO, 'yoga', ['hamstrings', 'calves', 'shoulders'], 'mat', 'dog', hold(2, 45)),
  x('chairPose', HO, 'yoga', ['quads', 'glutes', 'shoulders'], 'mat', 'chairpose', hold(2, 30), {
    pose2: 'stand',
  }),
  x('warrior1', HO, 'yoga', ['quads', 'glutes', 'shoulders'], 'mat', 'warrior1', hold(1, 30), {
    sides: true,
  }),
  x('warrior2', HO, 'yoga', ['quads', 'glutes', 'adductors'], 'mat', 'warrior', hold(1, 30), {
    sides: true,
  }),
  x(
    'triangle',
    HO,
    'yoga',
    ['obliques', 'hamstrings', 'adductors'],
    'mat',
    'triangle',
    hold(1, 30),
    {
      sides: true,
    },
  ),
  x('tree', HO, 'yoga', ['calves', 'glutes', 'abs'], 'mat', 'tree', hold(1, 30), { sides: true }),
  x('boatPose', HO, 'yoga', ['abs'], 'mat', 'vsit', hold(3, 20), { level: 2 }),
  x('crow', HO, 'yoga', ['shoulders', 'abs', 'forearms'], 'mat', 'crow', hold(3, 15), { level: 3 }),
  x('cobra', HO, 'yoga', ['lowerBack', 'chest'], 'mat', 'cobra', hold(2, 30), { pose2: 'prone' }),
  x('catCow', HO, 'yoga', ['lowerBack', 'abs'], 'mat', 'cat', hold(1, 60), { pose2: 'quad' }),
  x('pigeon', HO, 'yoga', ['glutes', 'quads'], 'mat', 'pigeon', hold(1, 45), {
    sides: true,
    level: 2,
  }),
  x('reclinedTwist', HO, 'yoga', ['obliques', 'lowerBack'], 'mat', 'twistlie', hold(1, 45), {
    sides: true,
  }),
  x('child', HO, 'yoga', ['lowerBack', 'lats'], 'mat', 'child', hold(1, 60)),
  // Mobility & stretching
  x('armCircles', ALL, 'mobility', ['shoulders'], 'none', 'pullapart', reps(2, 15), {
    pose2: 'jack',
  }),
  x('neckRoll', ALL, 'mobility', ['traps'], 'none', 'neck', hold(1, 30)),
  x('shoulderCross', ALL, 'mobility', ['shoulders', 'traps'], 'none', 'shoulder', hold(1, 30), {
    sides: true,
  }),
  x('tricepsStretch', ALL, 'mobility', ['triceps', 'shoulders'], 'none', 'ohstretch', hold(1, 30), {
    sides: true,
  }),
  x('chestOpener', ALL, 'mobility', ['chest', 'shoulders'], 'none', 'chest', hold(1, 30)),
  x('inchworm', HO, 'mobility', ['hamstrings', 'shoulders', 'abs'], 'none', 'fold', reps(2, 8), {
    pose2: 'pushup',
  }),
  x(
    'worldsGreatest',
    ALL,
    'mobility',
    ['glutes', 'hamstrings', 'obliques'],
    'none',
    'lunge',
    reps(2, 5),
    {
      pose2: 'stand',
      sides: true,
      level: 2,
    },
  ),
  x(
    'forwardFold',
    ALL,
    'mobility',
    ['hamstrings', 'lowerBack', 'calves'],
    'none',
    'fold',
    hold(1, 45),
    {
      pose2: 'stand',
    },
  ),
  x('hipFlexor', ALL, 'mobility', ['quads', 'glutes'], 'none', 'lunge', hold(1, 30), {
    sides: true,
  }),
  x('quadStretch', ALL, 'mobility', ['quads'], 'none', 'quadstretch', hold(1, 30), { sides: true }),
  x('calfStretch', ALL, 'mobility', ['calves'], 'none', 'calfstretch', hold(1, 30), {
    sides: true,
  }),
  x('hamstring', HG, 'mobility', ['hamstrings', 'calves'], 'mat', 'seated', hold(1, 45)),
  x('butterfly', HG, 'mobility', ['adductors'], 'mat', 'butterfly', hold(1, 45)),
  x('seatedTwist', HG, 'mobility', ['obliques', 'lowerBack'], 'mat', 'twist', hold(1, 30), {
    sides: true,
  }),
  x('figureFour', HG, 'mobility', ['glutes', 'lowerBack'], 'mat', 'lying', hold(1, 30), {
    sides: true,
  }),
  // Pilates
  x('hundred', H, 'pilates', ['abs'], 'mat', 'hollow', hold(1, 60), { level: 2 }),
  x('rollUp', H, 'pilates', ['abs', 'hamstrings'], 'mat', 'seated', reps(2, 8), {
    pose2: 'supinestraight',
    level: 2,
  }),
  x('singleLegStretch', H, 'pilates', ['abs'], 'mat', 'deadbug', reps(2, 10), {
    sides: true,
    level: 2,
  }),
  x('swimming', H, 'pilates', ['lowerBack', 'glutes'], 'mat', 'superman', hold(3, 30), {
    pose2: 'prone',
  }),
  x('sideLegLift', H, 'pilates', ['glutes', 'adductors'], 'mat', 'sidelying', reps(2, 15), {
    sides: true,
  }),
  x('clamshell', H, 'pilates', ['glutes'], 'mat', 'clam', reps(2, 15), { sides: true }),
  x('teaser', H, 'pilates', ['abs'], 'mat', 'vsit', reps(2, 6), {
    pose2: 'supinestraight',
    level: 3,
  }),
];
