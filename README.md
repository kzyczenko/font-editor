# Atari ST Font Editor

Prosty webowy edytor fontow `1bpp`, przygotowany pod fonty do dem i gier na Atari ST.

## Format binarny

- `256` znakow
- preset `6x6`, `8x8` albo `16x16`
- `1bpp`
- glify zapisane znak po znaku
- liczba bajtow na wiersz = `ceil(width / 8)`
- liczba bajtow na glif = `bytesPerRow * height`
- `bit 7` to lewy piksel, `bit 0` to prawy piksel

Przyklady:

- `6x6` = `1536` bajtow
- `8x8` = `2048` bajtow
- `16x16` = `8192` bajtow

Surowy plik `.fnt` nie ma naglowka, wiec przy imporcie edytor zaklada aktualnie wybrany preset rozmiaru.

## Uruchomienie

Otworz `index.html` w przegladarce.

Jesli przegladarka blokuje import plikow przy otwarciu lokalnym, odpal prosty serwer HTTP w dowolny sposob i wejdz na katalog projektu.

## Funkcje MVP

- edycja pojedynczego glifu `6x6`, `8x8` lub `16x16`
- atlas `256` znakow
- preview wpisanego tekstu
- przelaczalne strony kodowe w atlasie i preview
- kopiowanie i wklejanie glifu
- przesuwanie glifu z wrap-around
- undo/redo
- invert, clear, mirror, rotate
- import surowej binarki zgodnej z wybranym presetem
- import pliku `.fnt`
- eksport `.fnt`
- eksport `ASM` jako `dc.b`
- eksport `C` jako `const uint8_t[]`
- pole do ustawienia bazowej nazwy plikow eksportu
- skroty klawiaturowe: `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, `Ctrl/Cmd+Y`, strzalki, `H`, `V`, `R`, `Shift+R`
