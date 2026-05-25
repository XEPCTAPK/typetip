// import * as vscode from 'vscode';
// import WebSocket from 'ws'; // Или твой текущий клиент WS

// export class LiveEditorConnector {
//     private ws: WebSocket;
//     private typingTimer: NodeJS.Timeout | null = null;
//     private isZhmenyaTyping = false;
    
//     // Настройка: сколько мс ждем после последнего нажатия, чтобы понять, что "мысль сформирована"
//     private readonly THOUGHT_DELAY_MS = 1500; 

//     constructor(wsUrl: string) {
//         this.ws = new WebSocket(wsUrl);
//         this.setupWebSocket();
//     }

//     public activate(context: vscode.ExtensionContext) {
//         // Подключаемся к "слухачу" редактора
//         context.subscriptions.push(
//             vscode.workspace.onDidChangeTextDocument(this.onUserTyped.bind(this))
//         );
//         console.log("[VibeType]: Live-режим Жмени активирован. Ждем твоих мыслей.");
//     }

//     private onUserTyped(event: vscode.TextDocumentChangeEvent) {
//         const editor = vscode.window.activeTextEditor;
        
//         // 1. Проверки адекватности
//         if (!editor || event.document !== editor.document) return;
//         if (event.contentChanges.length === 0) return;
        
//         // 2. Игнорируем изменения, если прямо сейчас печатает Жменя (чтобы не зациклить WS)
//         if (this.isZhmenyaTyping) return;

//         // 3. Сбрасываем таймер при каждой новой букве (юзер еще формирует мысль)
//         if (this.typingTimer) {
//             clearTimeout(this.typingTimer);
//         }

//         // 4. Заводим таймер. Если юзер замолчал на THOUGHT_DELAY_MS — стреляем в WS
//         this.typingTimer = setTimeout(() => {
//             this.captureAndSendThought(editor);
//         }, this.THOUGHT_DELAY_MS);
//     }

//     private captureAndSendThought(editor: vscode.TextEditor) {
//         // Берем весь текст (или можно брать только последние N строк для экономии)
//         const documentText = editor.document.getText();
//         const cursorPosition = editor.selection.active;

//         console.log("[VibeType]: Мысль сформирована. Отправляем Жмене...");

//         // Отправляем пакет в вебсокет
//         this.ws.send(JSON.stringify({
//             type: 'analyze_thought',
//             content: documentText,
//             line: cursorPosition.line
//         }));
//     }

//     private setupWebSocket() {
//         this.ws.on('message', async (data) => {
//             const response = JSON.parse(data.toString());

//             // Жменя прислала токен текста
//             if (response.type === 'token') {
//                 await this.insertTokenToEditor(response.value);
//             }
//         });
//     }

//     private async insertTokenToEditor(token: string) {
//         const editor = vscode.window.activeTextEditor;
//         if (!editor) return;

//         // Включаем флаг, чтобы onDidChangeTextDocument не среагировал на этот текст
//         this.isZhmenyaTyping = true;

//         // Впечатываем токен в то место, где сейчас стоит курсор
//         await editor.edit(editBuilder => {
//             editBuilder.insert(editor.selection.active, token);
//         });

//         // Отключаем флаг, разрешая юзеру снова писать
//         this.isZhmenyaTyping = false;
//     }
// }