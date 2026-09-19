import { useEffect, useState } from 'react'
import { Mail, RefreshCw, Trash2, Users } from 'lucide-react'
import { apiRequest } from '../lib/api.js'

const button = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[#dcd9eb] px-3 text-sm font-semibold disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7558ff]'
const primary = `${button} border-transparent bg-[#7558ff] text-white hover:bg-[#6546f3]`
const input = 'min-h-10 rounded-md border border-[#dcd9eb] bg-white px-3 text-sm'
const date = (value) => new Date(value).toLocaleDateString()

export function TeamPage({ session, account, navigate }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [confirmation, setConfirmation] = useState(null)
  const owner = account?.workspace?.role === 'owner'
  const manager = owner || account?.workspace?.role === 'admin'

  async function load() {
    setLoading(true)
    setError('')
    try { setData(await apiRequest('/team', { session })) }
    catch (failure) { setError(failure.message) }
    finally { setLoading(false) }
  }
  useEffect(() => {
    if (!session) { setLoading(false); return }
    let active = true
    setLoading(true)
    apiRequest('/team', { session }).then((result) => { if (active) setData(result) })
      .catch((failure) => { if (active) setError(failure.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [session])

  async function mutate(path, method, body, message) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await apiRequest(path, { session, method, ...(body ? { body: JSON.stringify(body) } : {}) })
      setNotice(message)
      setConfirmation(null)
      if (method === 'POST') setEmail('')
      await load()
    } catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }

  if (!session) return <div className="py-12 text-center"><Users className="mx-auto h-8 w-8 text-[#7558ff]" /><h1 className="mt-4 text-2xl font-bold">Your team</h1><p className="my-4 text-sm text-[#77718f]">Sign in to manage your workspace members.</p><button className={primary} onClick={() => navigate('login')}>Sign in</button></div>

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-extrabold">Account & team</h1><p className="mt-1 text-sm text-[#77718f]">{account?.workspace?.name}</p></div><button className={button} disabled={loading || busy} onClick={load}><RefreshCw className="h-4 w-4" />Refresh</button></div>
    {error && <p role="alert" className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {notice && <p role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {manager && <form onSubmit={(event) => { event.preventDefault(); mutate('/team/invitations', 'POST', { email: email.trim(), role }, 'Invitation sent. It expires in seven days.') }} className="border-y border-[#e5e3f0] py-5">
      <h2 className="mb-4 text-base font-bold">Invite a teammate</h2>
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end"><label className="flex min-w-0 flex-1 flex-col gap-2 text-sm font-semibold">Email address<input className={input} type="email" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label><label className="flex flex-col gap-2 text-sm font-semibold">Role<select className={input} value={role} onChange={(event) => setRole(event.target.value)}><option value="member">Member</option>{owner && <option value="admin">Administrator</option>}</select></label><button className={primary} disabled={busy || loading}><Mail className="h-4 w-4" />{busy ? 'Please wait' : 'Send invitation'}</button></div>
    </form>}
    {loading && !data && <p role="status" className="py-8 text-sm">Loading your team...</p>}
    {data && <>
      <section><h2 className="mb-3 text-base font-bold">Members <span className="text-[#77718f]">({data.members.length})</span></h2><div className="overflow-x-auto rounded-md border border-[#e5e3f0] bg-white"><table className="w-full min-w-[580px] text-left text-sm"><thead className="bg-[#faf9ff] text-xs text-[#77718f]"><tr><th className="p-4">Name</th><th className="p-4">Role</th><th className="p-4">Joined</th><th className="relative p-4"><span className="sr-only">Actions</span></th></tr></thead><tbody>{data.members.map((member) => {
        const self = member.user_id === account?.user?.id
        const editable = owner && !self && member.role !== 'owner'
        const removable = manager && !self && member.role !== 'owner' && (owner || member.role === 'member')
        return <tr key={member.user_id} className="border-t border-[#e5e3f0]"><td className="p-4"><p className="font-semibold">{member.profile?.first_name} {member.profile?.last_name}{self && ' (you)'}</p><p className="mt-1 text-xs text-[#77718f]">{member.profile?.email}</p></td><td className="p-4">{editable ? <select aria-label={`Role for ${member.profile?.email}`} className={input} disabled={busy} value={member.role} onChange={(event) => setConfirmation({ path: `/team/members/${member.user_id}`, method: 'PATCH', body: { role: event.target.value }, title: `Change ${member.profile?.email} to ${event.target.value}?`, message: 'Member role updated.' })}><option value="member">Member</option><option value="admin">Administrator</option></select> : <span className="capitalize">{member.role}</span>}</td><td className="p-4 text-xs text-[#77718f]">{date(member.created_at)}</td><td className="p-4">{removable && <button className={button} disabled={busy} title={`Remove ${member.profile?.email}`} aria-label={`Remove ${member.profile?.email}`} onClick={() => setConfirmation({ path: `/team/members/${member.user_id}`, method: 'DELETE', title: `Remove ${member.profile?.email}? Their workspace access and API keys will be revoked.`, message: 'Member removed and their API keys revoked.' })}><Trash2 className="h-4 w-4" /></button>}</td></tr>
      })}</tbody></table></div></section>
      {confirmation && <div role="region" aria-label="Confirm team change" className="rounded-md border border-[#c8bfff] bg-white p-4"><p className="text-sm font-semibold">{confirmation.title}</p><div className="mt-3 flex gap-2"><button className={primary} disabled={busy} onClick={() => mutate(confirmation.path, confirmation.method, confirmation.body, confirmation.message)}>Confirm</button><button className={button} disabled={busy} onClick={() => setConfirmation(null)}>Cancel</button></div></div>}
      {manager && <section><h2 className="mb-3 text-base font-bold">Pending invitations</h2>{!data.invitations.length ? <p className="text-sm text-[#77718f]">No pending invitations.</p> : <ul className="divide-y divide-[#e5e3f0]">{data.invitations.map((invite) => <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="break-all text-sm font-semibold">{invite.email}</p><p className="mt-1 text-xs text-[#77718f]">{invite.role} · Expires {date(invite.expires_at)}</p></div>{(owner || invite.role === 'member') && <button className={button} disabled={busy} onClick={() => setConfirmation({ path: `/team/invitations/${invite.id}`, method: 'DELETE', title: `Revoke the invitation to ${invite.email}?`, message: 'Invitation revoked.' })}>Revoke</button>}</li>)}</ul>}</section>}
      {manager && <section className="border-t border-[#e5e3f0] pt-5"><h2 className="mb-3 text-base font-bold">Recent team activity</h2>{!data.events.length && <p className="text-sm text-[#77718f]">No team changes yet.</p>}<ul className="divide-y divide-[#e5e3f0]">{data.events.map((event) => <li key={event.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span className="min-w-0 break-all"><strong className="capitalize">{{ invite: 'Invited', revoke: 'Revoked invitation', role: 'Changed role', remove: 'Removed', joined: 'Joined' }[event.action]}</strong> · {event.subject}</span><time className="text-xs text-[#77718f]" dateTime={event.created_at}>{new Date(event.created_at).toLocaleString()}</time></li>)}</ul></section>}
    </>}
  </div>
}

export function InvitationPage({ token, session, navigate, onJoined, onSignOut }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function accept() {
    setBusy(true); setError('')
    try { await apiRequest('/auth/complete-signup', { session, method: 'POST', body: JSON.stringify({ invitationToken: token }) }); onJoined() }
    catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }
  return <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12"><img src="/images/logos/emailverify-wordmark.png" alt="EmailVerify" className="mb-10 w-44" /><Users className="h-9 w-9 text-[#7558ff]" /><h1 className="mt-5 text-3xl font-extrabold">Join your team</h1><p className="mt-4 text-sm leading-6 text-[#77718f]">Use the verified email address that received this invitation. Your team shares its workspace and verification credits.</p>{error && <p role="alert" className="mt-4 rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}<div className="mt-7 flex flex-wrap gap-3">{session ? <><button className={primary} disabled={busy} onClick={accept}>{busy ? 'Joining...' : 'Accept invitation'}</button><button className={button} disabled={busy} onClick={onSignOut}>Use another account</button></> : <><button className={primary} onClick={() => navigate('login')}>Sign in</button><button className={button} onClick={() => navigate('signup')}>Create account</button></>}</div></main>
}
