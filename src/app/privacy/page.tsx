import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n-server";
import { LanguageToggle, type Locale } from "@/lib/i18n";
import { SUPPORT_EMAIL } from "@/lib/config";

const UPDATED = new Date("2026-09-18T12:00:00Z");

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t("legal.privacy_title")} · LineCatch` };
}

const B = ({ children }: { children: React.ReactNode }) => <strong className="text-white/70">{children}</strong>;
const H = ({ children }: { children: React.ReactNode }) => <h2 className="text-base font-semibold text-white/80 mb-2">{children}</h2>;
const Email = () => (
  <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[var(--accent-color)] hover:underline">
    {SUPPORT_EMAIL}
  </a>
);

/** The policy itself, one full version per language (kept side by side so they stay in sync). */
const CONTENT: Record<Locale, React.ReactNode> = {
  en: (
    <>
      <section>
        <H>1. Information We Collect</H>
        <p>When you use LineCatch, we collect the following information:</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li><B>Business owners (barbers):</B> Email address, phone number, business name, booking link, business hours, and messaging preferences.</li>
          <li><B>Customers:</B> Phone numbers from incoming calls, SMS opt-in consent, and interaction data (call timestamps, message delivery status, link clicks).</li>
          <li><B>VIP opt-in subscribers:</B> Phone number and consent confirmation provided through our opt-in form.</li>
        </ul>
      </section>

      <section>
        <H>2. How We Use Your Information</H>
        <ul className="list-disc pl-5 space-y-1">
          <li>To send automated SMS messages on behalf of business owners when calls are missed.</li>
          <li>To process opt-out and opt-in requests for SMS communications.</li>
          <li>To provide business owners with analytics and reporting on missed calls and message delivery.</li>
          <li>To send follow-up messages and promotional texts to customers who have opted in.</li>
          <li>To improve and maintain the LineCatch service.</li>
        </ul>
      </section>

      <section>
        <H>3. SMS Messaging</H>
        <p>
          LineCatch sends SMS messages through Twilio on behalf of business owners. By opting in to receive messages (via the VIP sign-up form or by calling a LineCatch-enabled number), you consent to receive:
        </p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>Missed call auto-reply texts with booking information.</li>
          <li>Follow-up appointment reminders.</li>
          <li>Promotional offers from the business you opted in with.</li>
        </ul>
        <p className="mt-2">
          <B>Message frequency varies.</B> Message and data rates may apply. You can opt out at any time by replying <B>STOP</B> to any message. Reply <B>HELP</B> for assistance.
        </p>
      </section>

      <section>
        <H>4. Data Sharing</H>
        <p>We do not sell your personal information. We share data only with:</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li><B>Twilio:</B> Our SMS delivery provider, which processes phone numbers and message content to deliver texts.</li>
          <li><B>Supabase:</B> Our database provider, which stores account and interaction data securely.</li>
          <li><B>Business owners:</B> The barber or business you interacted with can see your phone number and interaction history.</li>
        </ul>
      </section>

      <section>
        <H>5. Data Retention</H>
        <p>
          We retain call logs and messaging data for as long as a business owner maintains an active LineCatch account. Opt-out records are retained indefinitely to ensure your preferences are respected. You may request deletion of your data by contacting us.
        </p>
      </section>

      <section>
        <H>6. Security</H>
        <p>
          We use industry-standard security measures including encrypted connections (TLS), secure authentication, and access controls to protect your data. All webhook communications are validated using Twilio signature verification.
        </p>
      </section>

      <section>
        <H>7. Your Rights</H>
        <ul className="list-disc pl-5 space-y-1">
          <li>Opt out of SMS messages at any time by replying STOP.</li>
          <li>Request access to your personal data.</li>
          <li>Request deletion of your personal data.</li>
          <li>Contact us with questions about your privacy.</li>
        </ul>
      </section>

      <section>
        <H>8. Contact Us</H>
        <p>
          If you have any questions about this Privacy Policy, contact us at <Email />.
        </p>
      </section>
    </>
  ),
  es: (
    <>
      <section>
        <H>1. Información que recopilamos</H>
        <p>Cuando usas LineCatch, recopilamos la siguiente información:</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li><B>Dueños de negocios (barberos):</B> correo electrónico, número de teléfono, nombre del negocio, enlace de reservas, horario de atención y preferencias de mensajería.</li>
          <li><B>Clientes:</B> números de teléfono de las llamadas entrantes, consentimiento para recibir SMS y datos de interacción (hora de las llamadas, estado de entrega de los mensajes, clics en enlaces).</li>
          <li><B>Suscriptores de la lista VIP:</B> número de teléfono y confirmación de consentimiento dados a través de nuestro formulario de inscripción.</li>
        </ul>
      </section>

      <section>
        <H>2. Cómo usamos tu información</H>
        <ul className="list-disc pl-5 space-y-1">
          <li>Para enviar mensajes SMS automáticos en nombre de los dueños de negocios cuando no contestan una llamada.</li>
          <li>Para procesar solicitudes de alta y de baja de las comunicaciones por SMS.</li>
          <li>Para dar a los dueños de negocios estadísticas e informes sobre llamadas perdidas y entrega de mensajes.</li>
          <li>Para enviar mensajes de seguimiento y textos promocionales a los clientes que dieron su consentimiento.</li>
          <li>Para mejorar y mantener el servicio de LineCatch.</li>
        </ul>
      </section>

      <section>
        <H>3. Mensajes SMS</H>
        <p>
          LineCatch envía mensajes SMS a través de Twilio en nombre de los dueños de negocios. Al aceptar recibir mensajes (mediante el formulario de inscripción VIP o al llamar a un número que usa LineCatch), das tu consentimiento para recibir:
        </p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>Respuestas automáticas por llamada perdida con información para reservar.</li>
          <li>Recordatorios y seguimientos de tus citas.</li>
          <li>Ofertas promocionales del negocio con el que te inscribiste.</li>
        </ul>
        <p className="mt-2">
          <B>La frecuencia de los mensajes varía.</B> Pueden aplicarse tarifas de mensajes y datos. Puedes darte de baja en cualquier momento respondiendo <B>STOP</B> a cualquier mensaje. Responde <B>HELP</B> para obtener ayuda.
        </p>
      </section>

      <section>
        <H>4. Cómo compartimos los datos</H>
        <p>No vendemos tu información personal. Solo compartimos datos con:</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li><B>Twilio:</B> nuestro proveedor de envío de SMS, que procesa números de teléfono y el contenido de los mensajes para entregarlos.</li>
          <li><B>Supabase:</B> nuestro proveedor de base de datos, que guarda de forma segura los datos de las cuentas y de las interacciones.</li>
          <li><B>Dueños de negocios:</B> el barbero o negocio con el que interactuaste puede ver tu número de teléfono y tu historial de interacciones.</li>
        </ul>
      </section>

      <section>
        <H>5. Conservación de los datos</H>
        <p>
          Conservamos los registros de llamadas y de mensajes mientras el dueño del negocio mantenga activa su cuenta de LineCatch. Los registros de bajas se conservan de forma indefinida para garantizar que se respeten tus preferencias. Puedes pedir que eliminemos tus datos comunicándote con nosotros.
        </p>
      </section>

      <section>
        <H>6. Seguridad</H>
        <p>
          Usamos medidas de seguridad estándar de la industria, como conexiones cifradas (TLS), autenticación segura y controles de acceso, para proteger tus datos. Todas las comunicaciones de webhooks se validan mediante la verificación de firma de Twilio.
        </p>
      </section>

      <section>
        <H>7. Tus derechos</H>
        <ul className="list-disc pl-5 space-y-1">
          <li>Darte de baja de los mensajes SMS en cualquier momento respondiendo STOP.</li>
          <li>Solicitar acceso a tus datos personales.</li>
          <li>Solicitar la eliminación de tus datos personales.</li>
          <li>Comunicarte con nosotros si tienes preguntas sobre tu privacidad.</li>
        </ul>
      </section>

      <section>
        <H>8. Contáctanos</H>
        <p>
          Si tienes alguna pregunta sobre esta Política de privacidad, escríbenos a <Email />.
        </p>
      </section>
    </>
  ),
};

export default async function PrivacyPolicy() {
  const { t, locale, tag } = await getT();
  return (
    <div className="min-h-screen bg-[#121110] text-white/80 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/60 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            {t("common.back")}
          </Link>
          <LanguageToggle />
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">{t("legal.privacy_title")}</h1>
        <p className="text-sm text-white/30 mb-8">
          {t("legal.updated", { date: UPDATED.toLocaleDateString(tag, { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) })}
        </p>

        <div className="space-y-6 text-sm leading-relaxed text-white/60">{CONTENT[locale]}</div>
      </div>
    </div>
  );
}
