# Obsidian MCP Server

Servidor MCP que permite a agentes de IA interactuar con un vault de Obsidian a través del sistema de archivos. Operación pura sobre archivos `.md` — sin dependencia de la API de Obsidian.

## Herramientas disponibles

| Herramienta | Descripción |
|-------------|-------------|
| `read_note` | Lee el contenido completo de una nota |
| `create_note` | Crea una nota nueva (con directorios intermedios) |
| `edit_note` | Reemplaza el contenido de una nota existente |
| `append_to_note` | Agrega contenido al final de una nota |
| `search_notes` | Busca en nombres de archivo y/o contenido |
| `list_notes` | Lista todas las notas `.md` recursivamente |
| `delete_note` | Elimina una nota (con confirmación o dry-run) |
| `get_vault_stats` | Estadísticas del vault (notas, tamaño, etc.) |

## Instalación (Zorin OS 18)

### 1. Verificar Node.js 18+

```bash
node -v
# Si no tienes Node.js 18+, instálalo:
# sudo apt install nodejs npm
```

### 2. Instalar pnpm

```bash
npm i -g pnpm
```

### 3. Instalar dependencias

```bash
cd obsidian-mcp
pnpm install
```

### 4. Configurar la ruta del vault

```bash
cp .env.example .env
```

Edita `.env` y establece la ruta a tu vault:

```
OBSIDIAN_VAULT_PATH=/home/tu-usuario/tu-vault
```

### 5. Probar el servidor

```bash
pnpm start
```

Deberías ver en stderr:
```
Obsidian MCP Server starting...
  Vault: /home/tu-usuario/tu-vault
  Notes found: XX
MCP server running via stdio
```

## Configuración MCP

### VS Code / Antigravity

Agrega el siguiente bloque a tu configuración MCP (`mcp.json` o equivalente):

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "pnpm",
      "args": ["--dir", "/ruta/absoluta/obsidian-mcp", "start"],
      "env": {
        "OBSIDIAN_VAULT_PATH": "/home/tu-usuario/tu-vault"
      }
    }
  }
}
```

> **Nota:** Reemplaza `/ruta/absoluta/obsidian-mcp` con la ruta real donde clonaste este proyecto y `/home/tu-usuario/tu-vault` con la ruta a tu vault de Obsidian.

## Desarrollo

Modo watch (reinicia automáticamente al guardar cambios):

```bash
pnpm dev
```

## Seguridad

- **Path traversal prevention**: Todos los paths se validan para no escapar del vault root.
- **Encoding**: Lectura y escritura en UTF-8.
- **Logging**: Solo a stderr — nunca se contamina el transporte stdio.
- **Errores**: Mensajes legibles para el agente, sin stacktraces crudos.
