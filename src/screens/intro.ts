/**
 * @fileoverview Адаптивный экран Интро Warp Vibe Engine (V8.2 - Matrix Edition).
 * Автоматический выбор логотипа под размер экрана, сквозной абсолютный блик,
 * честный выделяемый промпт и термодинамический блендинг логотипа с огнём.
 * © The 'Just Make It Work' Group Vibe Coding Enterprises Corporation //™
 */

import { IScreen, IScreenContext } from '../engine/interfaces';
import { AppRouter } from '../engine/router';
import { ANSI_ASSETS } from './assets/assets';

interface WarpStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  char: string;
  brightness: number;
  isTwinkling: boolean;
  twinklePhase: number;
}

export class IntroScreen implements IScreen {
  private ctx!: IScreenContext;
  private ticks = 0;
  private internalLoopTimer: any = null;
  private warpStars: WarpStar[] = [];
  
  private matrix: string[][] = [];
  private fireBuffer: number[][] = [];
  private logoMask: boolean[][] = [];

  constructor(private router: AppRouter) {}

  public init(ctx: IScreenContext): void {
    this.ctx = ctx;
    this.ticks = 0;
    this.warpStars = [];
    this.matrix = [];
    this.fireBuffer = [];

    if (this.internalLoopTimer) {
      clearInterval(this.internalLoopTimer);
    }

    const w = this.ctx.terminalWidth || 120;
    const h = this.ctx.terminalHeight || 30;
    
    this.initWarpField(w, h);
    this.initFireBuffer(w, h);
    this.generateCollisionMask(w, h);

    this.internalLoopTimer = setInterval(() => {
      this.ticks++;
      this.updateWarpPhysics();
      this.updateFireSimulation(w, h);
      
      if (this.ctx?.writeEmitter) {
        this.ctx.writeEmitter.fire(this.render());
      }
    }, 33);
  }

  // Динамический выбор ассета логотипа на основе ширины терминала (< 105 символов — компакт)
  private getActiveLogo(): string[] {
    const w = this.ctx.terminalWidth || 120;
    return w < 105 ? ANSI_ASSETS.DOT_TERMINATOR_COMPACT : ANSI_ASSETS.DOT_TERMINATOR_WIDE;
  }

  private initWarpField(w: number, h: number): void {
    const baseDensity = 0.014; 
    const starCount = Math.max(40, Math.min(240, Math.floor(w * h * baseDensity)));
    const shapes = ['·', '°', 'o'];
    
    this.warpStars = [];
    for (let i = 0; i < starCount; i++) {
      const isTwinkleTarget = (i % 12 === 0);
      const bright = 0.35 + Math.random() * 0.55;
      const direction = Math.random() > 0.5 ? 1 : -1;
      
      this.warpStars.push({
        x: Math.random() * w,
        y: 2 + Math.random() * (h - 4), 
        vx: (0.25 + Math.random() * 0.35) * direction,   
        vy: (Math.random() - 0.5) * 0.02,        
        char: shapes[Math.floor(Math.random() * shapes.length)],
        brightness: bright,
        isTwinkling: isTwinkleTarget,
        twinklePhase: Math.random() * Math.PI * 2
      });
    }
  }

  private initFireBuffer(w: number, h: number): void {
    this.fireBuffer = Array.from({ length: h + 3 }, () => Array(w).fill(0));
  }

  private generateCollisionMask(w: number, h: number): void {
    this.logoMask = Array.from({ length: h }, () => Array(w).fill(false));
    
    const activeLogo = this.getActiveLogo();
    const termWidth = activeLogo[0].length;
    const termPadding = Math.max(0, Math.floor((w - termWidth) / 2));
    const paddingTop = Math.max(2, Math.floor((h - 15) / 2)) + 1;

    activeLogo.forEach((line, idx) => {
      const targetY = paddingTop + idx;
      if (targetY < h) {
        for (let x = 0; x < line.length; x++) {
          if (line[x] !== ' ' && (termPadding + x) < w) {
            this.logoMask[targetY][termPadding + x] = true;
          }
        }
      }
    });
  }

  private updateWarpPhysics(): void {
    const w = this.ctx.terminalWidth || 120;
    const h = this.ctx.terminalHeight || 30;
    
    this.warpStars.forEach(star => {
      if (star.isTwinkling) {
        star.twinklePhase += 0.05;
        star.brightness = 0.3 + (Math.sin(star.twinklePhase) * 0.55);
      }

      star.x += star.vx;
      star.y += star.vy;

      const ix = Math.floor(star.x);
      const iy = Math.floor(star.y);

      if (iy >= 1 && iy < h && ix >= 0 && ix < w && star.brightness > 0.6) {
        if (this.logoMask[iy]?.[ix]) {
          star.vx = -star.vx;
          star.x += star.vx;
        }
      }

      if (star.x > w + 1 || star.x < -2 || star.y > h - 1 || star.y < 1) {
        star.x = star.vx > 0 ? 0 : w - 1;
        star.y = 2 + Math.random() * (h - 4);
      }
    });
  }

  private updateFireSimulation(w: number, h: number): void {
    if (this.fireBuffer.length === 0 || this.fireBuffer[0]?.length !== w) {
      this.initFireBuffer(w, h);
    }

    const paddingTop = Math.max(2, Math.floor((h - 15) / 2)) + 1;
    const fireBaseY = paddingTop + 4; 
    if (fireBaseY >= h || !this.fireBuffer[fireBaseY]) return;

    const heightScale = Math.min(2.2, Math.max(1.0, h / 28)); 
    const baseCooling = Math.max(3.9, 4.35 - (heightScale * 0.12));

    for (let x = 0; x < w; x++) {
      if (Math.random() > 0.55) {
        this.fireBuffer[fireBaseY][x] = Math.floor(135 + Math.random() * 115);
      } else {
        this.fireBuffer[fireBaseY][x] = 0;
      }
    }

    for (let y = 1; y < fireBaseY; y++) {
      if (y + 2 >= this.fireBuffer.length || !this.fireBuffer[y + 1]) continue;
      
      // Полное превентивное гашение дыма на верхних строках ради чистоты промпта
      if (y < 4) {
        for (let x = 0; x < w; x++) this.fireBuffer[y][x] = 0;
        continue;
      }

      let topDamping = 1.0;
      if (y < 7) {
        topDamping = 1.2 + (7 - y) * 0.4; 
      }

      for (let x = 1; x < w - 1; x++) {
        const h1 = this.fireBuffer[y + 1][x - 1] || 0;
        const h2 = this.fireBuffer[y + 1][x] || 0;
        const h3 = this.fireBuffer[y + 1][x + 1] || 0;
        const h4 = this.fireBuffer[y + 2][x] || 0;

        let avg = (h1 + h2 + h3 + h4) / (baseCooling * topDamping);
        this.fireBuffer[y][x] = avg > 2.2 ? avg : 0;
      }
    }
  }

  public resize(width: number, height: number): void {
    this.ctx.terminalWidth = width;
    this.ctx.terminalHeight = height;
    this.matrix = [];
    this.initWarpField(width, height);
    this.initFireBuffer(width, height);
    this.generateCollisionMask(width, height);
  }

  public dispose(): void {
    if (this.internalLoopTimer) {
      clearInterval(this.internalLoopTimer);
      this.internalLoopTimer = null;
    }
  }

  public handleInput(data: string): void {
    this.dispose(); // Безопасно тушим приватный буфер графики
    this.router.navigateTo('KEYBOARD');
  }

  private getTrueColor(r: number, g: number, b: number): string {
    return `\x1b[38;2;${Math.floor(r)};${Math.floor(g)};${Math.floor(b)}m`;
  }

  public render(): string {
    const w = this.ctx.terminalWidth || 120;
    const h = this.ctx.terminalHeight || 30;

    const RESET = '\x1b[0m';
    const BOLD = '\x1b[1m';
    const GREEN = '\x1b[32m'; 
    const WHITE = '\x1b[37m'; 
    const BRIGHT_WHITE = '\x1b[97m';
    const RED_BOLD = '\x1b[1;31m'; 
    const BRIGHT_CYAN = '\x1b[96m';

    if (this.matrix.length !== h || this.matrix[0]?.length !== w) {
      this.matrix = Array.from({ length: h }, () => Array(w).fill(' '));
    } else {
      for (let y = 0; y < h; y++) this.matrix[y].fill(' ');
    }

    // 1. СЛОЙ ЗВЁЗДНОГО НЕБА
    this.warpStars.forEach(star => {
      const sx = Math.floor(star.x);
      const sy = Math.floor(star.y);
      if (sx >= 0 && sx < w && sy >= 1 && sy < h) {
        const grayVal = Math.floor(Math.max(40, Math.min(255, star.brightness * 255)));
        this.matrix[sy][sx] = this.getTrueColor(grayVal, grayVal, grayVal) + star.char + RESET;
      }
    });

    // 2. СЛОЙ ТЕРМОДИНАМИЧЕСКОГО ОГНЯ
    if (this.fireBuffer.length > 0) {
      for (let y = 1; y < h; y++) { 
        if (y >= this.fireBuffer.length) break;
        for (let x = 0; x < w; x++) {
          const heat = this.fireBuffer[y][x];
          if (heat > 165) {
            this.matrix[y][x] = this.getTrueColor(245, Math.min(240, heat * 1.02), 40) + '▓' + RESET;
          } else if (heat > 98) {
            this.matrix[y][x] = this.getTrueColor(heat + 80, 45, 10) + '▒' + RESET;
          } else if (heat > 38) {
            this.matrix[y][x] = this.getTrueColor(heat + 25, 5, 0) + '░' + RESET;
          }
        }
      }
    }

    const paddingTop = Math.max(2, Math.floor((h - 15) / 2)) + 1;
    const termLogoYStart = paddingTop;
    const termLogoYEnd = paddingTop + 5;

    const geminiY = termLogoYEnd + 1; 
    const signatureY = geminiY + 1;
    const pressKeyY = h - 6; 

    // ЕДИНАЯ ось времени блика по координате X
    const waveSize = 14;
    const currentGlobalX = (this.ticks * 0.75) % (w + waveSize * 2) - waveSize;

    // 3. ОТРИСОВКА ДИНАМИЧЕСКИ ВЫБРАННОГО ЛОГОТИПА
    const activeLogo = this.getActiveLogo();
    const termWidth = activeLogo[0].length;
    const termPadding = Math.max(0, Math.floor((w - termWidth) / 2));
    
    activeLogo.forEach((line, idx) => {
      const targetY = termLogoYStart + idx;
      if (targetY > 0 && targetY < h) {
        for (let x = 0; x < line.length; x++) {
          const matrixX = termPadding + x;
          if (line[x] !== ' ' && matrixX < w) {
            const underlyingHeat = this.fireBuffer[targetY]?.[matrixX] || 0;
            
            if (underlyingHeat > 80) {
              // Раскаление символов от огня (эффект пламени внутри букв)
              this.matrix[targetY][matrixX] = this.getTrueColor(255, 210 + underlyingHeat * 0.15, 140) + line[x] + RESET;
            } else {
              // Автономный плазменный цикл переливов
              const plasmaR = Math.floor(Math.sin((x + this.ticks) * 0.1) * 20 + 40);
              const plasmaG = Math.floor(Math.sin((x - this.ticks) * 0.12) * 25 + 110);
              const plasmaB = Math.floor(Math.sin((this.ticks) * 0.07) * 30 + 220);
              this.matrix[targetY][matrixX] = this.getTrueColor(plasmaR, plasmaG, plasmaB) + line[x] + RESET;
            }
          }
        }
      }
    });

    // 4. СИНХРОНИЗИРОВАННЫЕ СКВОЗНЫЕ БЛИКИ НА ПОДПИСЯХ
    const geminiTxt = ANSI_ASSETS.GEMINI_PUNCH;
    const signatureTxt = ANSI_ASSETS.SIGNATURE;
    const pressKeyTxt = ANSI_ASSETS.PRESS_ANY_KEY;
    
    const textPaddingLeft = Math.max(0, Math.floor((w - geminiTxt.length) / 2));
    const pressKeyX = w - pressKeyTxt.length - 2;

    if (geminiY < h && geminiY > 0) {
      for (let i = 0; i < geminiTxt.length; i++) {
        const targetX = textPaddingLeft + i;
        if (targetX < w) {
          if (targetX >= currentGlobalX && targetX < currentGlobalX + waveSize) {
            this.matrix[geminiY][targetX] = BOLD + BRIGHT_WHITE + geminiTxt[i] + RESET;
          } else {
            this.matrix[geminiY][targetX] = GREEN + geminiTxt[i] + RESET;
          }
        }
      }
    }

    if (signatureY < h && signatureY > 0) {
      for (let i = 0; i < signatureTxt.length; i++) {
        const targetX = textPaddingLeft + i;
        if (targetX < w) {
          if (targetX >= currentGlobalX && targetX < currentGlobalX + waveSize) {
            this.matrix[signatureY][targetX] = BOLD + BRIGHT_WHITE + signatureTxt[i] + RESET;
          } else {
            this.matrix[signatureY][targetX] = WHITE + signatureTxt[i] + RESET;
          }
        }
      }
    }

    if (pressKeyY > 0 && pressKeyY < h && pressKeyX >= 0) {
      for (let i = 0; i < pressKeyTxt.length; i++) {
        const targetX = pressKeyX + i;
        if (targetX < w) {
          if (targetX >= currentGlobalX && targetX < currentGlobalX + waveSize) {
            this.matrix[pressKeyY][targetX] = BOLD + BRIGHT_WHITE + pressKeyTxt[i] + RESET;
          } else {
            this.matrix[pressKeyY][targetX] = RED_BOLD + pressKeyTxt[i] + RESET;
          }
        }
      }
    }

    // 5. НИЖНЯЯ ТЕЛЕМЕТРИЯ ШИНЫ СИСТЕМЫ
    const busY = h - 2; 
    const sysLoad = (Math.sin(this.ticks * 0.05) * 1.1 + 14.1).toFixed(1); 
    const telemetryString = `[ V8.2 BUS: ACTIVE ]   CORE.LOAD: ${sysLoad}%`;
    
    if (busY < h && busY > 0) {
      for (let i = 0; i < telemetryString.length; i++) {
        if (i + 2 < w) {
          this.matrix[busY][i + 2] = BRIGHT_CYAN + telemetryString[i] + RESET;
        }
      }
    }

    // 6. ИЗОЛЯЦИЯ И СБОРКА СТРОК (Защита выделения промпта от глитчей)
    const linesBuffer: string[] = [];

    // Строка 0 — чистый системный промпт, чтобы буквы никуда не уплывали и честно выделялись мышкой
    const promptPlain = "root@typetip:/home# useradd -m typetip";
    const padSpaces = ' '.repeat(Math.max(0, w - promptPlain.length));
    linesBuffer.push(`\x1b[0;37mroot@typetip:/home# \x1b[0;37museradd -m typetip${RESET}` + padSpaces);

    // Подтягиваем остальные обработанные строки матрицы
    for (let y = 1; y < h; y++) {
      linesBuffer.push(this.matrix[y].join(''));
    }

    // Сборка кадра. Запрещаем автоперенос строки (?7l) и сбрасываем курсор в левый верхний угол (H)
    let result = `\x1b[?7l\x1b[H\x1b[?25h` + linesBuffer.join('\r\n');

    // Возвращаем курсор в конец промпта, чтобы он аутентично мигал там
    result += `\x1b[1;38H`;

    return result;
  }
}