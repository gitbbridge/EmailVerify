import { useEffect, useState } from 'react'
import { CreditCard, RefreshCw } from 'lucide-react'
import { apiRequest } from '../lib/api.js'

const channels = ['bulk', 'single', 'api', 'other']
const shades = ['#7558ff', '#19a77c', '#338dcc', '#9195a5']
const number = (value) => value == null ? 'Unavailable' : Number(value).toLocaleString()
const date = (value) => new Date(value).toLocaleDateString(undefined, { timeZone: 'UTC' })
const button = 'inline-flex items-center justify-center gap-2 rounded-md bg-[#7558ff] px-4 py-2 text-sm font-bold text-white disabled:opacity-50'

export function BillingPage({ session, navigate }) {
  const [period, setPeriod] = useState('month')
  const [channel, setChannel] = useState('all')
  const [reload, setReload] = useState(0)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [opening, setOpening] = useState(false)
  const [portalError, setPortalError] = useState('')
  const [resumeError, setResumeError] = useState('')
  const [resuming, setResuming] = useState(false)
  useEffect(() => {
    if (!session) return
    const controller = new AbortController()
    setLoading(true)
    setData(null)
    setError('')
    apiRequest(`/billing/summary?period=${period}`, { session, signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setData(result) })
      .catch((error) => { if (!controller.signal.aborted) setError(error.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [session, period, reload])
  async function openPortal() {
    setOpening(true)
    setPortalError('')
    try {
      const result = await apiRequest('/billing/portal-sessions', { session, method: 'POST' })
      window.location.assign(result.url)
    } catch (error) { setPortalError(error.message); setOpening(false) }
  }
  async function resumeCheckout() {
    if (!data.pendingCheckout) return
    setResuming(true)
    setResumeError('')
    try {
      const result = await apiRequest('/billing/checkout-sessions', { session, method: 'POST', headers: { 'Idempotency-Key': data.pendingCheckout.checkout_key }, body: JSON.stringify({ packageId: data.pendingCheckout.package_id }) })
      window.location.assign(result.checkoutUrl)
    } catch (error) { setResumeError(error.message); setResuming(false) }
  }
  if (!session) return <div className="p-5"><p className="mb-4">Sign in to view your workspace billing.</p><button className={button} onClick={() => navigate('login')}>Log in</button></div>
  const totals = Object.fromEntries(channels.map((key) => [key, data?.buckets.reduce((sum, row) => sum + Number(row[key]), 0) || 0]))
  const total = Object.values(totals).reduce((sum, value) => sum + value, 0)
  const selectedTotal = channel === 'all' ? total : totals[channel]
  const value = (row) => channel === 'all' ? channels.reduce((sum, key) => sum + Number(row[key]), 0) : Number(row[channel])
  const max = Math.max(1, ...(data?.buckets.map(value) || []))
  return <div className="space-y-5">
    <div className="flex items-center justify-between"><h1 className="text-xl font-extrabold">Billing</h1><button onClick={() => setReload((n) => n + 1)} disabled={loading} title="Refresh billing" aria-label="Refresh billing" className="rounded-md border p-2 disabled:opacity-50"><RefreshCw size={18} /></button></div>
    {loading && <p role="status">Loading billing...</p>}
    {error && <p role="alert" className="rounded-md bg-rose-50 p-4 text-rose-800">{error}</p>}
    {data && <>
      <div className="grid divide-y rounded-md border border-[#e5e3f0] bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {[['Available credits', number(data.available)], ['Reserved credits', number(data.reserved)], ['Credits last added', data.lastAdded ? `${number(data.lastAdded.credits)} on ${date(data.lastAdded.date)}` : 'No credits added']].map(([label, val]) => <div key={label} className="p-5"><p className="text-sm font-semibold text-[#716b89]">{label}</p><p className="mt-2 text-lg font-extrabold">{val}</p></div>)}
      </div>
      <section className="border-y border-[#e5e3f0] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5"><h2 className="text-lg font-bold">Credit usage</h2><div className="flex flex-wrap gap-3">
          <select aria-label="Usage channel" value={channel} onChange={(e) => setChannel(e.target.value)} className="rounded-md border p-2 text-sm"><option value="all">All channels</option>{channels.map((key) => <option key={key} value={key}>{key.toUpperCase()}</option>)}</select>
          <select aria-label="Usage period" value={period} onChange={(e) => setPeriod(e.target.value)} className="rounded-md border p-2 text-sm"><option value="month">Last 30 days</option><option value="year">Last 12 months</option></select>
        </div></div>
        <dl className="grid grid-cols-2 border-b sm:grid-cols-4">{channels.map((key, i) => <div key={key} className="p-5"><dt className="flex items-center gap-2 text-sm font-semibold uppercase"><span className="h-2 w-2 rounded-full" style={{ background: shades[i] }} />{key}</dt><dd className="mt-2 text-2xl font-extrabold">{number(totals[key])}</dd></div>)}</dl>
        <p className="px-5 pt-4 text-sm text-[#716b89]">{date(data.start)} - {date(new Date(new Date(data.end).getTime() - 1))} (UTC). Settled credits only; pending reservations are excluded.</p>
        {selectedTotal === 0 ? <p className="py-16 text-center text-[#716b89]">No credits used in this period.</p> : <div className="overflow-x-auto p-5"><div className="flex h-52 min-w-[580px] items-end gap-2" role="img" aria-label={`${channel === 'all' ? total : totals[channel]} credits used; daily values available below`}>{data.buckets.map((row) => <div key={row.bucket} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${date(row.bucket)}: ${number(value(row))} credits`}><div className="min-h-0 rounded-t bg-[#7558ff]" style={{ height: `${value(row) / max * 175}px` }} /><span className="mt-2 text-center text-[10px]">{new Date(row.bucket).toLocaleDateString(undefined, { timeZone: 'UTC', ...(period === 'year' ? { month: 'short' } : { day: 'numeric' }) })}</span></div>)}</div></div>}
        {total > 0 && <details className="px-5 pb-5"><summary className="cursor-pointer text-sm font-semibold">Usage details</summary><div className="overflow-x-auto"><table className="mt-3 w-full text-left text-sm"><thead><tr>{['Date (UTC)', ...channels].map((key) => <th key={key} className="p-2 capitalize">{key}</th>)}</tr></thead><tbody>{data.buckets.map((row) => <tr key={row.bucket} className="border-t"><td className="p-2">{date(row.bucket)}</td>{channels.map((key) => <td key={key} className="p-2">{number(row[key])}</td>)}</tr>)}</tbody></table></div></details>}
      </section>
      <section className="border-y border-[#e5e3f0] bg-white p-5"><h2 className="text-lg font-bold">Payments</h2><div className="mt-4 flex flex-wrap gap-3"><button className={button} onClick={() => navigate('credits')}>Buy credits</button><button className={button} disabled={!data.portalAvailable || opening} onClick={openPortal}><CreditCard size={16} />{opening ? 'Opening...' : 'Manage billing'}</button></div><p className="mt-3 text-sm text-[#716b89]">{data.portalAvailable ? 'Manage payment methods and billing details securely in Stripe.' : 'Payment management requires a linked Stripe customer. Contact support if you have already purchased credits.'}</p>{data.pendingCheckout && <div className="mt-4 rounded-md border border-[#e7e0ff] bg-[#faf8ff] p-4"><p className="font-bold">Checkout in progress</p><p className="mt-1 text-sm text-[#716b89]">A purchase is reserved until {date(data.pendingCheckout.reservation_expires_at)} UTC.</p><button className={`${button} mt-3`} disabled={resuming} onClick={resumeCheckout}>{resuming ? 'Opening...' : 'Resume checkout'}</button></div>}<p className="mt-2 text-sm text-[#716b89]">Auto-refill and monthly subscriptions are not available yet.</p>{portalError && <p role="alert" className="mt-3 text-rose-700">{portalError}</p>}{resumeError && <p role="alert" className="mt-3 text-rose-700">{resumeError}</p>}</section>
      <section className="border-y border-[#e5e3f0] bg-white"><h2 className="p-5 text-lg font-bold">Recent purchases</h2>{data.purchases.length === 0 ? <p className="px-5 pb-5 text-sm text-[#716b89]">No purchases yet.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Date (UTC)', 'Credits', 'Status'].map((label) => <th className="p-4" key={label}>{label}</th>)}</tr></thead><tbody>{data.purchases.map((item) => <tr key={item.id} className="border-t"><td className="p-4">{date(item.created_at)}</td><td className="p-4">{number(item.credits)}</td><td className="p-4 capitalize">{item.status}</td></tr>)}</tbody></table><p className="p-4 text-xs text-[#716b89]">Up to 20 most recent purchases.</p></div>}</section>
    </>}
  </div>
}
