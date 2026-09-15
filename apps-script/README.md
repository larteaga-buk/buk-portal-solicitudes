# Portal de Solicitantes · Google Apps Script

Migración del portal (antes React + Vercel) a un Web App de Google Apps Script.
Misma funcionalidad: los solicitantes consultan el estado de sus tareas de ClickUp
por correo @buk o por país + área.

## Archivos

| Archivo | Rol |
|---|---|
| `Code.gs` | Backend: `doGet`, `getTasks`, fetch a ClickUp con caché |
| `Config.gs` | Constantes (áreas, países, equipos). Sin secretos |
| `Index.html` | Frontend completo (login + dashboard), se comunica con `google.script.run.getTasks` |
| `appsscript.json` | Manifiesto: V8, scopes, webapp `executeAs: USER_DEPLOYING`, `access: DOMAIN` |

## Deploy (10 min)

### 1. Crear el proyecto

1. Entra a [script.google.com](https://script.google.com) con la cuenta de Google Workspace de Buk
2. **Nuevo proyecto** → nómbralo `Portal de Solicitantes`

### 2. Subir los archivos

Opción A — manual: copia cada archivo al editor (Agregar archivo → Script / HTML).
`Index.html` debe llamarse exactamente `Index` (sin extensión en el editor).

Opción B — [clasp](https://github.com/google/clasp):

```bash
npm install -g @google/clasp
clasp login
clasp create --type webapp --title "Portal de Solicitantes"
clasp push
```

### 3. Configurar las propiedades del script

En el editor: **⚙️ Configuración del proyecto → Propiedades del script**, agrega:

| Propiedad | Valor | Requerida |
|---|---|---|
| `CLICKUP_API_TOKEN` | Token personal de ClickUp (`pk_...`) | ✅ |
| `CLICKUP_LIST_ID` | ID de la lista de solicitudes (está en la URL de ClickUp: `.../v/li/ESTE_NÚMERO`) | ✅ |
| `ALLOWED_EMAIL_DOMAINS` | `buk.com,buk.la` (separados por coma) | opcional |
| `AREA_DETECTION` | `name` · `tag` · `list` · `space` · `description` | opcional (default `name`) |
| `CACHE_SECONDS` | `300` | opcional |

### 4. Verificar

En el editor, ejecuta `checkConfig` (▶️ Ejecutar). Debe mostrar el token como
`set (NN chars)` y el list id sin `MISSING`.

### 5. Publicar

1. **Implementar → Nueva implementación**
2. Tipo: **Aplicación web**
3. Ejecutar como: **Yo** (`USER_DEPLOYING`)
4. Acceso: **Cualquier persona del dominio** (o el que corresponda)
5. **Implementar** → autoriza los permisos → copia la URL `/exec`

Esa URL es el portal. Compártela con los solicitantes.

> Cada cambio de código requiere **Implementar → Administrar implementaciones → ✏️ → Nueva versión**
> para que se refleje en la URL `/exec`. La URL `/dev` siempre apunta al código actual
> (solo visible para el editor).

## Notas de la migración

- **Auth**: en Vercel el usuario escribía su email; en Apps Script el modo "Mi correo"
  pre-llena el email de la sesión de Google (`Session.getActiveUser()`), que con
  `access: DOMAIN` siempre está disponible. La validación de dominio `buk.*` se mantiene
  en el servidor.
- **Caché**: la lista completa de tareas se cachea en `CacheService` (chunked, ~90 KB por
  entrada) durante `CACHE_SECONDS`. Esto evita re-paginar ClickUp en cada consulta.
- **Límites**: `UrlFetchApp` y el runtime de 6 min por ejecución son suficientes para
  ~2.000 tareas (20 páginas × 100). Si la lista crece más, sube `MAX_PAGES` en `Config.gs`.
- **CORS**: desaparece — el frontend y el backend viven en el mismo Web App.
