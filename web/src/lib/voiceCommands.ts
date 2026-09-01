import type { Language } from './commands';

export interface VoiceMatch {
  command: string;
  score: number;
  sourcePhrase: string;
}

type AliasMap = Record<string, string[]>;

const ru: AliasMap = {
  stop: [
    'стоп',
    'стой',
    'остановись',
    'остановиться',
    'замри',
    'не двигайся',
    'прекрати',
    'хватит',
    'останови движение',
  ],
  forward: [
    'вперед',
    'иди вперед',
    'шагай вперед',
    'двигайся вперед',
    'пошел вперед',
    'прямо',
    'иди прямо',
  ],
  approach_obstacle: [
    'иди до препятствия',
    'иди вперед до препятствия',
    'найди препятствие',
    'остановись перед препятствием',
    'подойди к предмету',
  ],
  backward: ['назад', 'иди назад', 'шагай назад', 'двигайся назад', 'отойди назад', 'сдай назад'],
  turn_left: ['налево', 'поверни налево', 'поворот налево', 'влево', 'поверни влево'],
  turn_right: ['направо', 'поверни направо', 'поворот направо', 'вправо', 'поверни вправо'],
  sit: ['сидеть', 'сесть', 'сядь', 'садись', 'присядь'],
  stand: ['встать', 'встань', 'поднимись', 'стой смирно', 'на ноги'],
  lie: ['лежать', 'лечь', 'ляг', 'ложись', 'приляг'],
  bark: ['голос', 'подай голос', 'гав', 'гавкни', 'лай', 'залаяй', 'лай три раза'],
  wag_tail: [
    'хвост',
    'виляй хвостом',
    'повиляй хвостом',
    'вильни хвостом',
    'помаши хвостом',
    'махай хвостом',
  ],
  shake_head: ['покачай головой', 'потряси головой', 'качай головой'],
  nod_yes: ['кивни', 'скажи да', 'покажи да', 'да головой'],
  stretch: ['потянись', 'потягушки', 'сделай потягушки', 'растяжка', 'сделай растяжку'],
  push_up: ['отжимайся', 'отожмись', 'сделай отжимание', 'сделай отжимания'],
  handshake: ['дай лапу', 'лапу', 'пожми руку'],
  high_five: ['дай пять', 'дай мне пять', 'пять', 'ладушки', 'хай файв'],
  howl: ['вой', 'завой', 'выть', 'повой'],
  sleep: ['спать', 'засыпай', 'усни', 'дремать', 'отдыхай'],
  measure_distance: [
    'измерь расстояние',
    'расстояние до предмета',
    'скажи расстояние',
    'какое расстояние',
    'дистанция',
    'что впереди',
  ],
  listen_sound: ['слушай звук', 'найди звук', 'откуда звук', 'слушай хлопок'],
  local_voice_on: [
    'слушай меня',
    'слушай команды',
    'включи голосовое управление',
    'перейди в режим слушать',
    'принимай команды с микрофона',
  ],
  local_voice_off: [
    'перестань слушать',
    'хватит слушать',
    'выключи голосовое управление',
    'отключи голосовое управление',
    'принимай команды с телефона',
  ],
  show_battery: [
    'покажи заряд',
    'сколько заряда',
    'заряд батареи',
    'покажи батарею',
    'покажи заряд светодиодами',
  ],
  find_orange: [
    'найди оранжевый',
    'найди оранжевый цвет',
    'найти оранжевый цвет',
    'покажи оранжевый',
    'где оранжевая банка',
    'найди оранжевую баночку',
    'выбери оранжевую банку',
  ],
  find_red: [
    'найди красный',
    'найди красный цвет',
    'найти красный цвет',
    'покажи красный',
    'где красная банка',
  ],
  find_yellow: [
    'найди желтый',
    'найди желтый цвет',
    'найти желтый цвет',
    'покажи желтый',
    'где желтая банка',
  ],
  find_green: [
    'найди зеленый',
    'найди зеленый цвет',
    'найти зеленый цвет',
    'покажи зеленый',
    'где зеленая банка',
  ],
  find_blue: [
    'найди синий',
    'найди синий цвет',
    'найти синий цвет',
    'покажи синий',
    'где синяя банка',
  ],
  find_purple: [
    'найди фиолетовый',
    'найди фиолетовый цвет',
    'найти фиолетовый цвет',
    'покажи фиолетовый',
    'где фиолетовая банка',
  ],
  follow_face: ['следи за лицом', 'следуй за лицом', 'найди лицо', 'смотри на меня'],
  stop_face_follow: [
    'перестань следить за лицом',
    'не следи за лицом',
    'останови слежение за лицом',
  ],
  follow_object: [
    'следи за предметом',
    'следуй за предметом',
    'следи за объектом',
    'следи за тем что в центре',
    'запомни предмет в центре',
  ],
  stop_object_follow: [
    'перестань следить за предметом',
    'не следи за предметом',
    'останови слежение за предметом',
    'перестань следить за объектом',
  ],
  camera_on: ['включи камеру', 'запусти камеру', 'покажи камеру'],
  camera_off: ['выключи камеру', 'останови камеру', 'закрой камеру'],
  light_red: ['красный свет', 'включи красный', 'свети красным'],
  light_orange: ['оранжевый свет', 'включи оранжевый', 'свети оранжевым'],
  light_yellow: ['желтый свет', 'включи желтый', 'свети желтым'],
  light_green: ['зеленый свет', 'включи зеленый', 'свети зеленым'],
  light_blue: ['синий свет', 'включи синий', 'свети синим'],
  light_purple: ['фиолетовый свет', 'включи фиолетовый', 'свети фиолетовым'],
  light_pink: ['розовый свет', 'включи розовый', 'свети розовым'],
  light_cyan: ['голубой свет', 'включи голубой', 'свети голубым'],
  light_white: ['белый свет', 'включи белый', 'свети белым'],
  light_blink: ['мигай светом', 'моргай светом', 'мигай лампочками'],
  light_off: ['выключи свет', 'погаси свет', 'свет выключить'],
};

const en: AliasMap = {
  stop: ['stop', 'halt', 'freeze', 'stop moving', 'do not move', 'cancel'],
  forward: ['forward', 'go forward', 'move forward', 'walk forward', 'go straight'],
  approach_obstacle: [
    'go until obstacle',
    'walk to the obstacle',
    'stop before the obstacle',
    'approach object',
  ],
  backward: ['back', 'backward', 'go back', 'move backward', 'step back'],
  turn_left: ['left', 'turn left', 'go left', 'rotate left'],
  turn_right: ['right', 'turn right', 'go right', 'rotate right'],
  sit: ['sit', 'sit down', 'take a seat'],
  stand: ['stand', 'stand up', 'get up'],
  lie: ['lie', 'lie down', 'lay down'],
  bark: ['bark', 'speak', 'make a sound', 'woof'],
  wag_tail: ['wag tail', 'wag your tail', 'move your tail'],
  shake_head: ['shake head', 'shake your head'],
  nod_yes: ['nod', 'nod yes', 'say yes'],
  stretch: ['stretch', 'do a stretch'],
  push_up: ['push up', 'push ups', 'do push ups'],
  handshake: ['shake hands', 'give paw', 'paw'],
  high_five: ['high five', 'give me five'],
  howl: ['howl', 'start howling'],
  sleep: ['sleep', 'go to sleep', 'take a nap', 'rest'],
  measure_distance: ['measure distance', 'what is the distance', 'distance', 'what is ahead'],
  listen_sound: ['listen', 'listen for sound', 'find sound', 'where is the sound'],
  local_voice_on: [
    'listen to me',
    'listen for commands',
    'use your microphone',
    'turn on local voice control',
  ],
  local_voice_off: ['stop listening', 'use the phone microphone', 'turn off local voice control'],
  show_battery: ['show battery', 'battery level', 'show charge', 'how much battery'],
  find_orange: ['find orange', 'show orange', 'where is orange'],
  find_red: ['find red', 'show red', 'where is red'],
  find_yellow: ['find yellow', 'show yellow', 'where is yellow'],
  find_green: ['find green', 'show green', 'where is green'],
  find_blue: ['find blue', 'show blue', 'where is blue'],
  find_purple: ['find purple', 'show purple', 'where is purple'],
  follow_face: ['follow face', 'track face', 'look at me'],
  stop_face_follow: ['stop following face', 'stop face tracking', 'do not track face'],
  follow_object: [
    'follow object',
    'track object',
    'follow centered object',
    'track what is in the center',
  ],
  stop_object_follow: ['stop following object', 'stop object tracking', 'do not track object'],
  camera_on: ['turn camera on', 'start camera', 'show camera'],
  camera_off: ['turn camera off', 'stop camera', 'close camera'],
  light_red: ['red light', 'turn on red', 'light red'],
  light_orange: ['orange light', 'turn on orange', 'light orange'],
  light_yellow: ['yellow light', 'turn on yellow', 'light yellow'],
  light_green: ['green light', 'turn on green', 'light green'],
  light_blue: ['blue light', 'turn on blue', 'light blue'],
  light_purple: ['purple light', 'turn on purple', 'light purple'],
  light_pink: ['pink light', 'turn on pink', 'light pink'],
  light_cyan: ['cyan light', 'turn on cyan', 'light cyan'],
  light_white: ['white light', 'turn on white', 'light white'],
  light_blink: ['blink lights', 'flash lights', 'blinking lights'],
  light_off: ['turn lights off', 'lights off', 'switch off lights'],
};

const fillers = {
  ru: new Set([
    'пайдог',
    'пес',
    'песик',
    'собака',
    'собачка',
    'робот',
    'эй',
    'ну',
    'давай',
    'пожалуйста',
    'команда',
    'теперь',
    'быстро',
  ]),
  en: new Set([
    'pidog',
    'pie',
    'dog',
    'puppy',
    'robot',
    'hey',
    'please',
    'command',
    'now',
    'quickly',
    'can',
    'you',
  ]),
};

const movement = new Set(['forward', 'backward', 'turn_left', 'turn_right']);
const rejectedTokens = new Set(['не', 'нет', 'отмена', 'not', 'don', 'never', 'cancel']);

export function normalizeVoicePhrase(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('ru-RU')
    .replaceAll('ё', 'е')
    .replace(/[^a-zа-я0-9]+/gu, ' ')
    .trim()
    .replace(/\s+/gu, ' ');
}

function withoutFillers(value: string, language: Language): string {
  return value
    .split(' ')
    .filter((token) => !fillers[language].has(token))
    .join(' ');
}

function includesPhrase(text: string, phrase: string): boolean {
  return ` ${text} `.includes(` ${phrase} `);
}

function levenshtein(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitution =
        (previous[rightIndex - 1] ?? 0) + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1);
      current[rightIndex] = Math.min(
        (current[rightIndex - 1] ?? 0) + 1,
        (previous[rightIndex] ?? 0) + 1,
        substitution,
      );
    }
    previous = current;
  }
  return previous[right.length] ?? 0;
}

function similarity(candidate: string, alias: string): number {
  if (candidate === alias) return 1;
  if ([...rejectedTokens].some((token) => includesPhrase(candidate, token))) return 0;
  const aliasWords = alias.split(' ').length;
  const candidateWords = candidate.split(' ').length;
  if (aliasWords >= 2 && includesPhrase(candidate, alias)) return 0.965;
  if (aliasWords === 1 && candidateWords <= 3 && includesPhrase(candidate, alias)) return 0.935;
  const maxLength = Math.max(candidate.length, alias.length);
  return maxLength === 0 ? 0 : 1 - levenshtein(candidate, alias) / maxLength;
}

function bestCandidate(
  source: string,
  language: Language,
): Omit<VoiceMatch, 'sourcePhrase'> | null {
  const candidate = withoutFillers(normalizeVoicePhrase(source), language);
  if (!candidate) return null;
  let best: Omit<VoiceMatch, 'sourcePhrase'> | null = null;
  for (const [command, aliases] of Object.entries(language === 'en' ? en : ru)) {
    for (const alias of aliases) {
      const score = similarity(candidate, normalizeVoicePhrase(alias));
      const threshold = movement.has(command) ? 0.91 : 0.86;
      if (score >= threshold && (!best || score > best.score)) best = { command, score };
    }
  }
  return best;
}

export function matchVoiceCommand(hypotheses: string[], language: Language): VoiceMatch | null {
  const matches = hypotheses
    .slice(0, 8)
    .flatMap((sourcePhrase, index) => {
      const candidate = bestCandidate(sourcePhrase, language);
      return candidate
        ? [{ ...candidate, score: candidate.score - index * 0.006, sourcePhrase }]
        : [];
    })
    .toSorted((left, right) => right.score - left.score);
  const best = matches[0];
  if (!best) return null;
  const runnerUp = matches.find((match) => match.command !== best.command);
  if (runnerUp && best.score - runnerUp.score < 0.035) return null;
  return best;
}
