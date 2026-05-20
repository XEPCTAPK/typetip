/**
 * @fileoverview Модуль локального хранения и распределенной облачной синхронизации данных TypeTip.
 * Обеспечивает персистентность локальной статистики игрока в изолированном хранилище VS Code,
 * а также отвечает за сетевое взаимодействие с GitHub Gist API для ведения кланового лидерборда.
 * * 符合 Google TypeScript СТИЛЬ ПРАВИЛ // ПОСТРОЧНОЕ КОММЕНТИРОВАНИЕ
 * © The 'Just Make It Work' Group Vibe Coding Enterprises Corporation; xepctapk (ц) //™
 */

import * as https from 'https';
import * as vscode from 'vscode';

export interface GameResult {
  score: number;
  cpm: number;
}

export interface ScoreEntry {
  username: string;
  score: number;
  cpm: number;
  date: number;
}

export interface PlayerStats {
  totalSessions: number;
  bestCpm: number;
  recentResults: GameResult[];
}

/** Глобальные неизменяемые конфигурационные константы подсистемы хранения. */
const STORAGE_CONFIG = {
  KEY_LOCAL_STATS: 'typetip_player_stats_v3',
  GIST_FILE_NAME: 'typetip_leaderboard.json',
  HTTP_USER_AGENT: 'TypeTip-Studio-Engine/3.0.0'
};

export class StorageManager {

  /**
   * Извлекает структурированную локальную статистику игрока из глобального стейта VS Code.
   * @param {vscode.ExtensionContext} context Контекст расширения.
   * @returns {PlayerStats} Обьект персональной статистики (всегда инициализирован).
   */
  public static loadLocalStats(context: vscode.ExtensionContext): PlayerStats {
    const raw = context.globalState.get<string>(STORAGE_CONFIG.KEY_LOCAL_STATS);
    if (!raw) {
      return { totalSessions: 0, bestCpm: 0, recentResults: [] };
    }
    try {
      return JSON.parse(raw) as PlayerStats;
    } catch {
      return { totalSessions: 0, bestCpm: 0, recentResults: [] };
    }
  }

  /**
   * Асинхронно сохраняет результат игры, обновляет рекорды и пушит данные в GitHub Gist.
   * @returns {Promise<boolean>} True, если сетевой пуш завершился успехом.
   */
  public static async saveGameResultAndPushGist(
    context: vscode.ExtensionContext,
    githubToken: string,
    gistId: string,
    username: string,
    score: number,
    cpm: number
  ): Promise<boolean> {
    // 1. Атомарно обновляем локальный кэш на диске машины
    const stats = this.loadLocalStats(context);
    stats.totalSessions += 1;
    if (cpm > stats.bestCpm) {
      stats.bestCpm = cpm;
    }
    stats.recentResults.push({ score, cpm });
    
    // Держим в истории только последние 20 сессий, чтобы не раздувать стейт
    if (stats.recentResults.length > 20) {
      stats.recentResults.shift();
    }
    
    await context.globalState.update(STORAGE_CONFIG.KEY_LOCAL_STATS, JSON.stringify(stats));

    // Валидация сетевых параметров перед запуском сетевого стрима
    if (!githubToken || !gistId) {
      return false;
    }

    // 2. Выгружаем текущий глобальный лидерборд из облака для слияния данных
    const currentTop = await this.fetchGlobalLeaderboard(gistId);
    
    // Подмешиваем новый результат текущего раунда
    currentTop.push({
      username: username || 'Anonymous Vibe Coder',
      score,
      cpm,
      date: Date.now()
    });

    // Сортируем по CPM (от высшего к низшему) и берем топ-100 рекордов
    const updatedTop = currentTop
      .sort((a, b) => b.cpm - a.cpm)
      .slice(0, 100);

    // 3. Отправляем PATCH запрос на серверы GitHub API
    return this.patchGistFile(gistId, githubToken, updatedTop);
  }

  /**
   * Загружает глобальный список рекордов из GitHub Gist без авторизации (Публичный GET запрос).
   * @param {string} gistId Хеш-идентификатор гиста.
   * @returns {Promise<ScoreEntry[]>} Массив рекордов.
   */
  public static async fetchGlobalLeaderboard(gistId: string): Promise<ScoreEntry[]> {
    if (!gistId) {
      return [];
    }

    return new Promise((resolve) => {
      const options = {
        hostname: 'api.github.com',
        path: `/gists/${gistId}`,
        method: 'GET',
        headers: { 'User-Agent': STORAGE_CONFIG.HTTP_USER_AGENT }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          if (res.statusCode !== 200) {
            resolve([]);
            return;
          }
          try {
            const gistData = JSON.parse(body);
            const file = gistData.files[STORAGE_CONFIG.GIST_FILE_NAME];
            if (!file || !file.content) {
              resolve([]);
              return;
            }
            resolve(JSON.parse(file.content) as ScoreEntry[]);
          } catch {
            resolve([]);
          }
        });
      });

      req.on('error', () => resolve([]));
      req.end();
    });
  }

  /**
   * Низкоуровневая отправка PATCH-пакета для обновления содержимого Gist файла.
   */
  private static async patchGistFile(gistId: string, githubToken: string, updatedTop: ScoreEntry[]): Promise<boolean> {
    try {
      const payload = JSON.stringify({
        files: {
          [STORAGE_CONFIG.GIST_FILE_NAME]: {
            content: JSON.stringify(updatedTop, null, 2)
          }
        }
      });

      return new Promise((resolve) => {
        const options = {
          hostname: 'api.github.com',
          path: `/gists/${gistId}`,
          method: 'PATCH',
          headers: {
            'User-Agent': STORAGE_CONFIG.HTTP_USER_AGENT,
            'Authorization': `token ${githubToken}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          }
        };

        const req = https.request(options, (res) => {
          resolve(res.statusCode === 200);
        });

        req.on('error', () => resolve(false));
        req.write(payload);
        req.end();
      });
    } catch {
      return false;
    }
  }
}