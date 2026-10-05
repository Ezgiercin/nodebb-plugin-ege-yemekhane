'use strict';

/*
 * NodeBB'den bağımsız deneme:  node scripts/dene.js
 * Ege sayfasındaki tüm listeleri indirir, ayrıştırır ve özet basar.
 * Tek dosya için:              node scripts/dene.js ./ekimog.docx
 */

const fs = require('fs');
const { listMenuLinks, fetchMenu, validate } = require('../lib/source');
const { extractBlocks } = require('../lib/extract');
const { parseMenu } = require('../lib/parser');

function summary(menu) {
	const days = Object.keys(menu.days).map(Number).sort((a, b) => a - b);
	const hol = days.filter(d => menu.days[d].holiday);
	const sample = menu.days[days.find(d => !menu.days[d].holiday)];
	return `${menu.year}-${menu.month} ${menu.meal}:${menu.diet} → ${days.length} gün` +
		(hol.length ? `, tatil: ${hol.join(',')}` : '') +
		`\n    örnek: ${sample ? sample.items.join(' | ') : '-'}`;
}

(async () => {
	const file = process.argv[2];
	if (file) {
		const menu = parseMenu(await extractBlocks(fs.readFileSync(file)), file);
		console.log(summary(menu));
		const p = validate(menu);
		if (p.length) console.log('  UYARI:', p.join(', '));
		if (process.argv.includes('--json')) console.log(JSON.stringify(menu, null, 2));
		return;
	}
	const links = await listMenuLinks();
	console.log(`${links.length} liste bulundu`);
	for (const link of links) {
		try {
			const r = await fetchMenu(link);
			console.log(`✓ ${link.text}\n    ${summary(r.menu)}`);
		} catch (err) {
			console.log(`✗ ${link.text}: ${err.message}`);
		}
	}
})().catch((err) => { console.error(err); process.exit(1); });
