// src/screens/ws_monitor.ts
import * as vscode from 'vscode';
import { IScreen, IScreenContext } from '../engine/interfaces';
import { AppRouter } from '../engine/router';
import { GeminiWSClient } from '../core/bus';
import { getGeminiClient } from '../extension'; 


export class WsMonitorScreen implements IScreen {
    private ctx!: IScreenContext;
    private logs: string[] = [];
    private readonly maxLogs = 12;
    private client: GeminiWSClient | null = null; // Делаем nullable на случай сбоя
    private checkInterval?: NodeJS.Timeout;
    private currentStatus: string = 'UNKNOWN';

    constructor(private readonly router: AppRouter) {}

    public init(ctx: IScreenContext): void {
        this.ctx = ctx;
        this.addLog('SYS', 'Запуск подсистемы мониторинга...');

        try {
            // Безопасно пытаемся взять инстанс клиента
            this.client = getGeminiClient(); 
            
            if (this.client) {
                this.currentStatus = this.client.getStatusString();
                this.addLog('SYS', `Связь с GeminiWSClient установлена [${this.currentStatus}]`);

                // ПОДКЛЮЧАЕМ ПОТОК К АКТИВНОМУ РЕДАКТОРУ
                this.client.onMessage((data: string) => {
                    // 1. Логируем в наш TUI терминал
                    this.addLog('IN', data.substring(0, 35) + '...');
                    if (this.client) this.currentStatus = this.client.getStatusString();
                    this.router.refresh();

                    // 2. Магия вставки в редактор VS Code
                    const editor = vscode.window.activeTextEditor;
                    if (editor) {
                        const position = editor.selection.active; // Где сейчас стоит курсор
                        
                        // Безопасно редактируем документ без зависания UI
                        editor.edit((editBuilder) => {
                            // Если дата приходит в JSON — парси её, если чистый текст — вставляй как есть
                            // Предположим, Жменя шлет сырой текст или объект с полем chunk
                            let textToInsert = data;
                            try {
                                const parsed = JSON.parse(data);
                                if (parsed && parsed.chunk) textToInsert = parsed.chunk;
                            } catch {
                                // Если не JSON, работаем с сырой строкой
                            }

                            editBuilder.insert(position, textToInsert);
                        });
                    } else {
                        // Если фокус потерян или ни одна вкладка не открыта
                        this.addLog('SYS', '⚠ Нет активной вкладки редактора для вставки!');
                        this.router.refresh();
                    }
                });
            }
        } catch (error: any) {
            // ЕСЛИ ТУТ УПАЛО — ЭКРАН НЕ ПОВИСНЕТ! Он просто выведет ошибку в логи TUI
            this.currentStatus = 'ERROR';
            this.addLog('SYS', `❌ Ошибка инициализации клиента: ${error.message || error}`);
        }

        // Таймер чека
        this.checkInterval = setInterval(() => {
            if (this.client) {
                this.currentStatus = this.client.getStatusString();
            } else {
                this.currentStatus = 'NO_CLIENT';
            }
            this.addLog('SYS', `Авто-чек экрана... [${this.currentStatus}]`);
            this.router.refresh();
        }, 5000);
    }

    private addLog(dir: string, msg: string) {
        const time = new Date().toLocaleTimeString('ru-RU', { hour12: false });
        this.logs.push(`[${time}] [${dir}] ${msg}`);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
    }

    public render(): string {
        const w = this.ctx?.terminalWidth || 80;
        
        let statusColor = '\x1b[31m'; // Красный
        if (this.currentStatus === 'CONNECTED') statusColor = '\x1b[32m'; // Зеленый
        if (this.currentStatus === 'CONNECTING') statusColor = '\x1b[33m'; // Желтый
        const resetColor = '\x1b[0m';

        let out = '\x1b[2J\x1b[H'; // Зачистка экрана
        out += '┌' + '─'.repeat(w - 2) + '┐\r\n';
        out += `│ 🤖 ZHMENYA WEBSOCKET LIVE MONITOR ${' '.repeat(Math.max(0, w - 38))}│\r\n`;
        out += `│ Статус: ${statusColor}${this.currentStatus}${resetColor} | Поток: Live ${' '.repeat(Math.max(0, w - 31))}│\r\n`;
        out += '├' + '─'.repeat(w - 2) + '┤\r\n';
        
        for (let i = 0; i < this.maxLogs; i++) {
            const logLine = this.logs[i] || '';
            const cleanLength = logLine.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').length;
            const spaces = ' '.repeat(Math.max(0, w - 4 - cleanLength));
            out += `│ ${logLine}${spaces} │\r\n`;
        }
        
        out += '├' + '─'.repeat(w - 2) + '┤\r\n';
        out += `│ [ESC] или [Backspace] для возврата в главное меню ${' '.repeat(Math.max(0, w - 52))}│\r\n`;
        out += '└' + '─'.repeat(w - 2) + '┘\r\n';
        
        return out;
    }

    public handleInput(data: string): void {
        // 1. Если прожали ESC — уходим в ХАБ
        if (data === '\x1b') {
            this.router.navigateTo('HUB'); 
            return;
        }

        // 2. Если прожали ENTER (\r) — пинаем Жменю чистым текстом
        if (data === '\r') {
            if (this.client && this.currentStatus === 'CONNECTED') {
                const testPrompt = 'Напиши короткий асинхронный метод на Python с использованием asyncio.sleep';
                
                this.addLog('OUT', `🚀 Промпт: "${testPrompt}"`);
                this.router.refresh();

                try {
                    // Передаем ЧИСТУЮ СТРОКУ, твой метод сам обернет её в clientContent
                    this.client.sendPrompt(testPrompt);
                } catch (err: any) {
                    this.addLog('SYS', `❌ Ошибка отправки: ${err.message}`);
                    this.router.refresh();
                }
            } else {
                this.addLog('SYS', '⚠ Не могу отправить: туннель не готов!');
                this.router.refresh();
            }
        }
    }

    public dispose(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }
    }

    
}