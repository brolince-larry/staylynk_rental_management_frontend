import React from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { Building2 } from 'lucide-react'

const EFFECTIVE_DATE = 'July 15, 2026'

export default function PrivacyPolicy(): React.ReactElement {
  return (
    <>
      <Helmet>
        <title>Privacy Policy — StayLynk</title>
        <meta name="description" content="How StayLynk collects, uses, and protects your data." />
      </Helmet>

      <div className="min-h-dvh bg-background">
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
            <Link to="/" className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <span className="text-sm font-bold text-foreground">StayLynk</span>
            </Link>
            <nav className="flex items-center gap-4 text-xs">
              <Link to="/terms" className="text-muted-foreground hover:text-foreground">Terms of Service</Link>
              <Link to="/login" className="text-muted-foreground hover:text-foreground">Sign in</Link>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-6 py-12">
          <h1 className="text-2xl font-bold text-foreground">Privacy Policy</h1>
          <p className="mt-1 text-sm text-muted-foreground">Effective {EFFECTIVE_DATE}</p>

          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            This is a starting template, not a substitute for legal advice. Kenya&apos;s Data Protection Act, 2019
            imposes specific obligations (including registration with the Office of the Data Protection Commissioner
            for certain data controllers/processors) — have a lawyer confirm this policy and your registration status
            before relying on it.
          </div>

          <div className="mt-8 space-y-8 text-sm leading-relaxed text-foreground">
            <Section n="1" title="What this policy covers">
              <p>
                This Privacy Policy explains what personal data StayLynk collects, how it is used, who it is shared
                with, and the choices you have, when you use StayLynk as a property owner, manager, or tenant.
              </p>
            </Section>

            <Section n="2" title="Data we collect">
              <ul>
                <li><strong>Account data</strong> — name, email, phone number, password (stored hashed, never in plain text), role, and organisation.</li>
                <li><strong>Property &amp; tenancy data</strong> — property and room details, lease agreements, move-in/out dates, emergency contacts.</li>
                <li><strong>Financial data</strong> — invoices, payment records, and M-Pesa transaction references. StayLynk stores payment references and amounts, not your full card or mobile money PIN/credentials.</li>
                <li><strong>Communications</strong> — messages sent through the platform, maintenance requests, and support conversations, including with the AI assistant.</li>
                <li><strong>Technical data</strong> — IP address, device/browser information, and access logs, primarily for security (detecting brute-force login attempts and fraud) and troubleshooting.</li>
              </ul>
            </Section>

            <Section n="3" title="How we use your data">
              <ul>
                <li>To provide the core service: managing properties, leases, invoices, payments, and communications.</li>
                <li>To power the AI assistant's answers, which are grounded in your own account's data — the assistant does not answer using another organisation's data.</li>
                <li>To detect and prevent fraud, unauthorised access, and abuse, including brute-force login attempts and suspicious payment activity.</li>
                <li>To send transactional notifications (rent reminders, payment confirmations, maintenance updates) and, where you've agreed, product updates.</li>
                <li>To comply with legal obligations, including tax and financial record-keeping requirements.</li>
              </ul>
            </Section>

            <Section n="4" title="Who we share data with">
              <p>
                We do not sell your personal data. We share data only with:
              </p>
              <ul>
                <li>Payment processors (e.g. Safaricom M-Pesa/Daraja) to the extent needed to process a payment you initiate.</li>
                <li>Infrastructure providers (hosting, storage, email delivery) acting as processors under contract, bound to protect your data.</li>
                <li>Other users within your own organisation, and your property manager/tenant counterpart, as necessary for the service to function (e.g. a tenant's manager can see that tenant's lease and payments — not tenants of other properties).</li>
                <li>Authorities, where required by law or a valid legal request.</li>
              </ul>
            </Section>

            <Section n="5" title="Data security">
              <p>
                We apply role-based access control (admins, managers, and tenants each see only what their role
                permits), encrypt sensitive credentials at rest, log security-relevant activity for audit purposes,
                and monitor for brute-force login attempts and other suspicious behaviour. No system is completely
                immune to risk, and we encourage using a strong, unique password.
              </p>
            </Section>

            <Section n="6" title="Data retention">
              <p>
                We retain your data for as long as your account is active, and for a reasonable period afterward to
                meet legal, tax, and dispute-resolution obligations. You may request deletion of your account data,
                subject to records we are legally required to keep.
              </p>
            </Section>

            <Section n="7" title="Your rights">
              <p>Subject to Kenya's Data Protection Act, 2019, you have the right to:</p>
              <ul>
                <li>Access the personal data we hold about you.</li>
                <li>Request correction of inaccurate data.</li>
                <li>Request deletion of your data, where not otherwise required to be retained.</li>
                <li>Object to certain processing, and withdraw consent where processing is based on consent.</li>
              </ul>
              <p>To exercise these rights, contact the support address in your account settings.</p>
            </Section>

            <Section n="8" title="Cookies and similar technologies">
              <p>
                We use essential cookies/local storage to keep you signed in and remember your preferences. We do not
                use third-party advertising trackers.
              </p>
            </Section>

            <Section n="9" title="Changes to this policy">
              <p>
                We may update this Privacy Policy from time to time. Material changes will be communicated through
                the platform or by email before they take effect.
              </p>
            </Section>

            <Section n="10" title="Contact">
              <p>Questions about this policy or your data can be sent to the support contact listed in your account settings.</p>
            </Section>
          </div>
        </main>
      </div>
    </>
  )
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <section>
      <h2 className="text-base font-semibold text-foreground">
        <span className="mr-2 text-muted-foreground">{n}.</span>{title}
      </h2>
      <div className="mt-2 space-y-2 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_li]:text-muted-foreground [&_p]:text-muted-foreground">
        {children}
      </div>
    </section>
  )
}
