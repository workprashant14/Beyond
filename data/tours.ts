/**
 * Guided tours: ordered stops through objects that already exist in the catalogue and the 3D scene.
 * `look` lines are short pointers for what to notice. They deliberately contain NO numbers or new facts:
 * every measured value shown during a tour comes from the object's catalogue panel, with its sources.
 */
export interface TourStep { id: string; look: string }
export interface Tour { id: string; title: string; blurb: string; steps: TourStep[] }

export const TOURS: Tour[] = [
  {
    id: "solar-system",
    title: "The Solar System, inside out",
    blurb: "From the Sun out to Neptune, one stop at a time.",
    steps: [
      { id: "sun", look: "Everything else on this tour orbits this star. Check its catalogued size and mass." },
      { id: "mercury", look: "The innermost planet. Compare its orbital period with the others as you go." },
      { id: "venus", look: "Similar in size to Earth, very different in character. Read the temperature row." },
      { id: "earth", look: "Our home. Use the date control in this view to watch the planets move on their orbits." },
      { id: "moon", look: "Earth's natural satellite. Its orbit is drawn from mean orbital elements." },
      { id: "mars", look: "Note how its day compares with Earth's in the rotation row." },
      { id: "jupiter", look: "The largest planet. Notice how its diameter compares with Earth's." },
      { id: "saturn", look: "Its rings are the visual signature. Check the composition row." },
      { id: "uranus", look: "Look at the orbital period: one year here is very long." },
      { id: "neptune", look: "The outermost planet of the eight. Its distance row shows how far out that is." },
    ],
  },
  {
    id: "galactic-neighbourhood",
    title: "Our galactic neighbourhood",
    blurb: "From our own galaxy to its closest large neighbours.",
    steps: [
      { id: "milky-way", look: "Our home galaxy. The picture is an artistic impression, the panel holds the measured data." },
      { id: "solar-system", look: "Our own star system, placed schematically inside the galaxy." },
      { id: "sirius", look: "A nearby star. See its distance row." },
      { id: "proxima-b", look: "An exoplanet around the nearest star we know of. Read the distance and discovery rows." },
      { id: "orion-nebula", look: "A star-forming nebula. Read what the catalogue says it is made of." },
      { id: "andromeda", look: "The large neighbouring galaxy of the Local Group." },
      { id: "triangulum", look: "Another Local Group galaxy. Compare its panel with Andromeda's." },
    ],
  },
  {
    id: "black-holes",
    title: "Black holes",
    blurb: "A black hole in our own galaxy's centre, a stellar one, and one in another galaxy.",
    steps: [
      { id: "sgr-a", look: "At the centre of our galaxy. Read the mass row." },
      { id: "cygnus-x1", look: "A stellar-mass black hole in a binary system. Compare its mass with the one before." },
      { id: "m87", look: "In another galaxy, and the first black hole ever imaged. Check the catalogue's notes on how." },
    ],
  },
  {
    id: "jupiters-moons",
    title: "Jupiter and its big moons",
    blurb: "The four Galilean moons, drawn on orbits from real mean elements.",
    steps: [
      { id: "jupiter", look: "The host planet. Turn on moon orbits in the controls to see the moons' paths." },
      { id: "io", look: "The innermost of the four. Check its orbital period." },
      { id: "europa", look: "Compare its orbital period with Io's." },
      { id: "ganymede", look: "Check its diameter row against the other moons." },
      { id: "callisto", look: "The outermost of the four. Compare its orbital period with the rest." },
    ],
  },
];

export const getTour = (id: string | null | undefined): Tour | undefined => TOURS.find((t) => t.id === id);
