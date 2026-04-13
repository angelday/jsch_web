export function initMailto() {
  const links = document.querySelectorAll("a[data-mailto-user][data-mailto-domain]");
  links.forEach((link) => {
    if (!(link instanceof HTMLAnchorElement)) return;
    const user = link.dataset.mailtoUser;
    const domain = link.dataset.mailtoDomain;
    if (!user || !domain) return;
    const address = `${user}\u0040${domain}`;
    const subject = link.dataset.mailtoSubject;
    link.href = `mailto:${address}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
    link.setAttribute("aria-label", `Send an email to ${address}`);
    delete link.dataset.mailtoUser;
    delete link.dataset.mailtoDomain;
    if (subject) delete link.dataset.mailtoSubject;
  });
}
