import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-[#111111] text-white/80 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/60 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <h1 className="text-2xl font-bold text-white mb-2">Terms of Service</h1>
        <p className="text-sm text-white/30 mb-8">Last updated: September 18, 2026</p>

        <div className="space-y-6 text-sm leading-relaxed text-white/60">
          <section>
            <h2 className="text-base font-semibold text-white/80 mb-2">1. Acceptance of Terms</h2>
            <p>
              By accessing or using LineCatch, you agree to be bound by these Terms of Service. If you do not agree, do not use the service. LineCatch is a software platform that sends automated SMS messages on behalf of businesses when phone calls are missed.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white/80 mb-2">2. Service Description</h2>
            <p>LineCatch provides:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Automated missed-call text messaging for businesses.</li>
              <li>Call forwarding and status tracking.</li>
              <li>SMS opt-in/opt-out management.</li>
              <li>Booking link distribution and click tracking.</li>
              <li>Analytics dashboard for business owners.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white/80 mb-2">3. Business Owner Responsibilities</h2>
            <p>As a business owner using LineCatch, you agree to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Comply with all applicable laws regarding SMS communications, including the Telephone Consumer Protection Act (TCPA) and CAN-SPAM Act.</li>
              <li>Only send messages to individuals who have a reasonable expectation of receiving communication from your business (i.e., people who called you).</li>
              <li>Honor all opt-out requests promptly.</li>
              <li>Not use the service to send spam, fraudulent, or misleading messages.</li>
              <li>Maintain accurate business information in your account settings.</li>
              <li>Register your messaging campaign for A2P 10DLC compliance as required by carriers.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white/80 mb-2">4. SMS Consent (Customers)</h2>
            <p>
              By calling a LineCatch-enabled phone number or opting in through a VIP sign-up form, you consent to receive automated SMS messages from the associated business. This consent is not a condition of any purchase.
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Message frequency varies based on your interactions.</li>
              <li>Message and data rates may apply.</li>
              <li>Reply <strong className="text-white/70">STOP</strong> to cancel at any time.</li>
              <li>Reply <strong className="text-white/70">HELP</strong> for assistance.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white/80 mb-2">5. Prohibited Uses</h2>
            <p>You may not use LineCatch to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Send unsolicited bulk messages or spam.</li>
              <li>Harass, threaten, or send abusive content.</li>
              <li>Engage in any illegal activity.</li>
              <li>Impersonate another person or business.</li>
              <li>Circumvent opt-out mechanisms or contact individuals who have unsubscribed.</li>
              <li>Resell or redistribute the service without authorization.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white/80 mb-2">6. Limitation of Liability</h2>
            <p>
              LineCatch is provided &quot;as is&quot; without warranties of any kind. We are not liable for any missed messages, delivery failures, carrier filtering, or damages arising from the use of our service. Our total liability shall not exceed the amount you paid for the service in the preceding 12 months.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white/80 mb-2">7. Account Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account if you violate these terms, engage in abusive messaging practices, or if your messaging campaigns are flagged by carriers. You may cancel your account at any time by contacting support.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white/80 mb-2">8. Changes to Terms</h2>
            <p>
              We may update these terms from time to time. Continued use of LineCatch after changes constitutes acceptance of the updated terms. We will notify registered users of material changes via email.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white/80 mb-2">9. Contact</h2>
            <p>
              Questions about these Terms? Contact us at{" "}
              <a href="mailto:caindamare6@gmail.com" className="text-[#00F5A0] hover:underline">
                caindamare6@gmail.com
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
