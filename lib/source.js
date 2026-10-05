'use strict';

/*
 * Ege SKS sayfasından menü dosyalarını bulur, indirir ve ayrıştırır.
 * NodeBB'ye bağımlı değildir: scripts/dene.js ile tek başına da çalışır.
 */

const crypto = require('crypto');
const { extractBlocks } = require('./extract');
const { parseMenu, classify } = require('./parser');

const LIST_URL = 'https://sksdb.ege.edu.tr/tr-8417/aylik_yemek_menuleri.html';
const USER_AGENT = 'EgeUniForum-Yemekhane/1.0 (+https://ege.uniforum.app)';
const TIMEOUT_MS = 30000;

async function request(url, headers = {}) {
	const res = await fetch(url, {
		headers: { 'User-Agent': USER_AGENT, ...headers },
		redirect: 'follow',
		signal: AbortSignal.timeout(TIMEOUT_MS),
	});
	return res;
}

function decodeHtml(buffer, contentType) {
	let charset = /charset=([\w-]+)/i.exec(contentType || '')?.[1];
	if (!charset) {
		const head = buffer.subarray(0, 4096).toString('latin1');
		charset = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1];
	}
	try {
		return new TextDecoder((charset || 'utf-8').toLowerCase()).decode(buffer);
	} catch (e) {
		return new TextDecoder('utf-8').decode(buffer);
	}
}

const NAMED = {
	nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>',
	Ouml: 'Ö', ouml: 'ö', Uuml: 'Ü', uuml: 'ü', Ccedil: 'Ç', ccedil: 'ç',
	Acirc: 'Â', acirc: 'â', Icirc: 'Î', icirc: 'î', Ucirc: 'Û', ucirc: 'û',
	Scedil: 'Ş', scedil: 'ş', Gbreve: 'Ğ', gbreve: 'ğ', Idot: 'İ', inodot: 'ı', imath: 'ı',
};

function stripTags(s) {
	return s.replace(/<[^>]*>/g, ' ')
		.replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
		.replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(Number(d)))
		.replace(/&([a-z]+);/gi, (m, n) => (NAMED[n] !== undefined ? NAMED[n] : m))
		.replace(/\s+/g, ' ').trim();
}

/** Sayfadaki .doc/.docx bağlantılarını bulur (dosya adlarını tahmin etmeden). */
function findMenuLinks(html, baseUrl = LIST_URL) {
	const links = [];
	const seen = new Set();
	const re = /<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
	let m;
	while ((m = re.exec(html))) {
		const href = m[1].trim();
		if (!/\.docx?(?:[?#]|$)/i.test(href)) continue;
		let url;
		try {
			url = new URL(href, baseUrl).href;
		} catch (e) {
			continue;
		}
		if (seen.has(url)) continue;
		seen.add(url);
		const text = stripTags(m[2]);
		const cls = classify(text);
		// Sadece yemek listeleri (fiyat vb. diğer belgeleri atla)
		if (!cls.meal && cls.diet === 'standart' && !/men[üu]|liste|yemek/i.test(text)) continue;
		links.push({ url, text });
	}
	return links;
}

async function listMenuLinks() {
	const res = await request(LIST_URL);
	if (!res.ok) throw new Error(`Liste sayfası alınamadı: HTTP ${res.status}`);
	const buf = Buffer.from(await res.arrayBuffer());
	return findMenuLinks(decodeHtml(buf, res.headers.get('content-type')));
}

/**
 * Tek bir dosyayı indirir ve ayrıştırır.
 * prev: { lastModified, hash } → değişmemişse { unchanged: true } döner.
 */
async function fetchMenu(link, prev = {}) {
	const headers = {};
	if (prev.lastModified) headers['If-Modified-Since'] = prev.lastModified;
	const res = await request(link.url, headers);
	if (res.status === 304) return { unchanged: true };
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const buffer = Buffer.from(await res.arrayBuffer());
	const hash = crypto.createHash('sha1').update(buffer).digest('hex');
	const lastModified = res.headers.get('last-modified') || null;
	if (prev.hash && prev.hash === hash) return { unchanged: true, hash, lastModified };

	const blocks = await extractBlocks(buffer);
	const menu = parseMenu(blocks, link.text);
	const problems = validate(menu);
	if (problems.length) {
		throw new Error(`Ayrıştırma şüpheli (${problems.join(', ')})`);
	}
	return { unchanged: false, hash, lastModified, menu };
}

function validate(menu) {
	const p = [];
	if (!menu.year || !menu.month) p.push('başlıkta yıl/ay bulunamadı');
	if (!menu.meal) p.push('öğün türü anlaşılamadı');
	const n = Object.keys(menu.days).length;
	if (n < 5) p.push(`yalnızca ${n} gün bulundu`);
	const empty = Object.values(menu.days).filter(d => !d.holiday && !d.items.length).length;
	if (empty > n / 2) p.push('günlerin çoğu boş');
	return p;
}

module.exports = { LIST_URL, listMenuLinks, findMenuLinks, fetchMenu, validate };
