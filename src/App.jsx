import {
  ArrowRight, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleHelp,
  Code2, Copy, CreditCard, FileCheck2, Folder, Gauge, Globe2, Grid2X2,
  List, LockKeyhole, Mail, Menu, Plus, Search, Settings, ShieldCheck,
  Sparkles, Upload, User, Users, XCircle, Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { getUploadAttempt, finishUploadAttempt } from './lib/uploadAttempt.js'
import { apiRequest, readAuthCallback, readStoredSession, refreshSession, requestPasswordReset, signIn, signUp, storeSession, updatePassword, updateProfile } from './lib/api.js'

import { InvitationPage, TeamPage } from './components/TeamPage.jsx'
import { BillingPage as LiveBillingPage } from './components/BillingPage.jsx'
const colors = { valid: '#38c994', risky: '#ffc84d', invalid: '#ff6b86', unknown: '#55a9e9', duplicate: '#7558ff' }

const oneTimePricing = [
  { id: 'credits_5k', credits: 5000, price: 14 },
  { id: 'credits_10k', credits: 10000, price: 24 },
  { id: 'credits_25k', credits: 25000, price: 44 },
  { id: 'credits_50k', credits: 50000, price: 74 },
  { id: 'credits_100k', credits: 100000, price: 134 },
  { id: 'credits_250k', credits: 250000, price: 239 },
  { id: 'credits_500k', credits: 500000, price: 294 },
  { id: 'credits_1m', credits: 1000000, price: 444 },
]

const monthlyPricing = [
  { id: 'monthly_2k', credits: 2000, price: 5 },
  { id: 'monthly_10k', credits: 10000, price: 20 },
  { id: 'monthly_50k', credits: 50000, price: 99 },
  { id: 'monthly_250k', credits: 250000, price: 399 },
  { id: 'monthly_500k', credits: 500000, price: 599 },
]

const lists = [
  { name: 'MASTER_AUCTION_LEAD_LIST', count: 748, valid: 26.5, risky: 29.3, invalid: 2.1, unknown: 2.8 },
  { name: 'AUCTION INTEL PRIORITY 2', count: 1240, valid: 60.7, risky: 31.2, invalid: 6.1, unknown: 2 },
  { name: 'AUCTIONEERS', count: 960, valid: 42.9, risky: 39.5, invalid: 15.1, unknown: 2.5 },
  { name: 'TRAVEL LESSELLERS2', count: 318, valid: 47.1, risky: 42.2, invalid: 6.4, unknown: 4.3 },
  { name: 'PGA 2021 EXHIBITORS', count: 2018, valid: 21.9, risky: 45.7, invalid: 29.8, unknown: 2.6 },
  { name: 'pga_dir_all', count: 832, valid: 24.7, risky: 47.1, invalid: 24.2, unknown: 4 },
]

const emails = [
  ['achec@757sc.com', 'accepted_email', 100, 'Deliverable'],
  ['adam@palmbeachautographs.com', 'accepted_email', 100, 'Deliverable'],
  ['adrienne@adrienneco.com', 'accepted_email', 100, 'Deliverable'],
  ['auctions@empiresportsusa.com', 'low_deliverability', 42, 'Risky'],
  ['booking@bellablancaevents.com', 'low_deliverability', 42, 'Risky'],
  ['boston@shopdynastysports.com', 'low_quality', 70, 'Risky'],
  ['brad@adafundraising.com', 'accepted_email', 100, 'Deliverable'],
  ['briana@cbuauctions.com', 'accepted_email', 100, 'Deliverable'],
  ['chris.tysonfundraising@outlook.com', 'accepted_email', 85, 'Deliverable'],
  ['christian@showcasesilentauctions.com', 'low_deliverability', 60, 'Risky'],
  ['clientsservices@zachys.com', 'low_quality', 70, 'Risky'],
  ['cory@cbuauctions.com', 'accepted_email', 100, 'Deliverable'],
  ['hello@michiganavenueevents.com', 'unexpected_error', null, 'Unknown'],
  ['info@allisonsargent.com', 'low_quality', 70, 'Risky'],
]

export default function App() {
  const [authCallback] = useState(() => readAuthCallback())
  const [session, setSession] = useState(() => {
    const initialSession = authCallback.session || readStoredSession()
    if (initialSession) storeSession(initialSession)
    return initialSession
  })
  const [invitationToken, setInvitationToken] = useState(() => new URLSearchParams(window.location.search).get('invitation'))
  const [account, setAccount] = useState(null)
  const [creditBalance, setCreditBalance] = useState(null)
  const [page, setPage] = useState(() => authCallback.error || session?.auth_event === 'recovery' ? 'password-update' : invitationToken ? 'invitation' : session && ['#admin-approvals', '#support', '#billing'].includes(window.location.hash) ? window.location.hash.slice(1) : session ? 'bulk' : 'landing')
  const [detailTab, setDetailTab] = useState('overview')
  const [selectedBatch, setSelectedBatch] = useState(null)
  const [mobileNav, setMobileNav] = useState(false)
  const navigate = (next) => { setPage(next); setMobileNav(false) }
  const openList = (batch) => { setSelectedBatch(batch); setPage('list'); setDetailTab('overview') }

  useEffect(() => {
    if (!session || invitationToken || session.auth_event === 'recovery') return

    apiRequest('/auth/complete-signup', { session, method: 'POST' })
      .then(() => Promise.all([
        apiRequest('/me', { session }),
        apiRequest('/credits', { session }),
      ]))
      .then(([accountData, credits]) => {
        setAccount(accountData)
        setCreditBalance(credits.available)
      }).catch((error) => {
        if (error.status === 401) {
          storeSession(null)
          setSession(null)
          setPage('login')
        }
      })
  }, [session, invitationToken])

  useEffect(() => {
    if (!session?.refresh_token || !session?.expires_at || session.auth_event === 'recovery') return
    const refreshIn = Math.max(10_000, (session.expires_at * 1000) - Date.now() - 60_000)
    const timer = window.setTimeout(async () => {
      try {
        const result = await refreshSession(session.refresh_token)
        storeSession(result.session)
        setSession(result.session)
      } catch {
        signOut()
      }
    }, refreshIn)
    return () => window.clearTimeout(timer)
  }, [session])

  const authenticated = (nextSession) => {
    storeSession(nextSession)
    setSession(nextSession)
    setPage(invitationToken ? 'invitation' : 'bulk')
  }

  const previewApp = () => {
    setAccount({
      user: { first_name: 'Preview', last_name: 'User', email: 'preview@emailcheckr.xyz' },
      workspace: { name: 'EmailVerify Preview', role: 'owner' },
    })
    setCreditBalance(1000)
    setPage('bulk')
  }

  const signOut = () => {
    storeSession(null)
    setSession(null)
    setAccount(null)
    setCreditBalance(null)
    setPage(invitationToken ? 'invitation' : 'landing')
  }

  if (page === 'invitation') return <InvitationPage token={invitationToken} session={session} navigate={navigate} onSignOut={signOut} onJoined={() => { const url = new URL(window.location.href); url.searchParams.delete('invitation'); window.history.replaceState({}, '', url); setInvitationToken(null); setPage('account') }} />
  if (page === 'password-update') return <ResetPasswordPage session={session} callbackError={authCallback.error} navigate={navigate} onComplete={() => { storeSession(null); setSession(null) }} />
  if (page === 'landing') return <LandingPage navigate={navigate} />
  if (page === 'login' || page === 'signup' || page === 'forgot-password') return <AuthPage mode={page} invitationToken={invitationToken} navigate={navigate} onAuthenticated={authenticated} onPreview={previewApp} />

  return (
    <div className="min-h-screen bg-[#f5f5ff] text-[#242145]">
      <TopNav page={page} navigate={navigate} open={mobileNav} setOpen={setMobileNav} creditBalance={creditBalance} isAdmin={account?.user?.system_role === 'admin'} account={account} onSignOut={signOut} />
      <div className="mx-auto flex w-full max-w-[1120px] gap-4 px-4 py-5">
        {page === 'list' && <ListSidebar active={detailTab} setActive={setDetailTab} onBack={() => navigate('bulk')} />}
        {page === 'profile' && <AccountSidebar active="profile" navigate={navigate} />}
        {page === 'account' && <AccountSidebar active="account" navigate={navigate} />}
        {page === 'billing' && <AccountSidebar active="billing" navigate={navigate} />}
        <main className="min-w-0 flex-1">
          {page === 'bulk' && <BulkListsPage session={session} workspaceId={account?.workspace?.id} onOpen={openList} />}
          {page === 'list' && <ListDetailPage session={session} batch={selectedBatch} tab={detailTab} setTab={setDetailTab} />}
          {page === 'single' && <SinglePage session={session} onCreditUsed={(used) => setCreditBalance((balance) => balance == null ? balance : Math.max(0, balance - used))} />}
          {page === 'api' && <ApiPage session={session} />}
          {page === 'credits' && <BuyCreditsPage session={session} navigate={navigate} />}
          {page === 'billing' && <LiveBillingPage navigate={navigate} session={session} />}
          {page === 'profile' && <ProfilePage account={account} session={session} navigate={navigate} onUpdated={setAccount} onSignOut={signOut} />}
          {page === 'account' && <TeamPage session={session} account={account} navigate={navigate} />}
          {page === 'support' && <SupportPage session={session} />}
          {page === 'admin-approvals' && <AdminOperationsPage session={session} />}
        </main>
      </div>
    </div>
  )
}

function LandingPage({ navigate }) {
  const features = [
    [Upload, 'Bulk List Cleaning', 'Upload CSV, TXT, or XLSX files and review addresses by verification status, risk reason, and confidence score.'],
    [Zap, 'Instant Verification', 'Check an email address in seconds before it enters a form, CRM, campaign, or customer database.'],
    [Code2, 'Developer-Ready API', 'Add email verification to your application with straightforward endpoints, secure API keys, webhooks, and callbacks.'],
    [ShieldCheck, 'Clear Risk Signals', 'Identify disposable addresses, role accounts, invalid domains, missing MX records, and other delivery risks in one result.'],
  ]
  return (
    <div className="min-h-screen bg-white text-[#242145]">
      <header className="sticky top-0 z-40 border-b border-[#e9e7f3] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-5">
          <button type="button" onClick={() => navigate('landing')} aria-label="EmailVerify home" className="shrink-0"><BrandLogo className="h-11 w-auto sm:h-12" /></button>
          <nav className="hidden items-center gap-8 text-sm font-semibold text-[#625c7f] md:flex"><a href="#product">Product</a><a href="#how">How It Works</a><a href="#pricing">Pricing</a><a href="#api">API</a></nav>
          <div className="flex items-center gap-2"><button type="button" onClick={() => navigate('login')} className="hidden h-10 px-4 text-sm font-bold text-[#5c5676] sm:block">Log In</button><Button onClick={() => navigate('signup')}>START FREE <ArrowRight className="h-4 w-4" /></Button></div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-[#17142d] px-5 pb-20 pt-20 text-white sm:pt-28">
          <div className="absolute inset-0 opacity-[0.11]" style={{ backgroundImage: 'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)', backgroundSize: '56px 56px' }} />
          <div className="relative mx-auto max-w-[1100px] text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#8673ff]/50 bg-[#7558ff]/15 px-4 py-2 text-xs font-bold text-[#cbc3ff]"><Sparkles className="h-4 w-4 text-[#ffc84d]" /> CLEANER LISTS. FEWER BOUNCES.</div>
            <h1 className="mx-auto mt-7 max-w-4xl text-5xl font-extrabold leading-[1.06] sm:text-7xl">Know which emails are worth sending to.</h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#c4bfd7]">Verify individual addresses, clean entire lists, and identify risky emails before they affect your sender reputation.</p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"><button type="button" onClick={() => navigate('signup')} className="inline-flex h-12 items-center gap-2 rounded-md bg-[#7558ff] px-6 text-sm font-bold text-white shadow-lg shadow-[#7558ff]/25 hover:bg-[#856cff]">START FREE <ArrowRight className="h-4 w-4" /></button><button type="button" onClick={() => navigate('login')} className="h-12 rounded-md border border-white/20 px-6 text-sm font-bold text-white hover:bg-white/5">VIEW THE APP</button></div>
            <p className="mt-4 text-xs text-[#8f89a8]">Start with 1,000 free verification credits. No credit card required.</p>
            <HeroProductPreview />
          </div>
        </section>

        <section id="product" className="border-b border-[#eceaf4] bg-[#fafaff] px-5 py-24">
          <div className="mx-auto max-w-[1100px]"><SectionIntro eyebrow="ONE VERIFICATION WORKSPACE" title="Everything you need to verify emails with confidence." copy="Check one address, upload a complete list, or connect Email Verify directly to your existing workflow." /><div className="mt-14 grid gap-px overflow-hidden rounded-lg border border-[#e5e3f0] bg-[#e5e3f0] md:grid-cols-2">{features.map(([Icon, title, copy]) => <div key={title} className="bg-white p-8"><span className="grid h-11 w-11 place-items-center rounded-md bg-[#eeeaff] text-[#7558ff]"><Icon className="h-5 w-5" /></span><h3 className="mt-5 text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-[#716b89]">{copy}</p></div>)}</div></div>
        </section>

        <section id="how" className="px-5 py-24"><div className="mx-auto max-w-[1100px]"><SectionIntro eyebrow="FROM EMAIL TO ANSWER" title="A clear result backed by multiple checks." copy="Every email passes through a structured verification process that produces an actionable status—not a confusing collection of raw data." /><div className="mt-14 grid gap-5 lg:grid-cols-3"><MethodCard number="01" icon={FileCheck2} title="Check the Address" copy="Normalize the email, confirm its structure, and detect common formatting errors or unsupported address patterns." color="#7558ff" /><MethodCard number="02" icon={Globe2} title="Inspect the Domain" copy="Verify the domain, review its MX records, and identify disposable, temporary, free, and accept-all providers." color="#38c994" /><MethodCard number="03" icon={ShieldCheck} title="Assess Deliverability" copy="Evaluate available mailbox signals and classify the address as deliverable, risky, undeliverable, or unknown." color="#ff6b86" /></div></div></section>

        <section id="api" className="bg-[#f5f5ff] px-5 py-24"><div className="mx-auto grid max-w-[1100px] items-center gap-12 lg:grid-cols-2"><div><span className="text-xs font-bold text-[#7558ff]">BUILT FOR DEVELOPERS</span><h2 className="mt-3 text-4xl font-extrabold">Email verification that fits your product.</h2><p className="mt-5 text-base leading-7 text-[#716b89]">Use the same verification engine across signup forms, CRMs, lead-routing systems, internal tools, and bulk-processing workflows. Private credentials remain on your server.</p><div className="mt-7 space-y-3">{['Real-time and batch verification endpoints', 'Webhooks and asynchronous callbacks', 'Test and production API keys', 'Consistent status, score, and reason fields'].map((item) => <p key={item} className="flex items-center gap-3 text-sm font-semibold"><CheckCircle2 className="h-5 w-5 text-[#38c994]" />{item}</p>)}</div></div><div className="overflow-hidden rounded-lg bg-[#211e38] shadow-2xl"><div className="flex gap-2 border-b border-white/10 px-5 py-4"><span className="h-2.5 w-2.5 rounded-full bg-[#ff6b86]" /><span className="h-2.5 w-2.5 rounded-full bg-[#ffc84d]" /><span className="h-2.5 w-2.5 rounded-full bg-[#38c994]" /></div><pre className="overflow-auto p-6 text-sm leading-7 text-[#d9d4f1]">{`POST /api/v1/verify
Authorization: Bearer ev_live_xxx

{
  "email": "hello@company.com",
  "smtp": true,
  "accept_all": false
}

200 {
  "status": "deliverable",
  "score": 96
}`}</pre></div></div></section>

        <PricingSection navigate={navigate} />

        <section className="bg-[#7558ff] px-5 py-20 text-white"><div className="mx-auto max-w-3xl text-center"><h2 className="text-4xl font-extrabold">Give your next email list a cleaner start.</h2><p className="mt-4 text-[#ddd8ff]">Create your workspace and verify your first 1,000 email addresses free.</p><button type="button" onClick={() => navigate('signup')} className="mt-8 inline-flex h-12 items-center gap-2 rounded-md bg-white px-6 text-sm font-bold text-[#5c3de2]">CREATE YOUR WORKSPACE <ArrowRight className="h-4 w-4" /></button></div></section>
      </main>
      <LandingFooter />
    </div>
  )
}

function AuthPage({ mode, invitationToken, navigate, onAuthenticated, onPreview }) {
  const signup = mode === 'signup'
  const localDashboardAccess = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', workspaceName: '' })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [recovering, setRecovering] = useState(mode === 'forgot-password')
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  const submit = async (event) => {
    event.preventDefault()
    if (recovering) {
      await resetPassword()
      return
    }
    setError('')
    setNotice('')
    setSubmitting(true)
    try {
      const result = signup ? await signUp({ ...form, ...(invitationToken ? { invitationToken, workspaceName: 'Invited team' } : {}) }) : await signIn({ email: form.email, password: form.password, ...(invitationToken ? { invitationToken } : {}) })
      if (result.requiresEmailConfirmation) {
        setNotice('Check your inbox to confirm your email, then sign in.')
      } else {
        onAuthenticated(result.session)
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }
  const resetPassword = async () => {
    setError('')
    setNotice('')
    if (!form.email) return setError('Enter your work email first.')
    setSubmitting(true)
    try {
      await requestPasswordReset(form.email)
      setNotice('Password reset instructions are on the way.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }
  const showRecovery = () => {
    setRecovering(true)
    setError('')
    setNotice('')
  }
  const showLogin = () => {
    setRecovering(false)
    setError('')
    setNotice('')
  }
  return (
    <div className="grid min-h-screen bg-[#fbfaff] lg:grid-cols-[minmax(380px,0.86fr)_minmax(520px,1.14fr)]">
      <section className="relative flex min-h-[420px] flex-col overflow-hidden bg-[#17142d] px-7 py-8 text-white sm:px-10 lg:min-h-screen lg:px-14 lg:py-12">
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)', backgroundSize: '56px 56px' }} />
        <button type="button" onClick={() => navigate('landing')} className="relative w-fit" aria-label="EmailVerify home"><BrandLogo dark className="h-11 w-auto sm:h-12" /></button>
        <div className="relative my-auto max-w-md py-14 lg:py-10">
          <p className="text-xs font-bold uppercase text-[#9c88ff]">Email intelligence, simplified</p>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.12] sm:text-5xl">Start with contacts you can trust.</h1>
          <p className="mt-5 max-w-sm text-base leading-7 text-[#bbb6cb]">Clean lists, check individual addresses, and protect every signup before bad data enters your workflow.</p>
          <div className="mt-9 space-y-4">{(invitationToken ? ['One shared workspace', 'Bulk, single, and API verification', 'Your team\'s existing credit balance'] : ['1,000 verification credits included', 'Bulk, single, and API verification', 'No credit card required']).map((item) => <p key={item} className="flex items-center gap-3 text-sm font-semibold text-[#ece9f6]"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#38c994]/15"><Check className="h-4 w-4 text-[#48d9a5]" /></span>{item}</p>)}</div>
        </div>
        <div className="relative flex items-center gap-2 text-xs text-[#817b96]"><LockKeyhole className="h-4 w-4" />Private credentials stay on the server.</div>
      </section>
      <section className="flex items-center justify-center px-5 py-12 sm:px-10 lg:px-16">
        <div className="w-full max-w-[470px]">
          <img src="/images/logos/emailverify-icon.png" alt="" className="h-14 w-14 rounded-xl shadow-lg shadow-[#6548ff]/20" />
          <p className="mt-8 text-xs font-bold uppercase text-[#7558ff]">{signup ? (invitationToken ? 'Team invitation' : 'Create your workspace') : recovering ? 'Account recovery' : 'Welcome back'}</p>
          <h2 className="mt-3 text-3xl font-extrabold text-[#211e3c] sm:text-4xl">{signup ? (invitationToken ? 'Create your team account' : 'Start verifying for free') : recovering ? 'Reset your password' : 'Sign in to your workspace'}</h2>
          {recovering ? <p className="mt-3 text-sm leading-6 text-[#77718f]">Enter the email address for your account and we’ll send you a secure password reset link.</p> : <p className="mt-3 text-sm text-[#77718f]">{signup ? 'Already have an account?' : 'New to EmailVerify?'} <button type="button" onClick={() => navigate(signup ? 'login' : 'signup')} className="font-bold text-[#6548ff] hover:text-[#4f31c7]">{signup ? 'Log in' : 'Create an account'}</button></p>}
          <form onSubmit={submit} className="mt-8 space-y-5">{signup && <div className="grid gap-4 sm:grid-cols-2"><AuthField label="First name" name="firstName" value={form.firstName} onChange={update} autoComplete="given-name" /><AuthField label="Last name" name="lastName" value={form.lastName} onChange={update} autoComplete="family-name" /></div>}<AuthField label="Work email" name="email" type="email" value={form.email} onChange={update} autoComplete="email" />{!recovering && <AuthField label="Password" name="password" type="password" value={form.password} onChange={update} autoComplete={signup ? 'new-password' : 'current-password'} />}{signup && !invitationToken && <AuthField label="Company name" name="workspaceName" value={form.workspaceName} onChange={update} autoComplete="organization" />}{error && <p className="rounded-md border border-[#f7c8d3] bg-[#fff0f3] px-3 py-2 text-sm text-[#c8375b]">{error}</p>}{notice && <p className="rounded-md border border-[#bfead9] bg-[#e9fbf4] px-3 py-2 text-sm text-[#167554]">{notice}</p>}{!recovering && <div className="flex items-center justify-between text-xs text-[#625c79]"><label className="flex items-center gap-2"><input type="checkbox" required={signup} defaultChecked className="h-4 w-4 rounded border-[#d7d3e5] text-[#7558ff]" />{signup ? 'I agree to the terms' : 'Remember me'}</label>{!signup && <button type="button" onClick={showRecovery} className="font-bold text-[#6548ff] hover:text-[#4f31c7]">Forgot password?</button>}</div>}<button type="submit" disabled={submitting} className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#6548ff] text-sm font-bold text-white shadow-lg shadow-[#6548ff]/20 hover:bg-[#5739ec] disabled:cursor-wait disabled:opacity-60">{submitting ? 'PLEASE WAIT' : signup ? 'CREATE ACCOUNT' : recovering ? 'SEND RESET LINK' : 'SIGN IN'} {!submitting && <ArrowRight className="h-4 w-4" />}</button>{recovering && <button type="button" onClick={showLogin} className="flex h-11 w-full items-center justify-center gap-2 text-sm font-bold text-[#6548ff] hover:text-[#4f31c7]"><ChevronLeft className="h-4 w-4" />BACK TO SIGN IN</button>}</form>
          {!signup && !recovering && !invitationToken && localDashboardAccess && <div className="mt-5"><div className="flex items-center gap-3 text-[11px] font-bold uppercase text-[#aaa5b8]"><span className="h-px flex-1 bg-[#e5e2ed]" />Local workspace<span className="h-px flex-1 bg-[#e5e2ed]" /></div><button type="button" onClick={onPreview} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-md border border-[#d9d5e8] bg-white text-sm font-bold text-[#625c79] hover:border-[#7558ff] hover:text-[#6548ff]"><Grid2X2 className="h-4 w-4" />ACCESS DASHBOARD</button></div>}
          <p className="mt-6 text-center text-xs text-[#9993aa]">By continuing, you agree to the Terms and Privacy Policy.</p>
        </div>
      </section>
    </div>
  )
}

function ResetPasswordPage({ session, callbackError, navigate, onComplete }) {
  const [form, setForm] = useState({ password: '', confirmation: '' })
  const [error, setError] = useState(callbackError ? 'This password reset link is invalid or has expired.' : '')
  const [submitting, setSubmitting] = useState(false)
  const [complete, setComplete] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    setError('')
    if (form.password !== form.confirmation) return setError('The passwords do not match.')
    if (form.password.length < 12 || !/[a-z]/.test(form.password) || !/[A-Z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      return setError('Use at least 12 characters with uppercase, lowercase, and a number.')
    }
    setSubmitting(true)
    try {
      await updatePassword(session, form.password)
      onComplete()
      setComplete(true)
    } catch (requestError) {
      setError(requestError.status === 401 ? 'This password reset link is invalid or has expired.' : requestError.message)
    } finally {
      setSubmitting(false)
    }
  }
  return <main className="grid min-h-screen place-items-center bg-[#f7f6fc] px-5 py-12"><section className="w-full max-w-[500px] rounded-md border border-[#e3e0ee] bg-white p-7 shadow-panel sm:p-10"><BrandLogo className="h-10 w-auto" />{complete ? <div className="mt-10"><CheckCircle2 className="h-10 w-10 text-[#38c994]" /><h1 className="mt-5 text-3xl font-extrabold">Password updated.</h1><p className="mt-3 text-sm leading-6 text-[#716b89]">Your previous sessions have been signed out. Use your new password to continue.</p><button type="button" onClick={() => navigate('login')} className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#6548ff] text-sm font-bold text-white hover:bg-[#5739ec]">RETURN TO SIGN IN <ArrowRight className="h-4 w-4" /></button></div> : <><p className="mt-10 text-xs font-bold uppercase text-[#7558ff]">Secure account recovery</p><h1 className="mt-3 text-3xl font-extrabold">Choose a new password.</h1><p className="mt-3 text-sm leading-6 text-[#716b89]">Use at least 12 characters with uppercase, lowercase, and a number.</p>{session && !callbackError ? <form onSubmit={submit} className="mt-7 space-y-5"><AuthField label="New password" name="password" type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} autoComplete="new-password" /><AuthField label="Confirm new password" name="confirmation" type="password" value={form.confirmation} onChange={(event) => setForm((current) => ({ ...current, confirmation: event.target.value }))} autoComplete="new-password" />{error && <p role="alert" className="rounded-md border border-[#f7c8d3] bg-[#fff0f3] px-3 py-2 text-sm text-[#c8375b]">{error}</p>}<button type="submit" disabled={submitting} className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#6548ff] text-sm font-bold text-white hover:bg-[#5739ec] disabled:opacity-60">{submitting ? 'UPDATING...' : 'UPDATE PASSWORD'} {!submitting && <ArrowRight className="h-4 w-4" />}</button></form> : <div className="mt-7"><p role="alert" className="rounded-md border border-[#f7c8d3] bg-[#fff0f3] px-3 py-2 text-sm text-[#c8375b]">{error || 'This password reset link is invalid or has expired.'}</p><button type="button" onClick={() => navigate('forgot-password')} className="mt-5 flex h-12 w-full items-center justify-center rounded-md bg-[#6548ff] text-sm font-bold text-white hover:bg-[#5739ec]">REQUEST A NEW LINK</button></div>}</>}</section></main>
}

function HeroProductPreview() {
  return <div className="mx-auto mt-16 max-w-[980px] rounded-xl border border-white/15 bg-[#f5f5ff] p-2 text-left shadow-2xl sm:p-4"><div className="overflow-hidden rounded-lg bg-white"><div className="flex h-12 items-center justify-between border-b border-[#eceaf4] px-4"><BrandLogo className="h-7 w-auto" /><div className="flex gap-2"><span className="h-7 w-16 rounded bg-[#ede9ff]" /><span className="h-7 w-7 rounded-full bg-[#7558ff]" /></div></div><div className="grid min-h-[390px] sm:grid-cols-[150px_1fr]"><div className="hidden border-r border-[#eceaf4] bg-[#fafaff] p-4 sm:block">{['Overview', 'Emails', 'Exports', 'Settings'].map((item, i) => <div key={item} className={`mb-2 rounded px-3 py-2 text-xs font-semibold ${i === 0 ? 'bg-[#e9e5ff] text-[#7558ff]' : 'text-[#8b85a3]'}`}>{item}</div>)}</div><div className="p-5 sm:p-7"><div className="grid grid-cols-3 gap-3">{[['EMAILS', '12,480'], ['DELIVERABLE', '91.7%'], ['RISKY', '6.2%']].map(([label, value]) => <div key={label} className="rounded-md border border-[#e5e3ef] p-4"><span className="text-[9px] font-bold text-[#9d97b4]">{label}</span><strong className="mt-2 block text-lg text-[#242145] sm:text-2xl">{value}</strong></div>)}</div><div className="mt-4 grid gap-4 md:grid-cols-[0.8fr_1.2fr]"><div className="grid place-items-center rounded-md border border-[#e5e3ef] p-5"><Donut item={{ valid: 91.7, invalid: 1.1, risky: 6.2, unknown: 1 }} /><span className="-mt-4 text-xs font-bold text-[#6f6889]">SEPTEMBER LEADS</span></div><div className="rounded-md border border-[#e5e3ef] p-4"><div className="mb-3 text-xs font-bold text-[#5e5878]">Recent verifications</div>{[['sarah@northstar.io', 'Deliverable'], ['team@sample.co', 'Risky'], ['hello@company.com', 'Deliverable'], ['temp@maildrop.cc', 'Undeliverable']].map(([email, state]) => <div key={email} className="flex items-center justify-between border-t border-[#efedf5] py-3 text-xs"><span className="truncate text-[#665f80]">{email}</span><State state={state} /></div>)}</div></div></div></div></div></div>
}

function SectionIntro({ eyebrow, title, copy }) { return <div className="mx-auto max-w-2xl text-center"><p className="text-xs font-bold text-[#7558ff]">{eyebrow}</p><h2 className="mt-3 text-4xl font-extrabold leading-tight">{title}</h2><p className="mt-5 text-base leading-7 text-[#716b89]">{copy}</p></div> }
function LandingFooter() {
  const groups = [
    ['Product', [['Bulk List Verification', '#product'], ['Single Email Verification', '#product'], ['Developer API', '#api'], ['Pricing', '#pricing']]],
    ['Resources', [['API Documentation', '/docs'], ['Help Center', '/support'], ['System Status', '/status'], ['Contact Support', 'mailto:support@emailcheckr.xyz']]],
    ['Company', [['About', '/about'], ['Contact Us', 'mailto:support@emailcheckr.xyz'], ['Security', '/security']]],
    ['Legal', [['Privacy', '/privacy'], ['Terms', '/terms'], ['Acceptable use', '/acceptable-use']]],
  ]
  return <footer className="border-t border-[#e9e7f3] bg-[#17142d] px-5 text-white"><div className="mx-auto grid max-w-[1100px] gap-10 py-14 md:grid-cols-[1.4fr_2fr]"><div className="max-w-xs"><BrandLogo dark className="h-11 w-auto" /><p className="mt-5 text-sm leading-6 text-[#aaa5bd]">Verify email addresses before they enter your campaigns, forms, CRM, or customer workflows.</p><a href="mailto:support@emailcheckr.xyz" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#bdafff] hover:text-white"><Mail className="h-4 w-4" />support@emailcheckr.xyz</a></div><div className="grid grid-cols-2 gap-8 sm:grid-cols-4">{groups.map(([title, links]) => <div key={title}><h3 className="text-xs font-bold uppercase text-white">{title}</h3><div className="mt-4 space-y-3">{links.map(([label, href]) => <a key={label} href={href} className="block text-sm text-[#aaa5bd] hover:text-white">{label}</a>)}</div></div>)}</div></div><div className="mx-auto flex max-w-[1100px] flex-col gap-3 border-t border-white/10 py-6 text-xs text-[#7f7993] sm:flex-row sm:items-center sm:justify-between"><span>© 2026 Email Verify. All rights reserved.</span><span>Built for cleaner lists and more confident sending.</span></div></footer>
}
function PricingSection({ navigate }) {
  const [type, setType] = useState('monthly')
  const packages = type === 'monthly' ? monthlyPricing : oneTimePricing
  return <section id="pricing" className="px-5 py-24"><div className="mx-auto max-w-[1100px]"><SectionIntro eyebrow="SIMPLE PRICING" title="Pay for the verification volume you need." copy="One credit verifies one email address. Choose a monthly allowance for ongoing verification or purchase credits once and use them when needed." /><div className="mx-auto mt-8 flex w-fit rounded-md bg-[#f0edff] p-1"><button type="button" onClick={() => setType('monthly')} className={`h-9 rounded px-4 text-xs font-bold ${type === 'monthly' ? 'bg-white text-[#6246e9] shadow-sm' : 'text-[#8b84a8]'}`}>MONTHLY</button><button type="button" onClick={() => setType('one-time')} className={`h-9 rounded px-4 text-xs font-bold ${type === 'one-time' ? 'bg-white text-[#6246e9] shadow-sm' : 'text-[#8b84a8]'}`}>ONE-TIME</button></div><p className="mt-4 text-center text-xs text-[#817a99]">{type === 'monthly' ? 'Monthly credits reset at the beginning of each billing cycle and do not roll over.' : 'One-time credits never expire.'}</p><div className={`mt-10 grid gap-4 sm:grid-cols-2 ${packages.length === 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>{packages.map((item, index) => <Panel key={item.id} className={`flex min-h-52 flex-col p-5 ${type === 'monthly' && index === 1 ? 'border-2 border-[#7558ff]' : ''}`}>{type === 'monthly' && index === 1 && <Tag>MOST POPULAR</Tag>}<p className="mt-3 text-sm font-bold text-[#665f80]">{item.credits.toLocaleString()} Credits</p><p className="mt-4 text-3xl font-extrabold">${item.price}</p><p className="mt-1 text-xs text-[#8d86a5]">{type === 'monthly' ? 'per month' : `$${((item.price / item.credits) * 1000).toFixed(2)} per 1,000`}</p><div className="flex-1" /><button type="button" onClick={() => navigate('signup')} className={`mt-6 h-9 rounded-md border text-xs font-bold ${type === 'monthly' && index === 1 ? 'border-[#7558ff] bg-[#7558ff] text-white' : 'border-[#dcd9eb] text-[#6f688d] hover:bg-[#f7f6fc]'}`}>GET STARTED</button></Panel>)}</div><p className="mt-8 text-center text-sm text-[#716b89]">Every account includes bulk uploads, single-email verification, API access, and CSV exports. Start with 1,000 free credits. No credit card required.</p></div></section>
}
function MethodCard({ number, icon: Icon, title, copy, color }) { return <Panel className="p-7"><div className="flex items-center justify-between"><span className="grid h-11 w-11 place-items-center rounded-md text-white" style={{ backgroundColor: color }}><Icon className="h-5 w-5" /></span><span className="text-4xl font-extrabold text-[#efedf6]">{number}</span></div><h3 className="mt-6 text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-[#716b89]">{copy}</p></Panel> }
function AuthField({ label, type = 'text', ...inputProps }) { return <label className="block text-sm font-semibold"><span>{label}</span><input type={type} required {...inputProps} className="mt-2 h-11 w-full rounded-md border border-[#dcd9e8] px-3 outline-none focus:border-[#7558ff] focus:ring-4 focus:ring-[#7558ff]/10" /></label> }

function TopNav({ page, navigate, open, setOpen, creditBalance, isAdmin, account, onSignOut }) {
  const [profileOpen, setProfileOpen] = useState(false)
  const items = [['bulk', 'Bulk', Grid2X2], ['single', 'Single', Mail], ['api', 'API', Code2], ['support', 'Support', CircleHelp], ...(isAdmin ? [['admin-approvals', 'Admin', ShieldCheck]] : [])]
  const firstName = account?.user?.first_name || 'Preview'
  const lastName = account?.user?.last_name || 'User'
  const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase()
  const profileItems = [
    ['Profile', User, 'profile'],
    ['Account', Users, 'account'],
    ['Integrations', Grid2X2, 'api'],
    ['Billing', CreditCard, 'billing'],
    ['Help', CircleHelp, 'support'],
  ]
  return (
    <header className="sticky top-0 z-30 border-b border-[#e5e4f3] bg-white">
      <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between px-4">
        <button type="button" onClick={() => navigate('bulk')} aria-label="EmailVerify dashboard"><BrandLogo className="h-8 w-auto" /></button>
        <button type="button" className="grid h-9 w-9 place-items-center rounded-md border border-[#e2e0f1] md:hidden" onClick={() => setOpen(!open)} aria-label="Toggle navigation"><Menu className="h-4 w-4" /></button>
        <nav className={`${open ? 'flex' : 'hidden'} absolute inset-x-0 top-14 flex-col gap-1 border-b border-[#e5e4f3] bg-white p-3 shadow-panel md:static md:flex md:flex-row md:items-center md:border-0 md:p-0 md:shadow-none`}>
          {items.map(([key, label, Icon]) => <NavButton key={key} active={page === key || (key === 'bulk' && page === 'list')} onClick={() => navigate(key)} icon={Icon}>{label}</NavButton>)}
          <div className="group relative">
            <button type="button" onClick={() => navigate('credits')} aria-describedby="credit-balance-popover" className="h-8 rounded-md bg-[#f0edff] px-4 text-xs font-bold text-[#7051ff]">BUY CREDITS</button>
            <div id="credit-balance-popover" role="tooltip" className="pointer-events-none invisible absolute right-0 top-8 z-50 w-56 translate-y-1 rounded-md border border-[#e1deef] bg-white p-4 text-left opacity-0 shadow-xl transition group-hover:pointer-events-auto group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
              <div className="flex items-center gap-2 text-xs font-bold text-[#77708f]"><CreditCard className="h-4 w-4 text-[#7558ff]" />AVAILABLE CREDITS</div>
              <p className="mt-2 text-2xl font-extrabold text-[#242145]">{creditBalance == null ? 'Loading...' : Number(creditBalance).toLocaleString()}</p>
              <p className="mt-1 text-xs text-[#8c86a3]">Ready for single, bulk, and API verification.</p>
              <button type="button" onClick={() => navigate('credits')} className="mt-4 h-8 w-full rounded-md bg-[#7558ff] text-xs font-bold text-white hover:bg-[#6546f3]">ADD CREDITS</button>
            </div>
          </div>
          <div className="relative ml-1" onMouseEnter={() => setProfileOpen(true)} onMouseLeave={() => setProfileOpen(false)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setProfileOpen(false) }} onKeyDown={(event) => { if (event.key === 'Escape') setProfileOpen(false) }}>
            <button type="button" aria-label="Profile menu" aria-haspopup="menu" aria-expanded={profileOpen} onClick={() => setProfileOpen(true)} className="flex items-center gap-2 rounded-md p-1 hover:bg-[#f5f3ff]"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#7558ff] text-xs font-bold text-white">{initials}</span><ChevronDown className={`h-4 w-4 text-[#8d87b1] transition ${profileOpen ? 'rotate-180' : ''}`} /></button>
            <div role="menu" className={`${profileOpen ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-1 opacity-0'} absolute right-0 top-11 z-50 w-60 rounded-md border border-[#e1deef] bg-white p-2 shadow-xl transition`}>
              <div className="border-b border-[#eceaf4] px-3 pb-3 pt-2"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#7558ff] text-xs font-bold text-white">{initials}</span><div className="min-w-0"><p className="truncate text-sm font-bold text-[#292546]">{firstName} {lastName}</p><p className="truncate text-[10px] text-[#8d87a2]">{account?.workspace?.name || 'EmailVerify workspace'}</p></div></div><p className="mt-4 text-[9px] font-bold text-[#9d97b4]">CREDIT BALANCE</p><p className="mt-1 text-xl font-extrabold text-[#242145]">{creditBalance == null ? 'Loading...' : Number(creditBalance).toLocaleString()}</p></div>
              <div className="py-2">{profileItems.map(([label, Icon, destination]) => <button key={label} type="button" role="menuitem" onClick={() => { setProfileOpen(false); navigate(destination) }} className="flex h-9 w-full items-center gap-3 rounded px-3 text-left text-xs font-semibold text-[#625c7f] hover:bg-[#eeeaff] hover:text-[#6546f3]"><Icon className="h-4 w-4 text-[#8269ef]" />{label}</button>)}</div>
              <div className="border-t border-[#eceaf4] pt-2"><button type="button" role="menuitem" onClick={() => { setProfileOpen(false); onSignOut() }} className="flex h-9 w-full items-center gap-3 rounded px-3 text-left text-xs font-semibold text-[#625c7f] hover:bg-[#fff0f3] hover:text-[#c8375b]"><ArrowRight className="h-4 w-4 rotate-180 text-[#8269ef]" />Sign Out</button></div>
            </div>
          </div>
        </nav>
      </div>
    </header>
  )
}

function NavButton({ active, onClick, icon: Icon, children }) {
  return <button type="button" onClick={onClick} className={`flex h-10 items-center gap-2 rounded-md px-3 text-[13px] font-bold ${active ? 'bg-[#ece9ff] text-[#4f31c7]' : 'text-[#5e587f] hover:bg-[#f7f6ff]'}`}><span className={`grid h-5 w-5 place-items-center rounded-full ${active ? 'bg-[#7558ff] text-white' : 'bg-[#ebe8f8] text-[#796ed1]'}`}><Icon className="h-3 w-3" /></span>{children}</button>
}

function SupportPage({ session }) {
  const [items, setItems] = useState([])
  const [form, setForm] = useState({ category: 'verification', subject: '', message: '' })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const load = () => apiRequest('/support/requests', { session }).then((data) => setItems(data.items)).catch((requestError) => setError(requestError.message))
  useEffect(() => { load() }, [session])
  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const request = await apiRequest('/support/requests', { session, method: 'POST', body: JSON.stringify(form) })
      setItems((current) => [request, ...current])
      setForm({ category: 'verification', subject: '', message: '' })
      setNotice(`Request received. Reference ${request.id}.`)
    } catch (requestError) { setError(requestError.message) } finally { setBusy(false) }
  }
  return <div className="mx-auto grid max-w-[920px] gap-5 lg:grid-cols-[1fr_0.9fr]"><Panel><PanelHeader title="Contact support" subtitle="Tell us what happened and include the details needed to investigate." /><form onSubmit={submit} className="space-y-5 p-5"><label className="block text-sm font-semibold"><span>Category</span><select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className="mt-2 h-11 w-full rounded-md border border-[#dcd9e8] bg-white px-3 outline-none focus:border-[#7558ff]"><option value="verification">Verification</option><option value="billing">Billing</option><option value="api">API</option><option value="account">Account</option><option value="other">Other</option></select></label><AuthField label="Subject" name="subject" value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} /><label className="block text-sm font-semibold"><span>Message</span><textarea required minLength="10" maxLength="5000" rows="8" value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} className="mt-2 w-full resize-y rounded-md border border-[#dcd9e8] p-3 text-sm outline-none focus:border-[#7558ff] focus:ring-4 focus:ring-[#7558ff]/10" placeholder="Include affected list names, request IDs, or error messages when available." /></label>{error && <p className="rounded-md border border-[#f7c8d3] bg-[#fff0f3] px-3 py-2 text-sm text-[#c8375b]">{error}</p>}{notice && <p className="rounded-md border border-[#bfead9] bg-[#e9fbf4] px-3 py-2 text-sm text-[#167554]">{notice}</p>}<Button type="submit" className="w-full" disabled={busy}>{busy ? 'SENDING...' : 'SUBMIT REQUEST'}</Button></form></Panel><Panel><PanelHeader title="Your requests" subtitle="Recent requests from this workspace." /><div>{!items.length && <p className="p-6 text-sm text-[#8d87a2]">No support requests yet.</p>}{items.map((item) => <div key={item.id} className="border-t border-[#eceaf5] p-5 first:border-t-0"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold">{item.subject}</p><p className="mt-1 text-xs uppercase text-[#8d87a2]">{item.category} · {new Date(item.created_at).toLocaleDateString()}</p></div><Tag tone={item.status === 'resolved' || item.status === 'closed' ? 'violet' : item.priority === 'urgent' ? 'rose' : 'violet'}>{item.status.replaceAll('_',' ')}</Tag></div><p className="mt-3 line-clamp-3 text-xs leading-5 text-[#716b89]">{item.message}</p><p className="mt-3 font-mono text-[10px] text-[#aaa5b8]">{item.id}</p></div>)}</div></Panel></div>
}

function AdminOperationsPage({ session }) {
  const [tab, setTab] = useState('overview')
  const [overview, setOverview] = useState(null)
  const [workspaces, setWorkspaces] = useState([])
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [approvals, setApprovals] = useState([])
  const [supportRequests, setSupportRequests] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const load = async () => {
    try {
      const [overviewData, workspaceData, approvalData, supportData] = await Promise.all([
        apiRequest('/admin/overview', { session }),
        apiRequest('/admin/workspaces', { session }),
        apiRequest('/admin/batch-approvals', { session }),
        apiRequest('/admin/support/requests', { session }),
      ])
      setOverview(overviewData)
      setWorkspaces(workspaceData.items)
      setApprovals(approvalData.items)
      setSupportRequests(supportData.items)
    } catch (requestError) { setError(requestError.message) }
  }
  useEffect(() => { load() }, [session])
  const findWorkspaces = async () => {
    try {
      const data = await apiRequest(`/admin/workspaces?search=${encodeURIComponent(search)}`, { session })
      setWorkspaces(data.items)
    } catch (requestError) { setError(requestError.message) }
  }
  const openWorkspace = async (id) => {
    setBusy(id)
    try { setSelected(await apiRequest(`/admin/workspaces/${id}`, { session })) } catch (requestError) { setError(requestError.message) } finally { setBusy('') }
  }
  const adjustCredits = async () => {
    const amount = Number(window.prompt('Credit adjustment. Use a positive number to add or a negative number to remove:'))
    if (!Number.isInteger(amount) || amount === 0) return
    const reason = window.prompt('Detailed reason for this adjustment:')
    if (!reason || reason.trim().length < 10) return
    setBusy('adjust')
    try {
      await apiRequest(`/admin/workspaces/${selected.workspace.id}/credit-adjustments`, { session, method: 'POST', body: JSON.stringify({ amount, reason }) })
      await openWorkspace(selected.workspace.id)
      await load()
    } catch (requestError) { setError(requestError.message) } finally { setBusy('') }
  }
  const changeStatus = async () => {
    const status = selected.workspace.status === 'active' ? 'suspended' : 'active'
    const reason = window.prompt(`Reason for ${status === 'active' ? 'reactivating' : 'suspending'} this workspace:`)
    if (!reason || reason.trim().length < 10) return
    setBusy('status')
    try {
      await apiRequest(`/admin/workspaces/${selected.workspace.id}/status`, { session, method: 'POST', body: JSON.stringify({ status, reason }) })
      await openWorkspace(selected.workspace.id)
      await load()
    } catch (requestError) { setError(requestError.message) } finally { setBusy('') }
  }
  const decide = async (item, decision) => {
    const reason = window.prompt(`Reason for ${decision === 'approve' ? 'approving' : 'declining'} ${item.name}:`)
    if (!reason || reason.trim().length < 10) return
    setBusy(item.id)
    setError('')
    try {
      await apiRequest(`/admin/batch-approvals/${item.id}/${decision}`, { session, method: 'POST', body: JSON.stringify({ reason }) })
      setApprovals((current) => current.filter((batch) => batch.id !== item.id))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy('')
    }
  }
  const updateSupport = async (item, status, priority = item.priority) => {
    setBusy(item.id)
    setError('')
    try {
      const updated = await apiRequest(`/admin/support/requests/${item.id}`, { session, method: 'POST', body: JSON.stringify({ status, priority }) })
      setSupportRequests((current) => current.map((request) => request.id === item.id ? { ...request, ...updated } : request))
    } catch (requestError) { setError(requestError.message) } finally { setBusy('') }
  }
  const inventory = overview?.inventory
  return <div className="mx-auto max-w-[960px]"><div className="mb-6"><p className="text-xs font-bold text-[#7558ff]">OPERATIONS</p><h1 className="mt-2 text-2xl font-extrabold">Admin control center</h1><p className="mt-2 text-sm text-[#77718f]">Monitor inventory, support customer workspaces, and review high-risk jobs.</p></div><div className="mb-5 flex gap-1 overflow-x-auto border-b border-[#dddbea]">{[['overview','Overview'],['workspaces','Workspaces'],['support',`Support (${supportRequests.filter((item) => !['resolved','closed'].includes(item.status)).length})`],['approvals',`Approvals (${approvals.length})`]].map(([key,label]) => <button key={key} type="button" onClick={() => setTab(key)} className={`shrink-0 border-b-2 px-4 py-3 text-xs font-bold ${tab === key ? 'border-[#7558ff] text-[#6546f3]' : 'border-transparent text-[#817a99]'}`}>{label}</button>)}</div>{error && <p className="mb-4 rounded-md border border-[#f7c8d3] bg-[#fff0f3] px-4 py-3 text-sm text-[#c8375b]">{error}</p>}{tab === 'overview' && overview && <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Panel className="p-5"><SummaryBox label="SELLABLE CREDITS" value={inventory.sellable.toLocaleString()} /></Panel><Panel className="p-5"><SummaryBox label="CUSTOMER LIABILITY" value={inventory.allocated_to_customers.toLocaleString()} /></Panel><Panel className="p-5"><SummaryBox label="PROVIDER BALANCE" value={inventory.reported_available.toLocaleString()} /></Panel><Panel className="p-5"><SummaryBox label="SAFETY RESERVE" value={inventory.safety_reserve.toLocaleString()} /></Panel></div><Panel><PanelHeader title="System summary" /><div className="grid grid-cols-2 divide-x divide-[#e7e5f3] sm:grid-cols-4"><Metric label="WORKSPACES" value={overview.counts.workspaces} dot="#7558ff" /><Metric label="USERS" value={overview.counts.users} dot="#55a9e9" /><Metric label="PENDING APPROVALS" value={overview.counts.approvals} dot="#ffc84d" /><Metric label="PAYMENT RISKS" value={overview.counts.payment_risks} dot="#ff6b86" /></div></Panel></div>}{tab === 'workspaces' && <div className="space-y-4">{!selected && <><div className="flex gap-2"><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') findWorkspaces() }} placeholder="Search workspace name" className="h-10 flex-1 rounded-md border border-[#dedced] bg-white px-3 text-sm outline-none focus:border-[#7558ff]" /><Button icon={Search} onClick={findWorkspaces}>SEARCH</Button></div><Panel className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-xs"><thead className="bg-[#faf9ff]"><tr>{['Workspace','Status','Available','Reserved','Created',''].map((item) => <th key={item} className="px-5 py-3">{item}</th>)}</tr></thead><tbody>{workspaces.map((item) => <tr key={item.id} className="border-t border-[#eceaf5]"><td className="px-5 py-3 font-bold">{item.name}</td><td className="px-5 py-3"><Tag tone={item.status === 'active' ? 'violet' : 'rose'}>{item.status}</Tag></td><td className="px-5 py-3">{Number(item.credit_accounts?.available || 0).toLocaleString()}</td><td className="px-5 py-3">{Number(item.credit_accounts?.reserved || 0).toLocaleString()}</td><td className="px-5 py-3">{new Date(item.created_at).toLocaleDateString()}</td><td className="px-5 py-3"><Button variant="outline" disabled={busy === item.id} onClick={() => openWorkspace(item.id)}>OPEN</Button></td></tr>)}</tbody></table></div></Panel></>}{selected && <WorkspaceAdminDetail data={selected} busy={busy} onBack={() => setSelected(null)} onAdjust={adjustCredits} onStatus={changeStatus} />}</div>}{tab === 'support' && <div className="space-y-4">{!supportRequests.length && <Panel className="p-10 text-center"><CircleHelp className="mx-auto h-8 w-8 text-[#7558ff]" /><h2 className="mt-3 font-bold">Support inbox is clear</h2></Panel>}{supportRequests.map((item) => <Panel key={item.id} className="p-5"><div className="flex flex-col gap-4 sm:flex-row sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">{item.subject}</h2><Tag tone={item.priority === 'urgent' ? 'rose' : 'violet'}>{item.priority}</Tag><Tag>{item.status.replaceAll('_',' ')}</Tag></div><p className="mt-1 text-xs uppercase text-[#8d87a2]">{item.workspaces?.name} · {item.category} · {new Date(item.created_at).toLocaleDateString()}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#625c79]">{item.message}</p></div><div className="flex shrink-0 flex-wrap gap-2"><Button variant="outline" disabled={busy === item.id} onClick={() => updateSupport(item, item.status, item.priority === 'urgent' ? 'normal' : 'urgent')}>{item.priority === 'urgent' ? 'NORMAL PRIORITY' : 'MARK URGENT'}</Button>{item.status === 'open' && <Button disabled={busy === item.id} onClick={() => updateSupport(item, 'in_progress')}>START</Button>}{!['resolved','closed'].includes(item.status) && <Button disabled={busy === item.id} onClick={() => updateSupport(item, 'resolved')}>RESOLVE</Button>}</div></div></Panel>)}</div>}{tab === 'approvals' && <div className="space-y-4">{!approvals.length && <Panel className="p-10 text-center"><ShieldCheck className="mx-auto h-8 w-8 text-[#38c994]" /><h2 className="mt-3 font-bold">Approval queue is clear</h2><p className="mt-2 text-sm text-[#817a99]">New flagged batches will appear here.</p></Panel>}{approvals.map((item) => <Panel key={item.id} className="p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-bold">{item.name}</h2><p className="mt-1 text-sm text-[#77718f]">{item.total.toLocaleString()} unique addresses · {item.workspaces?.name || 'Workspace'}</p><div className="mt-3 flex flex-wrap gap-2">{item.risk_rules.map((rule) => <Tag key={rule}>{rule.replaceAll('_', ' ')}</Tag>)}</div></div><div className="flex shrink-0 gap-2"><Button variant="outline" disabled={busy === item.id} onClick={() => decide(item, 'reject')}>DECLINE</Button><Button disabled={busy === item.id} onClick={() => decide(item, 'approve')}>APPROVE</Button></div></div></Panel>)}</div>}</div>
}

function WorkspaceAdminDetail({ data, busy, onBack, onAdjust, onStatus }) {
  const { workspace, members, purchases, ledger, actions } = data
  return <div className="space-y-4"><button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-xs font-bold text-[#7558ff]"><ChevronLeft className="h-4 w-4" />ALL WORKSPACES</button><Panel><PanelHeader title={workspace.name} action={<div className="flex gap-2"><Button variant="outline" disabled={Boolean(busy)} onClick={onAdjust}>ADJUST CREDITS</Button><Button variant={workspace.status === 'active' ? 'outline' : 'primary'} disabled={Boolean(busy)} onClick={onStatus}>{workspace.status === 'active' ? 'SUSPEND' : 'REACTIVATE'}</Button></div>} /><div className="grid grid-cols-2 divide-x divide-[#e7e5f3] sm:grid-cols-4"><SummaryBox label="STATUS" value={workspace.status.toUpperCase()} /><SummaryBox label="AVAILABLE" value={Number(workspace.credit_accounts?.available || 0).toLocaleString()} /><SummaryBox label="RESERVED" value={Number(workspace.credit_accounts?.reserved || 0).toLocaleString()} /><SummaryBox label="CREATED" value={new Date(workspace.created_at).toLocaleDateString()} /></div></Panel><Panel><PanelHeader title="Members" /><div>{members.map((member) => <div key={member.user_id} className="flex items-center justify-between border-t border-[#eceaf5] px-5 py-3 first:border-t-0"><div><p className="text-sm font-bold">{member.profile?.first_name} {member.profile?.last_name}</p><p className="text-xs text-[#817a99]">{member.profile?.email}</p></div><Tag>{member.role}</Tag></div>)}</div></Panel><div className="grid gap-4 lg:grid-cols-2"><Panel><PanelHeader title="Recent purchases" /><AdminActivityRows items={purchases} empty="No purchases yet." render={(item) => <><span>{item.package_id}</span><span className="text-right"><strong>{item.credits.toLocaleString()}</strong><small className="block text-[#8d87a2]">{item.status}</small></span></>} /></Panel><Panel><PanelHeader title="Credit ledger" /><AdminActivityRows items={ledger} empty="No ledger entries yet." render={(item) => <><span>{item.reason || item.type}</span><span className={item.amount >= 0 ? 'text-[#19835e]' : 'text-[#d34768]'}>{item.amount > 0 ? '+' : ''}{item.amount.toLocaleString()}</span></>} /></Panel></div>{actions.length > 0 && <Panel><PanelHeader title="Admin audit history" /><AdminActivityRows items={actions} render={(item) => <><span>{item.action.replaceAll('_',' ')}<small className="block text-[#8d87a2]">{item.reason}</small></span><span>{new Date(item.created_at).toLocaleDateString()}</span></>} /></Panel>}</div>
}

function AdminActivityRows({ items, empty = '', render }) {
  if (!items.length) return <p className="p-5 text-sm text-[#8d87a2]">{empty}</p>
  return <div>{items.map((item) => <div key={item.id} className="flex items-center justify-between gap-4 border-t border-[#eceaf5] px-5 py-3 text-xs first:border-t-0">{render(item)}</div>)}</div>
}

function BulkListsPage({ session, workspaceId, onOpen }) {
  const [view, setView] = useState('grid')
  const [items, setItems] = useState(session ? [] : lists)
  const [uploading, setUploading] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const normalizeBatch = (batch) => {
    const counts = batch.total_counts || {}
    const total = batch.total || 1
    return { ...batch, count: batch.total, valid: Number(((counts.deliverable || 0) / total * 100).toFixed(1)), risky: Number(((counts.risky || 0) / total * 100).toFixed(1)), invalid: Number(((counts.undeliverable || 0) / total * 100).toFixed(1)), unknown: Number(((counts.unknown || 0) / total * 100).toFixed(1)) }
  }

  useEffect(() => {
    if (!session) return
    apiRequest('/batches', { session }).then((data) => setItems(data.items.map(normalizeBatch))).catch((requestError) => setError(requestError.message))
  }, [session])

  useEffect(() => {
    if (!session || !items.some((item) => item.status === 'processing')) return
    const timer = window.setInterval(async () => {
      const active = items.filter((item) => item.status === 'processing')
      const refreshed = await Promise.all(active.map((item) => apiRequest(`/batches/${item.id}`, { session }).catch(() => item)))
      setItems((current) => current.map((item) => normalizeBatch(refreshed.find((next) => next.id === item.id) || item)))
    }, 4000)
    return () => window.clearInterval(timer)
  }, [items, session])

  const upload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    setNotice('')
    setUploading(true)
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Files must be 10 MB or smaller.')
      if (!session) {
        setNotice('Sign in to import and verify your list.')
        return
      }
      const body = new FormData()
      body.append('file', file)
      const bytes = await new Blob([file.name, '\0', file]).arrayBuffer()
      const digest = await crypto.subtle.digest('SHA-256', bytes)
      const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
      const attempt = getUploadAttempt(workspaceId, fingerprint)
      const batch = await apiRequest('/batches/upload', { session, method: 'POST', headers: { 'Idempotency-Key': attempt.key }, body })
      finishUploadAttempt(attempt)
      setItems((current) => [normalizeBatch(batch), ...current.filter((item) => item.id !== batch.id)])
      const summary = ` ${batch.duplicates_removed || 0} duplicates removed; ${batch.ignored_cells || 0} malformed email cells skipped.`
      setNotice(batch.approval_required
        ? `Your ${batch.total.toLocaleString()}-address batch is staged for manual review. No credits have been reserved yet.${summary}`
        : `Batch started with ${batch.total.toLocaleString()} unique addresses.${summary}`)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setUploading(false)
    }
  }

  const exportBatch = async (item) => {
    setError('')
    try {
      const response = await fetch(`/api/v1/batches/${item.id}/export`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      if (!response.ok) throw new Error((await response.json()).error?.message || 'Unable to export this list.')
      if (response.headers.get('content-type')?.includes('application/json')) {
        const { downloadUrl, downloadUrls = [] } = await response.json()
        const urls = downloadUrls.length ? downloadUrls : [downloadUrl].filter(Boolean)
        urls.forEach((url, index) => window.setTimeout(() => {
          const link = document.createElement('a')
          link.href = url
          link.target = '_blank'
          link.rel = 'noopener'
          link.click()
        }, index * 250))
        return
      }
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = `${item.name}-results.csv`
      link.click()
      URL.revokeObjectURL(url)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return (
    <div className="mx-auto max-w-[900px]">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md bg-[#7558ff] px-4 text-xs font-bold text-white hover:bg-[#6546f3]"><Plus className="h-4 w-4" />{uploading ? 'UPLOADING...' : 'NEW LIST'}<input aria-label="Upload email list" type="file" accept=".csv,.txt,.xlsx" disabled={uploading} onChange={upload} className="sr-only" /></label>
        <label className="relative min-w-[240px] flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-[#aaa5c6]" /><input className="h-10 w-full rounded-md border border-[#dedced] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#8b73ff]" placeholder="Type something to search" /></label>
        <IconButton active={view === 'list'} onClick={() => setView('list')} icon={List} label="List view" />
        <IconButton active={view === 'grid'} onClick={() => setView('grid')} icon={Grid2X2} label="Grid view" />
      </div>
      {notice && <p className="mb-4 rounded-md border border-[#bfead9] bg-[#e9fbf4] px-4 py-3 text-sm text-[#167554]">{notice}</p>}
      {error && <p className="mb-4 rounded-md border border-[#f7c8d3] bg-[#fff0f3] px-4 py-3 text-sm text-[#c8375b]">{error}</p>}
      {!items.length && <Panel className="p-10 text-center"><Upload className="mx-auto h-7 w-7 text-[#7558ff]" /><h2 className="mt-3 font-bold">Upload your first list</h2><p className="mt-2 text-sm text-[#817a99]">CSV, TXT, or XLSX. Maximum 10 MB and 250,000 unique addresses. Some lists require manual review.</p></Panel>}
      <div className={view === 'grid' ? 'grid gap-5 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-3'}>{items.map((item) => view === 'grid' ? <ListCard key={item.id || item.name} item={item} onOpen={onOpen} onExport={session && item.status === 'complete' ? () => exportBatch(item) : null} /> : <ListRow key={item.id || item.name} item={item} onOpen={onOpen} onExport={session && item.status === 'complete' ? () => exportBatch(item) : null} />)}</div>
    </div>
  )
}

function ListCard({ item, onOpen, onExport }) {
  const pending = item.status === 'approval_pending'
  const ready = item.status === 'complete' || !item.status
  return <Panel className="p-5 text-center"><h2 className="truncate text-[15px] font-extrabold text-[#242145]">{item.name}</h2><p className="mt-1.5 flex items-center justify-center gap-1 text-[13px] font-medium text-[#817a9f]"><Folder className="h-3.5 w-3.5 text-[#7558ff]" /> {pending ? 'Waiting for manual review' : item.status === 'processing' ? `${item.processed || 0} of ${item.total} processed` : item.status === 'failed' ? 'Verification failed' : item.status === 'rejected' ? 'Review declined' : 'My Computer'}</p><Donut item={item} /><div className="flex gap-2"><Button className="flex-1" variant={ready ? 'primary' : 'outline'} onClick={ready ? () => onOpen(item) : undefined}>{pending ? 'AWAITING APPROVAL' : item.status === 'processing' ? 'PROCESSING' : item.status === 'rejected' ? 'DECLINED' : 'VIEW RESULTS'} {ready && <ChevronRight className="h-4 w-4" />}</Button>{onExport && <button type="button" title="Export results" onClick={onExport} className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-[#dcd9eb] text-[#7558ff] hover:bg-[#f4f1ff]"><Upload className="h-4 w-4" /></button>}</div></Panel>
}

function ListRow({ item, onOpen, onExport }) {
  const ready = item.status === 'complete' || !item.status
  return <Panel className="flex items-center gap-4 p-4"><Donut item={item} small /><div className="min-w-0 flex-1"><h2 className="truncate text-sm font-bold">{item.name}</h2><p className="mt-1 text-xs text-[#8e88ad]">{item.count.toLocaleString()} emails · {item.status === 'approval_pending' ? 'waiting for approval' : item.status === 'processing' ? `${item.processed || 0} processed` : item.status || 'complete'}</p></div>{onExport && <button type="button" title="Export results" onClick={onExport} className="grid h-9 w-9 place-items-center rounded-md border border-[#dcd9eb] text-[#7558ff]"><Upload className="h-4 w-4" /></button>}<Button variant="outline" onClick={ready ? () => onOpen(item) : undefined}>{item.status === 'approval_pending' ? 'Awaiting approval' : item.status === 'processing' ? 'Processing' : item.status === 'rejected' ? 'Declined' : 'View'}</Button></Panel>
}

function Donut({ item, small = false }) {
  const duplicate = Math.max(0, 100 - item.valid - item.risky - item.invalid - item.unknown)
  const a = item.valid, b = a + item.invalid, c = b + item.risky, d = c + item.unknown
  const background = `conic-gradient(${colors.valid} 0 ${a}%, ${colors.invalid} ${a}% ${b}%, ${colors.risky} ${b}% ${c}%, ${colors.unknown} ${c}% ${d}%, ${colors.duplicate} ${d}% ${d + duplicate}%)`
  return <div className={`relative grid shrink-0 place-items-center rounded-full ${small ? 'h-14 w-14' : 'mx-auto my-6 h-40 w-40'}`} style={{ background }}><div className={`${small ? 'h-9 w-9' : 'h-28 w-28'} grid place-items-center rounded-full bg-white text-center`}><span><strong className={`${small ? 'text-xs' : 'text-[26px]'} font-extrabold text-[#242145]`}>{item.valid}%</strong>{!small && <small className="mt-0.5 block text-[13px] font-medium text-[#817a9f]">Deliverable</small>}</span></div></div>
}

function ListSidebar({ active, setActive, onBack }) {
  const links = [['overview', 'Overview', Gauge], ['emails', 'Emails', Mail], ['exports', 'Exports', Upload], ['settings', 'Settings', Settings]]
  return <aside className="hidden w-[170px] shrink-0 md:block"><button type="button" onClick={onBack} className="mb-3 flex items-center gap-2 px-3 text-xs font-semibold text-[#817aa8]"><ChevronLeft className="h-3 w-3" /> All lists</button>{links.map(([key, label, Icon]) => <SideLink key={key} active={active === key} icon={Icon} onClick={() => setActive(key)}>{label}</SideLink>)}</aside>
}

function ListDetailPage({ session, batch, tab, setTab }) {
  const preview = !session || !batch?.id
  const item = batch || { ...lists[0], status: 'complete', created_at: '2026-09-09T00:00:00.000Z', total: lists[0].count, total_counts: { deliverable: 198, undeliverable: 16, risky: 219, unknown: 21, duplicate: 294 }, reason_counts: { invalid_domain: 2, rejected_email: 13, invalid_smtp: 1, low_quality: 68, low_deliverability: 151, unavailable_smtp: 1, unexpected_error: 20 } }
  return <div className="space-y-4"><ListSummary batch={item} /><div className="flex gap-2 overflow-x-auto md:hidden">{['overview', 'emails', 'exports', 'settings'].map((key) => <button key={key} onClick={() => setTab(key)} className={`rounded-md px-3 py-2 text-xs font-bold capitalize ${tab === key ? 'bg-[#7558ff] text-white' : 'bg-white text-[#6d668d]'}`}>{key}</button>)}</div>{tab === 'overview' && <ListOverview batch={item} preview={preview} />}{tab === 'emails' && <EmailResults session={session} batch={item} preview={preview} />}{tab === 'exports' && <Exports session={session} batch={item} preview={preview} />}{tab === 'settings' && <ListSettings batch={item} />}</div>
}

function ListSummary({ batch }) { return <Panel className="grid gap-5 p-6 sm:grid-cols-[2fr_0.8fr_0.9fr]"><Summary label="NAME" value={batch.name} /><Summary label="EMAILS" value={Number(batch.total || batch.count || 0).toLocaleString()} /><Summary label="UPLOADED" value={batch.created_at ? new Date(batch.created_at).toLocaleDateString() : 'Preview'} /></Panel> }

function ListOverview({ batch, preview }) {
  const counts = batch.total_counts || {}
  const total = Number(batch.total || 1)
  const count = (key) => Number(counts[key] || 0)
  const percent = (key) => `${(count(key) / total * 100).toFixed(1)}%`
  const donut = { valid: count('deliverable') / total * 100, risky: count('risky') / total * 100, invalid: count('undeliverable') / total * 100, unknown: count('unknown') / total * 100 }
  const reasons = batch.reason_counts || {}
  return <><Panel className="grid items-center gap-8 p-8 lg:grid-cols-[1.1fr_0.9fr]"><Donut item={donut} /><div className="space-y-5"><LegendRow color={colors.valid} percent={percent('deliverable')} label="Deliverable" value={count('deliverable')} /><LegendRow color={colors.invalid} percent={percent('undeliverable')} label="Undeliverable" value={count('undeliverable')} /><LegendRow color={colors.risky} percent={percent('risky')} label="Risky" value={count('risky')} /><LegendRow color={colors.unknown} percent={percent('unknown')} label="Unknown" value={count('unknown')} /><LegendRow color={colors.duplicate} percent={percent('duplicate')} label="Duplicate" value={count('duplicate')} /></div></Panel><div className="mt-4 grid gap-4 lg:grid-cols-3"><Breakdown title="Undeliverable" color={colors.invalid} value={percent('undeliverable')} rows={[['Invalid email', reasons.invalid_email || 0], ['Invalid domain', reasons.invalid_domain || 0], ['Rejected email', reasons.rejected_email || 0], ['Invalid SMTP', reasons.invalid_smtp || 0]]} /><Breakdown title="Risky" color={colors.risky} value={percent('risky')} rows={[['Low quality', reasons.low_quality || 0], ['Low deliverability', reasons.low_deliverability || 0]]} /><Breakdown title="Unknown" color={colors.unknown} value={percent('unknown')} rows={[['No connect', reasons.no_connect || 0], ['Timeout', reasons.timeout || 0], ['Unavailable SMTP', reasons.unavailable_smtp || 0], ['Unexpected error', reasons.unexpected_error || 0]]} /></div>{batch.status !== 'complete' && <p className="text-sm text-[#817a99]">This list is currently {batch.status.replaceAll('_', ' ')}. Results will appear here when processing finishes.</p>}{!preview && batch.status === 'complete' && !batch.results_available && <p className="text-sm text-[#817a99]">This list is larger than the dashboard detail limit. Download the provider export from the Exports tab to review every row.</p>}</>
}

function EmailResults({ session, batch, preview }) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [draftSearch, setDraftSearch] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], total: 0, pageSize: 25 })
  const [loading, setLoading] = useState(!preview)
  const [error, setError] = useState('')
  const previewItems = emails.map(([email, reason, score, state], index) => ({ id: `preview-${index}`, row_number: index + 1, email, reason, score, state: state.toLowerCase() }))
  useEffect(() => {
    if (preview || !batch?.id) return
    setLoading(true)
    setError('')
    apiRequest(`/batches/${batch.id}/results?page=${page}&pageSize=25&state=${filter}&search=${encodeURIComponent(search)}`, { session }).then(setData).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false))
  }, [batch?.id, filter, page, search, preview, session])
  const rows = preview ? previewItems.filter((row) => filter === 'all' || row.state === filter).filter((row) => !search || row.email.includes(search.toLowerCase())) : data.items
  const total = preview ? rows.length : data.total
  const pageCount = Math.max(1, Math.ceil(total / (preview ? 25 : data.pageSize)))
  const applySearch = (event) => { event.preventDefault(); setPage(1); setSearch(draftSearch.trim().toLowerCase()) }
  const stateLabel = (state) => state === 'deliverable' ? 'Deliverable' : state === 'undeliverable' ? 'Undeliverable' : state[0].toUpperCase() + state.slice(1)
  return <Panel className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7e5f3] px-5 py-4"><h2 className="font-bold">Emails {total ? <span className="ml-1 text-xs font-medium text-[#918ba9]">({total.toLocaleString()})</span> : null}</h2><div className="flex flex-wrap gap-1">{['all', 'deliverable', 'risky', 'undeliverable', 'unknown'].map((item) => <Filter key={item} active={filter === item} onClick={() => { setFilter(item); setPage(1) }}>{item}</Filter>)}</div></div><form onSubmit={applySearch} className="flex gap-2 border-b border-[#e7e5f3] p-4"><input aria-label="Search email results" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} placeholder="Search this list" className="h-9 min-w-0 flex-1 rounded-md border border-[#dcd9eb] px-3 text-sm outline-none focus:border-[#7558ff]" /><Button type="submit" icon={Search}>SEARCH</Button></form>{error && <p role="alert" className="m-4 rounded-md border border-[#f7c8d3] bg-[#fff0f3] px-3 py-2 text-sm text-[#c8375b]">{error}</p>}{loading ? <p className="p-8 text-center text-sm text-[#817a99]">Loading results...</p> : !rows.length ? <p className="p-8 text-center text-sm text-[#817a99]">No results match this filter.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-xs"><thead className="bg-[#faf9ff] text-[#706a91]"><tr><th className="px-5 py-3">Email</th><th className="px-5 py-3">Reason</th><th className="px-5 py-3">Score</th><th className="px-5 py-3">State</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id || row.email} className="border-t border-[#eeecf6]"><td className="px-5 py-3 text-[#645e87]">{row.email}</td><td className="px-5 py-3"><Tag>{(row.reason || 'unknown').replaceAll('_', ' ')}</Tag></td><td className="px-5 py-3"><Score value={row.score} /></td><td className="px-5 py-3"><State state={stateLabel(row.state)} /></td></tr>)}</tbody></table></div>}{pageCount > 1 && <div className="flex items-center justify-between border-t border-[#e7e5f3] px-5 py-3 text-xs"><span>Page {page} of {pageCount}</span><div className="flex gap-2"><Button variant="outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>PREVIOUS</Button><Button variant="outline" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>NEXT</Button></div></div>}</Panel>
}

function Exports({ session, batch, preview }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const download = async () => {
    if (preview) return setError('Sign in to export a real list.')
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/v1/batches/${batch.id}/export`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      if (!response.ok) throw new Error((await response.json()).error?.message || 'Unable to export this list.')
      if (response.headers.get('content-type')?.includes('application/json')) {
        const { downloadUrl, downloadUrls = [] } = await response.json()
        ;(downloadUrls.length ? downloadUrls : [downloadUrl].filter(Boolean)).forEach((url) => window.open(url, '_blank', 'noopener'))
      } else {
        const link = document.createElement('a'); link.href = URL.createObjectURL(await response.blob()); link.download = `${batch.name}-results.csv`; link.click()
      }
    } catch (requestError) { setError(requestError.message) } finally { setBusy(false) }
  }
  return <Panel><PanelHeader title="Exports" subtitle="Download the provider results for this list." action={<Button icon={Upload} onClick={download} disabled={busy || batch.status !== 'complete'}>{busy ? 'PREPARING...' : 'DOWNLOAD RESULTS'}</Button>} />{error && <p role="alert" className="m-5 rounded-md border border-[#f7c8d3] bg-[#fff0f3] px-3 py-2 text-sm text-[#c8375b]">{error}</p>}<div className="grid grid-cols-[1fr_140px_120px] bg-[#faf9ff] px-5 py-3 text-xs font-bold"><span>Name</span><span>Created</span><span>Status</span></div><div className="grid grid-cols-[1fr_140px_120px] items-center border-t border-[#eceaf5] px-5 py-4 text-xs"><span>{batch.name} results</span><span>{batch.created_at ? new Date(batch.created_at).toLocaleDateString() : 'Preview'}</span><Tag tone={batch.status === 'complete' ? 'violet' : 'rose'}>{batch.status === 'complete' ? 'READY' : batch.status.toUpperCase()}</Tag></div></Panel>
}
function ListSettings({ batch }) { return <Panel><PanelHeader title="General" subtitle="Retention and operational status for this list." /><div className="grid gap-5 p-5 sm:grid-cols-2"><Field label="Name" value={batch.name} disabled /><Field label="Status" value={batch.status.replaceAll('_', ' ')} disabled /><Field label="Uploaded" value={batch.created_at ? new Date(batch.created_at).toLocaleString() : 'Preview'} disabled /><Field label="Expires" value={batch.expires_at ? new Date(batch.expires_at).toLocaleDateString() : '187 days after completion'} disabled /></div>{batch.risk_rules?.length > 0 && <div className="border-t border-[#e7e5f3] p-5"><p className="text-xs font-bold uppercase text-[#8d87a8]">Manual review triggers</p><div className="mt-3 flex flex-wrap gap-2">{batch.risk_rules.map((rule) => <Tag key={rule}>{rule.replaceAll('_', ' ')}</Tag>)}</div></div>}</Panel> }

function SinglePage({ session, onCreditUsed }) {
  const [email, setEmail] = useState('deliverable@example.com')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const verify = async () => {
    setError('')
    setResult(null)
    setLoading(true)
    try {
      if (!session) {
        await new Promise((resolve) => setTimeout(resolve, 450))
        setResult({ email, state: 'deliverable', reason: 'accepted_email', score: 98, disposable: false, role: false, free: false, accept_all: false, credits_used: 0, preview: true })
        return
      }

      const data = await apiRequest('/verify', {
        session,
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ email, smtp: true, accept_all: false, timeout: 5 }),
      })
      setResult(data)
      onCreditUsed(data.credits_used || 0)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  const state = result?.state || 'unknown'
  const stateColor = state === 'deliverable' ? colors.valid : state === 'risky' ? colors.risky : state === 'undeliverable' ? colors.invalid : colors.unknown
  const stateLabel = state.charAt(0).toUpperCase() + state.slice(1)
  const tags = result ? [result.reason?.replaceAll('_', ' '), result.accept_all ? 'accept all' : null, result.disposable ? 'disposable' : 'not disposable', result.role ? 'role based' : 'not role based', result.free ? 'free provider' : null].filter(Boolean) : []

  return <div className="mx-auto max-w-[760px] space-y-4"><Panel><PanelHeader title="Single Verification" subtitle={session ? 'Check one address instantly. Billable results use one credit.' : 'Preview mode uses a simulated result and no credits.'} /><div className="flex flex-col gap-3 p-6 sm:flex-row"><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') verify() }} className="h-11 flex-1 rounded-md border border-[#dedced] px-4 text-sm outline-none focus:border-[#7c61ff]" /><button type="button" disabled={loading || !email} onClick={verify} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#7558ff] px-5 text-xs font-bold text-white hover:bg-[#6546f3] disabled:cursor-wait disabled:opacity-60"><ShieldCheck className="h-4 w-4" />{loading ? 'VERIFYING...' : 'VERIFY EMAIL'}</button></div>{error && <p className="mx-6 mb-6 rounded-md border border-[#f7c8d3] bg-[#fff0f3] px-3 py-2 text-sm text-[#c8375b]">{error}</p>}</Panel>{result && <Panel className="p-6"><div className="flex flex-col gap-6 sm:flex-row sm:items-center"><div className="grid h-24 w-24 shrink-0 place-items-center rounded-full border-[9px] text-2xl font-bold" style={{ borderColor: stateColor }}>{result.score ?? '-'}</div><div className="min-w-0"><div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5" style={{ color: stateColor }} /><h2 className="text-xl font-bold">{stateLabel}</h2>{result.preview && <Tag>PREVIEW</Tag>}</div><p className="mt-2 truncate text-sm font-semibold text-[#514b6b]">{result.email || email}</p><p className="mt-2 text-sm text-[#777092]">{state === 'unknown' ? 'The provider could not reach a confident result, so your credit was refunded.' : `Verification completed. ${result.credits_used || 0} credit${result.credits_used === 1 ? '' : 's'} used.`}</p><div className="mt-4 flex flex-wrap gap-2">{tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</div></div></div></Panel>}</div>
}

function ApiPage({ session }) {
  const [apiKeys, setApiKeys] = useState([])
  const [usage, setUsage] = useState({ verifications: 0, deliverable: 0, risky: 0, undeliverable: 0, unknown: 0 })
  const [newSecret, setNewSecret] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const load = async () => {
    if (!session) return
    try {
      const [keys, summary] = await Promise.all([
        apiRequest('/api-keys', { session }),
        apiRequest('/api-keys/usage/summary', { session }),
      ])
      setApiKeys(keys.items)
      setUsage(summary)
    } catch (requestError) { setError(requestError.message) }
  }
  useEffect(() => { load() }, [session])
  const createKey = async () => {
    const name = window.prompt('Name this API key (for example, Production website):')
    if (!name?.trim()) return
    setBusy(true)
    setError('')
    try {
      const key = await apiRequest('/api-keys', { session, method: 'POST', body: JSON.stringify({ name: name.trim(), environment: 'live' }) })
      setNewSecret(key.secret)
      setApiKeys((current) => [key, ...current])
    } catch (requestError) { setError(requestError.message) } finally { setBusy(false) }
  }
  const revokeKey = async (key) => {
    if (!window.confirm(`Revoke “${key.name}”? Applications using it will stop working immediately.`)) return
    setBusy(true)
    try {
      await apiRequest(`/api-keys/${key.id}`, { session, method: 'DELETE' })
      setApiKeys((current) => current.map((item) => item.id === key.id ? { ...item, revoked_at: new Date().toISOString() } : item))
    } catch (requestError) { setError(requestError.message) } finally { setBusy(false) }
  }
  const copy = async (value) => { await navigator.clipboard.writeText(value) }
  const endpoint = `${window.location.origin}/api/v1/verify`
  return <div className="space-y-4">{error && <p className="rounded-md border border-[#f7c8d3] bg-[#fff0f3] px-4 py-3 text-sm text-[#c8375b]">{error}</p>}{newSecret && <Panel className="border-[#8d76ff] p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold text-[#7558ff]">COPY YOUR NEW KEY NOW</p><h2 className="mt-2 font-bold">This secret will not be shown again.</h2></div><button type="button" onClick={() => setNewSecret('')} title="Dismiss" className="text-[#8d87a2]"><XCircle className="h-5 w-5" /></button></div><div className="mt-4 flex items-center gap-3 rounded-md bg-[#24213d] px-4 py-3 font-mono text-xs text-white"><span className="min-w-0 flex-1 break-all">{newSecret}</span><button type="button" onClick={() => copy(newSecret)} title="Copy API key"><Copy className="h-4 w-4" /></button></div></Panel>}<Panel><PanelHeader title="API Usage" subtitle="Last 30 days" /><div className="grid grid-cols-2 divide-x divide-[#e6e4f1] md:grid-cols-5"><Metric label="VERIFICATIONS" value={usage.verifications.toLocaleString()} dot="#655b9d" /><Metric label="DELIVERABLE" value={usage.deliverable.toLocaleString()} dot={colors.valid} /><Metric label="RISKY" value={usage.risky.toLocaleString()} dot={colors.risky} /><Metric label="UNDELIVERABLE" value={usage.undeliverable.toLocaleString()} dot={colors.invalid} /><Metric label="UNKNOWN" value={usage.unknown.toLocaleString()} dot={colors.unknown} /></div></Panel><Panel className="overflow-hidden"><PanelHeader title="API Keys" subtitle="Use private keys only from your server." action={<Button icon={Plus} disabled={busy} onClick={createKey}>NEW KEY</Button>} /><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead className="bg-[#faf9ff]"><tr>{['Name', 'Key', 'Environment', 'Last used', 'Created', ''].map((h) => <th key={h} className="px-5 py-3">{h}</th>)}</tr></thead><tbody>{apiKeys.map((key) => <tr key={key.id} className="border-t border-[#eceaf5]"><td className="px-5 py-3 font-semibold">{key.name}</td><td className="px-5 py-3 font-mono">{key.prefix}...</td><td className="px-5 py-3"><Tag>{key.environment}</Tag></td><td className="px-5 py-3">{key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : 'Never'}</td><td className="px-5 py-3">{new Date(key.created_at).toLocaleDateString()}</td><td className="px-5 py-3">{key.revoked_at ? <Tag tone="rose">REVOKED</Tag> : <Button variant="outline" disabled={busy} onClick={() => revokeKey(key)}>REVOKE</Button>}</td></tr>)}{!apiKeys.length && <tr className="border-t border-[#eceaf5]"><td colSpan="6" className="px-5 py-8 text-center text-[#8d87a2]">No API keys yet. Create one to connect your application.</td></tr>}</tbody></table></div></Panel><Panel><PanelHeader title="API Overview" /><div className="p-5"><h3 className="text-sm font-bold">Verify an email address</h3><p className="mt-1 text-xs text-[#777092]">Send a JSON request from your server. One billable result uses one credit.</p><div className="mt-4 flex items-center gap-3 rounded-md bg-[#24213d] px-4 py-3 font-mono text-xs text-white"><pre className="min-w-0 flex-1 overflow-auto whitespace-pre-wrap">{`curl -X POST ${endpoint} \\\n  -H "Authorization: Bearer ev_live_xxx" \\\n  -H "Content-Type: application/json" \\\n  -H "Idempotency-Key: your-unique-request-id" \\\n  -d '{"email":"name@example.com","smtp":true}'`}</pre><button type="button" onClick={() => copy(endpoint)} title="Copy endpoint"><Copy className="h-4 w-4" /></button></div></div></Panel></div>
}

function UsageChart() {
  const bars = [2, 28, 82, 4, 1, 3, 2, 1]
  return <div className="h-72 p-6"><div className="flex h-full items-end gap-4 border-b border-l border-[#dddbea] px-5">{bars.map((height, i) => <div key={i} className="flex h-full flex-1 flex-col justify-end"><div className="bg-[#ff6b86]" style={{ height: `${height * .2}px` }} /><div className="bg-[#ffc84d]" style={{ height: `${height * 1.1}px` }} /><div className="bg-[#38c994]" style={{ height: `${height * 1.3}px` }} /><span className="mt-3 text-center text-xs text-[#8d87ad]">{['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'][i]}</span></div>)}</div></div>
}

function BuyCreditsPage({ session, navigate }) {
  const [billingType, setBillingType] = useState('one-time')
  const [amount, setAmount] = useState(25000)
  const [checkoutError, setCheckoutError] = useState('')
  const [checkingOut, setCheckingOut] = useState(false)
  const packages = billingType === 'monthly' ? monthlyPricing : oneTimePricing
  const selectedPackage = packages.find((item) => item.credits === amount)
  const price = selectedPackage.price
  const pricePerCredit = price / amount
  const selectBillingType = (type) => {
    setBillingType(type)
    setAmount(type === 'monthly' ? 10000 : 25000)
  }
  const startCheckout = async () => {
    setCheckoutError('')
    if (!session) {
      setCheckoutError('Checkout is unavailable in the local preview workspace. Sign in with a confirmed account to test Stripe Checkout.')
      return
    }
    setCheckingOut(true)
    try {
      const result = await apiRequest('/billing/checkout-sessions', {
        session,
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ packageId: selectedPackage.id }),
      })
      window.location.assign(result.checkoutUrl)
    } catch (error) {
      setCheckoutError(error.message)
      setCheckingOut(false)
    }
  }
  return <Panel className="mx-auto max-w-[900px] overflow-hidden"><PanelHeader title="Buy Credits" action={<div className="flex rounded-md bg-[#f0edff] p-1"><button type="button" onClick={() => selectBillingType('one-time')} className={`h-8 rounded px-3 text-xs font-bold ${billingType === 'one-time' ? 'bg-white text-[#6246e9] shadow-sm' : 'text-[#8b84a8]'}`}>ONE-TIME</button><button type="button" onClick={() => selectBillingType('monthly')} className={`h-8 rounded px-3 text-xs font-bold ${billingType === 'monthly' ? 'bg-white text-[#6246e9] shadow-sm' : 'text-[#8b84a8]'}`}>MONTHLY</button></div>} /><div className="grid lg:grid-cols-[1.5fr_0.8fr]"><div className="border-b border-[#e7e5f3] p-6 lg:border-b-0 lg:border-r"><p className="text-center text-xs font-bold text-[#9a94ba]">CHOOSE A PACKAGE</p><div className={`mt-5 grid grid-cols-2 gap-3 ${packages.length > 5 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>{packages.map((item) => <button key={item.credits} onClick={() => setAmount(item.credits)} className={`relative h-24 rounded-md border text-center ${amount === item.credits ? 'border-2 border-[#7558ff] bg-[#f2f0ff]' : 'border-[#dddbea] bg-white'}`}><strong className="block text-lg">{item.credits.toLocaleString()}</strong><small className="text-[#8e88aa]">Credits</small><span className="mt-1 block text-xs font-bold text-[#5f5878]">${item.price}{billingType === 'monthly' ? '/mo' : ''}</span>{amount === item.credits && <Check className="absolute right-2 top-2 h-5 w-5 rounded-full bg-[#38c994] p-1 text-white" />}</button>)}</div>{billingType === 'monthly' && <p className="mt-5 text-center text-xs text-[#837c9e]">Monthly credits reset each billing cycle and do not roll over.</p>}</div><div className="flex flex-col justify-between p-6 text-center"><div><p className="text-xs font-bold text-[#7558ff]">{billingType === 'monthly' ? 'MONTHLY PLAN' : 'PAY-AS-YOU-GO'}</p><div className="mt-8 text-4xl font-extrabold">${price}{billingType === 'monthly' && <span className="text-sm font-semibold text-[#8b84a8]"> / month</span>}</div><p className="mt-8 text-xs text-[#9993b7]">COST PER CREDIT</p><strong className="text-sm">${pricePerCredit.toFixed(5)}</strong></div><div className="mt-12 space-y-3 text-xs"><div className="flex justify-between"><span>{amount.toLocaleString()} credits</span><span>${price}.00</span></div><div className="flex justify-between border-t border-[#e5e3ef] pt-3 font-bold"><span>{billingType === 'monthly' ? 'Due monthly' : 'Total'}</span><span>${price}.00</span></div></div></div></div>{checkoutError && <p className="border-t border-[#f5cad4] bg-[#fff0f3] px-5 py-3 text-sm text-[#c8375b]">{checkoutError}</p>}<div className="flex justify-end border-t border-[#e7e5f3] p-4"><Button onClick={startCheckout}>{checkingOut ? 'OPENING CHECKOUT...' : billingType === 'monthly' ? 'SUBSCRIBE' : 'CONTINUE TO CHECKOUT'}</Button></div></Panel>
}

function AccountSidebar({ active, navigate }) {
  return <aside className="hidden w-[170px] shrink-0 md:block"><SideLink active={active === 'profile'} icon={User} onClick={() => navigate('profile')}>Profile</SideLink><SideLink active={active === 'account'} icon={Users} onClick={() => navigate('account')}>Account</SideLink><SideLink icon={Grid2X2}>Integrations</SideLink><SideLink active={active === 'billing'} icon={CreditCard} onClick={() => navigate('billing')}>Billing</SideLink><SideLink icon={Code2} onClick={() => navigate('api')}>Developer</SideLink></aside>
}


function ProfilePage({ account, session, navigate, onUpdated, onSignOut }) {
  const profile = account?.user
  const [form, setForm] = useState({ firstName: profile?.first_name || '', lastName: profile?.last_name || '', workspaceName: account?.workspace?.name || '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const save = async () => {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const updated = await updateProfile(session, form)
      onUpdated((current) => ({ ...current, user: { ...current.user, ...updated.user }, workspace: updated.workspace }))
      setNotice('Profile changes saved.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }
  const change = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))
  return <div className="space-y-4"><Panel><PanelHeader title="Profile" subtitle="Manage your personal details and workspace identity." action={<Button variant="outline" onClick={onSignOut}>SIGN OUT</Button>} /><div className="grid gap-4 p-5 sm:grid-cols-2"><Field label="First Name" value={form.firstName} onChange={change('firstName')} /><Field label="Last Name" value={form.lastName} onChange={change('lastName')} /><Field label="Email" value={profile?.email || ''} disabled /><Field label="Workspace" value={form.workspaceName} onChange={change('workspaceName')} disabled={!['owner', 'admin'].includes(account?.workspace?.role)} /></div>{error && <p className="mx-5 mb-4 rounded-md border border-[#f7c8d3] bg-[#fff0f3] px-3 py-2 text-sm text-[#c8375b]">{error}</p>}{notice && <p className="mx-5 mb-4 rounded-md border border-[#bfead9] bg-[#e9fbf4] px-3 py-2 text-sm text-[#167554]">{notice}</p>}<div className="flex justify-end border-t border-[#e7e5f3] p-4"><Button disabled={saving || !form.firstName.trim() || !form.lastName.trim() || !form.workspaceName.trim()} onClick={save}>{saving ? 'SAVING...' : 'SAVE CHANGES'}</Button></div></Panel><Panel><PanelHeader title="Security" subtitle="Use a secure email link to replace your password." /><div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold">Password</p><p className="mt-1 text-sm text-[#716b89]">We will send reset instructions to {profile?.email}.</p></div><Button variant="outline" onClick={() => navigate('forgot-password')}>RESET PASSWORD</Button></div></Panel></div>
}

function SideLink({ active, icon: Icon, onClick, children }) { return <button type="button" onClick={onClick} className={`mb-1 flex h-10 w-full items-center gap-3 rounded-md px-3 text-[13px] font-bold ${active ? 'bg-[#e7e4fb] text-[#6848f3]' : 'text-[#6f6992] hover:bg-[#efedfb]'}`}><Icon className="h-4 w-4" />{children}</button> }
function Panel({ children, className = '' }) { return <section className={`rounded-md border border-[#e5e3f0] bg-white shadow-panel ${className}`}>{children}</section> }
function PanelHeader({ title, subtitle, action }) { return <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7e5f3] px-5 py-4"><div><h2 className="text-[17px] font-extrabold text-[#242145]">{title}</h2>{subtitle && <p className="mt-1 text-[13px] font-medium text-[#7d7698]">{subtitle}</p>}</div>{action}</div> }
function Button({ children, icon: Icon, variant = 'primary', className = '', onClick, disabled = false, type = 'button' }) { return <button type={type} disabled={disabled} onClick={onClick} className={`inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-[13px] font-extrabold transition disabled:cursor-not-allowed disabled:opacity-50 ${variant === 'primary' ? 'border-[#7558ff] bg-[#7558ff] text-white shadow-sm shadow-[#7558ff]/20 hover:border-[#6546f3] hover:bg-[#6546f3]' : 'border-[#d4d0e5] bg-white text-[#655e87] hover:border-[#bdb5df] hover:bg-[#f7f6fc]'} ${className}`}>{Icon && <Icon className="h-4 w-4" />}{children}</button> }
function IconButton({ icon: Icon, label, active, onClick }) { return <button type="button" onClick={onClick} title={label} className={`grid h-10 w-10 place-items-center rounded-md ${active ? 'bg-[#e7e4fb] text-[#7558ff]' : 'text-[#9a94b6] hover:bg-white'}`}><Icon className="h-5 w-5" /></button> }
function Field({ label, value, disabled, onChange }) { const [text, setText] = useState(value); const controlled = typeof onChange === 'function'; return <label className="text-xs font-semibold"><span>{label}</span><input disabled={disabled} value={controlled ? value : text} onChange={controlled ? onChange : (e) => setText(e.target.value)} className="mt-2 h-10 w-full rounded-md border border-[#dcd9eb] bg-white px-3 text-sm font-normal outline-none disabled:bg-[#faf9fd] disabled:text-[#aaa5bb] focus:border-[#7558ff]" /></label> }
function Select({ value }) { return <button type="button" className="flex h-9 min-w-24 items-center justify-between gap-3 rounded-md border border-[#dcd9eb] bg-white px-3 text-xs text-[#6e688e]">{value}<ChevronDown className="h-3 w-3" /></button> }
function Filter({ active, onClick, children }) { return <button type="button" onClick={onClick} className={`rounded px-2.5 py-1.5 text-[10px] font-bold uppercase ${active ? 'bg-[#e9e6ff] text-[#7558ff]' : 'text-[#8c86a9]'}`}>{children}</button> }
function Tag({ children, tone = 'violet' }) { return <span className={`inline-flex w-fit rounded px-2 py-1 text-[9px] font-bold uppercase ${tone === 'rose' ? 'bg-[#ffe5eb] text-[#e34c70]' : 'bg-[#ece9ff] text-[#7459d7]'}`}>{children}</span> }
function Score({ value }) { const color = value == null ? colors.unknown : value >= 80 ? colors.valid : colors.risky; return <span className="inline-flex min-w-8 justify-center rounded px-2 py-1 text-[10px] font-bold text-white" style={{ backgroundColor: color }}>{value ?? '-'}</span> }
function State({ state }) { const cfg = state === 'Deliverable' ? [CheckCircle2, colors.valid] : state === 'Risky' ? [CircleHelp, colors.risky] : state === 'Unknown' ? [CircleHelp, colors.unknown] : [XCircle, colors.invalid]; const Icon = cfg[0]; return <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: cfg[1] }}><Icon className="h-4 w-4" />{state}</span> }
function Summary({ label, value }) { return <div><p className="text-[11px] font-extrabold text-[#948dab]">{label}</p><p className="mt-1 truncate text-xl font-extrabold">{value}</p></div> }
function SummaryBox({ label, value }) { return <div className="p-5"><p className="text-[11px] font-extrabold text-[#948dab]">{label}</p><p className="mt-1 text-lg font-extrabold">{value}</p></div> }
function Metric({ label, value, dot }) { return <div className="p-5"><p className="flex items-center gap-2 text-[11px] font-extrabold text-[#918aa9]">{label}<span className="h-2 w-2 rounded-full" style={{ backgroundColor: dot }} /></p><p className="mt-2 text-2xl font-extrabold">{value}</p></div> }
function LegendRow({ color, percent, label, value }) { return <div className="grid grid-cols-[70px_1fr_50px] items-center gap-4 text-sm"><span className="rounded-full px-2 py-1 text-center text-xs font-bold text-white" style={{ backgroundColor: color }}>{percent}</span><span className="font-semibold">{label}</span><span className="text-right text-[#7f789f]">{value}</span></div> }
function Breakdown({ title, color, value, rows }) { return <Panel className="p-5"><h3 className="flex items-center gap-2 font-bold"><span className="grid h-5 w-5 place-items-center rounded-full text-xs text-white" style={{ backgroundColor: color }}>!</span>{title}</h3><div className="mx-auto my-6 grid h-32 w-32 place-items-center rounded-full" style={{ background: `conic-gradient(${color} 0 84%, ${color}55 84% 100%)` }}><div className="grid h-20 w-20 place-items-center rounded-full bg-white text-center"><span><strong className="text-xl">{value}</strong><small className="block text-xs text-[#8881a4]">{rows.reduce((sum, row) => sum + row[1], 0)}</small></span></div></div><div className="space-y-3">{rows.map(([label, count]) => <div key={label} className="flex justify-between text-xs"><span>{label}</span><span className="text-[#8e88a8]">{count}</span></div>)}</div></Panel> }
function BrandLogo({ dark = false, className = '' }) {
  const heroPreview = className === 'h-7 w-auto'
  const src = heroPreview
    ? '/images/logos/emailverify-hero-wordmark.png'
    : dark
      ? '/images/logos/emailverify-wordmark-dark.png'
      : '/images/logos/emailverify-wordmark.png'

  return <img src={src} alt="EmailVerify" className={heroPreview ? 'h-[23px] w-[100px] object-contain' : className} />
}
