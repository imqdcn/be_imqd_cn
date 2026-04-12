import 'dotenv/config';
import http from 'node:http';

const baseUrl = process.env.STRAPI_BASE_URL || 'http://localhost:1337';
const token = process.env.STRAPI_CONTENT_TOKEN;

if (!token) {
  console.error('Missing STRAPI_CONTENT_TOKEN');
  process.exit(1);
}

function requestJson(url, { method = 'GET', body } = {}) {
  const target = new URL(url);

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || 80,
        path: `${target.pathname}${target.search}`,
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          let json;
          try {
            json = raw ? JSON.parse(raw) : {};
          } catch {
            json = { raw };
          }
          resolve({ status: res.statusCode || 0, data: json });
        });
      }
    );

    req.on('error', (err) => reject(err));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function randomSlug(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

async function main() {
  const payloads = [
    {
      label: 'id-style',
      data: {
        title: 'Relation ID Style',
        description: 'relation test',
        excerpt: 'relation test',
        slug: randomSlug('relation-id'),
        contentType: 'long',
        author: 1,
        category: 1,
        blocks: [{ __component: 'shared.rich-text', body: 'id-style body' }],
      },
    },
    {
      label: 'doc-direct-style',
      data: {
        title: 'Relation Doc Direct Style',
        description: 'relation test',
        excerpt: 'relation test',
        slug: randomSlug('relation-doc-direct'),
        contentType: 'long',
        author: 'vlt1zsc52mv4eto7al04b56j',
        category: 'p17pgr7pzx1rhle0folujxxb',
        blocks: [{ __component: 'shared.rich-text', body: 'doc-direct body' }],
      },
    },
    {
      label: 'doc-connect-style',
      data: {
        title: 'Relation Doc Connect Style',
        description: 'relation test',
        excerpt: 'relation test',
        slug: randomSlug('relation-doc-connect'),
        contentType: 'long',
        author: { connect: ['vlt1zsc52mv4eto7al04b56j'] },
        category: { connect: ['p17pgr7pzx1rhle0folujxxb'] },
        blocks: [{ __component: 'shared.rich-text', body: 'doc-connect body' }],
      },
    },
  ];

  for (const p of payloads) {
    const created = await requestJson(`${baseUrl}/api/articles`, {
      method: 'POST',
      body: { data: p.data },
    });

    const id = created.data?.data?.id;
    console.log(`\n[${p.label}] create status=${created.status} id=${id ?? 'N/A'}`);
    if (!id) {
      console.log(JSON.stringify(created.data));
      continue;
    }

    const read = await requestJson(`${baseUrl}/api/articles/${id}?populate=author,category`);
    const author = read.data?.data?.author;
    const category = read.data?.data?.category;
    console.log(`author=${author?.id ?? 'null'} category=${category?.id ?? 'null'}`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
