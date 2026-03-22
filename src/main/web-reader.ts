// WebReader — MBE Desktop 网页阅读器
// 用 Electron 内置 Chromium 打开网页、提取纯文本，跟人看网页一模一样
// 不是爬虫：不并发、不绕验证、不存页面、有 User-Agent，就是"阅读"
// 核心场景：法条更新跟踪、财税政策监控、行业标准查阅

import { BrowserWindow, session, ipcMain } from 'electron'
import { isSafeUrl, ipcRateLimit } from './safe-path'

// ────────────────────── 类型 ──────────────────────

export interface WebReadRequest {
  url: string
  /** CSS 选择器，只提取匹配元素的文本；空则取全部正文 */
  selector?: string
  /** 等待此选择器出现后再提取（SPA/动态页面） */
  waitFor?: string
  /** 最大等待时间 ms，默认 15000 */
  timeout?: number
  /** 是否提取链接列表 */
  extractLinks?: boolean
  /** 是否提取表格为结构化数据 */
  extractTables?: boolean
  /** 自定义 JS，在页面上执行后返回结果 */
  customScript?: string
  /**
   * 使用主窗口的 session（共享 cookie/登录态）。
   * 用于已登录的 Web 后台（卖家中心、商家后台等），
   * 用户需先在主窗口中登录目标网站。
   */
  useMainSession?: boolean
}

export interface WebReadResult {
  success: boolean
  url: string
  title?: string
  text?: string
  html?: string
  links?: { text: string; href: string }[]
  tables?: Record<string, string>[][]
  customResult?: unknown
  error?: string
  loadTimeMs?: number
}

export interface WebMonitorRule {
  id: string
  url: string
  selector?: string
  /** cron 表达式或间隔分钟数 */
  intervalMinutes: number
  /** 上次内容哈希，用于变更检测 */
  lastHash?: string
  label: string
}

// ────────────────────── CSS 选择器安全校验 ──────────────────────

const SAFE_SELECTOR_RE = /^[a-zA-Z0-9\s\-_.,:#\[\]=~|^$*>"'+()@]+$/

function isSafeCssSelector(selector: string): boolean {
  if (!selector || selector.length > 300) return false
  if (!SAFE_SELECTOR_RE.test(selector)) return false
  // 禁止 JS 注入常见 payload
  const lower = selector.toLowerCase()
  if (lower.includes('javascript:') || lower.includes('expression(')) return false
  if (lower.includes('\\') || lower.includes('`')) return false
  return true
}

function sanitizeSelector(selector: string | undefined): string | undefined {
  if (!selector) return undefined
  if (!isSafeCssSelector(selector)) return undefined
  // 转义单引号，防止模板字符串拼接逃逸
  return selector.replace(/'/g, "\\'")
}

// ────────────────────── 核心：隐藏窗口读网页 ──────────────────────

const READER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function readWebPage(req: WebReadRequest): Promise<WebReadResult> {
  const timeout = req.timeout ?? 15000
  const start = Date.now()
  const safeSelector = sanitizeSelector(req.selector)
  const safeWaitFor = sanitizeSelector(req.waitFor)

  if (!isSafeUrl(req.url)) {
    return {
      success: false,
      url: req.url,
      error: '安全限制: 仅允许 http/https 协议，禁止 file:// / javascript: 等',
      loadTimeMs: 0,
    }
  }

  if (req.customScript) {
    return {
      success: false,
      url: req.url,
      error: '安全限制: customScript 已被禁用，请使用 selector 提取内容',
      loadTimeMs: 0,
    }
  }

  let win: BrowserWindow | null = null

  try {
    const webPrefs: Electron.WebPreferences = {
      offscreen: true,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    }

    if (req.useMainSession) {
      // 共享主窗口 session（保留 cookie/登录态），用于卖家后台等已登录页面
      webPrefs.session = session.defaultSession
    } else {
      webPrefs.partition = 'persist:webreader'
    }

    win = new BrowserWindow({
      width: 1280,
      height: 900,
      show: false,
      webPreferences: webPrefs,
    })

    win.webContents.setUserAgent(READER_UA)

    // 加载页面
    await Promise.race([
      win.loadURL(req.url),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('页面加载超时')), timeout)
      ),
    ])

    // 等待动态内容
    if (safeWaitFor) {
      await win.webContents.executeJavaScript(`
        new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('等待元素超时')), ${timeout})
          const check = () => {
            if (document.querySelector('${safeWaitFor}')) {
              clearTimeout(timeout)
              resolve(true)
            } else {
              requestAnimationFrame(check)
            }
          }
          check()
        })
      `)
    } else {
      // 默认等一小段让 JS 渲染完成
      await new Promise(r => setTimeout(r, 1500))
    }

    // 提取标题
    const title: string = await win.webContents.executeJavaScript(
      'document.title'
    )

    // 提取正文
    const text: string = await win.webContents.executeJavaScript(
      safeSelector
        ? `(() => {
            const els = document.querySelectorAll('${safeSelector}')
            return Array.from(els).map(el => el.innerText).join('\\n\\n')
          })()`
        : `(() => {
            // 移除干扰元素后取正文
            const clone = document.body.cloneNode(true)
            clone.querySelectorAll('script,style,nav,header,footer,iframe,noscript,.ad,.ads,.sidebar').forEach(el => el.remove())
            return clone.innerText.replace(/\\n{3,}/g, '\\n\\n').trim()
          })()`
    )

    // 提取链接
    let links: { text: string; href: string }[] | undefined
    if (req.extractLinks) {
      links = await win.webContents.executeJavaScript(`
        (() => {
          const root = ${safeSelector ? `document.querySelector('${safeSelector}')` : 'document.body'}
          if (!root) return []
          const anchors = root.querySelectorAll('a[href]')
          return Array.from(anchors).map(a => ({
            text: a.innerText.trim().slice(0, 200),
            href: a.href,
          })).filter(l => l.text && l.href.startsWith('http'))
        })()
      `)
    }

    // 提取表格
    let tables: Record<string, string>[][] | undefined
    if (req.extractTables) {
      tables = await win.webContents.executeJavaScript(`
        (() => {
          const root = ${safeSelector ? `document.querySelector('${safeSelector}')` : 'document.body'}
          if (!root) return []
          const result = []
          root.querySelectorAll('table').forEach(table => {
            const headers = Array.from(table.querySelectorAll('thead th, tr:first-child th, tr:first-child td'))
              .map(th => th.innerText.trim())
            const rows = []
            table.querySelectorAll('tbody tr, tr:not(:first-child)').forEach(tr => {
              const cells = Array.from(tr.querySelectorAll('td, th')).map(td => td.innerText.trim())
              if (headers.length > 0 && cells.length === headers.length) {
                const row = {}
                headers.forEach((h, i) => row[h] = cells[i])
                rows.push(row)
              } else if (cells.length > 0) {
                const row = {}
                cells.forEach((c, i) => row['col' + i] = c)
                rows.push(row)
              }
            })
            if (rows.length > 0) result.push(rows)
          })
          return result
        })()
      `)
    }

    return {
      success: true,
      url: req.url,
      title,
      text,
      links,
      tables,
      loadTimeMs: Date.now() - start,
    }
  } catch (err: unknown) {
    return {
      success: false,
      url: req.url,
      error: (err as Error).message,
      loadTimeMs: Date.now() - start,
    }
  } finally {
    if (win && !win.isDestroyed()) {
      win.close()
    }
  }
}

// ────────────────────── 批量读取 ──────────────────────

async function readMultiplePages(
  requests: WebReadRequest[]
): Promise<WebReadResult[]> {
  // 串行执行，不并发轰炸目标网站
  const results: WebReadResult[] = []
  for (const req of requests) {
    results.push(await readWebPage(req))
    // 间隔 500ms，礼貌访问
    await new Promise(r => setTimeout(r, 500))
  }
  return results
}

// ────────────────────── 变更检测（简易内容哈希） ──────────────────────

function simpleHash(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const chr = text.charCodeAt(i)
    hash = ((hash << 5) - hash) + chr
    hash |= 0
  }
  return hash.toString(36)
}

async function checkForChanges(
  rule: WebMonitorRule
): Promise<{ changed: boolean; newHash: string; text: string }> {
  const result = await readWebPage({
    url: rule.url,
    selector: rule.selector,
    timeout: 20000,
  })

  if (!result.success || !result.text) {
    return { changed: false, newHash: rule.lastHash || '', text: '' }
  }

  const newHash = simpleHash(result.text)
  return {
    changed: rule.lastHash !== undefined && rule.lastHash !== newHash,
    newHash,
    text: result.text,
  }
}

// ────────────────────── 预置法律/财税数据源 ──────────────────────

export const PRESET_SOURCES: Record<string, WebReadRequest[]> = {
  // 国家法律法规数据库
  law_npc: [{
    url: 'https://flk.npc.gov.cn/index.html',
    waitFor: '.law-list',
    selector: '.law-list',
    extractLinks: true,
  }],
  // 国家税务总局 - 最新政策
  tax_chinatax: [{
    url: 'https://www.chinatax.gov.cn/chinatax/n810341/n810760/index.html',
    selector: '.zcfg_list, .list_box',
    extractLinks: true,
  }],
  // 财政部 - 会计准则
  finance_mof: [{
    url: 'https://kjs.mof.gov.cn/zt/kjzzss/kuaijizhunzeshishi/',
    selector: '.list_box, .TRS_Editor',
    extractLinks: true,
  }],
  // 最高人民法院 - 司法解释
  court_spc: [{
    url: 'https://www.court.gov.cn/fabu/sfjs/',
    selector: '.news_list, .list',
    extractLinks: true,
  }],
  // 人力资源和社会保障部 - 政策法规
  hr_mohrss: [{
    url: 'https://www.mohrss.gov.cn/xxgk2020/fdzdgknr/zcfg/',
    selector: '.list-box, .listBox',
    extractLinks: true,
  }],
  // 住建部 - 工程造价相关标准
  cost_mohurd: [{
    url: 'https://www.mohurd.gov.cn/gongkai/zhengce/zhengcefilelib/',
    selector: '.news-list, .list',
    extractLinks: true,
  }],
  // 国家医保局 - 医保目录更新
  medical_nhsa: [{
    url: 'https://www.nhsa.gov.cn/col/col104/index.html',
    selector: '.list_box, .ewb-list',
    extractLinks: true,
  }],

  // ── 电商平台规则（公开页面，不需登录） ──

  // 淘宝规则中心
  ecom_taobao_rules: [{
    url: 'https://rule.taobao.com/index.htm',
    selector: '.rule-list, .J_RuleList, .content',
    extractLinks: true,
  }],
  // 抖音电商学习中心
  ecom_douyin_rules: [{
    url: 'https://school.jinritemai.com/doudian/web/article/aGhVbA==',
    selector: '.article-list, .content, main',
    extractLinks: true,
  }],
  // 京东开放平台规则
  ecom_jd_rules: [{
    url: 'https://rule.jd.com/rule/ruleList.action',
    selector: '.rule-list, .list, .content',
    extractLinks: true,
  }],
  // 拼多多商家规则
  ecom_pdd_rules: [{
    url: 'https://mms.pinduoduo.com/other/rules',
    selector: '.rule-list, .content',
    extractLinks: true,
  }],

  // ── 电商卖家后台（需先登录，useMainSession） ──

  // 抖店商家后台 - 店铺违规记录
  ecom_douyin_seller_violations: [{
    url: 'https://fxg.jinritemai.com/ffa/penalty/record',
    selector: '.penalty-list, .record-list, main',
    useMainSession: true,
    extractTables: true,
  }],
  // 抖店商家后台 - 商品列表
  ecom_douyin_seller_products: [{
    url: 'https://fxg.jinritemai.com/ffa/g/list',
    selector: '.product-list, .goods-list, main',
    useMainSession: true,
    extractTables: true,
  }],
  // 千牛卖家中心 - 店铺运营数据
  ecom_taobao_seller_dashboard: [{
    url: 'https://myseller.taobao.com/home.htm',
    selector: '.dashboard, .data-panel, main',
    useMainSession: true,
    extractTables: true,
  }],

  // ── 投资研究数据源 ──

  // 证监会公告
  invest_csrc: [{
    url: 'http://www.csrc.gov.cn/csrc/c100028/common_list.shtml',
    selector: '.commonlist, .list_box, .content',
    extractLinks: true,
  }],
  // 上交所信息披露
  invest_sse: [{
    url: 'http://www.sse.com.cn/disclosure/listedinfo/announcement/',
    selector: '.sse_list_1, .content',
    extractLinks: true,
  }],
  // 深交所信息披露
  invest_szse: [{
    url: 'http://www.szse.cn/disclosure/listed/notice/',
    selector: '.commonlist, .content',
    extractLinks: true,
  }],
}

// ────────────────────── IPC 注册 ──────────────────────

export function setupWebReaderIPC(): void {
  // 读取单个网页（限速 20 次/分钟）
  ipcMain.handle('webReader:read', async (_event, req: WebReadRequest): Promise<WebReadResult> => {
    if (!ipcRateLimit('webReader:read', 20)) {
      return { success: false, url: req?.url ?? '', error: '调用频率超限，请稍后重试' }
    }
    const { customScript: _, ...safeReq } = req
    return readWebPage(safeReq)
  })

  // 批量读取
  ipcMain.handle('webReader:readBatch', async (_, requests: WebReadRequest[]): Promise<WebReadResult[]> => {
    const safeRequests = requests.map(({ customScript: _, ...r }) => r)
    return readMultiplePages(safeRequests)
  })

  // 读取预置数据源
  ipcMain.handle('webReader:readPreset', async (_, sourceKey: string): Promise<WebReadResult[]> => {
    const reqs = PRESET_SOURCES[sourceKey]
    if (!reqs) {
      return [{ success: false, url: '', error: `未知数据源: ${sourceKey}` }]
    }
    return readMultiplePages(reqs)
  })

  // 列出预置数据源
  ipcMain.handle('webReader:listPresets', () => {
    return Object.entries(PRESET_SOURCES).map(([key, reqs]) => ({
      key,
      urls: reqs.map(r => r.url),
    }))
  })

  // 变更检测
  ipcMain.handle('webReader:checkChanges', async (_, rule: WebMonitorRule) => {
    return checkForChanges(rule)
  })

  // 在指定 URL 上执行 JS 提取数据 — 已禁用（安全风险：任意 JS 执行）
  ipcMain.handle('webReader:extract', async (): Promise<WebReadResult> => {
    return {
      success: false,
      url: '',
      error: '安全限制: webReader:extract 已禁用，请使用 webReader:read 配合 selector',
    }
  })
}
