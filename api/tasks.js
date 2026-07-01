/**
 * Vercel Serverless Function: /api/tasks?email=usuario@buk.com
 *
 * Los solicitantes NO son usuarios de ClickUp.
 * Su correo aparece dentro de la descripción de cada tarea.
 * Esta función busca todas las tareas que contienen el email en su descripción.
 *
 * Env vars (Vercel → Settings → Environment Variables):
 *   CLICKUP_API_TOKEN      – token personal de ClickUp (pk_...)
 *   CLICKUP_TEAM_ID        – ID del workspace (número en la URL de ClickUp)
 *   ALLOWED_EMAIL_DOMAINS  – dominios separados por coma: buk.com.br,buk.co,buk.mx,buk.cl,buk.pe
 *   AREA_DETECTION         – cómo detectar el área: "name" | "tag" | "list" | "space"
 */

const CLICKUP_BASE = 'https://api.clickup.com/api/v2';
const AREAS = ['CRM', 'DISEÑO', 'AUDIOVISUAL', 'FRONT'];

function normalize(str = '') {
  return str.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function detectArea(task, method) {
  const checks = {
    name: () => {
      const name = normalize(task.name || '');
      return AREAS.find(a =>
        name.startsWith(`[${normalize(a)}]`) ||
        name.startsWith(normalize(a) + ' -') ||
        name.startsWith(normalize(a) + ':')
      );
    },
    tag: () => {
      const tags = (task.tags || []).map(t => normalize(t.name));
      return AREAS.find(a => tags.includes(normalize(a)));
    },
    list: () => {
      const listName = normalize(task.list?.name || '');
      return AREAS.find(a => listName.includes(normalize(a)));
    },
    space: () => {
      const spaceName = normalize(task.space?.name || '');
      return AREAS.find(a => spaceName.includes(normalize(a)));
    },
  };

  const methods = [method, 'name', 'tag', 'list', 'space'].filter(Boolean);
  for (const m of [...new Set(methods)]) {
    const found = checks[m]?.();
    if (found) return found;
  }
  return 'OTRO';
}

function findCustomField(task, ...patterns) {
  const fields = task.custom_fields || [];
  for (const field of fields) {
    const fieldName = normalize(field.name || '');
    if (patterns.some(p => fieldName.includes(normalize(p)))) {
      return field.value || field.url || null;
    }
  }
  return null;
}

async function clickup(path, token) {
  const res = await fetch(`${CLICKUP_BASE}${path}`, {
    headers: { Authorization: token, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ClickUp ${res.status}: ${text}`);
  }
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { email } = req.query;

  // 1. Validar dominio del correo
  const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS || 'buk.com,buk.la')
    .split(',').map(d => d.trim().toLowerCase());

  const domain = email?.split('@')[1]?.toLowerCase();
  if (!email || !domain || !allowedDomains.includes(domain)) {
    return res.status(401).json({ error: 'Correo no válido. Debes usar tu email @buk.' });
  }

  const TOKEN = process.env.CLICKUP_API_TOKEN;
  const TEAM_ID = process.env.CLICKUP_TEAM_ID;
  const AREA_METHOD = process.env.AREA_DETECTION || 'name';

  if (!TOKEN || !TEAM_ID) {
    return res.status(500).json({ error: 'Configuración del servidor incompleta.' });
  }

  try {
    // 2. Buscar tareas que contengan el email en su descripción
    // ClickUp universal search devuelve tareas cuyo contenido coincide con el query
    const searchParams = new URLSearchParams({
      query: email,
      include_closed: 'true',
    });

    const searchData = await clickup(
      `/team/${TEAM_ID}/search?${searchParams}`,
      TOKEN
    );

    let allTasks = searchData.tasks || [];

    // Filtro extra: solo tareas donde el email aparece realmente en la descripción o título
    const emailLower = email.toLowerCase();
    allTasks = allTasks.filter(t =>
      (t.description || '').toLowerCase().includes(emailLower) ||
      (t.name || '').toLowerCase().includes(emailLower)
    );

    if (allTasks.length === 0) {
      return res.status(404).json({
        error: 'No encontramos tareas asociadas a este correo. Verifica que el email esté exactamente como lo escribiste en el formulario.',
      });
    }

    // 3. Agrupar por área
    const grouped = Object.fromEntries(AREAS.map(a => [a, []]));
    grouped['OTRO'] = [];

    for (const task of allTasks) {
      const area = detectArea(task, AREA_METHOD);
      const entregableLink =
        findCustomField(task, 'entregable', 'link', 'url', 'deliverable', 'entrega') ||
        task.url;

      grouped[area].push({
        id: task.id,
        name: task.name,
        description: task.description || '',
        status: task.status?.status || '',
        statusColor: task.status?.color || '#999',
        dateCreated: task.date_created ? Number(task.date_created) : null,
        dateDue: task.due_date ? Number(task.due_date) : null,
        clickupUrl: task.url,
        entregableLink,
        list: task.list?.name || '',
        space: task.space?.name || '',
      });
    }

    return res.json({
      user: { name: email.split('@')[0], email },
      tasks: grouped,
    });

  } catch (err) {
    console.error('[/api/tasks]', err);
    return res.status(500).json({ error: err.message || 'Error al obtener tareas.' });
  }
}
