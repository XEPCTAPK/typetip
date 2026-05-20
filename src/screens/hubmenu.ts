/**
 * @fileoverview Автоматизированный экран умного динамического Хаба.
 * Самостоятельно строит карту экранов и интерактивное подменю ассетов.
 * 符合 Google TypeScript ПРАВИЛА СТИЛЯ // ПОСТРОЧНОЕ КОММЕНТИРОВАНИЕ
 * © The 'Just Make It Work' Group Vibe Coding Enterprises Corporation.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { IScreen, IScreenContext } from '../engine/interfaces';
import { AppRouter } from '../engine/router';

export class HubMenu implements IScreen {
  private selectedIndex = 0;
  private ctx!: IScreenContext;

  // Стейт хаба: 'MAIN' (главное меню) или 'ASSETS' (подменю кастомных артов)
  private currentSubMode: 'MAIN' | 'ASSETS' = 'MAIN';

  // Динамические списки, собираемые с диска
  private dynamicScreens: string[] = [];
  private dynamicAssets: string[] = [];
  private activeItems: string[] = []; // То, что рендерится в текущую секунду

  // Цветовая палитра High-Intensity ANSI
  private readonly RESET = '\x1b[0m';
  private readonly BOLD = '\x1b[1m';
  private readonly DIM = '\x1b[2m';
  private readonly CYAN = '\x1b[1;96m';
  private readonly GREEN = '\x1b[1;92m';
  private readonly AMBER = '\x1b[1;93m';

  constructor(
    private readonly router: AppRouter,
    private readonly context: vscode.ExtensionContext 
  ) {}

  public init(ctx: IScreenContext): void {
    this.ctx = ctx;
    this.currentSubMode = 'MAIN';
    this.selectedIndex = 0;
    
    // Сканируем папки при каждой инициализации хаба
    this.syncProjectStructure();

    // Гарантируем стабильность: принудительно сажаем PTY в подвал панели
    vscode.commands.executeCommand('workbench.action.terminal.moveToTerminalPanel').then(() => {
      vscode.commands.executeCommand('workbench.action.terminal.focus');
    });
  }

  /**
   * Сканирует физическую структуру проекта и на лету собирает меню
   */
  private syncProjectStructure(): void {
    try {
      const rootPath = this.context.extensionUri.fsPath;
      
      // 1. СКАНИРУЕМ СТАТИЧЕСКИЕ ЭКРАНЫ ИЗ ПАПКИ SCREENS
      const screensPath = path.join(rootPath, 'src', 'screens');
      if (fs.existsSync(screensPath)) {
        const screenFiles = fs.readdirSync(screensPath);
        this.dynamicScreens = screenFiles
          .filter(file => (file.endsWith('.ts') || file.endsWith('.js')) && !file.toLowerCase().includes('hubmenu'))
          .map(file => file.replace(/\.[^/.]+$/, '').toUpperCase()); // 'versus.ts' -> 'VERSUS'
      } else {
        this.dynamicScreens = ['INTRO', 'KEYBOARD', 'RAIN', 'DASH']; // Фолбек
      }

      // 2. СКАНИРУЕМ КАСTОМНЫЕ АРТЫ ИЗ ПАПКИ ASSETS
      const assetsPath = path.join(rootPath, 'assets');
      if (!fs.existsSync(assetsPath)) {
        fs.mkdirSync(assetsPath, { recursive: true });
      }
      const assetFiles = fs.readdirSync(assetsPath);
      this.dynamicAssets = assetFiles
        .filter(file => file.endsWith('.txt'))
        .map(file => file.replace('.txt', ''));

    } catch (e) {
      console.error('Ошибка автоматического сканирования директорий:', e);
    }

    // Обновляем текущий стек элементов в зависимости от режима
    this.updateActiveItems();
  }

  /**
   * Переключает отображаемый список элементов
   */
  private updateActiveItems(): void {
    if (this.currentSubMode === 'MAIN') {
      // Главное меню: Все найденные экраны + папка ассетов как кнопка подменю + Кнопка выхода
      this.activeItems = [...this.dynamicScreens, 'CUSTOM_ASSETS_MENU', 'EXIT'];
    } else {
      // Подменю ассетов: Список файлов + кнопка возврата назад
      this.activeItems = this.dynamicAssets.map(asset => `ART: ${asset}`);
      this.activeItems.push('BACK_TO_MAIN');
    }
  }

  public handleInput(data: string): void {
    if (data.startsWith('UI_') && !['UI_UP', 'UI_DOWN', 'UI_ENTER'].includes(data)) {
      return;
    }

    // ХОТКЕЙ ВОЗВРАТА: Если в подменю нажали Escape (\x1b) или Backspace (\x7f), кидаем назад в главное
    if ((data === '\x1b' || data === '\x7f') && this.currentSubMode === 'ASSETS') {
      this.currentSubMode = 'MAIN';
      this.selectedIndex = 0;
      this.updateActiveItems();
      this.router.refresh();
      return;
    }

    // Навигация Вверх (W / Ф / ArrowUp)
    if (data === 'w' || data === 'W' || data === 'ц' || data === 'Ц' || data === '\x1b[A' || data === 'UI_UP') {
      this.selectedIndex = (this.selectedIndex - 1 + this.activeItems.length) % this.activeItems.length;
      this.router.refresh();
    } 
    // Навигация Вниз (S / Ы / ArrowDown)
    else if (data === 's' || data === 'S' || data === 'ы' || data === 'Ы' || data === '\x1b[B' || data === 'UI_DOWN') {
      this.selectedIndex = (this.selectedIndex + 1) % this.activeItems.length;
      this.router.refresh();
    } 
    // Нажатие ENTER
    else if (data === '\r' || data === '\n' || data === 'UI_ENTER') {
      const selection = this.activeItems[this.selectedIndex];

      // ОБРАБОТКА ЛОГИКИ ГЛАВНОГО МЕНЮ
      if (this.currentSubMode === 'MAIN') {
        if (selection === 'CUSTOM_ASSETS_MENU') {
          this.currentSubMode = 'ASSETS';
          this.selectedIndex = 0;
          this.updateActiveItems();
          this.router.refresh();
          return;
        }

        if (selection === 'EXIT') {
          vscode.window.showInformationMessage('TypeTip Core Engine Disconnected.');
          return;
        }

        // Авто-роутинг на любой найденный экран
        this.router.navigateTo(selection as any);
      } 
      // ОБРАБОТКА ЛОГИКИ ПОДМЕНЮ АССЕТОВ
      else {
        if (selection === 'BACK_TO_MAIN') {
          this.currentSubMode = 'MAIN';
          this.selectedIndex = 0;
          this.updateActiveItems();
          this.router.refresh();
          return;
        }

        if (selection.startsWith('ART: ')) {
          const fileName = selection.replace('ART: ', '') + '.txt';
          this.openCustomAsset(fileName);
        }
      }
    }
  }

  public render(): string {
    const w = this.ctx?.terminalWidth || 80;
    let s = '\x1b[?25l\x1b[H\x1b[J';

    // Шапка
    s += `${this.CYAN}${this.BOLD}  ██████╗ ██████╗ ████████╗    ████████╗██╗██████╗ \r\n`;
    s += `  ██╔══██╗██╔══██╗╚══██╔══╝    ╚══██╔══╝██║██╔══██╗\r\n`;
    s += `  ██║  ██║██║  ██║   ██║          ██║   ██║██████╔╝\r\n`;
    s += `  ██████╔╝██████╔╝   ██║          ██║   ██║██║     \r\n`;
    s += `  ╚═════╝ ╚═════╝    ╚═╝          ╚═╝   ╚═╝╚═╝     ${this.RESET}${this.DIM}v8.5 DYNAMIC${this.RESET}\r\n`;
    s += `  ${this.DIM}${'-'.repeat(w - 4)}${this.RESET}\r\n\r\n`;

    // Информатор текущего подрежима меню
    if (this.currentSubMode === 'MAIN') {
      s += `  ${this.BOLD}MAIN SYSTEM CORE MODULES:${this.RESET}\r\n\r\n`;
    } else {
      s += `  ${this.AMBER}${this.BOLD}📂 SUB-LEVEL: CUSTOM ART PREVIEWER (Press Backspace to Return):${this.RESET}\r\n\r\n`;
    }

    // Рендеринг элементов
    this.activeItems.forEach((item, idx) => {
      const isSelected = (idx === this.selectedIndex);
      let menuButton = '';
      let description = '';

      if (isSelected) {
        menuButton = `${this.GREEN}${this.BOLD}  ► [ ${item.padEnd(22)} ] ◄${this.RESET}`;
      } else {
        menuButton = `    [ ${item.padEnd(22)} ]    `;
      }

      // Генерируем описания на лету, чтобы строки не съезжали
      if (item === 'CUSTOM_ASSETS_MENU') description = ` ${this.AMBER}— 📂 ОТКРЫТЬ ДИРЕКТОРИЮ ANSI-АРТОВ С ДИСКА${this.RESET}`;
      else if (item === 'EXIT')            description = ` ${this.DIM}— Выгрузить псевдотерминал расширения${this.RESET}`;
      else if (item === 'BACK_TO_MAIN')    description = ` ${this.DIM}— Вернуться на главный уровень Ядра${this.RESET}`;
      else if (item.startsWith('ART: '))  description = ` ${this.DIM}— Открыть ассет сбоку в редакторе VS Code${this.RESET}`;
      else                                 description = ` ${this.DIM}— Автоматический модуль расширения [System Hook]${this.RESET}`;

      const fullLine = menuButton + description;
      const leftPad = Math.max(0, Math.floor((w - 75) / 2));
      s += ' '.repeat(leftPad) + fullLine + '\r\n';
    });

    s += '\r\n' + ' '.repeat(Math.max(0, Math.floor((w - 65) / 2))) + `${this.DIM}${'-'.repeat(65)}${this.RESET}\r\n`;
    s += `${this.center(`${this.DIM}Навигация: ${this.RESET}[W/S]${this.DIM} | Назад: ${this.RESET}[Backspace]${this.DIM} | Запуск: ${this.RESET}[ENTER]${this.RESET}`, w)}\r\n`;

    return s;
  }

  private async openCustomAsset(fileName: string): Promise<void> {
    try {
      const assetsPath = path.join(this.context.extensionUri.fsPath, 'assets', fileName);
      if (!fs.existsSync(assetsPath)) throw new Error('Файл не найден на диске!');

      const doc = await vscode.workspace.openTextDocument(assetsPath);
      await vscode.window.showTextDocument(doc, { preview: false, viewColumn: vscode.ViewColumn.Beside });
      vscode.window.showInformationMessage(`Ассет ${fileName} успешно развернут!`);
    } catch (err: any) {
      vscode.window.showErrorMessage(`Ошибка загрузки ассета: ${err.message}`);
    }
  }

  public resize(width: number, height: number): void {
    if (this.ctx) {
      this.ctx.terminalWidth = width;
      this.ctx.terminalHeight = height;
    }
    this.router.refresh();
  }

  public dispose(): void {
    if (this.ctx && this.ctx.writeEmitter) {
      this.ctx.writeEmitter.fire('\x1b[?25h');
    }
  }

  private center(text: string, width: number): string {
    const clean = text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
    const pad = Math.max(0, Math.floor((width - clean.length) / 2));
    return ' '.repeat(pad) + text;
  }
}