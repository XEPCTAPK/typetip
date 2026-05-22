import * as vscode from "vscode";
import { BufferContextParser } from "../utils/cache_parser";
import { GeminiWSClient } from "../api/gemini_ws_client"; // ИМПОРТ ЗДЕСЬ!

/**
 * Менеджер триггеров для перехвата сохранения документов.
 * @author xepctapk (ц)
 * @project The 'Just Make It Work' Group Vibe Coding Enterprises Corporation //™
 */
export class SaveTriggerManager {
    // Теперь принимаем context при регистрации!
    private static globalContext: vscode.ExtensionContext;

    public static register(context: vscode.ExtensionContext): void {
        this.globalContext = context; // Сохраняем ссылку на контекст

        const disposable = vscode.workspace.onDidSaveTextDocument(() => {
            if (!this.isGeminiTerminalActive()) { return; }
            console.log("[ws TIP -> ТРИГГЕР]: Зафиксировано сохранение файла. Запускаем пайплайн.");
            this.executePromptPipeline();
        });
        context.subscriptions.push(disposable);
    }

    private static isGeminiTerminalActive(): boolean {
        const activeTerminal = vscode.window.activeTerminal;
        if (!activeTerminal) { return false; }
        const termName = activeTerminal.name.toLowerCase();
        return termName.includes("жминя") || termName.includes("ddt tip");
    }

    private static async executePromptPipeline(): Promise<void> {
        const prompt = BufferContextParser.extractPromptFromActiveBuffer();
        if (!prompt) { return; }

        // ПОДМЕШИВАЕМ ЧТЕНИЕ ИЗ НАСТРОЕК VS CODE
        const config = vscode.workspace.getConfiguration('typetip');
        // const apiKey = config.get<string>('apiKey');  -  под этот вариант потом сделаем

        // БЕРЕМ КЛЮЧ ИЗ ГЛОБАЛЬНОГО ХРАНИЛИЩА (как ты и просил)
        const apiKey = this.globalContext.globalState.get<string>('geminiApiKey');

        if (!apiKey) {
            vscode.window.showErrorMessage("Жминя в ауте: ключ API не найден в глобальном хранилище.");
            return;
        }

                

        const newDoc = await vscode.workspace.openTextDocument({
            content: `### [ВЫ]: ${prompt}\n\n---\n### [ЖМИНЯ]:\n`,
            language: "markdown"
        });

        const editor = await vscode.window.showTextDocument(newDoc, vscode.ViewColumn.Beside, true);
        if (!editor) { return; }

        const client = new GeminiWSClient(apiKey);

        // ПОДМЕШИВАЕМ ИНДИКАТОР:
        const status = vscode.window.setStatusBarMessage("$(radio-tower) Жминя подключается к эфиру...");

        console.log("[11mc TIP -> СЕТЬ]: Инициируем подключение вебсокета по триггеру.");
        await client.connect(
            (chunk: string) => {
                this.injectStreamToEditor(editor, chunk);
            },
            () => {
                status.dispose(); // Убираем индикатор
                vscode.window.setStatusBarMessage("$(check) Жминя завершила ответ", 3000);
                this.injectStreamToEditor(editor, "\n\n*[Канал связи закрыт]*");
                client.disconnect();
            }
        );

        setTimeout(() => {
            client.sendPrompt(prompt);
            console.log("[11mc TIP -> СЕТЬ]: Промпт отправлен в туннель.");
        }, 1000);
    }

    private static injectStreamToEditor(editor: vscode.TextEditor, textChunk: string): void {
        editor.edit((editBuilder) => {
            const lastLine = editor.document.lineCount;
            const position = new vscode.Position(lastLine, 0);
            editBuilder.insert(position, textChunk);
        });
    }
}