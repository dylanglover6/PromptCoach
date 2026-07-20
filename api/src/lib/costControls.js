const { getTableClient } = require("./tableStorage");

const RATE_LIMIT_PER_IP_PER_HOUR = Number(process.env.RATE_LIMIT_PER_IP_PER_HOUR) || 20;
const DAILY_SPEND_CEILING_USD = Number(process.env.DAILY_SPEND_CEILING_USD) || 5;
const WINDOW_MS = 60 * 60 * 1000;
const MAX_ETAG_RETRIES = 5;

// claude-haiku-4-5 pricing: $1.00 / 1M input tokens, $5.00 / 1M output tokens —
// expressed in micro-dollars per token so spend tracking stays integer.
const MICRO_DOLLARS_PER_INPUT_TOKEN = 1;
const MICRO_DOLLARS_PER_OUTPUT_TOKEN = 5;
const DAILY_SPEND_CEILING_MICRO_DOLLARS = DAILY_SPEND_CEILING_USD * 1_000_000;

function getClientIp(request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0].trim();
    if (first) return first;
  }
  return "unknown";
}

// Table Storage PartitionKey/RowKey only allow a narrow character set — keep
// only what a real IP address needs and replace everything else.
function sanitizeKey(value) {
  return value.replace(/[^a-zA-Z0-9.:-]/g, "_");
}

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

async function checkRequestAllowed(request) {
  try {
    const client = await getTableClient();
    const ip = sanitizeKey(getClientIp(request));

    const rateResult = await incrementRateLimit(client, ip);
    if (!rateResult.allowed) {
      return {
        allowed: false,
        status: 429,
        error: "Too many requests from this IP. Please try again later.",
      };
    }

    const spendOk = await checkSpendCeiling(client);
    if (!spendOk) {
      return {
        allowed: false,
        status: 503,
        error: "This demo has reached its daily usage limit. Please try again tomorrow.",
      };
    }

    return { allowed: true };
  } catch (err) {
    console.warn("costControls: check failed, failing open:", err.message);
    return { allowed: true };
  }
}

async function incrementRateLimit(client, ip) {
  const partitionKey = "rate";
  const rowKey = ip;
  const now = Date.now();

  for (let attempt = 0; attempt < MAX_ETAG_RETRIES; attempt++) {
    let entity;
    try {
      entity = await client.getEntity(partitionKey, rowKey);
    } catch (err) {
      if (err.statusCode !== 404) throw err;
      entity = null;
    }

    const windowExpired = !entity || now - entity.windowStart >= WINDOW_MS;
    const count = windowExpired ? 0 : entity.count;

    if (count >= RATE_LIMIT_PER_IP_PER_HOUR) {
      return { allowed: false };
    }

    const nextEntity = {
      partitionKey,
      rowKey,
      count: count + 1,
      windowStart: windowExpired ? now : entity.windowStart,
    };

    try {
      if (!entity) {
        await client.createEntity(nextEntity);
      } else {
        await client.updateEntity(nextEntity, "Replace", { etag: entity.etag });
      }
      return { allowed: true };
    } catch (err) {
      if (err.statusCode === 409 || err.statusCode === 412) continue; // conflict — retry
      throw err;
    }
  }

  // Couldn't win the race after several retries — fail open on this single request.
  return { allowed: true };
}

async function checkSpendCeiling(client) {
  try {
    const entity = await client.getEntity("spend", todayKey());
    return entity.totalMicroDollars < DAILY_SPEND_CEILING_MICRO_DOLLARS;
  } catch (err) {
    if (err.statusCode === 404) return true;
    throw err;
  }
}

async function recordSpend(usage) {
  if (!usage) return;
  const cost =
    (usage.input_tokens || 0) * MICRO_DOLLARS_PER_INPUT_TOKEN +
    (usage.output_tokens || 0) * MICRO_DOLLARS_PER_OUTPUT_TOKEN;
  if (cost <= 0) return;

  try {
    const client = await getTableClient();
    const partitionKey = "spend";
    const rowKey = todayKey();

    for (let attempt = 0; attempt < MAX_ETAG_RETRIES; attempt++) {
      let entity;
      try {
        entity = await client.getEntity(partitionKey, rowKey);
      } catch (err) {
        if (err.statusCode !== 404) throw err;
        entity = null;
      }

      const nextEntity = {
        partitionKey,
        rowKey,
        totalMicroDollars: (entity ? entity.totalMicroDollars : 0) + cost,
      };

      try {
        if (!entity) {
          await client.createEntity(nextEntity);
        } else {
          await client.updateEntity(nextEntity, "Replace", { etag: entity.etag });
        }
        return;
      } catch (err) {
        if (err.statusCode === 409 || err.statusCode === 412) continue;
        throw err;
      }
    }
  } catch (err) {
    console.warn("costControls: failed to record spend:", err.message);
  }
}

module.exports = { checkRequestAllowed, recordSpend };
