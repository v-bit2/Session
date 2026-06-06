import express from 'express';
import fs from 'fs';
import pino from 'pino';
import {
    default as makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser,
    fetchLatestBaileysVersion,
    DisconnectReason,
} from 'baileys';
import QRCode from 'qrcode';

const router = express.Router();

function removeFile(FilePath) {
    try {
        if (!fs.existsSync(FilePath)) return false;
        fs.rmSync(FilePath, { recursive: true, force: true });
        return true;
    } catch (e) {
        console.error('Error removing file:', e);
        return false;
    }
}

router.get('/', async (req, res) => {
    const sessionId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const dirs = `./qr_sessions/session_${sessionId}`;
    if (!fs.existsSync('./qr_sessions')) fs.mkdirSync('./qr_sessions', { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(dirs);
    const logger = pino({ level: 'fatal' }).child({ level: 'fatal' });

    try {
        const { version } = await fetchLatestBaileysVersion();
        const VoltraBot = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            logger,
            browser: Browsers.macOS('Safari'),
            markOnlineOnConnect: false,
            generateHighQualityLinkPreview: false,
            syncFullHistory: false,
        });

        VoltraBot.ev.on('creds.update', saveCreds);

        VoltraBot.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr && !res.headersSent) {
                try {
                    const qrDataUrl = await QRCode.toDataURL(qr);
                    res.send({ qr: qrDataUrl });
                } catch (e) {
                    console.error('QR encode error:', e);
                    if (!res.headersSent) res.status(500).send({ error: 'QR failed' });
                }
            }

            if (connection === 'open') {
                console.log('✅ QR Linked — sending creds.json');
                await delay(4000);
                try {
                    const sessionVoltra = fs.readFileSync(dirs + '/creds.json');
                    const userJid = jidNormalizedUser(VoltraBot.user.id);
                    await VoltraBot.sendMessage(userJid, {
                        document: sessionVoltra,
                        mimetype: 'application/json',
                        fileName: 'creds.json',
                    });
                    await VoltraBot.sendMessage(userJid, {
                        text:
                            `⚠️ Do not share this file with anybody ⚠️\n\n` +
                            `┌┤✑  Thanks for using *VOLTRA MD*\n` +
                            `│└────────────┈ ⳹\n` +
                            `│© 2025 Drey · VOLTRA MD\n` +
                            `└─────────────────┈ ⳹\n`,
                    });
                    await delay(1500);
                    await VoltraBot.ws.close();
                } catch (e) {
                    console.error('Error sending session:', e);
                } finally {
                    removeFile(dirs);
                }
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                if (statusCode !== DisconnectReason.restartRequired) {
                    removeFile(dirs);
                }
            }
        });
    } catch (err) {
        console.error('QR init error:', err);
        if (!res.headersSent) res.status(503).send({ error: 'Service Unavailable' });
    }
});

export default router;
