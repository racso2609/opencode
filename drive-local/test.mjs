import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.join(__dirname, "server.mjs");
const AUTH_FILE = path.join(
  os.homedir(),
  ".local",
  "share",
  "opencode",
  "mcp-auth.json",
);
const DRIVE_API = "https://www.googleapis.com/drive/v3";

const results = [];
let failures = 0;

function record(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  - ${detail ?? "ver detalle arriba"}`}`);
  if (!ok) failures++;
}

function textOf(result) {
  const t = (result.content || []).find((c) => c.type === "text");
  return t ? t.text : "";
}

async function driveDelete(fileId) {
  const raw = JSON.parse(fs.readFileSync(AUTH_FILE, "utf8"));
  const token = raw.drive?.tokens?.accessToken;
  if (!token) return false;
  const res = await fetch(`${DRIVE_API}/files/${fileId}?supportsAllDrives=true`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.status === 204;
}

const ts = new Date().toISOString().replace(/[:.]/g, "-");
const TEST_TITLE = `opencode-drive-local-test-${ts}.txt`;
const TEST_TEXT = `prueba de drive-local ${ts}`;

const client = new Client({ name: "drive-local-test", version: "1.0.0" });

try {
  const transport = new StdioClientTransport({
    command: "node",
    args: [SERVER],
    cwd: __dirname,
  });
  await client.connect(transport);
  console.log("> Conectado a drive-local\n");

  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  record("listTools", names.length >= 8, `herramientas: ${names.join(", ")}`);

  let firstFileId = null;
  let firstNonFolderId = null;

  const searchRes = await client.callTool({
    name: "search_files",
    arguments: { query: "mimeType = 'application/vnd.google-apps.folder'", pageSize: 5 },
  });
  let searchFiles = [];
  try { searchFiles = JSON.parse(textOf(searchRes)).files || []; } catch {}
  record(
    "search_files",
    Array.isArray(searchFiles) && searchFiles.length > 0,
    `encontrados ${searchFiles.length} carpetas`,
  );
  firstFileId = searchFiles[0]?.id || firstFileId;

  const recentRes = await client.callTool({
    name: "list_recent_files",
    arguments: { pageSize: 10 },
  });
  let recentFiles = [];
  try { recentFiles = JSON.parse(textOf(recentRes)).files || []; } catch {}
  record(
    "list_recent_files",
    Array.isArray(recentFiles) && recentFiles.length > 0,
    `listados ${recentFiles.length} archivos`,
  );
  firstFileId = recentFiles[0]?.id || firstFileId;
  firstNonFolderId =
    recentFiles.find((f) => f.mimeType !== "application/vnd.google-apps.folder")?.id ||
    firstNonFolderId;

  if (firstFileId) {
    const meta = await client.callTool({ name: "get_file_metadata", arguments: { fileId: firstFileId } });
    let m = null;
    try { m = JSON.parse(textOf(meta)); } catch {}
    record("get_file_metadata", !!m?.id && !!m?.title, `title="${m?.title}"`);
  } else {
    record("get_file_metadata", false, "sin fileId de referencia");
  }

  if (firstFileId) {
    const perm = await client.callTool({ name: "get_file_permissions", arguments: { fileId: firstFileId } });
    let p = [];
    try { p = JSON.parse(textOf(perm)); } catch {}
    record("get_file_permissions", Array.isArray(p), `${p.length} permisos`);
  } else {
    record("get_file_permissions", false, "sin fileId de referencia");
  }

  let createdId = null;
  let copyId = null;

  try {
    const create = await client.callTool({
      name: "create_file",
      arguments: { title: TEST_TITLE, textContent: TEST_TEXT, contentMimeType: "text/plain" },
    });
    const c = JSON.parse(textOf(create));
    createdId = c.id;
    record("create_file", !!createdId && c.title === TEST_TITLE, `id=${createdId}`);
  } catch (e) {
    record("create_file", false, e.message);
  }

  if (createdId) {
    try {
      const res = await client.callTool({ name: "get_file_metadata", arguments: { fileId: createdId } });
      const m = JSON.parse(textOf(res));
      record("get_file_metadata (creado)", m.id === createdId, `title="${m.title}"`);
    } catch (e) {
      record("get_file_metadata (creado)", false, e.message);
    }

    try {
      const res = await client.callTool({ name: "get_file_permissions", arguments: { fileId: createdId } });
      const p = JSON.parse(textOf(res));
      record("get_file_permissions (creado)", Array.isArray(p), `${p.length} permisos`);
    } catch (e) {
      record("get_file_permissions (creado)", false, e.message);
    }

    try {
      const res = await client.callTool({ name: "download_file_content", arguments: { fileId: createdId } });
      const d = JSON.parse(textOf(res));
      const decoded = Buffer.from(d.content, "base64").toString("utf8");
      record("download_file_content (creado)", decoded === TEST_TEXT, `texto=${JSON.stringify(decoded)}`);
    } catch (e) {
      record("download_file_content (creado)", false, e.message);
    }

    try {
      const res = await client.callTool({ name: "read_file_content", arguments: { fileId: createdId } });
      const r = JSON.parse(textOf(res));
      record("read_file_content (creado)", r.fileContent === TEST_TEXT, `texto=${JSON.stringify(r.fileContent)}`);
    } catch (e) {
      record("read_file_content (creado)", false, e.message);
    }

    try {
      const res = await client.callTool({ name: "search_files", arguments: { query: `title = '${TEST_TITLE}'` } });
      const found = JSON.parse(textOf(res)).files || [];
      record("search_files (creado)", found.some((f) => f.id === createdId), `encontrados ${found.length}`);
    } catch (e) {
      record("search_files (creado)", false, e.message);
    }

    try {
      const res = await client.callTool({
        name: "copy_file",
        arguments: { fileId: createdId, title: `copia-${TEST_TITLE}` },
      });
      const c = JSON.parse(textOf(res));
      copyId = c.id;
      record("copy_file", !!copyId, `id=${copyId}`);
    } catch (e) {
      record("copy_file", false, e.message);
    }
  }

  if (firstNonFolderId) {
    try {
      const res = await client.callTool({ name: "read_file_content", arguments: { fileId: firstNonFolderId } });
      const r = JSON.parse(textOf(res));
      record("read_file_content (existente)", typeof r.fileContent === "string", `longitud=${r.fileContent.length}`);
    } catch (e) {
      record("read_file_content (existente)", false, e.message);
    }
  } else {
    record("read_file_content (existente)", true, "sin archivo no-carpeta de referencia (se omite)");
  }

  const cleanupIds = [createdId, copyId].filter(Boolean);
  if (cleanupIds.length) {
    const deleted = [];
    for (const id of cleanupIds) {
      if (await driveDelete(id)) deleted.push(id);
    }
    record(
      "limpieza",
      deleted.length === cleanupIds.length,
      deleted.length === cleanupIds.length
        ? `eliminados ${deleted.join(", ")}`
        : `pendientes: ${cleanupIds.filter((i) => !deleted.includes(i)).join(", ")}`,
    );
  }
} catch (e) {
  record("conexion", false, e.message);
} finally {
  try { await client.close(); } catch {}
}

console.log(`\n${results.filter((r) => r.ok).length}/${results.length} pasaron`);
process.exit(failures ? 1 : 0);
