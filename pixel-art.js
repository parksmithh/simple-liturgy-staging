const ICON_ROOT = "./assets/liturgical-icons";
const liturgicalAsset = filename => `${ICON_ROOT}/liturgical-calendar/${filename}`;
const saintAsset = filename => `${ICON_ROOT}/saints/${filename}`;

const LITURGICAL_ASSETS = Object.freeze({
  solemnity: liturgicalAsset("lit-01-solemnity.svg"),
  feast: liturgicalAsset("lit-02-feast.svg"),
  christTheKing: liturgicalAsset("lit-03-christ-the-king.svg"),
  lambOfGod: liturgicalAsset("lit-04-lamb-of-god.svg"),
  maundyThursday: liturgicalAsset("lit-05-maundy-thursday.svg"),
  goodFriday: liturgicalAsset("lit-06-good-friday.svg"),
  holySaturday: liturgicalAsset("lit-07-holy-saturday.svg"),
  easterSunday: liturgicalAsset("lit-08-easter-sunday.svg"),
  easterSeason: liturgicalAsset("lit-09-easter-season.svg"),
  pentecost: liturgicalAsset("lit-10-pentecost.svg"),
  trinitySunday: liturgicalAsset("lit-11-trinity-sunday.svg"),
  ordinaryTime: liturgicalAsset("lit-12-ordinary-time.svg"),
  ordination: liturgicalAsset("lit-13-ordination.svg"),
  baptism: liturgicalAsset("lit-14-baptism.svg"),
  anointingOfTheSick: liturgicalAsset("lit-15-anointing-of-the-sick.svg"),
  peterAndPaul: liturgicalAsset("lit-16-st-peter-st-paul.svg"),
  martyrdom: liturgicalAsset("lit-17-martyrdom.svg"),
  bishop: liturgicalAsset("lit-18-bishop.svg"),
  dedicationOfAChurch: liturgicalAsset("lit-19-dedication-of-a-church.svg"),
  allAngels: liturgicalAsset("lit-20-all-angels.svg"),
  advent: liturgicalAsset("lit-21-advent.svg"),
  christmasEve: liturgicalAsset("lit-22-christmas-eve.svg"),
  christmasDay: liturgicalAsset("lit-23-christmas-day.svg"),
  presentationOfChrist: liturgicalAsset("lit-24-presentation-of-christ.svg"),
  epiphany: liturgicalAsset("lit-25-epiphany.svg"),
  epiphanySeason: liturgicalAsset("lit-26-epiphany-season.svg"),
  transfiguration: liturgicalAsset("lit-27-transfiguration.svg"),
  palmSunday: liturgicalAsset("lit-28-palm-sunday.svg"),
  holyCommunion: liturgicalAsset("lit-29-holy-communion.svg"),
  crownOfThorns: liturgicalAsset("lit-30-crown-of-thorns.svg"),
  nails: liturgicalAsset("lit-31-nails.svg"),
  spear: liturgicalAsset("lit-32-spear.svg"),
  emptyTomb: liturgicalAsset("lit-33-empty-tomb.svg"),
  paschalCandle: liturgicalAsset("lit-34-paschal-candle.svg"),
  peace: liturgicalAsset("lit-35-peace.svg"),
  harvest: liturgicalAsset("lit-36-harvest.svg"),
  prayer: liturgicalAsset("lit-37-prayer.svg"),
  altar: liturgicalAsset("lit-38-altar.svg"),
  praise: liturgicalAsset("lit-39-praise.svg"),
  hope: liturgicalAsset("lit-40-hope.svg"),
});

const SAINT_ASSETS = Object.freeze({
  peter: saintAsset("saint-01-st-peter.svg"),
  paul: saintAsset("saint-02-st-paul.svg"),
  mary: saintAsset("saint-03-st-mary.svg"),
  benedict: saintAsset("saint-04-st-benedict.svg"),
  francis: saintAsset("saint-05-st-francis.svg"),
  teresaOfAvila: saintAsset("saint-06-st-teresa-of-avila.svg"),
  augustine: saintAsset("saint-07-st-augustine.svg"),
  joseph: saintAsset("saint-08-st-joseph.svg"),
  joanOfArc: saintAsset("saint-09-st-joan-of-arc.svg"),
  patrick: saintAsset("saint-10-st-patrick.svg"),
  catherineOfAlexandria: saintAsset("saint-11-st-catherine-of-alexandria.svg"),
  johnChrysostom: saintAsset("saint-12-st-john-chrysostom.svg"),
  thomasAquinas: saintAsset("saint-13-st-thomas-aquinas.svg"),
  margaret: saintAsset("saint-14-st-margaret.svg"),
  nicholas: saintAsset("saint-15-st-nicholas.svg"),
  lucy: saintAsset("saint-16-st-lucy.svg"),
  johnTheBaptist: saintAsset("saint-17-st-john-the-baptist.svg"),
  stephen: saintAsset("saint-18-st-stephen.svg"),
  philip: saintAsset("saint-19-st-philip.svg"),
  jamesTheApostle: saintAsset("saint-20-st-james-the-apostle.svg"),
  matthias: saintAsset("saint-21-st-matthias.svg"),
  luke: saintAsset("saint-22-st-luke.svg"),
  mark: saintAsset("saint-23-st-mark.svg"),
  johnTheEvangelist: saintAsset("saint-24-st-john-the-evangelist.svg"),
  martha: saintAsset("saint-25-st-martha.svg"),
  maryMagdalene: saintAsset("saint-26-st-mary-magdalene.svg"),
  michaelTheArchangel: saintAsset("saint-27-st-michael-the-archangel.svg"),
  gabrielTheArchangel: saintAsset("saint-28-st-gabriel-the-archangel.svg"),
  raphaelTheArchangel: saintAsset("saint-29-st-raphael-the-archangel.svg"),
  allSaints: saintAsset("saint-30-all-saints.svg"),
});

export const ALL_ICON_ASSET_PATHS = Object.freeze([
  ...Object.values(LITURGICAL_ASSETS),
  ...Object.values(SAINT_ASSETS),
]);

const ICON_ASSET_PATHS = Object.freeze({
  "season-advent": LITURGICAL_ASSETS.advent,
  "season-christmas": LITURGICAL_ASSETS.christmasDay,
  "season-epiphany": LITURGICAL_ASSETS.epiphanySeason,
  "season-lent": LITURGICAL_ASSETS.prayer,
  "season-holy-week": LITURGICAL_ASSETS.crownOfThorns,
  "season-easter": LITURGICAL_ASSETS.easterSeason,
  "season-pentecost": LITURGICAL_ASSETS.pentecost,
  "season-ordinary": LITURGICAL_ASSETS.ordinaryTime,
  "advent-1": LITURGICAL_ASSETS.advent,
  "advent-2": LITURGICAL_ASSETS.advent,
  "advent-3": LITURGICAL_ASSETS.advent,
  "advent-4": LITURGICAL_ASSETS.advent,
  "ash-wednesday": LITURGICAL_ASSETS.prayer,
  "palm-sunday": LITURGICAL_ASSETS.palmSunday,
  "holy-monday": LITURGICAL_ASSETS.crownOfThorns,
  "holy-tuesday": LITURGICAL_ASSETS.nails,
  "holy-wednesday": LITURGICAL_ASSETS.spear,
  "maundy-thursday": LITURGICAL_ASSETS.maundyThursday,
  "good-friday": LITURGICAL_ASSETS.goodFriday,
  "holy-saturday": LITURGICAL_ASSETS.holySaturday,
  easter: LITURGICAL_ASSETS.easterSunday,
  ascension: LITURGICAL_ASSETS.hope,
  pentecost: LITURGICAL_ASSETS.pentecost,
  trinity: LITURGICAL_ASSETS.trinitySunday,
  "christmas-eve": LITURGICAL_ASSETS.christmasEve,
  christmas: LITURGICAL_ASSETS.christmasDay,
  epiphany: LITURGICAL_ASSETS.epiphany,
  eucharist: LITURGICAL_ASSETS.holyCommunion,
  "friday-cross": LITURGICAL_ASSETS.goodFriday,
  saint: SAINT_ASSETS.allSaints,
  apostle: LITURGICAL_ASSETS.peterAndPaul,
  martyr: LITURGICAL_ASSETS.martyrdom,
  feast: LITURGICAL_ASSETS.feast,
});

const FEAST_ASSET_PATHS = Object.freeze({
  "The Holy Name": LITURGICAL_ASSETS.solemnity,
  "Confession of St. Peter": SAINT_ASSETS.peter,
  "Conversion of St. Paul": SAINT_ASSETS.paul,
  "The Presentation": LITURGICAL_ASSETS.presentationOfChrist,
  "The Annunciation": SAINT_ASSETS.mary,
  "The Visitation": SAINT_ASSETS.mary,
  "Nativity of St. John the Baptist": SAINT_ASSETS.johnTheBaptist,
  "St. Peter and St. Paul": LITURGICAL_ASSETS.peterAndPaul,
  "The Transfiguration": LITURGICAL_ASSETS.transfiguration,
  "Holy Cross Day": LITURGICAL_ASSETS.goodFriday,
  "Thanksgiving Day": LITURGICAL_ASSETS.harvest,
  "The Holy Innocents": LITURGICAL_ASSETS.martyrdom,
  "All Saints' Day": SAINT_ASSETS.allSaints,
  "All Saints": SAINT_ASSETS.allSaints,
  "St. Peter": SAINT_ASSETS.peter,
  "St. Paul": SAINT_ASSETS.paul,
  "St. Mary": SAINT_ASSETS.mary,
  "St. Mary the Virgin": SAINT_ASSETS.mary,
  "St. Benedict": SAINT_ASSETS.benedict,
  "St. Francis": SAINT_ASSETS.francis,
  "St. Francis of Assisi": SAINT_ASSETS.francis,
  "St. Teresa of Avila": SAINT_ASSETS.teresaOfAvila,
  "St. Augustine": SAINT_ASSETS.augustine,
  "St. Joseph": SAINT_ASSETS.joseph,
  "St. Joan of Arc": SAINT_ASSETS.joanOfArc,
  "St. Patrick": SAINT_ASSETS.patrick,
  "St. Catherine of Alexandria": SAINT_ASSETS.catherineOfAlexandria,
  "St. John Chrysostom": SAINT_ASSETS.johnChrysostom,
  "St. Thomas Aquinas": SAINT_ASSETS.thomasAquinas,
  "St. Margaret": SAINT_ASSETS.margaret,
  "St. Nicholas": SAINT_ASSETS.nicholas,
  "St. Lucy": SAINT_ASSETS.lucy,
  "St. John the Baptist": SAINT_ASSETS.johnTheBaptist,
  "St. Stephen": SAINT_ASSETS.stephen,
  "St. Philip": SAINT_ASSETS.philip,
  "St. James": SAINT_ASSETS.jamesTheApostle,
  "St. James the Apostle": SAINT_ASSETS.jamesTheApostle,
  "St. James of Jerusalem": LITURGICAL_ASSETS.bishop,
  "St. Matthias": SAINT_ASSETS.matthias,
  "St. Luke": SAINT_ASSETS.luke,
  "St. Mark": SAINT_ASSETS.mark,
  "St. John": SAINT_ASSETS.johnTheEvangelist,
  "St. John the Evangelist": SAINT_ASSETS.johnTheEvangelist,
  "St. Martha": SAINT_ASSETS.martha,
  "St. Mary Magdalene": SAINT_ASSETS.maryMagdalene,
  "St. Michael and All Angels": LITURGICAL_ASSETS.allAngels,
  "St. Michael the Archangel": SAINT_ASSETS.michaelTheArchangel,
  "St. Gabriel the Archangel": SAINT_ASSETS.gabrielTheArchangel,
  "St. Raphael the Archangel": SAINT_ASSETS.raphaelTheArchangel,
});

const APOSTLE_FEASTS = new Set([
  "St. Philip and St. James",
  "St. Barnabas",
  "St. Simon and St. Jude",
]);

function weekdayFor(view) {
  if (!view.date) return null;
  return new Date(`${view.date}T12:00:00Z`).getUTCDay();
}

function seasonArtNameFor(view) {
  const label = String(view.label || "").toLowerCase();
  if (label.includes("advent")) return "season-advent";
  if (label.includes("christmas")) return "season-christmas";
  if (label.includes("epiphany")) return "season-epiphany";
  if (label.includes("ash wednesday") || label.includes("lent")) return "season-lent";
  if (label === "holy week") return "season-holy-week";
  if (label.includes("easter")) return "season-easter";
  if (label === "the day of pentecost") return "season-pentecost";
  if (label === "trinity sunday" || label.includes("proper")) return "season-ordinary";
  return null;
}

function principalArtNameFor(view) {
  const label = String(view.label || "").toLowerCase();
  const weekday = weekdayFor(view);
  if (view.feast === "Christmas Day") return "christmas";
  if (view.feast === "The Epiphany") return "epiphany";
  if (view.date?.slice(5) === "12-24") return "christmas-eve";
  if (label === "the day of pentecost") return "pentecost";
  if (label === "trinity sunday") return "trinity";
  if (label === "ash wednesday and following" && weekday === 3) return "ash-wednesday";
  if (label === "holy week") {
    if (weekday === 0) return "palm-sunday";
    if (weekday === 1) return "holy-monday";
    if (weekday === 2) return "holy-tuesday";
    if (weekday === 3) return "holy-wednesday";
    if (weekday === 4) return "maundy-thursday";
    if (weekday === 5) return "good-friday";
    if (weekday === 6) return "holy-saturday";
  }
  if (label === "easter week" && weekday === 0) return "easter";
  if (label === "week of 6 easter" && weekday === 4) return "ascension";
  const adventWeek = label.match(/^week of ([1-4]) advent$/)?.[1];
  if (adventWeek && weekday === 0) return `advent-${adventWeek}`;
  return null;
}

function feastArtNameFor(feast) {
  if (!feast || feast === "Christmas Day" || feast === "The Epiphany") return null;
  if (FEAST_ASSET_PATHS[feast]) return `feast:${feast}`;
  if (APOSTLE_FEASTS.has(feast)) return "apostle";
  if (/\bMartyrs?\b/.test(feast)) return "martyr";
  if (/\bSt\.|Saints?'?\b/.test(feast)) return "saint";
  return `feast:${feast}`;
}

export function iconAssetPathFor(name) {
  if (name.startsWith("feast:")) {
    return FEAST_ASSET_PATHS[name.slice("feast:".length)] || ICON_ASSET_PATHS.feast;
  }
  return ICON_ASSET_PATHS[name] || ICON_ASSET_PATHS.feast;
}

export function artNameFor(view) {
  return artNamesFor(view)[0] || null;
}

export function artNamesFor(view) {
  const weekday = weekdayFor(view);
  const season = seasonArtNameFor(view);
  const principal = principalArtNameFor(view);
  const names = [season, principal, feastArtNameFor(view.feast)].filter(Boolean);
  if (weekday === 0) names.push("eucharist");
  if (weekday === 5 && principal !== "good-friday") names.push("friday-cross");
  return [...new Set(names)];
}

export function calendarEventIconAssetPath(view) {
  if (!view) return null;
  const name = feastArtNameFor(view.feast) || principalArtNameFor(view) || seasonArtNameFor(view);
  return name ? iconAssetPathFor(name) : null;
}

function iconLabelFor(name) {
  if (name.startsWith("feast:")) return name.slice("feast:".length);
  return name.replace(/^season-/, "").replaceAll("-", " ");
}

function createSourceIcon(name) {
  const image = document.createElement("img");
  image.setAttribute("class", "pixel-art");
  image.setAttribute("src", new URL(iconAssetPathFor(name), import.meta.url).href);
  image.setAttribute("alt", `${iconLabelFor(name)} liturgical icon`);
  image.setAttribute("draggable", "false");
  image.setAttribute("decoding", "async");
  return image;
}

export function renderPixelArtStack(container, view) {
  const names = artNamesFor(view);
  const seenAssets = new Set();
  const distinctNames = names.filter(name => {
    const assetPath = iconAssetPathFor(name);
    if (seenAssets.has(assetPath)) return false;
    seenAssets.add(assetPath);
    return true;
  });
  const iconKey = [...seenAssets].join("\n");
  if (container.dataset.icons === iconKey) return;
  const icons = distinctNames.map(createSourceIcon);
  container.dataset.count = String(icons.length);
  container.dataset.icons = iconKey;
  container.replaceChildren(...icons);
}

export function paintPixelArtStack(screen, view, previousArtStack = null) {
  const nextArtStack = screen.querySelector(".pixel-art-stack");
  if (!nextArtStack) return null;
  const artStack = previousArtStack || nextArtStack;
  if (previousArtStack && previousArtStack !== nextArtStack) nextArtStack.replaceWith(previousArtStack);
  renderPixelArtStack(artStack, view);
  return artStack;
}
