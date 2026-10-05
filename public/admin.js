'use strict';

define('admin/plugins/ege-yemekhane', ['api', 'alerts'], function (api, alerts) {
	const ACP = {};
	ACP.init = function () {
		$('#ege-yemekhane-refresh').on('click', function () {
			const btn = $(this).prop('disabled', true);
			api.post('/plugins/ege-yemekhane/refresh', {}).then(function (r) {
				const msg = r.changed.length ? 'Güncellenen: ' + r.changed.join(', ') : 'Değişiklik yok.';
				if (r.errors.length) alerts.warning(msg + ' Hatalar: ' + r.errors.join(' | '));
				else alerts.success(msg);
				ajaxify.refresh();
			}).catch(alerts.error).finally(function () { btn.prop('disabled', false); });
		});
	};
	return ACP;
});
