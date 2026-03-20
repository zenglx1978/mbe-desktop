/** 客户门户 API 基址（与 client-portal 后端一致） */
export const CLIENT_PORTAL_BASE = import.meta.env.DEV ? '' : 'https://mbe.hi-maker.com'
export const CLIENT_PORTAL_API = `${CLIENT_PORTAL_BASE}/api/v1/client-portal`
