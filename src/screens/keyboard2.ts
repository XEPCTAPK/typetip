/**
 * @fileoverview Игровой модуль классического тренажера слепой печати (Keyboard Mode).
 * Отрисовывает 5-рядную ретро-клавиатуру, рассчитывает CPM, управляет индикацией ошибок
 * и полностью подчиняется жизненному циклу IScreen под управлением AppRouter.
 * * © The 'Just Make It Work' Group Vibe Coding Enterprises Corporation; xepctapk (ц) //™
 */

import * as vscode from 'vscode';
import { IScreen, IScreenContext } from '../engine/interfaces';
import { AppRouter } from '../engine/router';

/**
 * Карта высокоинтенсивных ANSI-цветов для динамической подсветки активных пальцев.
 */
const COLOR_MAP: Record<string, string> = {
  'Yellow': '\x1b[1;93m',   // Жирный (1) + Ярко-желтый текст (93)
  'Cyan': '\x1b[1;96m',     // Жирный (1) + Ярко-бирюзовый текст (96)
  'Magenta': '\x1b[1;95m',  // Жирный (1) + Ярко-пурпурный текст (95)
  'Green': '\x1b[1;92m',    // Жирный (1) + Ярко-зеленый текст (92)
  'White': '\x1b[1;97m'     // Жирный (1) + Ярко-белый текст (97)
};

/**
 * Класс экрана классической тренировки набора кода с визуализацией клавиатуры.
 * * @implements {IScreen}
 */
export class TypeTipKeyboard implements IScreen {
  // --- КОНТЕКСТ И МАРШРУТИЗАЦИЯ ---
  /** Локальная ссылка на глобальный контекст терминала. */
  private ctx!: IScreenContext;

  // --- ИГРОВОЕ СОСТОЯНИЕ ---
  /** Строка целевого исходного кода для набора. */
  private targetCode = '';
  /** Корректно набранная часть текста пользователем. */
  private userInput = '';
  /** Счетчик ошибок в текущем раунде. */
  private errorCount = 0;
  /** Таймер обратного отсчета (в секундах). */
  private timeLeft = 120;
  /** Флаг завершения текущего раунда. */
  private isFinished = false;

  // --- ИСТОРИЧЕСКИЕ ДАННЫЕ ИЗ GLOBAL STATE ---
  private sessionNum = 1;
  private bestCpm = 0;
  private charLimit = 50;

  // --- ТАЙМЕРЫ И АНИМАЦИИ ---
  private timer: NodeJS.Timeout | undefined;
  private blinkInterval: NodeJS.Timeout | undefined;
  private hasError = false;
  private blinkState = false;
  private blinkCounter = 0;

  // --- ANSI ПАЛИТРА И СТИЛИЗАЦИЯ ---
  private readonly RESET = '\x1b[0m';
  private readonly DIM = '\x1b[2m';
  private readonly GREEN = '\x1b[1;32m';
  private readonly YELLOW = '\x1b[38;5;178m';
  private readonly BLUE = '\x1b[38;5;24m';
  private readonly RED = '\x1b[31m';
  private readonly INVERT = '\x1b[7m\x1b[1m';
  private readonly DIM_BLUE = '\x1b[2;38;5;24m';
  private readonly DISABLE_WRAP = '\x1b[?7l';
  private readonly ENABLE_WRAP = '\x1b[?7h';

  /**
   * Конструктор привязывает экран к диспетчеру маршрутизации.
   * * @param {AppRouter} router Экземпляр главного роутера приложения.
   */
  constructor(private router: AppRouter) {}

  /**
   * Инициализация экрана. Запускается роутером при монтировании компонента.
   * Сбрасывает таймеры, генерирует код и подтягивает статистику из стейта.
   * * @param {IScreenContext} ctx Актуальный контекст выполнения.
   */
  public init(ctx: IScreenContext): void {
    this.ctx = ctx;

    // Сброс локальных игровых переменных для новой сессии
    this.userInput = '';
    this.errorCount = 0;
    this.timeLeft = 120;
    this.isFinished = false;
    this.hasError = false;
    this.stopErrorBlink();

    // Извлечение персистентной статистики из реестра VS Code
    const state = this.ctx.extensionContext.globalState;
    this.sessionNum = state.get<number>('sessionNum', 1);
    this.bestCpm = state.get<number>('bestCpm', 0);
    this.charLimit = state.get<number>('charLimit', 50);

    // В продакшене здесь должен быть вызов внешнего генератора кода на основе charLimit.
    // Пока задаем хардкод-заглушку с нормализацией переносов строк под UNIX-стандарт.
    const rawSnippet = `export async function vibeCoding() {\n  console.log("Just make it work!");\n  return true;\n}`;
    this.targetCode = rawSnippet.replace(/\r\n/g, '\n');

    // Запускаем игровой таймер
    this.startTimer();
  }

  /**
   * Обновляет локальную геометрию при ресайзе окна.
   */
  public resize(width: number, height: number): void {
    this.ctx.terminalWidth = width;
    this.ctx.terminalHeight = height;
  }

  /**
   * Экстренная зачистка ресурсов перед размонтированием (робастность).
   */
  public dispose(): void {
    this.stopTimer();
    this.stopErrorBlink();
  }

  /**
   * Маршрутизатор сырого ввода пользователя в рамках сессии набора.
   * * @param {string} data Введенный символ или управляющий байт.
   */
  public handleInput(data: string): void {
    // === ГЛОБАЛЬНЫЙ ПЕРЕХВАТ: ВЫХОД В ХАБ ===
    if (data === '\x1b' || data.includes('\x7f') || data.includes('\x08')) {
      // Роутер сам вызовет наш dispose() при переходе в HUB
      this.router.navigateTo('HUB');
      return;
    }

    // === ОБРАБОТКА ЭКРАНА СТАТИСТИКИ ===
    if (this.isFinished) {
      if (data === '\r') {
        this.router.navigateTo('HUB');
      } else if (data === '`' || data === '~' || data === 'ё') {
        // Перезапуск текущего экрана (ремонтирование)
        this.router.navigateTo('KEYBOARD');
      }
      return;
    }

    // === ЛОГИКА НАБОРА СИМВОЛОВ ===
    const expected = this.targetCode[this.userInput.length];
    const isEnter = (data === '\r' && expected === '\n');

    if (isEnter || data === expected) {
      // Успешный ввод
      this.userInput += expected;
      this.hasError = false;
      this.stopErrorBlink();
      
      if (this.userInput.length >= this.targetCode.length) {
        this.finish();
      }
    } else if (!this.hasError) {
      // Ошибка ввода (штраф начисляется только один раз за символ)
      this.errorCount++;
      this.hasError = true;
      this.startErrorBlink();
    }

    // Запрашиваем перерисовку кадра у роутера
    this.router.refresh();
  }

  /**
   * Формирует итоговый ANSI-кадр интерфейса.
   * * @returns {string} Строка для вывода в PTY.
   */
  public render(): string {
    // \x1b[?7l -> Отключение ломающего автопереноса строк терминала
    // \x1b[2J\x1b[3J\x1b[H -> Полная очистка матрицы экрана и возвращение каретки в (0,0)
    let out = `${this.DISABLE_WRAP}\x1b[2J\x1b[3J\x1b[H`; 
    const width = this.ctx.terminalWidth;
    
    const headerText = 'typetip v.0.0.1-alfa XEPCTAPK Vibe Coding Corp. //™';
    const spacesLeft = ' '.repeat(Math.max(0, width - headerText.length));

    out += `${spacesLeft}${this.BLUE}${headerText}${this.RESET}\x1b[K\r\n`;
    out += `${this.DIM}${'-'.repeat(width)}${this.RESET}\x1b[K\r\n`;

    const leftText = '[ESC]:exit   [BACKSPACE]:Hub menu     ';
    const rightText = '**Vibe it!**';
    const midSpaces = ' '.repeat(Math.max(0, width - (leftText.length + rightText.length)));

    out += `${this.DIM}${leftText}${midSpaces}${rightText}${this.RESET}\x1b[K\r\n`;
    out += `${this.DIM_BLUE}${'═'.repeat(width)}${this.RESET}\x1b[K\r\n`;
    out += `${this.DIM}SESS: #${this.YELLOW}${this.sessionNum}${this.RESET} | ERR: ${this.RED}${this.errorCount}${this.RESET} | TIME: ${this.YELLOW}${this.timeLeft}s${this.RESET}\x1b[K\r\n\n`;
    out += `${this.DIM}${'-'.repeat(width)}${this.RESET}\x1b[K\r\n\n\n`;
    
    // Сборка многострочного блока исходного кода
    const lines = this.targetCode.split('\n');
    let currentPos = 0; 
    
    // Локальное включение автопереноса для адаптации длинного кода
    out += this.ENABLE_WRAP;

    lines.forEach((line) => {
      let lineOut = '';
      for (const char of line) {
        // Подсветка невидимых пробелов
        const displayChar = (char === ' ') ? '·' : char;
        
        if (currentPos < this.userInput.length) {
          lineOut += `${this.GREEN}${char}${this.RESET}`;
        } else if (currentPos === this.userInput.length) {
          if (this.blinkState && this.hasError) {
            // \x1b[4m -> Включить подчеркивание символа с ошибкой
            // \x1b[24m -> Выключить подчеркивание
            lineOut += `\x1b[4m${this.RED}${displayChar}${this.RESET}\x1b[24m`; 
          } else {
            lineOut += `${this.RESET}${displayChar}${this.RESET}`;
          }
        } else {
          lineOut += `${this.DIM}${displayChar}${this.RESET}`;
        }
        currentPos++;
      }
      out += lineOut + '\r\n';
      currentPos++; // Учет скрытого \n
    });

    out += this.DISABLE_WRAP;
    out += `\r\n${this.BLUE}${"-".repeat(width)}${this.RESET}\x1b[K\r\n`;

    if (!this.isFinished) {
      out += this.drawKeyboard(this.targetCode[this.userInput.length] || '');
    } else {
      out += this.drawStats();
    }

    // Возврат буфера в дефолтное состояние
    out += this.ENABLE_WRAP;
    return out;
  }

  // =========================================================================
  // === ВНУТРЕННИЕ ПОДПРОГРАММЫ ОТРИСОВКИ ===
  // =========================================================================

  /**
   * Генерирует ASCII-карту ретро-клавиатуры с индикацией активной зоны.
   */
  private drawKeyboard(target: string): string {
    const phys = this.getPhysicalKey(target);
    const isShiftNeeded = '~!@#$%^&*()_+{}|:"<>?ABCDEFGHIJKLMNOPQRSTUVWXYZ'.includes(target);
    const isLeftHandTarget = this.isLeftHand(target);
    const fIdx = this.getFingerIndex(phys);

    const config = vscode.workspace.getConfiguration('typetip');
    const brightness = config.get<number>('highlightBrightness', 252);
    
    // Динамический цвет кнопки: \x1b[48;5;{ID}m -> Цвет фона, \x1b[38;5;{ID}m -> Цвет текста
    const ACTIVE_STYLE = (config.get<string>('highlightType') === 'focus') 
      ? `\x1b[48;5;${brightness}m\x1b[38;5;240m` 
      : this.INVERT;

    const dim = this.DIM;
    const bright = this.BRIGHT_FINGER;

    // Вспомогательная функция отрисовки индикатора пальца над клавишами
    const f = (i: number) => {
      const isShiftFinger = (i === 0 && isShiftNeeded && !isLeftHandTarget) || 
                            (i === 7 && isShiftNeeded && isLeftHandTarget);
      return (fIdx === i || isShiftFinger) ? `${this.RESET}${bright}( )${this.RESET}${dim}` : `( )`;
    };

    // Вспомогательная функция отрисовки клавиши
    const k = (label: string, w = 3) => {
      const isTarget = (label === 'SHIFT') 
        ? (isShiftNeeded && (w === 7 ? !isLeftHandTarget : isLeftHandTarget))
        : (label === 'ENTER' ? target === '\n' : label.toLowerCase() === phys && target !== '\n' && target !== ' ');

      let char = label;
      if (label === 'f') char = 'f.'; 
      if (label === 'j') char = '.j';
      if (isTarget && label.length === 1) char = target;

      const inner = char.padStart(Math.ceil((w + char.length) / 2)).padEnd(w);
      return isTarget ? `${this.RESET}${ACTIVE_STYLE}${inner}${this.RESET}${dim}` : `${dim}${inner}${this.RESET}${dim}`;
    };

    let rawUi = '';
    rawUi += `       ${f(0)} ${f(1)} ${f(2)} ${f(3)}           ${f(4)} ${f(5)} ${f(6)} ${f(7)}\r\n`;
    rawUi += `┌───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬─────┐\r\n`;
    rawUi += `│${k('`')}│${['1','2','3','4','5','6','7','8','9','0','-','='].map(n => k(n)).join('│')}│${k('<==', 4)} │\r\n`;
    rawUi += `├───┴─┬─┴─┬─┴─┬─┴─┬─┴─┬─┴─┬─┴─┬─┴─┬─┴─┬─┴─┬─┴─┬─┴─┬─┴─┬───┤\r\n`;
    rawUi += `│ TAB │${['q','w','e','r','t','y','u','i','o','p','[',']','\\'].map(l => k(l)).join('│')}│\r\n`;
    rawUi += `├─────┴┬──┴┬──┴┬──┴┬──┴┬──┴┬──┴┬──┴┬──┴┬──┴┬──┴┬──┴┬──┴───┤\r\n`;
    rawUi += `│ CAPS │${['a','s','d','f','g','h','j','k','l',';','\''].map(l => k(l)).join('│')}│${k('ENTER', 6)}│\r\n`;
    rawUi += `├──────┴─┬─┴─┬─┴─┬─┴─┬─┴─┬─┴─┬─┴─┬─┴─┬─┴─┬─┴─┬─┴─┬─┴──────┤\r\n`;
    rawUi += `│${k('SHIFT', 7)} │${['z','x','c','v','b','n','m',',','.','/'].map(l => l.length === 1 ? k(l) : l).join('│')}│ ${k('SHIFT', 6)} │\r\n`;
    rawUi += `└────────┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴────────┘\r\n`;

    // Расчет нажатия пробела (выбор большого пальца для балансировки рук)
    const isSpace = (target === ' ');
    const lastWasLeft = this.isLeftHand(this.userInput.slice(-1)); 
    const spaceKey = isSpace ? `${this.RESET}${ACTIVE_STYLE}      SPACE      ${this.RESET}${dim}` : `      SPACE      `;
    rawUi += `            ${(isSpace && !lastWasLeft) ? bright + '( )' : '( )'}    ${spaceKey}    ${(isSpace && lastWasLeft) ? bright + '( )' : '( )'}${this.RESET}\r\n`;

    // Модуль динамического автоцентрирования клавиатуры
    const kbLines = rawUi.split('\r\n');
    const ansiRegex = /\x1b\[[0-9;]*[a-zA-Z]/g; 
    let maxVisibleWidth = 0;
    
    kbLines.forEach(line => {
      const cleanLine = line.replace(ansiRegex, ''); 
      if (cleanLine.length > maxVisibleWidth) {
        maxVisibleWidth = cleanLine.length;
      }
    });

    const paddingLength = Math.max(0, Math.floor((this.ctx.terminalWidth - maxVisibleWidth) / 2));
    const spaces = ' '.repeat(paddingLength);

    let finalUi = `\r\n\r\n`; 
    kbLines.forEach((line, index) => {
      if (index === kbLines.length - 1 && line.trim() === '') return;
      finalUi += `${spaces}${line}\x1b[K\r\n`; 
    });

    return finalUi;
  }

  /**
   * Генерирует экран финальной статистики.
   */
  private drawStats(): string {
    const cpm = this.currentCpm;
    const state = this.ctx.extensionContext.globalState;
    const totalSessions = state.get<number>('sessionNum', 0);
    const globalErrors = state.get<number>('totalErrors', 0);
    const totalCpmSum = state.get<number>('totalCpmSum', 0);
    const avgCpm = totalSessions > 0 ? Math.round(totalCpmSum / totalSessions) : cpm;

    let s = `\r\n    ${this.YELLOW}ТЕКУЩАЯ СЕССИЯ                 ОБЩАЯ СТАТИСТИКА${this.RESET}\r\n`;
    s += `    ------------------------------------------------------------\r\n`;
    s += `    Скорость:  ${this.GREEN}${cpm} CPM${this.RESET}            Рекорд:       ${this.YELLOW}${Math.max(cpm, this.bestCpm)} CPM${this.RESET}\r\n`;
    s += `    Ошибок:    ${this.RED}${this.errorCount}${this.RESET}                Всего ошибок: ${this.RED}${globalErrors}${this.RESET}\r\n`;
    s += `    Прогресс:  ${this.BLUE}${this.charLimit} симв.${this.RESET}          Ср. скорость: ${this.BLUE}${avgCpm} CPM${this.RESET}\r\n`;
    s += `    Сессия:    #${totalSessions}                Всего сессий: ${totalSessions}\r\n\n`;
    s += `    ${this.GREEN}Keep coding. Твой вайб — твои правила.${this.RESET}\r\n\n`;
    s += `    ${this.DIM}[~\`] - Перезапуск  [ESC/BACKSPACE] - Вернуться в Хаб${this.RESET}\r\n`;
    return s;
  }

  // =========================================================================
  // === ВНУТРЕННЯЯ БИЗНЕС-ЛОГИКА И ХЕЛПЕРЫ ===
  // =========================================================================

  private get currentCpm(): number {
    const secondsPassed = 120 - this.timeLeft; 
    if (secondsPassed <= 0) return 0;          
    return Math.round((this.userInput.length / secondsPassed) * 60); 
  }

  private get BRIGHT_FINGER(): string {
    const colorName = vscode.workspace.getConfiguration('typetip').get<string>('fingerColor', 'Yellow');
    return COLOR_MAP[colorName] || COLOR_MAP['Yellow'];
  }

  /**
   * Завершает раунд, начисляет эволюцию/деградацию сложности и сохраняет стейт.
   */
  private finish(): void {
    this.isFinished = true;
    this.stopTimer(); 

    const state = this.ctx.extensionContext.globalState;
    const oldLimit = state.get<number>('charLimit', 20);
    let newLimit = oldLimit;

    if (this.timeLeft > 0) {
      newLimit = Math.min(100, oldLimit + this.timeLeft);
      state.update('charLimit', newLimit);
      // Прямой вывод информационного сообщения о росте уровня через эмиттер
      this.ctx.writeEmitter.fire(`\r\n\x1b[32m[EVOLUTION] +${this.timeLeft} символов в следующей цели!\x1b[0m\r\n`);
    } else {
      newLimit = Math.max(10, oldLimit - 1);
      state.update('charLimit', newLimit);
      this.ctx.writeEmitter.fire(`\r\n\x1b[31m[DEGRADATION] Медленно. Лимит снижен.\x1b[0m\r\n`);
    }

    const totalErr = state.get<number>('totalErrors', 0);
    const totalCpmSum = state.get<number>('totalCpmSum', 0);
    const currentCpm = this.currentCpm;

    state.update('totalErrors', totalErr + this.errorCount);
    state.update('totalCpmSum', totalCpmSum + currentCpm);
    
    if (currentCpm > this.bestCpm) {
      state.update('bestCpm', currentCpm);
    }
    
    // Фиксируем инкремент текущей сессии
    state.update('sessionNum', this.sessionNum + 1);
  }

  private startTimer(): void {
    this.timer = setInterval(() => {
      if (this.timeLeft > 0) {
        this.timeLeft--; 
        this.router.refresh();   
      } else {
        this.finish();
        this.router.refresh();
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timer) { 
      clearInterval(this.timer); 
      this.timer = undefined; 
    }
  }

  private startErrorBlink(): void {
    if (this.blinkInterval) return; 
    this.blinkCounter = 0;
    this.blinkInterval = setInterval(() => {
      this.blinkState = !this.blinkState; 
      this.router.refresh(); 
      this.blinkCounter++;
      
      if (this.blinkCounter >= 6) {
        this.stopErrorBlink();
        this.router.refresh();
      }
    }, 200);
  }

  private stopErrorBlink(): void {
    if (this.blinkInterval) {
      clearInterval(this.blinkInterval);
      this.blinkInterval = undefined;
    }
    this.blinkState = false;
  }

  private getFingerIndex(key: string): number {
    const groups = [
      ['`','1','q','a','z'],                                              
      ['2','w','s','x'],                                                  
      ['3','e','d','c'],                                                  
      ['4','5','r','t','f','g','v','b'],                                  
      ['6','7','y','u','h','j','n','m'],                                  
      ['8','i','k',','],                                                  
      ['9','o','l','.'],                                                  
      ['0','-','=','p','[',']','\\',';','\'','/']                          
    ];
    return groups.findIndex(g => g.includes(key.toLowerCase()));
  }

  private isLeftHand(c: string): boolean {
    return '`~1!2@3#4$5%qQwWeErRtTaAsSdDfFgGzZxXcCvVbB'.includes(c);
  }

  private getPhysicalKey(c: string): string {
    const m: Record<string, string> = {
      '~':'`','!':'1','@':'2','#':'3','$':'4','%':'5','^':'6','&':'7','*':'8','(':'9',')':'0',
      '_':'-','+':'=','{':'[','}':']','|':'\\',':':';','"':'\'','<':',','>':'.','?':'/'
    };
    return m[c] || c.toLowerCase();
  }
}