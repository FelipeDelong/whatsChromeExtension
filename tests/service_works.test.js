const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const SERVICE_WORKER_SCRIPT = fs.readFileSync(
  path.join(__dirname, "..", "service_works.js"),
  "utf8"
);

function createWorkerHarness(sharedStorage = {}, options = {}) {
  const listeners = [];
  let failNextGet = false;
  let failNextSet = false;

  const runtime = {
    lastError: null,
    onMessage: {
      addListener(listener) {
        listeners.push(listener);
      }
    }
  };

  function runStorageCallback(callback) {
    if (options.asyncStorage) {
      setImmediate(callback);
    } else {
      callback();
    }
  }

  const chrome = {
    runtime,
    storage: {
      local: {
        get(keys, callback) {
          runStorageCallback(() => {
            if (failNextGet) {
              failNextGet = false;
              runtime.lastError = { message: "storage get failed" };
              callback({});
              runtime.lastError = null;
              return;
            }

            const result = {};
            for (const key of keys) {
              if (Object.hasOwn(sharedStorage, key)) result[key] = sharedStorage[key];
            }
            callback(result);
          });
        },
        set(values, callback) {
          runStorageCallback(() => {
            if (failNextSet) {
              failNextSet = false;
              runtime.lastError = { message: "storage set failed" };
              callback();
              runtime.lastError = null;
              return;
            }

            Object.assign(sharedStorage, values);
            callback();
          });
        }
      }
    },
    tabs: {
      async query() {
        return [];
      },
      async update() {}
    },
    windows: {
      async update() {}
    }
  };

  const context = vm.createContext({
    chrome,
    console: {
      error() {},
      log() {},
      warn() {}
    },
    crypto: { randomUUID },
    setTimeout,
    clearTimeout
  });

  vm.runInContext(SERVICE_WORKER_SCRIPT, context, {
    filename: "service_works.js"
  });

  async function dispatch(message, sender = {}) {
    for (const listener of listeners) {
      let responded = false;
      let resolveResponse;
      const response = new Promise((resolve) => {
        resolveResponse = resolve;
      });
      const result = listener(message, sender, (value) => {
        responded = true;
        resolveResponse(value);
      });

      if (result === true) return response;
      if (result && typeof result.then === "function") return result;
      if (responded) return response;
    }

    return undefined;
  }

  return {
    context,
    dispatch,
    failNextGet() {
      failNextGet = true;
    },
    failNextSet() {
      failNextSet = true;
    },
    storage: sharedStorage
  };
}

test("two tabs cannot claim the same message concurrently", async () => {
  const worker = createWorkerHarness({}, { asyncStorage: true });
  const [first, second] = await Promise.all([
    worker.dispatch(
      { type: "MONITOR_MESSAGE_CLAIM", id: "shared-message" },
      { tab: { id: 1 } }
    ),
    worker.dispatch(
      { type: "MONITOR_MESSAGE_CLAIM", id: "shared-message" },
      { tab: { id: 2 } }
    )
  ]);
  const claimed = [first, second].filter((response) => response.claimed);
  const denied = [first, second].filter((response) => !response.claimed);

  assert.equal(claimed.length, 1);
  assert.equal(denied.length, 1);
  assert.equal(denied[0].status, "claimed");
  assert.equal(worker.storage.processed_message_ids.length, 1);
  assert.equal(worker.storage.processed_message_ids[0].status, "claimed");
  assert.equal(worker.storage.processed_message_ids[0].token, claimed[0].token);

  const completed = await worker.dispatch({
    type: "MONITOR_MESSAGE_COMPLETE",
    id: "shared-message",
    token: claimed[0].token
  });

  assert.equal(completed.ok, true);
  assert.equal(completed.completed, true);
  assert.equal(worker.storage.processed_message_ids[0].status, "processed");
  assert.equal(
    Object.prototype.hasOwnProperty.call(worker.storage.processed_message_ids[0], "token"),
    false
  );
});

test("a restarted worker preserves more than 500 processed ids and an active claim", async () => {
  const now = Date.now();
  const storage = {
    processed_message_ids: Array.from({ length: 501 }, (_, index) => ({
      id: `processed-${index}`,
      processedAt: now
    }))
  };
  const firstWorker = createWorkerHarness(storage);

  const denied = await firstWorker.dispatch({
    type: "MONITOR_MESSAGE_CLAIM",
    id: "processed-500"
  });
  assert.equal(denied.claimed, false);

  const claim = await firstWorker.dispatch({
    type: "MONITOR_MESSAGE_CLAIM",
    id: "claimed-before-restart"
  });
  assert.equal(claim.claimed, true);
  assert.equal(storage.processed_message_ids.length, 502);
  assert.equal(
    storage.processed_message_ids.find((entry) => entry.id === "claimed-before-restart").token,
    claim.token
  );

  const restartedWorker = createWorkerHarness(storage);
  const completed = await restartedWorker.dispatch({
    type: "MONITOR_MESSAGE_COMPLETE",
    id: "claimed-before-restart",
    token: claim.token
  });

  assert.equal(completed.completed, true);
  assert.equal(storage.processed_message_ids.length, 502);
  assert.equal(
    storage.processed_message_ids.find((entry) => entry.id === "claimed-before-restart").status,
    "processed"
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      storage.processed_message_ids.find((entry) => entry.id === "claimed-before-restart"),
      "token"
    ),
    false
  );

  const stillDenied = await restartedWorker.dispatch({
    type: "MONITOR_MESSAGE_CLAIM",
    id: "processed-0"
  });
  assert.equal(stillDenied.claimed, false);
});

test("storage failures do not acknowledge claims or completions", async () => {
  const worker = createWorkerHarness();

  worker.failNextGet();
  const failedRead = await worker.dispatch({
    type: "MONITOR_MESSAGE_CLAIM",
    id: "failed-read"
  });
  assert.equal(failedRead.ok, false);
  assert.equal(failedRead.claimed, false);

  worker.failNextSet();
  const failedClaim = await worker.dispatch({
    type: "MONITOR_MESSAGE_CLAIM",
    id: "failed-claim"
  });

  assert.equal(failedClaim.ok, false);
  assert.equal(failedClaim.claimed, false);
  assert.equal(worker.storage.processed_message_ids, undefined);

  const claim = await worker.dispatch({
    type: "MONITOR_MESSAGE_CLAIM",
    id: "failed-completion"
  });
  assert.equal(claim.claimed, true);

  worker.failNextSet();
  const failedCompletion = await worker.dispatch({
    type: "MONITOR_MESSAGE_COMPLETE",
    id: "failed-completion",
    token: claim.token
  });

  assert.equal(failedCompletion.ok, false);
  assert.equal(failedCompletion.completed, false);
  assert.equal(worker.storage.processed_message_ids[0].status, "claimed");
});

test("failed sends can release a claim and abandoned claims expire", async () => {
  const storage = {};
  const worker = createWorkerHarness(storage);
  const firstClaim = await worker.dispatch({
    type: "MONITOR_MESSAGE_CLAIM",
    id: "released-message"
  });

  const released = await worker.dispatch({
    type: "MONITOR_MESSAGE_RELEASE",
    id: "released-message",
    token: firstClaim.token
  });
  assert.equal(released.ok, true);
  assert.equal(released.released, true);

  const secondClaim = await worker.dispatch({
    type: "MONITOR_MESSAGE_CLAIM",
    id: "released-message"
  });
  assert.equal(secondClaim.claimed, true);

  storage.processed_message_ids = [{
    id: "abandoned-message",
    status: "claimed",
    token: "abandoned-token",
    updatedAt: Date.now() - (2 * 60 * 1000) - 1
  }];
  const restartedWorker = createWorkerHarness(storage);
  const reclaimed = await restartedWorker.dispatch({
    type: "MONITOR_MESSAGE_CLAIM",
    id: "abandoned-message"
  });

  assert.equal(reclaimed.claimed, true);
  assert.notEqual(reclaimed.token, "abandoned-token");
});
