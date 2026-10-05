'use strict';

const nconf = require.main.require('nconf');
const routeHelpers = require.main.require('./src/routes/helpers');

const store = require('./lib/store');
const updater = require('./lib/updater');

const plugin = {};
const TZ = 'Europe/Istanbul';

function istanbulToday() {
	// 'YYYY-MM-DD' (en-CA biçimi)
	return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function shiftMonth(year, month, delta) {
	const d = new Date(Date.UTC(year, month - 1 + delta, 1));
	return store.monthKey(d.getUTCFullYear(), d.getUTCMonth() + 1);
}

plugin.init = async ({ router, middleware }) => {
	routeHelpers.setupPageRoute(router, '/yemekhane', [], async (req, res) => {
		const today = istanbulToday();
		const [y, m] = today.split('-').map(Number);
		const keys = [shiftMonth(y, m, -1), shiftMonth(y, m, 0), shiftMonth(y, m, 1)];
		const months = await store.getMonths(keys);
		res.render('yemekhane', {
			title: 'Yemekhane',
			breadcrumbs: [{ text: 'Yemekhane' }],
			yemekhane: { today, months, source: 'https://sksdb.ege.edu.tr/tr-8417/aylik_yemek_menuleri.html' },
		});
	});

	routeHelpers.setupAdminPageRoute(router, '/admin/plugins/ege-yemekhane', [], async (req, res) => {
		const status = await store.getStatus();
		const fmt = ts => (ts ? new Date(Number(ts)).toLocaleString('tr-TR', { timeZone: TZ }) : '—');
		res.render('admin/plugins/ege-yemekhane', {
			title: 'Ege Yemekhane',
			lastRun: fmt(status.lastRun),
			lastSuccess: fmt(status.lastSuccess),
			changed: status.changed || '—',
			lastError: status.lastError || '',
		});
	});

	// Birden fazla NodeBB süreci varsa güncelleyiciyi yalnızca biri çalıştırır
	if (nconf.get('runJobs')) {
		updater.start();
	}
};

plugin.addApiRoutes = async ({ router, middleware, helpers }) => {
	routeHelpers.setupApiRoute(router, 'post', '/ege-yemekhane/refresh',
		[middleware.ensureLoggedIn, middleware.admin.checkPrivileges],
		async (req, res) => {
			const result = await updater.run();
			helpers.formatApiResponse(200, res, result);
		});
};

// ACP → Ayarlar → Navigasyon listesinde "Yemekhane" seçeneği olarak çıkar
plugin.addNavigation = async (items) => {
	items.push({
		route: '/yemekhane',
		title: 'Yemekhane',
		enabled: false,
		iconClass: 'fa-utensils',
		textClass: 'd-lg-none',
		text: 'Yemekhane',
	});
	return items;
};

plugin.addAdminNavigation = async (header) => {
	header.plugins.push({ route: '/plugins/ege-yemekhane', icon: 'fa-utensils', name: 'Ege Yemekhane' });
	return header;
};

module.exports = plugin;
