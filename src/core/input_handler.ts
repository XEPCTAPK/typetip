import * as vscode from 'vscode';
import { successDecoration, errorDecoration } from '../view/decorations';

const targetPhrase = '- Хорошо, спасибо что спросил';

/**
 * Запускает отслеживание ввода пользователя во вкладке игры.
 */
export function startInputTracker(editor: vscode.TextEditor, startPos: vscode.Position) {
    
    // Подписка на изменение текста в документе
    const changeSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
        // Проверяем, что изменения происходят именно в нашем игровом окне
        if (e.document !== editor.document) return;

        const currentLineText = e.document.lineAt(startPos.line).text;
        // Отрезаем начальные пробелы (наш горизонтальный отступ)
        const userInput = currentLineText.substring(startPos.character);

        const successRanges: vscode.Range[] = [];
        const errorRanges: vscode.Range[] = [];

        let correctCount = 0;
        let hasError = false;

        // Посимвольно проверяем, что ввёл кодер
        for (let i = 0; i < userInput.length; i++) {
            const charPos = new vscode.Position(startPos.line, startPos.character + i);
            const range = new vscode.Range(charPos, new vscode.Position(startPos.line, charPos.character + 1));

            // Если до этого не было ошибок и символ совпадает с призраком
            if (!hasError && userInput[i] === targetPhrase[i]) {
                successRanges.push(range);
                correctCount++;
            } else {
                // Бах! Ошибка или шлейф после первой ошибки окрашиваем в розовый
                errorRanges.push(range);
                hasError = true;
            }
        }

        // Накладываем неоновые декорации на правильные и неправильные буквы
        editor.setDecorations(successDecoration, successRanges);
        editor.setDecorations(errorDecoration, errorRanges);

        // ДИНАМИЧЕСКИЙ ОБНОВЛЯЕМ ПРИЗРАКА
        // Мы отрезаем от призрачной фразы те буквы, которые пользователь УЖЕ успешно ввёл
        const remainingGhost = targetPhrase.substring(correctCount);

        const ghostTargetDecoration = vscode.window.createTextEditorDecorationType({
            after: {
                contentText: remainingGhost,
                color: 'rgba(255, 255, 255, 0.25)',
                fontStyle: 'italic',
            }
        });

        // Старый призрак стирается, новый вешается на позицию ПЕРЕД курсором
        const currentCursorPos = new vscode.Position(startPos.line, startPos.character + userInput.length);
        editor.setDecorations(ghostTargetDecoration, [new vscode.Range(currentCursorPos, currentCursorPos)]);
    });

    // Регистрируем подписку в контексте, чтобы она не текла памятью
    return changeSubscription;
}