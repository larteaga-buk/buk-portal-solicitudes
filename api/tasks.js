/**
 * Vercel Serverless Function: /api/tasks?email=usuario@buk.com
 * Fetches ClickUp tasks assigned to the given @buk email and groups them by area.
 *
 * Env vars required (set in Vercel dashboard):
 *   CLICKUP_API_TOKEN    – ClickUp personal API token
 *   CLICKUP_TEAM_ID      – ClickUp workspace/team ID
 *   ALLOWED_EMAIL_DOMAINS – comma-separated, e.g. "buk.com,buk.la"
 *   AREA_DETECTION       – "tag" | "list" | "space" | "name"
 */

const CLICKUP_BASE = 'https://api.clickup.com/api/v2';

const AREAS = ['CRM', 'DISEÑO', 'AUDIOVISUAL', 'FRONT'];

// Normalize accents for comparison
function normalize(str = '') {
  return str
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// Detect area from a ClickUp task object
function detectArea(task, method) {
  const checks = {
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
    name: () => {
      const name = normalize(task.name || '');
      return AREAS.find(a => name.startsWith(`[${normalize(a)}]`) || name.startsWith(normalize(a) + ' -'));
    },
  };

  // Try configured method first, then fall back through all methods
  const methods = [method, 'tag', 'list', 'space', 'name'].filter(Boolean);
  for (const m of [...new Set(methods)]) {
    const found = checks[m]?.();
    if (found) return found;
  }
  return 'OTRO';
}

// Find a custom field value by name pattern
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
  // CORS – allow the Vercel frontend origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { email } = req.query;

  // 1. Validate email domain
  const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS || 'buk.com,buk.la')
    .split(',')
    .map(d => d.trim().toLowerCase());

  const domain = email?.split('@')[1]?.toLowerCase();
  if (!email || !domain || !allowedDomains.includes(domain)) {
    return res.status(401).json({ error: 'Correo no válido. Debes usar tu email @buk.' });
  }

  const TOKEN = process.env.CLICKUP_API_TOKEN;
  const TEAM_ID = process.env.CLICKUP_TEAM_ID;
  const AREA_METHOD = process.env.AREA_DETECTION || 'tag';

  if (!TOKEN || !TEAM_ID) {
    return res.status(500).json({ error: 'Configuración del servidor incompleta.' });
  }

  try {
    // 2. Get workspaces → find user by email
    // GET /api/v2/team returns all workspaces with their members array
    const teamsData = await clickup(`/team`, TOKEN);
    const teams = teamsData.teams || [];

    // Find the matching workspace and the user within it
    let userId = null;
    let userName = null;

    for (const team of teams) {
      if (String(team.id) !== String(TEAM_ID)) continue;
      const match = (team.members || []).find(
        m => m.user?.email?.toLowerCase() === email.toLowerCase()
      );
      if (match) {
        userId = match.user.id;
        userName = match.user.username || match.user.email;
        break;
      }
    }

    if (!userId) {
      return res.status(404).json({
        error: 'No se encontró ningún usuario con ese correo en ClickUp.',
      });
    }

    // 3. Fetch tasks assigned to this user (paginate if needed)
    let allTasks = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams({
        assignees: userId,
        include_closed: 'true',
        subtasks: 'true',
        include_markdown_description: 'false',
        page: String(page),
      });

      const data = await clickup(`/team/${TEAM_ID}/task?${params}`, TOKEN);
      const tasks = data.tasks || [];
      allTasks = allTasks.concat(tasks);

      // ClickUp returns max 100 tasks per page; stop when fewer than 100 received
      hasMore = tasks.length === 100;
      page++;
      if (page > 9) break; // safety limit: 1000 tasks
    }

    // 4. Process and group tasks
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

    return res.json({ user: { id: userId, name: userName, email }, tasks: grouped });
  } catch (err) {
    console.error('[/api/tasks]', err);
    return res.status(500).json({ error: err.message || 'Error al obtener tareas.' });
  }
}
