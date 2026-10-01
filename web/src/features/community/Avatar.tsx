import { avatarColor, initials, profileName, safeImageUrl } from '../../domain/community';

/* Krug sa inicijalima; slika je zaseban SLOJ preko njih. Razlika je vidljiva tačno u slučaju koji se i dogodio: adresa slike postoji, ali slika ne
   stigne — providan sloj ne pokrije ništa i inicijali se vide. NAMERNO pozadina, a ne `<img>`: Safari na iPhoneu nacrta SVOJU ikonicu slomljene
   slike preko inicijala. Adresa prolazi kroz usko sito (`safeImageUrl`) i postavlja se kroz CSSOM, ne kroz HTML atribut — pregledač je tamo ne
   dekodira kao HTML, pa tuđ `avatar_url` ne može da ubaci CSS deklaracije u dokument drugog korisnika. */
export function Avatar({
  profile,
  size
}: {
  profile: { user_id?: unknown; nadimak?: unknown; avatar_url?: unknown };
  size: number;
}) {
  const image = safeImageUrl(profile.avatar_url);
  return (
    <span
      className="zav"
      style={{
        width: size,
        height: size,
        backgroundColor: avatarColor(profile.user_id),
        fontSize: Math.round(size * 0.4)
      }}
    >
      <b>{initials(profileName(profile))}</b>
      {image ? <i style={{ backgroundImage: `url("${image}")` }} /> : null}
    </span>
  );
}
