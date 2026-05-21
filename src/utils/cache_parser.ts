import * as vscode from "vscode";

/**
 * Модуль для парсинга ИИ-контекста из оперативной памяти открытых документов.
 * Работает напрямую с активным буфером VS Code без обращений к диску.
 * * @author xepctapk (ц)
 * @project Typetip Engine //™
 */
export class BufferContextParser {
    private static readonly PROMPT_REGEX = /%%%([\s\S]*?)%%%/;

    /**
     * Захватывает текст, находящийся внутри маркеров %%% из активного окна редактора.
     * @returns Очищенный текст промпта или null, если маркеры не найдены.
     */
    public static extractPromptFromActiveBuffer(): string | null {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { return null; }

        // Работаем напрямую с кэшем документа в оперативной памяти
        const documentText = editor.document.getText();
        const match = documentText.match(this.PROMPT_REGEX);

        if (!match || !match[1]) { return null; }

        // Возвращаем очищенный от лишних пробелов текст внутри %%%
        return match[1].trim();
    }
}