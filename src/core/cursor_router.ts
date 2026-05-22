// // Глобальная шина событий редактора и терминала

// export class CursorRouter {
//     private static instance: CursorRouter;
//     // Храним состояние курсоров для каждого "слоя"
//     private cursors = {
//         editor: [], // позиции в VS Code редакторе
//         pty: [],    // позиции в твоем псевдотерминале
//         webview: [] // позиции в интерфейсе чата
//     };

//     public static getInstance() {
//         if (!this.instance) this.instance = new CursorRouter();
//         return this.instance;
//     }

//     // Личность этого модуля — он решает, куда отправить токены
//     public async dispatchTokens(tokens: string, target: 'editor' | 'pty') {
//         if (target === 'pty') {
//             // Маршрутизация в твой PTY
//             await this.writeToPty(tokens);
//         } else {
//             // Маршрутизация в редактор
//             await this.writeToEditor(tokens);
//         }
//     }

//     private async writeToPty(tokens: string) {
//         // Здесь твоя логика общения с PTY
//         // Имитируем перемещение курсора через ANSI коды \x1b[y;xH
//         console.log(`[CursorRouter]: Пишем в PTY: ${tokens}`);
//     }
// }