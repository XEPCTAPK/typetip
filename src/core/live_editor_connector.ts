// src/core/live_editor_connector.ts
import * as vscode from 'vscode';
import { GeminiWSClient } from '../api/gemini_ws_client';

export class LiveEditorConnector {
    private typingTimer: NodeJS.Timeout | null = null;
    private isZhmenyaTyping = false;
    
    // Пауза в мс, после которой мы понимаем, что "мысль сформирована"
    private readonly THOUGHT_DELAY_MS = 1500; 

    constructor(private readonly geminiClient: GeminiWSClient) {}

    public activate(context: vscode.ExtensionContext) {
        // Подписываемся на изменения в документах VS Code
        context.subscriptions.push(
            vscode.workspace.onDidChangeTextDocument(this.onUserTyped.bind(this))
        );
        console.log("[Typetip Live]: Сшивка Жмени с активным редактором успешно запущена.");
    }

    private onUserTyped(event: vscode.TextDocumentChangeEvent) {
        const editor = vscode.window.activeTextEditor;
        
        // Базовые проверки: открыт ли редактор, тот ли документ и не пустой ли ввод
        if (!editor || event.document !== editor.document) return;
        if (event.contentChanges.length === 0) return;
        
        // КРИТИЧНО: Если сейчас печатает сама Жменя — игнорируем, чтобы не зациклить систему
        if (this.isZhmenyaTyping) return;

        // Пока юзер фигачит код — сбрасываем таймер
        if (this.typingTimer) {
            clearTimeout(this.typingTimer);
        }

        // Юзер остановился на 1.5 сек? Погнали!
        this.typingTimer = setTimeout(() => {
            this.streamThoughtToZhmenya(editor);
        }, this.THOUGHT_DELAY_MS);
    }

private async streamThoughtToZhmenya(editor: vscode.TextEditor) {
    console.log("[Typetip Live]: Мысль сформирована. Подключаем Gemini...");

    // Получаем весь текст файла и позицию курсора
    const documentText = editor.document.getText();
    const cursorPosition = editor.selection.active;

    // Формируем промпт для Жмени
    const prompt = `Пользователь пишет код. Вот текущее состояние файла:\n\`\`\`\n${documentText}\n\`\`\`\nКурсор находится на строке ${cursorPosition.line + 1}. Продолжи писать код с этого места или дай лаконичную подсказку прямо в коде, если мысль прервалась. Не пиши лишнего текста, пиши только то, что нужно вставить вместо или после курсора.`;

    // Блокируем триггер изменения текста, чтобы не уйти в бесконечное эхо
    this.isZhmenyaTyping = true;

    try {
        // Передаем ДВА аргумента, как и просит твой GeminiWSClient!
        await this.geminiClient.connect(
            // 1-й аргумент: onChunk (работает при каждом входящем кусочке текста)
            async (chunk: string) => {
                const currentEditor = vscode.window.activeTextEditor;
                if (!currentEditor) return;

                // Вставляем чанк на лету прямо в позицию курсора
                await currentEditor.edit(editBuilder => {
                    editBuilder.insert(currentEditor.selection.active, chunk);
                });
            },
            
            // 2-й аргумент: onComplete (сработает, когда Жменя допишет мысль)
            () => {
                console.log("[Typetip Live]: Жменя закончила генерацию.");
                // Разблокируем ввод — пользователь может писать дальше!
                this.isZhmenyaTyping = false;
            }
        );

        // Стреляем промптом в сокет
        this.geminiClient.sendPrompt(prompt);

    } catch (err) {
        console.error("[Typetip Live] Сбой отправки Жмене:", err);
        this.isZhmenyaTyping = false;
    
}


    }
}