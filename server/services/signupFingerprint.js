import { createHmac } from 'node:crypto'
import { isIP } from 'node:net'
import { config } from '../config.js'

function normalizeIp(value) {
  const candidate = String(value || '').trim().replace(/^\[|\]$/g, '')
  if (candidate.startsWith('::ffff:') && isIP(candidate.slice(7)) === 4) return candidate.slice(7)
  return isIP(candidate) ? candidate.toLowerCase() : null
}

function ipv6Block(ip) {
  const [left = '', right = ''] = ip.split('::')
  const leftParts = left ? left.split(':') : []
  const rightParts = right ? right.split(':') : []
  const parts = [...leftParts, ...Array(Math.max(0, 8 - leftParts.length - rightParts.length)).fill('0'), ...rightParts]
  return `${parts.slice(0, 4).map((part) => part.padStart(4, '0')).join(':')}::/64`
}

function networkBlock(ip) {
  if (isIP(ip) === 4) return `${ip.split('.').slice(0, 3).join('.')}.0/24`
  return ipv6Block(ip)
}

function hash(value) {
  return createHmac('sha256', config.signupFingerprintSecret).update(value).digest('hex')
}

export function hashPrivateIdentifier(namespace, value) {
  return hash(`${namespace}:${String(value || '').trim().toLowerCase()}`)
}

export function getSignupFingerprint(request) {
  const ip = normalizeIp(request.ip) || normalizeIp(request.socket.remoteAddress)
  if (!ip) return { ipHash: null, networkHash: null }

  return {
    ipHash: hash(`ip:${ip}`),
    networkHash: hash(`network:${networkBlock(ip)}`),
  }
}
