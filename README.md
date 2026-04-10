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

Import `ANTIC 128` dla Atari 8-bit oczekuje `128` glifow w screen order i przestawia je do kolejnosci atlasu edytora, zachowujac pozostale znaki bez zmian. Importer moze opcjonalnie uwzgledniac podana mape polskich znakow liczona z kodow `ATASCII`, przelicza ja na kolejnosc `ANTIC` i probuje wstawic te glify w pozycje zgodne z aktualnie wybrana strona kodowa.

Import `ST BIN` obsluguje monospace fonty systemowe Atari ST / EmuTOS zapisane jako surowy raster w standardowym ukladzie fontu ST. Eksport `ST BIN` generuje analogiczny plik binarny dla aktualnego fontu.

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
- import `ANTIC 128` z Atari 8-bit
- import `ST BIN` z fontu systemowego Atari ST / EmuTOS
- import pliku `.fnt`
- eksport `.fnt`
- eksport `ASM` jako `dc.b`
- eksport `C` jako `const uint8_t[]`
- eksport `ST BIN` jako raster systemowego fontu Atari ST
- pole do ustawienia bazowej nazwy plikow eksportu
- skroty klawiaturowe: `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, `Ctrl/Cmd+Y`, strzalki, `H`, `V`, `R`, `Shift+R`

## Atari ST runtime

Plik [atari_st_font_draw.s](/Users/kriss/Documents/Font editor/atari_st_font_draw.s) zawiera proste procedury 68000 dla trybu `320x200x16`:

- `StFont_DrawCharTransparent`
- `StFont_DrawCharOpaque`
- `StFont_DrawStringTransparent`
- `StFont_DrawStringOpaque`

Procedury sa przygotowane pod fonty `1bpp` w formacie `glyph-by-glyph` o szerokosci do `8` pikseli, wiec pasuja do wygenerowanych tu fontow `6x6` i `8x8`.

Najwazniejsze parametry:

- `a0` = deskryptor fontu
- `a1` = adres ekranu
- `d0` = `x`
- `d1` = `y`
- `d2` = kod znaku dla `DrawChar`
- `d3` = kolor piora `0-15`
- `d4` = kolor tla `0-15` dla wariantu `opaque`
- `a2` = adres napisu zakonczonego zerem dla `DrawString`

Przykladowy deskryptor dla fontu `8x8`:

```asm
font8x8_desc:
        dc.l    font8x8_data
        dc.w    8
        dc.w    8
        dc.w    8
        dc.w    0
```

Przyklad wywolania:

```asm
        lea     font8x8_desc,a0
        move.l  screen_base,a1
        moveq   #32,d0
        moveq   #40,d1
        moveq   #'A',d2
        moveq   #15,d3
        bsr     StFont_DrawCharTransparent

        lea     font8x8_desc,a0
        move.l  screen_base,a1
        moveq   #32,d0
        moveq   #56,d1
        lea     hello_text,a2
        moveq   #15,d3
        moveq   #1,d4
        bsr     StFont_DrawStringOpaque
```
