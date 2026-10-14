import { toTemplateCsv } from './csv';
import { INTAKE_ENTITIES, isIntakeEntity } from './schema';

/** GET /api/intake/template?entity=case → CSV download. Admin or staff only; fails closed. */
export class TemplateHttp {
  static handle(request: Request, role: string | null | undefined): Response {
    if (role == null) return Response.json({ error: 'Sign in required' }, { status: 401 });
    if (role !== 'admin' && role !== 'staff') return Response.json({ error: 'Admin or staff role required' }, { status: 403 });
    const entity = new URL(request.url).searchParams.get('entity') ?? '';
    if (!isIntakeEntity(entity)) {
      return Response.json({ error: `Unknown entity "${entity}". Use one of: ${INTAKE_ENTITIES.join(', ')}` }, { status: 400 });
    }
    return new Response(toTemplateCsv(entity), {
      headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="fas-${entity}-template.csv"` },
    });
  }
}
