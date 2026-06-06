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
import pn from 'awesome-phonenumber';

const router = express.Router();

// Custom 8-character pairing code (A-Z / 0-9 only)
const CUSTOM_PAIR_CODE = 'VOLTRAMD';

function removeFile(FilePath) {
    try {
        if (!fs.existsSync(FilePath)) return false;
        fs.rmSync(FilePath, { recursive: true, force: true });
    } catch (e) {
        console.error('Error removing file:', e);
    }
}

router.get('/', async (req, res) => {
    let num = req.query.number;
    if (!num) {
        return res.status(400).send({ code: 'Missing number parameter.' });
    }

    const sessionId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const dirs = `./sessions/${sessionId}`;
    if (!fs.existsSync('./sessions')) fs.mkdirSync('./sessions', { recursive: true });

    num = num.replace(/[^0-9]/g, '');
    const phone = pn('+' + num);
    if (!phone.valid) {
        if (!res.headersSent) {
            return res.status(400).send({
                code: 'Invalid phone number. Use full international format (e.g. 15551234567).',
            });
        }
        return;
    }
    num = phone.number.e164.replace('+', '');

    async function initiateSession() {
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
                // Browser MUST be a "compatible" desktop string for pair codes to link.
                browser: Browsers.macOS('Safari'),
                markOnlineOnConnect: false,
                generateHighQualityLinkPreview: false,
                syncFullHistory: false,
                defaultQueryTimeoutMs: 60_000,
                connectTimeoutMs: 60_000,
                keepAliveIntervalMs: 25_000,
                retryRequestDelayMs: 350,
            });

            VoltraBot.ev.on('creds.update', saveCreds);

            VoltraBot.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect } = update;

                if (connection === 'open') {
                    console.log('✅ Linked successfully — sending creds.json');
                    // give WA a moment to fully establish the session before sending
                    await delay(4000);

                    try {
                        const sessionVoltra = fs.readFileSync(dirs + '/creds.json');
                        const userJid = jidNormalizedUser(num + '@s.whatsapp.net');

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

                        console.log('📄 creds.json delivered');
                        await delay(1500);
                        await VoltraBot.ws.close();
                    } catch (error) {
                        console.error('❌ Error sending session:', error);
                    } finally {
                        removeFile(dirs);
                    }
                }

                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    if (
                        statusCode === DisconnectReason.loggedOut ||
                        statusCode === 401 ||
                        statusCode === DisconnectReason.connectionReplaced
                    ) {
                        console.log('❌ Logged out / replaced — cleanup');
                        removeFile(dirs);
                    } else if (statusCode === DisconnectReason.restartRequired) {
                        console.log('🔁 Restart required — reconnecting');
                        initiateSession();
                    } else {
                        console.log('🔁 Connection closed (' + statusCode + ')');
                    }
                }
            });

            if (!VoltraBot.authState.creds.registered) {
                await delay(1500);
                try {
                    let code = await VoltraBot.requestPairingCode(num, CUSTOM_PAIR_CODE);
                    code = code?.match(/.{1,4}/g)?.join('-') || code;
                    console.log({ num, code });
                    if (!res.headersSent) {
                        res.send({ code });
                    }
                } catch (error) {
                    console.error('Error requesting pairing code:', error);
                    if (!res.headersSent) {
                        res.status(503).send({
                            code: 'Failed to get pairing code. Check the number and try again.',
                        });
                    }
                }
            }
        } catch (err) {
            console.error('Error initializing session:', err);
            if (!res.headersSent) {
                res.status(503).send({ code: 'Service Unavailable' });
            }
        }
    }

    await initiateSession();
});

process.on('uncaughtException', (err) => {
    const e = String(err);
    if (
        e.includes('conflict') ||
        e.includes('not-authorized') ||
        e.includes('Socket connection timeout') ||
        e.includes('rate-overlimit') ||
        e.includes('Connection Closed') ||
        e.includes('Timed Out') ||
        e.includes('Value not found') ||
        e.includes('Stream Errored') ||
        e.includes('statusCode: 515') ||
        e.includes('statusCode: 503')
    ) return;
    console.log('Caught exception:', err);
});

export default router;
