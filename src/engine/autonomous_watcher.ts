// @ts-nocheck

import { TypeTipBus, GeminiWSClient } from '../core/bus';

class AutonomousWatcher {
    private lastSnapshot: string = "";

    constructor() {
        // Запускаем цикл проверки каждые 2 секунды
        setInterval(() => this.scan(), 2000);
    }

    private async scan() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const currentCode = editor.document.getText();
        
        // 1. Оцениваем "Энтропию" (изменилось ли что-то критичное?)
        if (this.hasSignificantChange(this.lastSnapshot, currentCode)) {
            this.lastSnapshot = currentCode;
            
            // 2. Отправляем модель в "Режим Инспекции"
            // Модель сама решает: "Нужно ли что-то дописать или исправить?"
            TypeTipBus.emit('SEND_PROMPT', {
                type: 'AUTONOMOUS_ANALYSIS',
                context: currentCode,
                instruction: "Ты — напарник. Если видишь логическую дыру или можешь продолжить код — выведи JSON с действием (INSERT/REFACTOR)."
            });
        }
    }
}