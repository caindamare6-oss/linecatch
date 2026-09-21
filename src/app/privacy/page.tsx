import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function PrivacyPolicy() {
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

        <h1 className="text-2xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-sm text-white/30 mb-8">Last updated: September 18, 2026</p>

        <div className="space-y-6 text-sm leading-relaxed text-white/60">
          <section>
            <h2 className="text-base font-semibold text-white/80 mb-2">1. Information We Collect</h2>
            <p>
              When you use LineCatch, we collect the following information:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong className="text-white/70">Business owners (barbers):</strong> Email address, phone number, business name, booking link, business hours, and messaging preferences.</li>
              <li><strong className="text-white/70">Customers:</strong> Phone numbers from incoming calls, SMS opt-in consent, and interaction data (call timestamps, message delivery status, link clicks).</li>
              <li><strong className="text-white/70">VIP opt-in subscribers:</strong> Phone number and consent confirmation provided through our opt-in form.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white/80 mb-2">2. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To send automated SMS messages on behalf of business owners when calls are missed.</li>
              <li>To process opt-out and opt-in requests for SMS communications.</li>
              <li>To provide business owners with analytics and reporting on missed calls and message delivery.</li>
              <li>To send follow-up messages and promotional texts to customers who have opted in.</li>
              <li>To improve and maintain the LineCatch service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white/80 mb-2">3. SMS Messaging</h2>
            <p>
              LineCatch sends SMS messages through Twilio on behalf of business owners. By opting in to receive messages (via the VIP sign-up form or by calling a LineCatch-enabled number), you consent to receive:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Missed call auto-reply texts with booking information.</li>
              <li>Follow-up appointment reminders.</li>
              <li>Promotional offers from the business you opted in with.</li>
            </ul>
            <p className="mt-2">
              <strong className="text-white/70">Message frequency varies.</strong> Message and data rates may apply. You can opt out at any time by replying <strong className="text-white/70">STOP</strong> to any message. Reply <strong className="text-white/70">HELP</strong> for assistance.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white/80 mb-2">4. Data Sharing</h2>
            <p>We do not sell your personal information. We share data only with:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong className="text-white/70">Twilio:</strong> Our SMS delivery provider, which processes phone numbers and message content to deliver texts.</li>
              <li><strong className="text-white/70">Supabase:</strong> Our database provider, which stores account and interaction data securely.</li>
              <li><strong className="text-white/70">Business owners:</strong> The barber or business you interacted with can see your phone number and interaction history.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white/80 mb-2">5. Data Retention</h2>
            <p>
              We retain call logs and messaging data for as long as a business owner maintains an active LineCatch account. Opt-out records are retained indefinitely to ensure your preferences are respected. You may request deletion of your data by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white/80 mb-2">6. Security</h2>
            <p>
              We use industry-standard security measures including encrypted connections (TLS), secure authentication, and access controls to protect your data. All webhook communications are validated using Twilio signature verification.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white/80 mb-2">7. Your Rights</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Opt out of SMS messages at any time by replying STOP.</li>
              <li>Request access to your personal data.</li>
              <li>Request deletion of your personal data.</li>
              <li>Contact us with questions about your privacy.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white/80 mb-2">8. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, contact us at{" "}
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
