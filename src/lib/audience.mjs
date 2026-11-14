export function hasAdultMedia(value) {
  if (typeof value === 'string') {
    if (/https:\/\/[^\s<>"')]+\/media\/adult\//i.test(value)) return true;
    try { return new URL(value).pathname.startsWith('/media/adult/'); } catch { return false; }
  }
  if (Array.isArray(value)) return value.some(hasAdultMedia);
  if (value && typeof value === 'object') return Object.values(value).some(hasAdultMedia);
  return false;
}

export function isAdult(data, parent) {
  const tagged = (record) => record?.tags?.some((tag) => typeof tag === 'string' && tag.toLowerCase() === 'hentai');
  return data?.adult === true || parent?.adult === true || tagged(data) === true || tagged(parent) === true || hasAdultMedia(data) || hasAdultMedia(parent);
}

export function assertAdultBody(body) {
  const prose = String(body ?? '').replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, '').replace(/`[^`\n]*`/g, '');
  const text = prose.replace(/<\/?(?:details|summary)>/gi, '');
  if (/^\s*(import|export)\s/m.test(text) || /[<>{}]/.test(text) || /!\[/.test(text)) {
    throw new Error('Adult notes support Markdown text, fenced code, and plain details/summary sections without attributes. Put images, comparisons, and videos in their dedicated fields so they load only after the adult-content choice.');
  }
}

export function deferMediaHtml(html) {
  return html.replace(/<(img|video|audio|source|iframe|object|embed)\b[^>]*>/gi, (tag) => {
    let deferred = tag.replace(/(\s)(src|srcset|poster|data)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '$1data-$2=$3');
    if (!/\sdata-adult-media(?:\s|=|>)/i.test(deferred)) deferred = deferred.replace(/^(<\w+)/, '$1 data-adult-media');
    if (/^<(video|audio)\b/i.test(deferred)) {
      deferred = deferred.replace(/\sautoplay(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/gi, '').replace(/\spreload\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
      deferred = deferred.replace(/^(<\w+)/, '$1 preload="none"');
    }
    return deferred;
  });
}
