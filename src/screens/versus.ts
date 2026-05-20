/**
 * @fileoverview Игровой экран соревновательного мультиплеера (Versus Screen).
 * Отвечает за отрисовку интерфейса дуэлей против локальных или облачных ИИ-ботов.
 * На текущем этапе разработки находится в замороженном состоянии (заглушка).
 * * 符合 Google TypeScript СТИЛЬ ПРАВИЛ // ПОСТРОЧНОЕ КОММЕНТИРОВАНИЕ
 * © The 'Just Make It Work' Group Vibe Coding Enterprises Corporation; xepctapk (ц) //™
 */

import { IScreen, IScreenContext } from '../engine/interfaces';
import { AppRouter } from '../engine/router';
import { getThemeColors } from '../engine/reservation';

/**
 * Класс экрана киберпанк-дуэлей со скоростным ИИ.
 * Реализует базовый контракт графического интерфейса IScreen.
 */
export class VersusScreen implements IScreen {
  /** Разделяемый контекст выполнения PTY-сессии терминала. */
  private ctx!: IScreenContext;

  /**
   * Конструктор регистрирует ссылку на мастер-маршрутизатор системы.
   * @param {AppRouter} router Центральный роутер графической оболочки.
   */
  constructor(private readonly router: AppRouter) {}

  /**
   * Инициализация экрана при его монтировании в роутере.
   * @param {IScreenContext} ctx Актуальный контекст выполнения.
   */
  public init(ctx: IScreenContext): void {
    this.ctx = ctx;
  }

  /**
   * Формирует и возвращает финальный текстовый кадр режима Versus с адаптивным центрированием.
   * @returns {string} ANSI-последовательность для отправки в PTY.
   */
  public render(): string {
    const w = this.ctx.terminalWidth;
    const theme = getThemeColors(this.ctx.isLightTheme);

    // Сброс каретки в левый верхний угол терминала
    let s = '\x1b[H\r\n\r\n';

    // Рендеринг агрессивного киберпанк-заголовка дуэлей (ANSI Red)
    const title = '⚔️  CYBERPUNK VERSUS MODE  ⚔️';
    s += `${this.center(`${theme.BOLD}\x1b[31m${title}${theme.RESET}`, title.length, w)}\r\n`;

    // Информационная строка о проведении технических работ над ИИ-сервисом
    const message = 'Режим дуэли находится в разработке...';
    s += `${this.center(`${theme.DIM}${message}${theme.RESET}`, message.length, w)}\r\n\r\n`;

    // Навигационная подсказка для возвращения пользователя в главное меню
    const footer = 'Нажмите [ESC] или [BACKSPACE] для выхода';
    s += `${this.center(`${theme.DIM}${footer}${theme.RESET}`, footer.length, w)}\r\n`;

    return s;
  }

  /**
   * Обработчик пользовательского ввода. Вся базовая навигация выхода (ESC) 
   * перехвачена на уровне AppRouter, поэтому данный метод остается пустым.
   * @param {string} data Символ или управляющий маркер ввода.
   */
  public handleInput(data: string): void {
    // Ввод игнорируется, управление делегировано глобальному перехватчику роутера
  }

  /**
   * Утилитарный метод для вычисления отступов и центрирования ANSI-строк.
   * Принимает чистую длину текста во избежамого искажения из-за невидимых ANSI-последовательностей.
   * @param {string} text Строка с ANSI-пакетами для вывода.
   * @param {number} cleanLength Фактическая видимая длина строки без учета спецсимволов.
   * @param {number} width Текущая ширина терминала в колонках.
   * @returns {string} Строка с выверенными пробельными отступами слева.
   */
  private center(text: string, cleanLength: number, width: number): string {
    const padding = Math.max(0, Math.floor((width - cleanLength) / 2));
    return ' '.repeat(padding) + text;
  }
}