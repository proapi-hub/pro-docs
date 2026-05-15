import { getAllowedModels } from '@/lib/models';

export const revalidate = 300; // 5 分钟缓存

export async function GET() {
  try {
    const models = await getAllowedModels();
    return Response.json({ models });
  } catch (e) {
    return Response.json(
      { models: [], error: String(e) },
      { status: 500 },
    );
  }
}
