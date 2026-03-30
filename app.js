const GLYPH_SIZE = 8;
const GLYPH_COUNT = 256;
const BYTES_PER_GLYPH = 8;
const PREVIEW_SCALE = 4;
const EMPTY_GLYPH = () =>
  Array.from({ length: GLYPH_SIZE }, () => Array(GLYPH_SIZE).fill(0));

const state = {
  glyphs: Array.from({ length: GLYPH_COUNT }, EMPTY_GLYPH),
  selectedChar: 32,
  activeTool: "draw",
  isPointerDown: false,
  clipboard: null,
};

const elements = {
  glyphCanvas: document.getElementById("glyphCanvas"),
  glyphTitle: document.getElementById("glyphTitle"),
  charCodeInput: document.getElementById("charCodeInput"),
  glyphBytes: document.getElementById("glyphBytes"),
  glyphGrid: document.getElementById("glyphGrid"),
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
  invertGlyphButton: document.getElementById("invertGlyphButton"),
  clearGlyphButton: document.getElementById("clearGlyphButton"),
  toolButtons: [...document.querySelectorAll("[data-tool]")],
  shiftButtons: [...document.querySelectorAll("[data-shift]")],
};

const glyphContext = elements.glyphCanvas.getContext("2d");
const previewContext = elements.previewCanvas.getContext("2d");
const cellSize = elements.glyphCanvas.width / GLYPH_SIZE;

function cloneGlyph(glyph) {
  return glyph.map((row) => [...row]);
}

function getSelectedGlyph() {
  return state.glyphs[state.selectedChar];
}

function formatCharLabel(charCode) {
  const printable =
    charCode >= 32 && charCode <= 126 ? String.fromCharCode(charCode) : ".";
  return `Kod ${charCode} / 0x${charCode
    .toString(16)
    .toUpperCase()
    .padStart(2, "0")} / '${printable}'`;
}

function glyphToBytes(glyph) {
  return glyph.map((row) =>
    row.reduce((byte, pixel, index) => byte | (pixel << (7 - index)), 0)
  );
}

function bytesToGlyph(bytes) {
  return bytes.map((byte) =>
    Array.from({ length: GLYPH_SIZE }, (_, x) => (byte >> (7 - x)) & 1)
  );
}

function serializeFont() {
  const output = new Uint8Array(GLYPH_COUNT * BYTES_PER_GLYPH);

  state.glyphs.forEach((glyph, glyphIndex) => {
    const bytes = glyphToBytes(glyph);
    output.set(bytes, glyphIndex * BYTES_PER_GLYPH);
  });

  return output;
}

function sanitizeBaseFilename() {
  const raw = elements.baseFilenameInput.value.trim();
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, "_");
  return cleaned || "font8x8";
}

function sanitizeCIdentifier(value, fallback) {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9_]/g, "_");
  const normalized = /^[a-zA-Z_]/.test(cleaned) ? cleaned : `_${cleaned}`;
  return normalized === "_" ? fallback : normalized;
}

function deserializeFont(buffer) {
  const data = new Uint8Array(buffer);

  if (data.length !== GLYPH_COUNT * BYTES_PER_GLYPH) {
    throw new Error("Plik musi miec dokladnie 2048 bajtow dla 256 znakow 8x8.");
  }

  for (let glyphIndex = 0; glyphIndex < GLYPH_COUNT; glyphIndex += 1) {
    const start = glyphIndex * BYTES_PER_GLYPH;
    state.glyphs[glyphIndex] = bytesToGlyph([...data.slice(start, start + BYTES_PER_GLYPH)]);
  }
}

function updateGlyphInfo() {
  const glyph = getSelectedGlyph();
  const bytes = glyphToBytes(glyph);
  elements.glyphTitle.textContent = formatCharLabel(state.selectedChar);
  elements.charCodeInput.value = String(state.selectedChar);
  elements.glyphBytes.textContent = bytes
    .map((byte, index) => `row ${index}: %${byte.toString(2).padStart(8, "0")}  $${byte
      .toString(16)
      .toUpperCase()
      .padStart(2, "0")}`)
    .join("\n");
}

function renderGlyphEditor() {
  const glyph = getSelectedGlyph();
  glyphContext.clearRect(0, 0, elements.glyphCanvas.width, elements.glyphCanvas.height);
  glyphContext.fillStyle = "#fffdf7";
  glyphContext.fillRect(0, 0, elements.glyphCanvas.width, elements.glyphCanvas.height);

  for (let y = 0; y < GLYPH_SIZE; y += 1) {
    for (let x = 0; x < GLYPH_SIZE; x += 1) {
      glyphContext.fillStyle = glyph[y][x] ? "#1d1b16" : "#fffdf7";
      glyphContext.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      glyphContext.strokeStyle = "#d1c5aa";
      glyphContext.lineWidth = 2;
      glyphContext.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
  }
}

function renderPreview() {
  const text = elements.previewTextInput.value.replace(/\r/g, "");
  const lines = text.split("\n");
  const padding = 12;
  const width = Math.max(...lines.map((line) => line.length), 1) * GLYPH_SIZE * PREVIEW_SCALE;
  const height = Math.max(lines.length, 1) * GLYPH_SIZE * PREVIEW_SCALE;

  elements.previewCanvas.width = width + padding * 2;
  elements.previewCanvas.height = height + padding * 2;

  previewContext.fillStyle = "#1b2430";
  previewContext.fillRect(0, 0, elements.previewCanvas.width, elements.previewCanvas.height);

  lines.forEach((line, lineIndex) => {
    [...line].forEach((character, charIndex) => {
      const glyph = state.glyphs[character.charCodeAt(0) & 0xff];
      for (let y = 0; y < GLYPH_SIZE; y += 1) {
        for (let x = 0; x < GLYPH_SIZE; x += 1) {
          if (!glyph[y][x]) {
            continue;
          }
          previewContext.fillStyle = "#f7f1e3";
          previewContext.fillRect(
            padding + charIndex * GLYPH_SIZE * PREVIEW_SCALE + x * PREVIEW_SCALE,
            padding + lineIndex * GLYPH_SIZE * PREVIEW_SCALE + y * PREVIEW_SCALE,
            PREVIEW_SCALE,
            PREVIEW_SCALE
          );
        }
      }
    });
  });
}

function buildAsmOutput() {
  const label = elements.asmLabelInput.value.trim() || "font8x8_data";
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
  const identifier = sanitizeCIdentifier(baseName, "font8x8");
  const bytes = [...serializeFont()];
  const lines = [
    "#include <stdint.h>",
    "",
    `const uint8_t ${identifier}[${bytes.length}] = {`,
  ];

  for (let index = 0; index < bytes.length; index += 8) {
    const chunk = bytes.slice(index, index + 8);
    lines.push(
      `    ${chunk
        .map((byte) => `0x${byte.toString(16).toUpperCase().padStart(2, "0")}`)
        .join(",")},`
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
    canvas.width = GLYPH_SIZE;
    canvas.height = GLYPH_SIZE;
    const ctx = canvas.getContext("2d");
    const imageData = ctx.createImageData(GLYPH_SIZE, GLYPH_SIZE);

    glyph.forEach((row, y) => {
      row.forEach((pixel, x) => {
        const offset = (y * GLYPH_SIZE + x) * 4;
        const value = pixel ? 29 : 255;
        imageData.data[offset] = value;
        imageData.data[offset + 1] = pixel ? 27 : 253;
        imageData.data[offset + 2] = pixel ? 22 : 247;
        imageData.data[offset + 3] = 255;
      });
    });

    ctx.putImageData(imageData, 0, 0);

    const label = document.createElement("div");
    label.textContent = glyphIndex.toString().padStart(3, "0");

    button.append(canvas, label);
    wrapper.appendChild(button);
    elements.glyphGrid.appendChild(wrapper);
  });
}

function rerender() {
  updateGlyphInfo();
  renderGlyphEditor();
  renderPreview();
  renderGlyphGrid();
  refreshExportOutputs();
}

function setPixelFromEvent(event) {
  const rect = elements.glyphCanvas.getBoundingClientRect();
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * GLYPH_SIZE);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * GLYPH_SIZE);

  if (x < 0 || x >= GLYPH_SIZE || y < 0 || y >= GLYPH_SIZE) {
    return;
  }

  const glyph = getSelectedGlyph();
  glyph[y][x] = state.activeTool === "erase" ? 0 : 1;
  rerender();
}

function shiftGlyph(direction) {
  const glyph = getSelectedGlyph();
  const next = EMPTY_GLYPH();

  for (let y = 0; y < GLYPH_SIZE; y += 1) {
    for (let x = 0; x < GLYPH_SIZE; x += 1) {
      const sourceX =
        direction === "left" ? x + 1 : direction === "right" ? x - 1 : x;
      const sourceY = direction === "up" ? y + 1 : direction === "down" ? y - 1 : y;

      if (sourceX >= 0 && sourceX < GLYPH_SIZE && sourceY >= 0 && sourceY < GLYPH_SIZE) {
        next[y][x] = glyph[sourceY][sourceX];
      }
    }
  }

  state.glyphs[state.selectedChar] = next;
  rerender();
}

function invertGlyph() {
  const glyph = getSelectedGlyph();
  for (let y = 0; y < GLYPH_SIZE; y += 1) {
    for (let x = 0; x < GLYPH_SIZE; x += 1) {
      glyph[y][x] = glyph[y][x] ? 0 : 1;
    }
  }
  rerender();
}

function clearGlyph() {
  state.glyphs[state.selectedChar] = EMPTY_GLYPH();
  rerender();
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

elements.glyphCanvas.addEventListener("pointerdown", (event) => {
  state.isPointerDown = true;
  setPixelFromEvent(event);
});

elements.glyphCanvas.addEventListener("pointermove", (event) => {
  if (state.isPointerDown) {
    setPixelFromEvent(event);
  }
});

window.addEventListener("pointerup", () => {
  state.isPointerDown = false;
});

elements.charCodeInput.addEventListener("change", () => {
  const value = Number(elements.charCodeInput.value);
  state.selectedChar = Number.isFinite(value) ? Math.min(255, Math.max(0, value)) : 32;
  rerender();
});

elements.previewTextInput.addEventListener("input", renderPreview);
elements.asmLabelInput.addEventListener("input", refreshExportOutputs);
elements.baseFilenameInput.addEventListener("input", refreshExportOutputs);

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
    state.glyphs[state.selectedChar] = cloneGlyph(state.clipboard);
    rerender();
  }
});

elements.invertGlyphButton.addEventListener("click", invertGlyph);
elements.clearGlyphButton.addEventListener("click", clearGlyph);

elements.newFontButton.addEventListener("click", () => {
  state.glyphs = Array.from({ length: GLYPH_COUNT }, EMPTY_GLYPH);
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
    rerender();
  } catch (error) {
    window.alert(error.message);
  } finally {
    elements.importBinInput.value = "";
  }
});

rerender();
