// Minimal dependency-free PNG decode (8-bit RGB/RGBA, non-interlaced) and RGBA encode.
const zlib = require('zlib');

function decode(buf) {
    let pos = 8, W = 0, H = 0, ct = 0; const idat = [];
    while (pos < buf.length) {
        const len = buf.readUInt32BE(pos), type = buf.toString('latin1', pos + 4, pos + 8), d = buf.subarray(pos + 8, pos + 8 + len);
        if (type === 'IHDR') { W = d.readUInt32BE(0); H = d.readUInt32BE(4); if (d[8] !== 8 || d[12] !== 0) throw new Error('unsupported PNG'); ct = d[9]; }
        else if (type === 'IDAT') idat.push(d);
        pos += 12 + len;
    }
    const bpp = ct === 6 ? 4 : ct === 2 ? 3 : 0;
    if (!bpp) throw new Error('unsupported colour type ' + ct);
    const raw = zlib.inflateSync(Buffer.concat(idat)), stride = W * bpp, out = Buffer.alloc(W * H * 4);
    let prev = Buffer.alloc(stride);
    for (let y = 0; y < H; y++) {
        const f = raw[y * (stride + 1)], line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
        for (let i = 0; i < stride; i++) {
            const a = i >= bpp ? line[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
            let v = line[i];
            if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
            else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
            line[i] = v & 255;
        }
        for (let x = 0; x < W; x++) {
            out[(y * W + x) * 4] = line[x * bpp]; out[(y * W + x) * 4 + 1] = line[x * bpp + 1];
            out[(y * W + x) * 4 + 2] = line[x * bpp + 2]; out[(y * W + x) * 4 + 3] = bpp === 4 ? line[x * bpp + 3] : 255;
        }
        prev = line;
    }
    return { W, H, px: out };
}

const crcT = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc(b) { let c = 0xFFFFFFFF; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
}
function encode(W, H, px) {
    const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 6;
    const raw = Buffer.alloc((W * 4 + 1) * H);
    for (let y = 0; y < H; y++) px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
module.exports = { decode, encode };
