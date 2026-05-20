/**
 * @fileoverview Мастер-Терминал (Низкоуровневый оркестратор Pseudoterminal).
 * Обеспечивает бесшовную интеграцию с VS Code Pseudoterminal API, управляет изоляцией
 * альтернативного буфера экрана, блокирует системный курсор, на лету вычисляет
 * глобальный контекст адаптивности и делегирует управление ядру AppRouter.
 * * 符合 Google TypeScript СТИЛЬ ПРАВИЛ // ПОСТРОЧНОЕ КОММЕНТИРОВАНИЕ
 * © The 'Just Make It Work' Group Vibe Coding Enterprises Corporation; xepctapk (ц) //™
 */

import * as vscode from 'vscode';
import { AppRouter } from './router';
import { IScreenContext } from './interfaces';

/**
 * Системный контроллер виртуального PTY-терминала TypeTip Studio.
 * Реализует стандартный контракт vscode.Pseudoterminal.
 */
export class TypeTipTerminal implements vscode.Pseudoterminal {
  /** Эмиттер отправки ANSI-данных напрямую в поток отрисовки VS Code. */
  private readonly writeEmitter = new vscode.EventEmitter<string>();
  /** Публичное событие записи, подписываемое ядром редактора. */
  public readonly onDidWrite: vscode.Event<string> = this.writeEmitter.event;

  /** Эмиттер закрытия псевдотерминала для уведомления операционной системы. */
  private readonly closeEmitter = new vscode.EventEmitter<number>();
  /** Публичное событие закрытия, подписываемое ядром редактора. */
  public readonly onDidClose: vscode.Event<number> = this.closeEmitter.event;

  /** Главный маршрутизатор Single Page Terminal Application. */
  private readonly router: AppRouter;
  /** Единый разделяемый контекст выполнения графических подсистем. */
  private contextObj!: IScreenContext;
  /** Флаг успешного завершения инициализации и прогрева ядра. */
  private isInitialized = false;

  /**
   * Конструктор регистрирует и связывает мастер-роутер приложения.
   * @param {vscode.ExtensionContext} context Глобальный контекст расширения.
   */
  constructor(private readonly context: vscode.ExtensionContext) {
    // Инстанцируем роутер, передавая ему системный эмиттер прямого вывода
    this.router = new AppRouter(this.writeEmitter, this.context);
  }

  /**
   * Вызывается движком VS Code в момент готовности окна терминала к рендеру.
   * @param {vscode.TerminalDimensions | undefined} dimensions Стартовая геометрия окна.
   */
  public open(dimensions: vscode.TerminalDimensions | undefined): void {
    // Извлекаем стартовые габариты матрицы, дефолт к стандарту IBM 80x24
    const columns = dimensions?.columns || 80;
    const rows = dimensions?.rows || 24;

    // Собираем бортовой компьютер контекста и рассчитываем адаптивные флаги
    this.contextObj = {
      writeEmitter: this.writeEmitter,
      extensionContext: this.context,
      terminalWidth: columns,
      terminalHeight: rows,
      isSafeMode: columns < 40 || rows < 10,
      isWideMode: columns >= 110 && rows >= 25,
      isLightTheme: vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light
    };

    // Передаем контекст в роутер и запускаем стартовую заставку INTRO
    this.router.init(this.contextObj);
    this.router.navigateTo('INTRO');
    this.isInitialized = true;

    // Аппаратная активация игрового режима PTY:
    // \x1b[?1049h — Включение изолированного альтернативного буфера (не засирает историю консоли)
    // \x1b[?25l  — Полное скрытие системного мигающего курсора
    setTimeout(() => {
      this.writeEmitter.fire('\x1b[?1049h\x1b[?25l');
      this.router.refresh();
    }, 30);
  }

  /**
   * Центральный шлюз ввода. Захватывает сырые байты нажатий пользователя и перенаправляет в роутер.
   * @param {string} data Символ или ESC-последовательность из стандартного потока ввода stdin.
   */
  public handleInput(data: string): void {
    if (!this.isInitialized) {
      return;
    }
    this.router.handleInput(data);
  }

  /**
   * Автоматический обработчик изменения геометрии окна пользователем (Ресайз PTY-буфера).
   * @param {vscode.TerminalDimensions} dimensions Новые актуальные размеры окна.
   */
  public setDimensions(dimensions: vscode.TerminalDimensions): void {
    if (!this.isInitialized) {
      return;
    }

    const columns = dimensions.columns;
    const rows = dimensions.rows;

    // Атомарно обновляем свойства в разделяемом контексте выполнения
    this.contextObj.terminalWidth = columns;
    this.contextObj.terminalHeight = rows;
    
    // На лету пересчитываем флаги безопасного отображения и тему
    this.contextObj.isSafeMode = columns < 40 || rows < 10;
    this.contextObj.isWideMode = columns >= 110 && rows >= 25;
    this.contextObj.isLightTheme = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light;

    // Вызываем каскадный ресайз всех дочерних игровых экранов через менеджер роутера
    this.router.updateDimensions(columns, rows);
  }

  /**
   * Вызывается при закрытии терминала пользователем (уничтожение вкладки корзиной).
   * Гарантирует тотальную зачистку памяти расширения и остановку фоновых игровых циклов.
   */
  public close(): void {
    this.isInitialized = false;

    // Аппаратный сброс терминала в исходное состояние перед закрытием:
    // \x1b[?25h  — Возвращаем видимость системного курсора
    // \x1b[?1049l — Корректный выход из альтернативного буфера экрана
    this.writeEmitter.fire('\x1b[?25h\x1b[?1049l');

    // Уничтожаем роутер и освобождаем занятые им ресурсы/интервалы
    this.router.dispose();
  }
}