# Deploying Zephyreader

The SaaS edition deploys itself: every push to `main` on git.zephyrex.dev runs
`.forgejo/workflows/deploy.yml` on the Zephyrex Forgejo runner (rootless podman, a fresh
container per job). It builds the server and the client from this repository, plus the
framework repositories at pinned commits, and puts them on `prod-zephyreader`. You can also
start a run by hand (workflow_dispatch). The repository's home is git.zephyrex.dev, and it
push-mirrors to GitHub.

**Not launched.** The operator keeps Zephyreader fully disabled until a network security
audit passes (2026-11-04). Until then a run builds and places the bundles but starts
nothing: the `zephyreader-server` and `zephyreader-client` units are modelled disabled and
stopped (`tofu-providers/opentofu/zephyrex/svc_zephyreader.tf`), and the edge has no route
to the guest. Launch follows *Zephyrex SOP → Services → Zephyrex Framework SaaS Launch*.

## What a run does

1. **Fetch** (`fetch-frameworks.sh`). Lays out a workspace the way the path dependencies
   expect: this repository at `Zephyreader`, and each framework beside it, cloned from
   GitHub at the commit `frameworks.env` pins.
2. **Server** (`build-server.sh`). A standalone CPython 3.11, a relocatable venv with the
   locked dependencies (the framework installed as a package, not editable), the app and
   its extensions, and `contract/`. It runs at `/srv/zephyreader/server` and never uses the
   CT's own Python. The server binds 127.0.0.1:6970 only; browsers reach it through the
   client's `/api` proxy.
3. **Client** (`build-client.sh`). Compiles zod2gql, dynamic-form, auth and client-framework,
   fetches the voice-follow model into `public/`, then builds the SaaS variant's Next.js
   standalone server with the settings in `deploy.env`. The output is traced from the
   repository root, so the server sits in its `client/` directory. No TypeScript or source
   maps ship.
4. **Place** (`ship.sh`). Checks it can reach the guest over ssh first (15 s timeout) and
   stops with prod untouched if it can't, then rsyncs each bundle into place, keeping the
   one before as `<dir>.previous`. `/etc/zephyreader/*.env` belongs to the infra pipeline
   and is never touched. At launch this step also restarts each unit, server first (it
   migrates the database at boot), and waits for it to answer, restoring the previous
   bundle when it does not.

A failure in any build step stops the run before anything reaches the guest.

## Changing what it builds

- **A framework change:** push it to the framework's GitHub repository, then set its commit
  in `frameworks.env` and push that to `main`. Zephyreader only builds against framework
  commits that are on GitHub.
- **The client's settings** (`deploy.env`) are fixed at build time: the public origin
  (`APP_URI`) and the server the `/api/v1` rewrite reaches (`ZEPHYREADER_SERVER_URI`).

## Building it yourself

The same scripts run outside CI, on the build runner (never the desktop), in the pinned image:

```bash
podman run --rm --network host -v "$PWD":/src:Z -v "$PWD/out":/out:Z -w /src \
  docker.io/library/node@sha256:611b2e34ec1dd43a7bd4a334f146be7b0b51e8827acb86f94ca4c078cc53bba5 \
  bash -c 'echo "Acquire::ForceIPv4 \"true\";" > /etc/apt/apt.conf.d/99force-ipv4 &&
           apt-get update -qq && apt-get install -y -qq rsync openssh-client git >/dev/null &&
           npm install -g pnpm@11.1.1 >/dev/null &&
           curl -LsSf https://astral.sh/uv/0.11.16/install.sh | env UV_INSTALL_DIR=/usr/local/bin sh &&
           deploy/fetch-frameworks.sh /work && deploy/build-server.sh /work /out/server &&
           set -a && . deploy/deploy.env && set +a && deploy/build-client.sh /work /out/client'
```

Run it from a clean clone: `fetch-frameworks.sh` copies the whole repository.
