# Portal de Solicitantes · Buk Marketing

App React + Vite para que los solicitantes vean el estado de sus tareas en ClickUp por área (CRM, Diseño, Audiovisual, Front).

---

## Deploy en Vercel (5 pasos)

### 1. Subir el proyecto a GitHub

Crea un repositorio en GitHub y sube esta carpeta.

### 2. Importar en Vercel

- Entra a [vercel.com](https://vercel.com) → **Add New Project**
- Selecciona el repositorio
- Framework: **Vite** (se detecta automáticamente)
- Build command: `npm run build` · Output dir: `dist`

### 3. Configurar variables de entorno

En Vercel → **Settings → Environment Variables**, agrega:

| Variable | Valor |
|---|---|
| `CLICKUP_API_TOKEN` | Tu token personal de ClickUp (`pk_...`) |
| `CLICKUP_TEAM_ID` | ID del workspace de ClickUp |
| `ALLOWED_EMAIL_DOMAINS` | `buk.com,buk.la` (separados por coma) |
| `AREA_DETECTION` | `tag` · `list` · `space` · `name` |

#### ¿Cómo obtener el CLICKUP_TEAM_ID?
En ClickUp: avatar → **Workspaces** → el ID aparece en la URL: `app.clickup.com/{TEAM_ID}/...`

#### ¿Cómo obtener el CLICKUP_API_TOKEN?
ClickUp → avatar abajo → **Apps** → **API Token**

### 4. Configurar AREA_DETECTION

La app detecta el área (CRM, Diseño, Audiovisual, Front) de cada tarea según el método elegido:

- **`tag`** ← Recomendado: la tarea tiene etiquetas `CRM`, `DISEÑO`, `AUDIOVISUAL`, `FRONT`
- **`list`**: el nombre de la lista contiene el área
- **`space`**: el nombre del espacio contiene el área
- **`name`**: el título empieza con `[CRM]`, `[DISEÑO]`, etc.

> Si la tarea no coincide con ningún área se agrupa en "OTRO" (oculto en la UI).

### 5. Deploy

Haz clic en **Deploy**. Vercel construye y publica la app automáticamente.

---

## Desarrollo local

```bash
npm install
cp .env.example .env.local
# edita .env.local con tus valores
npm run dev
```

> Las funciones serverless (`/api`) necesitan Vercel CLI para correr localmente:
> ```bash
> npm install -g vercel
> vercel dev
> ```

---

## Campos mostrados por tarea

| Campo | Fuente en ClickUp |
|---|---|
| Nombre | `task.name` |
| Descripción | `task.description` |
| Fecha solicitada | `task.date_created` |
| Fecha de entrega | `task.due_date` |
| Estado | `task.status.status` + color |
| Link entregable | Custom field: `Entregable`, `Link`, `URL` o `Deliverable` |

---

## Personalización

- **Logo / colores**: edita `src/components/LoginPage.jsx` y `src/components/Dashboard.jsx`
- **Áreas**: modifica el array `AREAS` en `api/tasks.js` y en `Dashboard.jsx`
- **Dominios permitidos**: cambia `ALLOWED_EMAIL_DOMAINS` en Vercel
