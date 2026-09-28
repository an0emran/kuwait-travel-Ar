// Text-to-Speech Service using AI

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TTSService {
    constructor() {
        this.audioCache = new Map();
        this.cacheDir = path.join(__dirname, '../audio_cache');

        // Create cache directory if it doesn't exist
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
    }

    /**
     * Generate speech using Google Cloud Text-to-Speech (free tier available)
     */
    async generateWithGoogle(text, apiKey) {
        try {
            const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    input: { text },
                    voice: {
                        languageCode: 'ar-XA', // Arabic
                        name: 'ar-XA-Wavenet-C', // High quality neural voice
                        ssmlGender: 'MALE'
                    },
                    audioConfig: {
                        audioEncoding: 'MP3',
                        speakingRate: 0.95,
                        pitch: 0,
                        volumeGainDb: 0
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Google TTS failed: ${response.statusText}`);
            }

            const data = await response.json();
            return {
                provider: 'google',
                audio: data.audioContent, // Base64 encoded MP3
                format: 'mp3'
            };
        } catch (error) {
            console.error('Google TTS Error:', error);
            throw error;
        }
    }

    /**
     * Generate speech using PlayHT (free tier available)
     */
    async generateWithPlayHT(text, apiKey, userId) {
        try {
            const response = await fetch('https://api.play.ht/api/v2/tts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'AUTHORIZATION': apiKey,
                    'X-USER-ID': userId
                },
                body: JSON.stringify({
                    text,
                    voice: 'ar-XA-Standard-D', // Arabic voice
                    output_format: 'mp3',
                    speed: 0.95
                })
            });

            if (!response.ok) {
                throw new Error(`PlayHT failed: ${response.statusText}`);
            }

            const data = await response.json();
            return {
                provider: 'playht',
                audioUrl: data.url,
                format: 'mp3'
            };
        } catch (error) {
            console.error('PlayHT Error:', error);
            throw error;
        }
    }

    /**
     * Generate speech using ResponsiveVoice (free, browser-based)
     * This returns instructions for the client to use ResponsiveVoice JS library
     */
    generateWithResponsiveVoice(text) {
        return {
            provider: 'responsivevoice',
            text,
            voice: 'Arabic Male', // Arabic male voice
            instructions: 'Use ResponsiveVoice.speak() on client side'
        };
    }

    /**
     * Generate speech using Google Translate (Unofficial - Fallback)
     * Handles long text by chunking
     */
    async generateWithGoogleTranslate(text) {
        try {
            // Google Translate TTS has a limit of around 200 chars
            const MAX_CHUNK_LENGTH = 180;

            // Helper to split text
            const splitText = (fullText) => {
                const chunks = [];
                let currentText = fullText;

                while (currentText.length > 0) {
                    if (currentText.length <= MAX_CHUNK_LENGTH) {
                        chunks.push(currentText);
                        break;
                    }

                    // Find nearest space or punctuation before limit
                    let splitIndex = currentText.lastIndexOf(' ', MAX_CHUNK_LENGTH);
                    if (splitIndex === -1) splitIndex = MAX_CHUNK_LENGTH;

                    chunks.push(currentText.substring(0, splitIndex));
                    currentText = currentText.substring(splitIndex).trim();
                }
                return chunks;
            };

            const chunks = splitText(text);
            const audioBuffers = [];

            for (const chunk of chunks) {
                if (!chunk) continue;
                const encodedText = encodeURIComponent(chunk);
                const response = await fetch(`https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=ar&client=tw-ob`, {
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });

                if (!response.ok) {
                    console.warn(`Chunk TTS failed: ${response.statusText}`);
                    continue;
                }

                const arrayBuffer = await response.arrayBuffer();
                audioBuffers.push(Buffer.from(arrayBuffer));
            }

            if (audioBuffers.length === 0) {
                throw new Error("No audio generated from chunks");
            }

            // Concatenate all buffers
            const finalBuffer = Buffer.concat(audioBuffers);
            const audioBase64 = finalBuffer.toString('base64');

            return {
                provider: 'google-translate',
                audio: audioBase64,
                format: 'mp3'
            };
        } catch (error) {
            console.error('Google Translate TTS Error:', error);
            return this.generateWithResponsiveVoice(text);
        }
    }

    /**
     * Main generate method - tries different providers
     */
    async generate(text, provider = 'auto', apiKeys = {}) {
        // Check cache first
        const cacheKey = `${provider}_${text.substring(0, 100)}`;
        if (this.audioCache.has(cacheKey)) {
            return this.audioCache.get(cacheKey);
        }

        let result;

        try {
            switch (provider) {
                case 'google':
                    try {
                        if (!apiKeys.google) throw new Error('Google API key missing');
                        result = await this.generateWithGoogle(text, apiKeys.google);
                    } catch (e) {
                        console.warn('Google Cloud TTS failed, trying Translate fallback...');
                        result = await this.generateWithGoogleTranslate(text);
                    }
                    break;

                case 'playht':
                    if (!apiKeys.playht || !apiKeys.playhtUserId) throw new Error('PlayHT credentials missing');
                    result = await this.generateWithPlayHT(text, apiKeys.playht, apiKeys.playhtUserId);
                    break;

                case 'responsivevoice':
                case 'browser':
                    result = this.generateWithResponsiveVoice(text);
                    break;

                case 'auto':
                default:
                    // Try providers in order of preference
                    if (apiKeys.google) {
                        try {
                            result = await this.generateWithGoogle(text, apiKeys.google);
                        } catch (e) {
                            result = await this.generateWithGoogleTranslate(text);
                        }
                    } else {
                        // Fallback to Google Translate
                        result = await this.generateWithGoogleTranslate(text);
                    }
                    break;
            }

            // Cache the result
            this.audioCache.set(cacheKey, result);

            // Limit cache size
            if (this.audioCache.size > 100) {
                const firstKey = this.audioCache.keys().next().value;
                this.audioCache.delete(firstKey);
            }

            return result;
        } catch (error) {
            console.error('TTS generation failed:', error);
            // Fallback to Google Translate if everything else fails
            try {
                return await this.generateWithGoogleTranslate(text);
            } catch (fallbackErr) {
                return this.generateWithResponsiveVoice(text);
            }
        }
    }

    /**
     * Save audio to file
     */
    async saveAudio(audioBase64, filename) {
        const filepath = path.join(this.cacheDir, filename);
        const buffer = Buffer.from(audioBase64, 'base64');
        await fs.promises.writeFile(filepath, buffer);
        return filepath;
    }
}

export const ttsService = new TTSService();
