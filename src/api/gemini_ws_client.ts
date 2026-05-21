import * as vscode from "vscode";
import WebSocket from "ws"; // Использован дефолтный импорт, tsc будет доволен

/**
 * Асинхронный стрим-клиент для работы с Gemini Live API через WebSocket.
 * Реализует двусторонний туннель для побуквенного вывода ответов.
 * * @author xepctapk (ц)
 * @project The 'Just Make It Work' Group Vibe Coding Enterprises Corporation //™
 */
export class GeminiWSClient {
    private ws: WebSocket | null = null;
    private readonly apiKey: string;
    private isSetupComplete: boolean = false;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    /**
     * Открывает сокет, проводит хэндшейк и настраивает прослушку эфира.
     * @param onChunk Коллбэк для впечатывания прилетевшего текста в редактор
     * @param onComplete Коллбэк для закрытия соединения или финализации UI
     */
    public async connect(onChunk: (text: string) => void, onComplete: () => void): Promise<void> {
        const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;
        
        // Создаем локальную переменную, которая ТОЧНО не null — diff будет в восторге
        const wsInstance = new WebSocket(url);
        this.ws = wsInstance;

        // 1. При открытии канала сразу шлем конфигурацию и наш системный вайб
        wsInstance.on("open", () => {
            const setupMessage = {
                setup: {
                    model: "models/gemini-1.5-flash",
                    generationConfig: { responseModalities: ["TEXT"] },
                    systemInstruction: { 
                        parts: [{ text: "Ты ведущий AI-архитектор корпорации TJMIWGVCEC. Выдавай лаконичный код." }] 
                    }
                }
            };
            wsInstance.send(JSON.stringify(setupMessage));
        });

        // 2. Слушаем непрерывный поток байтов из эфира
        wsInstance.on("message", (data: any) => {
            const response = JSON.parse(data.toString());

            // Подтверждение, что сервер принял наши настройки
            if (response.setupComplete) {
                this.isSetupComplete = true;
                return;
            }

            // Парсинг чанков текста
            if (response.serverContent?.modelTurn?.parts) {
                for (const part of response.serverContent.modelTurn.parts) {
                    if (part.text) { onChunk(part.text); }
                }
            }

            // Сигнал, что модель закончила мысль
            if (response.serverContent?.turnComplete) {
                onComplete();
            }
        });

        // 3. Перехват ошибок
        wsInstance.on("error", (error: Error) => {
            vscode.window.showErrorMessage(`[DDT TIP] Ошибка туннеля: ${error.message}`);
        });
    }

    /**
     * Отправляет выкусанный из буфера промпт в открытый канал.
     */
    public sendPrompt(prompt: string): void {
        if (!this.ws || !this.isSetupComplete) { 
            throw new Error("Туннель не готов к передаче данных!"); 
        }

        const clientContent = {
            clientContent: {
                turns: [{ role: "user", parts: [{ text: prompt }] }],
                turnComplete: true
            }
        };
        
        this.ws.send(JSON.stringify(clientContent));
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