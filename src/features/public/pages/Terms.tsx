import React from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { Building2 } from 'lucide-react'

const EFFECTIVE_DATE = 'July 15, 2026'

export default function Terms(): React.ReactElement {
  return (
    <>
      <Helmet>
        <title>Terms of Service — StayLynk</title>
        <meta name="description" content="StayLynk's Terms of Service." />
      </Helmet>

      <div className="min-h-dvh bg-background">
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
            <Link to="/" className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <span className="text-sm font-bold text-foreground">StayLynk</span>
            </Link>
            <nav className="flex items-center gap-4 text-xs">
              <Link to="/privacy" className="text-muted-foreground hover:text-foreground">Privacy Policy</Link>
              <Link to="/login" className="text-muted-foreground hover:text-foreground">Sign in</Link>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-6 py-12">
          <h1 className="text-2xl font-bold text-foreground">Terms of Service</h1>
          <p className="mt-1 text-sm text-muted-foreground">Effective {EFFECTIVE_DATE}</p>

          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            This is a starting template, not a substitute for legal advice. Have a lawyer licensed in Kenya review and
            adapt it — particularly the payments, liability, and dispute-resolution sections — before relying on it.
          </div>

          <div className="prose-terms mt-8 space-y-8 text-sm leading-relaxed text-foreground">
            <Section n="1" title="Who this agreement is with">
              <p>
                These Terms of Service (&quot;Terms&quot;) govern access to and use of StayLynk (&quot;StayLynk&quot;,
                &quot;we&quot;, &quot;us&quot;), a property management platform. By creating an account, accepting an
                invitation, or otherwise using StayLynk, you (&quot;you&quot;, the &quot;User&quot;) agree to be bound
                by these Terms. If you are creating an account on behalf of an organisation, you confirm you have the
                authority to bind that organisation.
              </p>
            </Section>

            <Section n="2" title="The service">
              <p>
                StayLynk provides tools for property owners, managers, and tenants to manage properties, rooms,
                leases, invoices, rent collection (including via M-Pesa and other supported payment methods),
                maintenance requests, messaging, and related administrative functions, along with an AI assistant
                that answers questions using your account&apos;s own data.
              </p>
            </Section>

            <Section n="3" title="Accounts and eligibility">
              <ul>
                <li>You must provide accurate, current information when registering and keep it up to date.</li>
                <li>You are responsible for safeguarding your password and for all activity under your account.</li>
                <li>You must be legally capable of entering into a binding contract to create an account.</li>
                <li>Organisation administrators are responsible for the accounts they invite (managers, tenants) and for ensuring those users have agreed to these Terms.</li>
              </ul>
            </Section>

            <Section n="4" title="Payments and billing">
              <p>
                Subscription fees, billing cycles, and trial terms are as displayed at signup or in your account
                billing settings. Rent, deposits, and other payments collected through StayLynk (e.g. via M-Pesa)
                are processed by the relevant payment provider; StayLynk is not a bank and does not hold tenant
                funds on your behalf beyond what is required to route a payment to the property owner/manager.
              </p>
              <p>
                You are responsible for the accuracy of amounts, invoices, and charges you or your organisation
                create. Late fees, deposits, and refund policies between a property owner/manager and their tenants
                are set by that owner/manager, not by StayLynk.
              </p>
            </Section>

            <Section n="5" title="Acceptable use">
              <p>You agree not to:</p>
              <ul>
                <li>Use StayLynk for any unlawful purpose, or to facilitate fraud, harassment, or discrimination.</li>
                <li>Attempt to gain unauthorised access to any account, data, or system, including through brute-force login attempts, credential sharing to impersonate another user, or exploiting vulnerabilities.</li>
                <li>Upload malicious files, attempt to inject code, or interfere with the platform&apos;s normal operation.</li>
                <li>Scrape, resell, or redistribute data from the platform without authorisation.</li>
                <li>Misuse the AI assistant to attempt to extract other users&apos; data, credentials, or system internals.</li>
              </ul>
              <p>
                We monitor for suspicious activity (including repeated failed logins and unusual access patterns) and
                may suspend accounts or block IP addresses engaged in abuse.
              </p>
            </Section>

            <Section n="6" title="Content and data ownership">
              <p>
                You retain ownership of the property, tenant, financial, and other data you or your organisation
                enter into StayLynk (&quot;Your Data&quot;). You grant StayLynk a licence to host, process, and
                display Your Data solely to provide and improve the service, including to power the AI assistant's
                answers about your own account.
              </p>
            </Section>

            <Section n="7" title="Intellectual property">
              <p>
                The StayLynk name, logo, software, design, and all related intellectual property are owned by
                StayLynk and its licensors. Except for the limited right to use the platform as intended, no rights
                are granted to you. All content, trademarks, and materials on this platform not constituting Your
                Data are protected by copyright and other applicable laws, and all such rights are reserved.
              </p>
            </Section>

            <Section n="8" title="Termination">
              <p>
                You may stop using StayLynk and close your account at any time. We may suspend or terminate access
                for breach of these Terms, non-payment, or suspected fraudulent or abusive activity. On termination,
                we will retain Your Data for a reasonable period as described in the Privacy Policy, or as required
                by law, before deletion.
              </p>
            </Section>

            <Section n="9" title="Disclaimers and limitation of liability">
              <p>
                StayLynk is provided &quot;as is&quot;. We do not guarantee uninterrupted or error-free operation. To
                the maximum extent permitted by law, StayLynk is not liable for indirect, incidental, or
                consequential damages arising from use of the platform, including disputes between property
                owners/managers and tenants.
              </p>
            </Section>

            <Section n="10" title="Governing law">
              <p>
                These Terms are governed by the laws of the Republic of Kenya. Any dispute arising from these Terms
                or use of StayLynk will be subject to the exclusive jurisdiction of the courts of Kenya.
              </p>
            </Section>

            <Section n="11" title="Changes to these Terms">
              <p>
                We may update these Terms from time to time. Material changes will be communicated through the
                platform or by email before they take effect. Continued use after changes take effect constitutes
                acceptance of the updated Terms.
              </p>
            </Section>

            <Section n="12" title="Contact">
              <p>Questions about these Terms can be sent to the support contact listed in your account settings.</p>
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
