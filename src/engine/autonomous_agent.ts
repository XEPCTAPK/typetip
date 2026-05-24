import { BufferContextParser } from '../utils/cache_parser'; // 
import { TypeTipBus } from '../core/bus';

export class AutonomousAgent {
    public start() {
        setInterval(async () => {
            // 1. Пытаемся найти промпт в памяти
            const prompt = BufferContextParser.extractPromptFromActiveBuffer();

            // 2. Если нашли маркеры — запускаем игру/анализ
            if (prompt) {
                console.log("[AutonomousAgent]: Обнаружена задача:", prompt);
                TypeTipBus.emit('SEND_PROMPT', prompt);
                
                // Чтобы не спамить одной и той же командой, 
                // можно временно менять маркеры или чистить их.
            }
        }, 2000);
    }
}