/**
 * @fileoverview Экран генератора архитектурной разметки (Arch Generator).
 * Интегрирован в ядро TypeTip Studio. Создает md-шаблоны по нажатию Enter.
 * * 符合 Google TypeScript СТИЛЬ ПРАВИЛ
 * © The 'Just Make It Work' Group Vibe Coding Enterprises Corporation
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { IScreen, IScreenContext } from '../engine/interfaces';
import { AppRouter } from '../engine/router';

export class ArchGeneratorScreen implements IScreen {
  private ctx!: IScreenContext;
  
  // Состояния экрана
  private isGenerating = false;
  private isDone = false;
  private logs: string[] = [];

  // Константы из твоего скрипта
  private readonly IGNORE_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', '.idea', '.vscode', 'out'
  ]);

  // ANSI Цвета
  private readonly RESET = '\x1b[0m';
  private readonly BOLD = '\x1b[1m';
  private readonly DIM = '\x1b[2m';
  private readonly GREEN = '\x1b[1;92m';
  private readonly AMBER = '\x1b[1;93m';
  private readonly CYAN = '\x1b[1;96m';
  private readonly RED = '\x1b[1;91m';

  constructor(
    private readonly router: AppRouter,
    private readonly context: vscode.ExtensionContext
  ) {}

  public init(ctx: IScreenContext): void {
    this.ctx = ctx;
    this.isGenerating = false;
    this.isDone = false;
    this.logs = [];
  }

  public handleInput(data: string): void {
    // Блокируем повторный запуск, если процесс уже идет
    if (this.isGenerating) return;

    // По нажатию Enter запускаем процесс
    if (data === 'UI_ENTER' || data === '\r') {
      this.startGeneration();
    }
    
    // Очистка логов и сброс состояния по пробелу (опционально)
    if (data === ' ') {
        this.isDone = false;
        this.logs = [];
        this.router.refresh();
    }
  }

  private startGeneration(): void {
    this.isGenerating = true;
    this.isDone = false;
    this.logs = ['Инициализация процесса генерации...'];
    this.router.refresh();

    // Запускаем через setTimeout, чтобы отпустить Event Loop и дать UI отрисоваться
    setTimeout(() => {
      try {
        // Берем корень открытого воркспейса (твоего проекта)
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            throw new Error("Не открыта рабочая область (Workspace).");
        }
        
        const rootPath = workspaceFolders[0].uri.fsPath;
        this.logs.push(`Сканирование директории: ${rootPath}`);
        
        this.generateArchitectureFiles(rootPath, '');
        
        this.logs.push(`${this.GREEN}✅ Разметка завершена успешно! Можно заполнять структуру.${this.RESET}`);
      } catch (error: any) {
        this.logs.push(`${this.RED}❌ Ошибка: ${error.message}${this.RESET}`);
      } finally {
        this.isGenerating = false;
        this.isDone = true;
        this.router.refresh();
      }
    }, 150);
  }

  private createTemplate(dirName: string, relativePath: string): string {
    return `# Architecture: ${dirName}

## 🎯 Назначение модуля
Контекст: \`${relativePath}\`

## 🧩 Компоненты и Логические Сущности
- **Сущность 1**: ...
- **Сущность 2**: ...

## 🔄 Синхронизация и События (TypeTipBus / Кросс-коммуникация)
- **Входные события**: 
- **Выходные события**: 

## 🧠 Проверка Гипотез (Локальный контекст Llama 3)
- **Текущая гипотеза**: 

## ⚠️ Технический долг (Сканер Debt)
`;
  }

  private generateArchitectureFiles(currentDir: string, relativePath: string = ''): void {
    const items = fs.readdirSync(currentDir, { withFileTypes: true });

    if (relativePath !== '') {
      const mdPath = path.join(currentDir, 'architecture.md');
      const dirName = path.basename(currentDir);
      
      if (!fs.existsSync(mdPath)) {
        fs.writeFileSync(mdPath, this.createTemplate(dirName, relativePath), 'utf8');
        this.logs.push(`${this.GREEN}[CREATED]${this.RESET} ${relativePath}/architecture.md`);
      } else {
        this.logs.push(`${this.DIM}[EXISTS]  ${relativePath}/architecture.md (пропущено)${this.RESET}`);
      }
    }

    for (const item of items) {
      if (item.isDirectory() && !this.IGNORE_DIRS.has(item.name)) {
        const nextDir = path.join(currentDir, item.name);
        const nextRelativePath = relativePath ? `${relativePath}/${item.name}` : item.name;
        this.generateArchitectureFiles(nextDir, nextRelativePath);
      }
    }
  }

  public render(): string {
    const w = this.ctx.terminalWidth;
    const h = this.ctx.terminalHeight;
    let s = '\x1b[?25l\x1b[H\x1b[J'; // Очистка матрицы

    // Шапка
    s += `${this.CYAN}${this.BOLD}=== STANKA ARCHITECTURE GENERATOR ===${this.RESET}\r\n`;
    s += `${this.DIM}Автоматическая разметка MD-шаблонов по модулям проекта.${this.RESET}\r\n`;
    s += `${this.DIM}${'-'.repeat(w)}${this.RESET}\r\n\r\n`;

    // Инструкции / Статус
    if (!this.isGenerating && !this.isDone) {
        s += `${this.AMBER}► Нажми [ENTER] для запуска сканирования и генерации файлов.${this.RESET}\r\n\r\n`;
    } else if (this.isGenerating) {
        s += `${this.AMBER}⚙ Работаем... (Анализ файловой системы)${this.RESET}\r\n\r\n`;
    } else if (this.isDone) {
        s += `${this.GREEN}► Процесс завершен. Нажми [ПРОБЕЛ] для сброса логов.${this.RESET}\r\n\r\n`;
    }

    // Вывод логов (Viewport: показываем только последние строки, чтобы не сломать терминал)
    const maxLogLines = h - 8; 
    const visibleLogs = this.logs.slice(-maxLogLines);

    for (const log of visibleLogs) {
        // Обрезаем строку по ширине терминала, чтобы не было кривых переносов
        const cleanLog = log.replace(/\x1b\[[0-9;]*m/g, ''); // длина без ANSI кодов
        if (cleanLog.length > w - 2) {
            s += `  ${log.substring(0, w - 5)}...${this.RESET}\r\n`;
        } else {
            s += `  ${log}\r\n`;
        }
    }

    return s;
  }
}