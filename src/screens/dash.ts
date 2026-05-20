/**
 * @fileoverview Игровой модуль скоростного спринта (Dash Mode) экосистемы TypeTip.
 * Фокусируется на тренировке взрывной скорости набора коротких синтаксических конструкций.
 * * © The 'Just Make It Work' Group Vibe Coding Enterprises Corporation; xepctapk (ц) //™
 */

import { IScreen, IScreenContext } from '../engine/interfaces';
import { AppRouter } from '../engine/router';

export class DashGame implements IScreen {
  private ctx!: IScreenContext;
  private targetPhrase = 'export async function vibeCoding() { return "just make it work"; }';
  private userInput = '';
  private startTime = 0;
  private cpm = 0;

  private readonly RESET = '\x1b[0m';
  private readonly DIM = '\x1b[2m';
  private readonly BOLD = '\x1b[1m';
  private readonly GREEN = '\x1b[1;92m';
  private readonly CYAN = '\x1b[1;96m';
  private readonly RED = '\x1b[31m';

  constructor(private router: AppRouter) {}

  public init(ctx: IScreenContext): void {
    this.ctx = ctx;
    this.userInput = '';
    this.startTime = Date.now();
    this.cpm = 0;
  }

  public resize(width: number, height: number): void {
    this.ctx.terminalWidth = width;
    this.ctx.terminalHeight = height;
  }

  public dispose(): void {
    // В текущей сборке долгоживущие хендлы отсутствуют
  }

  public render(): string {
    const w = this.ctx.terminalWidth;
    let out = `\x1b[?7l\x1b[2J\x1b[3J\x1b[H`;

    // Шапка режима
    out += ' '.repeat(Math.max(0, Math.floor((w - 50) / 2))) + `${this.CYAN}${this.BOLD}⚡ SPEED BLITZ // DASH MODE ⚡${this.RESET}\r\n`;
    out += ' '.repeat(Math.max(0, Math.floor((w - 50) / 2))) + `${this.DIM}${'-'.repeat(50)}${this.RESET}\r\n\r\n`;

    // Статистика в реальном времени
    out += `    Скорость: ${this.GREEN}${this.cpm} CPM${this.RESET} | Прогресс: ${this.CYAN}${this.userInput.length}/${this.targetPhrase.length}${this.RESET}\r\n\r\n`;

    // Отрисовка строки набора
    let lineOut = '    ';
    for (let i = 0; i < this.targetPhrase.length; i++) {
      if (i < this.userInput.length) {
        lineOut += `${this.GREEN}${this.targetPhrase[i]}${this.RESET}`;
      } else if (i === this.userInput.length) {
        lineOut += `\x1b[4m${this.BOLD}${this.targetPhrase[i]}${this.RESET}\x1b[24m`;
      } else {
        lineOut += `${this.DIM}${this.targetPhrase[i]}${this.RESET}`;
      }
    }

    out += lineOut + '\r\n';
    return out;
  }

  public handleInput(data: string): void {
    if (data.startsWith('UI_')) return; // Фильтруем системные стрелки навигации консоли

    const nextChar = this.targetPhrase[this.userInput.length];
    if (data === nextChar) {
      this.userInput += data;
      
      const elapsed = (Date.now() - this.startTime) / 1000 / 60;
      if (elapsed > 0) {
        this.cpm = Math.round(this.userInput.length / elapsed);
      }
      
      if (this.userInput.length === this.targetPhrase.length) {
        this.init(this.ctx); // Круг пройден, регенерируем стейт сессии
      }
      this.router.refresh();
    }
  }
}