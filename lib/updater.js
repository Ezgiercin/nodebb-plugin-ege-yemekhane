'use strict';

const winston = require.main.require('winston');
const source = require('./source');
const store = require('./store');

const INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 saatte bir kontrol
let running = null;
let timer = null;

async function run() {
	if (running) return running; // aynı anda iki güncelleme olmasın
	running = (async () => {
		const status = { lastRun: Date.now() };
		const changed = [];
		const errors = [];
		try {
			const links = await source.listMenuLinks();
			if (!links.length) throw new Error('Sayfada menü dosyası bulunamadı (sayfa yapısı değişmiş olabilir)');

			for (const link of links) {
				const prev = await store.getSource(link.url);
				try {
					const r = await source.fetchMenu(link, prev);
					if (r.unchanged) {
						if (r.lastModified && r.lastModified !== prev.lastModified) {
							await store.setSource(link.url, { ...prev, lastModified: r.lastModified, error: null });
						}
						continue;
					}
					const key = await store.saveMenu(r.menu, link.url);
					await store.setSource(link.url, { hash: r.hash, lastModified: r.lastModified, key, error: null });
					changed.push(`${key} ${r.menu.meal}:${r.menu.diet}`);
				} catch (err) {
					errors.push(`${link.text}: ${err.message}`);
					// hatalı dosyanın hash'ini kaydetme → bir sonraki turda tekrar denenir
					await store.setSource(link.url, { ...prev, error: err.message });
				}
			}
			await store.prune();
			status.lastSuccess = Date.now();
		} catch (err) {
			errors.push(err.message);
		}
		status.changed = changed.join(', ');
		status.lastError = errors.join(' | ');
		await store.setStatus(status);
		if (changed.length) winston.info(`[ege-yemekhane] güncellendi: ${status.changed}`);
		if (errors.length) winston.warn(`[ege-yemekhane] hatalar: ${status.lastError}`);
		return { changed, errors };
	})();
	try {
		return await running;
	} finally {
		running = null;
	}
}

function start() {
	if (timer) return;
	setTimeout(() => run().catch(err => winston.error(`[ege-yemekhane] ${err.stack}`)), 15 * 1000);
	timer = setInterval(() => run().catch(err => winston.error(`[ege-yemekhane] ${err.stack}`)), INTERVAL_MS);
}

module.exports = { run, start };
