/**
 * @fileoverview Высокопроизводительный экран Интро в стиле полноэкранного CyberHUD.
 * Адаптивно растягивает рамки, боковые панели и перекрестия под размер окна.
 * 符合 Google TypeScript СТИЛЬ ПРАВИЛ / ПОСТРОЧНОЕ КОММЕНТИРОВАНИЕ
 * © The 'Just Make It Work' Group Vibe Coding Enterprises Corporation; xepctapk (ц) //™
 */

import { IScreen, IScreenContext } from '../engine/interfaces';
import { AppRouter } from '../engine/router';
import { ANSI_ASSETS } from './assets/assets';

export class IntroScreen implements IScreen {
  private ctx!: IScreenContext;
  private animationTicks = 0;
  private internalLoopTimer: any = null;
  
  /** Переиспользуемый плоский буфер для исключения нагрузки на Garbage Collector */
  private matrix: string[][] = [];

  constructor(private router: AppRouter) {}

  // === [БЛОК 1: ИНИЦИАЛИЗАЦИЯ И ЖИЗНЕННЫЙ ЦИКЛ] ===
  public init(ctx: IScreenContext): void {
    this.ctx = ctx;
    this.animationTicks = 0;

    if (this.internalLoopTimer) {
      clearInterval(this.internalLoopTimer);
    }

    // Стабильные 30 FPS. Нагрузка минимальна.
    this.internalLoopTimer = setInterval(() => {
      this.animationTicks++;
      if (this.ctx?.writeEmitter) {
        this.ctx.writeEmitter.fire(this.render());
      }
    }, 33);
  }

  public resize(width: number, height: number): void {
    this.ctx.terminalWidth = width;
    this.ctx.terminalHeight = height;
    this.matrix = []; // Сброс сетки при ресайзе
  }

  public dispose(): void {
    if (this.internalLoopTimer) {
      clearInterval(this.internalLoopTimer);
      this.internalLoopTimer = null;
    }
  }

  public handleInput(data: string): void {
    this.dispose();
    this.router.navigateTo('HUB');
  }

  // === [БЛОК 2: ЯДРО ГЕНЕРАЦИИ МАТРИЦЫ КАДРА] ===
  public render(): string {
    const w = this.ctx.terminalWidth || 120;
    const h = this.ctx.terminalHeight || 30;

    // Спецификация палитры ANSI-модификаторов
    const RESET = '\x1b[0m';
    const BOLD = '\x1b[1m';
    const DIM = '\x1b[2m';
    const CYAN = '\x1b[36m';
    const BRIGHT_CYAN = '\x1b[96m';
    const GREEN = '\x1b[32m';
    const BRIGHT_GREEN = '\x1b[92m';
    const YELLOW = '\x1b[33m';
    const DARK_GRAY = '\x1b[90m';
    const WHITE = '\x1b[37m';

    // Аллокация двумерной координатной сетки
    if (this.matrix.length !== h || this.matrix[0]?.length !== w) {
      this.matrix = Array.from({ length: h }, () => Array(w).fill(' '));
    } else {
      for (let y = 0; y < h; y++) {
        this.matrix[y].fill(' ');
      }
    }

    // 1. Отрисовка внешней защитной рамки CyberHUD
    const edgeColor = DIM + CYAN;
    for (let x = 0; x < w; x++) {
      this.matrix[0][x] = edgeColor + '═';
      this.matrix[h - 1][x] = edgeColor + '═';
    }
    for (let y = 0; y < h; y++) {
      this.matrix[y][0] = edgeColor + '║';
      this.matrix[y][w - 1] = edgeColor + '║';
    }
    this.matrix[0][0] = edgeColor + '╔';
    this.matrix[0][w - 1] = edgeColor + '╗';
    this.matrix[h - 1][0] = edgeColor + '╚';
    this.matrix[h - 1][w - 1] = edgeColor + '╝';

    // 2. Интеграция боковых приборных панелей телеметрии
    const panelX = 22; 
    for (let y = 1; y < h - 1; y++) {
      this.matrix[y][panelX] = DIM + DARK_GRAY + '│';
      this.matrix[y][w - panelX - 1] = DIM + DARK_GRAY + '│';
    }

    const midY = Math.floor(h / 2);
    if (midY < h) {
      this.matrix[midY][2] = BRIGHT_CYAN + '➔' + RESET;
      this.matrix[midY][panelX] = DIM + CYAN + '┼';
      this.matrix[midY][w - panelX - 1] = DIM + CYAN + '┼';
      this.matrix[midY][w - 3] = BRIGHT_CYAN + '◀' + RESET;
    }

    // 3. Вывод Логотипов ТайпТип Студио
    const contentHeight = 17;
    const paddingTop = Math.max(1, Math.floor((h - contentHeight) / 2) - 1);

    // Вывод блока TERMИNAL (ТайпТип)
    const termWidth = ANSI_ASSETS.DOT_TERMINAL[0].length;
    const termPaddingLeft = Math.max(panelX + 2, Math.floor((w - termWidth) / 2));
    ANSI_ASSETS.DOT_TERMINAL.forEach((line, idx) => {
      const targetY = paddingTop + idx;
      if (targetY < h) {
        for (let x = 0; x < line.length; x++) {
          if (line[x] !== ' ' && (termPaddingLeft + x) < w - panelX) {
            this.matrix[targetY][termPaddingLeft + x] = BRIGHT_CYAN + line[x];
          }
        }
      }
    });

    // Вывод блока RAEDY (Студио)
    const readyWidth = ANSI_ASSETS.DOT_READY[0].length;
    const readyPaddingLeft = Math.max(panelX + 2, Math.floor((w - readyWidth) / 2));
    ANSI_ASSETS.DOT_READY.forEach((line, idx) => {
      const targetY = paddingTop + 7 + idx;
      if (targetY < h) {
        for (let x = 0; x < line.length; x++) {
          if (line[x] !== ' ' && (readyPaddingLeft + x) < w - panelX) {
            this.matrix[targetY][readyPaddingLeft + x] = CYAN + line[x];
          }
        }
      }
    });

    // 4. Центральный бокс статусов ЖМИНЯ
    const boxY = paddingTop + 15;
    const boxWidth = 76;
    const boxPaddingLeft = Math.max(panelX + 2, Math.floor((w - boxWidth) / 2));

    const isVisible = (this.animationTicks % 30 < 15);
    const dynamicGreen = isVisible ? BRIGHT_GREEN : DIM + GREEN;
    const dynamicYellow = isVisible ? YELLOW : DIM + YELLOW;

    if (boxY + 2 < h - 1) {
      const statusTextPlain = "  SYSTEM: ACTIVE     PTY: MOUNTED     VIBE: MAXIMUM     CODE: BY ЖМИНЯ  ";
      for (let i = 0; i < boxWidth; i++) {
        this.matrix[boxY][boxPaddingLeft + i] = DIM + GREEN + '═';
        this.matrix[boxY + 2][boxPaddingLeft + i] = DIM + GREEN + '═';
        this.matrix[boxY + 1][boxPaddingLeft + i] = DIM + GREEN + statusTextPlain[i];
      }
      this.matrix[boxY + 1][boxPaddingLeft] = DIM + GREEN + '║';
      this.matrix[boxY + 1][boxPaddingLeft + boxWidth - 1] = DIM + GREEN + '║';

      this.matrix[boxY + 1][boxPaddingLeft + 2] = dynamicGreen + '●';
      this.matrix[boxY + 1][boxPaddingLeft + 21] = dynamicGreen + '●';
      this.matrix[boxY + 1][boxPaddingLeft + 40] = dynamicGreen + '●';
      this.matrix[boxY + 1][boxPaddingLeft + 59] = dynamicYellow + '●';
      
      for (let j = 0; j < 8; j++) {
        this.matrix[boxY + 1][boxPaddingLeft + 66 + j] = YELLOW + BOLD + "BY ЖМИНЯ"[j];
      }
    }

    // 5. Изолированный вызов боковых панелей телеметрии (Защита диффа Git)
    this.injectSidePanels(h, w, panelX);

    // 6. Текст кнопки Press Any Key
    const pressTxt = ANSI_ASSETS.PRESS_ANY_KEY;
    const pressPaddingLeft = Math.max(panelX + 2, Math.floor((w - pressTxt.length) / 2));
    const pressY = h - 3; 
    if (pressY > boxY + 2 && pressY < h - 1) {
      for (let i = 0; i < pressTxt.length; i++) {
        this.matrix[pressY][pressPaddingLeft + i] = DIM + CYAN + pressTxt[i];
      }
    }

    // === [БЛОК 3: ФИНАЛЬНАЯ СБОРКА ПОТОКА И ОПУСК ПРОМПТА В САМЫЙ НИЗ] ===
    // Чистим экран и сбрасываем курсор в левый верхний угол
    let result = `\x1b[?7l\x1b[H\x1b[?25h`;

    // Выводим строки с 0 по предпоследнюю (h-2) в чистом HUD режиме
    for (let y = 0; y < h - 1; y++) {
      result += this.matrix[y].map(cell => cell.includes('\x1b') ? cell : cell + RESET).join('') + '\r\n';
    }

    // ПОСЛЕДНЯЯ СТРОКА (h - 1): Сюда сажаем наш промпт, чтобы он лежал на дне окна!
    const promptStr = `${DIM}${GREEN}root@typetip:/home# ${WHITE}useradd -m typetip${RESET}`;
    const promptPlainLen = 37; // Чистая физическая длина текста промпта

    // Склеиваем промпт и правую часть нижней рамки
    result += promptStr + this.matrix[h - 1].slice(promptPlainLen).map(cell => cell.includes('\x1b') ? cell : cell + RESET).join('') + '\r\n';

    // Аппаратное смещение курсора в конец промпта на последней строке
    result += `\x1b[${h};${promptPlainLen + 1}H`;

    return result;
  }

  /**
   * Изолированный метод вывода боковых логов.
   * Спасает Git от ложных срабатываний при обновлении текстовых полей.
   */
  private injectSidePanels(h: number, w: number, panelX: number): void {
    const GREEN = '\x1b[32m'; const BOLD = '\x1b[1m'; const DIM = '\x1b[2m'; const BRIGHT_GREEN = '\x1b[92m';
    const YELLOW = '\x1b[33m'; const BRIGHT_CYAN = '\x1b[96m'; const CYAN = '\x1b[36m'; const BRIGHT_WHITE = '\x1b[97m';
    
    // Левые логи
    if (panelX < w) {
      const loadVal = (Math.sin(this.animationTicks * 0.05) * 4 + 12).toFixed(2);
      const logs = [
        `${GREEN}${BOLD}📡 TELEMETRY`, `${DIM}${GREEN}────────────`,
        `${GREEN}CORE: ${BRIGHT_GREEN}ONLINE`, `${GREEN}LOAD: ${YELLOW}${loadVal}%`,
        `${GREEN}BUFF: ${BRIGHT_CYAN}STABLE`, ` `,
        `${DIM}${CYAN}🛠️ SUBSYSTEMS`, `${DIM}${CYAN}────────────`,
        `${CYAN}PTY:  ${GREEN}OK`, `${CYAN}V8:   ${GREEN}OK`, `${CYAN}XTERM:${GREEN}OK`
      ];
      logs.forEach((line, idx) => {
        if (idx + 2 < h - 1) {
          const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, '');
          for (let i = 0; i < cleanLine.length; i++) {
            this.matrix[idx + 2][2 + i] = line;
            break;
          }
        }
      });
    }

    // Правые логи
    if (w - panelX > 0) {
      const hzGraph = [' ▄', ' ▆', ' █', ' ▅', ' ▃', ' ▄', ' █', ' ▇'][(this.animationTicks + 1) % 8];
      const rights = [
        `${CYAN}${BOLD}🧭 NAVIGATION`, `${DIM}${CYAN}────────────`,
        `${CYAN}HDG:  ${BRIGHT_CYAN}042.89°`, `${CYAN}YEAR: ${BRIGHT_WHITE}2026.V3`,
        `${CYAN}FPS:  ${BRIGHT_GREEN}30.3 HZ`, ` `,
        `${DIM}${GREEN}📈 ENGINE BUS`, `${DIM}${GREEN}────────────`,
        `${GREEN}WAVE: ${BRIGHT_GREEN}${hzGraph}${hzGraph}${hzGraph}`,
        `${GREEN}VIBE: ${BRIGHT_GREEN}MAXIMUM`, `${GREEN}STAT: ${GREEN}ACTIVE`
      ];
      rights.forEach((line, idx) => {
        if (idx + 2 < h - 1) {
          this.matrix[idx + 2][w - panelX + 1] = line;
        }
      });
    }
  }
}