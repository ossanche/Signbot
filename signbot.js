// ─── PIXEL TITLE ─────────────────────────────────────────────────────────────

(function drawTitle() {
    const SCALE = 4, GAP = 1, DOT = SCALE - GAP, CW = 5, CH = 7, LS = 1;
    const text = "signbot";
    const totalCols = text.length * (CW + LS) - LS;
    const cvs = document.getElementById("titulo-canvas");
    cvs.width  = totalCols * SCALE + 4;
    cvs.height = CH * SCALE + 4;
    const c = cvs.getContext("2d");
    c.fillStyle = "#000";
    c.fillRect(0, 0, cvs.width, cvs.height);
    let curCol = 0;
    for (let ci = 0; ci < text.length; ci++) {
        const cols = FONT_5X7[text[ci]] || FONT_5X7[' '];
        for (let col = 0; col < CW; col++) {
            const byte = cols[col];
            for (let row = 0; row < CH; row++) {
                const on = (byte >> row) & 1;
                const x = (curCol + col) * SCALE + 2;
                const y = row * SCALE + 2;
                if (on) { c.shadowColor = "#ff2222"; c.shadowBlur = 6; c.fillStyle = "#ff2222"; }
                else    { c.shadowBlur = 0; c.fillStyle = "#2a0505"; }
                c.fillRect(x, y, DOT, DOT);
            }
        }
        curCol += CW + LS;
    }
})();


// ─── SIGN CONFIG ─────────────────────────────────────────────────────────────

let CONFIG = {
    texto:        "welcome to Signbot",
    anchoCartel:  240,
    altoCartel:   33,
    gridSize:     3,
    colorFondo:   "rgb(25,15,15)",
    colorLedOn:   "rgb(255,60,60)",
    colorLedOff:  "rgb(55,25,25)",
    fps:          20
};

const canvas = document.getElementById("matrizSignbot");
const ctx    = canvas.getContext("2d");

let columnasVisibles;
let filasVisibles;
let mapaBitsTexto  = [];
let desplazaColumna = 0;
let bucleAnimacion  = null;


// ─── MARQUEE LOGIC ───────────────────────────────────────────────────────────

function generarMapaBits() {
    mapaBitsTexto = [];
    for (let f = 0; f < 11; f++) mapaBitsTexto.push([]);

    const ei = Math.floor(CONFIG.anchoCartel / CONFIG.gridSize);
    for (let f = 0; f < 11; f++)
        for (let e = 0; e < ei; e++)
            mapaBitsTexto[f].push(0);

    for (let i = 0; i < CONFIG.texto.length; i++) {
        const char = FONT_5X7[CONFIG.texto[i]] || FONT_5X7[' '];
        for (let fila = 0; fila < 11; fila++) {
            if (fila >= 2 && fila <= 8) {
                let bf = fila - 2;
                for (let col = 0; col < 5; col++)
                    mapaBitsTexto[fila].push((char[col] >> bf) & 1);
            } else {
                for (let col = 0; col < 5; col++)
                    mapaBitsTexto[fila].push(0);
            }
            mapaBitsTexto[fila].push(0);
        }
    }
}

function actualizarDimensiones() {
    canvas.width      = CONFIG.anchoCartel;
    canvas.height     = CONFIG.altoCartel;
    columnasVisibles  = Math.floor(CONFIG.anchoCartel / CONFIG.gridSize);
    filasVisibles     = Math.floor(CONFIG.altoCartel  / CONFIG.gridSize);
}

function dibujarFrame() {
    ctx.fillStyle = CONFIG.colorFondo;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const ct = mapaBitsTexto[0] ? mapaBitsTexto[0].length : 0;
    for (let col = 0; col < columnasVisibles; col++) {
        for (let fila = 0; fila < filasVisibles; fila++) {
            const tx = col + desplazaColumna;
            const on = tx < ct && mapaBitsTexto[fila] && mapaBitsTexto[fila][tx] === 1;
            ctx.fillStyle = on ? CONFIG.colorLedOn : CONFIG.colorLedOff;
            ctx.fillRect(col * CONFIG.gridSize, fila * CONFIG.gridSize, CONFIG.gridSize - 1, CONFIG.gridSize - 1);
        }
    }
    desplazaColumna++;
    if (desplazaColumna >= ct) desplazaColumna = 0;
}

function iniciarMarquesina() {
    clearInterval(bucleAnimacion);
    desplazaColumna = 0;
    actualizarDimensiones();
    generarMapaBits();
    bucleAnimacion = setInterval(dibujarFrame, 1000 / CONFIG.fps);
    document.getElementById("btnDownload").style.display = "inline-block";
    document.getElementById("gifStatus").textContent = "";
}


// ---- GIF ENCODER -----

function makeAnimatedGIF(width, height, frames, delayCs, palette) {
    const out = [];
    const B  = v => out.push(v & 0xFF);
    const W  = v => { out.push(v & 0xFF); out.push((v >> 8) & 0xFF); };
    const BA = a => { for (const b of a) out.push(b); };

    let palBits = 1;
    while ((1 << palBits) < palette.length) palBits++;
    const palSize = 1 << palBits;

    // Header
    BA([0x47,0x49,0x46,0x38,0x39,0x61]); // GIF89a
    // Logical Screen Descriptor
    W(width); W(height);
    B(0x80 | (palBits - 1));
    B(0); B(0);
    // Global Color Table
    for (let i = 0; i < palSize; i++) {
        const c = palette[i] || [0, 0, 0];
        BA(c);
    }
    // Netscape loop extension
    BA([0x21,0xFF,0x0B,78,69,84,83,67,65,80,69,50,46,48,3,1,0,0,0]);

    function lzwEncode(pixels, minCS) {
        const cc = 1 << minCS, ec = cc + 1;
        let cs = minCS + 1, nc = ec + 1;
        const tbl = new Map();
        const res = []; let buf = 0, bb = 0;
        const wb = code => {
            buf |= code << bb; bb += cs;
            while (bb >= 8) { res.push(buf & 0xFF); buf >>= 8; bb -= 8; }
        };
        wb(cc);
        let prefix = pixels[0];
        for (let i = 1; i < pixels.length; i++) {
            const sfx = pixels[i], key = (prefix << 12) | sfx;
            if (tbl.has(key)) {
                prefix = tbl.get(key);
            } else {
                wb(prefix);
                if (nc < 4096) {
                    tbl.set(key, nc++);
                    if (nc > (1 << cs) && cs < 12) cs++;
                } else {
                    wb(cc); tbl.clear(); cs = minCS + 1; nc = ec + 1;
                }
                prefix = sfx;
            }
        }
        wb(prefix); wb(ec);
        if (bb > 0) res.push(buf & 0xFF);
        return res;
    }

    for (const pixels of frames) {
        BA([0x21,0xF9,0x04,0x00]);
        W(delayCs);
        BA([0x00,0x00]);
        BA([0x2C]);
        W(0); W(0); W(width); W(height);
        B(0x00);
        const minCS = Math.max(2, palBits);
        B(minCS);
        const lzw = lzwEncode(pixels, minCS);
        for (let pos = 0; pos < lzw.length;) {
            const bsz = Math.min(255, lzw.length - pos);
            B(bsz);
            for (let i = 0; i < bsz; i++) out.push(lzw[pos++]);
        }
        B(0x00);
    }
    B(0x3B);
    return new Uint8Array(out);
}


// ─── RENDER ALL FRAMES & DOWNLOAD ─────────────────────────────────────────────

function handleDownload() {
    const status = document.getElementById("gifStatus");
    status.textContent = "Generating GIF…";
    document.getElementById("btnDownload").disabled = true;

    setTimeout(() => {
        try {
            const W = CONFIG.anchoCartel;
            const H = CONFIG.altoCartel;
            const gs = CONFIG.gridSize;
            const colsVisible = Math.floor(W / gs);
            const rowsVisible = Math.floor(H / gs);
            const totalCols   = mapaBitsTexto[0] ? mapaBitsTexto[0].length : 0;

            if (totalCols === 0) {
                status.textContent = "Generate a sign first!";
                document.getElementById("btnDownload").disabled = false;
                return;
            }

            const PAL_OFF = [55, 25, 25];
            const PAL_ON  = [255, 60, 60];
            const PAL_BG  = [20, 10, 10];
            const palette = [PAL_OFF, PAL_ON, PAL_BG];

            const frames   = [];
            const gifDelay = Math.round((1000 / CONFIG.fps) / 10);

            for (let offset = 0; offset < totalCols; offset++) {
                const pixels = new Uint8Array(W * H);
                pixels.fill(2);

                for (let col = 0; col < colsVisible; col++) {
                    for (let row = 0; row < rowsVisible; row++) {
                        const tx  = col + offset;
                        const on  = tx < totalCols &&
                                    mapaBitsTexto[row] &&
                                    mapaBitsTexto[row][tx] === 1;
                        const colorIdx = on ? 1 : 0;
                        const px = col * gs;
                        const py = row * gs;
                        for (let dy = 0; dy < gs - 1; dy++) {
                            for (let dx = 0; dx < gs - 1; dx++) {
                                const idx = (py + dy) * W + (px + dx);
                                if (idx < pixels.length) pixels[idx] = colorIdx;
                            }
                        }
                    }
                }
                frames.push(pixels);
            }

            status.textContent = `Encoding ${frames.length} frames…`;

            setTimeout(() => {
                try {
                    const gifData = makeAnimatedGIF(W, H, frames, gifDelay, palette);
                    const blob    = new Blob([gifData], { type: 'image/gif' });
                    const url     = URL.createObjectURL(blob);
                    const a       = document.createElement('a');
                    a.href        = url;
                    a.download    = 'signbot.gif';
                    a.click();
                    URL.revokeObjectURL(url);
                    const kb = (gifData.length / 1024).toFixed(1);
                    status.textContent = `[OK] Downloaded! (${kb} KB, ${frames.length} frames)`;
                } catch (e) {
                    status.textContent = "Error encoding GIF: " + e.message;
                    console.error(e);
                } finally {
                    document.getElementById("btnDownload").disabled = false;
                }
            }, 50);

        } catch (e) {
            status.textContent = "Error: " + e.message;
            document.getElementById("btnDownload").disabled = false;
        }
    }, 50);
}


// ─── INIT ─────────────────────────────────────────────────────────────────────

document.getElementById("btnGenerar").addEventListener("click", () => {
    CONFIG.texto       = document.getElementById("txtMensaje").value;
    CONFIG.anchoCartel = parseInt(document.querySelector('input[name="width"]:checked').value);
    iniciarMarquesina();
});

document.getElementById("btnDownload").addEventListener("click", handleDownload);

iniciarMarquesina();
//___end___