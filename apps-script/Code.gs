/**
 * Portal de Solicitantes · Buk Marketing
 * Web App de Apps Script (reemplazo de React + Vercel /api/tasks).
 */

function doGet() {
  var template = HtmlService.createTemplateFromFile('Index');
  template.bootstrap = JSON.stringify({
    email: getCurrentUserEmail_() || '',
    countries: COUNTRIES,
    teams: TEAMS,
    areas: AREAS,
  }) || '{}';
  return template
    .evaluate()
    .setTitle('Portal de solicitantes · Buk Marketing')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Bootstrap para el cliente. No expone secretos.
 */
function getBootstrap() {
  return {
    email: getCurrentUserEmail_(),
    countries: COUNTRIES,
    teams: TEAMS,
    areas: AREAS,
  };
}

/**
 * Punto de entrada del cliente (google.script.run.getTasks).
 * opts: { mode: 'email'|'team', email?, country?, team? }
 */
function getTasks(opts) {
  opts = opts || {};
  var mode = opts.mode === 'team' ? 'team' : 'email';
  var props = PropertiesService.getScriptProperties();

  var token = props.getProperty('CLICKUP_API_TOKEN');
  var listId = props.getProperty('CLICKUP_LIST_ID');
  if (!token || !listId) {
    throw new Error('Configuración incompleta: falta CLICKUP_API_TOKEN o CLICKUP_LIST_ID en las propiedades del script.');
  }

  var email = '';
  var country = '';
  var team = '';

  if (mode === 'email') {
    email = String(opts.email || getCurrentUserEmail_() || '').trim().toLowerCase();
    if (!isAllowedEmail_(email, props)) {
      throw new Error('Correo no válido. Debes usar tu email @buk.');
    }
  } else {
    country = String(opts.country || '').trim();
    team = String(opts.team || '').trim();
    if (!country || !team) {
      throw new Error('Debes seleccionar país y área.');
    }
  }

  var areaMethod = props.getProperty('AREA_DETECTION') || 'name';
  var allTasks = loadAllTasks_(token, listId, props);
  var matching = filterTasks_(allTasks, mode, email, country, team);

  if (!matching.length) {
    var msg = mode === 'email'
      ? 'No encontramos solicitudes con ese correo (se revisaron ' + allTasks.length + ' tareas). Verifica que el email sea exactamente igual al que usaste en el formulario.'
      : 'No encontramos solicitudes para ' + country + ' · ' + team + '.';
    throw new Error(msg);
  }

  var user = mode === 'email'
    ? { name: email.split('@')[0], email: email }
    : { name: country + ' · ' + team, email: '', country: country, team: team };

  return {
    user: user,
    tasks: groupTasks_(matching, areaMethod),
  };
}

/**
 * Diagnóstico rápido desde el editor (Ejecutar → checkConfig).
 */
function checkConfig() {
  var props = PropertiesService.getScriptProperties();
  var keys = ['CLICKUP_API_TOKEN', 'CLICKUP_LIST_ID', 'ALLOWED_EMAIL_DOMAINS', 'AREA_DETECTION', 'CACHE_SECONDS'];
  var out = {};
  keys.forEach(function (k) {
    var v = props.getProperty(k);
    if (k === 'CLICKUP_API_TOKEN') {
      out[k] = v ? 'set (' + v.length + ' chars)' : 'MISSING';
    } else {
      out[k] = v || '(default)';
    }
  });
  out.activeUser = getCurrentUserEmail_() || '(empty — deploy as web app with domain access)';
  Logger.log(JSON.stringify(out, null, 2));
  return out;
}

// ── Auth / config ──────────────────────────────────────────────

function getCurrentUserEmail_() {
  var email = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || '';
  return String(email).toLowerCase();
}

function isAllowedEmail_(email, props) {
  if (!email || email.indexOf('@') < 0) return false;
  var domain = email.split('@')[1].toLowerCase();
  var raw = (props.getProperty('ALLOWED_EMAIL_DOMAINS') || 'buk.com,buk.la')
    .split(',')
    .map(function (d) { return d.trim().toLowerCase(); })
    .filter(Boolean);
  if (raw.indexOf(domain) !== -1) return true;
  return domain.indexOf('buk.') === 0;
}

// ── ClickUp fetch + cache ──────────────────────────────────────

function loadAllTasks_(token, listId, props) {
  var cached = readCachedTasks_();
  if (cached) return cached;

  var all = [];
  var page = 0;
  var hasMore = true;

  while (hasMore) {
    var path = '/list/' + encodeURIComponent(listId) + '/task?include_closed=true&subtasks=true&page=' + page;
    var data = clickupFetch_(path, token);
    var tasks = (data && data.tasks) || [];
    for (var i = 0; i < tasks.length; i++) {
      all.push(compactTask_(tasks[i]));
    }
    hasMore = tasks.length === 100;
    page++;
    if (page > MAX_PAGES) break;
  }

  writeCachedTasks_(all, props);
  return all;
}

function clickupFetch_(path, token) {
  var res = UrlFetchApp.fetch(CLICKUP_BASE + path, {
    method: 'get',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    muteHttpExceptions: true,
  });
  var code = res.getResponseCode();
  var body = res.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error('ClickUp ' + code + ': ' + body.substring(0, 300));
  }
  return JSON.parse(body);
}

function compactTask_(task) {
  var tags = (task.tags || []).map(function (t) {
    return { name: t.name };
  });
  var fields = (task.custom_fields || []).map(function (f) {
    return {
      name: f.name,
      url: f.url || null,
      value: f.value,
      type_config: f.type_config || null,
    };
  });
  var assignees = (task.assignees || []).map(function (a) {
    return { username: a.username, email: a.email };
  });
  return {
    id: task.id,
    name: task.name,
    description: task.description || '',
    status: task.status || {},
    date_created: task.date_created,
    due_date: task.due_date,
    date_done: task.date_done,
    url: task.url,
    tags: tags,
    custom_fields: fields,
    assignees: assignees,
    list: task.list ? { name: task.list.name } : {},
    space: task.space ? { name: task.space.name } : {},
  };
}

function readCachedTasks_() {
  var cache = CacheService.getScriptCache();
  var metaRaw = cache.get(CACHE_KEY + '_meta');
  if (!metaRaw) return null;
  try {
    var meta = JSON.parse(metaRaw);
    if (!meta.chunks) return null;
    var parts = [];
    for (var i = 0; i < meta.chunks; i++) {
      var chunk = cache.get(CACHE_KEY + '_' + i);
      if (!chunk) return null;
      parts.push(chunk);
    }
    return JSON.parse(parts.join(''));
  } catch (e) {
    return null;
  }
}

function writeCachedTasks_(tasks, props) {
  var json = JSON.stringify(tasks);
  var ttl = parseInt(props.getProperty('CACHE_SECONDS') || '300', 10);
  if (isNaN(ttl) || ttl < 30) ttl = 300;
  if (ttl > 21600) ttl = 21600;

  var cache = CacheService.getScriptCache();
  var CHUNK = 90000;
  var chunks = Math.ceil(json.length / CHUNK) || 1;
  if (chunks > 20) return; // demasiado grande para CacheService

  try {
    var payload = {};
    payload[CACHE_KEY + '_meta'] = JSON.stringify({ chunks: chunks, count: tasks.length, ts: Date.now() });
    for (var i = 0; i < chunks; i++) {
      payload[CACHE_KEY + '_' + i] = json.substring(i * CHUNK, (i + 1) * CHUNK);
    }
    cache.putAll(payload, ttl);
  } catch (e) {
    Logger.log('Cache skip: ' + e.message);
  }
}

// ── Filter / map / group ───────────────────────────────────────

function filterTasks_(allTasks, mode, email, country, team) {
  if (mode === 'email') {
    var emailLower = email.toLowerCase();
    return allTasks.filter(function (t) {
      var desc = String(t.description || '').toLowerCase();
      if (desc.indexOf(emailLower) !== -1) return true;
      if (String(t.name || '').toLowerCase().indexOf(emailLower) !== -1) return true;
      var fields = t.custom_fields || [];
      for (var i = 0; i < fields.length; i++) {
        var val = fields[i].value;
        if (!val) continue;
        if (typeof val === 'string' && val.toLowerCase().indexOf(emailLower) !== -1) return true;
        if (typeof val === 'object' && JSON.stringify(val).toLowerCase().indexOf(emailLower) !== -1) return true;
      }
      return false;
    });
  }

  var countryLower = country.toLowerCase();
  var teamLower = team.toLowerCase();
  return allTasks.filter(function (t) {
    var desc = String(t.description || '').toLowerCase();
    return desc.indexOf(countryLower) !== -1 && desc.indexOf(teamLower) !== -1;
  });
}

function groupTasks_(matching, areaMethod) {
  var grouped = {};
  AREAS.forEach(function (a) { grouped[a] = []; });
  grouped.OTRO = [];

  matching.forEach(function (task) {
    var area = detectArea_(task, areaMethod);
    if (!grouped[area]) grouped[area] = [];
    grouped[area].push(mapTask_(task));
  });
  return grouped;
}

function mapTask_(task) {
  var entregableLinks = findEntregableFromDescription_(task.description);
  if (!entregableLinks.length) {
    var customLink = findCustomField_(task, ['entregable', 'link', 'url', 'deliverable', 'entrega']);
    if (customLink) entregableLinks = [customLink];
  }
  return {
    id: task.id,
    name: task.name,
    description: task.description || '',
    status: (task.status && task.status.status) || '',
    statusColor: (task.status && task.status.color) || '#999',
    dateCreated: task.date_created ? Number(task.date_created) : null,
    dateDue: task.due_date ? Number(task.due_date) : null,
    dateDone: task.date_done ? Number(task.date_done) : null,
    clickupUrl: task.url,
    entregableLinks: entregableLinks,
    puntos: findPuntosFromDescription_(task.description),
    sprint: findSprintFromTask_(task),
    assignee: ((task.assignees || []).map(function (a) {
      return a.username || (a.email && a.email.split('@')[0]) || '';
    }).filter(Boolean).join(', ')) || null,
    list: (task.list && task.list.name) || '',
    space: (task.space && task.space.name) || '',
  };
}

function normalize_(str) {
  str = String(str || '').toUpperCase();
  return str.normalize ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : str;
}

function detectArea_(task, method) {
  var name = normalize_(task.name || '');
  var desc = normalize_(task.description || '');

  var checks = {
    name: function () {
      var byPrefix = AREAS.filter(function (a) {
        var n = normalize_(a);
        return name.indexOf('[' + n + ']') === 0 ||
          name.indexOf(n + ' -') === 0 ||
          name.indexOf(n + ':') === 0;
      })[0];
      if (byPrefix) return byPrefix;

      var dashSlash = String(task.name || '').match(/^[^-]+-\s*([^/\-]+)/);
      if (dashSlash) {
        var segment = normalize_(dashSlash[1]);
        var bySegment = AREAS.filter(function (a) {
          return segment.indexOf(normalize_(a)) !== -1;
        })[0];
        if (bySegment) return bySegment;
      }
      return AREAS.filter(function (a) { return name.indexOf(normalize_(a)) !== -1; })[0];
    },
    description: function () {
      var match = desc.match(/CONTROL INTERNO\s*\(([^)]+)\)/);
      if (match) {
        var areaInDesc = normalize_(match[1]);
        var found = AREAS.filter(function (a) { return areaInDesc.indexOf(normalize_(a)) !== -1; })[0];
        if (found) return found;
      }
      return AREAS.filter(function (a) { return desc.indexOf(normalize_(a)) !== -1; })[0];
    },
    tag: function () {
      var tags = (task.tags || []).map(function (t) { return normalize_(t.name); });
      return AREAS.filter(function (a) { return tags.indexOf(normalize_(a)) !== -1; })[0];
    },
    list: function () {
      var listName = normalize_((task.list && task.list.name) || '');
      return AREAS.filter(function (a) { return listName.indexOf(normalize_(a)) !== -1; })[0];
    },
    space: function () {
      var spaceName = normalize_((task.space && task.space.name) || '');
      return AREAS.filter(function (a) { return spaceName.indexOf(normalize_(a)) !== -1; })[0];
    },
  };

  var methods = [method, 'name', 'description', 'tag', 'list', 'space'].filter(Boolean);
  var seen = {};
  for (var i = 0; i < methods.length; i++) {
    var m = methods[i];
    if (seen[m]) continue;
    seen[m] = true;
    var found = checks[m] && checks[m]();
    if (found) return found;
  }
  return 'OTRO';
}

function findCustomField_(task, patterns) {
  var fields = task.custom_fields || [];
  for (var i = 0; i < fields.length; i++) {
    var fieldName = normalize_(fields[i].name || '');
    var hit = patterns.some(function (p) { return fieldName.indexOf(normalize_(p)) !== -1; });
    if (hit) {
      var val = fields[i].url || fields[i].value || null;
      if (val && /^https?:\/\//i.test(String(val))) return val;
    }
  }
  return null;
}

function findPuntosFromDescription_(description) {
  if (!description) return null;
  var lines = String(description).split('\n');
  for (var i = 0; i < lines.length; i++) {
    if (/puntos_carga/i.test(lines[i])) {
      var match = lines[i].match(/[:\[]\s*(\d+(?:\.\d+)?)\s*\]?/);
      if (match) return Number(match[1]);
    }
  }
  return null;
}

function findSprintFromTask_(task) {
  if (task.description) {
    var match = String(task.description).match(/tipo_sprint\s*:\s*([^\n•\r]+)/i);
    if (match) {
      var val = match[1].trim().toUpperCase();
      if (val.indexOf('FUERA') !== -1) return 'No';
      if (val.indexOf('EN_SPRINT') !== -1 || val.indexOf('EN SPRINT') !== -1 || val === 'SI' || val === 'SÍ' || val === 'YES') return 'Sí';
      if (val.indexOf('SPRINT') !== -1) return 'Sí';
      return null;
    }
  }
  var fields = task.custom_fields || [];
  for (var i = 0; i < fields.length; i++) {
    var name = String(fields[i].name || '').toLowerCase();
    if (name.indexOf('sprint') === -1) continue;
    var val = fields[i].value;
    if (val === null || val === undefined || val === '') return null;
    if (val === '1' || val === 1 || val === true) return 'Sí';
    if (val === '0' || val === 0 || val === false) return 'No';
    if (typeof val === 'number' && fields[i].type_config && fields[i].type_config.options) {
      var opt = fields[i].type_config.options.filter(function (o) { return o.orderindex === val; })[0];
      return (opt && opt.name) || null;
    }
    if (typeof val === 'string') return val;
    return null;
  }
  return null;
}

function findEntregableFromDescription_(description) {
  if (!description) return [];
  var isValidUrl = function (s) { return /^https?:\/\/.+/i.test(s); };
  var segments = String(description).split(/\n|●/).map(function (s) { return s.trim(); });

  for (var i = 0; i < segments.length; i++) {
    var seg = segments[i];
    if (!/entregable_final/i.test(seg)) continue;

    var mdUrls = [];
    var mdRe = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
    var m;
    while ((m = mdRe.exec(seg))) {
      if (isValidUrl(m[2])) mdUrls.push(m[2]);
    }
    if (mdUrls.length) return mdUrls;

    var urls = [];
    var urlRe = /https?:\/\/[^\s\])"']+/g;
    while ((m = urlRe.exec(seg))) {
      if (isValidUrl(m[0])) urls.push(m[0]);
    }
    if (urls.length) return urls;
  }
  return [];
}
