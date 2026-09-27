// Direct, human-reviewed destinations for every church-feast label in the installed pack.
// National and unknown occasions intentionally have no entry and fail closed.
export const FEAST_WIKIPEDIA_PAGES = Object.freeze({
  "All Saints' Day": "https://en.wikipedia.org/wiki/All_Saints%27_Day",
  "Christmas Day": "https://en.wikipedia.org/wiki/Christmas",
  "Confession of St. Peter": "https://en.wikipedia.org/wiki/Confession_of_Peter",
  "Conversion of St. Paul": "https://en.wikipedia.org/wiki/Conversion_of_Paul_the_Apostle",
  "Holy Cross Day": "https://en.wikipedia.org/wiki/Feast_of_the_Cross",
  "Nativity of St. John the Baptist": "https://en.wikipedia.org/wiki/Nativity_of_John_the_Baptist",
  "St. Andrew": "https://en.wikipedia.org/wiki/Andrew_the_Apostle",
  "St. Barnabas": "https://en.wikipedia.org/wiki/Barnabas",
  "St. Bartholomew": "https://en.wikipedia.org/wiki/Bartholomew_the_Apostle",
  "St. James": "https://en.wikipedia.org/wiki/James_the_Great",
  "St. James of Jerusalem": "https://en.wikipedia.org/wiki/James,_brother_of_Jesus",
  "St. John": "https://en.wikipedia.org/wiki/John_the_Apostle",
  "St. Joseph": "https://en.wikipedia.org/wiki/Saint_Joseph",
  "St. Luke": "https://en.wikipedia.org/wiki/Luke_the_Evangelist",
  "St. Mark": "https://en.wikipedia.org/wiki/Mark_the_Evangelist",
  "St. Mary Magdalene": "https://en.wikipedia.org/wiki/Mary_Magdalene",
  "St. Mary the Virgin": "https://en.wikipedia.org/wiki/Mary,_mother_of_Jesus",
  "St. Matthew": "https://en.wikipedia.org/wiki/Matthew_the_Apostle",
  "St. Matthias": "https://en.wikipedia.org/wiki/Matthias_the_Apostle",
  "St. Michael and All Angels": "https://en.wikipedia.org/wiki/Michaelmas",
  "St. Peter and St. Paul": "https://en.wikipedia.org/wiki/Feast_of_Saints_Peter_and_Paul",
  "St. Philip and St. James": "https://en.wikipedia.org/wiki/Philip_the_Apostle#Veneration",
  "St. Simon and St. Jude": "https://en.wikipedia.org/wiki/Simon_the_Zealot#Sainthood",
  "St. Stephen": "https://en.wikipedia.org/wiki/Saint_Stephen",
  "St. Thomas": "https://en.wikipedia.org/wiki/Thomas_the_Apostle",
  "The Annunciation": "https://en.wikipedia.org/wiki/Annunciation",
  "The Epiphany": "https://en.wikipedia.org/wiki/Epiphany_(holiday)",
  "The Holy Innocents": "https://en.wikipedia.org/wiki/Massacre_of_the_Innocents",
  "The Holy Name": "https://en.wikipedia.org/wiki/Feast_of_the_Holy_Name_of_Jesus",
  "The Presentation": "https://en.wikipedia.org/wiki/Presentation_of_Jesus",
  "The Transfiguration": "https://en.wikipedia.org/wiki/Transfiguration_of_Jesus",
  "The Visitation": "https://en.wikipedia.org/wiki/Visitation_(Christianity)",
});

export function wikipediaUrlForFeast(feast) {
  return Object.hasOwn(FEAST_WIKIPEDIA_PAGES, feast) ? FEAST_WIKIPEDIA_PAGES[feast] : null;
}
