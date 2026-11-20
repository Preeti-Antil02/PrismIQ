import { createBatch2Proxy } from "@/lib/batch2Proxy";

const proxy = createBatch2Proxy("win-loss");
export const GET = proxy.GET;
export const POST = proxy.POST;
export const PATCH = proxy.PATCH;
export const DELETE = proxy.DELETE;
