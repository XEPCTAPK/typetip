/**
 * @fileoverview Подсистема рендеринга и растровой графики терминала TypeTip.
 * Разделена на Макро-ядро полноэкранных эффектов и Микро-ядро изолированных спрайтов.
 * * © The 'Just Make It Work' Group Vibe Coding Enterprises Corporation; xepctapk (ц) //™
 */

/** Структура ячейки виртуального экрана */
interface Cell {
  char: string;
  color: string; // Полный ANSI-код цвета, например '\x1b[31m'
}

/**
 * =========================================================================
 * CLASS 1: VIBE MATRIX ENGINE (ПОЛНОРАЗМЕРНАЯ МОЩЬ)
 * =========================================================================
 * Двухбуферный графический процессор. Занимает 100% виртуального экрана.
 * Используется для тяжелых фоновых рендеров (Огонь, Матричный дождь, Симуляции).
 */
export class VibeMatrixEngine {
  private width = 0;
  private height = 0;
  private currentBuffer: Cell[][] = [];
  private nextBuffer: Cell[][] = [];

  constructor() {}

  /** Аллокация внутренней памяти под размеры терминала */
  public reallocate(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.currentBuffer = this.createEmptyBuffer();
    this.nextBuffer = this.createEmptyBuffer();
  }

  /** Запись пикселя в буфер следующего кадра */
  public drawPixel(x: number, y: number, char: string, color = '\x1b[0m'): void {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.nextBuffer[y][x] = { char: char[0] || ' ', color };
    }
  }

  /** Очистка буфера прорисовки */
  public clearNextBuffer(fillChar = ' ', fillColor = '\x1b[0m'): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.nextBuffer[y][x] = { char: fillChar, color: fillColor };
      }
    }
  }

  /** * Дифференциальный рендер: сравнивает текущий кадр с предыдущим 
   * и собирает оптимизированную ANSI-строку только из изменившихся пикселей.
   */
  public compileFrame(): string {
    let ansiString = '';
    let lastColor = '';

    for (let y = 0; y < this.height; y++) {
      let lineMoved = false;

      for (let x = 0; x < this.width; x++) {
        const curr = this.currentBuffer[y]?.[x];
        const next = this.nextBuffer[y][x];

        // Оптимизация: рендерим пиксель только если он изменился
        if (!curr || curr.char !== next.char || curr.color !== next.color) {
          if (!lineMoved) {
            // Перемещаем курсор терминала физически на нужную позицию Y, X
            ansiString += `\x1b[${y + 1};${x + 1}H`;
            lineMoved = true;
          }

          if (next.color !== lastColor) {
            ansiString += next.color;
            lastColor = next.color;
          }
          ansiString += next.char;
        } else {
          // Если пиксель совпадает, флаг позиции сбрасывается, чтобы следующий измененный пиксель выставил курсор
          lineMoved = false;
        }
      }
    }

    // Рокировка буферов (глубокое копирование кадра в текущий стейт)
    for (let y = 0; y < this.height; y++) {
      this.currentBuffer[y] = this.nextBuffer[y].map(cell => ({ ...cell }));
    }

    return ansiString;
  }

  private createEmptyBuffer(): Cell[][] {
    return Array.from({ length: this.height }, () =>
      Array.from({ length: this.width }, () => ({ char: ' ', color: '\x1b[0m' }))
    );
  }
}

/**
 * =========================================================================
 * CLASS 2: MINI SPRITE ENGINE (ЛЕГКОВЕСНЫЙ ЛОКАЛЬНЫЙ РЕНДЕРЕР)
 * =========================================================================
 * Локальный спрайт-движок. Не знает про размеры всего экрана.
 * Генерирует изолированные "наклейки" (патчи) с локальным смещением X и Y.
 * Идеален для всплывающих окон, эффектов таяния букв и мелких анимаций.
 */
export class MiniSpriteEngine {
  private matrix: Cell[][] = [];
  
  /** Инициализация спрайта фиксированной геометрии */
  constructor(public readonly sWidth: number, public readonly sHeight: number) {
    this.matrix = Array.from({ length: sHeight }, () =>
      Array.from({ length: sWidth }, () => ({ char: ' ', color: '\x1b[0m' }))
    );
  }

  /** Рисование внутри локальных координат спрайта (0..sWidth, 0..sHeight) */
  public put(lx: number, ly: number, char: string, color = '\x1b[0m'): void {
    if (lx >= 0 && lx < this.sWidth && ly >= 0 && ly < this.sHeight) {
      this.matrix[ly][lx] = { char: char[0] || ' ', color };
    }
  }

  /** * Компилирует спрайт в готовую ANSI-последовательность с наложением на глобальные координаты терминала
   * @param gx Абсолютная координата X в терминале
   * @param gy Абсолютная координата Y в терминале
   */
  public renderAt(gx: number, gy: number): string {
    let out = '';
    let lastColor = '';

    for (let ly = 0; ly < this.sHeight; ly++) {
      // Прыгаем курсором на нужную строку с учетом глобального смещения
      out += `\x1b[${gy + ly};${gx}H`;

      for (let lx = 0; lx < this.sWidth; lx++) {
        const cell = this.matrix[ly][lx];
        if (cell.color !== lastColor) {
          out += cell.color;
          lastColor = cell.color;
        }
        out += cell.char;
      }
    }
    
    out += '\x1b[0m'; // Сброс цвета в конце отрисовки спрайта
    return out;
  }
}