import PortfolioSection from "../settings/portfolio-section";
import { PageHeader } from "../ui";

export default function PortfolioPage() {
  return (
    <>
      <PageHeader title="Your portfolio" back="/dashboard" sub="What clients see from your link and QR." />
      <PortfolioSection />
    </>
  );
}
