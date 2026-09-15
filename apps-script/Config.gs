/**
 * Constantes del Portal de Solicitantes.
 * Secretos (token ClickUp, list id) van en Script Properties, no aquí.
 *
 * Properties esperadas (Archivo → Propiedades del proyecto → Propiedades del script):
 *   CLICKUP_API_TOKEN
 *   CLICKUP_LIST_ID
 *   ALLOWED_EMAIL_DOMAINS   (default: buk.com,buk.la)
 *   AREA_DETECTION          (default: name)  name | tag | list | space | description
 *   CACHE_SECONDS           (default: 300)
 */

var AREAS = ['CONVERSIÓN', 'CRM', 'DISEÑO', 'AUDIOVISUAL', 'FRONT'];

var COUNTRIES = ['Chile', 'Colombia', 'Perú', 'México', 'Brasil', 'LATAM', 'Corp'];

var TEAMS = [
  'Product Marketing',
  'Customer Happiness',
  'Customer Education',
  'Marketing - Inbound',
  'Marketing - Content',
  'Marketing - Brand',
  'Marketing - Acquisition',
  'Personas',
  'Sales',
  'Sales - Outbound',
  'Sales - Partners',
  'Seguridad',
  'Data',
  'Digital',
  'Research',
  'Producto',
  'Operaciones',
  'SAC',
  'RevOps',
];

var CLICKUP_BASE = 'https://api.clickup.com/api/v2';
var CACHE_KEY = 'clickup_tasks_v1';
var MAX_PAGES = 20;
