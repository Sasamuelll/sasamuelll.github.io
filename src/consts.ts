// Глобальные настройки сайта — поменяйте под себя
export const SITE_TITLE = 'ASTRO TERMINAL';
export const SITE_TAGLINE = 'PERSONAL BLOG // NOTES, ARTICLES, FIELD LOGS';
export const SITE_DESCRIPTION =
  'A personal blog with a retro terminal look: notes, articles and field logs.';
export const SITE_VERSION = '0.0.1';

// Вымышленный «производитель» терминала — используется в экране загрузки,
// на 404 и в гейте приватного режима. Поменяйте на свою легенду.
export const SITE_VENDOR = 'ORBITEC SYSTEMS';
export const SITE_SYSTEM = 'DATALINK';
export const SITE_MODEL = 'OTX-1200';

// Звук терминала. По умолчанию все сигналы синтезируются на Web Audio —
// никаких файлов не нужно. Если хотите свои сэмплы, положите их в
// public/sounds/ и укажите путь: указанный сигнал начнёт играть файлом,
// остальные останутся синтезированными.
// ВНИМАНИЕ: используйте только то аудио, на которое у вас есть права.
export const SFX_SAMPLES: Partial<
  Record<'hover' | 'select' | 'deny' | 'grant' | 'key' | 'power', string>
> = {
  deny: '/sounds/deny.ogg',
  // Остальные сигналы синтезируются: низкий тон с ФНЧ звучит ближе к
  // динамику в корпусе, чем чистые UI-сэмплы. Добавьте сюда путь к файлу,
  // чтобы заменить любой из них.
};

// показывается в шапке рядом с VER — просто декоративная строка
export const SITE_BUILD_ID = '52656448616972426C61636B';

// Приватный режим: если true — при первом заходе в сессии показывается
// хакерская миниигра-гейт, и только разгадав её, можно попасть в блог.
// ВНИМАНИЕ: сайт статический, поэтому это косметический клиентский замок,
// а не настоящая защита — контент всё равно есть в HTML.
export const PRIVATE_MODE = true;
