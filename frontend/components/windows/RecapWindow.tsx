const DRAFT_RECAP = "https://www.youtube-nocookie.com/embed/6h-B_O-r7jg";

export function RecapWindow() {
  return (
    <div className="grid h-full place-items-center bg-(--xp-screen)">
      <iframe
        src={DRAFT_RECAP}
        title="Smirnoff League draft recap"
        loading="lazy"
        className="aspect-video max-h-full w-full"
        allow="encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
