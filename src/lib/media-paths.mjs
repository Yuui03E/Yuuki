export const postCollections = ['anime', 'episodes', 'guides', 'progress', 'benchmarks', 'unassigned'];
export const mediaTypes = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', mp4: 'video/mp4', webm: 'video/webm' };

export function slugify(value) {
  let slug = String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100).replace(/-+$/g, '');
  if (/^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i.test(slug)) slug = `entry-${slug}`;
  return slug;
}

export function validatePost(post) {
  if (!post || typeof post !== 'object' || Array.isArray(post) || Object.keys(post).some((key) => !['collection', 'id', 'title', 'uploadId', 'sourceHash'].includes(key))
    || !postCollections.includes(post.collection) || typeof post.id !== 'string' || !post.id || slugify(post.id) !== post.id
    || typeof post.title !== 'string' || !post.title.trim() || post.title.length > 300 || /[\x00-\x1f]/.test(post.title)
    || (post.uploadId !== undefined && !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(post.uploadId))
    || (post.sourceHash !== undefined && !/^[a-f0-9]{64}$/.test(post.sourceHash))) {
    throw Object.assign(new Error('Enter a title and a safe, unique Content ID before uploading media.'), { status: 422 });
  }
  return { collection: post.collection, id: post.id, title: post.title.trim(), ...(post.uploadId ? { uploadId: post.uploadId } : {}), ...(post.sourceHash ? { sourceHash: post.sourceHash } : {}) };
}

export function parseMediaKey(key) {
  const match = /^media\/(general|adult)\/(?:(anime|episodes|guides|progress|benchmarks|unassigned)\/([a-z0-9-]{1,100})\/)?([a-f0-9]{64})\.(png|jpg|webp|gif|mp4|webm)$/.exec(key);
  if (!match || (match[3] && slugify(match[3]) !== match[3])) return null;
  return { audience: match[1], collection: match[2], id: match[3], sha256: match[4], extension: match[5], contentType: mediaTypes[match[5]] };
}
