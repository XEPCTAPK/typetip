/**
 * @fileoverview Экран статического анализатора долгов (Debt Scanner).
 * Интегрирован в ядро TypeTip Studio. Использует Tree-sitter и Git.
 * * 符合 Google TypeScript СТИЛЬ ПРАВИЛ
 * © The 'Just Make It Work' Group Vibe Coding Enterprises Corporation
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import Parser from 'tree-sitter';
import tsGrammar from 'tree-sitter-typescript';
import { IScreen, IScreenContext } from '../engine/interfaces';
import { AppRouter } from '../engine/router';

interface DebtItem {
  id: string;
  module: string;
  timeStr: string;
  timestamp: number;
  shortText: string;
  fullText: string;
  contextStr: string;
  file: string;
  line: number;
}

export class DebtScanner implements IScreen {
  private ctx!: IScreenContext;
  private isScanning = true;
  private items: DebtItem[] = [];
  
  // UI State
  private selectedIndex = 0;
  private expandedId: string | null = null;
  private viewportStart = 0;

  // ANSI Colors
  private readonly RESET = '\x1b[0m';
  private readonly BOLD = '\x1b[1m';
  private readonly DIM = '\x1b[2m';
  private readonly GREEN = '\x1b[1;92m';
  private readonly AMBER = '\x1b[1;93m';
  private readonly CYAN = '\x1b[1;96m';
  private readonly RED = '\x1b[1;91m';
  private readonly INVERT = '\x1b[7m';

  constructor(
    private readonly router: AppRouter,
    private readonly context: vscode.ExtensionContext
  ) {}

  public init(ctx: IScreenContext): void {
    this.ctx = ctx;
    this.isScanning = true;
    this.items = [];
    this.selectedIndex = 0;
    this.expandedId = null;
    
    // Запускаем тяжелый скан асинхронно, чтобы не заблочить UI терминала
    setTimeout(() => this.runScan(), 100);
  }

  private runScan(): void {
    try {
      const language = tsGrammar.typescript;
      const parser = new Parser();
      parser.setLanguage(language);
      const query = new Parser.Query(language, '(comment) @comment');

      const rootPath = this.context.extensionUri.fsPath;
      const filesToScan = this.getFiles(rootPath);

      for (const filepath of filesToScan) {
        const relativePath = path.relative(rootPath, filepath);
        const moduleName = path.dirname(relativePath) || 'root';
        const code = fs.readFileSync(filepath, 'utf8');
        
        const tree = parser.parse(code);
        const captures = query.captures(tree.rootNode);

        for (const { node } of captures) {
          const lineStart = node.startPosition.row + 1;
          const commentText = code.substring(node.startIndex, node.endIndex);
          
          if (!/TODO|FIXME|NOTE|DEBT/i.test(commentText)) continue;

          // Git Blame проверка
          const commitTime = this.getGitTime(filepath, lineStart);
          if (commitTime) {
            this.items.push({
              id: `${relativePath}:${lineStart}`,
              module: moduleName,
              timestamp: commitTime.getTime(),
              timeStr: `${commitTime.getHours().toString().padStart(2, '0')}:${commitTime.getMinutes().toString().padStart(2, '0')}`,
              shortText: commentText.trim().substring(0, 60),
              fullText: commentText.trim(),
              contextStr: 'Анализ AST...', // Заглушка, можно добавить логику поиска родителя
              file: relativePath,
              line: lineStart
            });
          }
        }
      }

      // Сортируем по времени (новые сверху)
      this.items.sort((a, b) => b.timestamp - a.timestamp);
    } catch (e) {
      console.error("Scanner Error:", e);
    } finally {
      this.isScanning = false;
      this.router.refresh();
    }
  }

  private getFiles(dir: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (/node_modules|\.git|dist|build|out/.test(file)) continue;
      const filePath = path.join(dir, file);
      if (fs.statSync(filePath).isDirectory()) {
        this.getFiles(filePath, fileList);
      } else if (/\.(ts|js|tsx)$/.test(filePath)) {
        fileList.push(filePath);
      }
    }
    return fileList;
  }

  private getGitTime(filepath: string, line: number): Date | null {
    try {
      const cmd = `git blame -L ${line},${line} --since="24 hours ago" -t --porcelain "${filepath}"`;
      const result = execSync(cmd, { cwd: this.context.extensionUri.fsPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
      
      const match = result.match(/author-time (\d+)/);
      if (match) return new Date(parseInt(match[1], 10) * 1000);
    } catch (e) { /* Игнорируем ошибки гита */ }
    return null;
  }

  public handleInput(data: string): void {
    if (this.isScanning || this.items.length === 0) return;

    if (data === 'UI_UP' || data === 'w' || data === 'W') {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.expandedId = null; // Закрываем шторку при движении
    } 
    else if (data === 'UI_DOWN' || data === 's' || data === 'S') {
      this.selectedIndex = Math.min(this.items.length - 1, this.selectedIndex + 1);
      this.expandedId = null;
    } 
    else if (data === 'UI_ENTER' || data === '\r') {
      // Тогл шторки: если нажали на уже открытый — закрываем
      const currentId = this.items[this.selectedIndex].id;
      this.expandedId = (this.expandedId === currentId) ? null : currentId;
    }

    this.router.refresh();
  }

  public render(): string {
    const w = this.ctx.terminalWidth;
    const h = this.ctx.terminalHeight;
    let s = '\x1b[?25l\x1b[H\x1b[J'; // Очистка матрицы

    s += `${this.CYAN}${this.BOLD}=== VIBE DEBT SCANNER // THE JUST MAKE IT WORK GROUP ===${this.RESET}\r\n`;
    s += `${this.DIM}Поиск TODO/FIXME/NOTE за последние 24 часа. [Enter] - развернуть.${this.RESET}\r\n`;
    s += `${this.DIM}${'-'.repeat(w)}${this.RESET}\r\n\r\n`;

    if (this.isScanning) {
      return s + `${this.AMBER}⚙ Сканирование AST деревьев и логов Git... Пожалуйста, подождите.${this.RESET}`;
    }

    if (this.items.length === 0) {
      return s + `${this.GREEN}✅ Чисто! Новых долгов за 24 часа не найдено.${this.RESET}`;
    }

    // Логика "окна просмотра" (Viewport) для прокрутки в терминале
    const listHeight = h - 6; // Оставляем место под шапку
    
    // Корректируем видимую зону
    if (this.selectedIndex < this.viewportStart) {
      this.viewportStart = this.selectedIndex;
    } else if (this.selectedIndex >= this.viewportStart + Math.floor(listHeight / 2)) {
      this.viewportStart = this.selectedIndex - Math.floor(listHeight / 2) + 1;
    }

    let currentModule = '';
    let renderedLines = 0;

    for (let i = this.viewportStart; i < this.items.length && renderedLines < listHeight; i++) {
      const item = this.items[i];
      const isSelected = (i === this.selectedIndex);
      const isExpanded = (this.expandedId === item.id);

      // Группировка по модулям
      if (item.module !== currentModule) {
        currentModule = item.module;
        s += `${this.BOLD}${this.AMBER}📁 ${currentModule}${this.RESET}\r\n`;
        renderedLines++;
      }

      // Отрисовка строки
      const prefix = isSelected ? `${this.GREEN}►${this.RESET}` : ' ';
      const color = isSelected ? this.INVERT : this.RESET;
      
      const lineText = `[${item.timeStr}] ${item.shortText} (${path.basename(item.file)}:${item.line})`;
      
      // Обрезаем, чтобы не ломать терминал переносами
      s += `${prefix} ${color}${lineText.padEnd(w - 3).substring(0, w - 3)}${this.RESET}\r\n`;
      renderedLines++;

      // Отрисовка развернутой шторки
      if (isExpanded) {
        const boxIndent = '    │ ';
        s += `${this.DIM}    ┌─ Полный текст ────────${this.RESET}\r\n`;
        s += `${boxIndent}${this.CYAN}${item.fullText}${this.RESET}\r\n`;
        s += `${boxIndent}${this.AMBER}Контекст: ${item.contextStr}${this.RESET}\r\n`;
        s += `${this.DIM}    └───────────────────────${this.RESET}\r\n`;
        renderedLines += 4;
      }
    }

    return s;
  }
}