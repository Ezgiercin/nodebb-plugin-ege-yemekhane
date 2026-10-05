'use strict';

/*
 * /yemekhane sayfası.
 * - Öğün seçimi (Kahvaltı / Öğle / Akşam) her girişte "Öğle" ile başlar; saate göre değişmez.
 * - Diyet seçenekleri seçilen öğünde gerçekten bulunan listelerden oluşur
 *   (ör. kahvaltıda vegan/glutensiz liste yoksa o seçenekler hiç görünmez).
 * - Seçimler hatırlanmaz: her girişte Standart menüyle açılır.
 */

define('forum/yemekhane', [], function () {
	const Page = {};

	const MEALS = [
		{ id: 'kahvalti', label: 'Kahvaltı', icon: 'fa-mug-hot' },
		{ id: 'ogle', label: 'Öğle', icon: 'fa-sun' },
		{ id: 'aksam', label: 'Akşam', icon: 'fa-moon' },
	];
	const DIETS = [
		{ id: 'standart', label: 'Standart' },
		{ id: 'vejetaryen', label: 'Vejetaryen' },
		{ id: 'vegan', label: 'Vegan' },
		{ id: 'glutensiz', label: 'Glutensiz' },
		{ id: 'salata', label: 'Salata Menüsü' },
	];
	const MONTH_NAMES = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
	const DAY_NAMES = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
	const DAY_SHORT = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

	// Ege listelerindeki kısaltmalar (gerekirse buraya ekleyin)
	const ABBR = [
		[/\bP\.\s*ÜSTÜ(?=\s|$)/g, 'PİLAV ÜSTÜ'],
		[/\bFES\.\s*SOS\./g, 'FESLEĞEN SOSLU'],
		[/\bNAP\.\s*SOS\./g, 'NAPOLİTEN SOSLU'],
		[/\bZ\.\s*Y\./g, 'ZEYTİNYAĞLI'],
		[/\bK\.\s*MERCİMEK/g, 'KIRMIZI MERCİMEK'],
		[/\bY\.\s*MERCİMEK/g, 'YEŞİL MERCİMEK'],
		[/\bTER\./g, 'TEREYAĞLI'],
		[/(^|\s)ŞEH\./g, 'ŞEHRİYELİ'],
		[/\bFIR\./g, 'FIRIN'],
		[/\bGAR\./g, 'GARNİTÜRLÜ'],
		[/\bKR\./g, 'KREMALI'],
		[/(^|\s)YOĞ\./g, 'YOĞURTLU'],
		[/\bSEB\./g, 'SEBZELİ'],
		[/\bCEV\.?(?=\s)/g, 'CEVİZLİ'],
		[/(^|\s)PÜR\./g, 'PÜRELİ'],
		[/\bKIY\./g, 'KIYMALI'],
		[/\bDOM\./g, 'DOMATESLİ'],
		[/\bKAHV\./g, 'KAHVALTILIK'],
		[/\bKAR\./g, 'KARIŞIK'],
		[/\bSOS\./g, 'SOSLU'],
	];

	function prettify(raw) {
		let s = ' ' + String(raw) + ' ';
		ABBR.forEach(function (pair) {
			s = s.replace(pair[0], function () {
				const lead = /^\s/.test(arguments[0]) ? ' ' : '';
				return lead + pair[1] + ' ';
			});
		});
		s = s.replace(/\s+/g, ' ').trim().toLocaleLowerCase('tr');
		// Her kelimenin ilk harfi büyük (Türkçe kurallarıyla)
		return s.replace(/(^|[\s\-(/])(\S)/g, function (m, sep, ch) { return sep + ch.toLocaleUpperCase('tr'); });
	}

	function esc(s) {
		return String(s).replace(/[&<>"']/g, function (c) {
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
		});
	}

	function parseISO(iso) {
		const p = iso.split('-').map(Number);
		return new Date(Date.UTC(p[0], p[1] - 1, p[2]));
	}
	function toISO(d) {
		return d.toISOString().slice(0, 10);
	}
	function addDays(iso, n) {
		const d = parseISO(iso);
		d.setUTCDate(d.getUTCDate() + n);
		return toISO(d);
	}
	function monthKeyOf(iso) { return iso.slice(0, 7); }

	let data;
	let state;
	let $root;

	function menuFor(iso, meal, diet) {
		const month = data.months[monthKeyOf(iso)];
		const list = month && month[meal] && month[meal][diet];
		if (!list) return { status: 'missing-list' };
		const day = list.days[String(Number(iso.slice(8, 10)))];
		if (!day) return { status: 'no-service' };
		if (day.holiday) return { status: 'holiday', label: day.label };
		return { status: 'ok', items: day.items };
	}

	/** Seçilen öğünde (ve seçili ayda) hangi diyet listeleri var? */
	function dietsFor(meal) {
		const month = data.months[monthKeyOf(state.date)] || {};
		const available = month[meal] || {};
		return DIETS.filter(function (d) { return available[d.id]; });
	}

	function dayCard(iso, label) {
		const d = parseISO(iso);
		const isToday = iso === data.today;
		const m = menuFor(iso, state.meal, state.diet);
		let body;
		if (m.status === 'ok') {
			body = '<ul class="list-unstyled mb-0 ey-items">' + m.items.map(function (i) {
				return '<li title="' + esc(i) + '">' + esc(prettify(i)) + '</li>';
			}).join('') + '</ul>';
		} else if (m.status === 'holiday') {
			body = '<div class="ey-empty"><i class="fa fa-calendar-xmark"></i> ' + esc(prettify(m.label || 'Resmi tatil')) + '</div>';
		} else if (m.status === 'no-service') {
			body = '<div class="ey-empty">Bu gün için bu menü yok.</div>';
		} else {
			body = '<div class="ey-empty">Bu ayın listesi henüz yayınlanmadı.</div>';
		}
		return '<div class="col-12 col-md-6 ey-day">' +
			'<div class="ey-day-label">' + esc(label) + '</div>' +
			'<div class="ey-day-date ' + (isToday ? 'is-today' : '') + '">' + d.getUTCDate() + ' ' + MONTH_NAMES[d.getUTCMonth()] + ' ' + d.getUTCFullYear() + '</div>' +
			'<div class="ey-day-name">' + DAY_NAMES[d.getUTCDay()] + '</div>' +
			body +
			'</div>';
	}

	function render() {
		const diets = dietsFor(state.meal);
		if (!diets.some(function (d) { return d.id === state.diet; })) state.diet = 'standart';

		const sel = parseISO(state.date);
		const monthLabel = MONTH_NAMES[sel.getUTCMonth()] + ' ' + sel.getUTCFullYear();
		const nextIso = addDays(state.date, 1);

		// Ay içi gün şeridi
		const first = new Date(Date.UTC(sel.getUTCFullYear(), sel.getUTCMonth(), 1));
		const daysInMonth = new Date(Date.UTC(sel.getUTCFullYear(), sel.getUTCMonth() + 1, 0)).getUTCDate();
		let strip = '';
		for (let i = 0; i < daysInMonth; i++) {
			const d = new Date(first.getTime() + i * 86400000);
			const iso = toISO(d);
			const cls = ['ey-strip-day'];
			if (iso === state.date) cls.push('active');
			if (iso === data.today) cls.push('today');
			if (d.getUTCDay() === 0 || d.getUTCDay() === 6) cls.push('weekend');
			strip += '<button type="button" class="' + cls.join(' ') + '" data-date="' + iso + '">' +
				'<span>' + DAY_SHORT[d.getUTCDay()] + '</span><strong>' + d.getUTCDate() + '</strong></button>';
		}

		const prevMonth = toISO(new Date(Date.UTC(sel.getUTCFullYear(), sel.getUTCMonth() - 1, 1)));
		const nextMonth = toISO(new Date(Date.UTC(sel.getUTCFullYear(), sel.getUTCMonth() + 1, 1)));
		const hasPrev = !!data.months[monthKeyOf(prevMonth)];
		const hasNext = !!data.months[monthKeyOf(nextMonth)];

		const html =
			'<div class="ey-card">' +
				'<div class="ey-header">' +
					'<div class="d-flex align-items-center gap-3">' +
						'<div class="ey-logo"><i class="fa fa-utensils"></i></div>' +
						'<div><h1 class="ey-title">Yemekhane</h1><div class="ey-sub">Ege Üniversitesi · ' + monthLabel + '</div></div>' +
					'</div>' +
					'<div class="ey-meals" role="tablist">' + MEALS.map(function (m) {
						return '<button type="button" role="tab" class="ey-meal' + (m.id === state.meal ? ' active' : '') + '" data-meal="' + m.id + '" aria-selected="' + (m.id === state.meal) + '">' +
							'<i class="fa ' + m.icon + '"></i> ' + m.label + '</button>';
					}).join('') + '</div>' +
				'</div>' +
				'<div class="ey-toolbar">' +
					(diets.length > 1 ? '<div class="ey-diets">' + diets.map(function (d) {
						return '<button type="button" class="ey-diet' + (d.id === state.diet ? ' active' : '') + '" data-diet="' + d.id + '">' + d.label + '</button>';
					}).join('') + '</div>' : '') +
					'<div class="ey-strip-wrap">' +
						'<button type="button" class="ey-nav" data-month="' + prevMonth + '"' + (hasPrev ? '' : ' disabled') + ' aria-label="Önceki ay"><i class="fa fa-chevron-left"></i></button>' +
						'<div class="ey-strip">' + strip + '</div>' +
						'<button type="button" class="ey-nav" data-month="' + nextMonth + '"' + (hasNext ? '' : ' disabled') + ' aria-label="Sonraki ay"><i class="fa fa-chevron-right"></i></button>' +
					'</div>' +
				'</div>' +
				'<div class="row g-0 ey-days">' +
					dayCard(state.date, state.date === data.today ? 'BUGÜN' : 'SEÇİLEN GÜN') +
					dayCard(nextIso, state.date === data.today ? 'YARIN' : 'ERTESİ GÜN') +
				'</div>' +
				'<div class="ey-foot">Kaynak: <a href="' + esc(data.source) + '" target="_blank" rel="noopener">Ege Üniversitesi SKS aylık yemek listeleri</a></div>' +
			'</div>';

		$root.html(html);
		const active = $root.find('.ey-strip-day.active')[0];
		if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest', inline: 'center' });
	}

	Page.init = function () {
		$root = $('#ege-yemekhane');
		data = ajaxify.data.yemekhane || { months: {}, today: toISO(new Date()) };
		// Her girişte sıfırdan: Öğle + Standart + bugün
		state = { meal: 'ogle', diet: 'standart', date: data.today };

		$root.off('click.ey')
			.on('click.ey', '[data-meal]', function () { state.meal = $(this).attr('data-meal'); render(); })
			.on('click.ey', '[data-diet]', function () { state.diet = $(this).attr('data-diet'); render(); })
			.on('click.ey', '[data-date]', function () { state.date = $(this).attr('data-date'); render(); })
			.on('click.ey', '[data-month]', function () {
				const target = $(this).attr('data-month');
				state.date = monthKeyOf(target) === monthKeyOf(data.today) ? data.today : target;
				render();
			});
		render();
	};

	Page._prettify = prettify; // test için
	return Page;
});
