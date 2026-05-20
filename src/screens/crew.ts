/**
 * @fileoverview Игровой экран корпоративного лобби синдиката (Crew Screen).
 * Управляет отображением интерфейса подключения к сетевым кланам.
 * На текущем этапе разработки находится в замороженном состоянии (заглушка).
 * * 符合 Google TypeScript СТИЛЬ ПРАВИЛ // ПОСТРОЧНОЕ КОММЕНТИРОВАНИЕ
 * © The 'Just Make It Work' Group Vibe Coding Enterprises Corporation; xepctapk (ц) //™
 */

import { IScreen, IScreenContext } from '../engine/interfaces';
import { AppRouter } from '../engine/router';
import { getThemeColors } from '../engine/reservation';

/**
 * Класс экрана корпоративного лобби синдиката.
 * Реализует базовый контракт графического интерфейса IScreen.
 */
export class CrewScreen implements IScreen {
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
   * Формирует и возвращает финальный текстовый кадр лобби с адаптивным центрированием.
   * @returns {string} ANSI-последовательность для отправки в PTY.
   */
  public render(): string {
    const w = this.ctx.terminalWidth;
    const theme = getThemeColors(this.ctx.isLightTheme);

    // Сброс каретки в левый верхний угол и перевод строк для отступов
    let s = '\x1b[H\r\n\r\n';

    // Рендеринг главного заголовка лобби с жестко заданным цветом корпорации (ANSI Blue)
    const title = '💼 CORPORATE CLAN LOBBY 💼';
    s += `${this.center(`${theme.BOLD}\x1b[34m${title}${theme.RESET}`, title.length, w)}\r\n`;

    // Рендеринг сервисного сообщения о приостановке синхронизации
    const message = 'Синхронизация с синдикатом приостановлена...';
    s += `${this.center(`${theme.DIM}${message}${theme.RESET}`, message.length, w)}\r\n\r\n`;

    // Инструкция по осуществлению навигационного возврата в хаб
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
   * Принимает чистую длину текста во избежание искажений из-за невидимых ESC-последовательностей.
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