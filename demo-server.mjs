/*
 * Midnight ID demo server - runs the tested simulator in Node.
 * Roster (aliases + keys) lives here = the org's local device.
 * The "chain" is the simulator ledger: hashes and counts only.
 */
import { createServer } from "node:http";
import { MidnightIdSimulator } from "./contract/dist/test/midnight-id-simulator.js";

const randomBytes32 = () => {
  const out = new Uint8Array(32);
  crypto.getRandomValues(out);
  return out;
};
const toHexStr = (b) =>
  Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");

const sim = new MidnightIdSimulator(randomBytes32());
const people = []; // { alias, secretKey, leafIndex, commitmentHex } - LOCAL ONLY
const events = []; // { label, hash } - what the chain saw

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

const shortHash = (hex) => `${hex.slice(0, 8)}...${hex.slice(-8)}`;

const snapshot = () => {
  const l = sim.getLedger();
  return {
    ok: true,
    enrollmentCount: l.enrollmentCount.toString(),
    totalCheckIns: l.totalCheckIns.toString(),
    people: people.map((p, i) => ({ index: i, alias: p.alias })),
    events: events.slice(0, 8),
  };
};

const actAs = (p) => {
  const commitment = sim.commitmentFor(p.secretKey);
  const path = sim.pathFor(BigInt(p.leafIndex), commitment);
  sim.switchUser({
    secretKey: p.secretKey,
    leafIndex: BigInt(p.leafIndex),
    currentPath: path,
  });
};

createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") return json(res, 204, {});

    if (req.method === "GET" && req.url === "/state") {
      return json(res, 200, snapshot());
    }

    if (req.method === "POST" && req.url === "/enroll") {
      const { alias } = await readBody(req);
      if (!alias || !alias.trim()) throw new Error("alias required");
      const secretKey = randomBytes32();
      const commitment = sim.commitmentFor(secretKey);
      sim.enroll(commitment);
      const commitmentHex = toHexStr(commitment);
      people.push({
        alias: alias.trim(),
        secretKey,
        leafIndex: people.length,
        commitmentHex,
      });
      events.unshift({ label: "Commitment added", hash: shortHash(commitmentHex) });
      return json(res, 200, snapshot());
    }

    if (req.method === "POST" && req.url === "/check-in") {
      const { index, date } = await readBody(req);
      const p = people[index];
      if (!p) throw new Error("unknown credential");
      actAs(p);
      const dateBytes = new Uint8Array(32);
      dateBytes.set(new TextEncoder().encode(date).slice(0, 32));
      sim.checkIn(dateBytes);
      events.unshift({
        label: "Anonymous check-in (nullifier burned)",
        hash: shortHash(p.commitmentHex),
      });
      return json(res, 200, snapshot());
    }

    if (req.method === "POST" && req.url === "/verify") {
      const { index } = await readBody(req);
      const p = people[index];
      if (!p) throw new Error("unknown credential");
      actAs(p);
      sim.verifyCredential();
      return json(res, 200, snapshot());
    }

    json(res, 404, { ok: false, error: "not found" });
  } catch (e) {
    json(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}).listen(4400, () =>
  console.log("Midnight ID demo server on http://localhost:4400"),
);
