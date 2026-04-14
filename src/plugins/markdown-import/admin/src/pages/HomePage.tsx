import React, { useMemo, useState } from 'react';

type ImportItem = {
  fileName: string;
  content: string;
};

type ImportReportItem = {
  fileName: string;
  slug: string;
  inputDocumentId: string | null;
  action: 'create' | 'update' | 'skip';
  status: 'success' | 'failed';
  id?: number;
  documentId?: string;
  message?: string;
  errors: string[];
};

type ImportReport = {
  generatedAt: string;
  summary: {
    total: number;
    created: number;
    updated: number;
    failed: number;
    skipped: number;
  };
  items: ImportReportItem[];
};

async function readFiles(files: FileList) {
  const list: ImportItem[] = [];

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const text = await file.text();
    list.push({
      fileName: file.name,
      content: text,
    });
  }

  return list;
}

export default function HomePage() {
  const [items, setItems] = useState<ImportItem[]>([]);
  const [manualName, setManualName] = useState('manual-input.md');
  const [manualContent, setManualContent] = useState('');
  const [report, setReport] = useState<ImportReport | null>(null);
  const [errorText, setErrorText] = useState('');
  const [loading, setLoading] = useState(false);

  const canImport = useMemo(() => items.length > 0 && !loading, [items.length, loading]);

  const onSelectFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const fileList = input.files;
    if (!fileList || fileList.length === 0) {
      return;
    }

    const loaded = await readFiles(fileList);
    setItems((prev) => [...prev, ...loaded]);
    input.value = '';
  };

  const addManualItem = () => {
    const content = manualContent.trim();
    if (!content) {
      return;
    }

    setItems((prev) => [
      ...prev,
      {
        fileName: manualName.trim() || `manual-${Date.now()}.md`,
        content,
      },
    ]);
    setManualContent('');
  };

  const runImport = async () => {
    setLoading(true);
    setErrorText('');

    try {
      const callImport = async (token?: string) => {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        return fetch('/markdown-import/import', {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify({ items }),
        });
      };

      const parseToken = (payload: unknown): string | null => {
        if (!payload || typeof payload !== 'object') {
          return null;
        }

        const data = payload as Record<string, unknown>;
        const nested = data.data as Record<string, unknown> | undefined;
        const token =
          (typeof data.token === 'string' ? data.token : null) ||
          (typeof data.accessToken === 'string' ? data.accessToken : null) ||
          (nested && typeof nested.token === 'string' ? nested.token : null) ||
          (nested && typeof nested.accessToken === 'string' ? nested.accessToken : null);

        return token;
      };

      let response = await callImport();

      if (response.status === 401) {
        const tokenResponse = await fetch('/admin/access-token', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (tokenResponse.ok) {
          const tokenRaw = await tokenResponse.text();
          let token: string | null = null;

          if (tokenRaw) {
            try {
              token = parseToken(JSON.parse(tokenRaw));
            } catch {
              token = null;
            }
          }

          if (token) {
            response = await callImport(token);
          }
        }
      }

      const raw = await response.text();
      let data: (ImportReport & { error?: { message?: string }; message?: string }) | null = null;

      if (raw) {
        try {
          data = JSON.parse(raw) as ImportReport & { error?: { message?: string }; message?: string };
        } catch {
          data = null;
        }
      }

      if (!response.ok) {
        throw new Error(data?.error?.message || data?.message || raw || `Import failed (${response.status})`);
      }

      if (!data) {
        throw new Error('Import failed: invalid response payload');
      }

      setReport(data);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const clearItems = () => {
    setItems([]);
  };

  const cardStyle: React.CSSProperties = {
    border: '1px solid var(--strapi-neutral150)',
    background: 'var(--strapi-neutral0)',
    borderRadius: 12,
    padding: 20,
  };

  const sectionTitleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 18,
    lineHeight: 1.3,
    color: 'var(--strapi-neutral800)',
    fontWeight: 600,
  };

  const helperTextStyle: React.CSSProperties = {
    marginTop: 8,
    marginBottom: 0,
    color: 'var(--strapi-neutral600)',
    fontSize: 14,
    lineHeight: 1.5,
  };

  return (
    <div style={{
      padding: 24,
      width: '100%',
      maxWidth: 1560,
      margin: '0 auto',
      color: 'var(--strapi-neutral800)',
      fontSize: 14,
    }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.2, fontWeight: 700 }}>Markdown 导入文章</h1>
        <p style={{ marginTop: 10, marginBottom: 0, color: 'var(--strapi-neutral600)', fontSize: 15 }}>
          使用后台可视化导入。若存在相同 documentId 或 slug，将自动执行 update。
        </p>
      </header>

      <div style={{ display: 'grid', gap: 16 }}>
      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>1) 选择 Markdown 文件</h2>
        <p style={helperTextStyle}>支持一次选择多篇文件，文件内容会自动加入待导入列表。</p>
        <input
          type="file"
          accept=".md,.markdown,text/markdown"
          multiple
          onChange={onSelectFiles}
          style={{ marginTop: 14, fontSize: 14 }}
        />
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>2) 或粘贴单篇 Markdown</h2>
        <p style={helperTextStyle}>可快速验证 frontmatter 与正文解析效果。</p>
        <input
          value={manualName}
          onChange={(e) => setManualName(e.currentTarget.value)}
          placeholder="文件名，例如 hello-world.md"
          style={{
            width: '100%',
            marginTop: 14,
            marginBottom: 10,
            minHeight: 42,
            padding: '0 12px',
            borderRadius: 8,
            border: '1px solid var(--strapi-neutral200)',
            fontSize: 14,
            boxSizing: 'border-box',
          }}
        />
        <textarea
          value={manualContent}
          onChange={(e) => setManualContent(e.currentTarget.value)}
          placeholder="在此粘贴带 frontmatter 的 Markdown 内容"
          style={{
            width: '100%',
            minHeight: 260,
            padding: 12,
            borderRadius: 8,
            border: '1px solid var(--strapi-neutral200)',
            fontFamily: 'monospace',
            fontSize: 13,
            lineHeight: 1.55,
            boxSizing: 'border-box',
            resize: 'vertical',
          }}
        />
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={addManualItem}
            style={{
              minHeight: 38,
              padding: '0 14px',
              borderRadius: 8,
              border: '1px solid var(--strapi-primary600)',
              background: 'var(--strapi-primary600)',
              color: 'var(--strapi-neutral0)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            加入导入列表
          </button>
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>3) 待导入列表 ({items.length})</h2>
        {items.length === 0 ? <p style={{ ...helperTextStyle, marginTop: 12 }}>暂无待导入项</p> : null}
        {items.length > 0 ? (
          <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            {items.map((item, index) => (
              <div
                key={`${item.fileName}-${index}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: '1px solid var(--strapi-neutral150)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  background: 'var(--strapi-neutral100)',
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 14 }}>{item.fileName}</span>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  style={{
                    minHeight: 30,
                    padding: '0 10px',
                    borderRadius: 6,
                    border: '1px solid var(--strapi-danger600)',
                    background: 'var(--strapi-neutral0)',
                    color: 'var(--strapi-danger600)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  移除
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={!canImport}
            onClick={runImport}
            style={{
              minHeight: 40,
              padding: '0 16px',
              borderRadius: 8,
              border: '1px solid var(--strapi-primary600)',
              background: canImport ? 'var(--strapi-primary600)' : 'var(--strapi-neutral200)',
              color: canImport ? 'var(--strapi-neutral0)' : 'var(--strapi-neutral500)',
              fontWeight: 600,
              cursor: canImport ? 'pointer' : 'not-allowed',
            }}
          >
            {loading ? '导入中...' : '开始导入'}
          </button>
          <button
            type="button"
            disabled={loading || items.length === 0}
            onClick={clearItems}
            style={{
              minHeight: 40,
              padding: '0 16px',
              borderRadius: 8,
              border: '1px solid var(--strapi-neutral300)',
              background: loading || items.length === 0 ? 'var(--strapi-neutral150)' : 'var(--strapi-neutral0)',
              color: loading || items.length === 0 ? 'var(--strapi-neutral500)' : 'var(--strapi-neutral700)',
              fontWeight: 600,
              cursor: loading || items.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            清空列表
          </button>
        </div>

        {errorText ? (
          <p style={{ marginTop: 12, color: 'var(--strapi-danger600)', fontSize: 14 }}>
            {errorText}
          </p>
        ) : null}
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>4) 导入结果</h2>
        {!report ? <p style={{ ...helperTextStyle, marginTop: 12 }}>尚未执行导入</p> : null}
        {report ? (
          <>
            <p style={{ marginTop: 10, marginBottom: 12, color: 'var(--strapi-neutral700)', fontSize: 14 }}>
              总数: {report.summary.total} / 新增: {report.summary.created} / 更新: {report.summary.updated} / 失败: {report.summary.failed}
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860, fontSize: 14 }}>
                <thead>
                  <tr>
                    <th style={{ borderBottom: '1px solid var(--strapi-neutral200)', textAlign: 'left', padding: '10px 8px' }}>文件</th>
                    <th style={{ borderBottom: '1px solid var(--strapi-neutral200)', textAlign: 'left', padding: '10px 8px' }}>slug</th>
                    <th style={{ borderBottom: '1px solid var(--strapi-neutral200)', textAlign: 'left', padding: '10px 8px' }}>documentId(输入)</th>
                    <th style={{ borderBottom: '1px solid var(--strapi-neutral200)', textAlign: 'left', padding: '10px 8px' }}>动作</th>
                    <th style={{ borderBottom: '1px solid var(--strapi-neutral200)', textAlign: 'left', padding: '10px 8px' }}>状态</th>
                    <th style={{ borderBottom: '1px solid var(--strapi-neutral200)', textAlign: 'left', padding: '10px 8px' }}>结果ID</th>
                    <th style={{ borderBottom: '1px solid var(--strapi-neutral200)', textAlign: 'left', padding: '10px 8px' }}>消息/错误</th>
                  </tr>
                </thead>
                <tbody>
                  {report.items.map((item, idx) => (
                    <tr key={`${item.fileName}-${item.slug}-${idx}`}>
                      <td style={{ borderBottom: '1px solid var(--strapi-neutral150)', padding: '10px 8px' }}>{item.fileName}</td>
                      <td style={{ borderBottom: '1px solid var(--strapi-neutral150)', padding: '10px 8px' }}>{item.slug || '-'}</td>
                      <td style={{ borderBottom: '1px solid var(--strapi-neutral150)', padding: '10px 8px' }}>{item.inputDocumentId || '-'}</td>
                      <td style={{ borderBottom: '1px solid var(--strapi-neutral150)', padding: '10px 8px' }}>{item.action}</td>
                      <td style={{ borderBottom: '1px solid var(--strapi-neutral150)', padding: '10px 8px', color: item.status === 'success' ? 'var(--strapi-success600)' : 'var(--strapi-danger600)', fontWeight: 600 }}>
                        {item.status}
                      </td>
                      <td style={{ borderBottom: '1px solid var(--strapi-neutral150)', padding: '10px 8px' }}>{item.id || '-'} / {item.documentId || '-'}</td>
                      <td style={{ borderBottom: '1px solid var(--strapi-neutral150)', padding: '10px 8px' }}>{item.errors.length > 0 ? item.errors.join('; ') : item.message || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>
      </div>
    </div>
  );
}
