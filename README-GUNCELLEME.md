# Ata74 - GitHub guncelleme sistemi

Guncelleme deposu: https://github.com/Rwin74/Ata74

## Arkadasin ilk kurulumu

Eski tasinabilir Ata74'u tepsi menusunden Cikis ile tamamen kapat.
Ata74-Setup-1.4.0.exe dosyasini bir kez kur.
Yeni uygulama her acilista GitHub Releases uzerinden surum kontrolu yapar.
Yeni surumde Indir -> Kur ve Yeniden Baslat secilir.
UAC yonetici onayi Windows tarafindan istenebilir.
Eski 1.1.0 tasinabilir surum kendiliginden guncellenemez.

## Depoya eklenecek kaynaklar

Bu klasordeki main.js, preload.js, renderer.js, updater.js, profiles.js,
index.html, styles.css, package.json, package-lock.json, update-config.json,
scripts/, system-scripts/, system-tools.js, network-tools.js, tests/, .github/, .gitignore, core/ ve README dosyalarini depoya ekle.
core/ icindeki EXE, DLL, SYS ve licenses/ dosyalari gerekli.
node_modules/, dist*/, backup-before-*/ klasorlerini yukleme.
GitHub web arayuzunden yuklerken gizli .github/workflows/release.yml dosyasini atlama.
Kaynak deposunu klonlayip bu dosyalari icine kopyalamak da uygundur.

## Bundan sonraki surumu yayinlama

Depoya bagli yerel Git klasorunde PowerShell:

    npm ci
    npm version patch --no-git-tag-version
    git add .
    git commit -m "Ata74 yeni surum"
    $version = node -p "require('./package.json').version"
    git tag "v$version"
    git push origin HEAD
    git push origin "v$version"

Ornek: 1.4.0 -> 1.4.1. Her yayinda surum numarasi mutlaka artmali.
GitHub Actions acik olmali. .github/workflows/release.yml Windows paketi olusturur
ve ayni depoda herkese acik GitHub Release yayinlar.
Actions varsayilan GITHUB_TOKEN kullanir; uygulamaya token gomulmez.
Sadece normal commit/push guncelleme yayinlamaz; v etiketi gerekir.
Tag ile package.json surumu uyusmazsa yayin durdurulur.
Release tamamlanmadan arkadasina yeni surumun hazir oldugunu soyleme.

## Ilk 1.4.0 yayini

Kaynaklar depoya eklendikten sonra v1.4.0 etiketi gonderilebilir.
Alternatif: GitHub Releases > Draft a new release > v1.4.0 olustur ve
dist-update/ icindeki Ata74-Setup-1.4.0.exe, .exe.blockmap ve latest.yml
uc dosyasini ekleyip yayini Publish release ile herkese ac.
Sonraki surumleri yukaridaki etiket akisi ile yayinla.

## Yerelde paketleme

    npm ci
    npm run configure:github -- Rwin74/Ata74
    npm run build

Cikti: dist-update/Ata74-Setup-1.4.0.exe, .exe.blockmap ve latest.yml.
Depo degisirse eski kurulumlar eski depoyu izlemeye devam eder;
eski depodan yeni depo adresini iceren bir gecis surumu yayinlamak gerekir.

## Sinirlar ve dogrulama

GitHub ve indirme sunuculari yurt agindan erisilebilir olmali.
Ag hatasinda ana uygulama kullanilmaya devam eder; Kontrol Et tekrar denenebilir.
Indirme kullanici onayi olmadan baslamaz. Kurulum da ayri dugmeyle baslar.
electron-updater SHA512 butunluk kontrolu uygular.
Kod imzalama sertifikasi eklenmedi; Windows yayiniciyi tanimayabilir.
Canli GitHub yayini ve iki gercek surum arasinda kurulum testi henuz yapilmadi.
Deneme testleri: kullanici onayi, indirme ilerlemesi, yeniden baslatma oncesi temizlik,
ag denemesi sirasinda kurulum engeli, eksik ayar, ag hatasi ve indirme hatasi.

