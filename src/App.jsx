import {
  ArrowRight, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleHelp,
  Code2, Copy, CreditCard, FileCheck2, Folder, Gauge, Globe2, Grid2X2, KeyRound,
  List, LockKeyhole, Mail, Menu, Plus, Search, Settings, ShieldCheck, Smartphone,
  Sparkles, Upload, User, Users, XCircle, Zap,
} from 'lucide-react'
import { useState } from 'react'

const colors = { valid: '#38c994', risky: '#ffc84d', invalid: '#ff6b86', unknown: '#55a9e9', duplicate: '#7558ff' }

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
  const [page, setPage] = useState('landing')
  const [detailTab, setDetailTab] = useState('overview')
  const [mobileNav, setMobileNav] = useState(false)
  const navigate = (next) => { setPage(next); setMobileNav(false) }
  const openList = () => { setPage('list'); setDetailTab('overview') }

  if (page === 'landing') return <LandingPage navigate={navigate} />
  if (page === 'login' || page === 'signup') return <AuthPage mode={page} navigate={navigate} />

  return (
    <div className="min-h-screen bg-[#f5f5ff] text-[#242145]">
      <TopNav page={page} navigate={navigate} open={mobileNav} setOpen={setMobileNav} />
      <div className="mx-auto flex w-full max-w-[1120px] gap-4 px-4 py-5">
        {page === 'list' && <ListSidebar active={detailTab} setActive={setDetailTab} onBack={() => navigate('bulk')} />}
        {page === 'profile' && <AccountSidebar active="profile" navigate={navigate} />}
        {page === 'billing' && <AccountSidebar active="billing" navigate={navigate} />}
        <main className="min-w-0 flex-1">
          {page === 'bulk' && <BulkListsPage onOpen={openList} />}
          {page === 'list' && <ListDetailPage tab={detailTab} setTab={setDetailTab} />}
          {page === 'single' && <SinglePage />}
          {page === 'api' && <ApiPage />}
          {page === 'credits' && <BuyCreditsPage />}
          {page === 'billing' && <BillingPage navigate={navigate} />}
          {page === 'profile' && <ProfilePage />}
        </main>
      </div>
    </div>
  )
}

function LandingPage({ navigate }) {
  const features = [
    [Upload, 'Bulk list cleaning', 'Upload CSV, TXT, or XLSX files and review every address by state, reason, and score.'],
    [Zap, 'Instant verification', 'Check one address in seconds before it enters a form, CRM, or campaign.'],
    [Code2, 'Developer-ready API', 'Use simple endpoints, private keys, webhooks, and batch callbacks in your own stack.'],
    [ShieldCheck, 'Actionable risk signals', 'See disposable, role, accept-all, mailbox, MX, and typo signals in one result.'],
  ]
  const plans = [
    ['Starter', '$0', '1,000 credits', ['Single and bulk verification', 'API access', 'CSV exports']],
    ['Growth', '$49', '25,000 credits', ['Everything in Starter', 'Team workspaces', 'Webhook events']],
    ['Scale', '$199', '150,000 credits', ['Everything in Growth', 'Priority processing', 'Advanced usage controls']],
  ]

  return (
    <div className="min-h-screen bg-white text-[#242145]">
      <header className="sticky top-0 z-40 border-b border-[#e9e7f3] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-5">
          <button type="button" className="flex items-center gap-2" onClick={() => navigate('landing')}><LogoMark /><span className="text-xl font-extrabold">emailverify</span></button>
          <nav className="hidden items-center gap-8 text-sm font-semibold text-[#625c7f] md:flex"><a href="#product">Product</a><a href="#how">How it works</a><a href="#pricing">Pricing</a><a href="#api">API</a></nav>
          <div className="flex items-center gap-2"><button type="button" onClick={() => navigate('login')} className="hidden h-10 px-4 text-sm font-bold text-[#5c5676] sm:block">Log in</button><Button onClick={() => navigate('signup')}>START FREE <ArrowRight className="h-4 w-4" /></Button></div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-[#17142d] px-5 pb-20 pt-20 text-white sm:pt-28">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(#ffffff14 1px, transparent 1px), linear-gradient(90deg, #ffffff14 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
          <div className="relative mx-auto max-w-[1100px] text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#8673ff]/50 bg-[#7558ff]/15 px-4 py-2 text-xs font-bold text-[#cbc3ff]"><Sparkles className="h-4 w-4 text-[#ffc84d]" /> CLEANER DATA. BETTER SENDS.</div>
            <h1 className="mx-auto mt-7 max-w-4xl text-5xl font-extrabold leading-[1.06] sm:text-7xl">Know which emails are safe before you send.</h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#c4bfd7]">Verify single addresses, clean entire lists, and protect every form with one calm, accurate verification workspace.</p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"><button type="button" onClick={() => navigate('signup')} className="inline-flex h-12 items-center gap-2 rounded-md bg-[#7558ff] px-6 text-sm font-bold text-white shadow-lg shadow-[#7558ff]/25 hover:bg-[#856cff]">START FREE <ArrowRight className="h-4 w-4" /></button><button type="button" onClick={() => navigate('login')} className="h-12 rounded-md border border-white/20 px-6 text-sm font-bold text-white hover:bg-white/5">VIEW THE APP</button></div>
            <p className="mt-4 text-xs text-[#8f89a8]">No credit card required. Includes 1,000 verification credits.</p>
            <HeroProductPreview />
          </div>
        </section>

        <section id="product" className="border-b border-[#eceaf4] bg-[#fafaff] px-5 py-24">
          <div className="mx-auto max-w-[1100px]"><SectionIntro eyebrow="ONE VERIFICATION WORKSPACE" title="Simple enough for campaigns. Powerful enough for products." copy="Clean a file in the browser, validate an address on demand, or automate the whole flow through your API." /><div className="mt-14 grid gap-px overflow-hidden rounded-lg border border-[#e5e3f0] bg-[#e5e3f0] md:grid-cols-2">{features.map(([Icon, title, copy]) => <div key={title} className="bg-white p-8"><span className="grid h-11 w-11 place-items-center rounded-md bg-[#eeeaff] text-[#7558ff]"><Icon className="h-5 w-5" /></span><h3 className="mt-5 text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-[#716b89]">{copy}</p></div>)}</div></div>
        </section>

        <section id="how" className="px-5 py-24"><div className="mx-auto max-w-[1100px]"><SectionIntro eyebrow="FROM UPLOAD TO ANSWER" title="A decision, not a data dump." copy="Every verification resolves into a state your team can understand, plus the technical signals developers need." /><div className="mt-14 grid gap-5 lg:grid-cols-3"><MethodCard number="01" icon={FileCheck2} title="Check the structure" copy="Normalize the address, validate syntax, and identify common domain typos." color="#7558ff" /><MethodCard number="02" icon={Globe2} title="Inspect the domain" copy="Resolve MX infrastructure and identify disposable, free, and accept-all providers." color="#38c994" /><MethodCard number="03" icon={ShieldCheck} title="Confirm the mailbox" copy="Run the mailbox check and return deliverable, risky, undeliverable, or unknown." color="#ff6b86" /></div></div></section>

        <section id="api" className="bg-[#f5f5ff] px-5 py-24"><div className="mx-auto grid max-w-[1100px] items-center gap-12 lg:grid-cols-2"><div><span className="text-xs font-bold text-[#7558ff]">BUILT FOR DEVELOPERS</span><h2 className="mt-3 text-4xl font-extrabold">A clean API your product can trust.</h2><p className="mt-5 text-base leading-7 text-[#716b89]">Use the same result model across sign-up forms, CRMs, lead routing, and batch operations. Private credentials stay on your server.</p><div className="mt-7 space-y-3">{['Real-time and batch endpoints', 'Webhooks and async callbacks', 'Test and production API keys'].map((item) => <p key={item} className="flex items-center gap-3 text-sm font-semibold"><CheckCircle2 className="h-5 w-5 text-[#38c994]" />{item}</p>)}</div></div><div className="overflow-hidden rounded-lg bg-[#211e38] shadow-2xl"><div className="flex gap-2 border-b border-white/10 px-5 py-4"><span className="h-2.5 w-2.5 rounded-full bg-[#ff6b86]" /><span className="h-2.5 w-2.5 rounded-full bg-[#ffc84d]" /><span className="h-2.5 w-2.5 rounded-full bg-[#38c994]" /></div><pre className="overflow-auto p-6 text-sm leading-7 text-[#d9d4f1]">{`POST /api/v1/verify
Authorization: Bearer ev_live_xxx

{
  "email": "hello@company.com",
  "smtp": true,
  "accept_all": false
}

200  { "state": "deliverable", "score": 98 }`}</pre></div></div></section>

        <section id="pricing" className="px-5 py-24"><div className="mx-auto max-w-[1100px]"><SectionIntro eyebrow="SIMPLE PRICING" title="Start clean. Scale when you need to." copy="One credit verifies one address. Pick a plan or add credits whenever volume changes." /><div className="mt-14 grid gap-5 lg:grid-cols-3">{plans.map(([name, price, volume, features], index) => <Panel key={name} className={`relative p-7 ${index === 1 ? 'border-2 border-[#7558ff]' : ''}`}>{index === 1 && <Tag>POPULAR</Tag>}<h3 className="mt-3 text-xl font-bold">{name}</h3><div className="mt-5"><strong className="text-4xl">{price}</strong><span className="text-sm text-[#817a99]"> / month</span></div><p className="mt-2 text-sm font-semibold text-[#7558ff]">{volume}</p><div className="my-6 h-px bg-[#eceaf4]" /><div className="space-y-3">{features.map((feature) => <p key={feature} className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-[#38c994]" />{feature}</p>)}</div><Button variant={index === 1 ? 'primary' : 'outline'} className="mt-7 w-full" onClick={() => navigate('signup')}>GET STARTED</Button></Panel>)}</div></div></section>

        <section className="bg-[#7558ff] px-5 py-20 text-white"><div className="mx-auto max-w-3xl text-center"><h2 className="text-4xl font-extrabold">Your next list deserves a cleaner start.</h2><p className="mt-4 text-[#ddd8ff]">Create a workspace and verify your first 1,000 addresses free.</p><button type="button" onClick={() => navigate('signup')} className="mt-8 inline-flex h-12 items-center gap-2 rounded-md bg-white px-6 text-sm font-bold text-[#5c3de2]">CREATE YOUR WORKSPACE <ArrowRight className="h-4 w-4" /></button></div></section>
      </main>
      <footer className="border-t border-[#eceaf4] px-5 py-8"><div className="mx-auto flex max-w-[1100px] flex-col items-center justify-between gap-4 text-xs text-[#817b98] sm:flex-row"><span className="flex items-center gap-2"><LogoMark /> EmailVerify</span><span>Privacy &nbsp; Terms &nbsp; API Documentation</span><span>© 2026 EmailVerify</span></div></footer>
    </div>
  )
}

function AuthPage({ mode, navigate }) {
  const signup = mode === 'signup'
  const submit = (event) => { event.preventDefault(); navigate('bulk') }
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[0.9fr_1.1fr]">
      <div className="flex flex-col justify-between bg-[#17142d] p-8 text-white lg:p-14"><button type="button" onClick={() => navigate('landing')} className="flex w-fit items-center gap-2"><LogoMark /><span className="text-xl font-extrabold">emailverify</span></button><div className="my-16 max-w-lg"><div className="grid h-12 w-12 place-items-center rounded-md bg-[#7558ff]"><ShieldCheck className="h-6 w-6" /></div><h1 className="mt-7 text-4xl font-extrabold leading-tight">Clean contacts belong in every workflow.</h1><p className="mt-4 leading-7 text-[#bcb7ce]">Verify lists, protect forms, and give your team one clear answer before every send.</p><div className="mt-8 space-y-4">{['1,000 free verification credits', 'Bulk, single, and API access', 'No credit card required'].map((item) => <p key={item} className="flex items-center gap-3 text-sm"><CheckCircle2 className="h-5 w-5 text-[#38c994]" />{item}</p>)}</div></div><p className="text-xs text-[#77718d]">Secure by design. Your verification credentials stay private.</p></div>
      <div className="flex items-center justify-center p-6 sm:p-12"><div className="w-full max-w-md"><p className="text-xs font-bold text-[#7558ff]">{signup ? 'CREATE YOUR WORKSPACE' : 'WELCOME BACK'}</p><h2 className="mt-3 text-3xl font-extrabold">{signup ? 'Start verifying for free' : 'Sign in to EmailVerify'}</h2><p className="mt-2 text-sm text-[#77718f]">{signup ? 'Already have an account?' : 'New to EmailVerify?'} <button type="button" onClick={() => navigate(signup ? 'login' : 'signup')} className="font-bold text-[#7558ff]">{signup ? 'Log in' : 'Create an account'}</button></p><form onSubmit={submit} className="mt-8 space-y-5">{signup && <div className="grid gap-4 sm:grid-cols-2"><AuthField label="First name" /><AuthField label="Last name" /></div>}<AuthField label="Work email" type="email" /><AuthField label="Password" type="password" />{signup && <AuthField label="Company name" />}<div className="flex items-center justify-between text-xs"><label className="flex items-center gap-2"><input type="checkbox" defaultChecked className="h-4 w-4 rounded border-[#d7d3e5] text-[#7558ff]" />{signup ? 'I agree to the terms' : 'Remember me'}</label>{!signup && <button type="button" className="font-bold text-[#7558ff]">Forgot password?</button>}</div><button type="submit" className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#7558ff] text-sm font-bold text-white hover:bg-[#6546f3]">{signup ? 'CREATE ACCOUNT' : 'SIGN IN'} <ArrowRight className="h-4 w-4" /></button></form><div className="my-7 flex items-center gap-3 text-xs text-[#9a94ae] before:h-px before:flex-1 before:bg-[#e7e4ef] after:h-px after:flex-1 after:bg-[#e7e4ef]">OR CONTINUE WITH</div><div className="grid grid-cols-2 gap-3"><button type="button" className="h-11 rounded-md border border-[#dedbe8] text-sm font-bold">Google</button><button type="button" className="h-11 rounded-md border border-[#dedbe8] text-sm font-bold">Microsoft</button></div></div></div>
    </div>
  )
}

function HeroProductPreview() {
  return <div className="mx-auto mt-16 max-w-[980px] rounded-xl border border-white/15 bg-[#f5f5ff] p-2 text-left shadow-2xl sm:p-4"><div className="overflow-hidden rounded-lg bg-white"><div className="flex h-12 items-center justify-between border-b border-[#eceaf4] px-4"><span className="flex items-center gap-2 text-sm font-extrabold text-[#242145]"><LogoMark /> emailverify</span><div className="flex gap-2"><span className="h-7 w-16 rounded bg-[#ede9ff]" /><span className="h-7 w-7 rounded-full bg-[#7558ff]" /></div></div><div className="grid min-h-[390px] sm:grid-cols-[150px_1fr]"><div className="hidden border-r border-[#eceaf4] bg-[#fafaff] p-4 sm:block">{['Overview', 'Emails', 'Exports', 'Settings'].map((item, i) => <div key={item} className={`mb-2 rounded px-3 py-2 text-xs font-semibold ${i === 0 ? 'bg-[#e9e5ff] text-[#7558ff]' : 'text-[#8b85a3]'}`}>{item}</div>)}</div><div className="p-5 sm:p-7"><div className="grid grid-cols-3 gap-3">{[['EMAILS', '12,480'], ['DELIVERABLE', '91.7%'], ['RISKY', '6.2%']].map(([label, value]) => <div key={label} className="rounded-md border border-[#e5e3ef] p-4"><span className="text-[9px] font-bold text-[#9d97b4]">{label}</span><strong className="mt-2 block text-lg text-[#242145] sm:text-2xl">{value}</strong></div>)}</div><div className="mt-4 grid gap-4 md:grid-cols-[0.8fr_1.2fr]"><div className="grid place-items-center rounded-md border border-[#e5e3ef] p-5"><Donut item={{ valid: 91.7, invalid: 1.1, risky: 6.2, unknown: 1 }} /><span className="-mt-4 text-xs font-bold text-[#6f6889]">SEPTEMBER LEADS</span></div><div className="rounded-md border border-[#e5e3ef] p-4"><div className="mb-3 text-xs font-bold text-[#5e5878]">Recent verifications</div>{[['sarah@northstar.io', 'Deliverable'], ['team@sample.co', 'Risky'], ['hello@company.com', 'Deliverable'], ['temp@maildrop.cc', 'Undeliverable']].map(([email, state]) => <div key={email} className="flex items-center justify-between border-t border-[#efedf5] py-3 text-xs"><span className="truncate text-[#665f80]">{email}</span><State state={state} /></div>)}</div></div></div></div></div></div>
}

function SectionIntro({ eyebrow, title, copy }) { return <div className="mx-auto max-w-2xl text-center"><p className="text-xs font-bold text-[#7558ff]">{eyebrow}</p><h2 className="mt-3 text-4xl font-extrabold leading-tight">{title}</h2><p className="mt-5 text-base leading-7 text-[#716b89]">{copy}</p></div> }
function MethodCard({ number, icon: Icon, title, copy, color }) { return <Panel className="p-7"><div className="flex items-center justify-between"><span className="grid h-11 w-11 place-items-center rounded-md text-white" style={{ backgroundColor: color }}><Icon className="h-5 w-5" /></span><span className="text-4xl font-extrabold text-[#efedf6]">{number}</span></div><h3 className="mt-6 text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-[#716b89]">{copy}</p></Panel> }
function AuthField({ label, type = 'text' }) { return <label className="block text-sm font-semibold"><span>{label}</span><input type={type} required className="mt-2 h-11 w-full rounded-md border border-[#dcd9e8] px-3 outline-none focus:border-[#7558ff] focus:ring-4 focus:ring-[#7558ff]/10" /></label> }

function TopNav({ page, navigate, open, setOpen }) {
  const items = [['bulk', 'Bulk', Grid2X2], ['single', 'Single', Mail], ['api', 'API', Code2]]
  return (
    <header className="sticky top-0 z-30 border-b border-[#e5e4f3] bg-white">
      <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between px-4">
        <button type="button" onClick={() => navigate('bulk')} className="flex items-center gap-2"><LogoMark /><span className="text-lg font-extrabold">emailverify</span></button>
        <button type="button" className="grid h-9 w-9 place-items-center rounded-md border border-[#e2e0f1] md:hidden" onClick={() => setOpen(!open)} aria-label="Toggle navigation"><Menu className="h-4 w-4" /></button>
        <nav className={`${open ? 'flex' : 'hidden'} absolute inset-x-0 top-14 flex-col gap-1 border-b border-[#e5e4f3] bg-white p-3 shadow-panel md:static md:flex md:flex-row md:items-center md:border-0 md:p-0 md:shadow-none`}>
          {items.map(([key, label, Icon]) => <NavButton key={key} active={page === key || (key === 'bulk' && page === 'list')} onClick={() => navigate(key)} icon={Icon}>{label}</NavButton>)}
          <button type="button" onClick={() => navigate('credits')} className="h-8 rounded-md bg-[#f0edff] px-4 text-xs font-bold text-[#7051ff]">BUY CREDITS</button>
          <button type="button" onClick={() => navigate('profile')} className="ml-1 flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#7558ff] text-xs font-bold text-white">BB</span><ChevronDown className="h-4 w-4 text-[#8d87b1]" /></button>
        </nav>
      </div>
    </header>
  )
}

function NavButton({ active, onClick, icon: Icon, children }) {
  return <button type="button" onClick={onClick} className={`flex h-9 items-center gap-2 rounded-md px-3 text-xs font-semibold ${active ? 'bg-[#ece9ff] text-[#4f31c7]' : 'text-[#5e587f] hover:bg-[#f7f6ff]'}`}><span className={`grid h-5 w-5 place-items-center rounded-full ${active ? 'bg-[#7558ff] text-white' : 'bg-[#ebe8f8] text-[#796ed1]'}`}><Icon className="h-3 w-3" /></span>{children}</button>
}

function BulkListsPage({ onOpen }) {
  const [view, setView] = useState('grid')
  return (
    <div className="mx-auto max-w-[900px]">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Button icon={Plus}>NEW LIST</Button>
        <label className="relative min-w-[240px] flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-[#aaa5c6]" /><input className="h-10 w-full rounded-md border border-[#dedced] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#8b73ff]" placeholder="Type something to search" /></label>
        <IconButton active={view === 'list'} onClick={() => setView('list')} icon={List} label="List view" />
        <IconButton active={view === 'grid'} onClick={() => setView('grid')} icon={Grid2X2} label="Grid view" />
      </div>
      <div className={view === 'grid' ? 'grid gap-5 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-3'}>{lists.map((item) => view === 'grid' ? <ListCard key={item.name} item={item} onOpen={onOpen} /> : <ListRow key={item.name} item={item} onOpen={onOpen} />)}</div>
    </div>
  )
}

function ListCard({ item, onOpen }) {
  return <Panel className="p-5 text-center"><h2 className="truncate text-sm font-bold">{item.name}</h2><p className="mt-1 flex items-center justify-center gap-1 text-xs text-[#8e88ad]"><Folder className="h-3 w-3 text-[#7558ff]" /> My Computer</p><Donut item={item} /><Button className="w-full" onClick={onOpen}>VIEW RESULTS <ChevronRight className="h-3.5 w-3.5" /></Button></Panel>
}

function ListRow({ item, onOpen }) {
  return <Panel className="flex items-center gap-4 p-4"><Donut item={item} small /><div className="min-w-0 flex-1"><h2 className="truncate text-sm font-bold">{item.name}</h2><p className="mt-1 text-xs text-[#8e88ad]">{item.count.toLocaleString()} emails</p></div><Button variant="outline" onClick={onOpen}>View</Button></Panel>
}

function Donut({ item, small = false }) {
  const duplicate = Math.max(0, 100 - item.valid - item.risky - item.invalid - item.unknown)
  const a = item.valid, b = a + item.invalid, c = b + item.risky, d = c + item.unknown
  const background = `conic-gradient(${colors.valid} 0 ${a}%, ${colors.invalid} ${a}% ${b}%, ${colors.risky} ${b}% ${c}%, ${colors.unknown} ${c}% ${d}%, ${colors.duplicate} ${d}% ${d + duplicate}%)`
  return <div className={`relative grid shrink-0 place-items-center rounded-full ${small ? 'h-14 w-14' : 'mx-auto my-6 h-40 w-40'}`} style={{ background }}><div className={`${small ? 'h-9 w-9' : 'h-28 w-28'} grid place-items-center rounded-full bg-white text-center`}><span><strong className={small ? 'text-xs' : 'text-2xl'}>{item.valid}%</strong>{!small && <small className="block text-xs text-[#8e88ad]">Deliverable</small>}</span></div></div>
}

function ListSidebar({ active, setActive, onBack }) {
  const links = [['overview', 'Overview', Gauge], ['emails', 'Emails', Mail], ['exports', 'Exports', Upload], ['settings', 'Settings', Settings]]
  return <aside className="hidden w-[170px] shrink-0 md:block"><button type="button" onClick={onBack} className="mb-3 flex items-center gap-2 px-3 text-xs font-semibold text-[#817aa8]"><ChevronLeft className="h-3 w-3" /> All lists</button>{links.map(([key, label, Icon]) => <SideLink key={key} active={active === key} icon={Icon} onClick={() => setActive(key)}>{label}</SideLink>)}</aside>
}

function ListDetailPage({ tab, setTab }) {
  return <div className="space-y-4"><ListSummary /><div className="flex gap-2 overflow-x-auto md:hidden">{['overview', 'emails', 'exports', 'settings'].map((key) => <button key={key} onClick={() => setTab(key)} className={`rounded-md px-3 py-2 text-xs font-bold capitalize ${tab === key ? 'bg-[#7558ff] text-white' : 'bg-white text-[#6d668d]'}`}>{key}</button>)}</div>{tab === 'overview' && <ListOverview />}{tab === 'emails' && <EmailResults />}{tab === 'exports' && <Exports />}{tab === 'settings' && <ListSettings />}</div>
}

function ListSummary() { return <Panel className="grid gap-5 p-6 sm:grid-cols-[2fr_0.8fr_0.9fr]"><Summary label="NAME" value="MASTER_AUCTION_LEAD_LIST" /><Summary label="EMAILS" value="748" /><Summary label="UPLOADED" value="9/9/2026" /></Panel> }

function ListOverview() {
  return <><Panel className="grid items-center gap-8 p-8 lg:grid-cols-[1.1fr_0.9fr]"><Donut item={lists[0]} /><div className="space-y-5"><LegendRow color={colors.valid} percent="26.5%" label="Deliverable" value="198" /><LegendRow color={colors.invalid} percent="2.1%" label="Undeliverable" value="16" /><LegendRow color={colors.risky} percent="29.3%" label="Risky" value="219" /><LegendRow color={colors.unknown} percent="2.8%" label="Unknown" value="21" /><LegendRow color={colors.duplicate} percent="39.3%" label="Duplicate" value="294" /></div></Panel><div className="mt-4 grid gap-4 lg:grid-cols-3"><Breakdown title="Undeliverable" color={colors.invalid} value="2.1%" rows={[['Invalid email', 0], ['Invalid domain', 2], ['Rejected email', 13], ['Invalid SMTP', 1]]} /><Breakdown title="Risky" color={colors.risky} value="29.3%" rows={[['Low quality', 68], ['Low deliverability', 151]]} /><Breakdown title="Unknown" color={colors.unknown} value="2.8%" rows={[['No connect', 0], ['Timeout', 0], ['Unavailable SMTP', 1], ['Unexpected error', 20]]} /></div></>
}

function EmailResults() {
  const [filter, setFilter] = useState('All')
  const filtered = filter === 'All' ? emails : emails.filter((row) => row[3] === filter)
  return <Panel className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7e5f3] px-5 py-4"><h2 className="font-bold">Emails</h2><div className="flex flex-wrap gap-1">{['All', 'Deliverable', 'Risky', 'Unknown'].map((item) => <Filter key={item} active={filter === item} onClick={() => setFilter(item)}>{item}</Filter>)}</div></div><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-xs"><thead className="bg-[#faf9ff] text-[#706a91]"><tr><th className="px-5 py-3">Email</th><th className="px-5 py-3">Reason</th><th className="px-5 py-3">Score</th><th className="px-5 py-3">State</th></tr></thead><tbody>{filtered.map(([email, reason, score, state]) => <tr key={email} className="border-t border-[#eeecf6]"><td className="px-5 py-3 text-[#645e87]">{email}</td><td className="px-5 py-3"><Tag>{reason.replaceAll('_', ' ')}</Tag></td><td className="px-5 py-3"><Score value={score} /></td><td className="px-5 py-3"><State state={state} /></td></tr>)}</tbody></table></div></Panel>
}

function Exports() { return <Panel><PanelHeader title="Exports" action={<Button>NEW EXPORT</Button>} /><div className="grid grid-cols-[1fr_140px_100px] bg-[#faf9ff] px-5 py-3 text-xs font-bold"><span>Name</span><span>Created</span><span /></div><div className="grid grid-cols-[1fr_140px_100px] items-center border-t border-[#eceaf5] px-5 py-4 text-xs"><span>Maximum Reach</span><span>9/9/2026</span><Tag tone="rose">EXPIRED</Tag></div></Panel> }
function ListSettings() { return <Panel><PanelHeader title="General" /><div className="p-5"><Field label="Name" value="MASTER_AUCTION_LEAD_LIST" /></div><div className="flex justify-between border-t border-[#e7e5f3] p-5"><Button variant="outline">DELETE</Button><Button>SAVE</Button></div></Panel> }

function SinglePage() {
  const [email, setEmail] = useState('prospect@northstar.io')
  const [verified, setVerified] = useState(true)
  return <div className="mx-auto max-w-[760px] space-y-4"><Panel><PanelHeader title="Single Verification" subtitle="Check one address instantly." /><div className="flex flex-col gap-3 p-6 sm:flex-row"><input value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 flex-1 rounded-md border border-[#dedced] px-4 text-sm outline-none focus:border-[#7c61ff]" /><Button onClick={() => setVerified(true)} icon={ShieldCheck}>VERIFY EMAIL</Button></div></Panel>{verified && <Panel className="p-6"><div className="flex flex-col gap-6 sm:flex-row sm:items-center"><div className="grid h-24 w-24 shrink-0 place-items-center rounded-full border-[9px] border-[#38c994] text-2xl font-bold">98</div><div><div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-[#38c994]" /><h2 className="text-xl font-bold">Deliverable</h2></div><p className="mt-2 text-sm text-[#777092]">This mailbox accepted our verification and is safe to send.</p><div className="mt-4 flex flex-wrap gap-2"><Tag>accepted email</Tag><Tag>smtp verified</Tag><Tag>not disposable</Tag><Tag>not role based</Tag></div></div></div></Panel>}</div>
}

function ApiPage() {
  const apiKeys = [['Production', 'ev_live_667822ebe6ea...49ffbc', 'LIVE', 'PRIVATE', 'Sep 12'], ['Website test', 'ev_test_437c9bb8998f...aab123', 'TEST', 'PRIVATE', 'Sep 10'], ['CRM sync', 'ev_live_ce8de739e9ac...2fe7a', 'LIVE', 'PRIVATE', 'Aug 28']]
  return <div className="space-y-4"><Panel><PanelHeader title="API Usage" action={<div className="flex gap-2"><Select value="All Usage" /><Select value="Monthly" /></div>} /><div className="grid grid-cols-2 divide-x divide-[#e6e4f1] border-b border-[#e6e4f1] md:grid-cols-5"><Metric label="VERIFICATIONS" value="23.9K" dot="#655b9d" /><Metric label="DELIVERABLE" value="9.48K" dot={colors.valid} /><Metric label="RISKY" value="10.3K" dot={colors.risky} /><Metric label="UNDELIVERABLE" value="3.94K" dot={colors.invalid} /><Metric label="UNKNOWN" value="238" dot={colors.unknown} /></div><UsageChart /></Panel><Panel className="overflow-hidden"><PanelHeader title="API Keys" action={<Button icon={Plus}>NEW KEY</Button>} /><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead className="bg-[#faf9ff]"><tr>{['Name', 'Key', 'Type', 'Security', 'Created', ''].map((h) => <th key={h} className="px-5 py-3">{h}</th>)}</tr></thead><tbody>{apiKeys.map((row) => <tr key={row[0]} className="border-t border-[#eceaf5]">{row.map((cell, i) => <td key={i} className="px-5 py-3">{i === 2 || i === 3 ? <Tag>{cell}</Tag> : cell}</td>)}<td className="px-5 py-3"><Button variant="outline">MANAGE</Button></td></tr>)}</tbody></table></div></Panel><Panel><PanelHeader title="API Overview" action={<Button>FULL DOCUMENTATION</Button>} /><div className="p-5"><h3 className="text-sm font-bold">Verify</h3><p className="mt-1 text-xs text-[#777092]">Verify if the given email address is deliverable.</p><div className="mt-4 flex items-center justify-between rounded-md bg-[#24213d] px-4 py-3 font-mono text-xs text-white"><span className="truncate">https://api.emailverify.app/v1/verify?email=name@example.com</span><Copy className="ml-4 h-4 w-4 shrink-0" /></div></div></Panel></div>
}

function UsageChart() {
  const bars = [2, 28, 82, 4, 1, 3, 2, 1]
  return <div className="h-72 p-6"><div className="flex h-full items-end gap-4 border-b border-l border-[#dddbea] px-5">{bars.map((height, i) => <div key={i} className="flex h-full flex-1 flex-col justify-end"><div className="bg-[#ff6b86]" style={{ height: `${height * .2}px` }} /><div className="bg-[#ffc84d]" style={{ height: `${height * 1.1}px` }} /><div className="bg-[#38c994]" style={{ height: `${height * 1.3}px` }} /><span className="mt-3 text-center text-xs text-[#8d87ad]">{['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'][i]}</span></div>)}</div></div>
}

function BuyCreditsPage() {
  const packages = [5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000]
  const [amount, setAmount] = useState(25000)
  const price = Math.round(amount * 0.00564)
  return <Panel className="mx-auto max-w-[900px] overflow-hidden"><PanelHeader title="Buy Credits" /><div className="grid lg:grid-cols-[1.5fr_0.8fr]"><div className="border-b border-[#e7e5f3] p-6 lg:border-b-0 lg:border-r"><p className="text-center text-xs font-bold text-[#9a94ba]">CHOOSE A PACKAGE</p><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{packages.map((value) => <button key={value} onClick={() => setAmount(value)} className={`relative h-24 rounded-md border text-center ${amount === value ? 'border-2 border-[#7558ff] bg-[#f2f0ff]' : 'border-[#dddbea] bg-white'}`}><strong className="block text-lg">{value.toLocaleString()}</strong><small className="text-[#8e88aa]">Credits</small>{amount === value && <Check className="absolute right-2 top-2 h-5 w-5 rounded-full bg-[#38c994] p-1 text-white" />}</button>)}</div><div className="my-6 flex items-center gap-3 text-xs font-bold text-[#a09abc] before:h-px before:flex-1 before:bg-[#e5e3f0] after:h-px after:flex-1 after:bg-[#e5e3f0]">OR ENTER AN AMOUNT</div><input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="mx-auto block h-10 w-64 rounded-md border border-[#dcd9eb] text-center outline-none focus:border-[#7558ff]" /></div><div className="flex flex-col justify-between p-6 text-center"><div><p className="text-xs font-bold text-[#7558ff]">PAY-AS-YOU-GO</p><div className="mt-8 text-4xl font-extrabold">${price}</div><p className="mt-8 text-xs text-[#9993b7]">COST PER CREDIT</p><strong className="text-sm">$0.00564</strong></div><div className="mt-12 space-y-3 text-xs"><div className="flex justify-between"><span>{amount.toLocaleString()} credits</span><span>${price}.00</span></div><div className="flex justify-between border-t border-[#e5e3ef] pt-3 font-bold"><span>Total</span><span>${price}.00</span></div></div></div></div><div className="flex justify-end border-t border-[#e7e5f3] p-4"><Button>NEXT</Button></div></Panel>
}

function AccountSidebar({ active, navigate }) {
  return <aside className="hidden w-[170px] shrink-0 md:block"><SideLink active={active === 'profile'} icon={User} onClick={() => navigate('profile')}>Profile</SideLink><SideLink icon={Users}>Account</SideLink><SideLink icon={Grid2X2}>Integrations</SideLink><SideLink active={active === 'billing'} icon={CreditCard} onClick={() => navigate('billing')}>Billing</SideLink><SideLink icon={Code2} onClick={() => navigate('api')}>Developer</SideLink></aside>
}

function BillingPage({ navigate }) {
  return <div className="space-y-4"><Panel className="grid grid-cols-3 divide-x divide-[#e5e3f0]"><SummaryBox label="CREDIT BALANCE" value="184,223" /><SummaryBox label="CREDITS LAST ADDED" value="Sep 1" /><SummaryBox label="TIME UNTIL DEPLETION" value="about 3 months" /></Panel><Panel><PanelHeader title="Credit Usage" action={<div className="flex gap-2"><Select value="All" /><Select value="Monthly" /></div>} /><div className="grid grid-cols-2 divide-x divide-[#e5e3f0] border-b border-[#e5e3f0] md:grid-cols-4"><Metric label="BULK" value="274K" dot="#7558ff" /><Metric label="SINGLE" value="7" dot="#d86bff" /><Metric label="API" value="23.8K" dot="#38227c" /><Metric label="OTHER" value="0" dot="#a9a4cd" /></div><CreditChart /></Panel><Panel><PanelHeader title="Auto-Refill" action={<Tag>INACTIVE</Tag>} /><div className="grid gap-4 p-5 sm:grid-cols-2"><Field label="When balance drops below" value="500" /><Field label="Automatically purchase" value="10,000" /></div><div className="flex justify-between border-t border-[#e5e3f0] p-5"><Button variant="outline" onClick={() => navigate('credits')}>ADD PAYMENT METHOD</Button><Button>ENABLE AUTO-REFILL</Button></div></Panel></div>
}

function CreditChart() {
  const bars = [22, 7, 92, 27, 38, 47, 10, 21, 40]
  return <div className="flex h-72 items-end gap-3 px-8 pb-8 pt-6">{bars.map((height, i) => <div key={i} className="flex h-full flex-1 flex-col justify-end"><div className="rounded-t bg-[#7558ff]" style={{ height: `${height * 2}px` }} /><span className="mt-2 text-center text-xs text-[#938caf]">{i === 0 ? '2026' : ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'][i - 1]}</span></div>)}</div>
}

function ProfilePage() {
  return <div className="space-y-4"><Panel><PanelHeader title="Profile" /><div className="grid gap-4 p-5 sm:grid-cols-2"><Field label="First Name" value="Blake" /><Field label="Last Name" value="Bridge" /><Field label="Email" value="blake@example.com" disabled /><Field label="Phone Number" value="(720) 555-3447" /></div><div className="flex justify-end border-t border-[#e7e5f3] p-4"><Button>SAVE</Button></div></Panel><Panel><PanelHeader title="2-Step Verification" /><SecurityRow icon={Smartphone} title="Mobile Phone" description="Verification codes are sent by text message." action="DISABLE" /><SecurityRow icon={Grid2X2} title="Authenticator App" description="Verification codes are generated by an application." action="SET UP" /><SecurityRow icon={KeyRound} title="Backup Codes" description="Single use backup codes in case you lose access." action="REGENERATE" /></Panel><Panel><PanelHeader title="Notifications" /><div className="grid gap-4 p-5 sm:grid-cols-2"><NotificationGroup title="Account" icon={User} items={['Auto-Refill', 'Low Credits', 'No Credits']} /><NotificationGroup title="Bulk" icon={Grid2X2} items={['Imported', 'Verified', 'Deletion']} /></div><div className="flex justify-end border-t border-[#e7e5f3] p-4"><Button>SAVE</Button></div></Panel></div>
}

function NotificationGroup({ title, icon: Icon, items }) {
  return <div className="rounded-md border border-[#e2e0ee] p-4"><div className="flex items-center gap-2 border-b border-[#e8e6f2] pb-3 text-sm font-bold"><Icon className="h-4 w-4 text-[#7558ff]" />{title}</div><div className="mt-3 space-y-4">{items.map((item) => <label key={item} className="flex items-center gap-3 text-xs font-semibold"><input type="checkbox" defaultChecked className="peer sr-only" /><span className="relative h-5 w-9 rounded-full bg-[#cbc7dc] peer-checked:bg-[#38c994] after:absolute after:left-1 after:top-1 after:h-3 after:w-3 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4" />{item}</label>)}</div></div>
}

function SecurityRow({ icon: Icon, title, description, action }) {
  return <div className="flex items-center gap-4 border-t border-[#eceaf4] px-5 py-4 first:border-t-0"><Icon className="h-5 w-5 text-[#7558ff]" /><div className="min-w-0 flex-1"><p className="text-sm font-bold">{title}</p><p className="mt-1 text-xs text-[#7f789e]">{description}</p></div><Button variant="outline">{action}</Button></div>
}

function SideLink({ active, icon: Icon, onClick, children }) { return <button type="button" onClick={onClick} className={`mb-1 flex h-9 w-full items-center gap-3 rounded-md px-3 text-xs font-semibold ${active ? 'bg-[#e7e4fb] text-[#6848f3]' : 'text-[#6f6992] hover:bg-[#efedfb]'}`}><Icon className="h-4 w-4" />{children}</button> }
function Panel({ children, className = '' }) { return <section className={`rounded-md border border-[#e5e3f0] bg-white shadow-panel ${className}`}>{children}</section> }
function PanelHeader({ title, subtitle, action }) { return <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7e5f3] px-5 py-4"><div><h2 className="text-base font-bold">{title}</h2>{subtitle && <p className="mt-1 text-xs text-[#847e9f]">{subtitle}</p>}</div>{action}</div> }
function Button({ children, icon: Icon, variant = 'primary', className = '', onClick }) { return <button type="button" onClick={onClick} className={`inline-flex h-9 items-center justify-center gap-2 rounded-md border px-4 text-xs font-bold transition ${variant === 'primary' ? 'border-[#7558ff] bg-[#7558ff] text-white hover:bg-[#6546f3]' : 'border-[#dcd9eb] bg-white text-[#746d98] hover:bg-[#f7f6fc]'} ${className}`}>{Icon && <Icon className="h-4 w-4" />}{children}</button> }
function IconButton({ icon: Icon, label, active, onClick }) { return <button type="button" onClick={onClick} title={label} className={`grid h-10 w-10 place-items-center rounded-md ${active ? 'bg-[#e7e4fb] text-[#7558ff]' : 'text-[#9a94b6] hover:bg-white'}`}><Icon className="h-5 w-5" /></button> }
function Field({ label, value, disabled }) { const [text, setText] = useState(value); return <label className="text-xs font-semibold"><span>{label}</span><input disabled={disabled} value={text} onChange={(e) => setText(e.target.value)} className="mt-2 h-10 w-full rounded-md border border-[#dcd9eb] bg-white px-3 text-sm font-normal outline-none disabled:bg-[#faf9fd] disabled:text-[#aaa5bb] focus:border-[#7558ff]" /></label> }
function Select({ value }) { return <button type="button" className="flex h-9 min-w-24 items-center justify-between gap-3 rounded-md border border-[#dcd9eb] bg-white px-3 text-xs text-[#6e688e]">{value}<ChevronDown className="h-3 w-3" /></button> }
function Filter({ active, onClick, children }) { return <button type="button" onClick={onClick} className={`rounded px-2.5 py-1.5 text-[10px] font-bold uppercase ${active ? 'bg-[#e9e6ff] text-[#7558ff]' : 'text-[#8c86a9]'}`}>{children}</button> }
function Tag({ children, tone = 'violet' }) { return <span className={`inline-flex w-fit rounded px-2 py-1 text-[9px] font-bold uppercase ${tone === 'rose' ? 'bg-[#ffe5eb] text-[#e34c70]' : 'bg-[#ece9ff] text-[#7459d7]'}`}>{children}</span> }
function Score({ value }) { const color = value == null ? colors.unknown : value >= 80 ? colors.valid : colors.risky; return <span className="inline-flex min-w-8 justify-center rounded px-2 py-1 text-[10px] font-bold text-white" style={{ backgroundColor: color }}>{value ?? '-'}</span> }
function State({ state }) { const cfg = state === 'Deliverable' ? [CheckCircle2, colors.valid] : state === 'Risky' ? [CircleHelp, colors.risky] : state === 'Unknown' ? [CircleHelp, colors.unknown] : [XCircle, colors.invalid]; const Icon = cfg[0]; return <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: cfg[1] }}><Icon className="h-4 w-4" />{state}</span> }
function Summary({ label, value }) { return <div><p className="text-[10px] font-bold text-[#a19bbb]">{label}</p><p className="mt-1 truncate text-lg font-bold">{value}</p></div> }
function SummaryBox({ label, value }) { return <div className="p-5"><p className="text-[10px] font-bold text-[#9e98b9]">{label}</p><p className="mt-1 text-base font-bold">{value}</p></div> }
function Metric({ label, value, dot }) { return <div className="p-5"><p className="flex items-center gap-2 text-[10px] font-bold text-[#9b95b7]">{label}<span className="h-2 w-2 rounded-full" style={{ backgroundColor: dot }} /></p><p className="mt-2 text-xl font-bold">{value}</p></div> }
function LegendRow({ color, percent, label, value }) { return <div className="grid grid-cols-[70px_1fr_50px] items-center gap-4 text-sm"><span className="rounded-full px-2 py-1 text-center text-xs font-bold text-white" style={{ backgroundColor: color }}>{percent}</span><span className="font-semibold">{label}</span><span className="text-right text-[#7f789f]">{value}</span></div> }
function Breakdown({ title, color, value, rows }) { return <Panel className="p-5"><h3 className="flex items-center gap-2 font-bold"><span className="grid h-5 w-5 place-items-center rounded-full text-xs text-white" style={{ backgroundColor: color }}>!</span>{title}</h3><div className="mx-auto my-6 grid h-32 w-32 place-items-center rounded-full" style={{ background: `conic-gradient(${color} 0 84%, ${color}55 84% 100%)` }}><div className="grid h-20 w-20 place-items-center rounded-full bg-white text-center"><span><strong className="text-xl">{value}</strong><small className="block text-xs text-[#8881a4]">{rows.reduce((sum, row) => sum + row[1], 0)}</small></span></div></div><div className="space-y-3">{rows.map(([label, count]) => <div key={label} className="flex justify-between text-xs"><span>{label}</span><span className="text-[#8e88a8]">{count}</span></div>)}</div></Panel> }
function LogoMark() { return <span className="relative grid h-8 w-8 place-items-center rounded-full border-[3px] border-[#7558ff]"><span className="h-3 w-3 rounded-full border-[3px] border-[#38c994]" /><span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-[#ffc84d]" /></span> }
