# nodebb-plugin-ege-yemekhane

Ege Üniversitesi SKS'nin aylık yemek listelerini otomatik olarak çeker ve forumda **/yemekhane** sayfasında gösterir.

## Neler yapar?

- **Otomatik güncelleme:** [SKS aylık yemek menüleri](https://sksdb.ege.edu.tr/tr-8417/aylik_yemek_menuleri.html) sayfasını açılışta ve sonra **6 saatte bir** kontrol eder.
  - Bulduğu `.doc` / `.docx` dosyalarını indirir. Dosya değişmediyse tekrar okumaz (`If-Modified-Since` + SHA-1 karşılaştırması).
  - Dosya adlarını tahmin etmez, çünkü Ege her ay farklı yazıyor (`eylogle.docx`, `ekimog.docx` gibi). Bağlantıları sayfadan bulur.
  - Öğün, diyet ve ayı dosyanın içindeki "2026 YILI EKİM AYI ÖĞLE VEGAN YEMEK LİSTESİ" başlığından anlar.
  - Resmî tatil hücrelerine ("RESMİ TATİL") gün numarası yazılmıyor. Eklenti bu günlerin tarihini tablodaki sıradan hesaplar.
  - Bir dosya bozuk ya da tuhaf görünürse eski veri silinmez. Hata ACP'de görünür ve bir sonraki turda o dosya yeniden denenir.
- **Sayfa:**
  - Öğün sekmeleri: Kahvaltı / Öğle / Akşam. Saate göre değişmez; her girişte Öğle ile açılır.
  - Diyet seçenekleri yalnızca seçilen öğünde gerçekten liste varsa görünür. Bugün itibarıyla:
    - Kahvaltı: yalnızca standart liste (seçenek satırı gizli).
    - Öğle: Standart, Vejetaryen, Vegan, Glutensiz, Salata Menüsü.
    - Akşam: Standart, Vejetaryen, Vegan, Glutensiz.
  - Seçimler hatırlanmaz; her girişte Standart ile açılır.
  - Gün şeridiyle ay içinde gezinilir; önceki/sonraki ay okları da var. Seçilen gün ve ertesi gün yan yana gösterilir (mobilde alt alta).
  - Kalori gösterilmez. Dosyalardaki `CAL: … kcal` satırları ayıklanır.
  - Kısaltmalar açılır (`Z.Y.` → Zeytinyağlı, `P. ÜSTÜ` → Pilav Üstü …). Liste `public/yemekhane.js` içindeki `ABBR` dizisindedir. Fareyle üzerine gelince orijinal yazım görünür.

## Kurulum

```bash
# NodeBB klasöründe
npm install /yol/nodebb-plugin-ege-yemekhane   # ya da git reposundan
./nodebb build
./nodebb restart
```

1. **ACP → Eklentiler** → "Ege Yemekhane" eklentisini etkinleştirin, ardından build + restart yapın.
2. **ACP → Ayarlar → Navigasyon** → "Yemekhane" öğesini ekleyip kaydedin. Sol menüde 🍴 Yemekhane olarak görünür.
3. **ACP → Eklentiler → Ege Yemekhane** → son kontrol zamanını ve hataları burada görürsünüz. "Şimdi güncelle" ile elle tetikleyebilirsiniz.

İlk veri açılıştan yaklaşık 15 saniye sonra çekilir.

## NodeBB olmadan deneme

```bash
npm install
node scripts/dene.js                  # Ege sayfasındaki tüm listeleri indirip özet basar
node scripts/dene.js ekimog.docx --json   # tek dosya
```

Ege sayfasının yapısı değişirse önce bununla kontrol edin.

## Dosyalar

| Dosya | Görev |
|---|---|
| `lib/extract.js` | `.docx` (XML) ve `.doc` (Word 97, `word-extractor`) dosyalarından hücre metinleri |
| `lib/parser.js` | Takvim tablosu → `{ gün: { items } }`; öğün/diyet tespiti; tatil günleri |
| `lib/source.js` | Ege sayfasından bağlantıları bulma, indirme, doğrulama |
| `lib/store.js` | NodeBB veritabanı (`ege-yemekhane:*` anahtarları, son 6 ay tutulur) |
| `lib/updater.js` | 6 saatlik zamanlayıcı (çok süreçli kurulumda yalnızca `runJobs` olan süreç) |
| `library.js` | `/yemekhane` sayfası, ACP sayfası, navigasyon, `POST /api/v3/plugins/ege-yemekhane/refresh` |
| `public/yemekhane.js`, `.scss` | Arayüz |

## Notlar

- **Salata listesinde öğün yazmıyor.** Hafta içi "Günün çorbası + salata" menüsü olduğu için Öğle altında "Salata Menüsü" olarak gösterilir.
- **Ege'nin klasör adı hâlâ `2025YEMEK`**, ama içerik 2026. Klasör adına güvenilmiyor; tarih dosya başlığından okunuyor.
