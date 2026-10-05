'use strict';

/*
 * NodeBB veritabanı katmanı.
 *  ege-yemekhane:months            sorted set   (score: YYYYMM, value: 'YYYY-MM')
 *  ege-yemekhane:month:YYYY-MM     hash         alan 'ogle:vegan' → JSON { days, title, source, updatedAt }
 *  ege-yemekhane:sources           hash         alan url → JSON { hash, lastModified, key, error }
 *  ege-yemekhane:status            hash         lastRun, lastSuccess, lastError, changed
 */

const db = require.main.require('./src/database');

const PREFIX = 'ege-yemekhane';

function monthKey(year, month) {
	return `${year}-${String(month).padStart(2, '0')}`;
}

async function getSource(url) {
	const raw = await db.getObjectField(`${PREFIX}:sources`, url);
	try {
		return raw ? JSON.parse(raw) : {};
	} catch (e) {
		return {};
	}
}

async function setSource(url, data) {
	await db.setObjectField(`${PREFIX}:sources`, url, JSON.stringify(data));
}

async function saveMenu(menu, sourceUrl) {
	const key = monthKey(menu.year, menu.month);
	await db.setObjectField(`${PREFIX}:month:${key}`, `${menu.meal}:${menu.diet}`, JSON.stringify({
		title: menu.title,
		// Kalori gösterilmiyor: sadece yemekler ve tatil bilgisi saklanır
		days: Object.fromEntries(Object.entries(menu.days).map(([d, v]) => [d, v.holiday ? { holiday: true, label: v.label } : { items: v.items }])),
		source: sourceUrl,
		updatedAt: Date.now(),
	}));
	await db.sortedSetAdd(`${PREFIX}:months`, menu.year * 100 + menu.month, key);
	return key;
}

/** { 'YYYY-MM': { ogle: { standart: {...}, vegan: {...} }, aksam: {...} } } */
async function getMonths(keys) {
	const objs = await db.getObjects(keys.map(k => `${PREFIX}:month:${k}`));
	const out = {};
	keys.forEach((k, i) => {
		const obj = objs[i];
		if (!obj) return;
		const meals = {};
		for (const [field, json] of Object.entries(obj)) {
			const [meal, diet] = field.split(':');
			if (!meal || !diet) continue;
			try {
				meals[meal] = meals[meal] || {};
				meals[meal][diet] = JSON.parse(json);
			} catch (e) { /* bozuk kayıt: atla */ }
		}
		if (Object.keys(meals).length) out[k] = meals;
	});
	return out;
}

async function setStatus(status) {
	await db.setObject(`${PREFIX}:status`, status);
}

async function getStatus() {
	return (await db.getObject(`${PREFIX}:status`)) || {};
}

/** Çok eski ayları siler (varsayılan: son 6 ay kalır). */
async function prune(keepMonths = 6) {
	const all = await db.getSortedSetRange(`${PREFIX}:months`, 0, -1);
	const old = all.slice(0, Math.max(0, all.length - keepMonths));
	if (!old.length) return;
	await db.deleteAll(old.map(k => `${PREFIX}:month:${k}`));
	await db.sortedSetRemove(`${PREFIX}:months`, old);
}

module.exports = { monthKey, getSource, setSource, saveMenu, getMonths, setStatus, getStatus, prune };
