// Line-drawn portraits of the opponents, in the same single ink as the rest of
// the page. They're inline SVG so they take the text color (currentColor) and
// invert with the card when it's chosen. Shapes with the "f" class are filled
// with the card's background so they hide whatever is drawn behind them; "s"
// shapes are solid ink.

const SHOULDERS = <path className="f" d="M8 64C8 52 16 46 26 45H38C48 46 56 52 56 64" />;
const NECK = <path d="M28 37V45M36 37V45" />;

const DRAWINGS = {
  // Free play: a die.
  free: (
    <>
      <path className="f" d="M32 9L53 21V45L32 57L11 45V21Z" />
      <path d="M11 21L32 33L53 21M32 33V57" />
      <ellipse className="s" cx="32" cy="21" rx="3.2" ry="1.9" />
      <circle className="s" cx="16.5" cy="30" r="2" />
      <circle className="s" cx="26.5" cy="48" r="2" />
      <circle className="s" cx="47.5" cy="30" r="2" />
      <circle className="s" cx="42.5" cy="39" r="2" />
      <circle className="s" cx="37.5" cy="48" r="2" />
    </>
  ),

  // A friend: two people side by side.
  friend: (
    <>
      <path className="f" d="M26 52C26 42 32 37 41 37C50 37 56 42 56 52" />
      <circle className="f" cx="41" cy="24" r="8.5" />
      <path className="f" d="M8 64C8 53 15 47 25 47C35 47 42 53 42 64" />
      <circle className="f" cx="25" cy="33" r="9.5" />
    </>
  ),

  // Grub the Goblin: big ears, bulging eyes, a fanged grin.
  grub: (
    <>
      {SHOULDERS}
      {NECK}
      <path className="f" d="M23 26L4 19L22 35Z" />
      <path className="f" d="M41 26L60 19L42 35Z" />
      <path d="M20 27L10 22.5M44 27L54 22.5" strokeWidth="1.5" />
      <ellipse className="f" cx="32" cy="29" rx="12.5" ry="11.5" />
      <path d="M29 18C28 14 26 13 24 13M34 17.5C35 14 37 13 39 13.5" strokeWidth="1.5" />
      <circle className="f" cx="27" cy="25.5" r="3.6" />
      <circle className="f" cx="37" cy="25.5" r="3.6" />
      <circle className="s" cx="28" cy="26" r="1.5" />
      <circle className="s" cx="36" cy="26" r="1.5" />
      <path d="M31.5 28C34 29.5 35 31.5 32 32.3" strokeWidth="1.7" />
      <path className="f" d="M24 34.5Q32 36 40 34.5Q32 42.5 24 34.5Z" />
      <path d="M28 35.4L29.2 38L30.4 35.6M33.6 35.6L34.8 38L36 35.4" strokeWidth="1.5" />
    </>
  ),

  // Pip the Squire: a helmet a size too big and a tabard with a cross.
  pip: (
    <>
      {SHOULDERS}
      <path d="M32 50V62M27 54.5H37" />
      {NECK}
      <circle className="f" cx="32" cy="29" r="11" />
      <path className="f" d="M19.5 29C19.5 12 44.5 12 44.5 29Z" />
      <path d="M32 14.5V26" strokeWidth="1.5" />
      <rect className="f" x="18.5" y="26.5" width="27" height="3.5" />
      <rect className="f" x="30.6" y="30" width="2.8" height="4.6" />
      <circle className="s" cx="26.5" cy="32.5" r="1.4" />
      <circle className="s" cx="37.5" cy="32.5" r="1.4" />
      <path d="M29.5 37.4Q32 39 34.5 37.4" />
    </>
  ),

  // Barnaby the Bard: a feathered cap, singing.
  barnaby: (
    <>
      <path className="f" d="M10 64C10 52 18 46 28 45H40C50 46 58 52 58 64" />
      <path d="M30 37V45M38 37V45" />
      <circle className="f" cx="34" cy="30" r="11" />
      <path className="f" d="M43 17C46 9 52 4 61 2C58 8 53 14 47 19Z" />
      <path d="M44.5 17.5L58.5 4" strokeWidth="1.2" />
      <path className="f" d="M21 26C19 13 46 10 49 23C43 23 29 23.5 21 26Z" />
      <path d="M28 30.5Q30 28.5 32 30.5M36 30.5Q38 28.5 40 30.5" />
      <ellipse className="f" cx="34" cy="36.3" rx="2.4" ry="2" />
      <circle className="s" cx="6" cy="25" r="2.3" />
      <circle className="s" cx="14" cy="22.5" r="2.3" />
      <path d="M8.2 24.6V12.5L16.2 10V22.1" />
      <path d="M8.2 13L16.2 10.5" strokeWidth="3" />
    </>
  ),

  // Elowen the Elf: long hair, pointed ears, a jewel on a circlet.
  elowen: (
    <>
      {SHOULDERS}
      <path className="f" d="M20 23C24 12 40 12 44 23C47 31 46 42 50 53H40L38 38H26L24 53H14C18 42 17 31 20 23Z" />
      <path d="M29 37V45M35 37V45" />
      <ellipse className="f" cx="32" cy="28.5" rx="9.5" ry="11" />
      <path className="f" d="M23.4 27.5L12.5 21L24 33.5Z" />
      <path className="f" d="M40.6 27.5L51.5 21L40 33.5Z" />
      <path className="f" d="M22.6 27C23 17.5 41 17.5 41.4 27C38 23 35 21.5 32 20.5C29 21.5 26 23 22.6 27Z" />
      <path d="M23.5 23Q32 18.5 40.5 23" strokeWidth="1.5" />
      <path className="s" d="M32 18.3L33.6 20.3L32 22.3L30.4 20.3Z" />
      <circle className="s" cx="28" cy="29.5" r="1.4" />
      <circle className="s" cx="36" cy="29.5" r="1.4" />
      <path d="M30 35Q32 36.4 34 35" />
    </>
  ),

  // Ambrose the Monk: a tonsure, spectacles and an open book.
  ambrose: (
    <>
      {SHOULDERS}
      <path d="M19 51C24 43 40 43 45 51" />
      {NECK}
      <circle className="f" cx="32" cy="27" r="11" />
      <path className="f" d="M21 28C21 21 25 19.5 32 19.5C39 19.5 43 21 43 28C41 24.5 37 23.5 32 23.5C27 23.5 23 24.5 21 28Z" />
      <circle className="f" cx="27.5" cy="29" r="3.3" />
      <circle className="f" cx="36.5" cy="29" r="3.3" />
      <path d="M30.8 29H33.2" />
      <circle className="s" cx="27.5" cy="29.3" r="1.1" />
      <circle className="s" cx="36.5" cy="29.3" r="1.1" />
      <path d="M29 34.5Q32 36.5 35 34.5" />
      <path className="f" d="M14 52Q23 49 32 53V64Q23 60 14 62Z" />
      <path className="f" d="M50 52Q41 49 32 53V64Q41 60 50 62Z" />
      <path d="M18 55Q23 53.5 28 55.5M18 58.5Q23 57 28 59M46 55Q41 53.5 36 55.5M46 58.5Q41 57 36 59" strokeWidth="1.2" />
    </>
  ),

  // Morwen the Sorceress: a crooked pointed hat with a star.
  morwen: (
    <>
      {SHOULDERS}
      <path className="f" d="M21 28C19 38 18 47 13 54L26 52L27 39H37L38 52L51 54C46 47 45 38 43 28Z" />
      <path d="M29 39V45M35 39V45" />
      <circle className="f" cx="32" cy="32" r="10" />
      <path className="f" d="M21 25L31 6Q33 2 38 3Q42 4 45 9Q39 5.5 35.5 9.5L43 25Z" />
      <ellipse className="f" cx="32" cy="25" rx="22" ry="4" />
      <path className="s" d="M32 11.5L33 14.4L36 15.5L33 16.6L32 19.5L31 16.6L28 15.5L31 14.4Z" />
      <path d="M26 31.5Q28 30 30 31.5M34 31.5Q36 30 38 31.5" />
      <circle className="s" cx="28" cy="33" r="1.3" />
      <circle className="s" cx="36" cy="33" r="1.3" />
      <path d="M29.5 37.5Q32.5 39.2 35 37" />
    </>
  ),

  // Ignis the Dragon, in profile: horns, a slit eye, smoke from the nose.
  ignis: (
    <>
      <path className="f" d="M49.5 33L57 33L51.5 39Z" />
      <path className="f" d="M52.5 43L60 44L54 49Z" />
      <path className="f" d="M54.5 53L62 55L55.5 59Z" />
      <path className="f" d="M46 26C51 38 54 51 56 64H28C32 54 34 48 32 41" />
      <path d="M31.5 48Q35 49 38 47.5M32 53.5Q35.5 54.5 39 53M31.5 59Q35 60 39.5 58.5" strokeWidth="1.5" />
      <path className="f" d="M40 17C46 12 52 9 61 5C55 11 51 16 46 21Z" />
      <path className="f" d="M45 23C50 21 55 20 60 18C55 22 51 24 47 27Z" />
      <path className="f" d="M44 18C38 14 30 16 22 20L10 22C6 23 5 28 9 29L28 32L14 35C16 39 26 41 34 42C40 42 46 36 47 28C47 23 46 20 44 18Z" />
      <path d="M14 29.7L15.1 32L16.2 30.3M20 30.6L21.1 32.9L22.2 31.2" strokeWidth="1.3" />
      <path d="M10.5 24.5Q12 23.3 13.5 24.6" />
      <path className="f" d="M28.5 23Q32 19.5 36.5 21.8Q33 25 28.5 23Z" />
      <path d="M33 20.6V23.6" strokeWidth="1.8" />
      <path d="M26.5 19.8Q32 15 38.5 18" />
      <path d="M8 19C5.5 15.5 10 13.5 7.5 9.5C5.5 6.5 9 4.5 7 1.5" strokeWidth="1.5" />
    </>
  ),

  // Flick the Fairy: wings, a top bun and a few sparkles.
  flick: (
    <>
      <path className="f" d="M28 44C20 34 8 26 5 33C3 40 12 46 27 48Z" />
      <path className="f" d="M36 44C44 34 56 26 59 33C61 40 52 46 37 48Z" />
      <path className="f" d="M27 48C18 50 10 56 13 61C16 64 24 58 28 51Z" />
      <path className="f" d="M37 48C46 50 54 56 51 61C48 64 40 58 36 51Z" />
      <path d="M26 45L11 33.5M38 45L53 33.5" strokeWidth="1.2" />
      <path className="f" d="M16 64C16 54 22 48 28 47H36C42 48 48 54 48 64" />
      <path d="M29 38V47M35 38V47" />
      <circle className="f" cx="32" cy="16.5" r="4.5" />
      <circle className="f" cx="32" cy="29" r="10" />
      <path className="f" d="M22.4 28C22 18.5 42 18.5 41.6 28C38.5 24 35 23 31.5 25C28.5 23 25.5 24.5 22.4 28Z" />
      <circle className="s" cx="28" cy="30.5" r="1.4" />
      <circle className="s" cx="36" cy="30.5" r="1.4" />
      <path d="M29.5 34.5Q32 36.5 34.5 34.5" />
      <path className="s" d="M10 8L11 11L14 12L11 13L10 16L9 13L6 12L9 11Z" />
      <path className="s" d="M54 6L54.7 8.3L57 9L54.7 9.7L54 12L53.3 9.7L51 9L53.3 8.3Z" />
      <path className="s" d="M56 20L56.6 21.4L58 22L56.6 22.6L56 24L55.4 22.6L54 22L55.4 21.4Z" />
    </>
  ),

  // Zephyr the Genie: a curling topknot, hoop earrings, a goatee and an open vest.
  zephyr: (
    <>
      {SHOULDERS}
      <path d="M25 45.5C25 52 26.5 58 28.5 64M39 45.5C39 52 37.5 58 35.5 64" />
      {NECK}
      <path className="f" d="M31 16C29 10 33 5 39 4C44 3.5 47.5 6 46.5 9.5C44.5 6.5 40.5 6.5 39 9C38 11 36.5 14 34 16Z" />
      <path className="f" d="M21.3 24.5C17.5 24.5 17.5 31 21.3 31" />
      <path className="f" d="M42.7 24.5C46.5 24.5 46.5 31 42.7 31" />
      <circle cx="19.8" cy="34" r="2.8" strokeWidth="1.5" />
      <circle cx="44.2" cy="34" r="2.8" strokeWidth="1.5" />
      <circle className="f" cx="32" cy="28" r="11" />
      <circle className="f" cx="32.5" cy="17" r="2.2" />
      <path d="M25 23.5L30 25M39 23.5L34 25" strokeWidth="2.4" />
      <circle className="s" cx="27.5" cy="28.5" r="1.4" />
      <circle className="s" cx="36.5" cy="28.5" r="1.4" />
      <path d="M28 33Q32 36 36 33" />
      <path className="f" d="M29.5 38.5Q32 46 34.5 38.5Z" />
    </>
  ),

  // Nefer the Sphinx: a striped headdress, kohl-lined eyes, a broad collar.
  nefer: (
    <>
      {SHOULDERS}
      <path d="M22 50Q32 58 42 50M20 54Q32 63 44 54" strokeWidth="1.5" />
      <path className="f" d="M32 13C24 13 20 17 20 24L11 40L16 57H25L23 41H41L39 57H48L53 40L44 24C44 17 40 13 32 13Z" />
      <path d="M17.5 30L22 31.5M14.5 36L22.5 37M13 43.5L23.2 44.5M14.8 49.5L23.8 50M46.5 30L42 31.5M49.5 36L41.5 37M51 43.5L40.8 44.5M49.2 49.5L40.2 50" strokeWidth="1.3" />
      <ellipse className="f" cx="32" cy="30.5" rx="9" ry="10.5" />
      <path className="f" d="M22 25C22 15 42 15 42 25Q32 20 22 25Z" />
      <path d="M26 20.5L27 22.4M32 18.5V21.3M38 20.5L37 22.4" strokeWidth="1.2" />
      <path className="f" d="M32 23C30.4 21 31 18 32 17C33 18 33.6 21 32 23Z" />
      <path className="f" d="M26 29Q28.5 27.3 31 29Q28.5 30.4 26 29Z" />
      <path className="f" d="M33 29Q35.5 27.3 38 29Q35.5 30.4 33 29Z" />
      <path d="M26 29L23.5 28M38 29L40.5 28" />
      <circle className="s" cx="28.5" cy="29" r="0.9" />
      <circle className="s" cx="35.5" cy="29" r="0.9" />
      <path d="M32 31L31 34.6H33" strokeWidth="1.5" />
      <path d="M29.6 37.3Q32 38.6 34.4 37.3" />
      <path className="f" d="M30.5 40.7L31 46H33L33.5 40.7Z" />
    </>
  ),
};

export default function Avatar({ id, className = "" }) {
  const drawing = DRAWINGS[id];
  if (!drawing) return null;
  return (
    <svg className={`avatar ${className}`} viewBox="0 0 64 64" aria-hidden="true" focusable="false"
         fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {drawing}
    </svg>
  );
}
