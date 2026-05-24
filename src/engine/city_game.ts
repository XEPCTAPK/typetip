// src/engine/city_game.ts
import { TypeTipBus } from '../core/bus';

export class CityGameAgent {
    private lastCity: string = '';
    private isRunning: boolean = false;

    constructor() {
        // Слушаем всё, что прилетает в терминал
        TypeTipBus.on('WS_DATA_RECEIVED', (data: string) => {
            if (this.isRunning) {
                this.analyzeAndRespond(data.trim());
            }
        });
    }

    public start() {
        this.isRunning = true;
        console.log("[CityGame]: Игра началась! Пиши город.");
    }

    private analyzeAndRespond(input: string) {
        // Простая логика: если ввод похож на город
        if (input.length > 2) {
            const prompt = `Играем в города. Предыдущий город: ${this.lastCity || 'первый ход'}. 
            Пользователь назвал: ${input}. 
            Если это город, назови новый город на последнюю букву. Если нет, напиши "Это не город". 
            Ответ дай в формате JSON: {"city": "название", "reason": "..."}`;
            
            TypeTipBus.emit('SEND_PROMPT', prompt);
        }
    }
}