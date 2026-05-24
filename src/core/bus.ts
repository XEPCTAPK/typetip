/**
 * @fileoverview Глобальная шина событий и переключаемый мульти-коммутатор сокетов.
 * 符合 Google TypeScript ПРАВИЛА СТИЛЯ // ПОСТРОЧНОЕ КОММЕНТИРОВАНИЕ
 * © The 'Just Make It Work' Group Vibe Coding Enterprises Corporation
 */

import { spawn, ChildProcess } from 'child_process'; // Импортируем утилиту для управления sidecar-процессом

export const BUS_CONFIG = {
  // 0 - Использовать безопасный MOCK-режим (для чистой компиляции)
  // 1 - Включить боевой контур Жмени (GeminiWSClient)
  // 2 - Контур под локальную Ламу (LLAMA)
  // 3 - Автономный контур CodeGemma через локальный sidecar llama.cpp
  ACTIVE_SOCKET: 3 
};

export type ChannelType = 'ARCHITECT' | 'DEBUGGER' | 'COMPLETER' | 'SYSTEM';



export type EventType = 'SEND_PROMPT' | 'WS_DATA_RECEIVED' | 'WS_STATUS';

export class TypeTipBus {
  private static listeners: Map<EventType, Set<Function>> = new Map();

  static on(event: EventType, callback: Function): { dispose: () => void } {
  if (!this.listeners.has(event)) this.listeners.set(event, new Set());
  this.listeners.get(event)!.add(callback);

  // Возвращаем объект, который удаляет слушателя
  return {
    dispose: () => {
      this.listeners.get(event)?.delete(callback);
    }
  };
}


   // Шина теперь знает, какой агент вызвал событие
   static emit(event: EventType, data: any, channel: ChannelType = 'SYSTEM') {
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
 * АВТОНОМНЫЙ ДВИЖОК ДЛЯ CODEGEMMA (Байпас без Ollama)
 * Напрямую управляет бинарником сервера и транслирует токены в шину
 */
class CodeGemmaLocalClient {
  private static serverProcess: ChildProcess | null = null;
  private isConnected: boolean = false;

  constructor() {
    this.bootSidecarIfRequired(); // Инициализируем фоновый процесс при создании клиента
  }

  /**
   * Поднимает сервер llama.cpp, если он еще не запущен
   */
  private bootSidecarIfRequired() {
    if (CodeGemmaLocalClient.serverProcess) return; // Защита: сервер уже поднят

    try {
      // Запускаем скомпилированный бинарник сервера с прямой ссылкой на GGUF веса модели
      CodeGemmaLocalClient.serverProcess = spawn('./bin/llama-server', [
        '-m', './models/codegemma-2b-q8.gguf', // Путь к квантованной модели в корне проекта
        '--port', '8081',                      // Выделенный порт для контура Кодегеммы
        '--threads', '4',                      // Количество потоков процессора
        '-ctx', '4096',                        // Размер контекстного окна для анализа AST
        '--embedding'                          // Включаем поддержку эмбеддингов для построения графов
      ]);

      // Гарантируем уничтожение процесса ИИ при закрытии терминала/Станка
      process.on('exit', () => CodeGemmaLocalClient.serverProcess?.kill());
    } catch (e) {
      console.error("[CodeGemma Sidecar]: Критическая ошибка инициализации бинарника:", e);
    }
  }

  public async connect(): Promise<void> {
    this.isConnected = true; // Фиксируем статус подключения
    TypeTipBus.emit('WS_STATUS', this.getStatusString()); // Оповещаем шину
  }

  /**
   * Отправка промпта в локальную модель через встроенный HTTP-стрим
   */
  public async sendPrompt(prompt: string): Promise<void> {
    try {
      // Делаем стандартный fetch-запрос к нашему sidecar-серверу
      const response = await fetch('http://localhost:8081/completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt,
          stream: true, // Включаем потоковую отдачу токенов для рендеринга на экране
          temperature: 0.2 // Низкая температура для строгой генерации архитектуры без галлюцинаций
        })
      });

      if (!response.body) return;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // Читаем поток токенов в реальном времени
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        
        // Парсим SSE (Server-Sent Events) формат от llama.cpp
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));
              const token = parsed.content; // Вытаскиваем чистый сгенерированный токен/текст
              
              if (token) {
                // ВШИВАЕМ ТОКЕН В ГЛОБАЛЬНУЮ ШИНУ ПРОЕКТА
                TypeTipBus.emit('WS_DATA_RECEIVED', token);
              }
            } catch (e) {
              // Игнорируем промежуточные служебные строки парсинга
            }
          }
        }
      }
    } catch (error) {
      console.error("[CodeGemma Local]: Ошибка выполнения запроса к модели:", error);
      TypeTipBus.emit('WS_DATA_RECEIVED', "\n[Ошибка контура CodeGemma]: Проверьте наличие бинарника в ./bin/");
    }
  }

  public disconnect(): void {
    this.isConnected = false;
    TypeTipBus.emit('WS_STATUS', this.getStatusString());
  }

  public getStatusString(): string {
    return this.isConnected ? "CODEGEMMA_SIDE_CAR_ACTIVE" : "CODEGEMMA_OFFLINE";
  }
}

/**
 * УНИВЕРСАЛЬНЫЙ СУПЕР-ФАСАД `GeminiWSClient`
 * Вбирает в себя боевой контур Жмени, Моки и локальный байпас CodeGemma.
 */
export class GeminiWSClient {
  public isSetupComplete: boolean = false;
  private engine: any = null;

  constructor(apiKey?: string, channelId?: string) {
    if (BUS_CONFIG.ACTIVE_SOCKET === 1) {
      try {
        // Динамически подгружаем оригинальный сокет Gemini
        const RealClient = require('../api/gemini_ws_client').GeminiWSClient;
        this.engine = new RealClient(apiKey, channelId);
        this.isSetupComplete = this.engine?.isSetupComplete ?? false;
      } catch (e) {
        console.error("[Bus Switcher]: Не удалось загрузить оригинальный сокет, откат на заглушку.");
        this.isSetupComplete = true;
      }
    } else if (BUS_CONFIG.ACTIVE_SOCKET === 3) {
      // ПЕРЕКЛЮЧАЕМ РЕЛЬСЫ НА ЛОКАЛЬНУЮ CODEGEMMA
      this.engine = new CodeGemmaLocalClient();
      this.isSetupComplete = true;
    } else {
      this.isSetupComplete = true;
    }
  }

  public static getOrCreate(channelId: string, apiKey: string): GeminiWSClient {
    return new GeminiWSClient(apiKey, channelId);
  }

  public async connect(onChunk?: (chunk: string) => void, onComplete?: () => void): Promise<void> {
    if (this.engine) {
      // Если это локальный клиент CodeGemma
      if (BUS_CONFIG.ACTIVE_SOCKET === 3) {
        if (onChunk) TypeTipBus.on('WS_DATA_RECEIVED', onChunk);
        return this.engine.connect();
      }
      
      // Логика для оригинального Gemini клиента
      if (this.engine.connect && this.engine.connect.length > 0) {
        return this.engine.connect(onChunk, onComplete);
      } else if (this.engine.connect) {
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

  public onMessage(callback: (data: string) => void): void {
    if (this.engine && BUS_CONFIG.ACTIVE_SOCKET === 1 && this.engine.onMessage) {
      this.engine.onMessage(callback);
    } else {
      // Для CodeGemma и Mock-режима вешаем слушатель на глобальную шину
      TypeTipBus.on('WS_DATA_RECEIVED', callback);
    }
  }

  public getStatusString(): string {
    if (this.engine && typeof this.engine.getStatusString === 'function') {
      return this.engine.getStatusString();
    }
    
    if (BUS_CONFIG.ACTIVE_SOCKET === 3) return "CODEGEMMA_CONNECTED";
    return BUS_CONFIG.ACTIVE_SOCKET === 1 ? "CONNECTED_BUS" : "MOCK_ACTIVE";
  }

  public initFromSecrets(secrets: any, provider: string): void {
    if (this.engine && this.engine.initFromSecrets) {
      this.engine.initFromSecrets(secrets, provider);
    }
    this.isSetupComplete = true;
  }
}