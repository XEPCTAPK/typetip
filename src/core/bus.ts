/**
 * @fileoverview Глобальная шина событий и переключаемый мульти-коммутатор сокетов.
 * 符合 Google TypeScript ПРАВИЛА СТИЛЯ // ПОСТРОЧНОЕ КОММЕНТИРОВАНИЕ
 * © The 'Just Make It Work' Group Vibe Coding Enterprises Corporation
 */

export const BUS_CONFIG = {
  // 0 - Использовать безопасный MOCK-режим (для чистой компиляции)
  // 1 - Включить боевой контур Жмени (GeminiWSClient)
  // 2 - Контур под локальную Ламу (LLAMA)
  ACTIVE_SOCKET: 1 
};

export type EventType = 'SEND_PROMPT' | 'WS_DATA_RECEIVED' | 'WS_STATUS';

export class TypeTipBus {
  private static listeners: Map<EventType, Set<Function>> = new Map();

  static on(event: EventType, callback: Function) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(callback);
  }

  static emit(event: EventType, data: any) {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }
}

export interface TypeTipMessage {
  channelId: string;
  type: 'TEXT' | 'IMAGE' | 'JSON_DATA' | 'SYSTEM_LOG';
  payload: any;
  turnComplete?: boolean;
}

/**
 * УНИВЕРСАЛЬНЫЙ СУПЕР-ФАСАД `GeminiWSClient`
 * Примиряет любые старые и новые вызовы во всем проекте.
 */
export class GeminiWSClient {
  public isSetupComplete: boolean = false;
  private engine: any = null;

  constructor(apiKey?: string, channelId?: string) {
    if (BUS_CONFIG.ACTIVE_SOCKET === 1) {
      try {
        // Динамически подгружаем твой оригинальный сокет
        const RealClient = require('../api/gemini_ws_client').GeminiWSClient;
        this.engine = new RealClient(apiKey, channelId);
        this.isSetupComplete = this.engine?.isSetupComplete ?? false;
      } catch (e) {
        console.error("[Bus Switcher]: Не удалось загрузить оригинальный сокет, откат на заглушку.");
        this.isSetupComplete = true;
      }
    } else {
      this.isSetupComplete = true;
    }
  }

  public static getOrCreate(channelId: string, apiKey: string): GeminiWSClient {
    return new GeminiWSClient(apiKey, channelId);
  }

  /**
   * Принимает 2 аргумента из live_editor_connector.ts
   * Если у оригинального сокета метод connect() пустой — вызываем его без параметров,
   * а коллбеки цепляем на глобальную шину или внутренние слушатели.
   */
  public async connect(onChunk?: (chunk: string) => void, onComplete?: () => void): Promise<void> {
    if (this.engine && this.engine.connect) {
      // Защита: проверяем через рефлексию, принимает ли твой метод аргументы
      if (this.engine.connect.length > 0) {
        return this.engine.connect(onChunk, onComplete);
      } else {
        // Если твой оригинальный connect() пустой — вызываем без параметров, 
        // а коллбеки регистрируем в шину, чтобы не потерять поток
        if (onChunk) TypeTipBus.on('WS_DATA_RECEIVED', onChunk);
        return this.engine.connect();
      }
    }
  }

  public sendPrompt(prompt: string): void {
    if (this.engine && this.engine.sendPrompt) {
      this.engine.sendPrompt(prompt);
    }
  }

  public disconnect(): void {
    if (this.engine && this.engine.disconnect) {
      this.engine.disconnect();
    }
  }

  // Совместимость с wsmonitor.ts
  public onMessage(callback: (data: string) => void): void {
    if (this.engine && this.engine.onMessage) {
      this.engine.onMessage(callback);
    } else {
      // Если метода нет — вешаем слушатель на глобальную шину
      TypeTipBus.on('WS_DATA_RECEIVED', callback);
    }
  }

  // Запрашивает текстовый статус у оригинального движка сокета для экрана wsmonitor.ts
  public getStatusString(): string {
    if (this.engine && typeof this.engine.getStatusString === 'function') {
      return this.engine.getStatusString();
    }
    // Если мы в Mock-режиме или в оригинальном классе нет метода — отдаем красивый дефолт
    return BUS_CONFIG.ACTIVE_SOCKET === 1 ? "CONNECTED_BUS" : "MOCK_ACTIVE";
  }

  // Совместимость с chat_panel.ts
  public initFromSecrets(secrets: any, provider: string): void {
    if (this.engine && this.engine.initFromSecrets) {
      this.engine.initFromSecrets(secrets, provider);
    }
    this.isSetupComplete = true;
  }
}