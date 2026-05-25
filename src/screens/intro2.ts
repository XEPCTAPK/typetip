/**
 * @fileoverview Адаптивный экран Интро Warp Vibe Engine (V8.2 - Matrix Edition).
 * Автоматический выбор логотипа под размер экрана, сквозной абсолютный блик,
 * честный выделяемый промпт и термодинамический блендинг логотипа с огнём.
 * © The 'Just Make It Work' Group Vibe Coding Enterprises Corporation //™
 */

import { IScreen, IScreenContext } from '../engine/interfaces';
import { AppRouter } from '../engine/router';
import { ANSI_ASSETS } from './assets/assets4';

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
    this.logoMask = [];

    const w = this.ctx.terminalWidth;
    const h = this.ctx.terminalHeight;

    // Инициализация пула частиц (Warp Stars)
    const maxStars = Math.floor((w * h) * 0.04);
    const starChars = ['.', '*', '°', '•', 'o', 'O'];
    for (let i = 0; i < maxStars; i++) {
      this.warpStars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.15,
        char: starChars[Math.floor(Math.random() * starChars.length)],
        brightness: Math.floor(Math.random() * 3),
        isTwinkling: Math.random() > 0.7,
        twinklePhase: Math.random() * Math.PI * 2
      });
    }

    if (this.internalLoopTimer) {
      clearInterval(this.internalLoopTimer);
    }

    // Полноценный реактивный игровой цикл рендеринга (60 FPS / 16ms тики)
    this.internalLoopTimer = setInterval(() => {
      this.ticks++;
      this.updatePhysics();
      this.router.refresh();
    }, 16);
  }

  public resize(width: number, height: number): void {
    this.ctx.terminalWidth = width;
    this.ctx.terminalHeight = height;
    this.matrix = [];
    this.fireBuffer = [];
    this.logoMask = [];
  }

  private updatePhysics(): void {
    const w = this.ctx.terminalWidth;
    const h = this.ctx.terminalHeight;

    this.warpStars.forEach(star => {
      star.x += star.vx;
      star.y += star.vy;
      if (star.isTwinkling) {
        star.twinklePhase += 0.1;
      }
      if (star.x < 0 || star.x >= w || star.y < 0 || star.y >= h) {
        star.x = Math.random() * w;
        star.y = Math.random() * h;
      }
    });
  }

  public render(): string {
    const w = this.ctx.terminalWidth;
    const h = this.ctx.terminalHeight;

    if (w < 10 || h < 5) return '\x1b[H\x1b[2JSafe Mode: Window Too Small';

    // 1. Инициализация двумерного кадрового растра
    if (this.matrix.length !== h || this.matrix[0]?.length !== w) {
      this.matrix = Array.from({ length: h }, () => Array(w).fill(' '));
    }

    const RESET = '\x1b[0m';
    const DIM = '\x1b[2m';
    const RED_BOLD = '\x1b[1;31m';
    const BRIGHT_CYAN = '\x1b[1;96m';

    // Очистка матрицы
    for (let y = 0; y < h; y++) {
      this.matrix[y].fill(' ');
    }

    // 2. Слой 0: Отрисовка звездного неба
    const starColors = ['\x1b[2;37m', '\x1b[0;37m', '\x1b[1;255m'];
    this.warpStars.forEach(star => {
      const ix = Math.floor(star.x);
      const iy = Math.floor(star.y);
      if (ix >= 0 && ix < w && iy >= 0 && iy < h) {
        let b = star.brightness;
        if (star.isTwinkling) {
          const mod = Math.sin(star.twinklePhase) * 1.5 + 1.5;
          b = Math.min(2, Math.max(0, Math.floor(b + mod - 1)));
        }
        this.matrix[iy][ix] = starColors[b] + star.char + RESET;
      }
    });

    // 3. Слой 1: Термодинамический огонь
    if (this.fireBuffer.length !== h + 2 || this.fireBuffer[0]?.length !== w) {
      this.fireBuffer = Array.from({ length: h + 2 }, () => Array(w).fill(0));
    }
    const fireLineY = Math.min(h - 1, 14);
    if (fireLineY > 0) {
      for (let x = 0; x < w; x++) {
        this.fireBuffer[fireLineY + 1][x] = Math.random() > 0.45 ? 36 : 0;
      }
      for (let y = 2; y <= fireLineY + 1; y++) {
        for (let x = 0; x < w; x++) {
          const d1 = this.fireBuffer[y][(x - 1 + w) % w];
          const d2 = this.fireBuffer[y][x];
          const d3 = this.fireBuffer[y][(x + 1) % w];
          const d4 = this.fireBuffer[y + 1][x];
          const avg = Math.floor((d1 + d2 + d3 + d4) / 4.02);
          this.fireBuffer[y - 1][x] = avg > 0 ? avg : 0;
        }
      }
      const firePalette = [
        ' ', '.', '•', ':', 'o', 'x', '█', '█', '█'
      ];
      const fireColors = [
        '\x1b[2;30m', '\x1b[2;31m', '\x1b[0;31m', '\x1b[1;31m',
        '\x1b[38;5;202m', '\x1b[38;5;208m', '\x1b[38;5;214m', '\x1b[1;33m', '\x1b[1;226m'
      ];
      for (let y = 0; y < fireLineY; y++) {
        for (let x = 0; x < w; x++) {
          const raw = this.fireBuffer[y][x];
          if (raw > 1) {
            const pIdx = Math.min(firePalette.length - 1, Math.floor(raw / 4.5));
            const cIdx = Math.min(fireColors.length - 1, Math.floor(raw / 4.0));
            if (pIdx > 0) {
              this.matrix[y][x] = fireColors[cIdx] + firePalette[pIdx] + RESET;
            }
          }
        }
      }
    }

    // 4. Слой 2: Выбор и наложение адаптивного логотипа
    const logoLines = w >= 95 ? ANSI_ASSETS.DOT_TERMINATOR_WIDE : ANSI_ASSETS.DOT_TERMINATOR_COMPACT;
    const logoW = logoLines[0].length;
    const logoH = logoLines.length;
    const startX = Math.max(0, Math.floor((w - logoW) / 2));
    const startY = Math.max(1, Math.floor((h - 10) / 3));

    if (this.logoMask.length !== logoH || this.logoMask[0]?.length !== logoW) {
      this.logoMask = Array.from({ length: logoH }, (_, y) =>
        Array.from({ length: logoW }, (_, x) => logoLines[y][x] !== ' ')
      );
    }

    const scanX = (this.ticks * 2) % (logoW + w);
    for (let ly = 0; ly < logoH; ly++) {
      const targetY = startY + ly;
      if (targetY >= h) break;
      for (let lx = 0; lx < logoW; lx++) {
        const targetX = startX + lx;
        if (targetX >= w) break;
        if (this.logoMask[ly][lx]) {
          const dist = Math.abs(targetX - scanX);
          if (dist < 5) {
            this.matrix[targetY][targetX] = '\x1b[1;255m█' + RESET;
          } else if (targetX < scanX) {
            this.matrix[targetY][targetX] = '\x1b[38;5;45m█' + RESET;
          } else {
            this.matrix[targetY][targetX] = '\x1b[38;5;27m█' + RESET;
          }
        }
      }
    }

    // Сквозное наложение интерактивной строки ENTER
    const pressKeyTxt = "► НАЖМИ ENTER ДЛЯ СТАРТА ◄";
    const pressKeyX = Math.max(0, Math.floor((w - pressKeyTxt.length) / 2));
    const pressKeyY = startY + logoH + 2;

    if (pressKeyY < h) {
      const isLit = Math.floor(this.ticks / 25) % 2 === 0;
      for (let i = 0; i < pressKeyTxt.length; i++) {
        const targetX = pressKeyX + i;
        if (targetX < w) {
          if (isLit) {
            this.matrix[pressKeyY][targetX] = '\x1b[1;92m' + pressKeyTxt[i] + RESET;
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

    // 6. ИЗОЛЯЦИЯ И СБОРКА СТРОК
    const linesBuffer: string[] = [];
    const promptPlain = "root@typetip:/home# useradd -m typetip";
    const padSpaces = ' '.repeat(Math.max(0, w - promptPlain.length));
    linesBuffer.push('\x1b[0m' + DIM + promptPlain + padSpaces + RESET);

    for (let y = 1; y < h; y++) {
      linesBuffer.push(this.matrix[y].join(''));
    }

    return linesBuffer.join('\r\n');
  }

  public handleInput(data: string): void {
    if (data === 'UI_ENTER' || data === '\r') {
      this.dispose();
      this.router.navigateTo('HUB');
    }
  }

  public dispose(): void {
    if (this.internalLoopTimer) {
      clearInterval(this.internalLoopTimer);
      this.internalLoopTimer = null;
    }
  }
}