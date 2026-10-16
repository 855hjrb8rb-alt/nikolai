// Catálogo de las cintas de «The Man in the High Castle» (Amazon, 2015–2019).
// En la serie, las películas muestran otros universos: casi siempre, mundos
// donde los Aliados ganaron la Segunda Guerra Mundial.
//
// La serie tiene derechos de autor de Amazon MGM Studios: aquí no se copia ni
// se aloja ningún fragmento. Cada entrada trae un resumen, enlaces para verla
// por vías legales y una «reconstrucción» original (cartelas generadas en el
// navegador). Si tienes tu propia copia del clip, puedes adjuntarla a la ficha.

export const SEASONS = [
  { n: 1, year: 2015, title: "Temporada 1", blurb: "Aparece «The Grasshopper Lies Heavy». La Resistencia intenta llevar las cintas al misterioso Hombre en el Castillo." },
  { n: 2, year: 2016, title: "Temporada 2", blurb: "Juliana conoce a Hawthorne Abendsen y su almacén de cintas. Una de ellas muestra San Francisco destruida por una bomba atómica." },
  { n: 3, year: 2018, title: "Temporada 3", blurb: "Quedan pocas cintas. Tagomi trae películas de otra Tierra y el Reich investiga cómo cruzar a esos mundos." },
  { n: 4, year: 2019, title: "Temporada 4", blurb: "Juliana vive en el otro mundo. Las cintas dejan paso al portal de las minas de Pensilvania." },
];

export const FILMS = [
  {
    id: "s1-grasshopper",
    season: 1, episode: "E1 · «The New World»",
    title: "The Grasshopper Lies Heavy",
    viewers: "Juliana Crain (se la da su hermana Trudy); después Frank Frink",
    world: "Los Aliados ganan la guerra",
    summary: "La primera cinta de la serie. Trudy se la entrega a Juliana justo antes de que la mate la Kempeitai. Es un noticiero en blanco y negro con escenas de una victoria aliada que nunca ocurrió en su mundo: celebraciones del fin de la guerra, la rendición de Japón y tropas aliadas victoriosas. Juliana decide llevarla a la Zona Neutral en lugar de Trudy.",
    cards: ["NOTICIERO ALIADO", "LA GUERRA HA TERMINADO", "JAPÓN SE RINDE", "VICTORIA"],
    query: "The Man in the High Castle Grasshopper Lies Heavy film season 1",
  },
  {
    id: "s1-joe-truck",
    season: 1, episode: "E1–E3",
    title: "La cinta del camión de Joe",
    viewers: "Joe Blake, Juliana (en Canon City)",
    world: "Los Aliados ganan la guerra",
    summary: "Joe Blake cruza el país con una cinta escondida en su camión para la Resistencia, rumbo a Canon City, en la Zona Neutral. Allí se cruza con Juliana, que lleva la suya. Más tarde se descubre que Joe trabaja en secreto para el Obergruppenführer John Smith.",
    cards: ["CARGAMENTO", "CANON CITY", "ZONA NEUTRAL", "PARA EL HOMBRE EN EL CASTILLO"],
    query: "The Man in the High Castle Joe Blake truck film Canon City",
  },
  {
    id: "s1-finale",
    season: 1, episode: "E10 · «A Way Out»",
    title: "La cinta que deja a Juliana y Frank en shock",
    viewers: "Juliana Crain y Frank Frink",
    world: "Otro mundo distinto, con un futuro terrible",
    summary: "En el final de temporada, Juliana y Frank ven una cinta nueva y se quedan horrorizados con lo que muestra. Joe aparece, se pelea con Frank por ella y se la lleva sin aclarar si de verdad es nazi. En la misma escena final, Tagomi medita en un parque y despierta en un San Francisco distinto, sin ocupación japonesa.",
    cards: ["OTRO MUNDO", "OTRO DESTINO", "¿PUEDE CAMBIARSE?"],
    query: "The Man in the High Castle A Way Out film Juliana Frank",
  },
  {
    id: "s2-abendsen-archive",
    season: 2, episode: "Primeros episodios",
    title: "El almacén de Hawthorne Abendsen",
    viewers: "Juliana Crain",
    world: "Cientos de mundos distintos",
    summary: "Juliana por fin conoce al Hombre en el Castillo, Hawthorne Abendsen. La lleva a un enorme almacén repleto de cintas, desde la Segunda Guerra Mundial hasta la actualidad, cada una de un mundo distinto. Juliana aparece en muchas de ellas. Abendsen las estudia para entender qué decisiones cambian el destino.",
    cards: ["EL ARCHIVO", "MILES DE MUNDOS", "UNA SOLA JULIANA"],
    query: "The Man in the High Castle season 2 Abendsen film archive Juliana",
  },
  {
    id: "s2-sf-nuke",
    season: 2, episode: "«Duck and Cover»",
    title: "San Francisco destruida",
    viewers: "Juliana Crain y Hawthorne Abendsen",
    world: "Estalla una guerra nuclear entre el Reich y Japón",
    summary: "Una de las cintas del almacén muestra San Francisco arrasada por una bomba atómica. Juliana corre a avisar a su familia. Abendsen señala a un hombre que aparece muerto en la cinta: George Dixon, la clave para que ocurra la catástrofe. Al final Juliana toma la terrible decisión de disparar a Dixon, y Abendsen le dice que con eso ha evitado el desastre nuclear.",
    cards: ["SAN FRANCISCO", "LA BOMBA", "GEORGE DIXON", "DUCK AND COVER"],
    query: "The Man in the High Castle season 2 San Francisco nuke film George Dixon",
  },
  {
    id: "s2-hitler-vault",
    season: 2, episode: "E10 · «Fallout»",
    title: "La bóveda de cintas de Hitler",
    viewers: "John Smith",
    world: "Colección de muchos mundos",
    summary: "Hitler llevaba años reuniendo cintas de otros mundos en Berlín. Tras impedir una guerra nuclear al final de la temporada, John Smith se hace con el acceso a esa bóveda. Su contenido es la base de la obsesión del Reich por otros mundos en la temporada 3.",
    cards: ["BERLÍN", "LA BÓVEDA DEL FÜHRER", "MATERIAL CLASIFICADO"],
    query: "The Man in the High Castle season 2 Hitler film vault Smith",
  },
  {
    id: "s3-tagomi-films",
    season: 3, episode: "Temporada 3",
    title: "Las cintas que trae Tagomi",
    viewers: "Tagomi, Kido, John Smith",
    world: "Una Tierra donde Japón no conquistó la costa oeste",
    summary: "Tagomi viaja a otra Tierra y vuelve con películas. Kido entrega una a John Smith como prueba de que Japón tiene la bomba atómica, para frenar al Reich. Mientras, Juliana y Tagomi intentan descifrar el misterio de las últimas cintas que quedan.",
    cards: ["DE LA OTRA TIERRA", "PRUEBA ATÓMICA", "PARA SMITH"],
    query: "The Man in the High Castle season 3 Tagomi film Kido Smith bomb",
  },
  {
    id: "s3-nebenwelt",
    season: 3, episode: "Temporada 3",
    title: "Die Nebenwelt: el proyecto del Reich",
    viewers: "John Smith, científicos del Reich",
    world: "«El mundo de al lado»",
    summary: "Con las cintas de Hitler, los científicos nazis estudian las «Nebenwelten», los mundos paralelos, y construyen en las minas de Pensilvania una máquina para cruzar. Smith habla con un médico alemán sobre la existencia de esos mundos, donde su hijo Thomas podría seguir vivo.",
    cards: ["DIE NEBENWELT", "PROYECTO SECRETO", "POCONOS, PENSILVANIA"],
    query: "The Man in the High Castle season 3 Nebenwelt films",
  },
  {
    id: "s3-jahr-null",
    season: 3, episode: "E10 · «Jahr Null»",
    title: "El salto de Juliana",
    viewers: "Juliana Crain",
    world: "Nuestro mundo (o uno muy parecido)",
    summary: "Al final de la temporada, Juliana deja de mirar las cintas y cruza ella misma al otro mundo, el que aparecía en las películas.",
    cards: ["AÑO CERO", "EL CRUCE", "AL OTRO LADO"],
    query: "The Man in the High Castle Jahr Null Juliana crosses",
  },
  {
    id: "s4-other-smith",
    season: 4, episode: "E1",
    title: "El otro John Smith",
    viewers: "Juliana Crain",
    world: "Estados Unidos libre",
    summary: "Juliana despierta en el otro mundo después de que la atropelle un John Smith distinto: un vendedor de seguros que vive con su mujer y su hijo Thomas. Es el mundo de las cintas visto desde dentro, y la lleva a un misterio que tiene que ver con Tagomi.",
    cards: ["OTRA AMÉRICA", "OTRO SMITH", "THOMAS VIVE"],
    query: "The Man in the High Castle season 4 episode 1 Juliana other John Smith",
  },
  {
    id: "s4-portal",
    season: 4, episode: "E10 · «Fire from the Gods»",
    title: "El portal",
    viewers: "Juliana, Hawthorne Abendsen y la Resistencia",
    world: "Todos los mundos a la vez",
    summary: "En el final de la serie, la Resistencia toma el control del portal. Juliana se reencuentra con Abendsen mientras la máquina se activa y cientos de personas de otras Tierras empiezan a cruzar. Las cintas ya no hacen falta: los mundos se tocan.",
    cards: ["FIRE FROM THE GODS", "EL PORTAL", "VIAJEROS", "FIN"],
    query: "The Man in the High Castle series finale portal travelers",
  },
];

export const primeLink = (f) => `https://www.primevideo.com/search/ref=atv_nb_sug?phrase=${encodeURIComponent("The Man in the High Castle")}`;
export const youtubeLink = (f) => `https://www.youtube.com/results?search_query=${encodeURIComponent(f.query)}`;
