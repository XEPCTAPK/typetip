/**
 * @fileoverview Единая изолированная резервация цветовых палитр TypeTip Studio.
 * Хранит жестко фиксированные 256-цветные ANSI-последовательности.
 * Защищает интерфейс от инверсии цветов и выжигания глаз при смене глобальных тем VS Code.
 * * 符合 Google TypeScript СТИЛЬ ПРАВИЛ // ПОСТРОЧНОЕ КОММЕНТИРОВАНИЕ
 * © The 'Just Make It Work' Group Vibe Coding Enterprises Corporation; xepctapk (ц) //™
 */

/**
 * Контракт интерфейсной палитры оформления.
 */
export interface IThemePalette {
  PRIMARY: string;
  ERROR: string;
  DIM: string;
  RESET: string;
  BOLD: string;

  ACCENT_BLUE: string;
  ACCENT_YELLOW: string;

  FINGER_YELLOW: string;
  FINGER_CYAN: string;
  FINGER_MAGENTA: string;
  FINGER_GREEN: string;
  FINGER_WHITE: string;
}

/**
 * Статический реестр палитр TypeTip Studio.
 */
export const PALETTES = {
  /** ТЕМНАЯ СХЕМА (Neon Cyberpunk) */
  DARK: {
    PRIMARY: '\x1b[38;5;81m',       // Электрический лазурный (Electric Cyan)
    ERROR:   '\x1b[38;5;197m',      // Неоновый красный/маджента
    DIM:     '\x1b[38;5;242m',      // Приглушенный пепельно-серый
    RESET:   '\x1b[0m',
    BOLD:    '\x1b[1m',

    ACCENT_BLUE:   '\x1b[38;5;39m',
    ACCENT_YELLOW: '\x1b[38;5;220m',

    FINGER_YELLOW:  '\x1b[1;38;5;220m', // Жирный + Золотистый
    FINGER_CYAN:    '\x1b[1;38;5;44m',  // Жирный + Бирюзовый
    FINGER_MAGENTA: '\x1b[1;38;5;201m', // Жирный + Пурпурный
    FINGER_GREEN:   '\x1b[1;38;5;82m',  // Жирный + Ярко-салатовый
    FINGER_WHITE:   '\x1b[1;38;5;255m'  // Жирный + Чистый белый
  } as IThemePalette,

  /** СВЕТЛАЯ СХЕМА (Ink Minimalist) */
  LIGHT: {
    PRIMARY: '\x1b[38;5;21m',       // Глубокий синий (Ink Blue)
    ERROR:   '\x1b[38;5;160m',      // Спокойный темно-красный (рубиновый)
    DIM:     '\x1b[38;5;241m',      // Графитовый серый
    RESET:   '\x1b[0m',
    BOLD:    '\x1b[1m',

    ACCENT_BLUE:   '\x1b[38;5;26m',
    ACCENT_YELLOW: '\x1b[38;5;136m',

    FINGER_YELLOW:  '\x1b[1;38;5;136m', // Темно-золотой
    FINGER_CYAN:    '\x1b[1;38;5;31m',  // Сдержанный бирюзовый
    FINGER_MAGENTA: '\x1b[1;38;5;126m', // Глубокий пурпур
    FINGER_GREEN:   '\x1b[1;38;5;28m',  // Лесной зеленый
    FINGER_WHITE:   '\x1b[1;38;5;235m'  // Антрацитовый черный (вместо белого)
  } as IThemePalette
};

/**
 * Возвращает атомарную палитру цветов в зависимости от текущей темы VS Code.
 * @param {boolean} isLightTheme Флаг светлой темы оформления редактора.
 * @returns {IThemePalette} Срез ANSI-последовательностей для отрисовки кадра.
 */
export function getThemeColors(isLightTheme: boolean): IThemePalette {
  return isLightTheme ? PALETTES.LIGHT : PALETTES.DARK;
}