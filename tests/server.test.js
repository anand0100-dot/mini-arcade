
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");

let server;
let baseUrl;
let output = "";

test("MiniArcade server starts and health endpoint responds", async (t) => {
  const port = 18082;
  baseUrl = `http://127.0.0.1:${port}`;

  server = spawn(process.execPath, ["server.js"], {
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"]
  });

  server.stdout.on("data", (data) => {
    output += data.toString();
  });

  server.stderr.on("data", (data) => {
    output += data.toString();
  });

  t.after(() => {
    if (server && server.exitCode === null) {
      server.kill("SIGTERM");
    }
  });

  let response;

  for (let attempt = 0; attempt < 40; attempt++) {
    if (server.exitCode !== null) {
      assert.fail(`Server exited early:\n${output}`);
    }

    try {
      response = await fetch(`${baseUrl}/api/health`);
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  assert.ok(response, `Server did not start in time:\n${output}`);
  assert.equal(response.status, 200);

  const body = await response.json();

  assert.equal(body.status, "ok");
  assert.equal(body.application, "MiniArcade");
});
