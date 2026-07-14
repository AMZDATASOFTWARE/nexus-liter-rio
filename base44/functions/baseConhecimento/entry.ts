import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const { action, docId, repo, filePath } = await req.json();

    if (action === 'listDocs') {
      const { accessToken } = await sdk.connectors.getConnection('googledocs');
      const res = await fetch(
        "https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.document'&pageSize=30&fields=files(id,name)&orderBy=modifiedTime desc",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const data = await res.json();
      if (!res.ok) return Response.json({ error: data.error?.message || 'Erro ao listar documentos' }, { status: 500 });
      return Response.json({ files: data.files || [] });
    }

    if (action === 'importDoc') {
      const { accessToken } = await sdk.connectors.getConnection('googledocs');
      const res = await fetch(`https://docs.googleapis.com/v1/documents/${docId}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const doc = await res.json();
      if (!res.ok) return Response.json({ error: doc.error?.message || 'Erro ao ler documento' }, { status: 500 });
      let text = '';
      for (const el of doc.body?.content || []) {
        for (const pe of el.paragraph?.elements || []) {
          text += pe.textRun?.content || '';
        }
      }
      const source = await sdk.entities.KnowledgeSource.create({
        name: doc.title || 'Documento',
        source_type: 'googledocs',
        reference: docId,
        content: text.slice(0, 20000)
      });
      return Response.json({ source });
    }

    if (action === 'importHF') {
      const { accessToken } = await sdk.connectors.getConnection('hugging_face');
      const res = await fetch(`https://huggingface.co/${repo}/resolve/main/${filePath}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!res.ok) return Response.json({ error: `Não foi possível baixar ${repo}/${filePath} (HTTP ${res.status})` }, { status: 500 });
      const text = await res.text();
      const source = await sdk.entities.KnowledgeSource.create({
        name: `${repo}/${filePath}`,
        source_type: 'huggingface',
        reference: `${repo}/${filePath}`,
        content: text.slice(0, 20000)
      });
      return Response.json({ source });
    }

    return Response.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});