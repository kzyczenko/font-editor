# Atari ST 8x8 Font Editor

Prosty webowy edytor fontow `8x8`, `1bpp`, przygotowany pod fonty do dem i gier na Atari ST.

## Format binarny

- `256` znakow
- `8x8` pikseli na glif
- `1bpp`
- glify zapisane znak po znaku
- kazdy glif ma `8` bajtow
- kazdy bajt opisuje jeden wiersz
- `bit 7` to lewy piksel, `bit 0` to prawy piksel

Rozmiar pelnego pliku to `2048` bajtow.

## Uruchomienie

Otworz `index.html` w przegladarce.

Jesli przegladarka blokuje import plikow przy otwarciu lokalnym, odpal prosty serwer HTTP w dowolny sposob i wejdz na katalog projektu.

## Funkcje MVP

- edycja pojedynczego glifu `8x8`
- atlas `256` znakow
- preview wpisanego tekstu
- przelaczalne strony kodowe w atlasie i preview
- kopiowanie i wklejanie glifu
- przesuwanie glifu
- invert i clear
- import binarki `2048` bajtow
- import pliku `.fnt`
- eksport `.fnt`
- eksport `ASM` jako `dc.b`
- eksport `C` jako `const uint8_t[]`
- pole do ustawienia bazowej nazwy plikow eksportu
