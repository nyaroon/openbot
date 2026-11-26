import { onSettled } from "solid-js";
import { landingAnalytics } from "../../lib/analytics";
import { DOWNLOAD_HUB, downloadPagePath } from "../../lib/download-pages";
import { LandingFooter } from "../landing/LandingFooter";
import { SiteHeader } from "../landing/SiteHeader";

/** There is no release location of our own yet, so the download page only says so. */
export function DownloadHubPage() {
  onSettled(() => landingAnalytics.start(document, window.location.hostname, downloadPagePath("hub")));

  return (
    <div class="landing-page download-page">
      <SiteHeader page="content" />

      <main class="download-main">
        <header class="compare-index-hero download-hub-hero" data-enter="post-copy">
          <div class="landing-hero-grid" aria-hidden="true" />
          <h1 class="compare-index-title">{DOWNLOAD_HUB.heading}</h1>
          <p class="compare-index-description download-hub-intro">{DOWNLOAD_HUB.intro}</p>
        </header>
      </main>

      <LandingFooter />
    </div>
  );
}
