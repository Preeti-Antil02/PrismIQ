import { createBatch2Proxy } from "@/lib/batch2Proxy";

const proxy = createBatch2Proxy("analyst-feedback");
export const GET = proxy.GET;
export const POST = proxy.POST;
export const PATCH = proxy.PATCH;
export const PUT = proxy.PUT;
export const DELETE = proxy.DELETE;
