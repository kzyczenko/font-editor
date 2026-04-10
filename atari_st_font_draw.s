; Atari ST low-resolution 320x200x16 font rendering helpers
;
; Supports 1bpp glyph-by-glyph fonts with width <= 8 pixels.
; This matches the generated 6x6 and 8x8 binaries in this project.
;
; Screen format:
;   320x200, 4 bitplanes, 160 bytes per scanline
;
; Font descriptor layout:
;   +0  long  pointer to glyph data
;   +4  word  glyph width
;   +6  word  glyph height
;   +8  word  bytes per glyph
;   +10 word  reserved
;
; API:
;   StFont_DrawCharTransparent
;   StFont_DrawCharOpaque
;   StFont_DrawStringTransparent
;   StFont_DrawStringOpaque
;
; Call convention:
;   a0 = font descriptor
;   a1 = screen base
;   d0 = x
;   d1 = y
;   d2 = char code              ; char routines only
;   d3 = pen colour (0-15)
;   d4 = background colour      ; opaque routines only
;   a2 = pointer to zero-terminated string ; string routines only
;
; Notes:
;   - no clipping is performed
;   - the string routines advance by font width
;   - transparent means "draw glyph pixels in pen colour, leave background untouched"
;   - opaque means "draw pen for 1 bits and background for 0 bits"

FONT_DATA       equ 0
FONT_WIDTH      equ 4
FONT_HEIGHT     equ 6
FONT_STRIDE     equ 8

                xdef    StFont_DrawCharTransparent
                xdef    StFont_DrawCharOpaque
                xdef    StFont_DrawStringTransparent
                xdef    StFont_DrawStringOpaque

StFont_DrawCharTransparent:
                movem.l d5-d7/a2-a5,-(sp)

                movea.l FONT_DATA(a0),a2
                moveq   #0,d5
                move.w  FONT_STRIDE(a0),d5
                mulu.w  d5,d2
                adda.l  d2,a2

                movea.l a1,a4
                moveq   #0,d7
                move.w  d1,d7
                mulu.w  #160,d7
                adda.l  d7,a4

                move.w  d0,d5                  ; base x
                moveq   #0,d6
                move.w  FONT_HEIGHT(a0),d6
                subq.w  #1,d6

.row_loop_t:
                moveq   #0,d0
                move.b  (a2)+,d0
                move.w  d5,d2

                moveq   #0,d1
                move.w  FONT_WIDTH(a0),d1
                subq.w  #1,d1

.col_loop_t:
                tst.b   d0
                bpl.s   .skip_pixel_t

                move.w  d3,d4
                movea.l a4,a3
                bsr     StFont_PlotPixel

.skip_pixel_t:
                add.b   d0,d0
                addq.w  #1,d2
                dbra    d1,.col_loop_t

                lea     160(a4),a4
                dbra    d6,.row_loop_t

                movem.l (sp)+,d5-d7/a2-a5
                rts

StFont_DrawCharOpaque:
                movem.l d5-d7/a2-a5,-(sp)

                movea.l FONT_DATA(a0),a2
                moveq   #0,d5
                move.w  FONT_STRIDE(a0),d5
                mulu.w  d5,d2
                adda.l  d2,a2

                movea.l a1,a4
                moveq   #0,d7
                move.w  d1,d7
                mulu.w  #160,d7
                adda.l  d7,a4

                move.w  d0,d5                  ; base x
                moveq   #0,d6
                move.w  FONT_HEIGHT(a0),d6
                subq.w  #1,d6

.row_loop_o:
                moveq   #0,d0
                move.b  (a2)+,d0
                move.w  d5,d2

                moveq   #0,d1
                move.w  FONT_WIDTH(a0),d1
                subq.w  #1,d1

.col_loop_o:
                movea.l a4,a3
                tst.b   d0
                bmi.s   .pen_pixel_o

                move.w  d4,d7                  ; preserve background colour
                move.w  d7,d4
                bsr     StFont_PlotPixel
                move.w  d3,d4                  ; restore pen colour for next set pixel
                bra.s   .next_pixel_o

.pen_pixel_o:
                move.w  d3,d4
                bsr     StFont_PlotPixel

.next_pixel_o:
                add.b   d0,d0
                addq.w  #1,d2
                dbra    d1,.col_loop_o

                lea     160(a4),a4
                dbra    d6,.row_loop_o

                movem.l (sp)+,d5-d7/a2-a5
                rts

StFont_DrawStringTransparent:
.next_char_t:
                moveq   #0,d2
                move.b  (a2),d2
                beq.s   .done_t

                movem.l d0-d1/a2,-(sp)
                bsr     StFont_DrawCharTransparent
                movem.l (sp)+,d0-d1/a2

                addq.l  #1,a2
                add.w   FONT_WIDTH(a0),d0
                bra.s   .next_char_t

.done_t:
                rts

StFont_DrawStringOpaque:
.next_char_o:
                moveq   #0,d2
                move.b  (a2),d2
                beq.s   .done_o

                movem.l d0-d1/a2,-(sp)
                bsr     StFont_DrawCharOpaque
                movem.l (sp)+,d0-d1/a2

                addq.l  #1,a2
                add.w   FONT_WIDTH(a0),d0
                bra.s   .next_char_o

.done_o:
                rts

; In:
;   a3 = address of current scanline
;   d2 = x coordinate
;   d4 = colour 0..15
; Out:
;   pixel written
; Clobbers:
;   d5-d7/a5
StFont_PlotPixel:
                move.w  d5,-(sp)

                move.w  d2,d7
                lsr.w   #4,d7
                lsl.w   #3,d7
                movea.l a3,a5
                adda.w  d7,a5

                move.w  d2,d7
                andi.w  #15,d7
                add.w   d7,d7
                move.w  .pixel_masks(pc,d7.w),d7

                move.w  d7,d5
                not.w   d5

                btst    #0,d4
                beq.s   .plane0_clear
                or.w    d7,(a5)
                bra.s   .plane1
.plane0_clear:
                and.w   d5,(a5)

.plane1:
                btst    #1,d4
                beq.s   .plane1_clear
                or.w    d7,2(a5)
                bra.s   .plane2
.plane1_clear:
                and.w   d5,2(a5)

.plane2:
                btst    #2,d4
                beq.s   .plane2_clear
                or.w    d7,4(a5)
                bra.s   .plane3
.plane2_clear:
                and.w   d5,4(a5)

.plane3:
                btst    #3,d4
                beq.s   .plane3_clear
                or.w    d7,6(a5)
                bra.s   .plot_done
.plane3_clear:
                and.w   d5,6(a5)

.plot_done:
                move.w  (sp)+,d5
                rts

.pixel_masks:
                dc.w    $8000,$4000,$2000,$1000,$0800,$0400,$0200,$0100
                dc.w    $0080,$0040,$0020,$0010,$0008,$0004,$0002,$0001
