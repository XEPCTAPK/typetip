/**
 * @fileoverview Игровой модуль классического тренажера слепой печати (Keyboard Mode).
 * Отрисовывает 5-рядную ретро-клавиатуру, рассчитывает CPM, управляет индикацией ошибок
 * и полностью подчиняется жизненному циклу IScreen под управлением AppRouter.
 * * © The 'Just Make It Work' Group Vibe Coding Enterprises Corporation; xepctapk (ц) //™
 */

import * as vscode from 'vscode';
import { IScreen, IScreenContext } from '../engine/interfaces';
import { AppRouter } from '../engine/router';
import { SpeedMeter } from '../engine/services';

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

export class TypeTipKeyboard implements IScreen {
  private ctx!: IScreenContext;
  private targetText = '';
  private typedText = '';
  private errorCount = 0;
  
  // Подключаем наш автономный сервис замера скорости
  private speedMeter = new SpeedMeter();

  private blinkInterval: NodeJS.Timeout | undefined;
  private blinkState = false;

  constructor(private router: AppRouter) {}

  public init(ctx: IScreenContext): void {
    this.ctx = ctx;
    this.typedText = '';
    this.errorCount = 0;
    this.stopErrorBlink();
    
    // Запуск счетчика
    this.speedMeter.start();

    const pool = 'abcdefghijklmnopqrstuvwxyz ';
    this.targetText = this.generateExerciseText(pool, 45);
  }

  public render(): string {
    const w = this.ctx.terminalWidth;
    let s = this.blinkState 
      ? '\x1b[?7l\x1b[41m\x1b[2J\x1b[H' 
      : '\x1b[?7l\x1b[2J\x1b[3J\x1b[H';

    const RESET = '\x1b[0m';
    const BOLD = '\x1b[1m';
    const DIM = '\x1b[2m';

    // Шапка
    s += ' '.repeat(Math.max(0, Math.floor((w - 50) / 2))) + `${BOLD}\x1b[1;36m⌨️  CLASSIC KEYBOARD CORE ZONE ⌨️${RESET}\r\n`;
    s += ' '.repeat(Math.max(0, Math.floor((w - 50) / 2))) + `${DIM}${'-'.repeat(50)}${RESET}\r\n\r\n`;

    // Метрики
    const cpm = this.speedMeter.getCPM();
    const accuracy = this.speedMeter.getAccuracy();
    s += `    Скорость: \x1b[1;96m${cpm} CPM${RESET} | Точность: ${accuracy}% | Ошибки: \x1b[31m${this.errorCount}${RESET}\r\n\r\n`;

    // Строка набора
    let lineOut = '    ';
    for (let i = 0; i < this.targetText.length; i++) {
      if (i < this.typedText.length) {
        lineOut += `\x1b[32m${this.targetText[i]}${RESET}`;
      } else if (i === this.typedText.length) {
        lineOut += `\x1b[4m${BOLD}${this.targetText[i]}${RESET}\x1b[24m`;
      } else {
        lineOut += `${DIM}${this.targetText[i]}${RESET}`;
      }
    }
    s += lineOut + '\r\n\r\n';

    // Подсветка клавиш
    const nextChar = this.targetText[this.typedText.length] || '';
    const physicalKey = this.getPhysicalKey(nextChar);

    const getLayoutColor = (keyStr: string): string => {
      const idx = this.getFingerIndex(keyStr);
      if (idx === -1) return RESET;

      let color = RESET;
      if (idx === 0 || idx === 7) color = COLOR_MAP['Yellow'];
      else if (idx === 1 || idx === 6) color = COLOR_MAP['Cyan'];
      else if (idx === 2 || idx === 5) color = COLOR_MAP['Magenta'];
      else if (idx === 3 || idx === 4) color = COLOR_MAP['Green'];

      if (keyStr.toLowerCase() === physicalKey.toLowerCase()) {
        return '\x1b[7m' + color; // Инвертируем активную клавишу
      }
      return color;
    };

    // Оригинальные ряды клавиатуры
    const r0 = ['~`','1!','2@','3#','4$','5%','6^','7&','8*','9(','0)','-_','=+',' BACKSPACE '];
    const r1 = [' TAB ','Q','W','E','R','T','Y','U','I','O','P','[{',']}','\\\\|'];
    const r2 = [' CAPS ','A','S','D','F','G','H','J','K','L',';:','\'"','  ENTER  '];
    const r3 = ['  SHIFT  ','Z','X','C','V','B','N','M',',<','.>','/?','  SHIFT  '];

    let k = '';
    k += '    ';
    r0.forEach(v => { k += `${getLayoutColor(v.charAt(0))}[${v}]${RESET} `; });
    k += '\r\n';

    k += '    ';
    r1.forEach(v => {
      const clean = v.trim().charAt(0);
      k += `${getLayoutColor(clean)}[${v}]${RESET} `;
    });
    k += '\r\n';

    k += '    ';
    r2.forEach(v => {
      const clean = v.trim().charAt(0);
      k += `${getLayoutColor(clean)}[${v}]${RESET} `;
    });
    k += '\r\n';

    k += '    ';
    r3.forEach(v => {
      const clean = v.trim().charAt(0);
      k += `${getLayoutColor(clean)}[${v}]${RESET} `;
    });
    k += '\r\n';

    k += '    ';
    const spaceColor = (nextChar === ' ') ? '\x1b[7m' + COLOR_MAP['White'] : COLOR_MAP['White'];
    k += `${spaceColor}[                 SPACEBAR                 ]${RESET}\r\n`;

    s += k;
    s += `\r\n${DIM}${this.center('Нажмите [ESC] или [BACKSPACE] для выхода в меню', w)}${RESET}\r\n`;

    return s;
  }

  public handleInput(data: string): void {
    if (data.startsWith('UI_')) return;

    if (this.typedText.length >= this.targetText.length) {
      this.init(this.ctx);
      this.router.refresh();
      return;
    }

    const expected = this.targetText[this.typedText.length];

    if (data === expected) {
      this.typedText += data;
      this.speedMeter.registerSuccess();
      
      if (this.typedText.length >= this.targetText.length) {
        setTimeout(() => {
          this.init(this.ctx);
          this.router.refresh();
        }, 600);
      }
      this.router.refresh();
    } else {
      this.errorCount++;
      this.speedMeter.registerError();
      this.startErrorBlink();
    }
  }

  public resize(width: number, height: number): void {
    this.ctx.terminalWidth = width;
    this.ctx.terminalHeight = height;
    this.router.refresh();
  }

  public dispose(): void {
    this.stopErrorBlink();
  }

  // --- ТВОЯ ОРИГИНАЛЬНАЯ ВСПОМОГАТЕЛЬНАЯ ЛОГИКА БЕЗ ИЗМЕНЕНИЙ ---
  private getFingerIndex(key: string): number {
    const groups = [
      ['`','1','q','a','z'],                                              
      ['2','w','s','x'],                                                  
      ['3','e','d','c'],                                                  
      ['4','5','r','t','f','g','v','b'],                                  
      ['6','7','y','u','h','j','n','m'],                                  
      ['8','i','k',','],                                                  
      ['9','o','l','.'],                                                  
      ['0','-','=','p','[',']','\\\\',';','\'','/']                          
    ];
    return groups.findIndex(g => g.includes(key.toLowerCase()));
  }

  private isLeftHand(c: string): boolean {
    return '`~1!2@3#4$5%qQwWeErRtTaAsSdDfFgGzZxXcCvVbB'.includes(c);
  }

  private getPhysicalKey(c: string): string {
    const m: Record<string, string> = {
      ' ': ' ',
      'а':'a', 'б':'b', 'в':'v', 'г':'g', 'д':'d', 'е':'e', 'ё':'`', 'ж':';', 'з':'z', 'и':'i',
      'й':'q', 'к':'k', 'л':'l', 'м':'m', 'н':'n', 'о':'o', 'п':'p', 'р':'r', 'с':'s', 'т':'t',
      'у':'u', 'ф':'f', 'х':'[', 'ц':'c', 'ч':'x', 'ш':'s', 'щ':'c', 'ъ':']', 'ы':'y', 'ь':'m',
      'э':'\'', 'ю':'.', 'я':'z'
    };
    return m[c] || c;
  }

  private generateExerciseText(pool: string, length: number): string {
    let result = '';
    const cleanPool = pool.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
    for (let i = 0; i < length; i++) {
      result += cleanPool[Math.floor(Math.random() * cleanPool.length)];
    }
    return result;
  }

  private startErrorBlink(): void {
    this.stopErrorBlink();
    let ticks = 0;
    this.blinkInterval = setInterval(() => {
      this.blinkState = !this.blinkState;
      this.router.refresh();
      ticks++;
      if (ticks >= 6) {
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

  private center(text: string, width: number): string {
    const clean = text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
    const pad = Math.max(0, Math.floor((width - clean.length) / 2));
    return ' '.repeat(pad) + text;
  }
}