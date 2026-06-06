// // WebRTC softphone wrapper around JsSIP. Browser-only (used by the Dialer).
// import JsSIP from 'jssip';

// export type CallState = 'idle' | 'connecting' | 'ringing' | 'in-call' | 'ended';

// export interface SipPhoneEvents {
//   onRegistered?: (registered: boolean) => void;
//   onCallState?: (state: CallState) => void;
//   onCallEnded?: (info: { answered: boolean; cause: string }) => void;
// }

// export interface SipStartConfig {
//   wssUrl: string;
//   sipUri: string;
//   authUser: string;
//   password: string;
//   displayName: string;
// }

// export class SipPhone {
//   private ua: any = null;
//   private session: any = null;
//   private answered = false;

//   constructor(
//     private remoteAudio: HTMLAudioElement,
//     private events: SipPhoneEvents,
//   ) {}

//   start(cfg: SipStartConfig) {
//     const socket = new JsSIP.WebSocketInterface(cfg.wssUrl);
//     this.ua = new JsSIP.UA({
//       sockets: [socket],
//       uri: cfg.sipUri,
//       authorization_user: cfg.authUser,
//       password: cfg.password,
//       display_name: cfg.displayName,
//       register: true,
//       session_timers: false,
//     });

//     this.ua.on('registered', () => this.events.onRegistered?.(true));
//     this.ua.on('unregistered', () => this.events.onRegistered?.(false));
//     this.ua.on('registrationFailed', () => this.events.onRegistered?.(false));
//     this.ua.on('newRTCSession', (e: any) => this.attachSession(e.session));

//     this.ua.start();
//   }

//   private attachSession(session: any) {
//     // Only one call at a time; reject a second incoming call.
//     if (this.session) {
//       if (session.direction === 'incoming') {
//         try {
//           session.terminate({ status_code: 486 });
//         } catch {
//           /* ignore */
//         }
//       }
//       return;
//     }
//     this.session = session;
//     this.answered = false;

//     session.on('peerconnection', (e: any) => {
//       e.peerconnection.addEventListener('track', (ev: any) => {
//         if (ev.streams && ev.streams[0]) {
//           this.remoteAudio.srcObject = ev.streams[0];
//           this.remoteAudio.play().catch(() => {});
//         }
//       });
//     });

//     session.on('progress', () => this.events.onCallState?.('ringing'));
//     session.on('accepted', () => {
//       this.answered = true;
//       this.events.onCallState?.('in-call');
//     });
//     session.on('confirmed', () => {
//       this.answered = true;
//       this.events.onCallState?.('in-call');
//     });
//     session.on('ended', (e: any) => this.finish(e));
//     session.on('failed', (e: any) => this.finish(e));
//   }

//   private finish(e: any) {
//     const answered = this.answered;
//     const cause = (e && e.cause) || 'Ended';
//     this.session = null;
//     this.answered = false;
//     this.events.onCallState?.('ended');
//     this.events.onCallEnded?.({ answered, cause });
//   }

//   call(target: string, domain: string) {
//     if (this.session || !this.ua) return;
//     this.events.onCallState?.('connecting');
//     this.ua.call(`sip:${target}@${domain}`, {
//       mediaConstraints: { audio: true, video: false },
//       pcConfig: { iceServers: [] },
//     });
//   }

//   hangup() {
//     if (this.session) {
//       try {
//         this.session.terminate();
//       } catch {
//         /* ignore */
//       }
//       this.session = null;
//     }
//   }

//   sendDTMF(tone: string) {
//     if (this.session && this.session.isEstablished()) {
//       try {
//         this.session.sendDTMF(tone);
//       } catch {
//         /* ignore */
//       }
//     }
//   }

//   isInCall() {
//     return !!this.session;
//   }

//   stop() {
//     this.hangup();
//     try {
//       this.ua?.stop();
//     } catch {
//       /* ignore */
//     }
//     this.ua = null;
//   }
// }

// WebRTC softphone wrapper around JsSIP. Browser-only (used by the Dialer).
// import JsSIP from "jssip";

// export type CallState = "idle" | "connecting" | "ringing" | "in-call" | "ended";

// export interface SipPhoneEvents {
//   onRegistered?: (registered: boolean) => void;
//   onCallState?: (state: CallState) => void;
//   onCallEnded?: (info: { answered: boolean; cause: string }) => void;
// }

// export interface SipStartConfig {
//   wssUrl: string;
//   sipUri: string;
//   authUser: string;
//   password: string;
//   displayName: string;
// }

// export class SipPhone {
//   private ua: any = null;
//   private session: any = null;
//   private answered = false;

//   constructor(
//     private remoteAudio: HTMLAudioElement,
//     private events: SipPhoneEvents,
//   ) {}

//   start(cfg: SipStartConfig) {
//     const socket = new JsSIP.WebSocketInterface(cfg.wssUrl);
//     this.ua = new JsSIP.UA({
//       sockets: [socket],
//       uri: cfg.sipUri,
//       authorization_user: cfg.authUser,
//       password: cfg.password,
//       display_name: cfg.displayName,
//       register: true,
//       session_timers: false,
//     });

//     this.ua.on("registered", () => this.events.onRegistered?.(true));
//     this.ua.on("unregistered", () => this.events.onRegistered?.(false));
//     this.ua.on("registrationFailed", () => this.events.onRegistered?.(false));
//     this.ua.on("newRTCSession", (e: any) => this.attachSession(e.session));

//     this.ua.start();
//   }

//   private attachRemoteAudio(pc: RTCPeerConnection) {
//     // ✅ FIX 1: Listen on peer connection directly for remote tracks
//     pc.addEventListener("track", (ev: RTCTrackEvent) => {
//       console.log("[sip] track received, kind:", ev.track.kind);

//       if (ev.streams && ev.streams[0]) {
//         // Normal path — stream attached to track
//         this.remoteAudio.srcObject = ev.streams[0];
//       } else {
//         // ✅ FIX 2: Fallback — build stream manually from track
//         const remoteStream = new MediaStream();
//         remoteStream.addTrack(ev.track);
//         this.remoteAudio.srcObject = remoteStream;
//       }

//       // ✅ FIX 3: Unmute and play
//       this.remoteAudio.muted = false;
//       this.remoteAudio.volume = 1.0;
//       this.remoteAudio.play().catch((err) => {
//         console.warn("[sip] audio play failed:", err);
//       });
//     });
//   }

//   private attachSession(session: any) {
//     // Only one call at a time
//     if (this.session) {
//       if (session.direction === "incoming") {
//         try {
//           session.terminate({ status_code: 486 });
//         } catch {
//           /* ignore */
//         }
//       }
//       return;
//     }
//     this.session = session;
//     this.answered = false;

//     // ✅ FIX 4: Attach audio listener immediately on peerconnection creation
//     session.on("peerconnection", (e: any) => {
//       this.attachRemoteAudio(e.peerconnection);
//     });

//     // ✅ FIX 5: Also handle confirmed event to re-attach audio (handles re-INVITE)
//     session.on("confirmed", () => {
//       this.answered = true;
//       this.events.onCallState?.("in-call");

//       // Re-attach audio in case track came before peerconnection event
//       if (session.connection) {
//         const receivers = session.connection.getReceivers();
//         if (receivers.length > 0) {
//           const remoteStream = new MediaStream();
//           receivers.forEach((r: RTCRtpReceiver) => {
//             if (r.track) remoteStream.addTrack(r.track);
//           });
//           if (remoteStream.getTracks().length > 0) {
//             this.remoteAudio.srcObject = remoteStream;
//             this.remoteAudio.muted = false;
//             this.remoteAudio.volume = 1.0;
//             this.remoteAudio.play().catch(() => {});
//           }
//         }
//       }
//     });

//     session.on("progress", () => this.events.onCallState?.("ringing"));
//     session.on("accepted", () => {
//       this.answered = true;
//       this.events.onCallState?.("in-call");
//     });
//     session.on("ended", (e: any) => this.finish(e));
//     session.on("failed", (e: any) => this.finish(e));
//   }

//   private finish(e: any) {
//     const answered = this.answered;
//     const cause = (e && e.cause) || "Ended";
//     this.session = null;
//     this.answered = false;
//     // ✅ FIX 6: Clear audio on call end
//     this.remoteAudio.srcObject = null;
//     this.events.onCallState?.("ended");
//     this.events.onCallEnded?.({ answered, cause });
//   }

//   call(target: string, domain: string) {
//     if (this.session || !this.ua) return;
//     this.events.onCallState?.("connecting");
//     this.ua.call(`sip:${target}@${domain}`, {
//       mediaConstraints: { audio: true, video: false },
//       pcConfig: { iceServers: [] },
//     });
//   }

//   hangup() {
//     if (this.session) {
//       try {
//         this.session.terminate();
//       } catch {
//         /* ignore */
//       }
//       this.session = null;
//     }
//   }

//   sendDTMF(tone: string) {
//     if (this.session && this.session.isEstablished()) {
//       try {
//         this.session.sendDTMF(tone);
//       } catch {
//         /* ignore */
//       }
//     }
//   }

//   isInCall() {
//     return !!this.session;
//   }

//   stop() {
//     this.hangup();
//     try {
//       this.ua?.stop();
//     } catch {
//       /* ignore */
//     }
//     this.ua = null;
//   }
// }

// WebRTC softphone wrapper around JsSIP
// import JsSIP from "jssip";

// export type CallState = "idle" | "connecting" | "ringing" | "in-call" | "ended";

// export interface SipPhoneEvents {
//   onRegistered?: (registered: boolean) => void;
//   onCallState?: (state: CallState) => void;
//   onCallEnded?: (info: { answered: boolean; cause: string }) => void;
// }

// export interface SipStartConfig {
//   wssUrl: string;
//   sipUri: string;
//   authUser: string;
//   password: string;
//   displayName: string;
// }

// export class SipPhone {
//   private ua: any = null;
//   private session: any = null;
//   private answered = false;

//   constructor(
//     private remoteAudio: HTMLAudioElement,
//     private events: SipPhoneEvents,
//   ) {}

//   start(cfg: SipStartConfig) {
//     const socket = new JsSIP.WebSocketInterface(cfg.wssUrl);

//     this.ua = new JsSIP.UA({
//       sockets: [socket],
//       uri: cfg.sipUri,
//       authorization_user: cfg.authUser,
//       password: cfg.password,
//       display_name: cfg.displayName,
//       register: true,
//       session_timers: false,
//     });

//     this.ua.on("registered", () => this.events.onRegistered?.(true));

//     this.ua.on("unregistered", () => this.events.onRegistered?.(false));

//     this.ua.on("registrationFailed", () => this.events.onRegistered?.(false));

//     this.ua.on("newRTCSession", (e: any) => this.attachSession(e.session));

//     this.ua.start();
//   }

//   private stopRingtone() {
//     const ring = document.getElementById("ringtone") as HTMLAudioElement;

//     if (ring) {
//       ring.pause();
//       ring.currentTime = 0;
//     }
//   }

//   private attachRemoteAudio(pc: RTCPeerConnection) {
//     pc.addEventListener("track", (ev: RTCTrackEvent) => {
//       console.log("[sip] track received:", ev.track.kind);

//       let remoteStream: MediaStream;

//       if (ev.streams && ev.streams.length > 0) {
//         remoteStream = ev.streams[0];
//       } else {
//         remoteStream = new MediaStream();
//         remoteStream.addTrack(ev.track);
//       }

//       this.remoteAudio.srcObject = remoteStream;

//       this.remoteAudio.muted = false;
//       this.remoteAudio.volume = 1;
//       this.remoteAudio.autoplay = true;

//       this.remoteAudio.play().catch((err) => {
//         console.warn("Audio play error:", err);
//       });
//     });
//   }

//   private attachSession(session: any) {
//     if (this.session) {
//       if (session.direction === "incoming") {
//         try {
//           session.terminate({
//             status_code: 486,
//           });
//         } catch {}
//       }
//       return;
//     }

//     this.session = session;
//     this.answered = false;

//     session.on("peerconnection", (e: any) => {
//       this.attachRemoteAudio(e.peerconnection);
//     });

//     session.on("progress", () => {
//       this.events.onCallState?.("ringing");
//     });

//     session.on("accepted", () => {
//       console.log("[sip] accepted");

//       this.answered = true;

//       this.stopRingtone();

//       this.events.onCallState?.("in-call");
//     });

//     session.on("confirmed", () => {
//       console.log("[sip] confirmed");

//       this.answered = true;

//       this.stopRingtone();

//       if (session.connection) {
//         const receivers = session.connection.getReceivers();

//         const stream = new MediaStream();

//         receivers.forEach((r: RTCRtpReceiver) => {
//           if (r.track) {
//             stream.addTrack(r.track);
//           }
//         });

//         if (stream.getTracks().length > 0) {
//           this.remoteAudio.srcObject = stream;

//           this.remoteAudio.play();
//         }
//       }

//       this.events.onCallState?.("in-call");
//     });

//     session.on("ended", (e: any) => this.finish(e));

//     session.on("failed", (e: any) => this.finish(e));
//   }

//   private finish(e: any) {
//     const answered = this.answered;

//     const cause = e?.cause || "Ended";

//     this.stopRingtone();

//     this.remoteAudio.pause();

//     this.remoteAudio.srcObject = null;

//     this.session = null;
//     this.answered = false;

//     this.events.onCallState?.("ended");

//     this.events.onCallEnded?.({
//       answered,
//       cause,
//     });
//   }

//   call(target: string, domain: string) {
//     if (this.session || !this.ua) return;

//     this.events.onCallState?.("connecting");

//     this.ua.call(`sip:${target}@${domain}`, {
//       mediaConstraints: {
//         audio: true,
//         video: false,
//       },
//       pcConfig: {
//         iceServers: [],
//       },
//     });
//   }

//   hangup() {
//     if (this.session) {
//       try {
//         this.session.terminate();
//       } catch {}

//       this.session = null;
//     }
//   }

//   sendDTMF(tone: string) {
//     if (this.session && this.session.isEstablished()) {
//       try {
//         this.session.sendDTMF(tone);
//       } catch {}
//     }
//   }

//   isInCall() {
//     return !!this.session;
//   }

//   stop() {
//     this.hangup();

//     try {
//       this.ua?.stop();
//     } catch {}

//     this.ua = null;
//   }
// }

// WebRTC softphone wrapper around JsSIP. Browser-only (used by the Dialer).
import JsSIP from "jssip";

export type CallState = "idle" | "connecting" | "ringing" | "in-call" | "ended";

export interface SipPhoneEvents {
  onRegistered?: (registered: boolean) => void;
  onCallState?: (state: CallState) => void;
  onCallEnded?: (info: { answered: boolean; cause: string }) => void;
}

export interface SipStartConfig {
  wssUrl: string;
  sipUri: string;
  authUser: string;
  password: string;
  displayName: string;
}

export class SipPhone {
  private ua: any = null;
  private session: any = null;
  private answered = false;

  constructor(
    private remoteAudio: HTMLAudioElement,
    private events: SipPhoneEvents,
  ) {}

  start(cfg: SipStartConfig) {
    const socket = new JsSIP.WebSocketInterface(cfg.wssUrl);
    this.ua = new JsSIP.UA({
      sockets: [socket],
      uri: cfg.sipUri,
      authorization_user: cfg.authUser,
      password: cfg.password,
      display_name: cfg.displayName,
      register: true,
      session_timers: false,
    });

    this.ua.on("registered", () => this.events.onRegistered?.(true));
    this.ua.on("unregistered", () => this.events.onRegistered?.(false));
    this.ua.on("registrationFailed", () => this.events.onRegistered?.(false));
    this.ua.on("newRTCSession", (e: any) => this.attachSession(e.session));

    this.ua.start();
  }

  private attachRemoteAudio(pc: RTCPeerConnection) {
    pc.addEventListener("track", (ev: RTCTrackEvent) => {
      console.log("[sip] track received, kind:", ev.track.kind);

      if (ev.streams && ev.streams[0]) {
        this.remoteAudio.srcObject = ev.streams[0];
      } else {
        const remoteStream = new MediaStream();
        remoteStream.addTrack(ev.track);
        this.remoteAudio.srcObject = remoteStream;
      }

      // Keep muted until confirmed — ARI controls ringback on server side
      this.remoteAudio.volume = 1.0;
      this.remoteAudio.play().catch((err) => {
        console.warn("[sip] audio play failed:", err);
      });
    });
  }

  private attachSession(session: any) {
    if (this.session) {
      if (session.direction === "incoming") {
        try {
          session.terminate({ status_code: 486 });
        } catch {
          /* ignore */
        }
      }
      return;
    }
    this.session = session;
    this.answered = false;

    session.on("peerconnection", (e: any) => {
      this.attachRemoteAudio(e.peerconnection);
    });

    // ✅ Mute remote audio during ringing — ARI plays tone:ring via Asterisk
    // so we don't need local beep, just block early media
    session.on("progress", () => {
      this.remoteAudio.muted = true;
      this.events.onCallState?.("ringing");
    });

    session.on("accepted", () => {
      this.answered = true;
      this.events.onCallState?.("in-call");
    });

    session.on("confirmed", () => {
      this.answered = true;
      this.events.onCallState?.("in-call");

      // Re-attach stream from receivers
      if (session.connection) {
        const receivers = session.connection.getReceivers();
        if (receivers.length > 0) {
          const remoteStream = new MediaStream();
          receivers.forEach((r: RTCRtpReceiver) => {
            if (r.track) remoteStream.addTrack(r.track);
          });
          if (remoteStream.getTracks().length > 0) {
            this.remoteAudio.srcObject = remoteStream;
          }
        }
      }

      // ✅ Wait 500ms for Asterisk to flush ringback RTP then unmute
      setTimeout(() => {
        this.remoteAudio.muted = false;
        this.remoteAudio.volume = 1.0;
        this.remoteAudio.play().catch(() => {});
      }, 500);
    });

    session.on("ended", (e: any) => this.finish(e));
    session.on("failed", (e: any) => this.finish(e));
  }

  private finish(e: any) {
    const answered = this.answered;
    const cause = (e && e.cause) || "Ended";
    this.session = null;
    this.answered = false;
    this.remoteAudio.srcObject = null;
    this.remoteAudio.muted = false;
    this.events.onCallState?.("ended");
    this.events.onCallEnded?.({ answered, cause });
  }

  call(target: string, domain: string, gatewayEndpoint?: string) {
    if (this.session || !this.ua) return;
    this.events.onCallState?.("connecting");
    const extraHeaders = gatewayEndpoint ? [`X-Gateway: ${gatewayEndpoint}`] : [];
    this.ua.call(`sip:${target}@${domain}`, {
      mediaConstraints: { audio: true, video: false },
      pcConfig: { iceServers: [] },
      extraHeaders,
    });
  }

  hangup() {
    if (this.session) {
      try {
        this.session.terminate();
      } catch {
        /* ignore */
      }
      this.session = null;
    }
  }

  sendDTMF(tone: string) {
    if (this.session && this.session.isEstablished()) {
      try {
        this.session.sendDTMF(tone);
      } catch {
        /* ignore */
      }
    }
  }

  isInCall() {
    return !!this.session;
  }

  stop() {
    this.hangup();
    try {
      this.ua?.stop();
    } catch {
      /* ignore */
    }
    this.ua = null;
  }
}
