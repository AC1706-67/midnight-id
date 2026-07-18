/**
 * Midnight ID demo server - runs the tested simulator in Node,
 * exposes it to the UI over plain HTTP. No wallet needed.
 */

import { createServer } from "node:http";
import { MidnightIdSimulator } from "./contract/dist/test/midnight-id-simulator.js";

const randomBytes32 = () => {
  const out = new Uint8Array(32);
  crypto.getRandomValues(out);
  return out;
};

const toHexStr = (b) =>
  Array.from(b)
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");

const fromHexStr = (h) =>
  new Uint8Array(h.match(/.{2}/g).map((x) => parseInt(x, 16)));

const sim = new MidnightIdSimulator(randomBytes32());

const json = (res, code, obj) => {
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  res.end(JSON.stringify(obj));
};

const readBody = (req) =>
  new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data ? JSON.parse(data) : {}));
  });

const ledgerCounts = () => {
  const l = sim.getLedger();
  return {
    enrollmentCount: l.enrollmentCount.toString(),
    totalCheckIns: l.totalCheckIns.toString(),
  };
};

createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") return json(res, 204, {});

    if (req.method === "GET" && req.url === "/state") {
      return json(res, 200, ledgerCounts());
    }

    if (req.method === "POST" && req.url === "/enroll") {
      const secretKey = randomBytes32();
      const commitment = sim.commitmentFor(secretKey);
      sim.enroll(commitment);
      return json(res, 200, {
        ok: true,
        secretKey: toHexStr(secretKey),
        commitment: toHexStr(commitment),
        ...ledgerCounts(),
      });
    }

    if (req.method === "POST" && req.url === "/check-in") {
      const { secretKey, leafIndex, date } = await readBody(req);
      const sk = fromHexStr(secretKey);
      const commitment = sim.commitmentFor(sk);
      const path = sim.pathFor(BigInt(leafIndex), commitment);
      sim.switchUser({ secretKey: sk, leafIndex: BigInt(leafIndex), currentPath: path });
      const dateBytes = new Uint8Array(32);
      dateBytes.set(new TextEncoder().encode(date).slice(0, 32));
      sim.checkIn(dateBytes);
      return json(res, 200, { ok: true, commitment: toHexStr(commitment), ...ledgerCounts() });
    }

    if (req.method === "POST" && req.url === "/verify") {
      const { secretKey, leafIndex } = await readBody(req);
      const sk = fromHexStr(secretKey);
      const commitment = sim.commitmentFor(sk);
      const path = sim.pathFor(BigInt(leafIndex), commitment);
      sim.switchUser({ secretKey: sk, leafIndex: BigInt(leafIndex), currentPath: path });
      sim.verifyCredential();
      return json(res, 200, { ok: true, ...ledgerCounts() });
    }

    json(res, 404, { ok: false, error: "not found" });
  } catch (e) {
    json(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}).listen(4400, () => console.log("Midnight ID demo server on http://localhost:4400"));
