# Zephyreader

OpenTeleprompt: a teleprompter built on the Zephyrex framework, shipped in two variants
that share one front end.

## Layout

```
client/   Next.js front end (the zephyrex npm consumer). Built two ways:
            lite  (ZEPHYREADER_VARIANT=lite, the default): self-hosted, Next.js only;
                  the `route.lite.ts` handlers under src/app/api answer /api/v1/*.
            saas  (ZEPHYREADER_VARIANT=saas): the same UI; those handlers are left out
                  of the build and /api/v1/* is proxied to server/.
server/   Python backend for the SaaS variant: a consumer of the zephyrex server
          framework that adds only what is unique to Zephyreader.
```

Both backends satisfy one HTTP contract (paths, status codes, ETag/If-Match, cookie
session, CSRF, error bodies). Reusable capability belongs in the frameworks
(server-framework extensions, client-framework packages), not here.

Read `client/AGENTS.md` before working in `client/`, and the SOP Stack Standards
(TypeScript and JavaScript, React and Next.js, Python) before a first edit.
