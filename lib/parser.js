'use strict';

/*
 * Ege SKS aylık menü dosyalarını (takvim tablosu) günlere çevirir.
 * Bağımlılığı yoktur; extract.js'in ürettiği bloklarla çalışır.
 *
 * Çıktı:
 * {
 *   year: 2026, month: 10,
 *   meal: 'kahvalti' | 'ogle' | 'aksam',
 *   diet: 'standart' | 'vejetaryen' | 'vegan' | 'glutensiz' | 'salata',
 *   title: '2026 YILI EKİM AYI ÖĞLE VEGAN YEMEK LİSTESİ',
 *   days: { '1': { items: [...], kcal: 1470 }, '29': { holiday: true, label: 'RESMİ TATİL', items: [] } },
 *   note: 'Yukarıda belirtilen ... 110 kalori ilave edilmiştir.'
 * }
 */

const MONTHS = ['OCAK', 'SUBAT', 'MART', 'NISAN', 'MAYIS', 'HAZIRAN', 'TEMMUZ', 'AGUSTOS', 'EYLUL', 'EKIM', 'KASIM', 'ARALIK'];

/** Türkçe karakterleri sadeleştirip büyük harfe çevirir (eşleştirme için). */
function fold(s) {
	return String(s || '')
		.toLocaleUpperCase('tr')
		.replace(/[İI]/g, 'I').replace(/Ş/g, 'S').replace(/Ğ/g, 'G')
		.replace(/Ü/g, 'U').replace(/Ö/g, 'O').replace(/Ç/g, 'C')
		.replace(/Â/g, 'A').replace(/Î/g, 'I').replace(/Û/g, 'U');
}

/** Başlık / bağlantı metninden öğün ve diyet türünü bulur. */
function classify(text) {
	const t = fold(text);
	let meal = null;
	let diet = 'standart';
	if (/KAHVALTI/.test(t)) meal = 'kahvalti';
	else if (/AKSAM/.test(t)) meal = 'aksam';
	else if (/OGLE/.test(t)) meal = 'ogle';

	if (/VEGAN/.test(t)) diet = 'vegan';
	else if (/VEJ[EA]T[EA]RY[EA]N|VEGETARIAN/.test(t)) diet = 'vejetaryen';
	else if (/GLUTENSIZ|GLUTEN/.test(t)) diet = 'glutensiz';
	else if (/SALATA/.test(t)) diet = 'salata';

	// Salata listesi dosyalarında öğün yazmıyor; çorba + salata menüsü öğle servisinde.
	if (diet === 'salata' && !meal) meal = 'ogle';
	return { meal, diet };
}

/** "2026 YILI EKİM AYI ..." başlığını bulur. */
function findTitle(blocks) {
	const re = /(20\d{2})\s*YILI\s+([A-ZÇĞİIÖŞÜa-zçğıöşü]+)\s+AYI\b[^\n\t]*/i;
	for (const b of blocks) {
		const m = re.exec(b.text);
		if (m) {
			const monthIdx = MONTHS.indexOf(fold(m[2]));
			if (monthIdx >= 0) {
				return { title: m[0].trim().replace(/\s+/g, ' '), year: Number(m[1]), month: monthIdx + 1 };
			}
		}
	}
	return null;
}

const KCAL_RE = /(?:K?CAL|KALOR[İI])\s*[:.]?\s*(\d{3,5})\s*(?:k?cal)?|(\d{3,5})\s*k?cal\b/i;
const DAY_RE = /^\s*(\d{1,2})(?![\d])\s*(?:[-./)]\s*)?(.*)$/;
const HOLIDAY_RE = /TAT[İI]L|BAYRAM|KAPALI|SERV[İI]S YOK/i;
const WEEKDAY_FOLD = ['PAZARTESI', 'SALI', 'CARSAMBA', 'PERSEMBE', 'CUMA', 'CUMARTESI', 'PAZAR'];
const WEEKDAY_EN = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

function isHeaderLine(line) {
	const f = fold(line).replace(/[()/\s]+/g, ' ').trim();
	if (!f) return false;
	return f.split(' ').every(w => WEEKDAY_FOLD.includes(w) || WEEKDAY_EN.includes(w));
}

function isNoteLine(line) {
	return /ilave edilmi|Yukar[ıi]da belirtilen|ortalama kalori/i.test(line);
}

function cleanLine(s) {
	return s.replace(/ /g, ' ').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Tablo hangi günleri içeriyor? (Salata listesi sadece hafta içi.) */
function gridWeekdays(blocks) {
	const all = fold(blocks.map(b => b.text).join(' '));
	const has = idx => new RegExp(`\\b(${WEEKDAY_FOLD[idx]}|${WEEKDAY_EN[idx]})\\b`).test(all);
	const days = [0, 1, 2, 3, 4, 5, 6].filter(has);
	return days.length ? days : [0, 1, 2, 3, 4, 5, 6];
}

/** JS getDay() (0=Pazar) → 0=Pazartesi */
function weekdayMon0(year, month, day) {
	return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
}

function parseMenu(blocks, hint) {
	const head = findTitle(blocks);
	const cls = classify((head && head.title) || '');
	const hintCls = hint ? classify(hint) : { meal: null, diet: 'standart' };
	const meal = cls.meal || hintCls.meal;
	const diet = cls.diet !== 'standart' ? cls.diet : hintCls.diet;

	const year = head ? head.year : null;
	const month = head ? head.month : null;
	const daysInMonth = year ? new Date(Date.UTC(year, month, 0)).getUTCDate() : 31;
	const weekdays = gridWeekdays(blocks);

	const days = {};
	const notes = [];
	let lastDay = 0; // bir önceki gün numarası (tatil hücrelerinin tarihini bulmak için)
	let current = null; // .doc'ta bir hücre içindeki sekme karakteri hücreyi bölebilir

	const nextGridDay = (from) => {
		let d = from + 1;
		while (year && d <= daysInMonth && !weekdays.includes(weekdayMon0(year, month, d))) d += 1;
		return d;
	};

	for (const block of blocks) {
		const lines = block.text.split('\n').map(cleanLine).filter(Boolean);
		if (!lines.length) {
			current = null;
			continue;
		}

		// Tablo dışı not satırları (ekmek kalorisi vb.)
		const contentLines = [];
		for (const l of lines) {
			if (isNoteLine(l)) notes.push(l);
			else if (l.length <= 80) contentLines.push(l); // uzun satırlar kurum başlığı vb.
		}
		if (!contentLines.length) {
			current = null;
			continue;
		}
		if (block.type === 'p') {
			current = null;
			continue;
		}

		if (/^\s*20\d{2}\s*YILI/i.test(contentLines[0])) {
			current = null;
			continue;
		}
		const first = DAY_RE.exec(contentLines[0]);
		const dayNum = first ? Number(first[1]) : NaN;
		const looksLikeDay = first && dayNum >= 1 && dayNum <= daysInMonth &&
			(first[2] === '' || contentLines.length === 1 || /[A-ZÇĞİÖŞÜ]/.test(first[2]));

		let target = null;
		let rest = contentLines;
		if (looksLikeDay) {
			target = { items: [], kcal: null };
			days[dayNum] = target;
			lastDay = dayNum;
			rest = first[2] ? [first[2], ...contentLines.slice(1)] : contentLines.slice(1);
		} else if (contentLines.some(l => HOLIDAY_RE.test(l)) && contentLines.length <= 2 && lastDay) {
			const d = nextGridDay(lastDay);
			if (d <= daysInMonth) {
				days[d] = { holiday: true, label: contentLines.join(' '), items: [], kcal: null };
				lastDay = d;
			}
			current = null;
			continue;
		} else if (current) {
			target = current; // bölünmüş hücrenin devamı
		} else {
			// başlık hücresi, başlık paragrafı vb.
			continue;
		}

		for (const l of rest) {
			if (isHeaderLine(l)) continue;
			const k = KCAL_RE.exec(l);
			if (k) {
				target.kcal = Number(k[1] || k[2]);
				const leftover = cleanLine(l.replace(KCAL_RE, ''));
				if (leftover && !/^[/:.-]*$/.test(leftover)) target.items.push(leftover);
				continue;
			}
			if (/^[/:.\-–]+$/.test(l)) continue;
			target.items.push(l);
		}
		current = target;
	}

	// .doc'ta tablo dışı metin hücrelere karışabilir; son gün hücresine sızan başlık metnini temizle
	for (const d of Object.values(days)) {
		d.items = d.items.filter(i => !/EGE ÜN[İI]VERS[İI]TES[İI]|Daire Başkanlığı|Şube Müdürlüğü/i.test(i));
	}

	return {
		year,
		month,
		meal,
		diet,
		title: head ? head.title : null,
		days,
		note: [...new Set(notes)].join(' ') || null,
	};
}

const api = { parseMenu, classify, fold, findTitle };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else if (typeof window !== 'undefined') window.EgeMenuParser = api;
