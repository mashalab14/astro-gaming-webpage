/**
 * /functions/api/user.js
 *
 * Cloudflare Pages Function for lightweight user registration.
 *
 * Behaviour
 * - Accepts POST requests with optional JSON body: { userId?: string }.
 * - If userId is missing, it generates a new UUID on the server.
 * - Upserts a row into the D1 database (binding name: DB_USERS).
 * - Updates last_seen_at and user_agent on every call.
 * - Returns JSON: { userId } which the shell can store in localStorage.
 */

/**
 * Utility: hash a string with SHA-256 and return hex.
 */
async function sha256Hex(input) {
  if (!input) return null;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB_USERS;
  console.log('DB_USERS in /api/user:', !!db);
  if (!db) {
    console.error('DB_USERS binding is not configured; skipping D1 upsert.');
  }

  let payload = {};
  try {
    payload = await request.json();
  } catch (_) {
    // If body is empty or invalid JSON, just treat as empty payload.
    payload = {};
  }

  // Accept either userId or user_id from the client.
  let userId = payload.userId || payload.user_id || null;

  // Generate UUID on the server if client did not provide one.
  if (!userId) {
    if (crypto.randomUUID) {
      userId = crypto.randomUUID();
    } else {
      // Fallback: very simple UUID-ish string; good enough for an anonymous id.
      userId = `anon-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
  }

  const userAgent = request.headers.get('user-agent') || null;
  const ip = request.headers.get('cf-connecting-ip') || null;
  const ipHash = await sha256Hex(ip || '');

  try {
    if (db) {
      // Insert or update the user row.
      // Schema expectation:
      //   user_id TEXT PRIMARY KEY
      //   created_at TEXT
      //   last_seen_at TEXT
      //   user_agent TEXT
      //   first_ip_hash TEXT
      await db
        .prepare(
          `INSERT INTO users (user_id, created_at, last_seen_at, user_agent, first_ip_hash)
           VALUES (?1, datetime('now'), datetime('now'), ?2, ?3)
           ON CONFLICT(user_id) DO UPDATE SET
             last_seen_at = excluded.last_seen_at,
             user_agent = excluded.user_agent`,
        )
        .bind(userId, userAgent, ipHash)
        .run();
    }
  } catch (err) {
    console.error('Error upserting user in D1:', err);
    // If the users table does not exist yet, create it and retry once.
    const message = String(err && err.message ? err.message : err);
    if (db && message.includes('no such table: users')) {
      try {
        await db
          .prepare(
            `CREATE TABLE IF NOT EXISTS users (
               user_id TEXT PRIMARY KEY,
               created_at TEXT NOT NULL DEFAULT (datetime('now')),
               last_seen_at TEXT,
               user_agent TEXT,
               first_ip_hash TEXT
             );`,
          )
          .run();

        await db
          .prepare(
            `INSERT INTO users (user_id, created_at, last_seen_at, user_agent, first_ip_hash)
             VALUES (?1, datetime('now'), datetime('now'), ?2, ?3)
             ON CONFLICT(user_id) DO UPDATE SET
               last_seen_at = excluded.last_seen_at,
               user_agent = excluded.user_agent`,
          )
          .bind(userId, userAgent, ipHash)
          .run();
      } catch (retryErr) {
        console.error('Failed to create users table or re-upsert in D1:', retryErr);
      }
    }
  }

  // Always return a valid userId to the client so the shell can proceed.
  console.log('user.js /api/user handler running, userId =', userId);
  return new Response(JSON.stringify({ userId }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
    },
  });
}

// Optional: handle OPTIONS for CORS preflight if you ever call this from a different origin.
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
