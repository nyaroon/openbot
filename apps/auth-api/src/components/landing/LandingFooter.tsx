import { AppLogo } from "@openbot/brand";
import { brandText, PRODUCT_NAME } from "@openbot/contracts/product";
import { Link } from "@tanstack/solid-router";
import { For, Show } from "solid-js";
import { EXTERNAL_LINK_REL, FOOTER_COLUMNS, type FooterLink } from "../../lib/landing-links";
import { localizedPath } from "../../lib/site-paths";
import { createLandingReveal } from "./createLandingReveal";
import { LandingIcon } from "./LandingIcon";
import { useSiteChrome, useSitePath } from "./SiteText";

export function LandingFooter() {
  let footerRef: HTMLElement | undefined;
  const chrome = useSiteChrome();
  const text = () => chrome().text.footer;
  const revealed = createLandingReveal(() => footerRef);

  const revealState = () => (revealed() ? "true" : "false");

  return (
    <footer ref={footerRef} class="landing-footer" data-slot="landing-footer" lang={chrome().lang}>
      <div class="landing-footer-inner">
        <div class="landing-footer-grid">
          <div class="landing-footer-brand" data-revealed={revealState()}>
            <Link
              class="landing-footer-lockup"
              to={localizedPath("/", chrome().locale)}
              aria-label={chrome().text.home}
            >
              <AppLogo variant="production" class="landing-footer-logo" />
              <span>{PRODUCT_NAME}</span>
            </Link>

            <p class="landing-footer-description">{text().description}</p>

            <Link class="landing-footer-cta" to="/download">
              <span>{text().download}</span>
              <LandingIcon name="download" />
            </Link>
          </div>

          <nav class="landing-footer-columns" aria-label={text().navigation} data-revealed={revealState()}>
            <For each={FOOTER_COLUMNS}>
              {(column) => (
                <div class="landing-footer-column">
                  <h2>{text().columns[column.id]}</h2>
                  <ul>
                    <For each={column.links}>
                      {(link) => (
                        <li>
                          <FooterNavLink link={link} />
                        </li>
                      )}
                    </For>
                  </ul>
                </div>
              )}
            </For>
          </nav>
        </div>

        <div class="landing-footer-bottom" data-revealed={revealState()}>
          <p>{text().rights}</p>
          <div class="landing-footer-meta">
            <Link to="/download">
              <span class="landing-footer-availability" aria-hidden="true" />
              {text().available}
            </Link>
            <p class="landing-footer-made">
              {text().made.before}
              <LandingIcon name="heart" label={text().love} />
              {text().made.after}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterNavLink(props: { link: FooterLink }) {
  const chrome = useSiteChrome();
  const path = useSitePath();
  const label = () => {
    const name = props.link.label;
    return typeof name === "string" ? brandText(name) : chrome().text.footer.links[name.text];
  };
  const external = () => (props.link.external ? props.link : undefined);
  const page = () => (props.link.external || "slug" in props.link ? undefined : props.link);
  const article = () => (!props.link.external && "slug" in props.link ? props.link : undefined);

  return (
    <>
      <Show when={external()}>
        {(link) => (
          <a href={link().href} target="_blank" rel={EXTERNAL_LINK_REL}>
            {label()}
          </a>
        )}
      </Show>
      <Show when={page()}>
        {(link) => (
          <Show when={link().hash} fallback={<Link to={path(link().to)}>{label()}</Link>}>
            {(hash) => (
              <Link to={path(link().to)} hash={hash()}>
                {label()}
              </Link>
            )}
          </Show>
        )}
      </Show>
      <Show when={article()}>
        {(link) => (
          <Link to={link().to} params={{ slug: link().slug }}>
            {label()}
          </Link>
        )}
      </Show>
    </>
  );
}
