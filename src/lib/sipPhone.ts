
// WebRTC softphone wrapper around JsSIP. Browser-only (used by the Dialer).
import JsSIP from "jssip";

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
//     pc.addEventListener("track", (ev: RTCTrackEvent) => {
//       console.log("[sip] track received, kind:", ev.track.kind);

//       if (ev.streams && ev.streams[0]) {
//         this.remoteAudio.srcObject = ev.streams[0];
//       } else {
//         const remoteStream = new MediaStream();
//         remoteStream.addTrack(ev.track);
//         this.remoteAudio.srcObject = remoteStream;
//       }

//       // Keep muted until confirmed — ARI controls ringback on server side
//       this.remoteAudio.volume = 1.0;
//       this.remoteAudio.play().catch((err) => {
//         console.warn("[sip] audio play failed:", err);
//       });
//     });
//   }

//   private attachSession(session: any) {
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
    

//     session.on("peerconnection", (e: any) => {
//       this.attachRemoteAudio(e.peerconnection);
//     });

//     // ✅ Mute remote audio during ringing — ARI plays tone:ring via Asterisk
//     // so we don't need local beep, just block early media
//     session.on("progress", () => {
//       this.remoteAudio.muted = true;
//       this.events.onCallState?.("ringing");
//     });

//     session.on("accepted", () => {
//       this.answered = true;
//       this.events.onCallState?.("in-call");
//     });

//     session.on("confirmed", () => {
//       this.answered = true;
//       this.events.onCallState?.("in-call");

//       // Re-attach stream from receivers
//       if (session.connection) {
//         const receivers = session.connection.getReceivers();
//         if (receivers.length > 0) {
//           const remoteStream = new MediaStream();
//           receivers.forEach((r: RTCRtpReceiver) => {
//             if (r.track) remoteStream.addTrack(r.track);
//           });
//           if (remoteStream.getTracks().length > 0) {
//             this.remoteAudio.srcObject = remoteStream;
//           }
//         }
//       }

//       // ✅ Wait 500ms for Asterisk to flush ringback RTP then unmute
//       setTimeout(() => {
//         this.remoteAudio.muted = false;
//         this.remoteAudio.volume = 1.0;
//         this.remoteAudio.play().catch(() => {});
//       }, 500);
//     });

//     session.on("ended", (e: any) => this.finish(e));
//     session.on("failed", (e: any) => this.finish(e));
//   }

//   private finish(e: any) {
//     const answered = this.answered;
//     const cause = (e && e.cause) || "Ended";
//     this.session = null;
//     this.answered = false;
//     this.remoteAudio.srcObject = null;
//     this.remoteAudio.muted = false;
//     this.events.onCallState?.("ended");
//     this.events.onCallEnded?.({ answered, cause });
//   }

//   call(target: string, domain: string, gatewayEndpoint?: string) {
//     if (this.session || !this.ua) return;
//     this.events.onCallState?.("connecting");
//     const extraHeaders = gatewayEndpoint ? [`X-Gateway: ${gatewayEndpoint}`] : [];
//     this.ua.call(`sip:${target}@${domain}`, {
//       mediaConstraints: { audio: true, video: false },
//       pcConfig: { iceServers: [] },
//       extraHeaders,
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

    // 🆕 PREDICTIVE: server agent ke extension pe leg originate karta hai,
    // browser ko incoming INVITE milti hai — usse auto-answer karo.
    if (session.direction === "incoming") {
      try {
        session.answer({
          mediaConstraints: { audio: true, video: false },
          pcConfig: { iceServers: [] },
        });
      } catch {
        /* ignore */
      }
    }

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
