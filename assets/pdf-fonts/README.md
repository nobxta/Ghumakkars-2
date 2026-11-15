# PDF fonts (AI Itinerary Studio)

Static, subset (Latin, Latin-1, typographic punctuation and ₹) TrueType builds used by
`lib/ai-itinerary/pdf.ts` via jsPDF. Generated from the official Google Fonts repository
(github.com/google/fonts) by instancing the variable fonts at fixed weights and subsetting.

All families are licensed under the SIL Open Font License 1.1 (see `OFL.txt`);
copyright remains with their respective authors:

- Playfair Display — The Playfair Display Project Authors
- Inter — The Inter Project Authors
- Cormorant Garamond — The Cormorant Project Authors
- Montserrat — The Montserrat Project Authors
- Poppins — Indian Type Foundry
- Fraunces — The Fraunces Project Authors
- DM Sans, DM Serif Display — The DM Sans / DM Serif Project Authors
- Bebas Neue — Dharma Type
- Manrope — The Manrope Project Authors
- Outfit — The Outfit Project Authors

DM Serif Display and Outfit do not contain the ₹ glyph; the renderer never uses them for prices.
