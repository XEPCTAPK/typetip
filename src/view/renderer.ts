import * as vscode from 'vscode';
import { startInputTracker } from '../core/input_handler';

export async function openVibeGameTab(): Promise<vscode.TextEditor | undefined> {
    try {
        const verticalPadding = '\n'.repeat(12);
        const horizontalPadding = ' '.repeat(25);
        const titleText = '- Как дела брад?\n';

        const centeredContent = verticalPadding + horizontalPadding + titleText + horizontalPadding;

        const gameDocument = await vscode.workspace.openTextDocument({
            content: centeredContent,
            language: 'plaintext'
        });

        const gameEditor = await vscode.window.showTextDocument(gameDocument, {
            viewColumn: vscode.ViewColumn.Active,
            preview: false 
        });

        const targetLineIndex = 12 + 1; 
        const startPos = new vscode.Position(targetLineIndex, horizontalPadding.length);

        // НАЧАЛЬНЫЙ ПРИЗРАК: При старте показываем всю фразу целиком
        const initialGhostDecoration = vscode.window.createTextEditorDecorationType({
            after: {
                contentText: 'хорошо, спасибо что спросил',
                color: 'rgba(255, 255, 255, 0.25)',
                fontStyle: 'italic',
            }
        });
        gameEditor.setDecorations(initialGhostDecoration, [new vscode.Range(startPos, startPos)]);

        // Ставим курсор на старт
        gameEditor.selection = new vscode.Selection(startPos, startPos);

        // 🔥 ЗАПУСКАЕМ НАШ ТРЕКЕР КЛАВИАТУРЫ
        startInputTracker(gameEditor, startPos);

        vscode.window.setStatusBarMessage('🎮 Кибер-тир запущен! Пиши поверх призрака, брад!', 5000);
        return gameEditor;

    } catch (error) {
        vscode.window.showErrorMessage(`Ошибка запуска: ${error}`);
        return undefined;
    }
}