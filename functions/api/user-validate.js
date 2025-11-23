

export const onRequest = async ({ request, env }) => {
  const db = env.DB_USERS;

  if (!db) {
    return new Response(
      JSON.stringify({
        ok: false,
        reason: 'db_not_configured',
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' },
      },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const userId = body && typeof body.userId === 'string' ? body.userId.trim() : '';

    if (!userId) {
      return new Response(
        JSON.stringify({
          ok: false,
          reason: 'missing_user_id',
        }),
        {
          status: 400,
          headers: { 'content-type': 'application/json' },
        },
      );
    }

    const row = await db
      .prepare(
        'SELECT user_id FROM users WHERE user_id = ?1 LIMIT 1;',
      )
      .bind(userId)
      .first();

    if (row && row.user_id) {
      return new Response(
        JSON.stringify({ ok: true }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      );
    }

    return new Response(
      JSON.stringify({
        ok: false,
        reason: 'not_found',
      }),
      {
        status: 404,
        headers: { 'content-type': 'application/json' },
      },
    );
  } catch (err) {
    console.error('Error validating user in D1:', err);
    return new Response(
      JSON.stringify({
        ok: false,
        reason: 'server_error',
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' },
      },
    );
  }
};