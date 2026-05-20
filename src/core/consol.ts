/**
 * @fileoverview Модуль глобальной инженерной консоли ядра (DevConsole).
 * Изолирует состояние командной строки, парсинг системных директив,
 * перехват сырого ввода и наложение текстовых ANSI-слоев на итоговую матрицу.
 * * 符合 Google TypeScript СТИЛЬ ПРАВИЛ // ПОСТРОЧНОЕ КОММЕНТИРОВАНИЕ
 * © The 'Just Make It Work' Group Vibe Coding Enterprizes Corporation; xepctapk (ц) //™
 */

import * as vscode from 'vscode';
import { AppRouter, ScreenState } from '../engine/router';
import { IScreenContext } from '../engine/interfaces';
import { getThemeColors } from '../engine/reservation';

/**
 * Встроенная инженерная консоль для отладки и административного управления SPTA-приложением.
 * Вызывается пользователем во время выполнения через скрытый хоткей.
 */
export class DevConsole {
  /** Флаг текущего состояния отображения консоли поверх игрового экрана. */
  private isConsoleMode: boolean = false;
  /** Буфер для накопления вводимых пользователем символов до нажатия Enter. */
  private commandBuffer: string = '';
  /** Текст ответа системы или сообщения об ошибке синтаксиса. */
  private systemMessage: string = '';
  /** Ссылка на разделяемый контекст выполнения терминала. */
  private ctx!: IScreenContext;

  // --- КОНСТАНТЫ ПАЛИТРЫ ПОДЛОЖКИ (ANSI ЦВЕТА ЗАДНЕГО ФОНА) ---
  /** Глубокий серый фон для темной темы (ANSI 256-color background). */
  private readonly BG_DARK: string = '\x1b[48;5;234m';
  /** Чистый светло-серый фон для комфортной работы в светлой теме. */
  private readonly BG_LIGHT: string = '\x1b[48;5;254m';

  /**
   * Конструктор принимает ссылку на роутер для осуществления навигационных команд.
   * @param {AppRouter} router Мастер-маршрутизатор приложения.
   */
  constructor(private readonly router: AppRouter) {}

  /**
   * Привязка глобального контекста окружения к подсистеме консоли.
   * @param {IScreenContext} ctx Контекст выполнения PTY.
   */
  public init(ctx: IScreenContext): void {
    this.ctx = ctx;
  }

  /**
   * Переключает триггер видимости консоли. Автоматически сбрасывает буферы при закрытии.
   */
  public toggle(): void {
    this.isConsoleMode = !this.isConsoleMode;
    if (!this.isConsoleMode) {
      this.commandBuffer = '';
      this.systemMessage = '';
    }
  }

  /**
   * Проверяет, активна ли консоль в данный момент.
   * Если true — весь пользовательский ввод должен терминироваться здесь.
   * @returns {boolean} Статус активности консоли.
   */
  public isActive(): boolean {
    return this.isConsoleMode;
  }

  /**
   * Обработчик посимвольного ввода данных, перехваченных из PTY-потока.
   * @param {string} data Символ или управляющая ESC-последовательность.
   */
  public handleInput(data: string): void {
    // Если пользователь нажимает Enter (\r), отправляем накопленный буфер на исполнение
    if (data === '\r') {
      this.executeCommand(this.commandBuffer.trim());
      this.commandBuffer = '';
      this.router.refresh();
      return;
    }

    // Обработка клавиши Backspace (\x7f) — удаление последнего символа из буфера
    if (data === '\x7f') {
      if (this.commandBuffer.length > 0) {
        this.commandBuffer = this.commandBuffer.slice(0, -1);
        this.router.refresh();
      }
      return;
    }

    // Фильтрация: игнорируем любые управляющие ANSI-последовательности (например, стрелки)
    if (data.startsWith('\x1b')) {
      return;
    }

    // Накопление печатных символов в буфер командной строки
    this.commandBuffer += data;
    this.router.refresh();
  }

  /**
   * Внутренний интерпретатор текстовых команд. Разбирает токены и вызывает методы ядра.
   * @param {string} rawCmd Сырая строка команды из буфера.
   */
  private executeCommand(rawCmd: string): void {
    if (!rawCmd) {
      this.systemMessage = '';
      return;
    }

    // Разбиваем команду на атомарные токены по пробелам
    const tokens = rawCmd.split(/\s+/);
    const cmd = tokens[0].toLowerCase();
    const args = tokens.slice(1);

    switch (cmd) {
      case 'help':
        this.systemMessage = 'Доступно: help, clear, status, jump <screen>';
        break;

      case 'clear':
        this.systemMessage = '';
        this.commandBuffer = '';
        break;

      case 'status':
        const w = this.ctx?.terminalWidth ?? 0;
        const h = this.ctx?.terminalHeight ?? 0;
        this.systemMessage = `OK // Matrix: ${w}x${h} // Theme: ${this.ctx?.isLightTheme ? 'LIGHT' : 'DARK'}`;
        break;

      case 'jump':
        if (!args[0]) {
          this.systemMessage = 'Ошибка: укажи экран. Пример: jump HUB';
          break;
        }
        
        const target = args[0].toUpperCase();
        const validScreens: ScreenState[] = ['INTRO', 'HUB', 'KEYBOARD', 'DASH', 'RAIN', 'CREW', 'VERSUS'];
        
        if (validScreens.includes(target as ScreenState)) {
          this.systemMessage = `Выполняю экстренный прыжок на экран [${target}]...`;
          // Прямая директива роутеру на смену стейта приложения
          this.router.navigateTo(target as ScreenState);
        } else {
          this.systemMessage = 'Неверный экран. Юзай: HUB, KEYBOARD, DASH, RAIN, CREW, VERSUS';
        }
        break;

      default:
        // Пишем ТОЛЬКО во внутреннюю переменную оверлея, никакого console.log в stdout расширения!
        this.systemMessage = `Неизвестная команда: "${cmd}". Введи help`;
        break;
    }
  }

  /**
   * Аппаратный инжектор графических слоев. Сажает интерфейс консоли строго 
   * на нижние строки экрана и производит зачистку старого мусора макросом \x1b[2K.
   * @param {string} currentFrame Скомпилированный кадр активного игрового экрана.
   * @param {number} height Актуальная высота терминала для расчета координат.
   * @returns {string} Комбинированная ANSI-строка с наложенным оверлеем консоли.
   */
  public injectLayer(currentFrame: string, height: number): string {
    let frame = currentFrame;
    const theme = getThemeColors(this.ctx?.isLightTheme ?? false);
    const bgConsole = this.ctx?.isLightTheme ? this.BG_LIGHT : this.BG_DARK;

    // --- СЛОЙ 1: ВЫВОД СИСТЕМНОГО ОТВЕТА (Строка H - 1) ---
    if (this.systemMessage) {
      // Прыгаем на предпоследнюю строку, аппаратно чистим её (\x1b[2K) и выводим лог
      frame += `\x1b[${height - 1};1H\x1b[2K${theme.BOLD}${theme.PRIMARY}ℹ️  [SYSTEM]: ${this.systemMessage}${theme.RESET}`;
    }

    // --- СЛОЙ 2: ВЫВОД СТРОКИ ИНТЕРАКТИВНОГО ВВОДА (Строка H) ---
    if (this.isConsoleMode) {
      const promptStr = `> ${this.commandBuffer}`;
      // Отрезаем избыток строки, если пользователь умудрился ввести команду длиннее ширины экрана
      const maxLength = (this.ctx?.terminalWidth ?? 80) - 5;
      const clippedPrompt = promptStr.substring(0, maxLength);

      // Формируем финальную подложку: прыгаем на самую нижнюю строку, чистим её,
      // заливаем фоновым ANSI-пакетом и рендерим каретку ввода
      frame += `\x1b[${height};1H\x1b[2K${bgConsole}${theme.BOLD}${theme.PRIMARY}${clippedPrompt}${theme.RESET}`;
    }

    return frame;
  }

  /**
   * Тотальная деструктуризация буферов консоли для предотвращения утечек памяти.
   */
  public dispose(): void {
    this.isConsoleMode = false;
    this.commandBuffer = '';
    this.systemMessage = '';
  }
}