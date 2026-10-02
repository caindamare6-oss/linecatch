import PortfolioSection from "../settings/portfolio-section";
import { PageHeader } from "../ui";
import { getT } from "@/lib/i18n-server";

export default async function PortfolioPage() {
  const { t } = await getT();
  return (
    <>
      <PageHeader title={t("portfolio.title")} back="/dashboard" sub={t("portfolio.sub")} />
      <PortfolioSection />
    </>
  );
}
