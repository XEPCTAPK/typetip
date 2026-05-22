import * as vscode from "vscode";
import WebSocket from "ws"; // Использован дефолтный импорт, tsc будет доволен
import { TypeTipBus } from '../core/bus';

/**
 * Асинхронный стрим-клиент для работы с Gemini Live API через WebSocket.
 * Реализует двусторонний туннель для побуквенного вывода ответов.
 * * @author xepctapk (ц)
 * @project The 'Just Make It Work' Group Vibe Coding Enterprises Corporation //™
 */
export class GeminiWSClient {
    private ws: WebSocket | null = null;
    private apiKey: string;
    private channelId: string; // Добавляем ID, чтобы различать Жмень

    constructor(apiKey: string, channelId: string) {
        this.apiKey = apiKey;
        this.channelId = channelId;

        // ВАЖНО: Подписываемся на шину
        // Теперь клиент ЖДЕТ команды "SEND_PROMPT", если она для его канала
        TypeTipBus.on('SEND_PROMPT', (data: { channelId: string, text: string }) => {
            if (data.channelId === this.channelId) {
                this.sendPrompt(data.text);
            }
        });
    }
    
    private async sendToSocket(text: string) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            await this.connect();
        }
        this.ws?.send(JSON.stringify({ prompt: text }));
    }


    /**
     * Открывает сокет, проводит хэндшейк и настраивает прослушку эфира.
     * @param onChunk Коллбэк для впечатывания прилетевшего текста в редактор
     * @param onComplete Коллбэк для закрытия соединения или финализации UI
     */
private async connect(): Promise<void> {
    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;
    
    this.ws = new WebSocket(url);

    this.ws.on("open", () => {
        console.log(`[${this.channelId}] Сокет открыт, шлю setup...`);
        
        const setupMessage = {
            setup: {
                model: "models/gemini-3.5-flash",
                generationConfig: { responseModalities: ["TEXT"] },
                systemInstruction: { 
                    parts: [{ text: "Ты ведущий AI-архитектор корпорации TJMIWGVCEC. Выдавай лаконичный код." }] 
                }
            }
        };
        this.ws?.send(JSON.stringify(setupMessage));
        
        TypeTipBus.emit('WS_STATUS', { channelId: this.channelId, status: 'CONNECTED' });
    });

    this.ws.on("message", (data: any) => {
        try {
            const response = JSON.parse(data.toString());

            // Определяем, что прилетело
            const contentType = response.serverContent?.modelTurn?.parts?.[0]?.image ? 'IMAGE' : 'TEXT';
            const payload = response.serverContent?.modelTurn?.parts?.[0]?.text || response.serverContent?.modelTurn?.parts?.[0]?.image;

            // 1. Установка завершена
            if (response.setupComplete) {
                this.isSetupComplete = true;
                return;
            }

            // 2. Парсинг текста и отправка в шину
            if (response.serverContent?.modelTurn?.parts) {
                for (const part of response.serverContent.modelTurn.parts) {
                    if (part.text) {
                        TypeTipBus.emit('WS_DATA_RECEIVED', { 
                            channelId: this.channelId, 
                            type: contentType, // ТЕКСТ или КАРТИНКА
                            data: payload 
                        });
                    }
                }
            }

            // 3. Сигнал завершения мысли
            if (response.serverContent?.turnComplete) {
                TypeTipBus.emit('WS_DATA_RECEIVED', { 
                    channelId: this.channelId, 
                    text: null, // Сигнал финиша
                    turnComplete: true 
                });
            }
        } catch (e) {
            console.error(`[${this.channelId}] Ошибка парсинга:`, e);
        }
    });

    this.ws.on("error", (err: Error) => {
        console.error(`[${this.channelId}] Ошибка сокета:`, err);
        TypeTipBus.emit('WS_STATUS', { channelId: this.channelId, status: 'ERROR', error: err.message });
    });
}

    // ИСПРАВЛЕННЫЙ ВАРИАНТ ГЕТТЕРА: используем родное свойство this.ws
    public getStatusString(): 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' {
    if (!this.ws) {
        return 'DISCONNECTED';
    }
    
    // Сверяемся со стейтом реального WebSocket клиента (библиотеки ws)
    switch (this.ws.readyState) {
        case 0: return 'CONNECTING';     // WebSocket.CONNECTING
        case 1: return 'CONNECTED';      // WebSocket.OPEN
        default: return 'DISCONNECTED';  // CLOSING или CLOSED
    }
    }

 // 1. ПРОВЕРЬ В НАЧАЛЕ КЛАССА ИЛИ В КОНСТРУКТОРЕ:
// Если у тебя написано `private readonly apiKey: string`, сотри слово `readonly`!
// Должно быть просто: `private apiKey: string` или в конструкторе `constructor(private apiKey: string, ...)`



// В твоем SocketManager или там, где ты инициализируешь каналы
public static async spawnAgent(channelId: string, secrets: any, provider: string = 'gemini') {
    const secretKey = `typetip_auth_${provider}`;
    const token = await secrets.get(secretKey);

    if (!token) {
        console.error(`[SocketManager]: Токен для ${provider} не найден, Жменя не проснется.`);
        return;
    }

    // Просто создаем инстанс. 
    // GeminiWSClient сам возьмет этот токен и при первом вызове SEND_PROMPT 
    // автоматически дернет свой connect().
    this.getOrCreate(channelId, token);
}
    


public async sendPrompt(prompt: string): Promise<void> {
    // 1. "Ленивое" пробуждение: если спим, сначала коннектимся
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        await this.connect();
    }

    // 2. Шлем (теперь через безопасный send, который ждет открытия)
    this.ws?.send(JSON.stringify({ prompt: prompt }));
}




    /**
     * Сбрасывает соединение и зачищает буфер.
     */
    public disconnect(): void {
        if (!this.ws) { return; }
        this.ws.close();
        this.ws = null;
        this.isSetupComplete = false;
    }
}