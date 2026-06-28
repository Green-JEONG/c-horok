# Security Rules

## Logging

Do not log whole request bodies, post contents, passwords, tokens, secrets, cookies, headers, or session objects.

Allowed:

```ts
console.error("POST CREATE ERROR", error);
```

Not allowed:

```ts
console.log(body);
console.error("POST CREATE ERROR", { body, content });
console.warn("auth debug", { password, token, headers });
```

When debugging sensitive flows, log only stable metadata such as route name, post id, user id, status code, and a sanitized error name/message.

Run this check before merging changes that touch API routes:

```sh
npm run check:logging
```

## Post Media Storage

Keep the `post` media bucket private. Profile images, post thumbnails, post body media, chat images, and post attachments must be uploaded through the Next.js API route, not directly from the browser with the public Supabase anon key.

Required server environment variable:

```sh
SUPABASE_SERVICE_ROLE_KEY=...
```

The service role key must never be exposed to client code or `NEXT_PUBLIC_*` variables.

Store media as stable storage paths such as `users/{userId}/{id}.png`, `thumbnails/{id}.png`, `contents/{id}.png`, and `attachments/{id}.pdf` in the database. Return signed URLs only after the Next.js server has checked the relevant post/profile/chat visibility.
