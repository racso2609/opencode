# drive-local MCP

Servidor MCP local para Google Drive usando la Drive API v3. Se expone en opencode con el nombre `drive-local`.

## Configuración

En `opencode.json`, dentro de `mcp`:

```jsonc
"drive-local": {
  "type": "local",
  "command": ["node", "/Users/racso/.config/opencode/drive-local/server.mjs"],
  "enabled": true
}
```

Instalar dependencias (primera vez):

```bash
cd ~/.config/opencode/drive-local
npm install
```

## Autenticación

El servidor usa OAuth 2.0. Los tokens se guardan en:

```
~/.local/share/opencode/mcp-auth.json
```

bajo la clave `drive`:

```json
{
  "drive": {
    "tokens": {
      "accessToken": "...",
      "refreshToken": "...",
      "expiresAt": 0,
      "scope": "https://www.googleapis.com/auth/drive"
    },
    "clientInfo": {
      "clientId": "...",
      "clientSecret": "..."
    }
  }
}
```

- El `accessToken` se renueva automáticamente 2 minutos antes de expirar usando el `refreshToken`.
- Para renovar hace falta el `clientId`/`clientSecret`. Si no están en `clientInfo`, se toman de las variables de entorno `GOOGLE_DRIVE_MCP_CLIENT_ID` y `GOOGLE_DRIVE_MCP_CLIENT_SECRET` (las mismas que usa el MCP remoto de Google en `opencode.json`).
- Si no hay `accessToken` en `mcp-auth.json`, el servidor falla al arrancar con un error descriptivo.

## Herramientas disponibles

| Herramienta                | Descripción                                                                 |
| -------------------------- | --------------------------------------------------------------------------- |
| `search_files`             | Busca archivos con una query estructurada (`title`, `fullText`, `mimeType`, `modifiedTime`, `parentId`, `owner`, `sharedWithMe`, combinables con `and`/`or`/`not`). |
| `list_recent_files`        | Lista archivos recientes, ordenados por `modifiedTime desc` por defecto.     |
| `get_file_metadata`        | Metadatos de un archivo concreto (`fileId`).                                 |
| `get_file_permissions`     | Permisos/configuración de compartición de un archivo.                        |
| `download_file_content`    | Descarga el contenido como base64. Para archivos nativos de Google (Docs/Sheets/etc.) usa `exportMimeType` (por defecto `text/plain`). |
| `read_file_content`        | Lee el contenido de un archivo como texto plano, opcionalmente con sus comentarios (`includeComments`). |
| `create_file`              | Crea o sube un archivo (`textContent` o `base64Content`, con `contentMimeType`). |
| `copy_file`                | Copia un archivo existente, opcionalmente a otra carpeta o con otro nombre.  |

## Detalles de la query en `search_files`

Sintaxis: `query_term operator values`. Los strings se entrecomillan con comillas simples.

```text
title contains 'informe' and mimeType = 'application/vnd.google-apps.document'
parentId = '1ABC...' and modifiedTime > '2026-01-01T00:00:00'
owner = 'yo@example.com' or sharedWithMe = true
```

Se traducen automáticamente alias a la sintaxis de Drive: `parentId = 'X'` → `'X' in parents`, `owner = 'X'` → `'X' in owners`, `sharedWithMe` → `sharedWithMe`/`not sharedWithMe`, `title` → `name`.

## Testing

Ejecutar todas las pruebas de integración:

```bash
cd ~/.config/opencode/drive-local
npm test
```

`test.mjs` arranca el server vía stdio con el SDK de MCP y verifica cada herramienta:

| Test                                   | Qué comprueba                                        |
| -------------------------------------- | ---------------------------------------------------- |
| `listTools`                            | Que se registren las 8 herramientas                  |
| `search_files`                         | Búsqueda de carpetas                                 |
| `list_recent_files`                    | Listado de archivos recientes                        |
| `get_file_metadata`                    | Metadatos de un archivo real                         |
| `get_file_permissions`                 | Permisos de un archivo real                          |
| `create_file`                          | Creación de un archivo de texto                      |
| `get_file_metadata`/`permissions` (creado) | Metadatos y permisos del archivo creado          |
| `download_file_content` (creado)       | Round-trip del contenido base64                      |
| `read_file_content` (creado)           | Lectura del contenido como texto                     |
| `search_files` (creado)                | Que el archivo creado aparezca en búsquedas          |
| `copy_file`                            | Copia del archivo creado                             |
| `read_file_content` (existente)        | Lectura de un archivo no-carpeta real                |
| `limpieza`                             | Borra los archivos de prueba creados (Drive API)     |

Los archivos de prueba se crean con nombre `opencode-drive-local-test-*.txt` en la raíz de Drive y se eliminan automáticamente al terminar. Salida con código de salida `0` si todo pasa, `1` si algo falla.

## Notas

- Los resultados se devuelven en formato JSON con campos normalizados: `id`, `title`, `mimeType`, `parentId`, `createdTime`, `modifiedTime`, `owner`, `fileSize`, `viewUrl`, `resourceUri`, entre otros.
- El server usa `supportsAllDrives` y `includeItemsFromAllDrives` para listar y acceder a archivos de todas las unidades compartidas.
- La carpeta con `application/vnd.google-apps.folder` se devuelve como `(carpeta)` al leer su contenido.
