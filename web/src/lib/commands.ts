export type Language = 'ru' | 'en';

export interface RobotAction {
  command: string;
  label: string;
  englishLabel: string;
  description: string;
  englishDescription: string;
  color: string;
}

export interface ActionGroup {
  id: string;
  label: string;
  englishLabel: string;
  actions: RobotAction[];
}

const action = (
  command: string,
  label: string,
  englishLabel: string,
  description: string,
  englishDescription: string,
  color: string,
): RobotAction => ({
  command,
  label,
  englishLabel,
  description,
  englishDescription,
  color,
});

export const actionGroups: ActionGroup[] = [
  {
    id: 'movement',
    label: 'Движение и безопасность',
    englishLabel: 'Movement & safety',
    actions: [
      action('forward', 'Вперёд', 'Move forward', 'Один шаг вперёд', 'One step forward', '#45e6a4'),
      action(
        'backward',
        'Назад',
        'Move backward',
        'Один шаг назад',
        'One step backward',
        '#41d9e6',
      ),
      action(
        'turn_left',
        'Повернуть налево',
        'Turn left',
        'Короткий поворот',
        'Short left turn',
        '#a78bfa',
      ),
      action(
        'turn_right',
        'Повернуть направо',
        'Turn right',
        'Короткий поворот',
        'Short right turn',
        '#ff73bd',
      ),
      action(
        'approach_obstacle',
        'Идти до препятствия',
        'Walk to obstacle',
        'Подойти и остановиться',
        'Approach and stop',
        '#39d4b1',
      ),
      action('stop', 'Стоп', 'Stop', 'Немедленная остановка', 'Immediate stop', '#ff5a6b'),
    ],
  },
  {
    id: 'poses',
    label: 'Позы',
    englishLabel: 'Poses',
    actions: [
      action('sit', 'Сесть', 'Sit', 'Спокойная поза', 'Calm pose', '#ffd166'),
      action('stand', 'Встать', 'Stand', 'Готов к движению', 'Ready to move', '#41d9e6'),
      action('lie', 'Лечь', 'Lie down', 'Опуститься на пол', 'Lie on the floor', '#b08968'),
      action('sleep', 'Заснуть', 'Sleep', 'Проснуться от хлопка', 'Wake on a clap', '#7283ff'),
      action('stretch', 'Потянуться', 'Stretch', 'Мягкая разминка', 'Gentle stretch', '#39d4b1'),
      action(
        'push_up',
        'Отжиматься',
        'Do push-ups',
        'Небольшая тренировка',
        'Quick workout',
        '#ff6b72',
      ),
    ],
  },
  {
    id: 'gestures',
    label: 'Жесты и звуки',
    englishLabel: 'Gestures & sounds',
    actions: [
      action('bark', 'Подать голос', 'Bark', 'Короткий голос', 'Short bark', '#ff8a3d'),
      action(
        'wag_tail',
        'Вилять хвостом',
        'Wag tail',
        'Радостный жест',
        'Happy gesture',
        '#ff73bd',
      ),
      action(
        'shake_head',
        'Покачать головой',
        'Shake head',
        'Показать «нет»',
        'Signal no',
        '#ad8cff',
      ),
      action('nod_yes', 'Кивнуть: да', 'Nod yes', 'Показать «да»', 'Signal yes', '#76e08c'),
      action('handshake', 'Дать лапу', 'Shake hands', 'Поздороваться', 'Say hello', '#69b7ff'),
      action('high_five', 'Дать пять', 'High-five', 'Поднять лапу', 'Raise a paw', '#ffd34f'),
      action('howl', 'Выть через динамик', 'Howl', 'Протяжный вой', 'Long howl', '#8f9cff'),
    ],
  },
  {
    id: 'vision',
    label: 'Камера и зрение',
    englishLabel: 'Camera & vision',
    actions: [
      action(
        'camera_on',
        'Включить камеру',
        'Turn camera on',
        'Запустить MJPEG',
        'Start MJPEG',
        '#18d5ff',
      ),
      action(
        'camera_off',
        'Выключить камеру',
        'Turn camera off',
        'Остановить поток',
        'Stop stream',
        '#8297a3',
      ),
      action(
        'find_red',
        'Найти красный',
        'Find red',
        'Навести камеру',
        'Aim the camera',
        '#ff4b55',
      ),
      action(
        'find_orange',
        'Найти оранжевый',
        'Find orange',
        'Навести и указать лапой',
        'Aim and point',
        '#ff8500',
      ),
      action(
        'find_yellow',
        'Найти жёлтый',
        'Find yellow',
        'Навести камеру',
        'Aim the camera',
        '#ffe14f',
      ),
      action(
        'find_green',
        'Найти зелёный',
        'Find green',
        'Навести камеру',
        'Aim the camera',
        '#40df72',
      ),
      action(
        'find_blue',
        'Найти синий',
        'Find blue',
        'Навести камеру',
        'Aim the camera',
        '#4f8cff',
      ),
      action(
        'find_purple',
        'Найти фиолетовый',
        'Find purple',
        'Навести камеру',
        'Aim the camera',
        '#b45bff',
      ),
      action(
        'follow_face',
        'Следить за лицом',
        'Follow face',
        'Поворот головы',
        'Head tracking',
        '#ff63a9',
      ),
      action(
        'stop_face_follow',
        'Стоп слежение за лицом',
        'Stop face tracking',
        'Вернуть голову',
        'Center the head',
        '#8297a3',
      ),
      action(
        'follow_object',
        'Следить за предметом',
        'Follow object',
        'Предмет в центре кадра',
        'Object in frame center',
        '#a78bfa',
      ),
      action(
        'stop_object_follow',
        'Стоп слежение за предметом',
        'Stop object tracking',
        'Остановить слежение',
        'Stop tracking',
        '#8297a3',
      ),
    ],
  },
  {
    id: 'sensors',
    label: 'Сенсоры',
    englishLabel: 'Sensors',
    actions: [
      action(
        'measure_distance',
        'Измерить расстояние',
        'Measure distance',
        'Ультразвуковой датчик',
        'Ultrasonic sensor',
        '#41d9e6',
      ),
      action(
        'listen_sound',
        'Найти источник звука',
        'Find sound source',
        'Определить направление',
        'Detect direction',
        '#cc76ef',
      ),
      action(
        'show_battery',
        'Показать заряд',
        'Show battery',
        'Шкала на LED',
        'LED gauge',
        '#65e39a',
      ),
    ],
  },
  {
    id: 'lights',
    label: 'Подсветка',
    englishLabel: 'Lights',
    actions: [
      action('light_red', 'Красный', 'Red', 'Мягкое дыхание', 'Breathing effect', '#ff4b55'),
      action(
        'light_orange',
        'Оранжевый',
        'Orange',
        'Мягкое дыхание',
        'Breathing effect',
        '#ff8500',
      ),
      action('light_yellow', 'Жёлтый', 'Yellow', 'Мягкое дыхание', 'Breathing effect', '#ffe14f'),
      action('light_green', 'Зелёный', 'Green', 'Мягкое дыхание', 'Breathing effect', '#40df72'),
      action('light_blue', 'Синий', 'Blue', 'Мягкое дыхание', 'Breathing effect', '#4f8cff'),
      action(
        'light_purple',
        'Фиолетовый',
        'Purple',
        'Мягкое дыхание',
        'Breathing effect',
        '#b45bff',
      ),
      action('light_pink', 'Розовый', 'Pink', 'Мягкое дыхание', 'Breathing effect', '#ff73bd'),
      action('light_cyan', 'Голубой', 'Cyan', 'Мягкое дыхание', 'Breathing effect', '#22d7ff'),
      action('light_white', 'Белый', 'White', 'Мягкое дыхание', 'Breathing effect', '#e9f8ff'),
      action('light_blink', 'Мигать', 'Blink', 'Яркий эффект', 'Bright effect', '#ffffff'),
      action('light_off', 'Выключить', 'Turn off', 'Погасить LED', 'Turn LEDs off', '#8297a3'),
    ],
  },
  {
    id: 'microphone',
    label: 'Микрофон',
    englishLabel: 'Microphone',
    actions: [
      action(
        'local_voice_on',
        'Слушать через Пайдог',
        'Use PiDog microphone',
        'Команды без браузера',
        'Commands without browser',
        '#22d7ff',
      ),
      action(
        'local_voice_off',
        'Вернуться к браузеру',
        'Use browser microphone',
        'Остановить локальное распознавание',
        'Stop local recognition',
        '#8297a3',
      ),
    ],
  },
];

export const allActions = actionGroups.flatMap((group) => group.actions);

export function findAction(command: string): RobotAction | undefined {
  return allActions.find((item) => item.command === command);
}

export function actionLabel(command: string, language: Language): string {
  const item = findAction(command);
  if (!item) return command;
  return language === 'en' ? item.englishLabel : item.label;
}
