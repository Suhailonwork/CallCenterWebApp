// /* =====================================================================
//  *  ari-app.js  -  Asterisk ARI call control for Next.js project
//  *
//  *  Gateway selection is DYNAMIC: the outbound trunk is looked up from
//  *  the database based on which employee (SIP extension) is calling and
//  *  which campaign they are assigned to. Nothing is hardcoded.
//  *
//  *  Chain:  extension -> users.id -> campaign_assignments -> campaign_gateways
//  *          -> gsm_gateways.asterisk_endpoint  (e.g. "gw1")
//  * ===================================================================== */

// "use strict";

// const ari = require("ari-client");
// const mysql = require("mysql2/promise");

// // ---------------------------------------------------------------------
// //  MySQL connection pool (reads the same .env that server.mjs loaded).
// //  This is infrastructure config, not business data, so it lives in .env.
// // ---------------------------------------------------------------------

// module.exports = function startAri(config) {
//   const db = mysql.createPool({
//     host: process.env.DB_HOST,
//     port: Number(process.env.DB_PORT || 3306),
//     user: process.env.DB_USER,
//     password: process.env.DB_PASSWORD,
//     database: process.env.DB_NAME,
//     waitForConnections: true,
//     connectionLimit: 5,
//   });
//   console.log(
//     `[ari] DB pool: ${process.env.DB_USER}@${process.env.DB_HOST}/${process.env.DB_NAME}`,
//   );
//   const {
//     ariUrl,
//     ariUser,
//     ariPass,
//     ariApp,
//     trunkEndpoint, // fallback only — used if DB lookup finds nothing
//     browserEndpoint,
//     outboundPrefix,
//     callerId,
//   } = config;

//   // Make fetch available (Node 18+ has it built-in)
//   const fetch = globalThis.fetch || require("node-fetch");

//   // -------------------------------------------------------------------
//   //  Look up the active outbound gateway for a given SIP extension.
//   //  Returns the asterisk_endpoint string (e.g. "gw1") or null.
//   // -------------------------------------------------------------------
//   async function getGatewayForExtension(extension) {
//     const [rows] = await db.query(
//       `SELECT g.asterisk_endpoint AS endpoint
//          FROM employees e
//          JOIN campaign_assignments ca ON ca.employee_id = e.user_id
//          JOIN campaign_gateways cg     ON cg.campaign_id = ca.campaign_id
//          JOIN gsm_gateways g           ON g.id = cg.gateway_id
//         WHERE e.sip_extension = ? AND g.status = 'active'
//         LIMIT 1`,
//       [extension],
//     );
//     return rows[0] ? rows[0].endpoint : null;
//   }

//    async function isRecordingEnabledForExtension(extension) {
//      const [rows] = await db.query(
//        `SELECT c.recording_enabled
//          FROM employees e
//          JOIN campaign_assignments ca ON ca.employee_id = e.user_id
//          JOIN campaigns c             ON c.id = ca.campaign_id
//         WHERE e.sip_extension = ?
//         ORDER BY c.recording_enabled DESC
//         LIMIT 1`,
//        [extension],
//      );
//      return rows[0] ? Number(rows[0].recording_enabled) === 1 : false;
//    }

//   function connect() {
//     ari
//       .connect(ariUrl, ariUser, ariPass)
//       .then((client) => {
//         client.on("StasisStart", (event, channel) => {
//           const role = (event.args && event.args[0]) || "";
//           if (role === "outbound") {
//             handleOutbound(client, channel).catch((e) =>
//               console.error("[ari][outbound] " + (e && e.message)),
//             );
//           } else if (role === "inbound") {
//             handleInbound(client, channel).catch((e) =>
//               console.error("[ari][inbound] " + (e && e.message)),
//             );
//           }
//         });

//         client.on("WebSocketError", (err) =>
//           console.error("[ari] websocket error: " + (err && err.message)),
//         );

//         client.start(ariApp);
//         console.log("[ari] connected to " + ariUrl + ' app="' + ariApp + '"');
//       })
//       .catch((err) => {
//         console.error("[ari] connection failed: " + (err && err.message));
//         console.error("[ari] retrying in 5s...");
//         setTimeout(connect, 5000);
//       });
//   }

//   /* ------------------------------------------------------------------
//    *  OUTBOUND  -  browser -> GSM gateway trunk
//    * ------------------------------------------------------------------ */
//   async function handleOutbound(client, browserChannel) {
//     const dialed =
//       (browserChannel.dialplan && browserChannel.dialplan.exten) || "";
//     const target = (outboundPrefix || "") + dialed;

//     // ----------------------------------------------------------------
//     //  DYNAMIC gateway selection.
//     //  Figure out which employee is calling from the channel name
//     //  (e.g. "PJSIP/6001-00000004"), then look up their campaign's
//     //  gateway in the database. Falls back to the .env default only
//     //  if nothing is found.
//     // ----------------------------------------------------------------
//     const extMatch = (browserChannel.name || "").match(/PJSIP\/(\d+)-/);
//     const callerExt = extMatch ? extMatch[1] : null;

//     let selectedTrunk = trunkEndpoint; // fallback .env default
//     if (callerExt) {
//       try {
//         const gw = await getGatewayForExtension(callerExt);
//         if (gw) {
//           selectedTrunk = gw;
//           console.log(
//             `[ari] ext ${callerExt} -> gateway ${selectedTrunk} (from DB)`,
//           );
//         } else {
//           console.warn(
//             `[ari] ext ${callerExt}: no gateway in DB, default ${selectedTrunk}`,
//           );
//         }
//       } catch (e) {
//         console.error("[ari] gateway lookup failed: " + (e && e.message));
//       }
//     } else {
//       console.warn("[ari] could not parse extension from channel name");
//     }

//     let done = false;
//     let ringback = null;

//     const bridge = client.Bridge();
//     const outId = "out-" + browserChannel.id;
//     const outLeg = client.Channel(outId);

//     const end = async () => {
//       if (done) return;
//       done = true;
//       try {
//         await outLeg.hangup();
//       } catch (e) {
//         /* gone */
//       }
//       try {
//         await browserChannel.hangup();
//       } catch (e) {
//         /* gone */
//       }
//       try {
//         await bridge.destroy();
//       } catch (e) {
//         /* gone */
//       }
//     };

//     // Far end answered -> stop ringback then bridge
//     // Far end answered -> stop ringback then bridge
//     outLeg.on("StasisStart", async () => {
//       if (done) return;
//       try {
//         if (ringback) await ringback.stop();
//       } catch (e) {
//         /* ignore */
//       }
//       try {
//         await bridge.addChannel({ channel: outId });
//       } catch (e) {
//         /* ignore */
//       }
//       console.log("[ari] outbound connected");

//       // ── Conditional recording: only if the caller's campaign has it ON ──
//       if (callerExt) {
//         try {
//           const recOn = await isRecordingEnabledForExtension(callerExt);
//           if (recOn) {
//             // Predictable filename: rec-{ext}-{dialed}-{epoch}
//             const fname = "rec-" + callerExt + "-" + dialed + "-" + Date.now();
//             await bridge.record({
//               name: fname,
//               format: "wav",
//               ifExists: "overwrite",
//             });

//             console.log("[ari] recording started: " + fname + ".wav");
//                try {
//                  await db.query(
//                    `INSERT INTO pending_recordings (extension, phone_number, filename)
//                  VALUES (?,?,?)`,
//                    [callerExt, dialed, fname + ".wav"],
//                  );
//                } catch (e) {
//                  console.error(
//                    "[ari] pending_recording insert failed: " + (e && e.message),
//                  );
//                }
//           } else {
//             console.log("[ari] recording OFF for ext " + callerExt);
//           }
//         } catch (e) {
//           console.error("[ari] recording start failed: " + (e && e.message));
//         }
//       }
//     });

//     outLeg.on("StasisEnd", end);
//     outLeg.on("ChannelDestroyed", end);
//     browserChannel.on("StasisEnd", end);
//     browserChannel.on("ChannelDestroyed", end);

//     try {
//       // Answer browser leg, create bridge, play ringback
//       await browserChannel.answer();
//       await bridge.create({ type: "mixing" });
//       await bridge.addChannel({ channel: browserChannel.id });

//       // Play ringback via Asterisk (stops early media leaking)
//       try {
//         ringback = await browserChannel.play({ media: "tone:ring" });
//       } catch (e) {
//         /* ringback optional */
//       }

//       // Originate outbound call through the selected (dynamic) gateway
//       await outLeg.originate({
//         channelId: outId,
//         endpoint: "PJSIP/" + target + "@" + selectedTrunk,
//         app: ariApp,
//         appArgs: "dialed",
//         callerId: callerId || dialed,
//         timeout: 45,
//       });
//     } catch (err) {
//       console.error("[ari] originate failed: " + (err && err.message));
//       await end();
//     }
//   }

//   /* ------------------------------------------------------------------
//    *  INBOUND  -  Dinstar trunk -> browser
//    * ------------------------------------------------------------------ */
//   async function handleInbound(client, trunkChannel) {
//     const fromNumber =
//       (trunkChannel.caller && trunkChannel.caller.number) || "unknown";

//     let done = false;
//     const bridge = client.Bridge();
//     const brId = "in-" + trunkChannel.id;
//     const browserLeg = client.Channel(brId);

//     const end = async () => {
//       if (done) return;
//       done = true;
//       try {
//         await browserLeg.hangup();
//       } catch (e) {
//         /* gone */
//       }
//       try {
//         await trunkChannel.hangup();
//       } catch (e) {
//         /* gone */
//       }
//       try {
//         await bridge.destroy();
//       } catch (e) {
//         /* gone */
//       }
//     };

//     // Browser answered -> bridge both legs
//     browserLeg.on("StasisStart", async () => {
//       if (done) return;
//       try {
//         await trunkChannel.answer();
//       } catch (e) {
//         /* ignore */
//       }
//       try {
//         await bridge.addChannel({ channel: trunkChannel.id });
//       } catch (e) {
//         /* ignore */
//       }
//       try {
//         await bridge.addChannel({ channel: brId });
//       } catch (e) {
//         /* ignore */
//       }
//       console.log("[ari] inbound connected from " + fromNumber);
//     });

//     browserLeg.on("StasisEnd", end);
//     browserLeg.on("ChannelDestroyed", end);
//     trunkChannel.on("StasisEnd", end);
//     trunkChannel.on("ChannelDestroyed", end);

//     try {
//       await bridge.create({ type: "mixing" });

//       // Find first online agent endpoint dynamically via ARI
//       let targetEndpoint = browserEndpoint; // fallback to .env default
//       try {
//         const res = await fetch(`${ariUrl}/ari/endpoints/PJSIP`, {
//           headers: {
//             Authorization:
//               "Basic " +
//               Buffer.from(`${ariUser}:${ariPass}`).toString("base64"),
//           },
//         });
//         if (res.ok) {
//           const endpoints = await res.json();
//           // Find first online agent (extension starts with 6)
//           const online = endpoints.find(
//             (ep) =>
//               ep.resource &&
//               /^6\d+$/.test(ep.resource) &&
//               ep.state === "online",
//           );
//           if (online) {
//             targetEndpoint = online.resource;
//             console.log(
//               "[ari] inbound routing to online agent: " + targetEndpoint,
//             );
//           } else {
//             console.warn(
//               "[ari] no online agents found, trying default: " + targetEndpoint,
//             );
//           }
//         }
//       } catch (e) {
//         console.warn(
//           "[ari] could not query endpoints, using default:",
//           e && e.message,
//         );
//       }

//       await browserLeg.originate({
//         channelId: brId,
//         endpoint: "PJSIP/" + targetEndpoint,
//         app: ariApp,
//         appArgs: "tobrowser",
//         callerId: fromNumber,
//         timeout: 40,
//       });
//     } catch (err) {
//       console.error("[ari] inbound originate failed: " + JSON.stringify(err));
//       await end();
//     }
//   }

//   connect();
// };






/* =====================================================================
 *  ari-app.js  -  Asterisk ARI call control for Next.js project
 *
 *  Gateway selection is DYNAMIC: the outbound trunk is looked up from
 *  the database based on which employee (SIP extension) is calling and
 *  which campaign they are assigned to. Nothing is hardcoded.
 *
 *  Chain:  extension -> users.id -> campaign_assignments -> campaign_gateways
 *          -> gsm_gateways.asterisk_endpoint  (e.g. "gw1")
 *
 *  + PREDICTIVE (Phase 1): server hi GSM call originate karta hai (agent ke
 *    bina). Far end uthe -> agent ka leg originate + bridge + screen pop.
 * ===================================================================== */

"use strict";

const ari = require("ari-client");
const mysql = require("mysql2/promise");

// ---------------------------------------------------------------------
//  MySQL connection pool (reads the same .env that server.mjs loaded).
//  This is infrastructure config, not business data, so it lives in .env.
// ---------------------------------------------------------------------

module.exports = function startAri(config) {
  const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
  });
  console.log(
    `[ari] DB pool: ${process.env.DB_USER}@${process.env.DB_HOST}/${process.env.DB_NAME}`,
  );
  const {
    ariUrl,
    ariUser,
    ariPass,
    ariApp,
    trunkEndpoint, // fallback only — used if DB lookup finds nothing
    browserEndpoint,
    outboundPrefix,
    callerId,
  } = config;

  // Make fetch available (Node 18+ has it built-in)
  const fetch = globalThis.fetch || require("node-fetch");

  // 🆕 Predictive: engine se aane wale callbacks + per-call attempt info
  let onConnectCb = () => {};
  let onFailedCb = () => {};
  const predAttempts = new Map(); // channelId -> { campaignId, agentId, agentExt, contact, gateway }
  let client = null; // module scope, taaki originatePredictive use kar sake
  // ARI is considered "connected" once ari.connect() has resolved (REST client
  // present). node-ari-client keeps the Stasis WebSocket reconnected on its own,
  // so we deliberately do NOT flip a flag on transient WebSocketError events —
  // doing that previously stranded the engine in a permanent "paused" state.

  // -------------------------------------------------------------------
  //  Look up the active outbound gateway for a given SIP extension.
  //  Returns the asterisk_endpoint string (e.g. "gw1") or null.
  // -------------------------------------------------------------------
  async function getGatewayForExtension(extension) {
    const [rows] = await db.query(
      `SELECT g.asterisk_endpoint AS endpoint
         FROM employees e
         JOIN campaign_assignments ca ON ca.employee_id = e.user_id
         JOIN campaign_gateways cg     ON cg.campaign_id = ca.campaign_id
         JOIN gsm_gateways g           ON g.id = cg.gateway_id
        WHERE e.sip_extension = ? AND g.status = 'active'
        LIMIT 1`,
      [extension],
    );
    return rows[0] ? rows[0].endpoint : null;
  }

  // -------------------------------------------------------------------
  //  DYNAMIC GATEWAY RESOLUTION for outbound (manual) calls.
  //  Chain:  Campaign -> Assigned (active) Gateway -> asterisk_endpoint.
  //  NOTHING is hardcoded — the env "dinstar"/TRUNK_ENDPOINT fallback is
  //  never used for campaign dialing. If no valid endpoint resolves we
  //  return null+reason and the caller refuses to dial.
  // -------------------------------------------------------------------

  // Read the X-Gateway SIP header the browser sets (the gateway of the
  // campaign the agent currently has selected). Absent header -> null.
  async function readGatewayHeader(channel) {
    try {
      const v = await channel.getChannelVar({
        variable: "PJSIP_HEADER(read,X-Gateway)",
      });
      const val = v && v.value ? String(v.value).trim() : "";
      return val || null;
    } catch (e) {
      return null; // header not present -> fall through to DB resolution
    }
  }

  // Validate an endpoint name (e.g. "gw3") against gsm_gateways: it must
  // exist, be active, and carry a non-empty endpoint. Returns info or null.
  async function validateGatewayEndpoint(endpointName) {
    if (!endpointName) return null;
    const [rows] = await db.query(
      `SELECT id, name, asterisk_endpoint AS endpoint, status
         FROM gsm_gateways
        WHERE asterisk_endpoint = ?
        LIMIT 1`,
      [endpointName],
    );
    const g = rows[0];
    if (!g || g.status !== "active" || !g.endpoint) return null;
    return { gatewayId: g.id, gatewayName: g.name, endpoint: g.endpoint };
  }

  // Resolve the active gateway for an agent from the campaigns they can
  // access — group-based (primary) plus legacy per-agent assignments.
  async function getActiveGatewayForExtension(extension) {
    if (!extension) return null;
    const [rows] = await db.query(
      `SELECT g.id, g.name, g.asterisk_endpoint AS endpoint, c.id AS campaignId
         FROM employees e
         JOIN campaigns c
           ON c.status = 'active'
          AND ( c.id IN (SELECT campaign_id FROM campaign_assignments WHERE employee_id = e.user_id)
                OR c.group_id IN (SELECT group_id FROM group_agents WHERE agent_id = e.user_id) )
         JOIN campaign_gateways cg ON cg.campaign_id = c.id
         JOIN gsm_gateways g
           ON g.id = cg.gateway_id
          AND g.status = 'active'
          AND g.asterisk_endpoint IS NOT NULL
          AND g.asterisk_endpoint <> ''
        WHERE e.sip_extension = ?
        ORDER BY c.id DESC
        LIMIT 1`,
      [extension],
    );
    const g = rows[0];
    if (!g) return null;
    return {
      gatewayId: g.id,
      gatewayName: g.name,
      endpoint: g.endpoint,
      campaignId: g.campaignId,
    };
  }

  // Full resolution chain for one outbound call.
  // Returns { gatewayId, gatewayName, endpoint, campaignId, via } or
  // { reason } when nothing valid could be resolved.
  async function resolveOutboundGateway(browserChannel, callerExt) {
    // 1) Browser X-Gateway header (reflects the selected campaign's gateway).
    const headerEp = await readGatewayHeader(browserChannel);
    if (headerEp) {
      const v = await validateGatewayEndpoint(headerEp).catch(() => null);
      if (v) return { ...v, campaignId: null, via: "x-gateway-header" };
      console.warn(
        `[ari][outbound] X-Gateway "${headerEp}" is not an active/provisioned gateway — ignoring`,
      );
    }
    // 2) DB: the agent's active campaign gateway.
    if (callerExt) {
      const v = await getActiveGatewayForExtension(callerExt).catch((e) => {
        console.error(
          "[ari][outbound] gateway lookup failed: " + (e && e.message),
        );
        return null;
      });
      if (v) return { ...v, via: "db-campaign" };
      return { reason: `no active gateway for extension ${callerExt}` };
    }
    return { reason: "could not parse caller extension from channel name" };
  }

  async function isRecordingEnabledForExtension(extension) {
    const [rows] = await db.query(
      `SELECT c.recording_enabled
         FROM employees e
         JOIN campaign_assignments ca ON ca.employee_id = e.user_id
         JOIN campaigns c             ON c.id = ca.campaign_id
        WHERE e.sip_extension = ?
        ORDER BY c.recording_enabled DESC
        LIMIT 1`,
      [extension],
    );
    return rows[0] ? Number(rows[0].recording_enabled) === 1 : false;
  }

  function connect() {
    ari
      .connect(ariUrl, ariUser, ariPass)
      .then((c) => {
        client = c; // 🆕 module-scope assign
        client.on("StasisStart", (event, channel) => {
          const role = (event.args && event.args[0]) || "";
          if (role === "outbound") {
            handleOutbound(client, channel).catch((e) =>
              console.error("[ari][outbound] " + (e && e.message)),
            );
          } else if (role === "inbound") {
            handleInbound(client, channel).catch((e) =>
              console.error("[ari][inbound] " + (e && e.message)),
            );
          } else if (role === "predictive") {
            // 🆕 server-originated predictive GSM leg answered
            handlePredictive(client, channel).catch((e) =>
              console.error("[ari][predictive] " + (e && e.message)),
            );
          }
          // role === "pred-agent" -> handlePredictive ke object handler
          // se sambhalta hai, yahan kuch nahi karna.
        });

        client.on("WebSocketError", (err) =>
          console.error("[ari] websocket error: " + (err && err.message)),
        );

        client.start(ariApp);
        console.log("[ari] connected to " + ariUrl + ' app="' + ariApp + '"');
      })
      .catch((err) => {
        console.error("[ari] connection failed: " + (err && err.message));
        console.error("[ari] retrying in 5s...");
        client = null; // not connected — engine pauses cleanly until retry succeeds
        setTimeout(connect, 5000);
      });
  }

  /* ------------------------------------------------------------------
   *  OUTBOUND  -  browser -> GSM gateway trunk
   * ------------------------------------------------------------------ */
  async function handleOutbound(client, browserChannel) {
    const dialed =
      (browserChannel.dialplan && browserChannel.dialplan.exten) || "";
    const target = (outboundPrefix || "") + dialed;

    // ----------------------------------------------------------------
    //  DYNAMIC gateway resolution — campaign's assigned gateway only.
    //  Order: (1) X-Gateway header the browser sends (selected campaign),
    //         (2) the agent's active campaign gateway from the DB.
    //  No hardcoded / env fallback: if nothing valid resolves we DO NOT dial,
    //  we log the exact reason and hang up instead of throwing "Endpoint not set".
    // ----------------------------------------------------------------
    const extMatch = (browserChannel.name || "").match(/PJSIP\/(\d+)-/);
    const callerExt = extMatch ? extMatch[1] : null;

    const resolved = await resolveOutboundGateway(browserChannel, callerExt);
    if (!resolved || !resolved.endpoint) {
      const reason =
        (resolved && resolved.reason) ||
        "no active gateway assigned to the campaign";
      console.error(
        `[ari][outbound] CALL BLOCKED — not dialing. ` +
          `ext=${callerExt || "?"} dialed=${dialed} ` +
          `campaign=${(resolved && resolved.campaignId) || "?"} ` +
          `gateway=${(resolved && resolved.gatewayName) || "none"} ` +
          `endpoint=${(resolved && resolved.endpoint) || "none"} ` +
          `reason="${reason}"`,
      );
      try {
        await browserChannel.hangup();
      } catch (e) {
        /* gone */
      }
      return;
    }

    const selectedTrunk = resolved.endpoint;
    console.log(
      `[ari][outbound] ext=${callerExt} ` +
        `campaign=${resolved.campaignId ?? "?"} ` +
        `gateway#${resolved.gatewayId ?? "?"} "${resolved.gatewayName ?? "?"}" ` +
        `endpoint=PJSIP/${selectedTrunk} dialed=${dialed} via=${resolved.via}`,
    );

    let done = false;
    let ringback = null;

    const bridge = client.Bridge();
    const outId = "out-" + browserChannel.id;
    const outLeg = client.Channel(outId);

    const end = async () => {
      if (done) return;
      done = true;
      try {
        await outLeg.hangup();
      } catch (e) {
        /* gone */
      }
      try {
        await browserChannel.hangup();
      } catch (e) {
        /* gone */
      }
      try {
        await bridge.destroy();
      } catch (e) {
        /* gone */
      }
    };

    // Far end answered -> stop ringback then bridge
    outLeg.on("StasisStart", async () => {
      if (done) return;
      try {
        if (ringback) await ringback.stop();
      } catch (e) {
        /* ignore */
      }
      try {
        await bridge.addChannel({ channel: outId });
      } catch (e) {
        /* ignore */
      }
      console.log("[ari] outbound connected");

      // ── Conditional recording: only if the caller's campaign has it ON ──
      if (callerExt) {
        try {
          const recOn = await isRecordingEnabledForExtension(callerExt);
          if (recOn) {
            const fname = "rec-" + callerExt + "-" + dialed + "-" + Date.now();
            await bridge.record({
              name: fname,
              format: "wav",
              ifExists: "overwrite",
            });

            console.log("[ari] recording started: " + fname + ".wav");
            try {
              await db.query(
                `INSERT INTO pending_recordings (extension, phone_number, filename)
                 VALUES (?,?,?)`,
                [callerExt, dialed, fname + ".wav"],
              );
            } catch (e) {
              console.error(
                "[ari] pending_recording insert failed: " + (e && e.message),
              );
            }
          } else {
            console.log("[ari] recording OFF for ext " + callerExt);
          }
        } catch (e) {
          console.error("[ari] recording start failed: " + (e && e.message));
        }
      }
    });

    outLeg.on("StasisEnd", end);
    outLeg.on("ChannelDestroyed", end);
    browserChannel.on("StasisEnd", end);
    browserChannel.on("ChannelDestroyed", end);

    try {
      // Answer browser leg, create bridge, play ringback
      await browserChannel.answer();
      await bridge.create({ type: "mixing" });
      await bridge.addChannel({ channel: browserChannel.id });

      // Play ringback via Asterisk (stops early media leaking)
      try {
        ringback = await browserChannel.play({ media: "tone:ring" });
      } catch (e) {
        /* ringback optional */
      }

      // Originate outbound call through the selected (dynamic) gateway
      await outLeg.originate({
        channelId: outId,
        endpoint: "PJSIP/" + target + "@" + selectedTrunk,
        app: ariApp,
        appArgs: "dialed",
        callerId: callerId || dialed,
        timeout: 45,
      });
    } catch (err) {
      console.error("[ari] originate failed: " + (err && err.message));
      await end();
    }
  }

  /* ------------------------------------------------------------------
   *  INBOUND  -  Dinstar trunk -> browser
   * ------------------------------------------------------------------ */
  async function handleInbound(client, trunkChannel) {
    const fromNumber =
      (trunkChannel.caller && trunkChannel.caller.number) || "unknown";

    let done = false;
    const bridge = client.Bridge();
    const brId = "in-" + trunkChannel.id;
    const browserLeg = client.Channel(brId);

    const end = async () => {
      if (done) return;
      done = true;
      try {
        await browserLeg.hangup();
      } catch (e) {
        /* gone */
      }
      try {
        await trunkChannel.hangup();
      } catch (e) {
        /* gone */
      }
      try {
        await bridge.destroy();
      } catch (e) {
        /* gone */
      }
    };

    // Browser answered -> bridge both legs
    browserLeg.on("StasisStart", async () => {
      if (done) return;
      try {
        await trunkChannel.answer();
      } catch (e) {
        /* ignore */
      }
      try {
        await bridge.addChannel({ channel: trunkChannel.id });
      } catch (e) {
        /* ignore */
      }
      try {
        await bridge.addChannel({ channel: brId });
      } catch (e) {
        /* ignore */
      }
      console.log("[ari] inbound connected from " + fromNumber);
    });

    browserLeg.on("StasisEnd", end);
    browserLeg.on("ChannelDestroyed", end);
    trunkChannel.on("StasisEnd", end);
    trunkChannel.on("ChannelDestroyed", end);

    try {
      await bridge.create({ type: "mixing" });

      // Find first online agent endpoint dynamically via ARI
      let targetEndpoint = browserEndpoint; // fallback to .env default
      try {
        const res = await fetch(`${ariUrl}/ari/endpoints/PJSIP`, {
          headers: {
            Authorization:
              "Basic " +
              Buffer.from(`${ariUser}:${ariPass}`).toString("base64"),
          },
        });
        if (res.ok) {
          const endpoints = await res.json();
          const online = endpoints.find(
            (ep) =>
              ep.resource &&
              /^6\d+$/.test(ep.resource) &&
              ep.state === "online",
          );
          if (online) {
            targetEndpoint = online.resource;
            console.log(
              "[ari] inbound routing to online agent: " + targetEndpoint,
            );
          } else {
            console.warn(
              "[ari] no online agents found, trying default: " + targetEndpoint,
            );
          }
        }
      } catch (e) {
        console.warn(
          "[ari] could not query endpoints, using default:",
          e && e.message,
        );
      }

      await browserLeg.originate({
        channelId: brId,
        endpoint: "PJSIP/" + targetEndpoint,
        app: ariApp,
        appArgs: "tobrowser",
        callerId: fromNumber,
        timeout: 40,
      });
    } catch (err) {
      console.error("[ari] inbound originate failed: " + JSON.stringify(err));
      await end();
    }
  }

  /* ------------------------------------------------------------------
   *  🆕 PREDICTIVE  -  engine originates GSM leg (no agent yet)
   * ------------------------------------------------------------------ */

  // Engine isse call karta hai. GSM leg ko server se originate karta hai.
  async function originatePredictive({
    campaignId,
    agentId,
    agentExt,
    contact,
    gateway,
  }) {
    if (!client) throw new Error("ARI not connected yet");
    // Validate the resolved gateway endpoint before dialing — never originate
    // against a missing/blank endpoint (would surface as "Endpoint not set").
    if (!gateway) {
      console.error(
        `[ari][predictive] CALL BLOCKED — campaign=${campaignId} ` +
          `contact=${contact && contact.id}: no active gateway endpoint resolved`,
      );
      throw new Error("No active gateway endpoint for campaign " + campaignId);
    }
    const target = (outboundPrefix || "") + contact.phone_number;
    const chanId = "pred-" + contact.id + "-" + Date.now();
    const ch = client.Channel(chanId);
    predAttempts.set(chanId, { campaignId, agentId, agentExt, contact, gateway });
    console.log(
      `[ari][predictive] campaign=${campaignId} agent=${agentId} ` +
        `endpoint=PJSIP/${gateway} -> ${target}`,
    );

    let answered = false;
    // Stasis mein aaya = far end ne uthaya
    ch.on("StasisStart", () => {
      answered = true;
    });
    // bina uthe destroy ho gaya = no-answer / busy
    ch.on("ChannelDestroyed", () => {
      if (!answered) {
        predAttempts.delete(chanId);
        onFailedCb(agentId, contact, "no-answer");
      }
    });

    await ch.originate({
      channelId: chanId,
      endpoint: "PJSIP/" + target + "@" + gateway,
      app: ariApp,
      appArgs: "predictive",
      callerId: callerId || contact.phone_number,
      timeout: 45,
    });
    return chanId;
  }

  // GSM leg answered -> agent ka leg originate + bridge + screen pop
  async function handlePredictive(client, gsmChannel) {
    const info = predAttempts.get(gsmChannel.id);
    if (!info) {
      try {
        await gsmChannel.hangup();
      } catch (e) {
        /* gone */
      }
      return;
    }
    const { agentId, agentExt, contact } = info;

    // Phase 2 TODO: yahan AMD chalao. MACHINE -> hangup + onFailedCb, return.

    let done = false;
    let connected = false; // 🆕 did the agent leg actually bridge?
    const bridge = client.Bridge();
    const agentLegId = "pred-agent-" + gsmChannel.id;
    const agentLeg = client.Channel(agentLegId);

    const end = async () => {
      if (done) return;
      done = true;
      predAttempts.delete(gsmChannel.id);
      // 🆕 ROOT-CAUSE FIX: customer answered (so the GSM-leg ChannelDestroyed
      // guard `if(!answered)` won't fire) but the agent never connected — e.g.
      // agent no-answer, customer hung up while agent rang, or a bridge error.
      // Without this the agent's reservation is never released and the
      // predictive engine silently stops dialing for that agent. Release once.
      if (!connected) {
        try {
          onFailedCb(agentId, contact, "ended-before-agent-connect");
        } catch (e) {
          console.error("[ari] onFailed (pred end) failed: " + (e && e.message));
        }
      }
      try {
        await agentLeg.hangup();
      } catch (e) {
        /* gone */
      }
      try {
        await gsmChannel.hangup();
      } catch (e) {
        /* gone */
      }
      try {
        await bridge.destroy();
      } catch (e) {
        /* gone */
      }
    };

    // Agent leg auto-answered -> dono ko bridge + screen pop
    agentLeg.on("StasisStart", async () => {
      if (done) return;
      try {
        await gsmChannel.answer();
      } catch (e) {
        /* ignore */
      }
      try {
        await bridge.addChannel({ channel: gsmChannel.id });
      } catch (e) {
        /* ignore */
      }
      try {
        await bridge.addChannel({ channel: agentLegId });
      } catch (e) {
        /* ignore */
      }
      console.log("[ari] predictive connected -> agent " + agentExt);

      // recording (existing helper reuse)
      try {
        const recOn = await isRecordingEnabledForExtension(agentExt);
        if (recOn) {
          const fname =
            "rec-" + agentExt + "-" + contact.phone_number + "-" + Date.now();
          await bridge.record({
            name: fname,
            format: "wav",
            ifExists: "overwrite",
          });
          try {
            await db.query(
              `INSERT INTO pending_recordings (extension, phone_number, filename)
               VALUES (?,?,?)`,
              [agentExt, contact.phone_number, fname + ".wav"],
            );
          } catch (e) {
            console.error("[ari] rec insert: " + (e && e.message));
          }
        }
      } catch (e) {
        console.error("[ari] rec start: " + (e && e.message));
      }

      connected = true; // 🆕 mark BEFORE notifying so end() won't double-release
      // server ko bolo -> woh agent ke browser pe contact emit karega
      onConnectCb(agentId, contact);
    });

    agentLeg.on("StasisEnd", end);
    agentLeg.on("ChannelDestroyed", end);
    gsmChannel.on("StasisEnd", end);
    gsmChannel.on("ChannelDestroyed", end);

    try {
      await bridge.create({ type: "mixing" });
      await agentLeg.originate({
        channelId: agentLegId,
        endpoint: "PJSIP/" + agentExt,
        app: ariApp,
        appArgs: "pred-agent",
        callerId: contact.phone_number,
        timeout: 30,
      });
    } catch (e) {
      console.error("[ari] agent originate failed: " + (e && e.message));
      onFailedCb(agentId, contact, "agent-unavailable");
      await end();
    }
  }

  function setHandlers(h) {
    if (h && h.onConnect) onConnectCb = h.onConnect;
    if (h && h.onFailed) onFailedCb = h.onFailed;
  }

  connect();

  // 🆕 engine ke liye expose. isConnected() => REST client present (can originate).
  return { originatePredictive, setHandlers, isConnected: () => !!client };
};