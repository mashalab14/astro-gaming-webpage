

/**
 * Debug endpoint to inspect the latest users in the D1 database.
 * GET /api/debug-users
 */
export async function onRequest(context) {
  const { env } = context;
  const db = env.DB_USERS;

  if (!db) {
    console.error('DB_USERS binding is missing in /api/debug-users');
    return new Response(
      JSON.stringify({ ok: false, error: 'DB_USERS binding missing' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const stmt = db.prepare(`
      SELECT user_id, created_at, last_seen_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 10
    `);

    const { results } = await stmt.all();

    return new Response(
      JSON.stringify({
        ok: true,
        rows: results || [],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('Error reading users from D1 in /api/debug-users:', err);
    return new Response(
      JSON.stringify({
        ok: false,
        error: err && err.message ? err.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}