'use strict';

/*
 * Word dosyalarından düz metin "blok"ları çıkarır.
 * Her iki format için ortak çıktı: [{ type: 'p' | 'cell', text }]
 *  - Bir hücre içindeki paragraflar '\n' ile ayrılır.
 *  - .doc (Word 97) için hücre sınırları '\t' olarak gelir; boş hücreler boş metin olur.
 */

const JSZip = require('jszip');
const WordExtractor = require('word-extractor');

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function decodeXml(s) {
	return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => {
		if (e[0] === '#') {
			const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
			return String.fromCodePoint(code);
		}
		return ENTITIES[e.toLowerCase()] || m;
	});
}

/** document.xml içeriğini bloklara çevirir (tablolar düzleştirilir). */
function blocksFromDocumentXml(xml) {
	const blocks = [];
	const tagRe = /<(\/?)w:(tbl|tc|p|t|tab|br|cr)(?=[\s>/])([^>]*?)(\/?)>|([^<]+)|<[^>]*>/g;
	let tblDepth = 0;
	let inText = false;
	let para = null; // geçerli paragrafın metni
	const paraStack = []; // metin kutuları iç içe paragraf içerebilir
	let cell = null; // geçerli hücredeki paragraflar
	let m;
	while ((m = tagRe.exec(xml))) {
		const [, close, name, , selfClose, text] = m;
		if (text !== undefined) {
			if (inText && para !== null) para += decodeXml(text);
			continue;
		}
		if (!name) continue;
		if (name === 'tbl') {
			tblDepth += close ? -1 : 1;
		} else if (name === 'tc') {
			if (!close) {
				cell = [];
			} else if (cell) {
				blocks.push({ type: 'cell', text: cell.join('\n') });
				cell = null;
			}
		} else if (name === 'p') {
			if (selfClose) {
				if (cell) cell.push('');
			} else if (!close) {
				if (para !== null) paraStack.push(para);
				para = '';
			} else if (para !== null) {
				if (cell && tblDepth > 0) cell.push(para);
				else blocks.push({ type: 'p', text: para });
				para = paraStack.length ? paraStack.pop() : null;
			}
		} else if (name === 't') {
			inText = !close && !selfClose;
		} else if ((name === 'tab' || name === 'br' || name === 'cr') && para !== null && !close) {
			para += name === 'tab' ? ' ' : '\n';
		}
	}
	return blocks;
}

async function blocksFromDocx(buffer) {
	const zip = await JSZip.loadAsync(buffer);
	const file = zip.file('word/document.xml');
	if (!file) throw new Error('docx içinde word/document.xml bulunamadı');
	return blocksFromDocumentXml(await file.async('string'));
}

async function blocksFromDoc(buffer) {
	const doc = await new WordExtractor().extract(buffer);
	const body = doc.getBody().replace(/\r\n?/g, '\n');
	// word-extractor tablo hücrelerini '\t' ile ayırır.
	return body.split('\t').map(text => ({ type: 'cell', text }));
}

/** Dosyanın gerçek biçimini içerikten anlar (uzantıya güvenmeden). */
function sniff(buffer) {
	if (buffer[0] === 0x50 && buffer[1] === 0x4b) return 'docx'; // ZIP
	if (buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0) return 'doc'; // OLE
	return null;
}

async function extractBlocks(buffer) {
	const kind = sniff(buffer);
	if (kind === 'docx') return blocksFromDocx(buffer);
	if (kind === 'doc') return blocksFromDoc(buffer);
	throw new Error('Tanınmayan dosya biçimi (doc/docx değil)');
}

module.exports = { extractBlocks, blocksFromDocumentXml, sniff };
