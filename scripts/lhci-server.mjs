// Starts the production server for Lighthouse CI and, once it is up, warms the optimised lead photo of the hotel page.
// The first request for an optimised image makes the server fetch and transcode it; Lighthouse should measure the
// cached file, as every later visitor gets. "Ready" is printed again only after the warm-up, so lhci waits for it.
// Usage: node scripts/lhci-server.mjs <port> <hotel page URL>
import { spawn } from "node:child_process";

const [port, hotelUrl] = process.argv.slice(2);
const origin = `http://localhost:${port}`;
const server = spawn("npm", ["run", "start", "--", "--port", port], { stdio: ["ignore", "pipe", "inherit"] });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
server.on("exit", (code) => process.exit(code ?? 1));

async function warm() {
  const html = await (await fetch(hotelUrl, { headers: { Cookie: "residency=gb" } })).text();
  // Every optimised URL in the first photo (phone <img> and desktop <source>), for both formats a browser may ask for.
  const urls = new Set([...html.matchAll(/\/_next\/image\?url=[^"\s,\\]+?&amp;w=\d+&amp;q=\d+/g)].map((m) => m[0].replaceAll("&amp;", "&")));
  const lead = [...urls].filter((u) => /\/t\/(640x350|1024x768)\//.test(decodeURIComponent(u)));
  for (const u of lead) {
    for (const accept of ["image/avif,image/webp,image/*", "image/webp,image/*"]) {
      const res = await fetch(origin + u, { headers: { Accept: accept } });
      await res.arrayBuffer();
      if (!res.ok) throw new Error(`warm-up ${res.status} for ${u}`);
    }
  }
  console.log(`Warmed ${lead.length} optimised lead photo URLs.`);
}

let ready = false;
server.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  if (!ready && /Ready/.test(String(chunk))) {
    ready = true;
    warm().then(
      () => console.log("Ready (warm)"),
      (err) => {
        console.error(String(err));
        server.kill("SIGTERM");
      },
    );
  }
});
