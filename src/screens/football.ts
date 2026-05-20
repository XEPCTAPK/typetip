/**
 * @fileoverview Игровой модуль классического хардкор-тренажера (Keyboard Football Edition).
 * Набор 40 строк случайных символов с целью дойти до финального сектора ворот.
 * © The 'Just Make It Work' Group Vibe Coding Enterprises Corporation; xepctapk (ц) //™
 */

import * as vscode from 'vscode';
import { IScreen, IScreenContext } from '../engine/interfaces';
import { AppRouter } from '../engine/router';
import { getThemeColors } from '../engine/reservation';
import { SpeedMeter } from '../engine/services';

export class TypeTipKeyboard implements IScreen {
  private ctx!: IScreenContext;
  private speedMeter = new SpeedMeter();
  
  // Игровое футбольное поле символов
  private totalLines = 40;
  private charsPerLine = 60;
  private mapData: string[] = [];
  
  // Стейт движения мяча/игрока
  private globalIndex = 0;
  private flatTargetString = '';
  
  // Эффект подката (визуальная ошибка)
  private isRedCardBlink = false;
  private blinkTimer: any = null;

  constructor(private router: AppRouter) {}

  public init(ctx: IScreenContext): void {
    this.ctx = ctx;
    this.globalIndex = 0;
    this.isRedCardBlink = false;
    this.speedMeter.start();

    // Пул жестких символов для генерации препятствий
    const pool = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789{}[]()<>+=!@#$%-*';
    this.mapData = [];
    
    // Генерируем 40 строк футбольного поля
    for (let l = 0; l < this.totalLines; l++) {
      let line = '';
      for (let c = 0; c < this.charsPerLine; c++) {
        // Делаем финальный сектор (последняя строчка, центр) визуально как ворота
        if (l === this.totalLines - 1 && c >= 25 && c <= 35) {
          line += 'GOAL'[Math.floor(Math.random() * 4)];
        } else {
          line += pool[Math.floor(Math.random() * pool.length)];
        }
      }
      this.mapData.push(line);
    }

    // Собираем всё поле в единую плоскую строку для контроля ввода
    this.flatTargetString = this.mapData.join('');
  }

  public render(): string {
    const w = this.ctx.terminalWidth;
    const h = this.ctx.terminalHeight;
    const theme = getThemeColors(this.ctx.isLightTheme);

    // Если словили подкат (ошибку) — красим фон терминала в красный
    let out = this.isRedCardBlink 
      ? '\\x1b[?7l\\x1b[41m\\x1b[2J\\x1b[H' 
      : '\\x1b[?7l\\x1b[2J\\x1b[3J\\x1b[H';

    // Шапка спортивного симулятора
    out += ' '.repeat(Math.max(0, Math.floor((w - 60) / 2))) + `${theme.BOLD}\\x1b[38;5;220m⚽ HARDCORE CYBERPUNK FOOTBALL CRUISE ⚽${theme.RESET}\\r\\n`;
    out += ' '.repeat(Math.max(0, Math.floor((w - 60) / 2))) + `${theme.DIM}${'-'.repeat(60)}${theme.RESET}\\r\\n\\r\\n`;

    // Метрики матча
    const currentCPM = this.speedMeter.getCPM();
    const accuracy = this.speedMeter.getAccuracy();
    out += `    Дриблинг (Скорость): ${theme.PRIMARY}${currentCPM} CPM${theme.RESET} | Точность паса: ${accuracy}%\\r\\n`;
    out += `    Дистанция до ворот:  \\x1b[1;92m${this.flatTargetString.length - this.globalIndex}\\x1b[0m символов\\r\\n\\r\\n`;

    // Вычисляем, какую часть из 40 строк показывать (вертикальный viewport скроллинг)
    const currentLine = Math.floor(this.globalIndex / this.charsPerLine);
    const maxVisibleLines = Math.min(h - 8, 15); // Сколько строк помещается на экране
    
    // Держим фокус на текущем игроке, скроллим поле вверх
    let startLine = Math.max(0, currentLine - Math.floor(maxVisibleLines / 2));
    let endLine = Math.min(this.totalLines, startLine + maxVisibleLines);
    
    if (endLine - startLine < maxVisibleLines) {
      startLine = Math.max(0, endLine - maxVisibleLines);
    }

    // Рендерим кусок футбольного поля
    for (let l = startLine; l < endLine; l++) {
      let lineOut = '    '; // Отступ слева для красоты
      
      for (let c = 0; c < this.charsPerLine; c++) {
        const absoluteIndex = l * this.charsPerLine + c;

        if (absoluteIndex < this.globalIndex) {
          // Пройденная дистанция (зеленые примятые газоны символов)
          lineOut += `\\x1b[32m${this.mapData[l][c]}\\x1b[0m`;
        } else if (absoluteIndex === this.globalIndex) {
          // Мяч у нашего игрока (Инвертированный мигающий курсор на символе)
          lineOut += `\\x1b[7m\\x1b[1;93m${this.mapData[l][c]}\\x1b[0m`;
        } else {
          // Защитники впереди (обычные символы, ворота в конце подсветим синим)
          if (l === this.totalLines - 1 && c >= 25 && c <= 35) {
            lineOut += `\\x1b[1;34m${this.mapData[l][c]}\\x1b[0m`;
          } else {
            lineOut += `${theme.DIM}${this.mapData[l][c]}${theme.RESET}`;
          }
        }
      }
      
      // Добавляем маркер номера строки поля справа
      out += `${lineOut}  ${theme.DIM}[ROW ${l + 1}/40]${theme.RESET}\\r\\n`;
    }

    // Если прорвались через все 40 строк
    if (this.globalIndex >= this.flatTargetString.length) {
      out += `\\r\\n\\r\\n${theme.BOLD}\\x1b[5;92m🏆 ГОООО-О-О-ОЛ!!! ВЫ ПРОБИЛИ ОБОРОНУ МАТРИЦЫ! 🏆${theme.RESET}\\r\\n`;
      out += `    Итоговый темп: ${currentCPM} CPM. Нажми [ESC] для возврата на базу.`;
    }

    return out;
  }

  public handleInput(data: string): void {
    // Если игра окончена, игнорируем обычный ввод
    if (this.globalIndex >= this.flatTargetString.length) return;

    // Не обрабатываем системные служебные кнопки роутера
    if (data.startsWith('UI_')) return;

    const nextCharNeeded = this.flatTargetString[this.globalIndex];

    if (data === nextCharNeeded) {
      // Удар точный — продвигаем мяч вперед, вызывая верный метод SpeedMeter
      this.globalIndex++;
      this.speedMeter.registerSuccess();
      this.router.refresh();
    } else {
      // Фол! Ошибка набора — ловим подкат защитника
      this.speedMeter.registerError();
      this.triggerRedCardBlink();
    }
  }

  private triggerRedCardBlink(): void {
    this.isRedCardBlink = true;
    this.router.refresh();

    if (this.blinkTimer) clearTimeout(this.blinkTimer);
    this.blinkTimer = setTimeout(() => {
      this.isRedCardBlink = false;
      this.router.refresh();
    }, 80); // Короткая яростная вспышка экрана
  }

  public resize(width: number, height: number): void {
    this.ctx.terminalWidth = width;
    this.ctx.terminalHeight = height;
    this.router.refresh();
  }

  public dispose(): void {
    if (this.blinkTimer) clearTimeout(this.blinkTimer);
  }
}