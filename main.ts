#!/usr/bin/env -S deno run --allow-read=. --allow-net

import { Application, Router } from "https://deno.land/x/oak@v10.0.0/mod.ts";
// @deno-types https://deno.land/x/fuse@v6.4.1/dist/fuse.d.ts
import { default as Fuse } from "https://deno.land/x/fuse@v6.4.1/dist/fuse.esm.js";

let mods: string[];
const versions: Record<string, string[]> = {};
const paths: Record<string, Record<string, string[]>> = {};

const router = new Router();

router.get("/.well-known/deno-import-intellisense.json", async (ctx) => {
  ctx.response.body = await Deno.readFile(
    new URL("./deno-import-intellisense.json", import.meta.url),
  );
  ctx.response.type = "json";
});

router.get("/api/mods", async (ctx) => {
  if (!mods) {
    const res = await fetch("https://api.deno.land/modules?simple=1");
    if (res.status === 200) {
      mods = await res.json();
    } else {
      return ctx.throw(res.status, res.statusText);
    }
  }
  const items = mods.slice(0, 100);
  ctx.response.body = {
    items,
    isIncomplete: mods.length > items.length,
  };
  ctx.response.type = "json";
});

router.get("/api/mods/:module", async (ctx) => {
  if (!mods) {
    const res = await fetch("https://api.deno.land/modules?simple=1");
    if (res.status === 200) {
      mods = await res.json();
    } else {
      return ctx.throw(res.status, res.statusText);
    }
  }
  const fuse = new Fuse(mods, { includeScore: true, distance: 10 });
  const foundItems = fuse.search(ctx.params.module);
  const found: string[] = foundItems.map(({ item }: { item: string }) => item);
  const items = found.slice(0, 100);
  ctx.response.body = {
    items,
    isIncomplete: found.length > items.length,
    preselect: (foundItems[0].score === 0) ? foundItems[0].item : undefined,
  };
  ctx.response.type = "json";
});

router.get("/api/details/mods/:module", (ctx) => {
  ctx.response.body = {
    kind: "markdown",
    value: `some **${ctx.params.module}**`,
  };
  ctx.response.type = "json";
});

function filter(items: string[], current = ""): [string[], boolean] {
  console.log("current", current);
  const result = new Set<string>();
  let truncated = false;
  for (const item of items) {
    if (item.startsWith(current)) {
      const part = item.replace(current, "");
      if (part.includes("/")) {
        const [first] = part.split("/");
        result.add(`${current}${first}/`);
        truncated = true;
      } else {
        result.add(item);
      }
    }
  }
  return [[...result], truncated];
}

router.get("/api/mods/:module/v", async (ctx) => {
  if (!versions[ctx.params.module]) {
    const res = await fetch(
      `https://deno.land/_vsc1/modules/${ctx.params.module}`,
    );
    if (res.status === 200) {
      versions[ctx.params.module] = await res.json();
    } else {
      return ctx.throw(res.status, res.statusText);
    }
  }
  const vers = versions[ctx.params.module];
  const items = vers.slice(0, 100);
  ctx.response.body = {
    items,
    isIncomplete: vers.length > items.length,
    preselect: items[0],
  };
  ctx.response.type = "json";
});

router.get("/api/mods/:module/v/:version", async (ctx) => {
  if (!versions[ctx.params.module]) {
    const res = await fetch(
      `https://deno.land/_vsc1/modules/${ctx.params.module}`,
    );
    if (res.status === 200) {
      versions[ctx.params.module] = await res.json();
    } else {
      return ctx.throw(res.status, res.statusText);
    }
  }
  const vers = versions[ctx.params.module];
  const filtered = vers.filter((v) => v.startsWith(ctx.params.version));
  const items = filtered.slice(0, 100);
  ctx.response.body = {
    items,
    isIncomplete: filtered.length > items.length,
  };
  ctx.response.type = "json";
});

router.get("/api/details/mods/:module/v/:version", (ctx) => {
  ctx.response.body = {
    kind: "markdown",
    value: `- ${ctx.params.module}**\n- ${ctx.params.version}\n`,
  };
  ctx.response.type = "json";
});

router.get("/api/mods/:module/v/:version/p/", async (ctx) => {
  if (!paths[ctx.params.module]) {
    paths[ctx.params.module] = {};
  }
  if (!paths[ctx.params.module][ctx.params.version]) {
    let url;
    if (ctx.params.version === "latest") {
      url = `https://deno.land/_vsc1/modules/${ctx.params.module}/v_latest`;
    } else {
      url = `https://deno.land/_vsc1/modules/${ctx.params.module}/v/${
        encodeURI(ctx.params.version)
      }`;
    }
    const res = await fetch(url);
    if (res.status === 200) {
      paths[ctx.params.module][ctx.params.version] = await res.json();
    } else {
      return ctx.throw(res.status, res.statusText);
    }
  }
  const ps = paths[ctx.params.module][ctx.params.version];
  const [filtered, truncated] = filter(ps);
  const items = filtered.slice(0, 100);
  ctx.response.body = {
    items,
    isIncomplete: filtered.length > items.length || truncated,
    preselect: "mod.ts",
  };
});

router.get("/api/mods/:module/v/:version/p/:path*", async (ctx) => {
  if (!paths[ctx.params.module]) {
    paths[ctx.params.module] = {};
  }
  if (!paths[ctx.params.module][ctx.params.version]) {
    let url;
    if (ctx.params.version === "latest") {
      url = `https://deno.land/_vsc1/modules/${ctx.params.module}/v_latest`;
    } else {
      url = `https://deno.land/_vsc1/modules/${ctx.params.module}/v/${
        encodeURI(ctx.params.version)
      }`;
    }
    const res = await fetch(url);
    if (res.status === 200) {
      paths[ctx.params.module][ctx.params.version] = await res.json();
    } else {
      return ctx.throw(res.status, res.statusText);
    }
  }
  const ps = paths[ctx.params.module][ctx.params.version];
  const current = ctx.params.path!.endsWith("/")
    ? ctx.params.path
    : `${ctx.params.path}/`;
  const [filtered, truncated] = filter(ps, current);
  const items = filtered.slice(0, 100);
  ctx.response.body = {
    items,
    isIncomplete: filtered.length > items.length || truncated,
    preselect: items.includes("mod.ts") ? "mod.ts" : undefined,
  };
});

router.get("/api/details/mods/:module/v/:version/p/:path", (ctx) => {
  ctx.response.body = {
    kind: "markdown",
    value:
      `- ${ctx.params.module}**\n- ${ctx.params.version}\n- ${ctx.params.path}\n`,
  };
  ctx.response.type = "json";
});

router.get("/x/:path*", (ctx) => {
  ctx.response.redirect(
    new URL(ctx.request.url.pathname, "https://deno.land/"),
  );
});

const app = new Application();

app.use(router.routes());
app.use(router.allowedMethods());

app.addEventListener("listen", (evt) => {
  console.log(
    `listening on: ${
      evt.secure ? "https" : "http"
    }://${evt.hostname}:${evt.port}/`,
  );
});

app.listen({ port: 8081 });
