/**
 * @fileoverview Экран реактивного управления локальными ИИ-ядрами с динамическим выбором языка.
 * Перехватывает свободный ввод разработчика из файла и инжектирует развернутые ответы Ollama.
 * Кастомизированный автоинжектор с системой Repeated Tokens Guard (RTG) против зацикливания.
 * 符合 Google TypeScript СТИЛЬ ПРАВИЛ // ПОСТРОЧНОЕ COMMENTИРОВАНИЕ
 * © The 'Just Make It Work' Group Vibe Coding Enterprises Corporation; xepctapk (ц) //™
 */

import * as vscode from 'vscode';
import { IScreen, IScreenContext } from '../engine/interfaces';
import { AppRouter } from '../engine/router';
import { TypeTipBus } from '../core/bus';

export class VersusScreen implements IScreen {
  /** Разделяемый контекст выполнения PTY-сессии терминала. */
  private ctx!: IScreenContext;

  /** Актуальный статус локального движка (IDLE / THINKING / CHUNKED / OFFLINE) */
  private modelStatus: string = 'IDLE';

  /** Последний зафиксированный токен или текстовый пакет от модели */
  private lastStreamedPayload: string = 'Режим глобального авто-инжектора АКТИВЕН. RTG защита готова.';

  /** Список реально установленных моделей на ПК пользователя */
  private readonly modelsList: string[] = ['codegemma:2b', 'qwen2:latest', 'llama3:latest'];

  /** Индекс текущей выбранной модели в массиве */
  private currentModelIdx: number = 0;

  /** Контроллер для прерывания текущего HTTP-запроса (стрима) */
  private abortController: AbortController | null = null;

  /** Подписка на событие изменения текстового документа */
  private changeDocSubscription: vscode.Disposable | null = null;

  /** Таймер для реализации задержки (Debounce) перед отправкой ИИ */
  private debounceTimer: NodeJS.Timeout | null = null;

  /** МАКСИМАЛЬНЫЙ ЛИМИТ ТОКЕНОВ ДЛЯ РАЗВЕРНУТЫХ ОТВЕТОВ (Вместо 30 ставим 1000) */
  private readonly MAX_ALLOWED_TOKENS: number = 1000;

  /** ДИНАМИЧЕСКИЙ ЯЗЫК ОТВЕТА (По умолчанию русский) */
  private targetLang: string = 'ru';

  constructor(
    private readonly router: AppRouter,
    private readonly context: vscode.ExtensionContext
  ) {}

  public init(ctx: IScreenContext): void {
    this.ctx = ctx;
    this.modelStatus = 'IDLE';
    TypeTipBus.emit('WS_STATUS', 'CONNECTED');

    // Фоновый перехватчик изменений в активной вкладке редактора
    this.changeDocSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
      if (this.modelStatus === 'THINKING' || this.modelStatus === 'CHUNKED') return;

      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor || e.document !== activeEditor.document) return;

      if (this.debounceTimer) clearTimeout(this.debounceTimer);

      // Ждем 1.2 секунды затишья после ввода, чтобы дать юзеру дописать длинную мысль/команду
      this.debounceTimer = setTimeout(() => {
        this.triggerAutomaticAIEngine(activeEditor);
      }, 1200);
    });
  }

  public render(): string {
    const w = this.ctx?.terminalWidth || 80;
    
    const RESET = '\x1b[0m';
    const BOLD = '\x1b[1m';
    const DIM = '\x1b[2m';
    const RED = '\x1b[1;31m';
    const GREEN = '\x1b[1;32m';
    const AMBER = '\x1b[1;33m';
    const CYAN = '\x1b[1;96m';

    let s = '\x1b[?25l\x1b[H\x1b[J';

    const title = '⚔️  GLOBAL AUTO-INJECTOR MODE (+RTG) ⚔️';
    s += `${this.center(`${BOLD}${RED}${title}${RESET}`, title.length, w)}\r\n`;
    s += `  ${DIM}${'-'.repeat(w - 4)}${RESET}\r\n\r\n`;

    // Рендерим выбор ядер
    s += `  ${BOLD}ACTIVE CORE (← A / D →):${RESET} `;
    this.modelsList.forEach((model, idx) => {
      if (idx === this.currentModelIdx) {
        s += `${CYAN}${BOLD}[► ${model.toUpperCase()} ◄]${RESET}  `;
      } else {
        s += `${DIM}[  ${model}  ]${RESET}  `;
      }
    });
    s += '\r\n\r\n';
    
    // ОКОШЕЧКО ВЫБОРА ЯЗЫКА ПРЯМО В ИНТЕРФЕЙСЕ
    s += `  ${BOLD}TARGET LANG:${RESET} ${GREEN}${BOLD}[ ${this.targetLang.toUpperCase()} ]${RESET} ${DIM}(en/ru/de/zh)${RESET}\r\n\r\n`;
    
    let statusVisual = `${GREEN}● СЛУШАЮ СТРОКУ (IDLE)${RESET}`;
    if (this.modelStatus === 'THINKING') {
      statusVisual = `${AMBER}⏳ АНАЛИЗ ЗАПРОСА (Генерация...)${RESET}`;
    } else if (this.modelStatus === 'CHUNKED') {
      statusVisual = `${RED}⚡ ИНЪЕКЦИЯ (RTG Активен!)${RESET}`;
    } else if (this.modelStatus === 'OFFLINE') {
      statusVisual = `${RED}✖ ПРЕРВАНО / АВТО-СТОП${RESET}`;
    }
    
    s += `  ${BOLD}ENGINE STATUS:${RESET} ${statusVisual}\r\n\r\n`;

    s += `  ${BOLD}AI LIVE STREAM BUFFER:${RESET}\r\n`;
    s += `  ┌${'─'.repeat(w - 6)}┐\r\n`;
    
    const maxTextWidth = w - 8;
    const regex = new RegExp(`.{1,${maxTextWidth}}`, 'g');
    const allLines = this.lastStreamedPayload.match(regex) || [this.lastStreamedPayload];
    const tailLines = allLines.slice(-4);

    tailLines.forEach(line => {
      s += `  │ ${line.padEnd(maxTextWidth)} │\r\n`;
    });
    s += `  └${'─'.repeat(w - 6)}┘\r\n\r\n`;

    s += `  ${DIM}${'-'.repeat(w - 4)}${RESET}\r\n`;
    const footer = '[A/D] Сменить Ядро | [Backspace] Локаль | [X] Глухой Стоп';
    s += `${this.center(`${DIM}${footer}${RESET}`, footer.length, w)}\r\n`;

    return s;
  }

  /**
   * Логика реактивного анализа контекста и инжекции длинных ответов.
   */
  private async triggerAutomaticAIEngine(activeEditor: vscode.TextEditor): Promise<void> {
    const position = activeEditor.selection.active;
    const currentLineText = activeEditor.document.lineAt(position.line).text.trim();
    
    const isQuestion = currentLineText.startsWith('?') || currentLineText.startsWith('// ?') || currentLineText.startsWith('# ?');
    const isTranslation = currentLineText.startsWith('!') || currentLineText.startsWith('// !') || currentLineText.startsWith('# !');
    const isMath = currentLineText.startsWith('=') || currentLineText.startsWith('// =') || currentLineText.startsWith('# =');

    if (!isQuestion && !isTranslation && !isMath) return; 
    
    let cleanPrompt = currentLineText.replace(/^(\/\/ \?|\# \?|\?|\/\/ \!|\# \!|\!|\/\/ \=|\# \=|\=)/, '').trim();
    if (cleanPrompt.length < 1) return;

    this.modelStatus = 'THINKING';
    this.lastStreamedPayload = `Обработка запроса...`;
    this.router.refresh();

    this.abortController = new AbortController();
    let tokenCount = 0;
    let isAbortedByLimit = false;

    // СИСТЕМА RTG: Параметры авто-стопа при повторах
    const isBaseModel = this.modelsList[this.currentModelIdx].includes('base') || this.modelsList[this.currentModelIdx].startsWith('codegemma');
    let rtgCounter = 0;
    let lastChunk: string | null = null;
    const RTG_THRESHOLD = 5; // Сколько раз подряд один чанк может повториться

    const langMap: Record<string, string> = { ru: 'русском языке', en: 'английском языке', de: 'немецком языке', fr: 'французском языке', zh: 'китайском языке', es: 'испанском языке' };
    const humanLang = langMap[this.targetLang] || `${this.targetLang.toUpperCase()} language`;

    try {
      const activeModel = this.modelsList[this.currentModelIdx];
      let customPrompt = '';
      
      if (isTranslation) {
        customPrompt = `Ты — профессиональный technical переводчик. Переведи следующий текст строго на ${humanLang}. ПРАВИЛА: 1. Выведи ТОЛЬКО чистый перевод, без вводных фраз, кавычек и пояснений. 2. Сохраняй неизменными технические термины, markdown-разметку, имена переменных, спецсимволы и код. Текст для перевода:
"${cleanPrompt}"`;
      } else if (isMath) {
        if (activeModel.startsWith('codegemma')) {
          customPrompt = `Вычисли математическое выражение.\nВыражение: ${cleanPrompt}\nРезультат: `;
        } else {
          customPrompt = `Реши выражение: "${cleanPrompt}". Выведи ТОЛЬКО численный ответ, без шагов решения.`;
        }
      } else {
        if (activeModel.startsWith('codegemma')) {
          customPrompt = `${cleanPrompt}\n`;
        } else {
          customPrompt = `Ты — встроенный лаконичный инженерный ИИ. Дай точный, развернутый ответ или сгенерируй код на запрос: "${cleanPrompt}". Ответ напиши строго на ${humanLang}. Пиши сразу по делу.`;
        }
      }

      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: activeModel,
          prompt: customPrompt,
          stream: true,
          options: {
            temperature: (isTranslation || isMath) ? 0.0 : (activeModel.startsWith('codegemma') ? 0.1 : 0.4),
            num_predict: 500,
            stop: isMath && activeModel.startsWith('codegemma') ? ['\n'] : []
          }
        }),
        signal: this.abortController.signal
      });

      if (!response.ok) throw new Error(`Ошибка Ollama: ${response.statusText}`);

      this.modelStatus = 'CHUNKED';
      this.lastStreamedPayload = '';
      this.router.refresh();

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      
      await activeEditor.edit((editBuilder) => { editBuilder.insert(activeEditor.selection.active, '\n'); });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const rawJson = decoder.decode(value, { stream: true });
        const lines = rawJson.split('\n');
        
        for (const line of lines) {
          if (line.trim() === '') continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.response) {
              const chunk = parsed.response;
              
              tokenCount++;

              // 🛡️ СИСТЕМА RTG (Repeated Tokens Guard): Авто-анти-спам
              // Проверяем, если Base-модель начала спамить одной и той же строкой
              if (isBaseModel && lastChunk !== null && chunk.trim() === lastChunk.trim()) {
                rtgCounter++;
                // Если счетчик RTG превысил порог (5 раз подряд) — аппаратный стоп
                if (rtgCounter > RTG_THRESHOLD) {
                  isAbortedByLimit = true;
                  this.abortController.abort(); // Вырубаем HTTP стрим
                  break; 
                }
              } else {
                rtgCounter = 0; // Токен сменился — сбрасываем счетчик RTG
                lastChunk = chunk; // Обновляем "последний чанк"
              }

              // Системный стопор по общему лимиту токенов (1000)
              if (tokenCount > this.MAX_ALLOWED_TOKENS) {
                isAbortedByLimit = true;
                this.abortController.abort();
                break;
              }

              this.lastStreamedPayload += chunk;
              await activeEditor.edit((editBuilder) => { editBuilder.insert(activeEditor.selection.active, chunk); });
              this.router.refresh();
            }
          } catch (e) {}
        }
        
        if (isAbortedByLimit) break;
      }

      await activeEditor.edit((editBuilder) => {
        const currentPos = activeEditor.selection.active;
        if (isAbortedByLimit && rtgCounter > RTG_THRESHOLD) {
          editBuilder.insert(currentPos, '\n\n⚠️ [ИНЪЕКЦИЯ ПРЕРВАНА: RTG АНТИ-СПАМ: Повторяющийся токен]');
        } else {
          editBuilder.insert(currentPos, '\n');
        }
      });

      this.modelStatus = 'IDLE';
      this.abortController = null;
      this.router.refresh();

    } catch (err: any) {
      if (err.name !== 'AbortError') {
        this.modelStatus = 'OFFLINE';
        this.lastStreamedPayload = `Крах: ${err.message}`;
        this.router.refresh();
      }
      this.abortController = null;
    }
  }  

  /**
   * Перехват ввода с клавиатуры терминала для динамической настройки локали
   */
  public async handleInput(data: string): Promise<void> {
    if (data === 'a' || data === 'A' || data === 'ф' || data === 'Ф' || data === '\x1b[D') {
      if (this.modelStatus === 'CHUNKED' || this.modelStatus === 'THINKING') return;
      this.currentModelIdx = (this.currentModelIdx - 1 + this.modelsList.length) % this.modelsList.length;
      this.router.refresh();
      return;
    }

    if (data === 'd' || data === 'D' || data === 'в' || data === 'В' || data === '\x1b[C') {
      if (this.modelStatus === 'CHUNKED' || this.modelStatus === 'THINKING') return;
      this.currentModelIdx = (this.currentModelIdx + 1) % this.modelsList.length;
      this.router.refresh();
      return;
    }
    // КНОПКА X: Аппаратный стоп при зацикливании
    if (data === 'x' || data === 'X' || data === 'ч' || data === 'Ч') {
      if (this.abortController) {
        this.abortController.abort();
        this.modelStatus = 'OFFLINE';
        this.lastStreamedPayload = 'Генерация принудительно прервана оператором.';
        this.router.refresh();
      }
      return;
    }

    // ОБРАБОТКА ИЗМЕНЕНИЯ ЯЗЫКА: Если нажат Backspace
    if (data === '\x7f' || data === '\x08') {
      if (this.targetLang.length > 0) { this.targetLang = this.targetLang.slice(0, -1); this.router.refresh(); }
      return;
    }

    // Если вводятся обычные латинские буквы — дописываем их в локаль
    if (/^[a-zA-Z\-]$/.test(data)) {
      if (this.targetLang.length < 5) { this.targetLang += data.toLowerCase(); this.router.refresh(); }
      return;
    }
  }

  public resize(width: number, height: number): void { if (this.ctx) { this.ctx.terminalWidth = width; this.ctx.terminalHeight = height; } this.router.refresh(); }
  public dispose(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.changeDocSubscription) { this.changeDocSubscription.dispose(); this.changeDocSubscription = null; }
    if (this.abortController) { this.abortController.abort(); this.abortController = null; }
  }

  private center(text: string, cleanLength: number, width: number): string {
    const padding = Math.max(0, Math.floor((width - cleanLength) / 2));
    return ' '.repeat(padding) + text;
  }
}