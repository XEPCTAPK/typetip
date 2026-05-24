/**
 * @fileoverview Умный генератор архитектуры STANKA V2 с интеграцией локальной Ollama
 * и встроенным интерактивным редактором системных промптов на лету.
 * 符合 Google TypeScript ПРАВИЛА СТИЛЯ // ПОСТРОЧНОЕ КОММЕНТИРОВАНИЕ
 * © The 'Just Make It Work' Group Vibe Coding Enterprises Corporation
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import http from 'http';
import { IScreen, IScreenContext } from '../engine/interfaces';
import { AppRouter } from '../engine/router';

interface IScanModule {
  id: string;
  name: string;
  desc: string;
  enabled: boolean;
  systemPrompt: string;      // Текущий рабочий промпт (может редактироваться)
  defaultPrompt: string;     // Неизменяемый шаблон для сброса (Reset)
}

export class ArchGeneratorScreen implements IScreen {
  private ctx!: IScreenContext;
  
  // Флаги состояний UI
  private isGenerating = false;
  private isDone = false;
  private isEditingPrompt = false; // Флаг: находимся ли мы в режиме ввода текста
  private logs: string[] = [];
  private selectedIndex = 0;
  private promptBuffer = '';       // Буфер для ввода текущей строки промпта

  // Настройки Ollama
  private readonly OLLAMA_MODEL = 'llama3'; 
  private readonly OLLAMA_URL = 'http://127.0.0.1:11434/api/generate';

  // Модули с зашитыми дефолтными шаблонами
  private scanModules: IScanModule[] = [
    { 
      id: 'MERMAID', 
      name: 'Mermaid Графы (LLM)', 
      desc: 'Нейросеть строит карту связей компонентов', 
      enabled: true,
      systemPrompt: 'Ты — AI Архитектор. Проанализируй код файла и выведи ТОЛЬКО блок диаграммы mermaid (graph TD), показывающий связи этого класса с другими. Не пиши никаких пояснений, только код mermaid внутри ```mermaid.',
      defaultPrompt: 'Ты — AI Архитектор. Проанализируй код файла и выведи ТОЛЬКО блок диаграммы mermaid (graph TD), показывающий связи этого класса с другими. Не пиши никаких пояснений, только код mermaid внутри ```mermaid.'
    },
    { 
      id: 'LIFECYCLE', 
      name: 'Детектор Утечек (LLM)', 
      desc: 'Поиск забытых подписок и таймеров', 
      enabled: false,
      systemPrompt: 'Ты — системный аудитор. Найди в коде утечки памяти: незакрытые setInterval, setTimeout, подписки .subscriptions.push без dispose(). Если утечек нет, напиши "ЧИСТО". Если есть, кратко укажи строку и причину. Будь лаконичен.',
      defaultPrompt: 'Ты — системный аудитор. Найди в коде утечки памяти: незакрытые setInterval, setTimeout, подписки .subscriptions.push без dispose(). Если утечек нет, напиши "ЧИСТО". Если есть, кратко укажи строку и причину. Будь лаконичен.'
    },
    { 
      id: 'SMELLS', 
      name: 'Анализ "Запахов" (LLM)', 
      desc: 'Оценка архитектурного спагетти и нарушений SRP', 
      enabled: false,
      systemPrompt: 'Ты — эксперт по рефакторингу. Оцени чистоту кода. Найди нарушения SOLID, SRP или слишком сложные методы. Выдай краткий список рекомендаций (максимум 3 пункта). Никакой лишней воды.',
      defaultPrompt: 'Ты — эксперт по рефакторингу. Оцени чистоту кода. Найди нарушения SOLID, SRP или слишком сложные методы. Выдай краткий список рекомендаций (максимум 3 пункта). Никакой лишней воды.'
    }
  ];

  private readonly IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', 'assets']);

  // ANSI Палитра
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
    this.isEditingPrompt = false;
    this.logs = [];
    this.selectedIndex = 0;
    this.promptBuffer = '';
  }

  public handleInput(data: string): void {
    // РЕЖИМ 1: Редактирование системного промпта
    if (this.isEditingPrompt) {
      this.handleEditorInput(data);
      return;
    }

    // Блокировка ввода во время генерации
    if (this.isGenerating) return;

    // РЕЖИМ 2: Стандартная навигация по пульту
    if (data === 'UI_UP' || data === 'w' || data === 'W') {
      this.selectedIndex = (this.selectedIndex - 1 + this.scanModules.length) % this.scanModules.length;
      this.router.refresh();
    } else if (data === 'UI_DOWN' || data === 's' || data === 'S') {
      this.selectedIndex = (this.selectedIndex + 1) % this.scanModules.length;
      this.router.refresh();
    } else if (data === ' ') {
      // ПРОБЕЛ: Включение/выключение модуля
      this.scanModules[this.selectedIndex].enabled = !this.scanModules[this.selectedIndex].enabled;
      this.router.refresh();
    } else if (data === 'e' || data === 'E' || data === 'у' || data === 'У') {
      // КЛАВИША E: Вход в режим редактирования промпта
      this.isEditingPrompt = true;
      this.promptBuffer = this.scanModules[this.selectedIndex].systemPrompt;
      this.router.refresh();
    } else if (data === 'r' || data === 'R' || data === 'к' || data === 'К') {
      // КЛАВИША R: Сброс промпта к исходному шаблону из кода
      this.scanModules[this.selectedIndex].systemPrompt = this.scanModules[this.selectedIndex].defaultPrompt;
      this.router.refresh();
    } else if (data === 'UI_ENTER' || data === '\r') {
      // ENTER: Старт или сброс логов
      if (this.isDone) {
        this.isDone = false;
        this.logs = [];
        this.router.refresh();
      } else {
        this.startOllamaPipeline();
      }
    }
  }

  /**
   * Внутренний обработчик ввода букв для редактора промптов
   */
  private handleEditorInput(data: string): void {
    if (data === '\r' || data === 'UI_ENTER') {
      // Сохраняем изменения по нажатию Enter
      this.scanModules[this.selectedIndex].systemPrompt = this.promptBuffer;
      this.isEditingPrompt = false;
      this.router.refresh();
    } else if (data === '\x1b' || data === '\x03') {
      // ESC или Ctrl+C: Отмена редактирования без сохранения
      this.isEditingPrompt = false;
      this.router.refresh();
    } else if (data === '\x7f' || data === '\b') {
      // Backspace: Удаление последнего символа
      if (this.promptBuffer.length > 0) {
        this.promptBuffer = this.promptBuffer.substring(0, this.promptBuffer.length - 1);
        this.router.refresh();
      }
    } else if (data.length === 1 && data >= ' ') {
      // Добавление обычных печатных символов в буфер строки
      this.promptBuffer += data;
      this.router.refresh();
    }
  }

/**
   * Каскадный запуск конвейера: Сборка Графа -> Инъекция Кодекса -> Нейро-Анализ
   */
  private async startOllamaPipeline(): Promise<void> {
    this.isGenerating = true;
    this.isDone = false;
    this.logs = [`[SYS]: Запуск конвейера STANKA V2...`];
    this.router.refresh();

    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) throw new Error("Не открыта рабочая область (Workspace).");
      
      const rootPath = workspaceFolders[0].uri.fsPath;
      const srcPath = path.join(rootPath, 'src');

      // ШАГ 1: Собираем список всех файлов
      let allFiles: string[] = [];
      this.collectFiles(srcPath, allFiles);
      if (allFiles.length === 0) throw new Error("Нет файлов для анализа.");

      // ШАГ 2: Подготавливаем "Что имеем сейчас" (PROJECT_GRAPH.md)
      this.logs.push(`[SYS]: Сборка текущей структуры в PROJECT_GRAPH.md...`);
      this.router.refresh();
      const currentGraph = this.buildInternalGraph(allFiles); // Вспомогательный метод (см. ниже)
      fs.writeFileSync(path.join(rootPath, 'PROJECT_GRAPH.md'), currentGraph, 'utf8');

      // ШАГ 3: Читаем "Суть и структуру" (THE_CO_DEC.md)
      const codecPath = path.join(rootPath, 'THE_CO_DEC.md');
      let globalCodecContent = '';
      if (fs.existsSync(codecPath)) {
        this.logs.push(`[SYS]: Найдена конституция THE_CO_DEC.md. Подключаем...`);
        globalCodecContent = fs.readFileSync(codecPath, 'utf-8');
      }

      this.logs.push(`[SYS]: Отправка данных в локальную нейросеть (${this.OLLAMA_MODEL})...`);
      this.router.refresh();

      let finalArchitecture = `# IDEAL ARCHITECTURE\n\n`;
      finalArchitecture += `*Сгенерировано STANKA на базе THE_CO_DEC и текущего графа проекта.*\n\n`;

      // Бежим по включенным модулям (задачам из UI)
      for (const mod of this.scanModules) {
        if (!mod.enabled) continue;

        this.logs.push(`${this.AMBER}[АНАЛИЗ]: Выполняю задачу "${mod.name}"...${this.RESET}`);
        this.router.refresh();
        
        // СБОРКА ИДЕАЛЬНОГО ПРОМПТА-МАТРЁШКИ
        let structuredPrompt = '';
        
        // 1. Кто мы и наша суть (THE_CO_DEC)
        if (globalCodecContent) {
          structuredPrompt += `=== КОНСТИТУЦИЯ И СУТЬ ПРОЕКТА (THE_CO_DEC.md) ===\n`;
          structuredPrompt += `Твоя роль и правила принятия решений жестко описаны здесь:\n${globalCodecContent}\n==================================================\n\n`;
        }

        // 2. Локальная задача из генератора (UI)
        structuredPrompt += `=== ТВОЯ ТЕКУЩАЯ ЗАДАЧА ===\n${mod.systemPrompt}\n================================\n\n`;

        // 3. Фактическое состояние (PROJECT_GRAPH.md)
        structuredPrompt += `=== ТЕКУЩЕЕ СОСТОЯНИЕ ПРОЕКТА (PROJECT_GRAPH.md) ===\n`;
        structuredPrompt += `Вот как проект выглядит прямо сейчас (карта импортов и связей):\n${currentGraph}\n==================================================\n\n`;

        // 4. Код (если нужно, можно передавать код конкретных файлов, либо весь, если влезет в 8k токенов)
        structuredPrompt += `Основываясь на конституции и текущем состоянии, выполни задачу и выдай результат для файла ARCHITECTURE.md.`;

        try {
          const aiResponse = await this.queryOllama(structuredPrompt);
          finalArchitecture += `## Результат модуля: ${mod.name}\n${aiResponse}\n\n`;
        } catch (err: any) {
          this.logs.push(`  ${this.RED}❌ Ошибка Ollama: ${err.message}${this.RESET}`);
        }
      }

      // ШАГ 4: Записываем Цель (ARCHITECTURE.md)
      const archPath = path.join(rootPath, 'ARCHITECTURE.md');
      fs.writeFileSync(archPath, finalArchitecture, 'utf8');
      
      this.logs.push(`${this.GREEN}✅ Идеальная архитектура сформирована!${this.RESET}`);
      this.logs.push(`${this.CYAN}📄 Смотри результат в ARCHITECTURE.md${this.RESET}`);

    } catch (error: any) {
      this.logs.push(`${this.RED}❌ Сбой: ${error.message}${this.RESET}`);
    } finally {
      this.isGenerating = false;
      this.isDone = true;
      this.router.refresh();
    }
  }

  /**
   * Быстрый парсер для сборки "Что имеем сейчас" (PROJECT_GRAPH) без участия LLM
   */
  private buildInternalGraph(files: string[]): string {
    let graph = '```mermaid\ngraph TD;\n';
    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf-8');
      const baseName = path.basename(file, '.ts');
      const importRegex = /import\s+.*from\s+['"]([^'"]+)['"]/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        if (match[1].startsWith('.')) {
          const targetName = match[1].split('/').pop();
          graph += `    ${baseName} --> ${targetName};\n`;
        }
      }
    });
    graph += '```\n';
    return graph;
  }

  private collectFiles(dir: string, fileList: string[]) {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      if (item.isDirectory() && !this.IGNORE_DIRS.has(item.name)) {
        this.collectFiles(path.join(dir, item.name), fileList);
      } else if (item.isFile() && item.name.endsWith('.ts') && !item.name.endsWith('.d.ts')) {
        fileList.push(path.join(dir, item.name));
      }
    }
  }

  private queryOllama(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        model: this.OLLAMA_MODEL,
        prompt: prompt,
        stream: false,
        options: { temperature: 0.1, num_ctx: 4096 }
      });

      const req = http.request({
        hostname: '127.0.0.1',
        port: 11434,
        path: '/api/generate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const json = JSON.parse(body);
              resolve(json.response || '');
            } catch (e) {
              reject(new Error("Не удалось распарсить JSON от Ollama."));
            }
          } else {
            reject(new Error(`Локальная Ollama вернула статус ${res.statusCode}`));
          }
        });
      });

      req.on('error', (e) => reject(new Error(`Ollama недоступна: ${e.message}`)));
      req.write(postData);
      req.end();
    });
  }

  // ============================================================================
  // ОТРИСОВКА ИНТЕРФЕЙСА (ANSI МАТРИЦА)
  // ============================================================================
  public render(): string {
    const w = this.ctx.terminalWidth;
    const h = this.ctx.terminalHeight;
    let s = '\x1b[?25l\x1b[H\x1b[J'; // Скрытие курсора, сброс экрана

    // Главная шапка пульта
    s += `${this.CYAN}${this.BOLD}=== STANKA ARCHITECTURE GENERATOR V2 (PROMPT MASTER) ===${this.RESET}\r\n`;
    s += `${this.DIM}Драйвер параллельного нейро-анализа с живой модификацией промптов.${this.RESET}\r\n`;
    s += `${this.DIM}${'-'.repeat(w)}${this.RESET}\r\n\r\n`;

    if (this.isEditingPrompt) {
      // ОТРИСОВКА ОКНА РЕДАКТОРА СИСТЕМНОГО ПРОМПТА
      const currentMod = this.scanModules[this.selectedIndex];
      s += `${this.INVERT} 📝 РЕЖИМ РЕДАКТИРОВАНИЯ СИСТЕМНОГО ПРОМПТА ${this.RESET}\r\n`;
      s += `${this.DIM}Модуль: ${this.BOLD}${currentMod.name}${this.RESET}\r\n`;
      s += `${this.DIM}Управление: Вводи текст. [ENTER] - Сохранить | [ESC] - Отмена изменения.${this.RESET}\r\n`;
      s += `${this.DIM}${'-'.repeat(w)}${this.RESET}\r\n\r\n`;

      // Отображаем вводимый текст в рамке
      s += `${this.AMBER}Новый системный промпт:${this.RESET}\r\n`;
      s += `${this.GREEN}>>> ${this.promptBuffer}${this.CYAN}█${this.RESET}\r\n\r\n`;
      s += `${this.DIM}Заводской шаблон в коде скрипта останется нетронутым.${this.RESET}\r\n`;

    } else if (!this.isGenerating && !this.isDone) {
      // ОТРИСОВКА ГЛАВНОГО МЕНЮ КОНФИГУРАЦИИ
      s += `${this.AMBER}Навигация: [W/S] | Вкл/Выкл: [ПРОБЕЛ] | Редактировать промпт: [E] | Сброс: [R]${this.RESET}\r\n\r\n`;
      
      this.scanModules.forEach((mod, idx) => {
        const isSelected = idx === this.selectedIndex;
        const check = mod.enabled ? `${this.GREEN}[X]${this.RESET}` : `${this.DIM}[ ]${this.RESET}`;
        const pointer = isSelected ? `${this.CYAN}►${this.RESET}` : ' ';
        const style = isSelected ? this.INVERT : '';
        
        s += ` ${pointer} ${check} ${style} ${mod.name.padEnd(25)} ${this.RESET} ${this.DIM}- ${mod.desc}${this.RESET}\r\n`;
        
        // Дополнительно выводим текущий системный промпт для выбранного элемента
        if (isSelected) {
          s += `     ${this.CYAN}└─ Текущий промпт: ${this.RESET}${this.DIM}${mod.systemPrompt}${this.RESET}\r\n`;
        }
      });
      
      s += `\r\n${this.GREEN}Нажми [ENTER] чтобы запустить локальный конвейер анализа${this.RESET}\r\n`;
    } else {
      // ОТРИСОВКА ЖИВОГО ВЫВОДА ЛОГОВ АНАЛИЗА КАСКАДА
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