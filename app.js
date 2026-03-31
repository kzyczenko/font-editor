const GLYPH_COUNT = 256;
const CANVAS_SIZE = 320;
const FONT_PRESETS = {
  "6x6": { width: 6, height: 6 },
  "8x8": { width: 8, height: 8 },
  "16x16": { width: 16, height: 16 },
};

const state = {
  fontPreset: "8x8",
  fontWidth: 8,
  fontHeight: 8,
  glyphs: [],
  selectedChar: 32,
  activeTool: "draw",
  isPointerDown: false,
  strokeSnapshot: null,
  clipboard: null,
  codePage: "iso-8859-2",
  undoStack: [],
  redoStack: [],
};

const elements = {
  glyphCanvas: document.getElementById("glyphCanvas"),
  glyphTitle: document.getElementById("glyphTitle"),
  fontPresetSelect: document.getElementById("fontPresetSelect"),
  charCodeInput: document.getElementById("charCodeInput"),
  glyphBytes: document.getElementById("glyphBytes"),
  glyphGrid: document.getElementById("glyphGrid"),
  codePageSelect: document.getElementById("codePageSelect"),
  previewTextInput: document.getElementById("previewTextInput"),
  previewCanvas: document.getElementById("previewCanvas"),
  downloadBinButton: document.getElementById("downloadBinButton"),
  downloadAsmButton: document.getElementById("downloadAsmButton"),
  downloadCButton: document.getElementById("downloadCButton"),
  importBinInput: document.getElementById("importBinInput"),
  baseFilenameInput: document.getElementById("baseFilenameInput"),
  asmLabelInput: document.getElementById("asmLabelInput"),
  asmOutput: document.getElementById("asmOutput"),
  cOutput: document.getElementById("cOutput"),
  newFontButton: document.getElementById("newFontButton"),
  copyGlyphButton: document.getElementById("copyGlyphButton"),
  pasteGlyphButton: document.getElementById("pasteGlyphButton"),
  undoButton: document.getElementById("undoButton"),
  redoButton: document.getElementById("redoButton"),
  invertGlyphButton: document.getElementById("invertGlyphButton"),
  clearGlyphButton: document.getElementById("clearGlyphButton"),
  mirrorHorizontalButton: document.getElementById("mirrorHorizontalButton"),
  mirrorVerticalButton: document.getElementById("mirrorVerticalButton"),
  rotateRightButton: document.getElementById("rotateRightButton"),
  rotateLeftButton: document.getElementById("rotateLeftButton"),
  formatNote: document.querySelector(".format-note"),
  toolButtons: [...document.querySelectorAll("[data-tool]")],
  shiftButtons: [...document.querySelectorAll("[data-shift]")],
};

const glyphContext = elements.glyphCanvas.getContext("2d");
const previewContext = elements.previewCanvas.getContext("2d");
const codePageCache = new Map();

function getBytesPerRow() {
  return Math.ceil(state.fontWidth / 8);
}

function getBytesPerGlyph() {
  return getBytesPerRow() * state.fontHeight;
}

function getPreviewScale() {
  return state.fontWidth >= 16 || state.fontHeight >= 16 ? 2 : 4;
}

function createEmptyGlyph() {
  return Array.from({ length: state.fontHeight }, () =>
    Array(state.fontWidth).fill(0)
  );
}

function createEmptyFont() {
  return Array.from({ length: GLYPH_COUNT }, () => createEmptyGlyph());
}

function cloneGlyph(glyph) {
  return glyph.map((row) => [...row]);
}

function getSelectedGlyph() {
  return state.glyphs[state.selectedChar];
}

function setSelectedGlyph(glyph) {
  state.glyphs[state.selectedChar] = cloneGlyph(glyph);
}

function resetHistory() {
  state.undoStack = [];
  state.redoStack = [];
}

function glyphsEqual(first, second) {
  return JSON.stringify(first) === JSON.stringify(second);
}

function pushHistoryEntry(glyphIndex, before, after) {
  if (glyphsEqual(before, after)) {
    return;
  }

  state.undoStack.push({
    glyphIndex,
    before: cloneGlyph(before),
    after: cloneGlyph(after),
  });
  state.redoStack = [];
}

function applyGlyphHistoryState(glyphIndex, glyph) {
  state.glyphs[glyphIndex] = cloneGlyph(glyph);
  state.selectedChar = glyphIndex;
  rerender();
}

function commitSelectedGlyphChange(nextGlyph) {
  const before = cloneGlyph(getSelectedGlyph());
  const after = cloneGlyph(nextGlyph);
  setSelectedGlyph(after);
  pushHistoryEntry(state.selectedChar, before, after);
  rerender();
}

function transformGlyph(transformer) {
  commitSelectedGlyphChange(transformer(cloneGlyph(getSelectedGlyph())));
}

function buildAsciiMapping() {
  const bytesToChars = Array.from({ length: GLYPH_COUNT }, (_, index) =>
    index >= 32 && index <= 126 ? String.fromCharCode(index) : ""
  );
  const charsToBytes = new Map();

  bytesToChars.forEach((character, index) => {
    if (character) {
      charsToBytes.set(character, index);
    }
  });

  return { bytesToChars, charsToBytes };
}

function buildDecoderMapping(encoding) {
  let decoder;

  try {
    decoder = new TextDecoder(encoding);
  } catch (_error) {
    return buildAsciiMapping();
  }

  const bytesToChars = [];
  const charsToBytes = new Map();

  for (let index = 0; index < GLYPH_COUNT; index += 1) {
    const character = decoder.decode(Uint8Array.of(index));
    bytesToChars.push(character);

    if (character && !charsToBytes.has(character)) {
      charsToBytes.set(character, index);
    }
  }

  return { bytesToChars, charsToBytes };
}

function getCodePageMapping() {
  if (!codePageCache.has(state.codePage)) {
    const mapping =
      state.codePage === "ascii"
        ? buildAsciiMapping()
        : buildDecoderMapping(state.codePage);
    codePageCache.set(state.codePage, mapping);
  }

  return codePageCache.get(state.codePage);
}

function formatGlyphCharacter(charCode) {
  const { bytesToChars } = getCodePageMapping();
  const character = bytesToChars[charCode] || "";

  if (!character || /[\u0000-\u001f\u007f-\u009f]/u.test(character)) {
    return ".";
  }

  return character === " " ? "\u2423" : character;
}

function formatCharLabel(charCode) {
  const printable = formatGlyphCharacter(charCode);
  return `Kod ${charCode} / 0x${charCode
    .toString(16)
    .toUpperCase()
    .padStart(2, "0")} / '${printable}'`;
}

function glyphToBytes(glyph) {
  const bytesPerRow = getBytesPerRow();

  return glyph.flatMap((row) => {
    const rowBytes = Array(bytesPerRow).fill(0);

    row.forEach((pixel, index) => {
      const byteIndex = Math.floor(index / 8);
      const bitIndex = 7 - (index % 8);
      rowBytes[byteIndex] |= pixel << bitIndex;
    });

    return rowBytes;
  });
}

function bytesToGlyph(bytes) {
  const bytesPerRow = getBytesPerRow();

  return Array.from({ length: state.fontHeight }, (_, y) =>
    Array.from({ length: state.fontWidth }, (_, x) => {
      const byteIndex = y * bytesPerRow + Math.floor(x / 8);
      const bitIndex = 7 - (x % 8);
      return (bytes[byteIndex] >> bitIndex) & 1;
    })
  );
}

function serializeFont() {
  const output = new Uint8Array(GLYPH_COUNT * getBytesPerGlyph());

  state.glyphs.forEach((glyph, glyphIndex) => {
    output.set(glyphToBytes(glyph), glyphIndex * getBytesPerGlyph());
  });

  return output;
}

function sanitizeBaseFilename() {
  const raw = elements.baseFilenameInput.value.trim();
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, "_");
  return cleaned || `font${state.fontWidth}x${state.fontHeight}`;
}

function sanitizeCIdentifier(value, fallback) {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9_]/g, "_");
  const normalized = /^[a-zA-Z_]/.test(cleaned) ? cleaned : `_${cleaned}`;
  return normalized === "_" ? fallback : normalized;
}

function deserializeFont(buffer) {
  const data = new Uint8Array(buffer);
  const expectedSize = GLYPH_COUNT * getBytesPerGlyph();

  if (data.length !== expectedSize) {
    throw new Error(
      `Plik musi miec dokladnie ${expectedSize} bajtow dla ${GLYPH_COUNT} znakow ${state.fontWidth}x${state.fontHeight}.`
    );
  }

  for (let glyphIndex = 0; glyphIndex < GLYPH_COUNT; glyphIndex += 1) {
    const start = glyphIndex * getBytesPerGlyph();
    const glyphBytes = [...data.slice(start, start + getBytesPerGlyph())];
    state.glyphs[glyphIndex] = bytesToGlyph(glyphBytes);
  }
}

function updateFormatNote() {
  elements.formatNote.textContent = `Format: ${GLYPH_COUNT} glifow, ${state.fontWidth}x${state.fontHeight}, 1bpp, ${getBytesPerGlyph()} bajtow na znak, ${getBytesPerRow()} bajt(y) na wiersz, bit 7 = lewy piksel.`;
}

function updateGlyphInfo() {
  const glyph = getSelectedGlyph();
  const bytes = glyphToBytes(glyph);
  elements.glyphTitle.textContent = `${formatCharLabel(state.selectedChar)} / ${state.fontWidth}x${state.fontHeight}`;
  elements.charCodeInput.value = String(state.selectedChar);
  elements.glyphBytes.textContent = bytes
    .map((byte, index) => `byte ${index}: %${byte.toString(2).padStart(8, "0")}  $${byte
      .toString(16)
      .toUpperCase()
      .padStart(2, "0")}`)
    .join("\n");
}

function renderGlyphEditor() {
  const glyph = getSelectedGlyph();
  const cellWidth = elements.glyphCanvas.width / state.fontWidth;
  const cellHeight = elements.glyphCanvas.height / state.fontHeight;

  glyphContext.clearRect(0, 0, elements.glyphCanvas.width, elements.glyphCanvas.height);
  glyphContext.fillStyle = "#fffdf7";
  glyphContext.fillRect(0, 0, elements.glyphCanvas.width, elements.glyphCanvas.height);

  for (let y = 0; y < state.fontHeight; y += 1) {
    for (let x = 0; x < state.fontWidth; x += 1) {
      glyphContext.fillStyle = glyph[y][x] ? "#1d1b16" : "#fffdf7";
      glyphContext.fillRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
      glyphContext.strokeStyle = "#d1c5aa";
      glyphContext.lineWidth = 2;
      glyphContext.strokeRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
    }
  }
}

function renderPreview() {
  const text = elements.previewTextInput.value.replace(/\r/g, "");
  const lines = text.split("\n");
  const { charsToBytes } = getCodePageMapping();
  const scale = getPreviewScale();
  const padding = 12;
  const width = Math.max(...lines.map((line) => line.length), 1) * state.fontWidth * scale;
  const height = Math.max(lines.length, 1) * state.fontHeight * scale;

  elements.previewCanvas.width = width + padding * 2;
  elements.previewCanvas.height = height + padding * 2;

  previewContext.fillStyle = "#1b2430";
  previewContext.fillRect(0, 0, elements.previewCanvas.width, elements.previewCanvas.height);

  lines.forEach((line, lineIndex) => {
    [...line].forEach((character, charIndex) => {
      const glyphIndex =
        charsToBytes.get(character) ??
        (character.length === 1 && character.charCodeAt(0) <= 0xff
          ? character.charCodeAt(0) & 0xff
          : 63);
      const glyph = state.glyphs[glyphIndex];

      for (let y = 0; y < state.fontHeight; y += 1) {
        for (let x = 0; x < state.fontWidth; x += 1) {
          if (!glyph[y][x]) {
            continue;
          }

          previewContext.fillStyle = "#f7f1e3";
          previewContext.fillRect(
            padding + charIndex * state.fontWidth * scale + x * scale,
            padding + lineIndex * state.fontHeight * scale + y * scale,
            scale,
            scale
          );
        }
      }
    });
  });
}

function buildAsmOutput() {
  const label = elements.asmLabelInput.value.trim() || `font${state.fontWidth}x${state.fontHeight}_data`;
  const lines = [`${label}:`];

  state.glyphs.forEach((glyph, glyphIndex) => {
    const bytes = glyphToBytes(glyph);
    lines.push(
      `    dc.b ${bytes
        .map((byte) => `$${byte.toString(16).toUpperCase().padStart(2, "0")}`)
        .join(", ")}    ; ${glyphIndex.toString().padStart(3, " ")}`
    );
  });

  return lines.join("\n");
}

function buildCOutput() {
  const baseName = sanitizeBaseFilename();
  const identifier = sanitizeCIdentifier(baseName, `font${state.fontWidth}x${state.fontHeight}`);
  const bytes = [...serializeFont()];
  const lines = [
    "#include <stdint.h>",
    "",
    `const uint8_t ${identifier}[${bytes.length}] = {`,
  ];

  for (let index = 0; index < bytes.length; index += getBytesPerGlyph()) {
    const chunk = bytes.slice(index, index + getBytesPerGlyph());
    lines.push(
      `    ${chunk
        .map((byte) => `0x${byte.toString(16).toUpperCase().padStart(2, "0")}`)
        .join(", ")},`
    );
  }

  lines.push("};");
  return lines.join("\n");
}

function refreshExportOutputs() {
  elements.asmOutput.value = buildAsmOutput();
  elements.cOutput.value = buildCOutput();
}

function renderGlyphGrid() {
  elements.glyphGrid.innerHTML = "";

  state.glyphs.forEach((glyph, glyphIndex) => {
    const wrapper = document.createElement("div");
    wrapper.className = `glyph-cell${glyphIndex === state.selectedChar ? " selected" : ""}`;

    const button = document.createElement("button");
    button.type = "button";
    button.title = formatCharLabel(glyphIndex);
    button.addEventListener("click", () => {
      state.selectedChar = glyphIndex;
      rerender();
    });

    const canvas = document.createElement("canvas");
    canvas.width = state.fontWidth;
    canvas.height = state.fontHeight;
    const ctx = canvas.getContext("2d");
    const imageData = ctx.createImageData(state.fontWidth, state.fontHeight);

    glyph.forEach((row, y) => {
      row.forEach((pixel, x) => {
        const offset = (y * state.fontWidth + x) * 4;
        const value = pixel ? 29 : 255;
        imageData.data[offset] = value;
        imageData.data[offset + 1] = pixel ? 27 : 253;
        imageData.data[offset + 2] = pixel ? 22 : 247;
        imageData.data[offset + 3] = 255;
      });
    });

    ctx.putImageData(imageData, 0, 0);

    const label = document.createElement("div");
    label.className = "glyph-char";
    label.textContent = formatGlyphCharacter(glyphIndex);

    const code = document.createElement("div");
    code.className = "glyph-code";
    code.textContent = glyphIndex.toString().padStart(3, "0");

    button.append(canvas, label, code);
    wrapper.appendChild(button);
    elements.glyphGrid.appendChild(wrapper);
  });
}

function rerender() {
  updateFormatNote();
  updateGlyphInfo();
  renderGlyphEditor();
  renderPreview();
  renderGlyphGrid();
  refreshExportOutputs();
}

function setPixelFromEvent(event) {
  const rect = elements.glyphCanvas.getBoundingClientRect();
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * state.fontWidth);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * state.fontHeight);

  if (x < 0 || x >= state.fontWidth || y < 0 || y >= state.fontHeight) {
    return;
  }

  const glyph = getSelectedGlyph();
  const nextValue = state.activeTool === "erase" ? 0 : 1;

  if (glyph[y][x] === nextValue) {
    return;
  }

  glyph[y][x] = nextValue;
  updateGlyphInfo();
  renderGlyphEditor();
  renderPreview();
  renderGlyphGrid();
  refreshExportOutputs();
}

function shiftGlyph(direction) {
  const glyph = getSelectedGlyph();
  const next = createEmptyGlyph();

  for (let y = 0; y < state.fontHeight; y += 1) {
    for (let x = 0; x < state.fontWidth; x += 1) {
      const sourceX =
        direction === "left"
          ? (x + 1) % state.fontWidth
          : direction === "right"
            ? (x - 1 + state.fontWidth) % state.fontWidth
            : x;
      const sourceY =
        direction === "up"
          ? (y + 1) % state.fontHeight
          : direction === "down"
            ? (y - 1 + state.fontHeight) % state.fontHeight
            : y;

      next[y][x] = glyph[sourceY][sourceX];
    }
  }

  commitSelectedGlyphChange(next);
}

function invertGlyph() {
  transformGlyph((glyph) =>
    glyph.map((row) => row.map((pixel) => (pixel ? 0 : 1)))
  );
}

function clearGlyph() {
  commitSelectedGlyphChange(createEmptyGlyph());
}

function mirrorGlyphHorizontal(glyph) {
  return glyph.map((row) => [...row].reverse());
}

function mirrorGlyphVertical(glyph) {
  return [...glyph].reverse().map((row) => [...row]);
}

function rotateGlyphRight(glyph) {
  return Array.from({ length: state.fontHeight }, (_, y) =>
    Array.from({ length: state.fontWidth }, (_, x) => glyph[state.fontHeight - 1 - x][y])
  );
}

function rotateGlyphLeft(glyph) {
  return Array.from({ length: state.fontHeight }, (_, y) =>
    Array.from({ length: state.fontWidth }, (_, x) => glyph[x][state.fontWidth - 1 - y])
  );
}

function undo() {
  const entry = state.undoStack.pop();

  if (!entry) {
    return;
  }

  state.redoStack.push({
    glyphIndex: entry.glyphIndex,
    before: cloneGlyph(entry.before),
    after: cloneGlyph(entry.after),
  });
  applyGlyphHistoryState(entry.glyphIndex, entry.before);
}

function redo() {
  const entry = state.redoStack.pop();

  if (!entry) {
    return;
  }

  state.undoStack.push({
    glyphIndex: entry.glyphIndex,
    before: cloneGlyph(entry.before),
    after: cloneGlyph(entry.after),
  });
  applyGlyphHistoryState(entry.glyphIndex, entry.after);
}

function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  return (
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT" ||
    target.isContentEditable
  );
}

function handleKeyboardShortcut(event) {
  if (isEditableTarget(event.target)) {
    return;
  }

  const key = event.key.toLowerCase();
  const hasPrimaryModifier = event.metaKey || event.ctrlKey;

  if (hasPrimaryModifier && key === "z" && !event.shiftKey) {
    event.preventDefault();
    undo();
    return;
  }

  if (
    (hasPrimaryModifier && key === "z" && event.shiftKey) ||
    (hasPrimaryModifier && key === "y")
  ) {
    event.preventDefault();
    redo();
    return;
  }

  if (event.altKey || hasPrimaryModifier) {
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    shiftGlyph("up");
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    shiftGlyph("down");
    return;
  }

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    shiftGlyph("left");
    return;
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    shiftGlyph("right");
    return;
  }

  if (key === "h") {
    event.preventDefault();
    transformGlyph(mirrorGlyphHorizontal);
    return;
  }

  if (key === "v") {
    event.preventDefault();
    transformGlyph(mirrorGlyphVertical);
    return;
  }

  if (key === "r" && event.shiftKey) {
    event.preventDefault();
    transformGlyph(rotateGlyphLeft);
    return;
  }

  if (key === "r") {
    event.preventDefault();
    transformGlyph(rotateGlyphRight);
  }
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function applyFontPreset(presetKey, options = {}) {
  const preset = FONT_PRESETS[presetKey];

  if (!preset) {
    return;
  }

  state.fontPreset = presetKey;
  state.fontWidth = preset.width;
  state.fontHeight = preset.height;
  elements.fontPresetSelect.value = presetKey;

  if (options.preserveGlyphs) {
    return;
  }

  state.glyphs = createEmptyFont();
  state.selectedChar = 32;
  state.clipboard = null;
  state.strokeSnapshot = null;
  state.isPointerDown = false;
  resetHistory();
}

function maybeSwitchFontPreset(presetKey) {
  if (presetKey === state.fontPreset) {
    return;
  }

  const confirmMessage =
    "Zmiana formatu fontu wyczysci aktualny font i historie undo/redo. Kontynuowac?";

  if (!window.confirm(confirmMessage)) {
    elements.fontPresetSelect.value = state.fontPreset;
    return;
  }

  applyFontPreset(presetKey);
  rerender();
}

elements.glyphCanvas.addEventListener("pointerdown", (event) => {
  state.isPointerDown = true;
  state.strokeSnapshot = cloneGlyph(getSelectedGlyph());
  setPixelFromEvent(event);
});

elements.glyphCanvas.addEventListener("pointermove", (event) => {
  if (state.isPointerDown) {
    setPixelFromEvent(event);
  }
});

window.addEventListener("pointerup", () => {
  if (state.isPointerDown && state.strokeSnapshot) {
    pushHistoryEntry(state.selectedChar, state.strokeSnapshot, getSelectedGlyph());
    state.strokeSnapshot = null;
    rerender();
  }

  state.isPointerDown = false;
});

window.addEventListener("keydown", handleKeyboardShortcut);

elements.fontPresetSelect.addEventListener("change", () => {
  maybeSwitchFontPreset(elements.fontPresetSelect.value);
});

elements.charCodeInput.addEventListener("change", () => {
  const value = Number(elements.charCodeInput.value);
  state.selectedChar = Number.isFinite(value) ? Math.min(255, Math.max(0, value)) : 32;
  rerender();
});

elements.previewTextInput.addEventListener("input", renderPreview);
elements.asmLabelInput.addEventListener("input", refreshExportOutputs);
elements.baseFilenameInput.addEventListener("input", refreshExportOutputs);
elements.codePageSelect.addEventListener("change", () => {
  state.codePage = elements.codePageSelect.value;
  rerender();
});

elements.toolButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.activeTool = button.dataset.tool;
    elements.toolButtons.forEach((candidate) => candidate.classList.remove("active"));
    button.classList.add("active");
  });
});

elements.shiftButtons.forEach((button) => {
  button.addEventListener("click", () => shiftGlyph(button.dataset.shift));
});

elements.copyGlyphButton.addEventListener("click", () => {
  state.clipboard = cloneGlyph(getSelectedGlyph());
});

elements.pasteGlyphButton.addEventListener("click", () => {
  if (state.clipboard) {
    commitSelectedGlyphChange(state.clipboard);
  }
});

elements.undoButton.addEventListener("click", undo);
elements.redoButton.addEventListener("click", redo);
elements.invertGlyphButton.addEventListener("click", invertGlyph);
elements.clearGlyphButton.addEventListener("click", clearGlyph);
elements.mirrorHorizontalButton.addEventListener("click", () => {
  transformGlyph(mirrorGlyphHorizontal);
});
elements.mirrorVerticalButton.addEventListener("click", () => {
  transformGlyph(mirrorGlyphVertical);
});
elements.rotateRightButton.addEventListener("click", () => {
  transformGlyph(rotateGlyphRight);
});
elements.rotateLeftButton.addEventListener("click", () => {
  transformGlyph(rotateGlyphLeft);
});

elements.newFontButton.addEventListener("click", () => {
  applyFontPreset(state.fontPreset);
  rerender();
});

elements.downloadBinButton.addEventListener("click", () => {
  downloadFile(`${sanitizeBaseFilename()}.fnt`, serializeFont(), "application/octet-stream");
});

elements.downloadAsmButton.addEventListener("click", () => {
  refreshExportOutputs();
  downloadFile(
    `${sanitizeBaseFilename()}.s`,
    elements.asmOutput.value,
    "text/plain;charset=utf-8"
  );
});

elements.downloadCButton.addEventListener("click", () => {
  refreshExportOutputs();
  downloadFile(
    `${sanitizeBaseFilename()}.c`,
    elements.cOutput.value,
    "text/plain;charset=utf-8"
  );
});

elements.importBinInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;

  if (!file) {
    return;
  }

  try {
    const buffer = await file.arrayBuffer();
    deserializeFont(buffer);
    resetHistory();
    rerender();
  } catch (error) {
    window.alert(error.message);
  } finally {
    elements.importBinInput.value = "";
  }
});

elements.glyphCanvas.width = CANVAS_SIZE;
elements.glyphCanvas.height = CANVAS_SIZE;
applyFontPreset(state.fontPreset);
rerender();
