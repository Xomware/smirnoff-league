// iOS Safari lays position: fixed out against the layout viewport, which its
// toolbars and keyboard cover without resizing, so a full-height modal ends up
// under them. As a ref callback, this writes the part the user can see to
// --vv-top/--vv-height on the element and keeps a focused text field and its
// form's buttons in view as the keyboard opens.
export function fitVisualViewport(el: HTMLElement | null) {
  const vv = window.visualViewport;
  if (!vv || !el) return;
  const fit = () => {
    el.style.setProperty("--vv-top", `${vv.offsetTop}px`);
    el.style.setProperty("--vv-height", `${vv.height}px`);
  };
  const resize = () => {
    fit();
    const field = document.activeElement;
    if (field instanceof HTMLTextAreaElement && el.contains(field)) (field.form ?? field).scrollIntoView({ block: "nearest" });
  };
  fit();
  vv.addEventListener("resize", resize);
  vv.addEventListener("scroll", fit);
  return () => {
    vv.removeEventListener("resize", resize);
    vv.removeEventListener("scroll", fit);
  };
}
