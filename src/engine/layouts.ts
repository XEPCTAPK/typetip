/**
 * @fileoverview Глобальная база раскладок и конфигурация прогрессии символов TypeTip.
 * Содержит наборы символов для различных языковых раскладок клавиатуры, используемые
 * для динамической генерации и валидации упражнений. Полностью изолирован от графического слоя.
 * * 符合 Google TypeScript СТИЛЬ ПРАВИЛ // ПОСТРОЧНОЕ КОММЕНТИРОВАНИЕ
 * © The 'Just Make It Work' Group Vibe Coding Enterprises Corporation; xepctapk (ц) //™
 */

/**
 * Описывает структуру языковой раскладки клавиатуры.
 */
export interface KeyboardLayout {
  /** Понятное пользователю название раскладки (например, "Русская (ЙЦУКЕН)"). */
  name: string;
  /** Строка символов, определяющая порядок их изучения от простых к сложным. */
  progression: string;
}

/**
 * Перечисление цветовых зон подсветки пальцев для виртуальной клавиатуры.
 */
export type FingerZone = 'PINKY' | 'RING' | 'MIDDLE' | 'INDEX' | 'THUMB' | 'NONE';

/**
 * Статическая глобальная база поддерживаемых языковых раскладок.
 */
export const KEYBOARD_LAYOUTS: Record<string, KeyboardLayout> = {
  'en': {
    name: 'English (QWERTY)',
    progression: 'asdfjklghrueiwoqtybpvmcxz,.-1234567890=\\ASDFJKLGHRUEIWOQTYBPVMCXZ<>_+|'
  },
  'ru': {
    name: 'Русская (ЙЦУКЕН)',
    progression: 'аовлыфжэячсмитьбюпркекуцйнгшщзхъё1234567890-=\\АОВЛЫФЖЭЯЧСМИТЬБЮПРКЕКУЦЙНГШЩЗХЪЁ!\"№;%:?*()_+'
  },
  'de': {
    name: 'Deutsch (QWERTZ)',
    progression: 'fjdkslaöghrueiwoqptzvmc,x.bny1234567890ßüä+FJDKSLAÖGHRUEIWOQPTZVMC<X>BNY!\"§$%&/()=?`*\'_'
  },
  'fr': {
    name: 'Français (AZERTY)',
    progression: 'qsdfghjklmbyuiopezrtnxwv,c.1234567890-=QSDFGHJKLMBNYUIOPEZRTNXWV<C>_+'
  }
};

/** Map-таблица символов для быстрого определения зоны пальца. */
const CHAR_FINGER_MAP: Record<string, FingerZone> = {};
/** Map-таблица символов для определения принадлежности к левой руке. */
const LEFT_HAND_CHARS = new Set<string>();

// Внутренние макросы инициализации статических маппингов для O(1) поиска
const LAYOUT_DEFINITIONS = [
  { zone: 'PINKY', left: true, chars: '12qaz\`~qафяё!1' },
  { zone: 'RING', left: true, chars: '3wsxыцчwsx' },
  { zone: 'MIDDLE', left: true, chars: '4edcувсedc' },
  { zone: 'INDEX', left: true, chars: '56rtfgvbкепмиртгб' },
  { zone: 'THUMB', left: true, chars: ' ' },
  { zone: 'INDEX', left: false, chars: '78yuhjnmотьншлщк' },
  { zone: 'MIDDLE', left: false, chars: '9ik,шлбь' },
  { zone: 'RING', left: false, chars: '0ol.щдющд' },
  { zone: 'PINKY', left: false, chars: '-=[]\\;\',./жэяхъёзхъ' }
];

// Исполняемый блок компиляции маппингов при загрузке модуля в память
for (const def of LAYOUT_DEFINITIONS) {
  for (const char of def.chars) {
    CHAR_FINGER_MAP[char] = def.zone as FingerZone;
    CHAR_FINGER_MAP[char.toUpperCase()] = def.zone as FingerZone;
    if (def.left) {
      LEFT_HAND_CHARS.add(char);
      LEFT_HAND_CHARS.add(char.toUpperCase());
    }
  }
}

/**
 * Возвращает цветовую зону пальца для любого переданного символа.
 * @param {string} char Целевой символ для проверки.
 * @returns {FingerZone} Идентификатор анатомической зоны подсветки.
 */
export function getFingerZoneForChar(char: string): FingerZone {
  return CHAR_FINGER_MAP[char] || 'NONE';
}

/**
 * Проверяет, отвечает ли левая рука за ввод указанного символа.
 * @param {string} char Целевой символ для проверки.
 * @returns {boolean} True, если символ набирается левой рукой.
 */
export function isLeftHandChar(char: string): boolean {
  return LEFT_HAND_CHARS.has(char);
}