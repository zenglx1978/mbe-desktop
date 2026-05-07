/**
 * electron-builder 自定义 Windows 签名脚本
 *
 * 行为：
 *   - CI 环境提供了 CSC_LINK（PFX 证书）+ CSC_KEY_PASSWORD → 执行签名
 *   - 本地开发 / 未配置证书 → 跳过签名，打印警告（SmartScreen 会告警，仅限内测分发）
 *
 * Secrets 配置（GitHub Actions）：
 *   CSC_LINK          base64 编码的 .pfx 证书文件内容
 *   CSC_KEY_PASSWORD  证书密码
 *
 * 使用方式（package.json build.win）：
 *   "sign": "./build/win-sign.js"
 */

const path = require('path')
const { execSync } = require('child_process')
const fs = require('fs')
const os = require('os')

exports.default = async function sign(configuration) {
  const cscLink = process.env.CSC_LINK
  const cscPassword = process.env.CSC_KEY_PASSWORD

  if (!cscLink) {
    console.warn('[win-sign] CSC_LINK not set — skipping code signing (SmartScreen will warn end-users)')
    return
  }

  const pfxData = Buffer.from(cscLink, 'base64')
  const tmpDir = os.tmpdir()
  const pfxPath = path.join(tmpDir, `mbe-sign-${Date.now()}.pfx`)

  try {
    fs.writeFileSync(pfxPath, pfxData)

    const filePath = configuration.path
    const passwordFlag = cscPassword ? `/p "${cscPassword}"` : ''

    const signtoolArgs = [
      'sign',
      '/fd SHA256',
      '/td SHA256',
      '/tr http://timestamp.digicert.com',
      `/f "${pfxPath}"`,
      passwordFlag,
      `"${filePath}"`,
    ].filter(Boolean).join(' ')

    const signtool = findSigntool()
    if (!signtool) {
      console.warn('[win-sign] signtool.exe not found — skipping signing')
      return
    }

    console.warn(`[win-sign] signing: ${path.basename(filePath)}`)
    execSync(`"${signtool}" ${signtoolArgs}`, { stdio: 'inherit' })
    console.warn('[win-sign] signing completed')
  } finally {
    try { fs.unlinkSync(pfxPath) } catch { /* ignore */ }
  }
}

function findSigntool() {
  const candidates = [
    'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.22621.0\\x64\\signtool.exe',
    'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.19041.0\\x64\\signtool.exe',
    'C:\\Program Files\\Microsoft SDKs\\Windows\\v7.1\\Bin\\signtool.exe',
    'signtool',
  ]
  for (const c of candidates) {
    try {
      execSync(`"${c}" /help`, { stdio: 'pipe' })
      return c
    } catch { /* try next */ }
  }
  return null
}
