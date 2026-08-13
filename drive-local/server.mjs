import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const AUTH_FILE = path.join(
  os.homedir(),
  ".local",
  "share",
  "opencode",
  "mcp-auth.json",
);
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const SCOPE_KEY = "drive";
const TOKEN_BUFFER_SECONDS = 120;

const FILE_FIELDS =
  "id,name,mimeType,parents,createdTime,modifiedTime,viewedByMeTime,sharedWithMeTime,description,fileExtension,size,owners(emailAddress),webViewLink,capabilities(canAddChildren)";

const NATIVE_MIME_TYPES = new Set([
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.spreadsheet",
  "application/vnd.google-apps.presentation",
  "application/vnd.google-apps.drawing",
  "application/vnd.google-apps.jam",
  "application/vnd.google-apps.form",
  "application/vnd.google-apps.folder",
  "application/vnd.google-apps.script",
  "application/vnd.google-apps.site",
  "application/vnd.google-apps.map",
  "application/vnd.google-apps.photo",
  "application/vnd.google-apps.video",
]);

let cachedTokens = null;
let cachedClientInfo = null;

function loadAuth() {
  let entry = {};
  try {
    const raw = JSON.parse(fs.readFileSync(AUTH_FILE, "utf8"));
    entry = raw[SCOPE_KEY] || {};
  } catch (e) {
    throw new Error(`No se pudo leer ${AUTH_FILE}: ${e.message}`);
  }
  cachedTokens = entry.tokens || null;
  cachedClientInfo = entry.clientInfo || null;
  if (!cachedTokens?.accessToken) {
    throw new Error("No hay accessToken para 'drive' en mcp-auth.json");
  }
}

function clientId() {
  return (
    process.env.GOOGLE_DRIVE_MCP_CLIENT_ID ||
    cachedClientInfo?.clientId ||
    ""
  ).trim();
}

function clientSecret() {
  return (
    process.env.GOOGLE_DRIVE_MCP_CLIENT_SECRET ||
    cachedClientInfo?.clientSecret ||
    ""
  ).trim();
}

async function refreshToken() {
  const id = clientId();
  const secret = clientSecret();
  if (!id || !secret) {
    throw new Error(
      "Faltan GOOGLE_DRIVE_MCP_CLIENT_ID / GOOGLE_DRIVE_MCP_CLIENT_SECRET para renovar el token",
    );
  }
  if (!cachedTokens?.refreshToken) {
    throw new Error("No hay refreshToken guardado en mcp-auth.json");
  }
  const params = new URLSearchParams({
    client_id: id,
    client_secret: secret,
    refresh_token: cachedTokens.refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (!res.ok) {
    throw new Error(
      `Fallo al renovar el token: ${res.status} ${(await res.text()).slice(0, 400)}`,
    );
  }
  const data = await res.json();
  cachedTokens = {
    accessToken: data.access_token,
    refreshToken: cachedTokens.refreshToken,
    expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in || 3599),
    scope: cachedTokens.scope,
  };
  const raw = JSON.parse(fs.readFileSync(AUTH_FILE, "utf8"));
  const entry = raw[SCOPE_KEY] || {};
  entry.tokens = cachedTokens;
  raw[SCOPE_KEY] = entry;
  fs.writeFileSync(AUTH_FILE, JSON.stringify(raw, null, 1));
  return cachedTokens;
}

async function getToken() {
  if (!cachedTokens) loadAuth();
  const now = Math.floor(Date.now() / 1000);
  if (
    cachedTokens.expiresAt &&
    now + TOKEN_BUFFER_SECONDS >= cachedTokens.expiresAt
  ) {
    await refreshToken();
  }
  return cachedTokens.accessToken;
}

async function driveFetch(pathWithQuery, options = {}) {
  const doFetch = async () => {
    const token = await getToken();
    const base = options.upload ? UPLOAD_API : DRIVE_API;
    return fetch(`${base}${pathWithQuery}`, {
      method: options.method || "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
      body: options.body,
    });
  };
  let res = await doFetch();
  if (res.status === 401) {
    await refreshToken();
    res = await doFetch();
  }
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 600);
    throw new Error(`Drive API ${res.status}: ${detail}`);
  }
  if (options.binary) {
    return Buffer.from(await res.arrayBuffer());
  }
  return res.json();
}

function translateQuery(q) {
  let s = q;
  s = s.replace(/\bparentId\s*=\s*'([^']+)'/g, "'$1' in parents");
  s = s.replace(/\bowner\s*=\s*'([^']+)'/g, "'$1' in owners");
  s = s.replace(/\bsharedWithMe\s*=\s*true\b/g, "sharedWithMe");
  s = s.replace(/\bsharedWithMe\s*=\s*false\b/g, "not sharedWithMe");
  s = s.replace(/\btitle\s+(contains|=)\s+/g, "name $1 ");
  return s;
}

function toFile(f) {
  return {
    id: f.id,
    title: f.name,
    mimeType: f.mimeType,
    parentId: f.parents && f.parents.length ? f.parents[0] : null,
    createdTime: f.createdTime || null,
    modifiedTime: f.modifiedTime || null,
    viewedByMeTime: f.viewedByMeTime || null,
    sharedWithMeTime: f.sharedWithMeTime || null,
    description: f.description || null,
    fileExtension: f.fileExtension || null,
    fileSize: f.size != null ? parseInt(f.size, 10) : null,
    owner: f.owners && f.owners.length ? f.owners[0].emailAddress : null,
    viewUrl: f.webViewLink || null,
    resourceUri: `https://www.googleapis.com/drive/v3/files/${f.id}`,
    canAddChildren: f.capabilities?.canAddChildren ?? null,
  };
}

const server = new McpServer({
  name: "drive-local",
  version: "1.0.0",
});

server.registerTool(
  "search_files",
  {
    title: "Search for files",
    description:
      "Search for Drive files using a structured query (syntax: query_term operator values). Terms: title, fullText, mimeType, modifiedTime, viewedByMeTime, createdTime, parentId, owner, sharedWithMe. Combine with and/or/not and parentheses. String values single-quoted.",
    inputSchema: {
      query: z.string().describe("The search query"),
      pageSize: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Max results"),
      pageToken: z.string().optional().describe("Pagination token"),
      excludeContentSnippets: z.boolean().optional(),
    },
  },
  async ({ query, pageSize, pageToken }) => {
    const params = new URLSearchParams();
    if (query) params.set("q", translateQuery(query));
    if (pageSize) params.set("pageSize", String(pageSize));
    if (pageToken) params.set("pageToken", pageToken);
    params.set("fields", `files(${FILE_FIELDS}),nextPageToken`);
    const data = await driveFetch(`/files?${params.toString()}`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            files: (data.files || []).map(toFile),
            nextPageToken: data.nextPageToken || null,
          }),
        },
      ],
    };
  },
);

server.registerTool(
  "list_recent_files",
  {
    title: "List recent files",
    description:
      "List recent files for the user. Default sort is recency (modifiedTime desc).",
    inputSchema: {
      orderBy: z
        .string()
        .optional()
        .describe('Sort order, e.g. "modifiedTime desc"'),
      pageSize: z.number().int().min(1).max(100).optional(),
      pageToken: z.string().optional(),
      excludeContentSnippets: z.boolean().optional(),
    },
  },
  async ({ orderBy, pageSize, pageToken }) => {
    const params = new URLSearchParams();
    params.set("orderBy", orderBy || "modifiedTime desc");
    if (pageSize) params.set("pageSize", String(pageSize));
    if (pageToken) params.set("pageToken", pageToken);
    params.set("fields", `files(${FILE_FIELDS}),nextPageToken`);
    params.set("supportsAllDrives", "true");
    params.set("includeItemsFromAllDrives", "true");
    const data = await driveFetch(`/files?${params.toString()}`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            files: (data.files || []).map(toFile),
            nextPageToken: data.nextPageToken || null,
          }),
        },
      ],
    };
  },
);

server.registerTool(
  "get_file_metadata",
  {
    title: "Get file metadata",
    description: "Get the metadata of a specific Drive file.",
    inputSchema: {
      fileId: z.string(),
      excludeContentSnippets: z.boolean().optional(),
    },
  },
  async ({ fileId }) => {
    const params = new URLSearchParams({
      fields: FILE_FIELDS,
      supportsAllDrives: "true",
    });
    const data = await driveFetch(`/files/${fileId}?${params.toString()}`);
    return { content: [{ type: "text", text: JSON.stringify(toFile(data)) }] };
  },
);

server.registerTool(
  "get_file_permissions",
  {
    title: "List file permissions",
    description: "List the permissions (sharing settings) of a Drive file.",
    inputSchema: { fileId: z.string() },
  },
  async ({ fileId }) => {
    const params = new URLSearchParams({
      fields:
        "permissions(id,type,role,emailAddress,displayName,domain,expirationTime,view,deleted)",
      supportsAllDrives: "true",
    });
    const data = await driveFetch(
      `/files/${fileId}/permissions?${params.toString()}`,
    );
    return {
      content: [{ type: "text", text: JSON.stringify(data.permissions || []) }],
    };
  },
);

server.registerTool(
  "download_file_content",
  {
    title: "Download file content",
    description:
      "Download the content of a Drive file as base64. For Google native files, exportMimeType determines the format (defaults to text/plain).",
    inputSchema: {
      fileId: z.string(),
      exportMimeType: z.string().optional(),
    },
  },
  async ({ fileId, exportMimeType }) => {
    const meta = await driveFetch(`/files/${fileId}?fields=id,name,mimeType`);
    let url;
    if (
      NATIVE_MIME_TYPES.has(meta.mimeType) &&
      meta.mimeType !== "application/vnd.google-apps.folder"
    ) {
      const emt = exportMimeType || "text/plain";
      url = `/files/${fileId}/export?mimeType=${encodeURIComponent(emt)}`;
    } else {
      url = `/files/${fileId}?alt=media&supportsAllDrives=true`;
    }
    const buf = await driveFetch(url, { binary: true });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            id: fileId,
            title: meta.name,
            mimeType: meta.mimeType,
            content: buf.toString("base64"),
          }),
        },
      ],
    };
  },
);

server.registerTool(
  "read_file_content",
  {
    title: "Read file content",
    description:
      "Read the content of a known Drive file as natural language text, optionally including its comments.",
    inputSchema: {
      fileId: z.string(),
      includeComments: z.boolean().optional(),
    },
  },
  async ({ fileId, includeComments }) => {
    const meta = await driveFetch(`/files/${fileId}?fields=id,name,mimeType`);
    let content = "";
    if (meta.mimeType === "application/vnd.google-apps.folder") {
      content = "(carpeta)";
    } else {
      try {
        let url;
        if (NATIVE_MIME_TYPES.has(meta.mimeType)) {
          url = `/files/${fileId}/export?mimeType=text/plain`;
        } else {
          url = `/files/${fileId}?alt=media&supportsAllDrives=true`;
        }
        content = (await driveFetch(url, { binary: true })).toString("utf8");
      } catch (e) {
        content = `(no se pudo extraer contenido: ${e.message})`;
      }
    }

    let commentThreads = [];
    let commentsNotSupported = false;
    try {
      if (
        includeComments &&
        meta.mimeType !== "application/vnd.google-apps.folder"
      ) {
        const params = new URLSearchParams({
          fields:
            "comments(id,content,author(displayName),createdTime,quotedFileContent(value),resolved,replies(id,content,author(displayName),createdTime)),nextPageToken",
        });
        const data = await driveFetch(
          `/files/${fileId}/comments?${params.toString()}`,
        );
        commentThreads = (data.comments || []).map((c) => ({
          id: c.id,
          headPost: {
            id: c.id,
            author: { displayName: c.author?.displayName || null },
            content: c.content || "",
            createdTime: c.createdTime || null,
            quotedFileContent: c.quotedFileContent?.value || null,
          },
          resolved: !!c.resolved,
          replies: (c.replies || []).map((r) => ({
            id: r.id,
            author: { displayName: r.author?.displayName || null },
            content: r.content || "",
            createdTime: r.createdTime || null,
          })),
        }));
      }
    } catch (e) {
      commentsNotSupported = true;
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            fileContent: content,
            commentsNotSupported,
            textFormattingNotSupported: false,
            commentThreads,
          }),
        },
      ],
    };
  },
);

server.registerTool(
  "create_file",
  {
    title: "Create or upload a file",
    description:
      "Create or upload a file to Drive. Provide textContent or base64Content; contentMimeType is required when content is provided.",
    inputSchema: {
      title: z.string(),
      parentId: z
        .string()
        .optional()
        .describe("Parent folder id; defaults to root"),
      textContent: z.string().optional(),
      base64Content: z.string().optional(),
      contentMimeType: z.string().optional(),
      disableConversionToGoogleType: z.boolean().optional(),
    },
  },
  async (args) => {
    const {
      title,
      parentId,
      textContent,
      base64Content,
      contentMimeType,
      disableConversionToGoogleType,
    } = args;
    const meta = { name: title };
    if (parentId) meta.parents = [parentId];

    const body = new FormData();
    const metadataBlob = new Blob([JSON.stringify(meta)], {
      type: "application/json",
    });
    body.append("metadata", metadataBlob);

    let buf = Buffer.alloc(0);
    let mime = contentMimeType || "text/plain";
    if (textContent != null && base64Content != null) {
      throw new Error(
        "Especifica solo uno de textContent o base64Content, no ambos",
      );
    }
    if (base64Content != null) {
      buf = Buffer.from(base64Content, "base64");
    } else if (textContent != null) {
      buf = Buffer.from(textContent, "utf8");
    }
    if (disableConversionToGoogleType) {
      mime = contentMimeType || "application/octet-stream";
    }
    body.append("file", new Blob([buf], { type: mime }));

    const params = new URLSearchParams({
      uploadType: "multipart",
      supportsAllDrives: "true",
      fields: FILE_FIELDS,
    });
    const data = await driveFetch(`/files?${params.toString()}`, {
      method: "POST",
      upload: true,
      body,
    });
    return { content: [{ type: "text", text: JSON.stringify(toFile(data)) }] };
  },
);

server.registerTool(
  "copy_file",
  {
    title: "Copy a file",
    description: "Create a copy of an existing Drive file.",
    inputSchema: {
      fileId: z.string(),
      parentId: z.string().optional(),
      title: z.string().optional(),
    },
  },
  async ({ fileId, parentId, title }) => {
    const body = {};
    if (title) body.name = title;
    if (parentId) body.parents = [parentId];
    const params = new URLSearchParams({
      supportsAllDrives: "true",
      fields: FILE_FIELDS,
    });
    const data = await driveFetch(
      `/files/${fileId}/copy?${params.toString()}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    return { content: [{ type: "text", text: JSON.stringify(toFile(data)) }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
