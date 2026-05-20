/**
 * @fileoverview Подсистема аналитических сервисов и математических расчетов ядра TypeTip.
 * Хранит изолированную бизнес-логику трекинга сессий, вычисления скорости (CPM/WPM)
 * и метрик точности печати. Полностью отрезан от UI-рендеринга и VS Code API.
 * * 符合 Google TypeScript СТИЛЬ ПРАВИЛ // ПОСТРОЧНОЕ КОММЕНТИРОВАНИЕ
 * © The 'Just Make It Work' Group Vibe Coding Enterprises Corporation; xepctapk (ц) //™
 */

/**
 * Высокоточный измеритель скорости и качества печати (SpeedMeter).
 * Обслуживает любые игровые сессии, аккумулируя стейт нажатий и тайминги.
 */
export class SpeedMeter {
  /** Временной штамп запуска тренировочного спринта (в миллисекундах). */
  private startTime: number = 0;
  /** Суммарное количество успешно набранных валидных символов. */
  private charsTyped: number = 0;
  /** Суммарное количество допущенных пользователем ошибок за сессию. */
  private totalErrors: number = 0;

  constructor() {}

  /**
   * Производит полный сброс внутренних счетчиков и запускает таймер сессии.
   */
  public start(): void {
    this.startTime = Date.now();
    this.charsTyped = 0;
    this.totalErrors = 0;
  }

  /**
   * Регистрирует факт успешного набора символа пользователем.
   * @param {number} count Количество набранных символов (по умолчанию 1).
   */
  public registerSuccess(count: number = 1): void {
    this.charsTyped += count;
  }

  /**
   * Регистрирует факт совершения ошибки ввода.
   * @param {number} count Количество ошибок (по умолчанию 1).
   */
  public registerError(count: number = 1): void {
    this.totalErrors += count;
  }

  /**
   * Расчет текущего показателя CPM (Characters Per Minute — Символов в минуту).
   * Базируется на скользящем временном окне с момента вызова метода start().
   * @returns {number} Количество символов в минуту.
   */
  public getCPM(): number {
    const elapsedMinutes = (Date.now() - this.startTime) / 1000 / 60;
    if (elapsedMinutes <= 0) {
      return 0;
    }
    return Math.round(this.charsTyped / elapsedMinutes);
  }

  /**
   * Расчет показателя WPM (Words Per Minute — Слов в минуту).
   * По международному стандарту типографики одно условное слово эквивалентно 5 символам.
   * @returns {number} Количество слов в минуту.
   */
  public getWPM(): number {
    return Math.round(this.getCPM() / 5);
  }

  /**
   * Вычисляет текущий процент точности набора (Accuracy Rate).
   * Предотвращает деление на ноль при пустом старте упражнения.
   * @returns {number} Процент точности в диапазоне от 0 до 100 с округлением до 1 знака.
   */
  public getAccuracy(): number {
    const totalAttempts = this.charsTyped + this.totalErrors;
    if (totalAttempts === 0) {
      return 100.0;
    }
    
    const accuracy = ((totalAttempts - this.totalErrors) / totalAttempts) * 100;
    return Math.round(accuracy * 10) / 10;
  }

  /**
   * Возвращает чистый счетчик ошибок.
   * @returns {number} Общее количество промахов.
   */
  public getErrorsCount(): number {
    return this.totalErrors;
  }

  /**
   * Возвращает чистый счетчик набранных символов.
   * @returns {number} Количество успешных нажатий.
   */
  public getCharsTyped(): number {
    return this.charsTyped;
  }
}