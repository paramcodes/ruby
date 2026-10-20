export default function HomePage() {
  return (
    <main className="home">
      <section className="home__intro" aria-labelledby="home-title">
        <p className="home__eyebrow">Individual Wiki</p>
        <h1 className="home__title" id="home-title">
          Your personal wiki
        </h1>
        <p className="home__description">
          Capture useful notes, shape them into pages, and find them when you
          need them.
        </p>
      </section>
    </main>
  );
}
