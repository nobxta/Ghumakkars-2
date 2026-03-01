import { EventEmitter } from 'events';

// Dynamic imports for optional dependencies
let baileys: any = null;
let qrcode: any = null;
let pinoLogger: any = null;
let boom: any = null;

// Only try to require at runtime, not at build time
if (typeof window === 'undefined' && typeof require !== 'undefined') {
  try {
    baileys = require('@whiskeysockets/baileys');
  } catch (e) {
    // Package not installed
  }

  try {
    qrcode = require('qrcode');
  } catch (e) {
    // Package not installed
  }

  try {
    pinoLogger = require('pino');
  } catch (e) {
    // Package not installed
  }

  try {
    boom = require('@hapi/boom');
  } catch (e) {
    // Package not installed
  }
}

/** Max reconnect attempts with backoff before giving up */
const MAX_RECONNECT_ATTEMPTS = 5;
/** Backoff delays in ms: 1s, 2s, 4s, 8s, 10s (capped at 10s) */
const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 10000];
const INIT_OUTCOME_TIMEOUT_MS = 45000;
const HEALTH_CHECK_INTERVAL_MS = 30000;
const ZOMBIE_THRESHOLD_MS = 120000;
const SEND_READY_WAIT_MS = 20000;

class WhatsAppService extends EventEmitter {
  private socket: any = null;
  private isReady: boolean = false;
  private isInitializing: boolean = false;
  private qrCode: string | null = null;
  private initializingPromise: Promise<void> | null = null;
  private reconnectAttempts: number = 0;
  private healthInterval: NodeJS.Timeout | null = null;
  private lastConnectionUpdateAt: number = 0;
  private qrEmittedThisCycle: boolean = false;
  private isReconnecting: boolean = false;

  constructor() {
    super();
  }

  /**
   * Initialize WhatsApp client with Baileys
   * QR code will be generated and can be retrieved via getQRCode()
   * Session will be saved automatically in .wwebjs_auth/
   * Idempotent: concurrent callers receive the same promise; only one socket at a time.
   */
  async initialize(): Promise<void> {
    if (!baileys || !qrcode || !pinoLogger || !boom) {
      throw new Error('@whiskeysockets/baileys and dependencies are not installed. Please install with: npm install @whiskeysockets/baileys qrcode pino @hapi/boom');
    }

    // Do not destroy existing healthy socket (prevents 440 replace loop)
    if (this.socket && this.isReady) {
      return;
    }

    if (this.initializingPromise !== null) {
      return this.initializingPromise;
    }

    // Clean up any existing socket before initializing (only one socket at a time)
    if (this.socket) {
      try {
        await this.destroySocketOnly();
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    this.isInitializing = true;
    this.initializingPromise = this.runInitialize();
    try {
      await this.initializingPromise;
    } finally {
      this.initializingPromise = null;
    }
  }

  /**
   * Internal: create socket and wait for first QR, connection open, or timeout.
   * Does not clear initializingPromise; caller owns that.
   */
  private async runInitialize(): Promise<void> {
    this.qrEmittedThisCycle = false;
    console.log('[WA] INIT START');
    let resolveInitOutcome: (() => void) | null = null;
    const initDone = new Promise<void>((r) => { resolveInitOutcome = r; });
    const timeoutId = setTimeout(() => {
      if (resolveInitOutcome) {
        console.log('[WA] DISCONNECTED (init timeout)');
        this.destroySocketOnly().then(() => {
          if (resolveInitOutcome) {
            resolveInitOutcome();
            resolveInitOutcome = null;
          }
        }).catch(() => {
          if (resolveInitOutcome) {
            resolveInitOutcome();
            resolveInitOutcome = null;
          }
        });
      }
    }, INIT_OUTCOME_TIMEOUT_MS);

    const done = () => {
      if (resolveInitOutcome) {
        clearTimeout(timeoutId);
        resolveInitOutcome();
        resolveInitOutcome = null;
      }
    };

    try {
      const { useMultiFileAuthState: createAuthState, fetchLatestBaileysVersion, makeWASocket, DisconnectReason } = baileys;
      
      if (typeof require !== 'undefined') {
        try {
          const fs = require('fs');
          const path = require('path');
          const sessionDir = path.join(process.cwd(), '.wwebjs_auth');
          if (fs.existsSync(sessionDir)) {
            const files = fs.readdirSync(sessionDir);
            // #region agent log
            fetch('http://127.0.0.1:7245/ingest/bb06f43a-5249-47f3-a9d7-c841981aadc5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/whatsapp.ts:85',message:'Session directory exists',data:{fileCount:files.length,files},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
          }
        } catch (error) {
          // Ignore
        }
      }
      
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const { state, saveCreds } = await createAuthState('.wwebjs_auth');
      
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/bb06f43a-5249-47f3-a9d7-c841981aadc5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/whatsapp.ts:95',message:'Auth state loaded',data:{hasCreds:!!state.creds,hasKeys:!!state.keys,credsKeys:state.creds ? Object.keys(state.creds) : [],registered:state.creds?.registered},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      
      const { version } = await fetchLatestBaileysVersion();
      const logger = pinoLogger({ level: 'silent' });

      this.socket = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: state,
        browser: ['Ghumakkars', 'Chrome', '1.0.0'],
        getMessage: async (key) => {
          return {
            conversation: 'Message not available'
          };
        },
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
      });

      // Handle connection updates
      this.socket.ev.on('connection.update', (update: any) => {
        this.lastConnectionUpdateAt = Date.now();
        const { connection, lastDisconnect, qr } = update;

        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/bb06f43a-5249-47f3-a9d7-c841981aadc5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/whatsapp.ts:105',message:'connection.update event',data:{connection,qr:qr?'present':'missing',hasLastDisconnect:!!lastDisconnect},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion

        // QR Code: emit only once per init cycle; clear on open/reconnect
        if (qr && !this.qrEmittedThisCycle) {
          this.qrEmittedThisCycle = true;
          this.qrCode = qr;
          this.emit('qr', qr);
          console.log('[WA] QR GENERATED');
          done();
          qrcode.toDataURL(qr).then((url: string) => {
            // #region agent log
            fetch('http://127.0.0.1:7245/ingest/bb06f43a-5249-47f3-a9d7-c841981aadc5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/whatsapp.ts:120',message:'QR code image generated',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
          }).catch((err: any) => {
            console.error('Error generating QR code:', err);
            // #region agent log
            fetch('http://127.0.0.1:7245/ingest/bb06f43a-5249-47f3-a9d7-c841981aadc5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/whatsapp.ts:123',message:'QR code image generation failed',data:{error:err.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
          });
        }

        // Connection status
        if (connection === 'close') {
          const errorMessage = lastDisconnect?.error?.message || 'none';
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          console.log('[WA] DISCONNECTED', statusCode);

          // #region agent log
          fetch('http://127.0.0.1:7245/ingest/bb06f43a-5249-47f3-a9d7-c841981aadc5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/whatsapp.ts:130',message:'Connection closed',data:{errorMessage,statusCode,isInitializing:this.isInitializing,hasQR:!!this.qrCode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
          // #endregion

          const { DisconnectReason } = baileys;
          const is515 = statusCode === 515;
          const is408 = statusCode === 408;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;
          const isBadSession = statusCode === DisconnectReason.badSession;
          const isConnectionClosed = statusCode === DisconnectReason.connectionClosed;

          // 515 restart required / 408 QR refs ended: do NOT clear session; destroy socket only and reconnect with backoff
          if (is515 || is408) {
            done();
            if (this.isReconnecting) return;
            this.isReconnecting = true;
            this.destroySocketOnly().then(() => {
              this.isInitializing = false;
              this.reconnectAttempts = Math.min(this.reconnectAttempts + 1, MAX_RECONNECT_ATTEMPTS + 1);
              if (this.reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
                this.isReconnecting = false;
                this.isReady = false;
                this.emit('fatal_disconnect');
                console.log('[WA] RECONNECT ABORTED (max attempts)');
                return;
              }
              const delayMs = RECONNECT_DELAYS_MS[this.reconnectAttempts - 1] ?? 10000;
              console.log('[WA] RECONNECT ATTEMPT', this.reconnectAttempts);
              setTimeout(() => {
                this.initializingPromise = null;
                this.initialize().catch(console.error);
              }, delayMs);
            }).catch(() => {
              this.isReconnecting = false;
            });
            return;
          }
          
          // #region agent log
          fetch('http://127.0.0.1:7245/ingest/bb06f43a-5249-47f3-a9d7-c841981aadc5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/whatsapp.ts:140',message:'Close event analysis',data:{isLoggedOut,isBadSession,isConnectionClosed,statusCode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
          
          // If logged out or bad session, clear session and force new QR
          if (isLoggedOut || isBadSession) {
            // #region agent log
            fetch('http://127.0.0.1:7245/ingest/bb06f43a-5249-47f3-a9d7-c841981aadc5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/whatsapp.ts:145',message:'Clearing invalid session',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            done();
            this.clearSession().catch(console.error);
            this.isReady = false;
            this.isInitializing = false;
            this.qrCode = null;
            this.emit('disconnected', 'Session invalid - need to re-authenticate');
            return;
          }
          
          // If connection closed due to error (like bufferUtil), try to reconnect once
          // but only if we haven't received QR code yet
          if (this.isInitializing && !this.qrCode && errorMessage.includes('bufferUtil')) {
            // Wait a moment and try again - bufferutil should be available now
            setTimeout(() => {
              if (this.isInitializing && !this.qrCode) {
                this.initialize().catch(console.error);
              }
            }, 1000);
            return;
          }
          
          // If we're still initializing and haven't received QR code yet, 
          // check if we should clear session and retry
          if (this.isInitializing && !this.qrCode) {
            // #region agent log
            fetch('http://127.0.0.1:7245/ingest/bb06f43a-5249-47f3-a9d7-c841981aadc5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/whatsapp.ts:165',message:'Connection closed during init without QR',data:{errorMessage,statusCode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            
            // If connection closed without QR and we have credentials, session might be invalid
            // Clear session and retry after a delay
            if (statusCode && statusCode !== DisconnectReason.connectionClosed) {
              setTimeout(async () => {
                if (this.isInitializing && !this.qrCode) {
                  // #region agent log
                  fetch('http://127.0.0.1:7245/ingest/bb06f43a-5249-47f3-a9d7-c841981aadc5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/whatsapp.ts:172',message:'Clearing session and retrying for QR',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
                  // #endregion
                  await this.clearSession();
                  this.initialize().catch(console.error);
                }
              }, 2000);
            }
            // Don't reset isInitializing - let it continue to wait for QR
            // The connection might close and reopen, or QR might come in next update
            return;
          }
          
          // Previously ready and connection closed: reconnect with exponential backoff
          if (this.isReady) {
            this.isReady = false;
            this.emit('disconnected', 'Connection closed, will reconnect');
            if (this.isReconnecting) return;
            this.isReconnecting = true;
            this.destroySocketOnly().then(() => {
              this.reconnectAttempts = Math.min(this.reconnectAttempts + 1, MAX_RECONNECT_ATTEMPTS + 1);
              if (this.reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
                this.isReconnecting = false;
                this.emit('fatal_disconnect');
                console.log('[WA] RECONNECT ABORTED (max attempts)');
                return;
              }
              const delayMs = RECONNECT_DELAYS_MS[this.reconnectAttempts - 1] ?? 10000;
              console.log('[WA] RECONNECT ATTEMPT', this.reconnectAttempts);
              setTimeout(() => {
                this.initializingPromise = null;
                this.initialize().catch(console.error);
              }, delayMs);
            }).catch(() => {
              this.isReconnecting = false;
            });
          } else {
            done();
            this.isReady = false;
            if (this.qrCode || !this.isInitializing) {
              this.isInitializing = false;
            }
          }
        } else if (connection === 'open') {
          this.isReconnecting = false;
          this.reconnectAttempts = 0;
          this.isReady = true;
          this.isInitializing = false;
          this.qrCode = null;
          this.qrEmittedThisCycle = true;
          console.log('[WA] CONNECTED');
          this.emit('ready');
          done();
          this.startHealthMonitor();
        } else if (connection === 'connecting') {
          // Connecting state
        }
      });

      // Save credentials when they update
      this.socket.ev.on('creds.update', saveCreds);

      await initDone;
    } catch (error: any) {
      console.error('Error initializing WhatsApp client:', error);
      this.isInitializing = false;
      throw error;
    }
  }

  /**
   * Wait for client to be ready
   */
  async waitForReady(): Promise<void> {
    if (this.isReady) {
      return;
    }

    if (!this.socket) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WhatsApp client initialization timeout'));
      }, 60000); // 60 second timeout

      this.once('ready', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.once('disconnected', (reason: string) => {
        if (reason.includes('Logged out')) {
          clearTimeout(timeout);
          reject(new Error('WhatsApp session logged out. Please re-authenticate.'));
        }
      });
    });
  }

  /**
   * Ensure socket is ready for send: if not ready or no socket, run init.
   * Does NOT use raw WebSocket readyState (Baileys manages connection internally).
   */
  private async ensureReadyForSend(): Promise<void> {
    if (!this.isReady || !this.socket) {
      await this.initialize();
    }
  }

  /**
   * Send WhatsApp message to a phone number
   * @param phoneNumber Phone number in format: 91XXXXXXXXXX (country code + number, no + or spaces)
   * @param message Message text to send
   */
  async sendMessage(phoneNumber: string, message: string): Promise<any> {
    if (!baileys) {
      throw new Error('@whiskeysockets/baileys is not installed. Please install with: npm install @whiskeysockets/baileys qrcode pino @hapi/boom');
    }

    await this.ensureReadyForSend();
    if (!this.socket) {
      throw new Error('WhatsApp client not initialized');
    }

    const formattedNumber = phoneNumber.replace(/[+\s-]/g, '');
    let finalNumber = formattedNumber;
    if (!formattedNumber.startsWith('91') && formattedNumber.length === 10) {
      finalNumber = `91${formattedNumber}`;
    }
    const jid = `${finalNumber}@s.whatsapp.net`;

    console.log('[WA] SEND ATTEMPT', { isReady: this.isReady, hasSocket: !!this.socket });

    try {
      const sentMessage = await this.socket.sendMessage(jid, { text: message });
      console.log(`WhatsApp message sent to ${phoneNumber}`);
      return sentMessage;
    } catch (error: any) {
      console.error(`Error sending WhatsApp message to ${phoneNumber}:`, error);
      this.triggerSafeReconnect();
      await this.initialize();
      if (!this.socket) {
        throw new Error('WhatsApp client not ready. Please connect in admin settings and try again.');
      }
      try {
        const retryMessage = await this.socket.sendMessage(jid, { text: message });
        console.log(`WhatsApp message sent to ${phoneNumber} (retry)`);
        return retryMessage;
      } catch (retryError: any) {
        throw new Error('WhatsApp client not ready. Please connect in admin settings and try again.');
      }
    }
  }

  /**
   * Send booking confirmation message with details and group link
   */
  async sendBookingConfirmation(
    phoneNumber: string,
    bookingDetails: {
      bookingId: string;
      userName: string;
      tripTitle: string;
      destination: string;
      startDate: string;
      endDate?: string;
      totalAmount: number;
      numberOfParticipants: number;
      whatsappGroupLink?: string;
    }
  ): Promise<any> {
    const formatDate = (dateStr: string) => {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    };

    const dateRange = bookingDetails.endDate
      ? `${formatDate(bookingDetails.startDate)} - ${formatDate(bookingDetails.endDate)}`
      : formatDate(bookingDetails.startDate);

    let message = `🎉 *Booking Confirmed!*\n\n`;
    message += `Hello ${bookingDetails.userName},\n\n`;
    message += `Your booking has been confirmed!\n\n`;
    message += `📋 *Booking Details:*\n`;
    message += `• Trip: ${bookingDetails.tripTitle}\n`;
    message += `• Destination: ${bookingDetails.destination}\n`;
    message += `• Dates: ${dateRange}\n`;
    message += `• Participants: ${bookingDetails.numberOfParticipants}\n`;
    message += `• Booking ID: ${bookingDetails.bookingId.slice(0, 8).toUpperCase()}\n`;
    message += `• Amount Paid: ₹${bookingDetails.totalAmount.toLocaleString('en-IN')}\n\n`;

    if (bookingDetails.whatsappGroupLink) {
      message += `👥 *Join Your Trip Group:*\n`;
      message += `${bookingDetails.whatsappGroupLink}\n\n`;
      message += `Join the group to connect with other travelers and receive trip updates.\n\n`;
    }

    message += `You will receive additional trip details before the departure date.\n\n`;
    message += `Happy Traveling! 🌍✈️\n\n`;
    message += `_Ghumakkars Team_`;

    return this.sendMessage(phoneNumber, message);
  }

  /**
   * Check if client is ready
   */
  getReady(): boolean {
    if (!baileys) {
      return false;
    }
    return this.isReady;
  }

  /**
   * Check if WhatsApp package is installed
   */
  isPackageInstalled(): boolean {
    return baileys !== null && qrcode !== null && pinoLogger !== null && boom !== null;
  }

  /**
   * Get QR code (if available)
   */
  async getQRCode(): Promise<string | null> {
    // Check if QR code is already stored
    if (this.qrCode) {
      return this.qrCode;
    }
    
    if (this.isReady) {
      return null;
    }
    
    return new Promise((resolve) => {
      // Check again in case QR code was set between check and promise creation
      if (this.qrCode) {
        resolve(this.qrCode);
        return;
      }

      const qrHandler = (qr: string) => {
        resolve(qr);
      };

      this.once('qr', qrHandler);

      // Timeout after 5 seconds (shorter for polling)
      setTimeout(() => {
        this.removeListener('qr', qrHandler);
        resolve(null);
      }, 5000);
    });
  }

  /**
   * Get QR code as data URL (image)
   */
  async getQRCodeImage(): Promise<string | null> {
    if (!qrcode) {
      return null;
    }

    const qr = await this.getQRCode();
    if (!qr) {
      return null;
    }

    try {
      return await qrcode.toDataURL(qr);
    } catch (error) {
      console.error('Error generating QR code image:', error);
      return null;
    }
  }

  /**
   * Start health monitor: every 30s check socket liveness and zombie state.
   * Stops automatically on disconnect/destroy via clearInterval in destroySocketOnly.
   */
  private startHealthMonitor(): void {
    if (this.healthInterval) return;
    this.healthInterval = setInterval(() => {
      if (!this.socket || !this.isReady) return;
      const now = Date.now();
      const ws = this.socket.ws;
      const readyState = ws && typeof ws.readyState !== 'undefined' ? ws.readyState : null;
      if (readyState !== null && readyState !== 1) {
        console.log('[WA] HEALTH CHECK FAIL (ws not open)');
        this.triggerSafeReconnect();
        return;
      }
      if (now - this.lastConnectionUpdateAt > ZOMBIE_THRESHOLD_MS) {
        console.log('[WA] HEALTH CHECK FAIL (zombie)');
        this.triggerSafeReconnect();
        return;
      }
      try {
        if (typeof this.socket.sendPresenceUpdate === 'function') {
          this.socket.sendPresenceUpdate('available');
        }
      } catch (err) {
        console.log('[WA] HEALTH CHECK FAIL');
        this.triggerSafeReconnect();
      }
    }, HEALTH_CHECK_INTERVAL_MS);
  }

  /**
   * Trigger reconnect without clearing session. After max attempts, emit fatal_disconnect and stop.
   * Lifecycle lock: only one reconnect flow at a time; isReconnecting cleared on open or max attempts.
   */
  private triggerSafeReconnect(): void {
    if (this.isReconnecting) {
      return;
    }
    this.isReconnecting = true;
    this.reconnectAttempts = Math.min(this.reconnectAttempts + 1, MAX_RECONNECT_ATTEMPTS + 1);
    if (this.reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
      this.isReconnecting = false;
      this.isReady = false;
      this.emit('fatal_disconnect');
      console.log('[WA] RECONNECT ABORTED (max attempts)');
      this.destroySocketOnly().catch(console.error);
      return;
    }
    const delayMs = RECONNECT_DELAYS_MS[this.reconnectAttempts - 1] ?? 10000;
    console.log('[WA] RECONNECT ATTEMPT', this.reconnectAttempts);
    this.destroySocketOnly().then(() => {
      setTimeout(() => {
        this.initializingPromise = null;
        this.initialize().catch(console.error);
      }, delayMs);
    }).catch(() => {
      this.isReconnecting = false;
    });
  }

  /**
   * Destroy socket and reset flags only. Does NOT clear session files.
   * Removes all listeners to prevent leaks; clears health interval.
   */
  private async destroySocketOnly(): Promise<void> {
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = null;
    }
    if (this.socket) {
      try {
        if (this.socket.ev && typeof this.socket.ev.removeAllListeners === 'function') {
          this.socket.ev.removeAllListeners();
        }
        await this.socket.end(undefined);
      } catch (error) {
        // Ignore errors during cleanup
      }
      this.socket = null;
    }
    this.isReady = false;
    this.isInitializing = false;
    this.qrCode = null;
  }

  /**
   * Destroy client (socket + flags). clearSession() also removes session files.
   */
  async destroy(): Promise<void> {
    await this.destroySocketOnly();
  }

  /**
   * Clear session and reset state
   * Use this if you need to force a new QR code scan
   */
  async clearSession(): Promise<void> {
    await this.destroy();
    
    // Clear session files
    if (typeof require !== 'undefined') {
      try {
        const fs = require('fs');
        const path = require('path');
        const sessionDir = path.join(process.cwd(), '.wwebjs_auth');
        if (fs.existsSync(sessionDir)) {
          fs.rmSync(sessionDir, { recursive: true, force: true });
        }
      } catch (error) {
        console.error('Error clearing session:', error);
      }
    }
  }
}

// Singleton instance
declare global {
  var __whatsappService__: WhatsAppService | undefined;
}

export function getWhatsAppService(): WhatsAppService {
  if (!global.__whatsappService__) {
    global.__whatsappService__ = new WhatsAppService();
  }
  return global.__whatsappService__;
}

export default getWhatsAppService;
