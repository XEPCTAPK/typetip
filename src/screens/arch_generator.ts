/**
 * @fileoverview Умный генератор архитектуры STANKA V2.
 * Интегрирован в ядро TypeTip Studio. Включает детекторы запахов, 
 * генерацию диаграмм и проверку жизненных циклов.
 * © The 'Just Make It Work' Group Vibe Coding Enterprises Corporation
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { IScreen, IScreenContext } from '../engine/interfaces';
import { AppRouter } from '../engine/router';

// Конфигурация доступных модулей сканирования
interface IScanModule {
  id: string;
  name: string;
  desc: string;
  enabled: boolean;
}

export class ArchGeneratorScreen implements IScreen {
  private ctx!: IScreenContext;
  
  // Состояния UI
  private isGenerating = false;
  private isDone = false;
  private logs: string[] = [];
  private selectedIndex = 0;

  // Модули, которые можно включать/выключать
  private scanModules: IScanModule[] = [
    { id: 'MD_GEN', name: 'Базовая MD-Разметка', desc: 'Создает пустые архитектурные файлы', enabled: true },
    { id: 'MERMAID', name: 'Mermaid Графы', desc: 'Генерирует граф зависимостей (импортов)', enabled: false },
    { id: 'LIFECYCLE', name: 'Детектор Утечек', desc: 'Ищет незакрытые интервалы и события', enabled: false },
    { id: 'SMELLS', name: 'Анализ "Запахов"', desc: 'Проверка длины файлов иSRP-нарушений', enabled: false },
    { id: 'BOILER', name: 'Boilerplate-инъектор', desc: 'Создает шаблон нового IScreen (если его нет)', enabled: false }
  ];

  private readonly IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', 'assets']);

  // ANSI Цвета
  private readonly RESET = '\x1b[0m';
  private readonly BOLD = '\x1b[1m';
  private readonly DIM = '\x1b[2m';
  private readonly GREEN = '\x1b[1;92m';
  private readonly AMBER = '\x1b[1;93m';
  private readonly CYAN = '\x1b[1;96m';
  private readonly RED = '\x1b[1;91m';
  private readonly INVERT = '\x1b[7m';

  constructor(private readonly router: AppRouter, private readonly context: vscode.ExtensionContext) {}

  public init(ctx: IScreenContext): void {
    this.ctx = ctx;
    this.isGenerating = false;
    this.isDone = false;
    this.logs = [];
    this.selectedIndex = 0;
  }

  public handleInput(data: string): void {
    if (this.isGenerating) return;

    if (data === 'UI_UP' || data === 'w' || data === 'W') {
      this.selectedIndex = (this.selectedIndex - 1 + this.scanModules.length) % this.scanModules.length;
      this.router.refresh();
    } else if (data === 'UI_DOWN' || data === 's' || data === 'S') {
      this.selectedIndex = (this.selectedIndex + 1) % this.scanModules.length;
      this.router.refresh();
    } else if (data === ' ') {
      // ПРОБЕЛ: Переключаем чекбокс
      this.scanModules[this.selectedIndex].enabled = !this.scanModules[this.selectedIndex].enabled;
      this.router.refresh();
    } else if (data === 'UI_ENTER' || data === '\r') {
      // ENTER: Запуск
      if (this.isDone) {
        this.isDone = false;
        this.logs = [];
        this.router.refresh();
      } else {
        this.startGeneration();
      }
    }
  }

  private startGeneration(): void {
    this.isGenerating = true;
    this.isDone = false;
    this.logs = ['[SYS]: Инициализация систем STANKA V2...'];
    this.router.refresh();

    setTimeout(() => {
      try {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) throw new Error("Не открыта рабочая область (Workspace).");
        
        const rootPath = workspaceFolders[0].uri.fsPath;
        const srcPath = path.join(rootPath, 'src'); // Сканируем только папку src для точности

        // 1. Сбор глобальной статистики проекта
        let allFiles: string[] = [];
        this.collectFiles(srcPath, allFiles);

        // 2. Выполнение активных модулей
        if (this.isModuleEnabled('MD_GEN')) {
            this.generateArchitectureFiles(srcPath, '');
        }
        if (this.isModuleEnabled('MERMAID')) {
            this.generateMermaidDiagram(rootPath, allFiles);
        }
        if (this.isModuleEnabled('LIFECYCLE')) {
            this.detectLifecycles(allFiles);
        }
        if (this.isModuleEnabled('SMELLS')) {
            this.detectSmells(allFiles);
        }
        if (this.isModuleEnabled('BOILER')) {
            this.injectBoilerplate(srcPath);
        }
        
        this.logs.push(`${this.GREEN}✅ STANKA завершил анализ!${this.RESET}`);
      } catch (error: any) {
        this.logs.push(`${this.RED}❌ Ошибка: ${error.message}${this.RESET}`);
      } finally {
        this.isGenerating = false;
        this.isDone = true;
        this.router.refresh();
      }
    }, 150);
  }

  // ============================================================================
  // ЛОГИКА МОДУЛЕЙ АНАЛИЗА
  // ============================================================================

  private isModuleEnabled(id: string): boolean {
    return this.scanModules.find(m => m.id === id)?.enabled || false;
  }

  private collectFiles(dir: string, fileList: string[]) {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      if (item.isDirectory() && !this.IGNORE_DIRS.has(item.name)) {
        this.collectFiles(path.join(dir, item.name), fileList);
      } else if (item.isFile() && item.name.endsWith('.ts')) {
        fileList.push(path.join(dir, item.name));
      }
    }
  }

  // Модуль 1: Разметка MD
  private generateArchitectureFiles(currentDir: string, relativePath: string = ''): void {
    if (!fs.existsSync(currentDir)) return;
    const items = fs.readdirSync(currentDir, { withFileTypes: true });
    if (relativePath !== '') {
      const mdPath = path.join(currentDir, 'architecture.md');
      if (!fs.existsSync(mdPath)) {
        fs.writeFileSync(mdPath, `# Architecture: ${path.basename(currentDir)}\n`, 'utf8');
        this.logs.push(`${this.GREEN}[MD] Создан:${this.RESET} ${relativePath}/architecture.md`);
      }
    }
    for (const item of items) {
      if (item.isDirectory() && !this.IGNORE_DIRS.has(item.name)) {
        this.generateArchitectureFiles(path.join(currentDir, item.name), relativePath ? `${relativePath}/${item.name}` : item.name);
      }
    }
  }

  // Модуль 2: Граф Mermaid (Анализ импортов)
  private generateMermaidDiagram(rootPath: string, files: string[]): void {
    this.logs.push(`[MERMAID] Сборка графа зависимостей...`);
    let mermaid = '```mermaid\ngraph TD;\n';
    
    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf-8');
      const baseName = path.basename(file, '.ts');
      
      // Ищем все import { X } from './path'
      const importRegex = /import\s+.*from\s+['"]([^'"]+)['"]/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1];
        if (importPath.startsWith('.')) { // Только внутренние файлы проекта
          const targetName = importPath.split('/').pop();
          mermaid += `    ${baseName} --> ${targetName};\n`;
        }
      }
    });
    mermaid += '```\n';
    
    const outPath = path.join(rootPath, 'PROJECT_GRAPH.md');
    fs.writeFileSync(outPath, `# Живой граф архитектуры TypeTip\n\n${mermaid}`, 'utf8');
    this.logs.push(`${this.CYAN}[MERMAID] Граф сохранен в PROJECT_GRAPH.md${this.RESET}`);
  }

  // Модуль 3: Утечки памяти (События без dispose)
  private detectLifecycles(files: string[]): void {
    this.logs.push(`[LIFECYCLE] Сканирование на утечки памяти...`);
    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf-8');
      const baseName = path.basename(file);
      
      const hasSubscriptions = content.includes('.subscriptions.push') || content.includes('setInterval');
      const hasDispose = content.includes('dispose()') || content.includes('clearInterval');

      if (hasSubscriptions && !hasDispose && !baseName.includes('extension.ts')) {
        this.logs.push(`${this.RED}  [ALARM] В ${baseName} найдены подписки, но нет dispose()!${this.RESET}`);
      }
    });
  }

  // Модуль 4: Запахи кода (Крупные файлы)
  private detectSmells(files: string[]): void {
    this.logs.push(`[SMELLS] Анализ чистоты кода...`);
    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n').length;
      if (lines > 250) { // Лимит 250 строк для Vibe Coding
        this.logs.push(`${this.AMBER}  [SMELL] Файл ${path.basename(file)} слишком толстый (${lines} строк). Разбей его!${this.RESET}`);
      }
    });
  }

  // Модуль 5: Генератор болванки экрана
  private injectBoilerplate(srcPath: string): void {
    const screensDir = path.join(srcPath, 'screens');
    const newScreenPath = path.join(screensDir, 'new_screen.ts');
    
    if (fs.existsSync(screensDir) && !fs.existsSync(newScreenPath)) {
      const template = `import { IScreen, IScreenContext } from '../engine/interfaces';\n\nexport class NewScreen implements IScreen {\n  public init(ctx: IScreenContext): void {}\n  public handleInput(data: string): void {}\n  public render(): string { return '\\x1b[H\\x1b[J NEW SCREEN'; }\n}\n`;
      fs.writeFileSync(newScreenPath, template, 'utf8');
      this.logs.push(`${this.GREEN}[BOILER] Создан шаблон нового экрана в ${newScreenPath}${this.RESET}`);
    }
  }

  // ============================================================================
  // ОТРИСОВКА ИНТЕРФЕЙСА
  // ============================================================================

  public render(): string {
    const w = this.ctx.terminalWidth;
    const h = this.ctx.terminalHeight;
    let s = '\x1b[?25l\x1b[H\x1b[J';

    // Шапка
    s += `${this.CYAN}${this.BOLD}=== STANKA ARCHITECTURE GENERATOR V2 ===${this.RESET}\r\n`;
    s += `${this.DIM}Интерактивный пульт сборки и анализа архитектуры.${this.RESET}\r\n`;
    s += `${this.DIM}${'-'.repeat(w)}${this.RESET}\r\n\r\n`;

    if (!this.isGenerating && !this.isDone) {
        s += `${this.AMBER}Конфигурация модулей анализа (Нажми [ПРОБЕЛ] для вкл/выкл):${this.RESET}\r\n\r\n`;
        
        // Рендер меню чекбоксов
        this.scanModules.forEach((mod, idx) => {
            const isSelected = idx === this.selectedIndex;
            const check = mod.enabled ? `${this.GREEN}[X]${this.RESET}` : `${this.DIM}[ ]${this.RESET}`;
            const pointer = isSelected ? `${this.CYAN}►${this.RESET}` : ' ';
            const style = isSelected ? this.INVERT : '';
            
            s += ` ${pointer} ${check} ${style} ${mod.name.padEnd(25)} ${this.RESET} ${this.DIM}- ${mod.desc}${this.RESET}\r\n`;
        });
        
        s += `\r\n${this.GREEN}Нажми [ENTER] чтобы запустить STANKA${this.RESET}\r\n`;
    } else {
        // Режим вывода логов
        const maxLogLines = h - 6; 
        const visibleLogs = this.logs.slice(-maxLogLines);

        for (const log of visibleLogs) {
            const cleanLog = log.replace(/\x1b\[[0-9;]*m/g, ''); 
            if (cleanLog.length > w - 2) {
                s += `  ${log.substring(0, w - 5)}...${this.RESET}\r\n`;
            } else {
                s += `  ${log}\r\n`;
            }
        }
    }

    return s;
  }
}