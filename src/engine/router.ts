/**
 * @fileoverview Ядро маршрутизации и управления жизненным циклом экранов (AppRouter).
 * Отвечает за атомарное переключение состояний Single Page Terminal Application (SPTA),
 * каскадную диспетчеризацию ввода, обработку изменения геометрии матриц и предотвращение
 * утечек памяти в долгоживущих сессиях VS Code.
 * * 符合 Google TypeScript СТИЛЬ ПРАВИЛ // ПОСТРОЧНОЕ КОММЕНТИРОВАНИЕ
 * © The 'Just Make It Work' Group Vibe Coding Enterprises Corporation; xepctapk (ц) //™
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { IScreen, IScreenContext } from './interfaces';
import { HubMenu } from '../screens/hubmenu';
import { DevConsole } from '../core/consol';
import { WsMonitorScreen } from '../screens/wsmonitor';

/**
 * Допустимые идентификаторы экранов в экосистеме TypeTip Studio.
 * Динамический роутер принимает любые строковые ID, соответствующие именам файлов.
 */
export type ScreenState = string;

/** Константа тотальной зачистки PTY буфера и сброса графических стилей */
const FULL_RESET_SEQUENCE = '\x1b[0m\x1b[2J\x1b[3J\x1b[H';

/**
 * Центральный маршрутизатор графической оболочки приложения.
 */
export class AppRouter {
  /** Карта зарегистрированных долгоживущих экранов (Ядро системы). */
  private readonly screens: Map<ScreenState, IScreen> = new Map();
  /** Идентификатор текущего активного экрана. */
  private currentScreenState: ScreenState = 'INTRO';
  /** Прямая ссылка на текущий отрисовываемый объект экрана. */
  private activeScreen: IScreen | null = null;
  /** Встроенная низкоуровневая консоль инженера-разработчика. */
  private readonly devConsole: DevConsole;
  /** Разделяемый контекст выполнения PTY-сессии. */
  private ctx!: IScreenContext;


  /**
   * Конструктор инициализирует базовые зависимости и регистрирует управляющее ядро.
   * @param {vscode.EventEmitter<string>} writeEmitter Системный поток вывода PTY.
   * @param {vscode.ExtensionContext} context Глобальный контекст плагина.
   */
  constructor(
    private readonly writeEmitter: vscode.EventEmitter<string>,
    private readonly context: vscode.ExtensionContext
  ) {
    // Инстанцируем консоль управления, передавая ссылку на текущий роутер
    this.devConsole = new DevConsole(this);

    // ХАБ регистрируем статически — это главный координационный центр приложения
    this.screens.set('HUB', new HubMenu(this, this.context));
    this.screens.set('HUB_MENU', this.screens.get('HUB')!);
  }

  /**
   * Первоначальная связка контекста и запуск корневого экрана.
   * @param {IScreenContext} ctx Сформированный мастер-терминалом контекст.
   */
  public init(ctx: IScreenContext): void {
    this.ctx = ctx;
    // Передаем контекст во владение консоли
    this.devConsole.init(this.ctx);

    // Стартуем сессию: пытаемся динамически загрузить INTRO (стартовый экран по умолчанию)
    this.navigateTo(this.currentScreenState);
  }

  /**
   * Безопасный переход на любой указанный экран с динамической подгрузкой модуля с диска.
   * @param {ScreenState} target Идентификатор целевого экрана (соответствует имени файла).
   */
  public navigateTo(target: ScreenState): void {
    // 1. Вызываем деструктор у старого экрана, если он существует, убивая его интервалы
    if (this.activeScreen && this.activeScreen.dispose) {
      this.activeScreen.dispose();
    }

    let next: IScreen | undefined;

    // 2. ПРОВЕРЯЕМ СТАТИЧЕСКОЕ ЯДРО (Если идем в Хаб)
    if (target === 'HUB' || target === 'HUB_MENU') {
      next = this.screens.get('HUB');
    } else {
      // 3. ДИНАМИЧЕСКИЙ КИБЕР-ХУК: Загружаем игровой экран из папки screens на лету
      try {
        const fileName = target.toLowerCase();
        const rootPath = this.context.extensionUri.fsPath;
        
        // Вычисляем путь к скомпилированному js-файлу экрана (в out/ или dist/)
        const screenModulePath = path.join(rootPath, 'out', 'screens', fileName);

        // Очищаем кэш require, обеспечивая горячую перезагрузку (Hot Reload) кода экрана
        try {
          delete require.cache[require.resolve(screenModulePath)];
        } catch {}

        // Летим на диск и подтягиваем файл модуля
        const importedModule = require(screenModulePath);

        // Автоматически выковыриваем первый экспортированный класс из файла
        const ExportedClass = Object.values(importedModule).find(
          (exported: any) => typeof exported === 'function' && exported.prototype
        ) as any;

        if (!ExportedClass) {
          throw new Error(`В скомпилированном файле ${fileName} не найден валидный класс!`);
        }

        // Инстанцируем динамический класс, передавая стандартный набор зависимостей
        next = new ExportedClass(this, this.context);

      } catch (err: any) {
        vscode.window.showErrorMessage(`Динамический роутер не смог поднять экран "${target}": ${err.message}`);
        // Аварийный откат: если экран сломан или не скомпилирован, катапультируем юзера в безопасный Хаб
        if (target !== 'HUB') {
          this.navigateTo('HUB');
        }
        return;
      }
    }

    if (!next) return;

    // 4. Обновляем ссылки состояния в памяти роутера
    this.activeScreen = next;
    this.currentScreenState = target;

    // 5. Инициализируем новый экран со свежим разделяемым контекстом PTY
    this.activeScreen.init(this.ctx);

    // 6. ЖЕСТКАЯ КОРРЕКЦИЯ: Выжигаем буфер PTY дотла перед выводом нового фрейма!
    this.writeEmitter.fire(FULL_RESET_SEQUENCE);

    // 7. Форсируем мгновенную перерисовку холста
    this.refresh();
  }

  /**
   * Точка входа для обработки сырого пользовательского ввода из PTY-потока.
   * @param {string} data Символ или управляющая ANSI-последовательность.
   */
  public handleInput(data: string): void {
    // ХОТКЕЙ: Если нажат Tab (\t), динамически меняем локацию терминала!
    if (data === '\t') {
      this.toggleTerminalLocation();
      return;
    }

    // Перехват управляющего символа "`" (тильда) для активации Root-консоли
    if (data === '`') {
      this.devConsole.toggle();
      this.refresh();
      return;
    }

    // Если консоль находится в активном состоянии, весь ввод уходит строго в неё
    if (this.devConsole.isActive()) {
      this.devConsole.handleInput(data);
      return;
    }

    // Глобальный перехват навигационных клавиш возврата (Выход в Хаб из любого игрового режима)
    if (this.currentScreenState !== 'HUB' && this.currentScreenState !== 'HUB_MENU' && this.currentScreenState !== 'INTRO') {
      if (data === '\x1b' || data === '\x7f' || data === 'UI_BACK' || data === 'UI_BACKSPACE') {
        this.navigateTo('HUB');
        return;
      }
    }

    // Трансляция ANSI-последовательностей стрелок во внутренние системные события
    let translated = data;
    if (data === '\x1b[A') {
      translated = 'UI_UP';
    } else if (data === '\x1b[B') {
      translated = 'UI_DOWN';
    } else if (data === '\r') {
      translated = 'UI_ENTER';
    } else if (data === '\x1b') {
      translated = 'UI_BACK';
    } else if (data === '\x7f') {
      translated = 'UI_BACKSPACE';
    }

    // Делегируем оттранслированный ввод логике активного экрана
    if (this.activeScreen) {
      this.activeScreen.handleInput(translated);
    }
  }

  /**
   * Корпоративный переключатель локации терминала на лету
   */
  private async toggleTerminalLocation(): Promise<void> {
    const config = vscode.workspace.getConfiguration('typetip');
    let currentMode = config.get<string>('terminalDisplayMode') || 'editor';

    if (currentMode === 'panel') {
      await vscode.commands.executeCommand('workbench.action.terminal.moveToEditor');
      await config.update('terminalDisplayMode', 'editor', vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage('TypeTip Studio: Перемещено в область редактора');
    } else {
      await vscode.commands.executeCommand('workbench.action.terminal.moveToTerminalPanel');
      await config.update('terminalDisplayMode', 'panel', vscode.ConfigurationTarget.Global);
      await vscode.commands.executeCommand('workbench.action.terminal.focus');
      vscode.window.showInformationMessage('TypeTip Studio: Перемещено в панель подвала');
    }

    this.refresh();
  }

  /**
   * Каскадное уведомление экранов об изменении физических размеров окна терминала.
   * @param {number} width Новая ширина в колонках.
   * @param {number} height Новая высота в строках.
   */
  public updateDimensions(width: number, height: number): void {
    if (this.ctx && this.ctx.isSafeMode && this.currentScreenState === 'INTRO') {
      this.navigateTo('HUB');
    }

    if (this.activeScreen && this.activeScreen.resize) {
      this.activeScreen.resize(width, height);
    }
    
    this.refresh();
  }

  /**
   * Принудительная генерация кадра: запрашивает графический слой у экрана,
   * накладывает поверх слой Dev-консоли и выбрасывает комбинированную строку в PTY.
   */
  public refresh(): void {
    if (!this.activeScreen) {
      return;
    }

    let frame = this.activeScreen.render();
    const terminalHeight = this.ctx?.terminalHeight || 24;

    frame = this.devConsole.injectLayer(frame, terminalHeight);

    this.writeEmitter.fire(`\x1b[H${frame}`);
  }

  /**
   * Возвращает прямую ссылку на текущий активный экран для внешних системных проверок.
   * @returns {IScreen | null} Ссылка на экземпляр экрана или null.
   */
  public getActiveScreen(): IScreen | null {
    return this.activeScreen;
  }

  /**
   * Тотальная деструктуризация роутера. Гарантирует зачистку памяти при уничтожении сессии.
   */
  public dispose(): void {
    this.devConsole.dispose();

    // Каскадно тушим долгоживущие статические экраны из мапы
    for (const screen of this.screens.values()) {
      if (screen.dispose) {
        screen.dispose();
      }
    }
    
    // Если текущий динамический экран не был в мапе, принудительно тушим его
    if (this.activeScreen && this.activeScreen.dispose) {
      this.activeScreen.dispose();
    }

    this.screens.clear();
    this.activeScreen = null;
  }
}