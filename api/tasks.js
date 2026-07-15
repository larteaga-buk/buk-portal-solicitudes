/**
 * Vercel Serverless Function: /api/tasks?email=usuario@buk.com
 *
 * Los solicitantes NO son usuarios de ClickUp.
 * Su correo aparece dentro de la descripción de cada tarea en una lista específica.
 * Esta función trae todas las tareas de la lista y filtra por email en descripción.
 *
 * Env vars (Vercel → Settings → Environment Variables):
 *   CLICKUP_API_TOKEN      – token personal de ClickUp (pk_...)
 *   CLICKUP_LIST_ID        – ID de la lista donde están las solicitudes
 *                            (URL de ClickUp: app.clickup.com/.../v/li/ESTE_NÚMERO)
 *   ALLOWED_EMAIL_DOMAINS  – dominios separados por coma: buk.com.br,buk.co,buk.mx,buk.cl,buk.pe
 *   AREA_DETECTION         – cómo detectar el área: "name" | "tag" | "list" | "space"
 */

const CLICKUP_BASE = 'https://api.clickup.com/api/v2';
const AREAS = ['CRM', 'DISEÑO', 'AUDIOVISUAL', 'FRONT'];

function normalize(str = '') {
  return str.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function detectArea(task, method) {
  const name = normalize(task.name || '');
  const desc = normalize(task.description || '');

  const checks = {
    name: () => {
      // Prefijo estándar: [CRM], CRM -, CRM:
      const byPrefix = AREAS.find(a =>
        name.startsWith(`[${normalize(a)}]`) ||
        name.startsWith(normalize(a) + ' -') ||
        name.startsWith(normalize(a) + ':')
      );
      if (byPrefix) return byPrefix;

      // Patrón real: "País - Área / SubTipo - Descripción"
      // Captura lo que hay entre el primer " - " y el " / " o segundo " - "
      const dashSlash = task.name?.match(/^[^-]+-\s*([^/\-]+)/);
      if (dashSlash) {
        const segment = normalize(dashSlash[1]);
        const bySegment = AREAS.find(a => segment.includes(normalize(a)));
        if (bySegment) return bySegment;
      }

      // Busca el nombre del área en cualquier parte del título
      return AREAS.find(a => name.includes(normalize(a)));
    },
    description: () => {
      // Patrón: "CONTROL INTERNO (Diseño)" en la descripción
      const match = desc.match(/CONTROL INTERNO\s*\(([^)]+)\)/);
      if (match) {
        const areaInDesc = normalize(match[1]);
        return AREAS.find(a => areaInDesc.includes(normalize(a)));
      }
      // También busca el nombre del área suelta en la descripción
      return AREAS.find(a => desc.includes(normalize(a)));
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

  // Orden de prioridad: método configurado → name → description → tag → list → space
  const methods = [method, 'name', 'description', 'tag', 'list', 'space'].filter(Boolean);
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

// Extrae Puntos_Carga desde la descripción → "• Puntos_Carga: [5]" o "Puntos_Carga: 5"
function findPuntosFromDescription(description) {
  if (!description) return null;
  for (const line of description.split('\n')) {
    if (/puntos_carga/i.test(line)) {
      const match = line.match(/[:\[]\s*(\d+(?:\.\d+)?)\s*\]?/)
      if (match) return Number(match[1]);
    }
  }
  return null;
}

// Extrae si la tarea pertenece a un sprint (custom field con "sprint" en el nombre)
function findSprintFromTask(task) {
  const fields = task.custom_fields || [];
  for (const field of fields) {
    const name = (field.name || '').toLowerCase();
    if (name.includes('sprint')) {
      const val = field.value;
      if (val === null || val === undefined || val === '') return null;
      // Checkbox: "1" = sí, "0" = no
      if (val === '1' || val === 1 || val === true) return 'Sí';
      if (val === '0' || val === 0 || val === false) return 'No';
      // Dropdown con opciones
      if (typeof val === 'number' && field.type_config?.options) {
        const opt = field.type_config.options.find(o => o.orderindex === val);
        return opt?.name || null;
      }
      // Texto directo
      if (typeof val === 'string') return val;
      return null;
    }
  }
  return null;
}

// Extrae el link de Entregable_Final desde el texto de la descripción
// Formato esperado: "• Entregable_Final: https://..." o "• Entregable_Final: [texto](url)"
function findEntregableFromDescription(description) {
  if (!description) return null;

  const lines = description.split('\n');
  for (const line of lines) {
    if (/entregable_final/i.test(line)) {
      // URL directa: https://...
      const urlMatch = line.match(/https?:\/\/[^\s\])"']+/);
      if (urlMatch) return urlMatch[0];

      // Markdown: [texto](url)
      const mdMatch = line.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
      if (mdMatch) return mdMatch[2];
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

  const { email, country, team } = req.query;
  const MODE = email ? 'email' : 'team';

  // 1. Validar parámetros según modo
  if (MODE === 'email') {
    const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS || 'buk.com,buk.la')
      .split(',').map(d => d.trim().toLowerCase());
    const domain = email?.split('@')[1]?.toLowerCase();
    if (!email || !domain || !allowedDomains.includes(domain)) {
      return res.status(401).json({ error: 'Correo no válido. Debes usar tu email @buk.' });
    }
  } else {
    if (!country || !team) {
      return res.status(400).json({ error: 'Debes seleccionar país y área.' });
    }
  }

  const TOKEN = process.env.CLICKUP_API_TOKEN;
  const LIST_ID = process.env.CLICKUP_LIST_ID;
  const AREA_METHOD = process.env.AREA_DETECTION || 'name';

  if (!TOKEN || !LIST_ID) {
    return res.status(500).json({ error: 'Configuración del servidor incompleta (falta CLICKUP_LIST_ID).' });
  }

  try {
    // 2. Traer todas las tareas de la lista (paginado)
    let allTasks = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams({
        include_closed: 'true',
        subtasks: 'true',
        page: String(page),
      });

      const data = await clickup(`/list/${LIST_ID}/task?${params}`, TOKEN);
      const tasks = data.tasks || [];
      allTasks = allTasks.concat(tasks);

      hasMore = tasks.length === 100;
      page++;
      if (page > 19) break;
    }

    // 3. Filtrar según modo
    let matching = [];

    if (MODE === 'email') {
      const emailLower = email.toLowerCase();
      matching = allTasks.filter(t => {
        const desc = (t.description || '').toLowerCase();
        if (desc.includes(emailLower)) return true;
        if ((t.name || '').toLowerCase().includes(emailLower)) return true;
        for (const f of (t.custom_fields || [])) {
          const val = f.value;
          if (!val) continue;
          if (typeof val === 'string' && val.toLowerCase().includes(emailLower)) return true;
          if (typeof val === 'object' && JSON.stringify(val).toLowerCase().includes(emailLower)) return true;
        }
        return false;
      });
    } else {
      // Modo equipo: busca el país y el área en los campos del formulario dentro de la descripción
      // Formato en descripción: "[¿De que país es tu solicitud?]: Colombia"
      //                         "[¿A qué área perteneces?]: Marketing - Brand"
      const countryLower = country.toLowerCase();
      const teamLower = team.toLowerCase();
      matching = allTasks.filter(t => {
        const desc = (t.description || '').toLowerCase();
        return desc.includes(countryLower) && desc.includes(teamLower);
      });
    }

    if (matching.length === 0) {
      const msg = MODE === 'email'
        ? `No encontramos solicitudes con ese correo (se revisaron ${allTasks.length} tareas). Verifica que el email sea exactamente igual al que usaste en el formulario.`
        : `No encontramos solicitudes para ${country} · ${team}.`;
      return res.status(404).json({ error: msg });
    }

    // Usuario para mostrar en el header
    const userDisplay = MODE === 'email'
      ? { name: email.split('@')[0], email }
      : { name: `${country} · ${team}`, country, team };

    // 4. Agrupar por área
    const grouped = Object.fromEntries(AREAS.map(a => [a, []]));
    grouped['OTRO'] = [];

    for (const task of matching) {
      const area = detectArea(task, AREA_METHOD);
      const entregableLink =
        findEntregableFromDescription(task.description) ||
        findCustomField(task, 'entregable', 'link', 'url', 'deliverable', 'entrega') ||
        null;

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
        puntos: findPuntosFromDescription(task.description),
        sprint: findSprintFromTask(task),
        list: task.list?.name || '',
        space: task.space?.name || '',
      });
    }

    return res.json({ user: userDisplay, tasks: grouped });

  } catch (err) {
    console.error('[/api/tasks]', err);
    return res.status(500).json({ error: err.message || 'Error al obtener tareas.' });
  }
}
