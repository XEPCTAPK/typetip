/**
 * @fileoverview Игровой модуль падающих символов (Rain Mode) экосистемы TypeTip.
 * Реализует динамический игровой цикл уничтожения падающих кодинг-багов.
 * * © The 'Just Make It Work' Group Vibe Coding Enterprises Corporation; xepctapk (ц) //™
 */

import { IScreen, IScreenContext } from '../engine/interfaces';
import { AppRouter } from '../engine/router';

interface FallingBug {
  char: string;
  x: number;
  y: number;
}

export class RainGame implements IScreen {
  private ctx!: IScreenContext;
  private bugs: FallingBug[] = [];
  private gameInterval: NodeJS.Timeout | undefined;
  private score = 0;
  private pool = 'abcdefghijklmnopqrstuvwxyz(){}[];+=<>';

  private readonly RESET = '\x1b[0m';
  private readonly DIM = '\x1b[2m';
  private readonly BOLD = '\x1b[1m';
  private readonly MAGENTA = '\x1b[1;95m';
  private readonly RED = '\x1b[31m';
  private readonly GREEN = '\x1b[1;92m';

  constructor(private router: AppRouter) {}

  public init(ctx: IScreenContext): void {
    this.ctx = ctx;
    this.bugs = [];
    this.score = 0;

    // Генерируем первый баг на старте
    this.spawnBug();

    // Запускаем асинхронный игровой цикл падения (каждые 600мс шаг вниз)
    if (this.gameInterval) {
      clearInterval(this.gameInterval);
    }
    this.gameInterval = setInterval(() => {
      this.tickGame();
    }, 600);
  }

  public resize(width: number, height: number): void {
    this.ctx.terminalWidth = width;
    this.ctx.terminalHeight = height;
  }

  public dispose(): void {
    if (this.gameInterval) {
      clearInterval(this.gameInterval);
      this.gameInterval = undefined;
    }
  }

  private tickGame(): void {
    const h = this.ctx.terminalHeight;
    
    // Сдвиг всех багов на одну строчку вниз
    this.bugs.forEach(bug => bug.y++);
    
    // Отсекаем баги, улетевшие за нижний барьер игрового растра
    this.bugs = this.bugs.filter(bug => bug.y < h - 2);

    // Вероятностный спавн багов на верхней линии шторма
    if (Math.random() > 0.4) {
      this.spawnBug();
    }

    this.router.refresh();
  }

  private spawnBug(): void {
    const randomChar = this.pool[Math.floor(Math.random() * this.pool.length)];
    // Распределяем по ширине экрана с безопасными отступами по краям
    const randomX = Math.floor(Math.random() * (this.ctx.terminalWidth - 10)) + 5;
    this.bugs.push({ char: randomChar, x: randomX, y: 4 });
  }

  public render(): string {
    const w = this.ctx.terminalWidth;
    const h = this.ctx.terminalHeight;
    
    // Чистим экран
    let out = `\x1b[?7l\x1b[2J\x1b[3J\x1b[H`;

    // Рендерим фиксированную панель счета
    out += ' '.repeat(Math.max(0, Math.floor((w - 50) / 2))) + `${this.MAGENTA}${this.BOLD}👾 SYMBOL FALL // RAIN BUG KILLER 👾${this.RESET}\r\n`;
    out += `    Уничтожено багов (Score): ${this.GREEN}${this.score}${this.RESET}\r\n`;
    out += `${this.DIM}${'-'.repeat(w)}${this.RESET}\r\n`;

    // Создаем виртуальную двумерную матрицу строк для отрисовки падающих символов
    const maxGameHeight = Math.min(h - 2, 22);
    const screenLines = Array(maxGameHeight).fill('').map(() => ' '.repeat(w));

    // Накладываем баги на матрицу
    this.bugs.forEach(bug => {
      if (bug.y >= 4 && (bug.y - 4) < maxGameHeight && bug.x < w) {
        const targetLine = bug.y - 4;
        const line = screenLines[targetLine];
        screenLines[targetLine] = line.substring(0, bug.x) + this.RED + bug.char + this.RESET + line.substring(bug.x + 1);
      }
    });

    out += screenLines.join('\r\n') + '\r\n';
    return out;
  }

  public handleInput(data: string): void {
    if (data.startsWith('UI_')) return;

    const oldLength = this.bugs.length;
    // Уничтожаем баг с экрана, если символ совпал с вводом пользователя
    this.bugs = this.bugs.filter(bug => bug.char !== data);
    
    if (this.bugs.length < oldLength) {
      this.score += (oldLength - this.bugs.length);
      this.router.refresh();
    }
  }
}