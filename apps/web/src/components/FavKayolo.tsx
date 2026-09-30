"use client";

/** The empty favorites line. The header scout finds it and scratches it out. */
export function FavKayolo({ line }: { line: string }) {
  return (
    <div className="fav-kayolo">
      <p data-fav-note={line} className="fav-kayolo-line">
        {line}
      </p>
    </div>
  );
}
