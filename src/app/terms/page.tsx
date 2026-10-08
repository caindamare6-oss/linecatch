import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n-server";
import { LanguageToggle, type Locale } from "@/lib/i18n";
import { SUPPORT_EMAIL } from "@/lib/config";

const UPDATED = new Date("2026-09-18T12:00:00Z");

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t("legal.terms_title")} · LineCatch` };
}

const B = ({ children }: { children: React.ReactNode }) => <strong className="text-white/70">{children}</strong>;
const H = ({ children }: { children: React.ReactNode }) => <h2 className="text-base font-semibold text-white/80 mb-2">{children}</h2>;
const Email = () => (
  <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[var(--accent-color)] hover:underline">
    {SUPPORT_EMAIL}
  </a>
);

/** The terms themselves, one full version per language (kept side by side so they stay in sync). */
const CONTENT: Record<Locale, React.ReactNode> = {
  en: (
    <>
      <section>
        <H>1. Acceptance of Terms</H>
        <p>
          By accessing or using LineCatch, you agree to be bound by these Terms of Service. If you do not agree, do not use the service. LineCatch is a software platform that sends automated SMS messages on behalf of businesses when phone calls are missed.
        </p>
      </section>

      <section>
        <H>2. Service Description</H>
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
        <H>3. Business Owner Responsibilities</H>
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
        <H>4. SMS Consent (Customers)</H>
        <p>
          By calling a LineCatch-enabled phone number or opting in through a VIP sign-up form, you consent to receive automated SMS messages from the associated business. This consent is not a condition of any purchase.
        </p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>Message frequency varies based on your interactions.</li>
          <li>Message and data rates may apply.</li>
          <li>Reply <B>STOP</B> to cancel at any time.</li>
          <li>Reply <B>HELP</B> for assistance.</li>
        </ul>
      </section>

      <section>
        <H>5. Prohibited Uses</H>
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
        <H>6. Limitation of Liability</H>
        <p>
          LineCatch is provided &quot;as is&quot; without warranties of any kind. We are not liable for any missed messages, delivery failures, carrier filtering, or damages arising from the use of our service. Our total liability shall not exceed the amount you paid for the service in the preceding 12 months.
        </p>
      </section>

      <section>
        <H>7. Account Termination</H>
        <p>
          We reserve the right to suspend or terminate your account if you violate these terms, engage in abusive messaging practices, or if your messaging campaigns are flagged by carriers. You may cancel your account at any time by contacting support.
        </p>
      </section>

      <section>
        <H>8. Changes to Terms</H>
        <p>
          We may update these terms from time to time. Continued use of LineCatch after changes constitutes acceptance of the updated terms. We will notify registered users of material changes via email.
        </p>
      </section>

      <section>
        <H>9. Contact</H>
        <p>
          Questions about these Terms? Contact us at <Email />.
        </p>
      </section>
    </>
  ),
  es: (
    <>
      <section>
        <H>1. Aceptación de los términos</H>
        <p>
          Al acceder a LineCatch o usarlo, aceptas quedar obligado por estos Términos de servicio. Si no estás de acuerdo, no uses el servicio. LineCatch es una plataforma de software que envía mensajes SMS automáticos en nombre de negocios cuando no se contesta una llamada.
        </p>
      </section>

      <section>
        <H>2. Descripción del servicio</H>
        <p>LineCatch ofrece:</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>Mensajes de texto automáticos por llamadas perdidas para negocios.</li>
          <li>Desvío de llamadas y seguimiento de su estado.</li>
          <li>Gestión de altas y bajas de SMS.</li>
          <li>Envío de enlaces de reserva y seguimiento de clics.</li>
          <li>Panel de estadísticas para los dueños de negocios.</li>
        </ul>
      </section>

      <section>
        <H>3. Responsabilidades del dueño del negocio</H>
        <p>Como dueño de un negocio que usa LineCatch, aceptas:</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>Cumplir todas las leyes aplicables a las comunicaciones por SMS, incluidas la Ley de Protección al Consumidor Telefónico (TCPA) y la Ley CAN-SPAM.</li>
          <li>Enviar mensajes solo a personas que tengan una expectativa razonable de recibir comunicaciones de tu negocio (es decir, personas que te llamaron).</li>
          <li>Respetar de inmediato todas las solicitudes de baja.</li>
          <li>No usar el servicio para enviar spam ni mensajes fraudulentos o engañosos.</li>
          <li>Mantener actualizada y correcta la información de tu negocio en la configuración de tu cuenta.</li>
          <li>Registrar tu campaña de mensajería para cumplir con A2P 10DLC, según lo exijan las operadoras.</li>
        </ul>
      </section>

      <section>
        <H>4. Consentimiento para SMS (clientes)</H>
        <p>
          Al llamar a un número de teléfono que usa LineCatch o al inscribirte mediante un formulario VIP, das tu consentimiento para recibir mensajes SMS automáticos del negocio correspondiente. Este consentimiento no es una condición para ninguna compra.
        </p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>La frecuencia de los mensajes varía según tus interacciones.</li>
          <li>Pueden aplicarse tarifas de mensajes y datos.</li>
          <li>Responde <B>STOP</B> para cancelar en cualquier momento.</li>
          <li>Responde <B>HELP</B> para obtener ayuda.</li>
        </ul>
      </section>

      <section>
        <H>5. Usos prohibidos</H>
        <p>No puedes usar LineCatch para:</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>Enviar mensajes masivos no solicitados o spam.</li>
          <li>Acosar, amenazar o enviar contenido ofensivo.</li>
          <li>Realizar cualquier actividad ilegal.</li>
          <li>Hacerte pasar por otra persona o negocio.</li>
          <li>Evadir los mecanismos de baja o contactar a personas que se dieron de baja.</li>
          <li>Revender o redistribuir el servicio sin autorización.</li>
        </ul>
      </section>

      <section>
        <H>6. Limitación de responsabilidad</H>
        <p>
          LineCatch se ofrece &quot;tal cual&quot;, sin garantías de ningún tipo. No somos responsables de mensajes no entregados, fallas de entrega, filtrado por parte de las operadoras ni daños que resulten del uso de nuestro servicio. Nuestra responsabilidad total no excederá el monto que pagaste por el servicio en los 12 meses anteriores.
        </p>
      </section>

      <section>
        <H>7. Cancelación de la cuenta</H>
        <p>
          Nos reservamos el derecho de suspender o cancelar tu cuenta si incumples estos términos, si incurres en prácticas de mensajería abusivas o si las operadoras marcan tus campañas de mensajería. Puedes cancelar tu cuenta en cualquier momento comunicándote con soporte.
        </p>
      </section>

      <section>
        <H>8. Cambios a los términos</H>
        <p>
          Podemos actualizar estos términos de vez en cuando. Si sigues usando LineCatch después de los cambios, aceptas los términos actualizados. Avisaremos por correo electrónico a los usuarios registrados sobre cualquier cambio importante.
        </p>
      </section>

      <section>
        <H>9. Contacto</H>
        <p>
          ¿Tienes preguntas sobre estos Términos? Escríbenos a <Email />.
        </p>
      </section>
    </>
  ),
};

export default async function TermsOfService() {
  const { t, locale, tag } = await getT();
  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-white/80 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/60 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            {t("common.back")}
          </Link>
          <LanguageToggle />
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">{t("legal.terms_title")}</h1>
        <p className="text-sm text-white/30 mb-8">
          {t("legal.updated", { date: UPDATED.toLocaleDateString(tag, { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) })}
        </p>

        <div className="space-y-6 text-sm leading-relaxed text-white/60">{CONTENT[locale]}</div>
      </div>
    </div>
  );
}
