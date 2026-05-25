//* Наборы для подсветки событий

import * as vscode from 'vscode';

// === [БЛОК 1: СТИЛЬ ПРАВИЛЬНОГО ВВОДА] ===
// Ядовито-зеленый неон. Кастомный CSS со свечением внедряем через хак в textDecoration.
export const successDecoration = vscode.window.createTextEditorDecorationType({
    color: '#39ff14', 
    fontWeight: 'bold',
    // Трюк: закрываем дефолтный textDecoration и пишем чистый CSS для тени
    textDecoration: 'none; text-shadow: 0 0 8px rgba(57, 255, 20, 0.75), 0 0 15px rgba(57, 255, 20, 0.5);'
});


// === [БЛОК 2: СТИЛЬ ОШИБОЧНОГО ВВОДА] ===
// Ядовито-розовый неон с подложкой. Ошибки подсвечиваются аналогичным CSS-хаком.
export const errorDecoration = vscode.window.createTextEditorDecorationType({
    color: '#ff007f', 
    backgroundColor: 'rgba(255, 0, 127, 0.2)', 
    fontWeight: 'bold',
    // Трюк: прокидываем text-shadow в обход строгой типизации компилятора
    textDecoration: 'none; text-shadow: 0 0 8px rgba(255, 0, 127, 0.75), 0 0 15px rgba(255, 0, 127, 0.5);'
});